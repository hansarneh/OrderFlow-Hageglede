/*
  # Add shipping_method_title column to customer_orders table

  1. Changes
    - Add `shipping_method_title` column to customer_orders table
    - Extract shipping method title from meta_data JSON column
    - Handle both array and object formats of meta_data
    - Create index for better query performance

  2. Data Migration
    - Extract value from meta_data where key is "_shipping_method_title"
    - Handle cases where meta_data is an array of objects
    - Handle cases where meta_data is a direct object
*/

-- Add shipping_method_title column to customer_orders table
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS shipping_method_title text;

-- Populate shipping_method_title column from meta_data
-- Extract the value where the key is "_shipping_method_title"
UPDATE customer_orders
SET shipping_method_title = (
  SELECT elem->>'value'
  FROM jsonb_array_elements(meta_data) AS elem
  WHERE elem->>'key' = '_shipping_method_title'
  LIMIT 1
)
WHERE meta_data IS NOT NULL
  AND jsonb_typeof(meta_data) = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(meta_data) AS elem
    WHERE elem->>'key' = '_shipping_method_title'
  );

-- Also handle cases where meta_data is an object (not array)
UPDATE customer_orders
SET shipping_method_title = meta_data->>'_shipping_method_title'
WHERE meta_data IS NOT NULL
  AND jsonb_typeof(meta_data) = 'object'
  AND meta_data ? '_shipping_method_title'
  AND shipping_method_title IS NULL;

-- Create index on shipping_method_title for better query performance
CREATE INDEX IF NOT EXISTS customer_orders_shipping_method_title_idx ON customer_orders(shipping_method_title);