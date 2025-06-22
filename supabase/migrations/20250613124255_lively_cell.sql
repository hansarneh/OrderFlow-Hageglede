/*
  # Create order_lines table for normalized order line items

  1. New Tables
    - `order_lines`
      - `id` (uuid, primary key)
      - `order_id` (uuid, references customer_orders)
      - `woocommerce_line_item_id` (integer) - WooCommerce line item ID
      - `product_id` (integer) - WooCommerce product ID
      - `product_name` (text) - Product name at time of order
      - `sku` (text) - Product SKU
      - `quantity` (integer) - Quantity ordered
      - `unit_price` (numeric) - Price per unit
      - `total_price` (numeric) - Total line price
      - `tax_amount` (numeric) - Tax amount for this line
      - `meta_data` (jsonb) - Additional line item metadata
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Indexes
    - Index on order_id for fast order lookups
    - Index on product_id for product analysis
    - Index on sku for product searches

  3. Security
    - Enable RLS on `order_lines` table
    - Allow authenticated users to read order lines
    - Only allow system (service role) to write order lines

  4. Data Migration
    - Extract existing line_items from customer_orders JSONB
    - Create normalized order_lines records
    - Keep JSONB for backward compatibility
*/

-- Create order_lines table
CREATE TABLE IF NOT EXISTS order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
  woocommerce_line_item_id integer,
  product_id integer,
  product_name text NOT NULL,
  sku text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  meta_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS order_lines_order_id_idx ON order_lines(order_id);
CREATE INDEX IF NOT EXISTS order_lines_product_id_idx ON order_lines(product_id);
CREATE INDEX IF NOT EXISTS order_lines_sku_idx ON order_lines(sku);
CREATE INDEX IF NOT EXISTS order_lines_woocommerce_line_item_id_idx ON order_lines(woocommerce_line_item_id);

-- Enable Row Level Security
ALTER TABLE order_lines ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read order lines
CREATE POLICY "Authenticated users can view order lines"
  ON order_lines
  FOR SELECT
  TO authenticated
  USING (true);

-- Only allow service role to insert/update/delete order lines
CREATE POLICY "Service role can manage order lines"
  ON order_lines
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create trigger to update updated_at column
CREATE TRIGGER update_order_lines_updated_at
  BEFORE UPDATE ON order_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Migrate existing line_items from customer_orders to order_lines table
DO $$
DECLARE
  order_record RECORD;
  line_item JSONB;
  line_item_record RECORD;
BEGIN
  -- Loop through all customer orders
  FOR order_record IN 
    SELECT id, line_items 
    FROM customer_orders 
    WHERE line_items IS NOT NULL AND jsonb_array_length(line_items) > 0
  LOOP
    -- Loop through each line item in the order
    FOR line_item IN 
      SELECT * FROM jsonb_array_elements(order_record.line_items)
    LOOP
      -- Insert normalized order line
      INSERT INTO order_lines (
        order_id,
        woocommerce_line_item_id,
        product_id,
        product_name,
        sku,
        quantity,
        unit_price,
        total_price,
        tax_amount,
        meta_data
      ) VALUES (
        order_record.id,
        (line_item->>'id')::integer,
        (line_item->>'product_id')::integer,
        line_item->>'name',
        line_item->>'sku',
        COALESCE((line_item->>'quantity')::integer, 1),
        COALESCE((line_item->>'price')::numeric, 0),
        COALESCE((line_item->>'total')::numeric, 0),
        COALESCE((line_item->>'tax_amount')::numeric, 0),
        COALESCE(line_item->'meta_data', '{}'::jsonb)
      );
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Successfully migrated line items to order_lines table';
END $$;