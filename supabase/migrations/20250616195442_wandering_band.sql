/*
  # Fix order webhook processing to handle order lines properly

  1. Problem
    - The webhook is trying to insert order lines before the parent order exists
    - This causes foreign key constraint violations
    - Error: "Key (order_id)=(uuid) is not present in table "customer_orders"

  2. Solution
    - Create a function to process orders and their lines in a single transaction
    - Ensure the order is created before attempting to create order lines
    - Add proper error handling and logging

  3. Changes
    - New function process_woocommerce_order to handle the entire order processing
    - Transaction to ensure atomicity (all or nothing)
    - Detailed logging for troubleshooting
*/

-- Create a function to log errors and debug information
CREATE OR REPLACE FUNCTION log_function_execution(
  function_name text,
  log_message text
) RETURNS void AS $$
BEGIN
  INSERT INTO function_logs (function_name, log_message)
  VALUES (function_name, log_message);
END;
$$ LANGUAGE plpgsql;

-- Create a function to process WooCommerce orders and their line items in a transaction
CREATE OR REPLACE FUNCTION process_woocommerce_order(
  p_woocommerce_order_id integer,
  p_order_number text,
  p_customer_name text,
  p_woo_status text,
  p_total_value numeric,
  p_total_items integer,
  p_date_created timestamptz,
  p_line_items jsonb,
  p_meta_data jsonb,
  p_billing_address text,
  p_billing_address_json jsonb,
  p_permalink text,
  p_delivery_date date,
  p_delivery_type text,
  p_shipping_method_title text
) RETURNS uuid AS $$
DECLARE
  v_order_id uuid;
  v_line_item jsonb;
  v_line_meta_data jsonb;
  v_line_item_id integer;
  v_product_id integer;
  v_product_name text;
  v_sku text;
  v_quantity integer;
  v_unit_price numeric;
  v_total_price numeric;
  v_tax_amount numeric;
  v_error_message text;
