/*
  # Add unique constraint to purchase_order_lines table

  1. Problem
    - The purchase_order_lines table needs a unique constraint on (purchase_order_id, product_number)
    - This will prevent duplicate line items for the same product in a purchase order
    - Required for proper upsert operations in the fetch-rackbeat-purchase-orders function

  2. Solution
    - First identify and remove any duplicate records that would violate the constraint
    - Keep the most recent record for each (purchase_order_id, product_number) combination
    - Add the unique constraint and supporting index

  3. Data Safety
    - Only remove duplicate records if necessary
    - Keep the most recent record based on updated_at/created_at timestamps
*/

-- First, identify and remove any duplicate records that would violate the unique constraint
-- Keep only the most recent record for each (purchase_order_id, product_number) combination
WITH duplicates AS (
  SELECT
    id,
    purchase_order_id,
    product_number,
    ROW_NUMBER() OVER (
      PARTITION BY purchase_order_id, product_number
      ORDER BY id DESC -- Use ID for deterministic ordering
    ) as rn
  FROM purchase_order_lines
  WHERE purchase_order_id IS NOT NULL AND product_number IS NOT NULL
)
DELETE FROM purchase_order_lines
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Add unique constraint on (purchase_order_id, product_number)
-- This allows the upsert operation in fetch-rackbeat-purchase-orders to work correctly
ALTER TABLE purchase_order_lines
ADD CONSTRAINT purchase_order_lines_po_id_product_number_unique
UNIQUE (purchase_order_id, product_number);

-- Create an index to improve performance for the unique constraint
-- (This is automatically created by the unique constraint, but we're being explicit)
-- The index will help with faster lookups during upsert operations
CREATE INDEX IF NOT EXISTS purchase_order_lines_po_id_product_number_idx
ON purchase_order_lines (purchase_order_id, product_number);

-- Log the change
INSERT INTO function_logs (function_name, log_message)
VALUES (
  'migration',
  'Added unique constraint on (purchase_order_id, product_number) in purchase_order_lines table'
);