/*
  # Add delivery_type column to customer_orders table

  1. Changes
    - Add `delivery_type` column to customer_orders table
    - Extract delivery type from meta_data JSON where key is "_delivery_type"
    - Add index for performance on the new column

  2. Data Migration
    - Populate delivery_type from existing meta_data
    - Handle cases where _delivery_type key exists in meta_data
*/

-- Add delivery_type column to customer_orders table
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS delivery_type text;

-- Populate delivery_type column from meta_data
-- Extract the value where the key is "_delivery_type"
UPDATE customer_orders
SET delivery_type = (
  SELECT value::text
  FROM jsonb_array_elements(meta_data) AS elem
  WHERE elem->>'key' = '_delivery_type'
  LIMIT 1
)
WHERE meta_data IS NOT NULL
  AND jsonb_typeof(meta_data) = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(meta_data) AS elem
    WHERE elem->>'key' = '_delivery_type'
  );

-- Also handle cases where meta_data is an object (not array)
UPDATE customer_orders
SET delivery_type = meta_data->>'_delivery_type'
WHERE meta_data IS NOT NULL
  AND jsonb_typeof(meta_data) = 'object'
  AND meta_data ? '_delivery_type'
  AND delivery_type IS NULL;

-- Create index on delivery_type for better query performance
CREATE INDEX IF NOT EXISTS customer_orders_delivery_type_idx ON customer_orders(delivery_type);