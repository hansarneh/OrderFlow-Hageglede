/*
  # Add produkttype custom taxonomy to products table

  1. Changes
    - Add `produkttype` column to products table as jsonb to store array of product type objects
    - This will store the custom taxonomy data from WooCommerce

  2. Structure
    - produkttype will store data like: [{"id": 123, "name": "Electronics", "slug": "electronics"}]
*/

-- Add produkttype column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS produkttype jsonb;

-- Create index for produkttype queries
CREATE INDEX IF NOT EXISTS products_produkttype_idx ON products USING gin(produkttype);