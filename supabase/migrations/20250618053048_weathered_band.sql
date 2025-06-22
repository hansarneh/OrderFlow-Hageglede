/*
  # Change primary key of purchase_orders table from id to po_number

  1. Problem
    - The purchase_orders table currently uses id as the primary key
    - Rackbeat API doesn't provide consistent IDs, causing duplicate records
    - We need to use po_number as the primary key for reliable upserts

  2. Solution
    - Handle any duplicate po_numbers
    - Change the primary key from id to po_number
    - Update foreign key references in purchase_order_lines table
    - Create appropriate indexes and constraints

  3. Data Safety
    - Preserve existing data during the migration
    - Handle potential duplicates by keeping the most recent record
*/

-- First, check for and handle any duplicate po_numbers
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  -- Count duplicates
  SELECT COUNT(*) - COUNT(DISTINCT po_number) INTO duplicate_count FROM purchase_orders;
  
  IF duplicate_count > 0 THEN
    RAISE NOTICE 'Found % duplicate po_number values that need to be resolved', duplicate_count;
    
    -- Keep only the most recent record for each po_number
    WITH duplicates AS (
      SELECT 
        id,
        po_number,
        ROW_NUMBER() OVER (PARTITION BY po_number ORDER BY order_date DESC NULLS LAST, id DESC) as rn
      FROM purchase_orders
    )
    DELETE FROM purchase_orders
    WHERE id IN (
      SELECT id FROM duplicates WHERE rn > 1
    );
    
    RAISE NOTICE 'Removed % duplicate purchase orders', duplicate_count;
  ELSE
    RAISE NOTICE 'No duplicate po_number values found, proceeding with migration';
  END IF;
END $$;

-- Drop existing foreign key constraints in purchase_order_lines
ALTER TABLE purchase_order_lines
DROP CONSTRAINT IF EXISTS purchase_order_lines_purchase_order_id_fkey;

-- Drop existing unique constraint on po_number (which also drops the index)
ALTER TABLE purchase_orders 
DROP CONSTRAINT IF EXISTS purchase_orders_po_number_key;

-- Drop the primary key constraint
ALTER TABLE purchase_orders 
DROP CONSTRAINT IF EXISTS purchase_orders_pkey;

-- Add NOT NULL constraint to po_number if not already present
ALTER TABLE purchase_orders 
ALTER COLUMN po_number SET NOT NULL;

-- Make po_number the new primary key
ALTER TABLE purchase_orders
ADD PRIMARY KEY (po_number);

-- Update purchase_order_lines to reference po_number instead of id
-- First, add a new column for the foreign key
ALTER TABLE purchase_order_lines
ADD COLUMN purchase_order_number text;

-- Update the new column with values from the related purchase_orders
UPDATE purchase_order_lines pol
SET purchase_order_number = po.po_number
FROM purchase_orders po
WHERE pol.purchase_order_id = po.id;

-- Drop the old foreign key column
ALTER TABLE purchase_order_lines
DROP COLUMN purchase_order_id;

-- Rename the new column to match the old name convention
ALTER TABLE purchase_order_lines
RENAME COLUMN purchase_order_number TO purchase_order_id;

-- Add NOT NULL constraint to the renamed column
ALTER TABLE purchase_order_lines
ALTER COLUMN purchase_order_id SET NOT NULL;

-- Add the new foreign key constraint
ALTER TABLE purchase_order_lines
ADD CONSTRAINT purchase_order_lines_purchase_order_id_fkey
FOREIGN KEY (purchase_order_id)
REFERENCES purchase_orders(po_number)
ON DELETE CASCADE;

-- Drop the old unique constraint if it exists
ALTER TABLE purchase_order_lines
DROP CONSTRAINT IF EXISTS purchase_order_lines_po_id_product_number_unique;

-- Create a new unique constraint for (purchase_order_id, product_number)
ALTER TABLE purchase_order_lines
ADD CONSTRAINT purchase_order_lines_po_id_product_number_unique
UNIQUE (purchase_order_id, product_number);

-- Create a new index for the foreign key
CREATE INDEX IF NOT EXISTS idx_purchase_order_id ON purchase_order_lines(purchase_order_id);

-- Log the migration
INSERT INTO function_logs (function_name, log_message)
VALUES (
  'migration',
  'Changed primary key of purchase_orders table from id to po_number and updated foreign key references'
);