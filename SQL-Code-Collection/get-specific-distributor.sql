  WITH product_price_history AS (
      SELECT
          dp.id as distributor_product_id,
          dp.item_id,
          dp.item_description,
          d.name as distributor_name,
          ii.unit_price_cents / 100.0 as unit_price_dollars,
          ii.invoice_scan_id,
          i.invoice_date,
          ROW_NUMBER() OVER (PARTITION BY dp.id ORDER BY i.invoice_date ASC) as
  earliest_rank,
          ROW_NUMBER() OVER (PARTITION BY dp.id ORDER BY i.invoice_date DESC) as
  latest_rank,
          ROW_NUMBER() OVER (PARTITION BY dp.id ORDER BY i.invoice_date DESC) as
  reverse_rank,
          COUNT(*) OVER (PARTITION BY dp.id) as transaction_count
      FROM invoice_items ii
      JOIN invoice_scans ins ON ii.invoice_scan_id = ins.id
      JOIN invoices i ON ins.invoice_uuid = i.uuid
      JOIN distributor_products dp ON ii.distributor_product_id = dp.id
      JOIN distributors d ON dp.distributor_id = d.id
      WHERE i.restaurant_id = X --Modify this for relevant user id
        AND d.id = X -- Modify this for relevant distributor id.
  ),
  price_changes AS (
      SELECT
          earliest.distributor_product_id,
          earliest.item_id,
          earliest.item_description,
          earliest.distributor_name,
          earliest.unit_price_dollars as earliest_price,
          earliest.invoice_date as earliest_date,
          earliest.invoice_scan_id as earliest_scan_id,
          latest.unit_price_dollars as latest_price,
          latest.invoice_date as latest_date,
          latest.invoice_scan_id as latest_scan_id,
          second_recent.unit_price_dollars as second_recent_price,
          second_recent.invoice_date as second_recent_date,
          second_recent.invoice_scan_id as second_recent_scan_id,
          earliest.transaction_count,
          (latest.unit_price_dollars - earliest.unit_price_dollars) as
  price_change_dollars,
          CASE
              WHEN earliest.unit_price_dollars > 0 THEN
                  ((latest.unit_price_dollars - earliest.unit_price_dollars) /
  earliest.unit_price_dollars) * 100
              ELSE 0
          END as percentage_change
      FROM
          (SELECT * FROM product_price_history WHERE earliest_rank = 1) earliest
      JOIN
          (SELECT * FROM product_price_history WHERE latest_rank = 1) latest
      ON earliest.distributor_product_id = latest.distributor_product_id
      LEFT JOIN
          (SELECT * FROM product_price_history WHERE reverse_rank = 2)
  second_recent
      ON earliest.distributor_product_id = second_recent.distributor_product_id
      WHERE earliest.transaction_count > 1
  )
  SELECT
      ROW_NUMBER() OVER (ORDER BY percentage_change DESC) as rank,
      item_id,
      distributor_product_id,
      item_description,
      distributor_name,
      earliest_price,
      latest_price,
      second_recent_price,
      price_change_dollars,
      ROUND(percentage_change, 2) as percentage_change,
      earliest_date,
      latest_date,
      second_recent_date,
      transaction_count,
      earliest_scan_id,
      latest_scan_id,
      second_recent_scan_id,
      CONCAT(earliest_date, ' to ', latest_date) as period
  FROM price_changes
  WHERE percentage_change > 0
  ORDER BY percentage_change DESC
  LIMIT 20;