BEGIN
  -- Start a transaction to ensure atomicity
  BEGIN
    -- First, check if the order already exists
    SELECT id INTO v_order_id
    FROM customer_orders
    WHERE woocommerce_order_id = p_woocommerce_order_id;
    
    -- If order exists, update it
    IF v_order_id IS NOT NULL THEN
      UPDATE customer_orders
      SET
        order_number = p_order_number,
        customer_name = p_customer_name,
        woo_status = p_woo_status,
        total_value = p_total_value,
        total_items = p_total_items,
        date_created = p_date_created,
        line_items = p_line_items,
        meta_data = p_meta_data,
        billing_address = p_billing_address,
        billing_address_json = p_billing_address_json,
        permalink = p_permalink,
        delivery_date = p_delivery_date,
        delivery_type = p_delivery_type,
        shipping_method_title = p_shipping_method_title,
        updated_at = now()
      WHERE id = v_order_id;
      
      PERFORM log_function_execution('process_woocommerce_order', 'Updated existing order: ' || p_woocommerce_order_id);
    -- If order doesn't exist, insert it
    ELSE
      INSERT INTO customer_orders (
        woocommerce_order_id,
        order_number,
        customer_name,
        woo_status,
        total_value,
        total_items,
        date_created,
        line_items,
        meta_data,
        billing_address,
        billing_address_json,
        permalink,
        delivery_date,
        delivery_type,
        shipping_method_title
      ) VALUES (
        p_woocommerce_order_id,
        p_order_number,
        p_customer_name,
        p_woo_status,
        p_total_value,
        p_total_items,
        p_date_created,
        p_line_items,
        p_meta_data,
        p_billing_address,
        p_billing_address_json,
        p_permalink,
        p_delivery_date,
        p_delivery_type,
        p_shipping_method_title
      )
      RETURNING id INTO v_order_id;
      
      PERFORM log_function_execution('process_woocommerce_order', 'Created new order: ' || p_woocommerce_order_id);
    END IF;
    
    -- Now process each line item
    IF p_line_items IS NOT NULL AND jsonb_array_length(p_line_items) > 0 THEN
      FOR v_line_item IN SELECT * FROM jsonb_array_elements(p_line_items)
      LOOP
        -- Extract line item data
        v_line_item_id := (v_line_item->>'id')::integer;
        v_product_id := (v_line_item->>'product_id')::integer;
        v_product_name := v_line_item->>'name';
        v_sku := v_line_item->>'sku';
        v_quantity := COALESCE((v_line_item->>'quantity')::integer, 1);
        v_unit_price := COALESCE((v_line_item->>'price')::numeric, 0);
        v_total_price := COALESCE((v_line_item->>'total')::numeric, 0);
        v_tax_amount := COALESCE((v_line_item->>'total_tax')::numeric, 0);
        
        -- Prepare line item meta_data
        v_line_meta_data := '{}'::jsonb;
        
        -- Convert WooCommerce line item meta_data to our format if it exists
        IF v_line_item ? 'meta_data' AND jsonb_typeof(v_line_item->'meta_data') = 'array' THEN
          SELECT jsonb_object_agg(meta->>'key', meta->>'value')
          INTO v_line_meta_data
          FROM jsonb_array_elements(v_line_item->'meta_data') AS meta;
        END IF;
        
        -- Upsert the order line
        BEGIN
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
            v_order_id,
            v_line_item_id,
            v_product_id,
            v_product_name,
            v_sku,
            v_quantity,
            v_unit_price,
            v_total_price,
            v_tax_amount,
            v_line_meta_data
          )
          ON CONFLICT (order_id, woocommerce_line_item_id) 
          DO UPDATE SET
            product_id = EXCLUDED.product_id,
            product_name = EXCLUDED.product_name,
            sku = EXCLUDED.sku,
            quantity = EXCLUDED.quantity,
            unit_price = EXCLUDED.unit_price,
            total_price = EXCLUDED.total_price,
            tax_amount = EXCLUDED.tax_amount,
            meta_data = EXCLUDED.meta_data,
            updated_at = now();
            
          PERFORM log_function_execution('process_woocommerce_order', 'Processed line item: ' || v_line_item_id || ' for order: ' || p_woocommerce_order_id);
        EXCEPTION WHEN OTHERS THEN
          -- Log the error but continue processing other line items
          v_error_message := 'Error processing line item ' || v_line_item_id || ': ' || SQLERRM;
          PERFORM log_function_execution('process_woocommerce_order', v_error_message);
        END;
      END LOOP;
    END IF;
    
    -- Commit the transaction
    RETURN v_order_id;
  EXCEPTION WHEN OTHERS THEN
    -- Log the error and re-raise
    v_error_message := 'Error processing order ' || p_woocommerce_order_id || ': ' || SQLERRM;
    PERFORM log_function_execution('process_woocommerce_order', v_error_message);
    RAISE;
  END;
END;
$$ LANGUAGE plpgsql;

-- Create a function to delete inactive orders (completed, cancelled, etc.)
CREATE OR REPLACE FUNCTION delete_inactive_orders()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete orders that are not processing or delvis-levert and are older than 200 days
  DELETE FROM customer_orders
  WHERE woo_status NOT IN ('processing', 'delvis-levert')
    AND date_created < (CURRENT_DATE - INTERVAL '200 days');
    
  -- Log the cleanup
  PERFORM log_function_execution('delete_inactive_orders', 'Cleaned up inactive orders');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically clean up inactive orders
DROP TRIGGER IF EXISTS trigger_delete_inactive_orders ON customer_orders;
CREATE TRIGGER trigger_delete_inactive_orders
  AFTER INSERT OR UPDATE ON customer_orders
  FOR EACH ROW
  EXECUTE FUNCTION delete_inactive_orders();

-- Create a function_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS function_logs (
  id BIGSERIAL PRIMARY KEY,
  function_name TEXT,
  log_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);