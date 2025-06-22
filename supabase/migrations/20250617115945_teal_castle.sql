/*
  # Add unique constraint to purchase_orders table

  1. Changes
    - Add a unique constraint on the po_number column in purchase_orders table
    - This will prevent duplicate purchase orders from being created
    - The Edge Function will now be able to upsert based on po_number

  2. Problem Solved
    - Currently, the system generates new IDs for each purchase order sync
    - This causes duplicate records when the same order is synced multiple times
    - With this constraint, upserts will update existing records instead of creating duplicates

  3. Impact
    - More reliable purchase order data
    - Prevents data duplication
    - Enables proper upsert operations in the Edge Function
*/

-- Add unique constraint to po_number column
ALTER TABLE purchase_orders
ADD CONSTRAINT purchase_orders_po_number_key UNIQUE (po_number);

-- Create an index to improve lookup performance (if not already created by the constraint)
CREATE INDEX IF NOT EXISTS purchase_orders_po_number_idx ON purchase_orders(po_number);

-- Log the change
INSERT INTO function_logs (function_name, log_message)
VALUES (
  'migration',
  'Added unique constraint on po_number column in purchase_orders table to prevent duplicate records'
);