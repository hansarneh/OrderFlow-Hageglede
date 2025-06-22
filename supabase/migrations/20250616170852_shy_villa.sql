/*
  # Fix delivery date parsing in order_lines table

  1. Problem
    - The parse_partial_delivery_details function is incorrectly extracting delivery dates
    - This causes "Invalid Date" to appear in the order details modal
    - The function is incorrectly indexing the parts of the delivery string

  2. Solution
    - Update the parse_partial_delivery_details function to correctly extract delivery dates
    - Add better error handling and logging
    - Fix array indexing to properly extract quantity and date
    - Add more detailed parsing for different date formats

  3. Impact
    - Fixes "Invalid Date" display in order details modal
    - Improves reliability of delivery date extraction
    - Maintains backward compatibility with existing data
*/

-- Drop the existing trigger first to avoid conflicts
DROP TRIGGER IF EXISTS parse_delivery_details_trigger ON order_lines;

-- Update the function to correctly parse delivery details
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
  debug_info text;
BEGIN
  -- Extract partial_delivery_item_details from meta_data
  delivery_details := meta_data_input->'partial_delivery_item_details';
  
  -- Debug info
  debug_info := 'Processing line_id: ' || line_id || ', meta_data: ' || meta_data_input::text;
  RAISE NOTICE '%', debug_info;
  
  -- If no delivery details found, set status to pending
  IF delivery_details IS NULL OR jsonb_array_length(delivery_details) = 0 THEN
    UPDATE order_lines 
    SET 
      delivered_quantity = 0,
      delivery_date = NULL,
      delivery_status = 'pending',
      partial_delivery_details = '[]'::jsonb
    WHERE id = line_id;
    RAISE NOTICE 'No delivery details found, setting to pending';
    RETURN;
  END IF;
  
  -- Get the first delivery detail string (format: ["_, 3,000, 13.06.2025"])
  delivery_string := delivery_details->>0;
  RAISE NOTICE 'Raw delivery string: %', delivery_string;
  
  -- Parse the delivery string
  IF delivery_string IS NOT NULL AND delivery_string != '' THEN
    -- Split by comma and trim spaces
    delivery_parts := string_to_array(delivery_string, ',');
    RAISE NOTICE 'Split into % parts: %', array_length(delivery_parts, 1), delivery_parts;
    
    IF array_length(delivery_parts, 1) >= 2 THEN
      -- Extract delivered quantity (second part, remove any spaces and convert)
      -- The quantity is in the second part (index 1)
      BEGIN
        delivered_qty := COALESCE(trim(delivery_parts[2])::integer, 0);
        RAISE NOTICE 'Extracted quantity: %', delivered_qty;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error parsing quantity from %: %', delivery_parts[2], SQLERRM;
        delivered_qty := 0;
      END;
      
      -- Extract delivery date (third part, convert DD.MM.YYYY to date)
      -- The date is in the third part (index 2) if it exists
      IF array_length(delivery_parts, 1) >= 3 THEN
        BEGIN
          -- Try to parse date in DD.MM.YYYY format
          IF trim(delivery_parts[3]) ~ '^\d{2}\.\d{2}\.\d{4}$' THEN
            delivery_dt := to_date(trim(delivery_parts[3]), 'DD.MM.YYYY');
            RAISE NOTICE 'Parsed date from DD.MM.YYYY format: %', delivery_dt;
          -- Try to parse date in YYYY-MM-DD format
          ELSIF trim(delivery_parts[3]) ~ '^\d{4}-\d{2}-\d{2}$' THEN
            delivery_dt := to_date(trim(delivery_parts[3]), 'YYYY-MM-DD');
            RAISE NOTICE 'Parsed date from YYYY-MM-DD format: %', delivery_dt;
          -- Try to parse date in MM/DD/YYYY format
          ELSIF trim(delivery_parts[3]) ~ '^\d{2}/\d{2}/\d{4}$' THEN
            delivery_dt := to_date(trim(delivery_parts[3]), 'MM/DD/YYYY');
            RAISE NOTICE 'Parsed date from MM/DD/YYYY format: %', delivery_dt;
          ELSE
            RAISE NOTICE 'Date format not recognized: %', trim(delivery_parts[3]);
            delivery_dt := NULL;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'Error parsing date from %: %', delivery_parts[3], SQLERRM;
          delivery_dt := NULL;
        END;
      ELSE
        RAISE NOTICE 'No date part found in delivery string';
        delivery_dt := NULL;
      END IF;
      
      -- Get current order quantity to determine status
      SELECT quantity INTO current_quantity FROM order_lines WHERE id = line_id;
      RAISE NOTICE 'Current quantity: %', current_quantity;
      
      -- Determine delivery status
      IF delivered_qty = 0 THEN
        new_status := 'pending';
      ELSIF delivered_qty >= current_quantity THEN
        new_status := 'delivered';
      ELSE
        new_status := 'partial';
      END IF;
      
      RAISE NOTICE 'Setting delivery status to: %', new_status;
      
      -- Update the order line with parsed delivery information
      UPDATE order_lines 
      SET 
        delivered_quantity = delivered_qty,
        delivery_date = delivery_dt,
        delivery_status = new_status,
        partial_delivery_details = delivery_details
      WHERE id = line_id;
      
      RAISE NOTICE 'Updated order line % with delivery date: %, quantity: %, status: %', 
        line_id, delivery_dt, delivered_qty, new_status;
      
    ELSE
      -- Invalid format, set to pending
      RAISE NOTICE 'Invalid delivery string format (not enough parts): %', delivery_string;
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
    RAISE NOTICE 'Empty delivery string';
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

-- Re-create the trigger with the updated function
CREATE TRIGGER parse_delivery_details_trigger
  AFTER INSERT OR UPDATE OF meta_data ON order_lines
  FOR EACH ROW
  EXECUTE FUNCTION trigger_parse_delivery_details();

-- Update all existing order lines to reprocess their delivery details
DO $$
DECLARE
  line_record RECORD;
  updated_count INTEGER := 0;
BEGIN
  FOR line_record IN 
    SELECT id, meta_data 
    FROM order_lines 
    WHERE meta_data IS NOT NULL 
      AND meta_data ? 'partial_delivery_item_details'
  LOOP
    PERFORM parse_partial_delivery_details(line_record.id, line_record.meta_data);
    updated_count := updated_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Reprocessed delivery details for % order lines', updated_count;
END $$;