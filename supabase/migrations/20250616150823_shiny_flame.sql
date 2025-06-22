/*
  # Fix order_lines and products relationship

  1. Problem
    - Edge Function fails because there's no foreign key relationship between order_lines and products
    - Cannot add foreign key constraint due to orphaned records in order_lines

  2. Solution
    - Clean up orphaned order_lines records that reference non-existent products
    - Add foreign key constraint between order_lines.product_id and products.woocommerce_id
    - This will enable Supabase to understand the relationship for joins

  3. Data Safety
    - Only remove order_lines records where product_id doesn't exist in products table
    - Log the cleanup for transparency
*/

-- First, identify and remove orphaned order_lines records
DO $$
DECLARE
  orphaned_count integer;
BEGIN
  -- Count orphaned records
  SELECT COUNT(*) INTO orphaned_count
  FROM order_lines ol
  WHERE ol.product_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM products p 
      WHERE p.woocommerce_id = ol.product_id
    );
  
  RAISE NOTICE 'Found % orphaned order_lines records', orphaned_count;
  
  -- Delete orphaned records
  DELETE FROM order_lines
  WHERE product_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM products p 
      WHERE p.woocommerce_id = product_id
    );
  
  RAISE NOTICE 'Cleaned up % orphaned order_lines records', orphaned_count;
END $$;

-- Now add the foreign key constraint
DO $$
BEGIN
  -- Check if the foreign key constraint doesn't already exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_order_lines_product_id' 
    AND table_name = 'order_lines'
  ) THEN
    -- Add the foreign key constraint
    ALTER TABLE order_lines
    ADD CONSTRAINT fk_order_lines_product_id
    FOREIGN KEY (product_id)
    REFERENCES products(woocommerce_id);
    
    RAISE NOTICE 'Foreign key constraint fk_order_lines_product_id added successfully';
  ELSE
    RAISE NOTICE 'Foreign key constraint fk_order_lines_product_id already exists';
  END IF;
END $$;

-- Create index on product_id for better join performance
CREATE INDEX IF NOT EXISTS order_lines_product_id_idx ON order_lines(product_id);

-- Verify the relationship works
DO $$
DECLARE
  valid_relationships integer;
  total_order_lines integer;
BEGIN
  SELECT COUNT(*) INTO total_order_lines FROM order_lines WHERE product_id IS NOT NULL;
  
  SELECT COUNT(*) INTO valid_relationships
  FROM order_lines ol
  INNER JOIN products p ON ol.product_id = p.woocommerce_id;
  
  RAISE NOTICE 'Verification: % total order_lines with product_id, % valid relationships', 
    total_order_lines, valid_relationships;
END $$;