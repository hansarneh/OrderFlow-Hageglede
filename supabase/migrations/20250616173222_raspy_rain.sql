/*
  # Fix delivery date parsing to handle decimal comma correctly

  1. Problem
    - The delivered_quantity column is integer type but we're trying to store decimal values
    - The parsing logic is not correctly handling the format "_, 1,000, 16.06.2025"
    - Need to understand that "1,000" means 1.0 (decimal comma), not 1000

  2. Solution
    - Change delivered_quantity column to numeric to handle decimal values
    - Fix the parsing logic to correctly interpret decimal comma
    - Simplify the parsing to be more robust

  3. Data Migration
    - Update all existing order lines to reprocess their delivery details
*/

-- Change delivered_quantity column from integer to numeric to handle decimal values
ALTER TABLE order_lines ALTER COLUMN delivered_quantity TYPE numeric USING delivered_quantity::numeric;

-- Drop the existing trigger first to avoid conflicts
DROP TRIGGER IF EXISTS parse_delivery_details_trigger ON order_lines;

-- Create a much simpler and more robust function
CREATE OR REPLACE FUNCTION parse_partial_delivery_details(line_id uuid, meta_data_input jsonb)
RETURNS void AS $$
DECLARE
  delivery_details jsonb;
  delivery_string text;
  quantity_part text;
  date_part text;
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
  
  -- Get the first delivery detail string (format: "_, 1,000, 16.06.2025")
  delivery_string := delivery_details->>0;
  
  -- Parse the delivery string
  IF delivery_string IS NOT NULL AND delivery_string != '' THEN
    -- Remove the initial "_, " part
    delivery_string := regexp_replace(delivery_string, '^_,\s*', '');
    
    -- Now we should have something like "1,000, 16.06.2025"
    -- Split by the last comma to separate quantity and date
    IF position(',' in reverse(delivery_string)) > 0 THEN
      -- Find the position of the last comma
      DECLARE
        last_comma_pos integer;
        temp_string text;
      BEGIN
        temp_string := reverse(delivery_string);
        last_comma_pos := position(',' in temp_string);
        last_comma_pos := length(delivery_string) - last_comma_pos + 1;
        
        -- Extract quantity and date parts
        quantity_part := trim(substring(delivery_string from 1 for last_comma_pos - 1));
        date_part := trim(substring(delivery_string from last_comma_pos + 1));
        
        -- Parse quantity - treat comma as decimal separator
        BEGIN
          -- Replace comma with dot for decimal conversion
          delivered_qty := COALESCE(replace(quantity_part, ',', '.')::numeric, 0);
        EXCEPTION WHEN OTHERS THEN
          delivered_qty := 0;
        END;
        
        -- Parse date (DD.MM.YYYY format)
        BEGIN
          IF date_part ~ '^\d{2}\.\d{2}\.\d{4}$' THEN
            delivery_dt := to_date(date_part, 'DD.MM.YYYY');
          ELSE
            delivery_dt := NULL;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          delivery_dt := NULL;
        END;
      END;
    ELSE
      -- No comma found, can't parse
      delivered_qty := 0;
      delivery_dt := NULL;
    END IF;
    
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
      -- Continue processing other records even if one fails
      CONTINUE;
    END;
  END LOOP;
  
  RAISE NOTICE 'Reprocessed delivery details for % order lines', updated_count;
END $$;