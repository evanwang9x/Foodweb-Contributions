-- Get all price changes for one specific distributor.
WITH distributor_items_recent AS (
    -- Get all items from the distributor in the last 30 days
    SELECT DISTINCT
        ii.distributor_product_id,
        dp.item_id,
        dpm.description as item_description,
        i.distributor_id,
        i.restaurant_id
    FROM invoice_items ii
    JOIN invoice_scans ins ON ii.invoice_scan_id = ins.id
    JOIN invoices i ON ins.invoice_uuid = i.uuid
    JOIN distributor_products dp ON ii.distributor_product_id = dp.id
    JOIN distributor_product_metadata dpm ON ii.distributor_product_metadata_id = dpm.id
    
    WHERE i.distributor_id = 123 -- Parameter for distributor ID
    AND i.created_at >= CURRENT_DATE - INTERVAL '30 days'
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
        WHERE i.distributor_id = 123 -- Parameter for distributor ID
        AND i.created_at >= CURRENT_DATE - INTERVAL '6 months'
        ORDER BY i.created_at
    ) freq_calc
    WHERE days_between IS NOT NULL
),
recent_prices AS (
    -- Get the most recent price for each item
    SELECT
        ii.distributor_product_id,
        ii.unit_price_cents / 100.0 as recent_price,
        ii.quantity as recent_quantity,
        i.created_at as recent_date,
        ROW_NUMBER() OVER (
            PARTITION BY ii.distributor_product_id
            ORDER BY i.created_at DESC, ins.id DESC
        ) as price_rank
    FROM invoice_items ii
    JOIN invoice_scans ins ON ii.invoice_scan_id = ins.id
    JOIN invoices i ON ins.invoice_uuid = i.uuid
    WHERE EXISTS (
        SELECT 1 FROM distributor_items_recent dir
        WHERE dir.distributor_product_id = ii.distributor_product_id
        AND dir.distributor_id = i.distributor_id
    )
    AND i.distributor_id = 123 -- Parameter for distributor ID
    AND i.created_at >= CURRENT_DATE - INTERVAL '30 days'
    AND ii.unit_price_cents > 0
    AND ii.quantity > 0
),
historical_prices AS (
    -- Get the most recent price from 30+ days ago for comparison
    SELECT
        ii.distributor_product_id,
        ii.unit_price_cents / 100.0 as historical_price,
        ii.quantity as historical_quantity,
        i.created_at as historical_date,
        ROW_NUMBER() OVER (
            PARTITION BY ii.distributor_product_id
            ORDER BY i.created_at DESC, ins.id DESC
        ) as price_rank
    FROM invoice_items ii
    JOIN invoice_scans ins ON ii.invoice_scan_id = ins.id
    JOIN invoices i ON ins.invoice_uuid = i.uuid
    WHERE EXISTS (
        SELECT 1 FROM distributor_items_recent dir
        WHERE dir.distributor_product_id = ii.distributor_product_id
        AND dir.distributor_id = i.distributor_id
    )
    AND i.distributor_id = 123 -- Parameter for distributor ID
    AND i.created_at < CURRENT_DATE - INTERVAL '30 days'
    AND i.created_at >= CURRENT_DATE - INTERVAL '3 months' -- Don't go too far back
    AND ii.unit_price_cents > 0
    AND ii.quantity > 0
),
price_analysis AS (
    SELECT
        dir.distributor_product_id,
        dir.item_id,
        dir.distributor_id,
        dir.item_description,
        rp.recent_price as current_price,
        rp.recent_quantity as quantity,
        rp.recent_price * rp.recent_quantity as current_line_total,
        rp.recent_date as current_scan_date,
        hp.historical_price as comparison_price,
        hp.historical_date,
        CASE
            WHEN hp.historical_date IS NOT NULL THEN
                EXTRACT(DAYS FROM (rp.recent_date - hp.historical_date))
            ELSE NULL
        END as days_between,
        CASE
            WHEN hp.historical_price IS NOT NULL AND hp.historical_price != rp.recent_price THEN
                (rp.recent_price - hp.historical_price) * rp.recent_quantity
            ELSE 0
        END as line_item_increase,
        CASE
            WHEN hp.historical_price IS NOT NULL AND hp.historical_price > 0 AND
                 hp.historical_price != rp.recent_price AND
                 EXTRACT(DAYS FROM (rp.recent_date - hp.historical_date)) > 0 THEN
                (((rp.recent_price - hp.historical_price) / hp.historical_price) * 100) *
                (365.0 / EXTRACT(DAYS FROM (rp.recent_date - hp.historical_date)))
            ELSE 0
        END as annualized_inflation_rate,
        CASE
            WHEN hp.historical_price IS NOT NULL AND hp.historical_price > 0 THEN
                ((rp.recent_price - hp.historical_price) / hp.historical_price) * 100
            ELSE 0
        END as percent_change,
        CASE
            WHEN hp.historical_price IS NULL THEN 'NO_HISTORICAL_DATA'
            WHEN hp.historical_price = rp.recent_price THEN 'NO_CHANGE'
            WHEN hp.historical_price < rp.recent_price THEN 'INCREASED'
            ELSE 'DECREASED'
        END as price_change_status
    FROM distributor_items_recent dir
    LEFT JOIN (
        SELECT * FROM recent_prices WHERE price_rank = 1
    ) rp ON dir.distributor_product_id = rp.distributor_product_id
    LEFT JOIN (
        SELECT * FROM historical_prices WHERE price_rank = 1
    ) hp ON dir.distributor_product_id = hp.distributor_product_id
    WHERE rp.recent_price IS NOT NULL -- Only include items that have recent data
),
warning_calculation AS (
    SELECT
        SUM(current_line_total) as current_order_value,
        SUM(CASE WHEN line_item_increase != 0 THEN line_item_increase ELSE 0 END) as total_price_increase,
        AVG(CASE WHEN annualized_inflation_rate != 0 THEN annualized_inflation_rate END) as avg_inflation_rate,
        COUNT(CASE WHEN historical_date IS NOT NULL THEN 1 END) as items_with_history,
        COUNT(CASE WHEN line_item_increase != 0 THEN 1 END) as items_with_price_changes,
        COUNT(CASE WHEN price_change_status = 'INCREASED' THEN 1 END) as items_with_increases,
        COUNT(CASE WHEN price_change_status = 'DECREASED' THEN 1 END) as items_with_decreases,
        COUNT(CASE WHEN price_change_status = 'NO_HISTORICAL_DATA' THEN 1 END) as items_without_history,
        COUNT(*) as total_items,
        (SELECT avg_order_frequency_days FROM order_frequency) as order_frequency_days,
        CASE
            WHEN (SELECT avg_order_frequency_days FROM order_frequency) > 0 THEN
                SUM(CASE WHEN line_item_increase != 0 THEN line_item_increase ELSE 0 END) * 
                (365.0 / (SELECT avg_order_frequency_days FROM order_frequency))
            ELSE 0
        END as projected_annual_increase
    FROM price_analysis
),

