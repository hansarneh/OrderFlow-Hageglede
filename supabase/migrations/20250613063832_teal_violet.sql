/*
  # Change produkttype column from jsonb to text

  1. Changes
    - Drop the existing GIN index on produkttype column
    - Alter produkttype column from jsonb to text
    - Extract the 'name' field from the first element of existing JSON arrays
    - Convert to NULL if the jsonb value is not an array or is empty

  2. Data Migration
    - Existing JSON arrays like [{"id": 52876, "name": "Potter og ampler", "slug": "potter-og-ampler"}]
    - Will be converted to simple text like "Potter og ampler"
    - NULL or empty values remain NULL
*/

-- Drop the existing GIN index on produkttype
DROP INDEX IF EXISTS products_produkttype_idx;

-- Alter the produkttype column from jsonb to text
-- This will extract the 'name' field from the first element of the JSON array
ALTER TABLE products 
ALTER COLUMN produkttype TYPE text 
USING CASE 
  WHEN produkttype IS NULL THEN NULL
  WHEN jsonb_typeof(produkttype) = 'array' AND jsonb_array_length(produkttype) > 0 THEN
    produkttype->0->>'name'
  WHEN jsonb_typeof(produkttype) = 'string' THEN
    produkttype#>>'{}'
  ELSE NULL
END;

-- Create a regular index on the text column for better performance
CREATE INDEX IF NOT EXISTS products_produkttype_text_idx ON products(produkttype);