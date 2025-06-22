/*
  # Add delivery tracking fields to order_lines table

  1. New Columns
    - `delivered_quantity` (integer) - How many units have been delivered
    - `delivery_date` (date) - When the delivered units were delivered
    - `delivery_status` (text) - Status: 'pending', 'partial', 'delivered', 'cancelled'
    - `partial_delivery_details` (jsonb) - Store the raw partial_delivery_item_details from WooCommerce

  2. Functions
    - Function to parse partial_delivery_item_details and update delivery fields
    - Function to calculate delivery status based on quantities

  3. Indexes
    - Index on delivery_status for filtering
    - Index on delivery_date for date-based queries
*/

-- Add delivery tracking columns to order_lines table
ALTER TABLE order_lines ADD COLUMN IF NOT EXISTS delivered_quantity integer DEFAULT 0;
ALTER TABLE order_lines ADD COLUMN IF NOT EXISTS delivery_date date;
ALTER TABLE order_lines ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'partial', 'delivered', 'cancelled'));
ALTER TABLE order_lines ADD COLUMN IF NOT EXISTS partial_delivery_details jsonb DEFAULT '[]'::jsonb;

-- Create indexes for delivery tracking
CREATE INDEX IF NOT EXISTS order_lines_delivery_status_idx ON order_lines(delivery_status);
CREATE INDEX IF NOT EXISTS order_lines_delivery_date_idx ON order_lines(delivery_date);

-- Function to parse partial delivery details and update delivery fields
CREATE OR REPLACE FUNCTION parse_partial_delivery_details(line_id uuid, meta_data_input jsonb)
RETURNS void AS $$
DECLARE
  delivery_details jsonb;
  delivery_string text;
  delivery_parts text[];
  delivered_qty integer;
  delivery_dt date;
  current_quantity integer;
  new_status text;
BEGIN
  -- Extract partial_delivery_item_details from meta_data
  delivery_details := meta_data_input->'partial_delivery_item_details';
  
  -- If no delivery details found, set status to pending
  IF delivery_details IS NULL OR jsonb_array_length(delivery_details) = 0 THEN
    UPDATE order_lines 
    SET 
      delivered_quantity = 0,
      delivery_date = NULL,
      delivery_status = 'pending',
      partial_delivery_details = '[]'::jsonb
    WHERE id = line_id;
    RETURN;
  END IF;
  
  -- Get the first delivery detail string (format: ["_, 3,000, 13.06.2025"])
  delivery_string := delivery_details->>0;
  
  -- Parse the delivery string
  IF delivery_string IS NOT NULL AND delivery_string != '' THEN
    -- Split by comma and trim spaces
    delivery_parts := string_to_array(delivery_string, ',');
    
    IF array_length(delivery_parts, 1) >= 3 THEN
      -- Extract delivered quantity (second part, remove any spaces and convert)
      BEGIN
        delivered_qty := COALESCE(trim(delivery_parts[2])::integer, 0);
      EXCEPTION WHEN OTHERS THEN
        delivered_qty := 0;
      END;
      
      -- Extract delivery date (third part, convert DD.MM.YYYY to date)
      BEGIN
        delivery_dt := to_date(trim(delivery_parts[3]), 'DD.MM.YYYY');
      EXCEPTION WHEN OTHERS THEN
        delivery_dt := NULL;
      END;
      
      -- Get current order quantity to determine status
      SELECT quantity INTO current_quantity FROM order_lines WHERE id = line_id;
      
      -- Determine delivery status
      IF delivered_qty = 0 THEN
        new_status := 'pending';
      ELSIF delivered_qty >= current_quantity THEN
        new_status := 'delivered';
      ELSE
        new_status := 'partial';
      END IF;
      
      -- Update the order line with parsed delivery information
      UPDATE order_lines 
      SET 
        delivered_quantity = delivered_qty,
        delivery_date = delivery_dt,
        delivery_status = new_status,
        partial_delivery_details = delivery_details
      WHERE id = line_id;
      
    ELSE
      -- Invalid format, set to pending
      UPDATE order_lines 
      SET 
        delivered_quantity = 0,
        delivery_date = NULL,
        delivery_status = 'pending',
        partial_delivery_details = delivery_details
      WHERE id = line_id;
    END IF;
  ELSE
    -- Empty delivery string, set to pending
    UPDATE order_lines 
    SET 
      delivered_quantity = 0,
      delivery_date = NULL,
      delivery_status = 'pending',
      partial_delivery_details = delivery_details
    WHERE id = line_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to update delivery status for an entire order
CREATE OR REPLACE FUNCTION update_order_delivery_status(order_uuid uuid)
RETURNS text AS $$
DECLARE
  total_lines integer;
  delivered_lines integer;
  partial_lines integer;
  pending_lines integer;
  order_status text;
BEGIN
  -- Count line statuses for this order
  SELECT 
    COUNT(*),
    COUNT(CASE WHEN delivery_status = 'delivered' THEN 1 END),
    COUNT(CASE WHEN delivery_status = 'partial' THEN 1 END),
    COUNT(CASE WHEN delivery_status = 'pending' THEN 1 END)
  INTO total_lines, delivered_lines, partial_lines, pending_lines
  FROM order_lines 
  WHERE order_id = order_uuid;
  
  -- Determine overall order delivery status
  IF delivered_lines = total_lines THEN
    order_status := 'fully_delivered';
  ELSIF delivered_lines > 0 OR partial_lines > 0 THEN
    order_status := 'partially_delivered';
  ELSE
    order_status := 'pending_delivery';
  END IF;
  
  RETURN order_status;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to automatically parse delivery details when meta_data is updated
CREATE OR REPLACE FUNCTION trigger_parse_delivery_details()
RETURNS trigger AS $$
BEGIN
  -- Parse delivery details whenever meta_data is updated
  PERFORM parse_partial_delivery_details(NEW.id, NEW.meta_data);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically parse delivery details
DROP TRIGGER IF EXISTS parse_delivery_details_trigger ON order_lines;
CREATE TRIGGER parse_delivery_details_trigger
  AFTER INSERT OR UPDATE OF meta_data ON order_lines
  FOR EACH ROW
  EXECUTE FUNCTION trigger_parse_delivery_details();

-- Update existing order lines with sample delivery data
UPDATE order_lines 
SET meta_data = jsonb_set(
  COALESCE(meta_data, '{}'::jsonb),
  '{partial_delivery_item_details}',
  '["_, 5, 18.12.2024"]'::jsonb
)
WHERE product_name = 'Professional Wireless Headphones';

UPDATE order_lines 
SET meta_data = jsonb_set(
  COALESCE(meta_data, '{}'::jsonb),
  '{partial_delivery_item_details}',
  '["_, 0, "]'::jsonb
)
WHERE product_name = 'Bluetooth Conference Speaker';

UPDATE order_lines 
SET meta_data = jsonb_set(
  COALESCE(meta_data, '{}'::jsonb),
  '{partial_delivery_item_details}',
  '["_, 2, 10.01.2025"]'::jsonb
)
WHERE product_name = '4K Webcam Pro';

UPDATE order_lines 
SET meta_data = jsonb_set(
  COALESCE(meta_data, '{}'::jsonb),
  '{partial_delivery_item_details}',
  '["_, 4, 18.12.2024"]'::jsonb
)
WHERE product_name = 'Professional Monitor 32 inch';