-- Combine results and order them
combined_results AS (
    -- RESULT SET 1: Summary Data
    SELECT
        'SUMMARY' as result_type,
        current_order_value,
        total_price_increase,
        ROUND(avg_inflation_rate::numeric, 2) as avg_annualized_inflation_rate,
        items_with_history,
        items_with_price_changes,
        items_with_increases,
        items_with_decreases,
        items_without_history,
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
        'COST ALERT: Over the past month, ', items_with_increases, ' items increased in price ',
        'while ', items_with_decreases, ' items decreased. ',
        'Net price changes could cost an additional $', ROUND(projected_annual_increase::numeric, 2),
        ' annually if ordering frequency remains at ', ROUND(order_frequency_days::numeric, 0), ' days between orders. ',
        'Average annualized inflation rate: ', ROUND(avg_inflation_rate::numeric, 1), '%.'
    )

            WHEN items_with_history = 0 THEN 
                'No historical pricing data available for comparison (all items are new within 30 days).'
            ELSE 
                'No significant price changes detected in the past month.'
        END as customer_warning,
        NULL::text as item_id,
        NULL::integer as distributor_id_col,
        NULL::numeric as current_price,
        NULL::numeric as comparison_price,
        NULL::integer as quantity,
        NULL::numeric as percent_change,
        NULL::numeric as item_annualized_inflation_rate,
        NULL::text as price_change_status,
        NULL::integer as days_between,
        0 as sort_order
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
        NULL::bigint as items_with_increases,
        NULL::bigint as items_with_decreases,
        NULL::bigint as items_without_history,
        NULL::bigint as total_items,
        NULL::numeric as avg_days_between_orders,
        NULL::numeric as projected_annual_cost_increase,
        NULL::text as impact_level,
        NULL::text as customer_warning,
        item_id,
        distributor_id as distributor_id_col,
        ROUND(current_price::numeric, 2) as current_price,
        ROUND(comparison_price::numeric, 2) as comparison_price,
        quantity,
        ROUND(percent_change::numeric, 2) as percent_change,
        ROUND(annualized_inflation_rate::numeric, 2) as item_annualized_inflation_rate,
        price_change_status,
        days_between,
        CASE price_change_status 
             WHEN 'INCREASED' THEN 1 
             WHEN 'DECREASED' THEN 2 
             WHEN 'NO_CHANGE' THEN 3 
             WHEN 'NO_HISTORICAL_DATA' THEN 4 
             ELSE 5
        END as sort_order
    FROM price_analysis
)

SELECT 
    result_type,
    current_order_value,
    total_price_increase,
    avg_annualized_inflation_rate,
    items_with_history,
    items_with_price_changes,
    items_with_increases,
    items_with_decreases,
    items_without_history,
    total_items,
    avg_days_between_orders,
    projected_annual_cost_increase,
    impact_level,
    customer_warning,
    item_id,
    distributor_id_col as distributor_id,
    current_price,
    comparison_price,
    quantity,
    percent_change,
    item_annualized_inflation_rate,
    price_change_status,
    days_between
FROM combined_results
ORDER BY 
    result_type DESC,
    sort_order,
    ABS(COALESCE(percent_change, 0)) DESC;