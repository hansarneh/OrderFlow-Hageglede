/*
  # Fix billing_address column to show clean address format

  1. Problem
    - billing_address column contains full JSON objects
    - Need to show only formatted address: "address_1\npostcode city"

  2. Solution
    - Backup original JSON data to billing_address_json column
    - Convert billing_address column from jsonb to text
    - Extract and format address data properly

  3. Result
    - billing_address will show: "Høybakkveien 3\n1540 Vestby"
    - Original data preserved in billing_address_json
*/

-- First, backup the original JSON data to a new column
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS billing_address_json jsonb;

-- Copy the original JSON data to the backup column
UPDATE customer_orders 
SET billing_address_json = billing_address
WHERE billing_address IS NOT NULL AND billing_address_json IS NULL;

-- Change the billing_address column type from jsonb to text with proper conversion
ALTER TABLE customer_orders ALTER COLUMN billing_address TYPE text USING (
  CASE
    WHEN billing_address IS NOT NULL 
      AND billing_address ? 'address_1' 
      AND billing_address ? 'postcode' 
      AND billing_address ? 'city'
      AND TRIM(billing_address->>'address_1') != ''
      AND TRIM(billing_address->>'postcode') != ''
      AND TRIM(billing_address->>'city') != ''
    THEN 
      TRIM(billing_address->>'address_1') || E'\n' || 
      TRIM(billing_address->>'postcode') || ' ' || 
      TRIM(billing_address->>'city')
    ELSE NULL
  END
);

-- Update any records that might need additional formatting
UPDATE customer_orders
SET billing_address = CASE
  WHEN billing_address_json IS NOT NULL 
    AND billing_address_json ? 'address_1' 
    AND billing_address_json ? 'postcode' 
    AND billing_address_json ? 'city'
    AND TRIM(billing_address_json->>'address_1') != ''
    AND TRIM(billing_address_json->>'postcode') != ''
    AND TRIM(billing_address_json->>'city') != ''
    AND (billing_address IS NULL OR billing_address = '')
  THEN 
    TRIM(billing_address_json->>'address_1') || E'\n' || 
    TRIM(billing_address_json->>'postcode') || ' ' || 
    TRIM(billing_address_json->>'city')
  ELSE billing_address
END
WHERE billing_address_json IS NOT NULL;

-- Create index on the new text column for better performance
CREATE INDEX IF NOT EXISTS customer_orders_billing_address_formatted_idx ON customer_orders(billing_address);