/*
  # Create customer_orders table for storing WooCommerce order data

  1. New Tables
    - `customer_orders`
      - `id` (uuid, primary key)
      - `woocommerce_order_id` (integer, unique) - WooCommerce order ID
      - `order_number` (text) - Order number from WooCommerce
      - `customer_name` (text) - Customer name
      - `woo_status` (text) - WooCommerce order status
      - `total_value` (numeric) - Total order value
      - `total_items` (integer) - Total number of items
      - `date_created` (timestamptz) - When order was created in WooCommerce
      - `line_items` (jsonb) - Order line items with product details
      - `meta_data` (jsonb) - Additional order metadata (delivery dates, etc.)
      - `billing_address` (jsonb) - Customer billing address
      - `permalink` (text) - Link to order in WooCommerce admin
      - `created_at` (timestamptz) - When record was created in our DB
      - `updated_at` (timestamptz) - When record was last updated

  2. Indexes
    - Index on woocommerce_order_id for fast lookups
    - Index on woo_status for filtering orders
    - Index on date_created for date-based queries

  3. Security
    - Enable RLS on `customer_orders` table
    - Allow authenticated users to read order data
    - Only allow system (service role) to write order data
*/

-- Create customer_orders table
CREATE TABLE IF NOT EXISTS customer_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  woocommerce_order_id integer UNIQUE NOT NULL,
  order_number text NOT NULL,
  customer_name text NOT NULL,
  woo_status text NOT NULL,
  total_value numeric NOT NULL DEFAULT 0,
  total_items integer NOT NULL DEFAULT 0,
  date_created timestamptz NOT NULL,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  meta_data jsonb DEFAULT '{}'::jsonb,
  billing_address jsonb DEFAULT '{}'::jsonb,
  permalink text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS customer_orders_woocommerce_order_id_idx ON customer_orders(woocommerce_order_id);
CREATE INDEX IF NOT EXISTS customer_orders_woo_status_idx ON customer_orders(woo_status);
CREATE INDEX IF NOT EXISTS customer_orders_date_created_idx ON customer_orders(date_created);
CREATE INDEX IF NOT EXISTS customer_orders_line_items_idx ON customer_orders USING gin(line_items);

-- Enable Row Level Security
ALTER TABLE customer_orders ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read order data
CREATE POLICY "Authenticated users can view customer orders"
  ON customer_orders
  FOR SELECT
  TO authenticated
  USING (true);

-- Only allow service role to insert/update/delete orders (for sync functions)
CREATE POLICY "Service role can manage customer orders"
  ON customer_orders
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create trigger to update updated_at column
CREATE TRIGGER update_customer_orders_updated_at
  BEFORE UPDATE ON customer_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();