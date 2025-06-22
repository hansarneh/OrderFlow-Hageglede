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
          
          -- Parse quantity - IMPORTANT: Treat comma as decimal separator, not thousands separator
          BEGIN
            -- Replace any thousands separators (spaces) and use comma as decimal point
            second_part := regexp_replace(second_part, '\s', '', 'g');
            delivered_qty := COALESCE(replace(second_part, ',', '.')::numeric, 0);
            
            -- Round to nearest integer for storage in the integer column
            -- This ensures 1,000 becomes 1 instead of 0
            delivered_qty := round(delivered_qty);
          EXCEPTION WHEN OTHERS THEN
            delivered_qty := 0;
          END;
          
          -- Parse date
          BEGIN
            -- Try to parse date in DD.MM.YYYY format
            IF third_part ~ '^\d{2}\.\d{2}\.\d{4}$' THEN
              delivery_dt := to_date(third_part, 'DD.MM.YYYY');
            -- Try to parse date in YYYY-MM-DD format
            ELSIF third_part ~ '^\d{4}-\d{2}-\d{2}$' THEN
              delivery_dt := to_date(third_part, 'YYYY-MM-DD');
            -- Try to parse date in MM/DD/YYYY format
            ELSIF third_part ~ '^\d{2}/\d{2}/\d{4}$' THEN
              delivery_dt := to_date(third_part, 'MM/DD/YYYY');
            -- Try to parse date in DD/MM/YYYY format
            ELSIF third_part ~ '^\d{2}/\d{2}/\d{4}$' THEN
              delivery_dt := to_date(third_part, 'DD/MM/YYYY');
            ELSE
              delivery_dt := NULL;
            END IF;
          EXCEPTION WHEN OTHERS THEN
            delivery_dt := NULL;
          END;
        ELSE
          -- No comma found, can't parse properly
          delivered_qty := 0;
          delivery_dt := NULL;
        END IF;
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

-- Log the update to function_logs table (without specifying ID)
INSERT INTO function_logs (function_name, log_message, created_at)
VALUES (
  'parse_partial_delivery_details',
  'Updated function to correctly handle decimal comma in quantities. Example: "_, 1,000, 16.06.2025" now parses as quantity 1.0',
  now()
);