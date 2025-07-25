-- The purpose of this is to first take in all items of a scanned invoice.
-- Then it will check the database for all instances of that invoice
-- Then it will tell the user how much the price has increased.
-- To be used in a scenario where its like, in this scan compared to past scans
-- the price has increased by $85! And then alert the user of what increased
WITH recent_scan_items AS (
    SELECT
        ii.distributor_product_id,
        dp.item_id,
        dpm.description as item_description,
        ii.unit_price_cents / 100.0 as current_price,
        ii.quantity,
        (ii.unit_price_cents / 100.0) * ii.quantity as current_line_total,
        i.distributor_id,
        i.restaurant_id,
        i.created_at as current_scan_date,
        i.invoice_date
    FROM invoice_items ii
    JOIN invoice_scans ins ON ii.invoice_scan_id = ins.id
    JOIN invoices i ON ins.invoice_uuid = i.uuid
    JOIN distributor_products dp ON ii.distributor_product_id = dp.id
    JOIN distributor_product_metadata dpm ON ii.distributor_product_metadata_id = dpm.id
    
    WHERE ins.id = 275 -- Parameter for invoice scan ID
    AND ii.unit_price_cents > 0
    AND ii.quantity > 0
),
order_frequency AS (
    SELECT
        AVG(days_between) as avg_order_frequency_days
    FROM (
        SELECT
            LAG(i.created_at) OVER (ORDER BY i.created_at) as prev_order,
            i.created_at,
            EXTRACT(DAYS FROM (i.created_at - LAG(i.created_at) OVER (ORDER BY i.created_at))) as days_between
        FROM invoices i
        WHERE i.restaurant_id = (SELECT restaurant_id FROM recent_scan_items LIMIT 1)
        AND i.distributor_id = (SELECT distributor_id FROM recent_scan_items LIMIT 1)
        AND i.created_at >= CURRENT_DATE - INTERVAL '6 months'
        ORDER BY i.created_at
    ) freq_calc
    WHERE days_between IS NOT NULL
),
historical_prices AS (
    SELECT
        ii.distributor_product_id,
        ii.unit_price_cents / 100.0 as historical_price,
        i.created_at,
        ROW_NUMBER() OVER (
            PARTITION BY ii.distributor_product_id
            ORDER BY i.created_at DESC
        ) as price_rank,
        MIN(ii.unit_price_cents / 100.0) OVER (
            PARTITION BY ii.distributor_product_id
        ) as lowest_price
    FROM invoice_items ii
    JOIN invoice_scans ins ON ii.invoice_scan_id = ins.id
    JOIN invoices i ON ins.invoice_uuid = i.uuid
    JOIN distributor_product_metadata dpm ON ii.distributor_product_metadata_id = dpm.id
    WHERE EXISTS (
        SELECT 1 FROM recent_scan_items rsi
        WHERE rsi.distributor_product_id = ii.distributor_product_id
        AND rsi.distributor_id = i.distributor_id
        AND rsi.restaurant_id = i.restaurant_id
    )
    AND i.created_at < (SELECT current_scan_date FROM recent_scan_items LIMIT 1)
    AND i.created_at >= CURRENT_DATE - INTERVAL '3 months'
    AND ii.unit_price_cents > 0
    AND ii.quantity > 0
),
price_analysis AS (
    SELECT
        rsi.distributor_product_id,
        rsi.item_id,
        rsi.distributor_id,
        rsi.current_price,
        rsi.quantity,
        rsi.current_line_total,
        rsi.item_description,
        COALESCE(hp.historical_price, rsi.current_price) as comparison_price,
        COALESCE(hp.lowest_price, rsi.current_price) as lowest_price,
        rsi.current_scan_date,
        hp.created_at as historical_date,
        COALESCE(EXTRACT(DAYS FROM (rsi.current_scan_date - hp.created_at)), 0) as days_between,
        CASE
            WHEN hp.historical_price IS NOT NULL AND hp.historical_price != rsi.current_price THEN
                (rsi.current_price - hp.historical_price) * rsi.quantity
            ELSE 0
        END as line_item_increase,
        CASE
            WHEN hp.historical_price IS NOT NULL AND hp.historical_price > 0 AND
                 hp.historical_price != rsi.current_price AND
                 COALESCE(EXTRACT(DAYS FROM (rsi.current_scan_date - hp.created_at)), 1) > 0 THEN
                (((rsi.current_price - hp.historical_price) / hp.historical_price) * 100) *
                (365.0 / COALESCE(EXTRACT(DAYS FROM (rsi.current_scan_date - hp.created_at)), 365))
            ELSE 0
        END as annualized_inflation_rate,
        CASE
            WHEN hp.historical_price IS NOT NULL AND hp.historical_price > 0 THEN
                ((rsi.current_price - hp.historical_price) / hp.historical_price) * 100
            ELSE 0
        END as percent_change
    FROM recent_scan_items rsi
    LEFT JOIN (
        SELECT DISTINCT ON (distributor_product_id)
            distributor_product_id, historical_price, created_at, lowest_price
        FROM historical_prices
        WHERE price_rank = 1
    ) hp ON rsi.distributor_product_id = hp.distributor_product_id
),
warning_calculation AS (
    SELECT
        SUM(current_line_total) as current_order_value,
        SUM(CASE WHEN line_item_increase != 0 THEN line_item_increase ELSE 0 END) as total_price_increase,
        AVG(CASE WHEN annualized_inflation_rate != 0 THEN annualized_inflation_rate END) as avg_inflation_rate,
        COUNT(CASE WHEN historical_date IS NOT NULL THEN 1 END) as items_with_history,
        COUNT(CASE WHEN line_item_increase != 0 THEN 1 END) as items_with_price_changes,
        COUNT(*) as total_items,
        (SELECT avg_order_frequency_days FROM order_frequency) as order_frequency_days,
        CASE
            WHEN (SELECT avg_order_frequency_days FROM order_frequency) > 0 THEN
                SUM(CASE WHEN line_item_increase != 0 THEN line_item_increase ELSE 0 END) * 
                (365.0 / (SELECT avg_order_frequency_days FROM order_frequency))
            ELSE 0
        END as projected_annual_increase
    FROM price_analysis
)

