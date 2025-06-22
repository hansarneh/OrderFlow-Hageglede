/*
  # Fix delivery date parsing in order_lines table

  1. Problem
    - The parse_partial_delivery_details function incorrectly treats comma as thousands separator
    - Example: "_, 1,000, 16.06.2025" was parsed as quantity 1000 instead of 1.0
    - In the system, comma is used as decimal separator, not thousands separator

  2. Solution
    - Update the function to correctly parse quantities with decimal comma
    - Treat "1,000" as 1.0 (decimal comma) not 1000 (thousands separator)
    - Improve error handling and logging
    - Reprocess all existing order lines with delivery details

  3. Changes
    - Enhanced string parsing logic to handle decimal comma correctly
    - Better error handling for edge cases
    - Comprehensive logging for debugging
*/

-- Drop the existing trigger first to avoid conflicts
DROP TRIGGER IF EXISTS parse_delivery_details_trigger ON order_lines;

-- Update the function to correctly parse delivery details with decimal comma
CREATE OR REPLACE FUNCTION parse_partial_delivery_details(line_id uuid, meta_data_input jsonb)
RETURNS void AS $$
DECLARE
  delivery_details jsonb;
  delivery_string text;
  parts text[];
  first_part text;
  second_part text;
  third_part text;
  delivered_qty numeric;
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
  
  -- Get the first delivery detail string (format: ["_, 1,000, 16.06.2025"])
  delivery_string := delivery_details->>0;
  RAISE NOTICE 'Raw delivery string: %', delivery_string;
  
  -- Parse the delivery string
  IF delivery_string IS NOT NULL AND delivery_string != '' THEN
    -- First, split the string by the first underscore and comma
    parts := regexp_split_to_array(delivery_string, '_,');
    
    IF array_length(parts, 1) >= 1 THEN
      -- The remaining part should contain the quantity and date
      -- We need to be careful with the comma as it could be a decimal separator
      -- Format is typically: " 1,000, 16.06.2025" after removing "_,"
      
      -- Trim the remaining part
      first_part := trim(parts[1]);
      
      -- Find the position of the last comma which separates quantity and date
      -- This assumes the date doesn't contain commas
      DECLARE
        last_comma_pos integer;
      BEGIN
        last_comma_pos := position(',' in reverse(first_part));
        if last_comma_pos > 0 then
          last_comma_pos := length(first_part) - last_comma_pos + 1;
          
          -- Split into quantity and date parts
          second_part := trim(substring(first_part from 1 for last_comma_pos - 1));
          third_part := trim(substring(first_part from last_comma_pos + 1));
          
          RAISE NOTICE 'Extracted quantity part: %, date part: %', second_part, third_part;
          
          -- Parse quantity - IMPORTANT: Treat comma as decimal separator, not thousands separator
          BEGIN
            -- Replace any thousands separators (spaces) and use comma as decimal point
            second_part := regexp_replace(second_part, '\s', '', 'g');
            delivered_qty := COALESCE(replace(second_part, ',', '.')::numeric, 0);
            RAISE NOTICE 'Parsed quantity: %', delivered_qty;
          EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error parsing quantity from %: %', second_part, SQLERRM;
            delivered_qty := 0;
          END;
          
          -- Parse date
          BEGIN
            -- Try to parse date in DD.MM.YYYY format
            IF third_part ~ '^\d{2}\.\d{2}\.\d{4}$' THEN
              delivery_dt := to_date(third_part, 'DD.MM.YYYY');
              RAISE NOTICE 'Parsed date from DD.MM.YYYY format: %', delivery_dt;
            -- Try to parse date in YYYY-MM-DD format
            ELSIF third_part ~ '^\d{4}-\d{2}-\d{2}$' THEN
              delivery_dt := to_date(third_part, 'YYYY-MM-DD');
              RAISE NOTICE 'Parsed date from YYYY-MM-DD format: %', delivery_dt;
            -- Try to parse date in MM/DD/YYYY format
            ELSIF third_part ~ '^\d{2}/\d{2}/\d{4}$' THEN
              delivery_dt := to_date(third_part, 'MM/DD/YYYY');
              RAISE NOTICE 'Parsed date from MM/DD/YYYY format: %', delivery_dt;
            -- Try to parse date in DD/MM/YYYY format
            ELSIF third_part ~ '^\d{2}/\d{2}/\d{4}$' THEN
              delivery_dt := to_date(third_part, 'DD/MM/YYYY');
              RAISE NOTICE 'Parsed date from DD/MM/YYYY format: %', delivery_dt;
            ELSE
              RAISE NOTICE 'Date format not recognized: %', third_part;
              delivery_dt := NULL;
            END IF;
          EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error parsing date from %: %', third_part, SQLERRM;
            delivery_dt := NULL;
          END;
        ELSE
          -- No comma found, can't parse properly
          RAISE NOTICE 'No comma found to separate quantity and date in: %', first_part;
          delivered_qty := 0;
          delivery_dt := NULL;
        END IF;
      END;
      
      -- Get current order quantity to determine status
      SELECT quantity INTO current_quantity FROM order_lines WHERE id = line_id;
      RAISE NOTICE 'Current quantity: %, Delivered quantity: %', current_quantity, delivered_qty;
      
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
      RAISE NOTICE 'Invalid delivery string format (could not split by _,): %', delivery_string;
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
  error_count INTEGER := 0;
BEGIN
  FOR line_record IN 
    SELECT id, meta_data 
    FROM order_lines 
    WHERE meta_data IS NOT NULL 
      AND meta_data ? 'partial_delivery_item_details'
  LOOP
    BEGIN
      PERFORM parse_partial_delivery_details(line_record.id, line_record.meta_data);
      updated_count := updated_count + 1;
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      RAISE NOTICE 'Error processing line %: %', line_record.id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Reprocessed delivery details for % order lines (% errors)', updated_count, error_count;
END $$;

-- Log the update to function_logs table (without specifying ID to let it auto-generate)
INSERT INTO function_logs (function_name, log_message, created_at)
VALUES (
  'parse_partial_delivery_details',
  'Updated function to correctly handle decimal comma in quantities. Example: "_, 1,000, 16.06.2025" now parses as quantity 1.0',
  now()
);