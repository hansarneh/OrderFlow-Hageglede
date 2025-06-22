/*
  # Create products table for webhook data storage

  1. New Tables
    - `products`
      - `id` (uuid, primary key)
      - `woocommerce_id` (integer, unique) - WooCommerce product ID
      - `name` (text) - Product name
      - `sku` (text) - Product SKU
      - `stock_quantity` (integer) - Current stock quantity
      - `stock_status` (text) - Stock status from WooCommerce
      - `manage_stock` (boolean) - Whether stock is managed
      - `price` (text) - Current price
      - `regular_price` (text) - Regular price
      - `sale_price` (text) - Sale price
      - `permalink` (text) - Product URL
      - `product_type` (text) - Product type
      - `status` (text) - Product status
      - `date_created` (timestamptz) - When product was created in WooCommerce
      - `date_modified` (timestamptz) - When product was last modified in WooCommerce
      - `last_webhook_update` (timestamptz) - When we last received webhook update
      - `created_at` (timestamptz) - When record was created in our DB
      - `updated_at` (timestamptz) - When record was last updated in our DB

  2. Indexes
    - Index on woocommerce_id for fast lookups
    - Index on stock_quantity for backordered product queries
    - Index on sku for product searches

  3. Security
    - Enable RLS on `products` table
    - Allow authenticated users to read product data
    - Only allow system (service role) to write product data
*/

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  woocommerce_id integer UNIQUE NOT NULL,
  name text NOT NULL,
  sku text,
  stock_quantity integer DEFAULT 0,
  stock_status text DEFAULT 'instock',
  manage_stock boolean DEFAULT false,
  price text DEFAULT '0',
  regular_price text DEFAULT '0',
  sale_price text DEFAULT '',
  permalink text,
  product_type text DEFAULT 'simple',
  status text DEFAULT 'publish',
  date_created timestamptz,
  date_modified timestamptz,
  last_webhook_update timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS products_woocommerce_id_idx ON products(woocommerce_id);
CREATE INDEX IF NOT EXISTS products_stock_quantity_idx ON products(stock_quantity);
CREATE INDEX IF NOT EXISTS products_sku_idx ON products(sku);
CREATE INDEX IF NOT EXISTS products_stock_status_idx ON products(stock_status);
CREATE INDEX IF NOT EXISTS products_last_webhook_update_idx ON products(last_webhook_update);

-- Enable Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read product data
CREATE POLICY "Authenticated users can view products"
  ON products
  FOR SELECT
  TO authenticated
  USING (true);

-- Only allow service role to insert/update/delete products (for webhooks)
CREATE POLICY "Service role can manage products"
  ON products
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create trigger to update updated_at column
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();