-- RESULT SET 1: Summary Data
SELECT
    'SUMMARY' as result_type,
    current_order_value,
    total_price_increase,
    ROUND(avg_inflation_rate::numeric, 2) as avg_annualized_inflation_rate,
    items_with_history,
    items_with_price_changes,
    total_items,
    ROUND(order_frequency_days::numeric, 1) as avg_days_between_orders,
    ROUND(projected_annual_increase::numeric, 2) as projected_annual_cost_increase,
    CASE
        WHEN projected_annual_increase > 100 THEN 'HIGH_IMPACT'
        WHEN projected_annual_increase > 50 THEN 'MEDIUM_IMPACT'
        WHEN projected_annual_increase > 0 THEN 'LOW_IMPACT'
        ELSE 'NO_IMPACT'
    END as impact_level,
    CASE
        WHEN projected_annual_increase > 0 AND items_with_price_changes > 0 THEN
            CONCAT(
                'COST ALERT: Based on recent price increases, if you continue ordering at your current frequency (',
                ROUND(order_frequency_days::numeric, 0), ' days between orders), ',
                'you could pay an additional $', ROUND(projected_annual_increase::numeric, 2),
                ' annually in supply costs due to inflation. ',
                'This represents a ', ROUND(avg_inflation_rate::numeric, 1), '% annualized price increase across ',
                items_with_price_changes, ' items with price changes.'
            )
        ELSE 'Insufficient historical data for cost projection.'
    END as customer_warning,
    NULL::text as item_id,
    NULL::integer as distributor_id,
    NULL::numeric as current_price,
    NULL::numeric as lowest_price,
    NULL::integer as quantity,
    NULL::numeric as percent_change,
    NULL::numeric as item_annualized_inflation_rate
FROM warning_calculation

UNION ALL

-- RESULT SET 2: Item Details
SELECT
    'ITEMS' as result_type,
    NULL::numeric as current_order_value,
    NULL::numeric as total_price_increase,
    NULL::numeric as avg_annualized_inflation_rate,
    NULL::bigint as items_with_history,
    NULL::bigint as items_with_price_changes,
    NULL::bigint as total_items,
    NULL::numeric as avg_days_between_orders,
    NULL::numeric as projected_annual_cost_increase,
    NULL::text as impact_level,
    NULL::text as customer_warning,
    item_id,
    distributor_id,
    ROUND(current_price::numeric, 2) as current_price,
    ROUND(lowest_price::numeric, 2) as lowest_price,
    quantity,
    ROUND(percent_change::numeric, 2) as percent_change,
    ROUND(annualized_inflation_rate::numeric, 2) as item_annualized_inflation_rate
FROM price_analysis

ORDER BY result_type DESC, item_id;