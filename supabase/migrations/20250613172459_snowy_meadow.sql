/*
  # Add unique constraint to order_lines table

  1. Problem
    - The sync-woocommerce-orders Edge Function is failing with error:
      "there is no unique or exclusion constraint matching the ON CONFLICT specification"
    - This happens because the upsert operation tries to use (order_id, woocommerce_line_item_id) 
      as conflict target but no unique constraint exists for this combination

  2. Solution
    - Add a unique constraint on (order_id, woocommerce_line_item_id) columns
    - This will allow the upsert operation to work correctly when syncing order lines
    - Handle potential duplicate data by removing duplicates before adding constraint

  3. Data Safety
    - Check for existing duplicates and handle them before adding constraint
    - Keep the most recent record if duplicates exist
*/

-- First, identify and remove any duplicate records that would violate the unique constraint
-- Keep only the most recent record for each (order_id, woocommerce_line_item_id) combination
WITH duplicates AS (
  SELECT 
    id,
    order_id,
    woocommerce_line_item_id,
    ROW_NUMBER() OVER (
      PARTITION BY order_id, woocommerce_line_item_id 
      ORDER BY updated_at DESC, created_at DESC
    ) as rn
  FROM order_lines
  WHERE woocommerce_line_item_id IS NOT NULL
)
DELETE FROM order_lines 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Add unique constraint on (order_id, woocommerce_line_item_id)
-- This allows the upsert operation in sync-woocommerce-orders to work correctly
ALTER TABLE order_lines 
ADD CONSTRAINT order_lines_order_woo_line_item_unique 
UNIQUE (order_id, woocommerce_line_item_id);

-- Create an index to improve performance for the unique constraint
-- (This is automatically created by the unique constraint, but we're being explicit)
-- The index will help with faster lookups during upsert operations
CREATE INDEX IF NOT EXISTS order_lines_order_woo_line_item_idx 
ON order_lines (order_id, woocommerce_line_item_id);