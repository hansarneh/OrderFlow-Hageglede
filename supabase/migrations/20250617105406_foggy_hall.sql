/*
  # Create purchase_orders and purchase_order_lines tables

  1. New Tables
    - `purchase_orders`
      - `id` (bigint, primary key) - Rackbeat purchase order ID
      - `po_number` (text) - Purchase order number
      - `po_status` (text) - Status of the purchase order
      - `supplier` (text) - Supplier name
      - `currency` (text) - Currency code
      - `eta` (timestamptz) - Expected delivery date
      - `order_date` (timestamptz) - When the order was created
    
    - `purchase_order_lines`
      - `id` (bigint, primary key) - Line item ID
      - `purchase_order_id` (bigint, references purchase_orders) - Parent purchase order
      - `product_number` (text) - Product number/SKU
      - `product_name` (text) - Product name
      - `qty` (integer) - Quantity ordered
      - `unit_price` (numeric) - Price per unit
      - `total_price` (numeric) - Total line price

  2. Indexes
    - Index on purchase_order_id for fast lookups

  3. Foreign Keys
    - purchase_order_lines.purchase_order_id references purchase_orders.id
*/

-- Create purchase_orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
  id bigint PRIMARY KEY,
  po_number text NOT NULL,
  po_status text NOT NULL,
  supplier text NOT NULL,
  currency text NOT NULL,
  eta timestamptz,
  order_date timestamptz
);

-- Create purchase_order_lines table
CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id bigint PRIMARY KEY,
  purchase_order_id bigint REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_number text NOT NULL,
  product_name text NOT NULL,
  qty integer NOT NULL,
  unit_price numeric NOT NULL,
  total_price numeric NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_purchase_order_id ON purchase_order_lines(purchase_order_id);