/*
  # Add formatted billing address column to customer_orders table

  1. Changes
    - Add `billing_address_formatted` text column to customer_orders table
    - Extract and format address from billing_address JSON column
    - Format as: "address_1\npostcode city"
    - Create index for better query performance

  2. Data Migration
    - Extract address_1, postcode, and city from billing_address JSON
    - Combine into formatted string with line break
    - Handle cases where fields might be missing or empty
*/

-- Add formatted billing address column to customer_orders table
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS billing_address_formatted text;

-- Populate billing_address_formatted column from billing_address JSON
-- Format as: "address_1\npostcode city"
UPDATE customer_orders
SET billing_address_formatted = CASE
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
WHERE billing_address IS NOT NULL;

-- Create index on billing_address_formatted for better query performance
CREATE INDEX IF NOT EXISTS customer_orders_billing_address_formatted_idx ON customer_orders(billing_address_formatted);