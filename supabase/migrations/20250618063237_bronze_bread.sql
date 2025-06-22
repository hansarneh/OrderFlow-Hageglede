/*
  # Add supplier_number column to purchase_orders table

  1. Problem
    - The purchase_orders table is missing a supplier_number column
    - This field is provided by the Rackbeat API but not stored in our database
    - Without this column, the PurchaseOrdersTab component can't properly display supplier information

  2. Solution
    - Add a supplier_number column to the purchase_orders table
    - Make it a text field to match the data type from the API
    - Add an index for better query performance

  3. Impact
    - Enables proper storage of supplier number from Rackbeat API
    - Improves data completeness for purchase orders
    - Supports the PurchaseOrdersTab component's display requirements
*/

-- Add supplier_number column to purchase_orders table
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS supplier_number text;

-- Create an index for better query performance
CREATE INDEX IF NOT EXISTS purchase_orders_supplier_number_idx ON purchase_orders(supplier_number);

-- Add total_value column if it doesn't exist (needed for priority calculation)
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS total_value numeric;

-- Log the change
INSERT INTO function_logs (function_name, log_message)
VALUES (
  'migration',
  'Added supplier_number and total_value columns to purchase_orders table to store Rackbeat API data'
);