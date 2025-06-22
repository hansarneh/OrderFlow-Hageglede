/*
  # Populate customer_orders table with sample data

  1. Sample Data
    - Create realistic customer orders with line items
    - Include various order statuses (processing, on-hold, pending, completed)
    - Add delivery dates in meta_data for some orders
    - Include realistic product line items with SKUs and prices

  2. Data Structure
    - Orders from the last 30 days
    - Mix of single and multi-item orders
    - Various customer types (individuals and companies)
    - Realistic Norwegian pricing (NOK)
*/

-- Insert sample customer orders
INSERT INTO customer_orders (
  woocommerce_order_id,
  order_number,
  customer_name,
  woo_status,
  total_value,
  total_items,
  date_created,
  line_items,
  meta_data,
  billing_address,
  permalink
) VALUES 
-- Order 1: Processing order with delivery date
(
  2546587,
  'ORD-2546587',
  'Acme Corporation AS',
  'processing',
  15750.00,
  3,
  '2024-12-20 10:30:00+00',
  '[
    {
      "id": 1,
      "name": "Professional Wireless Headphones",
      "product_id": 101,
      "quantity": 5,
      "total": "3995.00",
      "sku": "WH-PRO-001",
      "price": 799.00
    },
    {
      "id": 2,
      "name": "Bluetooth Conference Speaker",
      "product_id": 102,
      "quantity": 2,
      "total": "5998.00",
      "sku": "CONF-SPK-001",
      "price": 2999.00
    },
    {
      "id": 3,
      "name": "USB-C Charging Cable 2m",
      "product_id": 103,
      "quantity": 10,
      "total": "1990.00",
      "sku": "CABLE-USBC-2M",
      "price": 199.00
    }
  ]'::jsonb,
  '{
    "_delivery_date": "15.01.2025",
    "_customer_notes": "Please deliver to reception desk",
    "_priority": "high"
  }'::jsonb,
  '{
    "first_name": "Lars",
    "last_name": "Hansen",
    "company": "Acme Corporation AS",
    "address_1": "Storgata 15",
    "city": "Oslo",
    "postcode": "0155",
    "country": "NO",
    "email": "lars.hansen@acme.no",
    "phone": "+47 22 12 34 56"
  }'::jsonb,
  'https://yourstore.com/wp-admin/post.php?post=2546587&action=edit'
),

-- Order 2: On-hold order with overdue delivery
(
  2546588,
  'ORD-2546588',
  'TechFlow Solutions',
  'on-hold',
  8950.00,
  2,
  '2024-12-18 14:15:00+00',
  '[
    {
      "id": 4,
      "name": "4K Webcam Pro",
      "product_id": 104,
      "quantity": 3,
      "total": "5997.00",
      "sku": "CAM-4K-PRO",
      "price": 1999.00
    },
    {
      "id": 5,
      "name": "Adjustable Monitor Arm",
      "product_id": 105,
      "quantity": 3,
      "total": "2997.00",
      "sku": "ARM-MON-ADJ",
      "price": 999.00
    }
  ]'::jsonb,
  '{
    "_delivery_date": "10.01.2025 OVERDUE",
    "_hold_reason": "Payment verification required",
    "_priority": "medium"
  }'::jsonb,
  '{
    "first_name": "Maria",
    "last_name": "Olsen",
    "company": "TechFlow Solutions",
    "address_1": "Teknologiveien 42",
    "city": "Bergen",
    "postcode": "5020",
    "country": "NO",
    "email": "maria@techflow.no",
    "phone": "+47 55 98 76 54"
  }'::jsonb,
  'https://yourstore.com/wp-admin/post.php?post=2546588&action=edit'
),

-- Order 3: Pending order
(
  2546589,
  'ORD-2546589',
  'Erik Nordahl',
  'pending',
  2495.00,
  1,
  '2024-12-22 09:45:00+00',
  '[
    {
      "id": 6,
      "name": "Gaming Mechanical Keyboard",
      "product_id": 106,
      "quantity": 1,
      "total": "2495.00",
      "sku": "KB-MECH-RGB",
      "price": 2495.00
    }
  ]'::jsonb,
  '{
    "_delivery_date": "20.01.2025",
    "_customer_notes": "Gift wrapping requested",
    "_priority": "low"
  }'::jsonb,
  '{
    "first_name": "Erik",
    "last_name": "Nordahl",
    "company": "",
    "address_1": "Bjørnstjerne Bjørnsons gate 7",
    "city": "Trondheim",
    "postcode": "7014",
    "country": "NO",
    "email": "erik.nordahl@gmail.com",
    "phone": "+47 73 45 67 89"
  }'::jsonb,
  'https://yourstore.com/wp-admin/post.php?post=2546589&action=edit'
),

