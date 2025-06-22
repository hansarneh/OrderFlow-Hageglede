/*
  # Fix delivery date parsing in order_lines table

  1. Problem
    - The current parse_partial_delivery_details function doesn't correctly handle quantities with commas
    - Example format: ["_, 1,000, 16.06.2025"] - the comma in 1,000 breaks the string splitting

  2. Solution
    - Rewrite the function to use regular expressions for more robust parsing
    - Properly handle quantities with commas (e.g., "1,000")
    - Support multiple date formats (DD.MM.YYYY, YYYY-MM-DD, MM/DD/YYYY)
    - Add better error handling and logging

  3. Changes
    - Drop and recreate the parse_partial_delivery_details function
    - Reprocess all existing order lines with the new function
*/

-- Drop the existing trigger first to avoid conflicts
DROP TRIGGER IF EXISTS parse_delivery_details_trigger ON order_lines;

-- Update the function to correctly parse delivery details with regex
CREATE OR REPLACE FUNCTION parse_partial_delivery_details(line_id uuid, meta_data_input jsonb)
RETURNS void AS $$
DECLARE
  delivery_details jsonb;
  delivery_string text;
  quantity_part text;
  date_part text;
  delivered_qty integer;
  delivery_dt date;
  current_quantity integer;
  new_status text;
  regex_result text[];
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
  
  -- Get the first delivery detail string (format: ["_, 1,000, 16.06.2025"])
  delivery_string := delivery_details->>0;
  
  -- Parse the delivery string using regex to handle commas in numbers
  -- Format is typically: "_, <quantity>, <date>"
  IF delivery_string IS NOT NULL AND delivery_string != '' THEN
    -- Use regex to extract parts - match underscore, then quantity, then date
    -- This handles commas within the quantity value
    regex_result := regexp_match(delivery_string, '_,\s*([0-9,\.]+),\s*(.+)');
    
    IF regex_result IS NOT NULL AND array_length(regex_result, 1) >= 2 THEN
      -- Extract quantity part (remove commas)
      quantity_part := regexp_replace(regex_result[1], ',', '', 'g');
      
      -- Extract date part
      date_part := trim(regex_result[2]);
      
      -- Parse quantity
      BEGIN
        delivered_qty := COALESCE(quantity_part::integer, 0);
      EXCEPTION WHEN OTHERS THEN
        delivered_qty := 0;
      END;
      
      -- Parse date based on format
      BEGIN
        -- Try DD.MM.YYYY format
        IF date_part ~ '^\d{2}\.\d{2}\.\d{4}$' THEN
          delivery_dt := to_date(date_part, 'DD.MM.YYYY');
        -- Try YYYY-MM-DD format
        ELSIF date_part ~ '^\d{4}-\d{2}-\d{2}$' THEN
          delivery_dt := to_date(date_part, 'YYYY-MM-DD');
        -- Try MM/DD/YYYY format
        ELSIF date_part ~ '^\d{2}/\d{2}/\d{4}$' THEN
          delivery_dt := to_date(date_part, 'MM/DD/YYYY');
        -- Try DD/MM/YYYY format
        ELSIF date_part ~ '^\d{2}/\d{2}/\d{4}$' THEN
          delivery_dt := to_date(date_part, 'DD/MM/YYYY');
        ELSE
          delivery_dt := NULL;
        END IF;
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
      -- Invalid format, set to pending but keep the partial_delivery_details
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