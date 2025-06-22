/*
  # Add delivery_date column to customer_orders table

  1. New Column
    - `delivery_date` (date) - Extracted from meta_data where key is "_delivery_date"

  2. Data Migration
    - Extract delivery date from meta_data JSON array
    - Convert DD.MM.YYYY format to proper date type
    - Handle both array and object formats of meta_data

  3. Index
    - Add index for better query performance on delivery_date
*/

-- Add delivery_date column to customer_orders table
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS delivery_date date;

-- Populate delivery_date column from meta_data
-- Extract the value where the key is "_delivery_date" and convert DD.MM.YYYY to date
UPDATE customer_orders
SET delivery_date = (
  SELECT 
    CASE 
      WHEN elem->>'value' ~ '^\d{2}\.\d{2}\.\d{4}$' THEN
        to_date(elem->>'value', 'DD.MM.YYYY')
      ELSE NULL
    END
  FROM jsonb_array_elements(meta_data) AS elem
  WHERE elem->>'key' = '_delivery_date'
    AND elem->>'value' IS NOT NULL
    AND elem->>'value' != ''
  LIMIT 1
)
WHERE meta_data IS NOT NULL
  AND jsonb_typeof(meta_data) = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(meta_data) AS elem
    WHERE elem->>'key' = '_delivery_date'
  );

-- Also handle cases where meta_data is an object (not array)
UPDATE customer_orders
SET delivery_date = (
  CASE 
    WHEN meta_data->>'_delivery_date' ~ '^\d{2}\.\d{2}\.\d{4}$' THEN
      to_date(meta_data->>'_delivery_date', 'DD.MM.YYYY')
    ELSE NULL
  END
)
WHERE meta_data IS NOT NULL
  AND jsonb_typeof(meta_data) = 'object'
  AND meta_data ? '_delivery_date'
  AND meta_data->>'_delivery_date' IS NOT NULL
  AND meta_data->>'_delivery_date' != ''
  AND delivery_date IS NULL;

-- Create index on delivery_date for better query performance
CREATE INDEX IF NOT EXISTS customer_orders_delivery_date_idx ON customer_orders(delivery_date);