-- Order 4: Completed order
(
  2546590,
  'ORD-2546590',
  'Innovate AS',
  'completed',
  12750.00,
  4,
  '2024-12-15 16:20:00+00',
  '[
    {
      "id": 7,
      "name": "Wireless Presentation Remote",
      "product_id": 107,
      "quantity": 5,
      "total": "2495.00",
      "sku": "REMOTE-PRES-WL",
      "price": 499.00
    },
    {
      "id": 8,
      "name": "Portable Projector 4K",
      "product_id": 108,
      "quantity": 1,
      "total": "7995.00",
      "sku": "PROJ-4K-PORT",
      "price": 7995.00
    },
    {
      "id": 9,
      "name": "HDMI Cable 5m",
      "product_id": 109,
      "quantity": 3,
      "total": "897.00",
      "sku": "HDMI-5M",
      "price": 299.00
    },
    {
      "id": 10,
      "name": "Carrying Case Large",
      "product_id": 110,
      "quantity": 1,
      "total": "1495.00",
      "sku": "CASE-LARGE",
      "price": 1495.00
    }
  ]'::jsonb,
  '{
    "_delivery_date": "18.12.2024",
    "_delivered_date": "18.12.2024",
    "_tracking_number": "NO1234567890",
    "_priority": "high"
  }'::jsonb,
  '{
    "first_name": "Kari",
    "last_name": "Andersen",
    "company": "Innovate AS",
    "address_1": "Innovasjonsparken 1",
    "city": "Stavanger",
    "postcode": "4020",
    "country": "NO",
    "email": "kari@innovate.no",
    "phone": "+47 51 23 45 67"
  }'::jsonb,
  'https://yourstore.com/wp-admin/post.php?post=2546590&action=edit'
),

-- Order 5: Large processing order
(
  2546591,
  'ORD-2546591',
  'Nordic Tech Solutions AS',
  'processing',
  45890.00,
  8,
  '2024-12-19 11:30:00+00',
  '[
    {
      "id": 11,
      "name": "Professional Monitor 32 inch",
      "product_id": 111,
      "quantity": 4,
      "total": "31960.00",
      "sku": "MON-32-PRO",
      "price": 7990.00
    },
    {
      "id": 12,
      "name": "Ergonomic Office Chair",
      "product_id": 112,
      "quantity": 4,
      "total": "11980.00",
      "sku": "CHAIR-ERG-PRO",
      "price": 2995.00
    },
    {
      "id": 13,
      "name": "Wireless Mouse Pro",
      "product_id": 113,
      "quantity": 4,
      "total": "1996.00",
      "sku": "MOUSE-WL-PRO",
      "price": 499.00
    }
  ]'::jsonb,
  '{
    "_delivery_date": "25.01.2025",
    "_installation_required": "true",
    "_customer_notes": "Office setup for new employees",
    "_priority": "high"
  }'::jsonb,
  '{
    "first_name": "Bjørn",
    "last_name": "Eriksen",
    "company": "Nordic Tech Solutions AS",
    "address_1": "Nydalen Allé 37",
    "city": "Oslo",
    "postcode": "0484",
    "country": "NO",
    "email": "bjorn@nordictechsolutions.no",
    "phone": "+47 22 87 65 43"
  }'::jsonb,
  'https://yourstore.com/wp-admin/post.php?post=2546591&action=edit'
),

-- Order 6: Small pending order
(
  2546592,
  'ORD-2546592',
  'Anna Kristiansen',
  'pending',
  1299.00,
  2,
  '2024-12-23 13:45:00+00',
  '[
    {
      "id": 14,
      "name": "Bluetooth Earbuds",
      "product_id": 114,
      "quantity": 1,
      "total": "899.00",
      "sku": "EARBUDS-BT",
      "price": 899.00
    },
    {
      "id": 15,
      "name": "Phone Stand Adjustable",
      "product_id": 115,
      "quantity": 1,
      "total": "399.00",
      "sku": "STAND-PHONE-ADJ",
      "price": 399.00
    }
  ]'::jsonb,
  '{
    "_delivery_date": "28.01.2025",
    "_customer_notes": "Leave with neighbor if not home",
    "_priority": "low"
  }'::jsonb,
  '{
    "first_name": "Anna",
    "last_name": "Kristiansen",
    "company": "",
    "address_1": "Rosenkrantz gate 22",
    "city": "Oslo",
    "postcode": "0159",
    "country": "NO",
    "email": "anna.kristiansen@hotmail.com",
    "phone": "+47 90 12 34 56"
  }'::jsonb,
  'https://yourstore.com/wp-admin/post.php?post=2546592&action=edit'
),

-- Order 7: On-hold order with multiple items
(
  2546593,
  'ORD-2546593',
  'Digital Workspace AS',
  'on-hold',
  18750.00,
  5,
  '2024-12-21 08:15:00+00',
  '[
    {
      "id": 16,
      "name": "Standing Desk Electric",
      "product_id": 116,
      "quantity": 2,
      "total": "11990.00",
      "sku": "DESK-STAND-ELEC",
      "price": 5995.00
    },
    {
      "id": 17,
      "name": "Monitor Light Bar",
      "product_id": 117,
      "quantity": 2,
      "total": "1998.00",
      "sku": "LIGHT-MON-BAR",
      "price": 999.00
    },
    {
      "id": 18,
      "name": "Cable Management Tray",
      "product_id": 118,
      "quantity": 2,
      "total": "798.00",
      "sku": "TRAY-CABLE-MGT",
      "price": 399.00
    }
  ]'::jsonb,
  '{
    "_delivery_date": "30.01.2025",
    "_hold_reason": "Awaiting stock confirmation",
    "_assembly_required": "true",
    "_priority": "medium"
  }'::jsonb,
  '{
    "first_name": "Thomas",
    "last_name": "Berg",
    "company": "Digital Workspace AS",
    "address_1": "Drammensveien 134",
    "city": "Oslo",
    "postcode": "0277",
    "country": "NO",
    "email": "thomas@digitalworkspace.no",
    "phone": "+47 22 56 78 90"
  }'::jsonb,
  'https://yourstore.com/wp-admin/post.php?post=2546593&action=edit'
);