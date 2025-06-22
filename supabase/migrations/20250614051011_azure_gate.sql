/*
  # Fix delivery_type column to extract plain text value

  1. Problem
    - The delivery_type column still contains the full JSON object
    - We need to extract just the "value" field from the JSON structure

  2. Solution
    - Update the delivery_type column to extract only the "value" field
    - Handle both array and object formats in meta_data
    - Clean up any existing JSON data to plain text

  3. Data transformation
    - From: {"id": 129373311, "key": "_delivery_type", "value": "Samlet levering"}
    - To: "Samlet levering"
*/

-- First, let's update records where delivery_type contains JSON objects
-- Extract the "value" field from the JSON if it exists
UPDATE customer_orders
SET delivery_type = CASE
  WHEN delivery_type IS NOT NULL 
    AND delivery_type LIKE '{%}' 
    AND delivery_type::jsonb ? 'value'
  THEN delivery_type::jsonb->>'value'
  ELSE delivery_type
END
WHERE delivery_type IS NOT NULL;

-- Now re-run the extraction from meta_data to ensure we get the value correctly
-- For array format meta_data
UPDATE customer_orders
SET delivery_type = (
  SELECT elem->>'value'
  FROM jsonb_array_elements(meta_data) AS elem
  WHERE elem->>'key' = '_delivery_type'
  LIMIT 1
)
WHERE meta_data IS NOT NULL
  AND jsonb_typeof(meta_data) = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(meta_data) AS elem
    WHERE elem->>'key' = '_delivery_type'
  );

-- For object format meta_data (direct key access)
UPDATE customer_orders
SET delivery_type = meta_data->>'_delivery_type'
WHERE meta_data IS NOT NULL
  AND jsonb_typeof(meta_data) = 'object'
  AND meta_data ? '_delivery_type'
  AND (delivery_type IS NULL OR delivery_type LIKE '{%}');

-- Clean up any remaining JSON-formatted values in delivery_type
UPDATE customer_orders
SET delivery_type = CASE
  WHEN delivery_type IS NOT NULL 
    AND delivery_type LIKE '{%'
    AND delivery_type::jsonb ? 'value'
  THEN delivery_type::jsonb->>'value'
  WHEN delivery_type IS NOT NULL 
    AND delivery_type LIKE '"%'
  THEN trim(both '"' from delivery_type)
  ELSE delivery_type
END
WHERE delivery_type IS NOT NULL;