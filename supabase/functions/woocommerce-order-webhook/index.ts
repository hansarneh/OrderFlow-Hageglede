import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wc-webhook-signature, x-wc-webhook-id, x-wc-webhook-topic, x-wc-webhook-source, x-wc-webhook-resource, x-wc-webhook-event, x-wc-webhook-delivery-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface WooCommerceOrder {
  id: number;
  number: string;
  status: string;
  currency: string;
  date_created: string;
  date_modified: string;
  total: string;
  customer_id: number;
  billing: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    email: string;
    phone: string;
  };
  shipping_lines: Array<{
    id: number;
    method_title: string;
    method_id: string;
    instance_id: string;
    total: string;
    total_tax: string;
    taxes: any[];
    meta_data: any[];
  }>;
  line_items: Array<{
    id: number;
    name: string;
    product_id: number;
    variation_id: number;
    quantity: number;
    tax_class: string;
    subtotal: string;
    subtotal_tax: string;
    total: string;
    total_tax: string;
    sku: string;
    price: number;
    meta_data: Array<{
      id: number;
      key: string;
      value: any;
    }>;
  }>;
  meta_data: Array<{
    id: number;
    key: string;
    value: any;
  }>;
}

/**
 * Validates the webhook signature from WooCommerce using Web Crypto API
 */
async function validateWebhookSignature(signature: string, payload: string, secret: string): Promise<boolean> {
  try {
    console.log('=== ORDER WEBHOOK SIGNATURE VALIDATION ===');
    console.log('Received signature:', signature);
    console.log('Webhook secret:', secret);
    console.log('Payload length:', payload.length);
    
    // Convert secret and payload to Uint8Array
    const encoder = new TextEncoder();
    const secretKey = encoder.encode(secret);
    const payloadData = encoder.encode(payload);
    
    // Import the secret as a cryptographic key
    const key = await crypto.subtle.importKey(
      'raw',
      secretKey,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    // Generate HMAC signature
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, payloadData);
    
    // Convert ArrayBuffer to base64 string
    const signatureArray = new Uint8Array(signatureBuffer);
    const calculatedSignature = btoa(String.fromCharCode(...signatureArray));
    
    console.log('Calculated signature:', calculatedSignature);
    console.log('Signatures match:', signature === calculatedSignature);
    
    return signature === calculatedSignature;
  } catch (error) {
    console.error('Error validating webhook signature:', error);
    return false;
  }
}

/**
 * Extract delivery date from meta_data and convert DD.MM.YYYY to date
 */
function extractDeliveryDate(metaData: Array<{key: string, value: any}>): Date | null {
  if (!metaData || !Array.isArray(metaData)) return null;
  
  const deliveryDateMeta = metaData.find(meta => meta.key === '_delivery_date');
  if (!deliveryDateMeta || !deliveryDateMeta.value) return null;
  
  const dateString = deliveryDateMeta.value.toString();
  
  // Check if it matches DD.MM.YYYY format
  const dateRegex = /^\d{2}\.\d{2}\.\d{4}$/;
  if (!dateRegex.test(dateString)) return null;
  
  try {
    const [day, month, year] = dateString.split('.');
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  } catch (error) {
    console.warn('Failed to parse delivery date:', dateString, error);
    return null;
  }
}

/**
 * Extract delivery type from meta_data
 */
function extractDeliveryType(metaData: Array<{key: string, value: any}>): string | null {
  if (!metaData || !Array.isArray(metaData)) return null;
  
  const deliveryTypeMeta = metaData.find(meta => meta.key === '_delivery_type');
  return deliveryTypeMeta?.value?.toString() || null;
}

/**
 * Extract shipping method title from shipping_lines array
 */
function extractShippingMethodTitle(shippingLines: Array<{method_title: string}>): string | null {
  if (!shippingLines || !Array.isArray(shippingLines) || shippingLines.length === 0) {
    return null;
  }
  
  // Get the method_title from the first shipping line
  return shippingLines[0]?.method_title || null;
}

/**
 * Format billing address as "address_1\npostcode city"
 */
function formatBillingAddress(billing: any): string | null {
  if (!billing || !billing.address_1 || !billing.postcode || !billing.city) {
    return null;
  }
  
  const address1 = billing.address_1.trim();
  const postcode = billing.postcode.trim();
  const city = billing.city.trim();
  
  if (!address1 || !postcode || !city) return null;
  
  return `${address1}\n${postcode} ${city}`;
}

Deno.serve(async (req: Request) => {
  console.log('=== ORDER WEBHOOK REQUEST RECEIVED ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  // Log ALL headers for debugging
  console.log('All Headers:');
  req.headers.forEach((value, key) => {
    console.log(`  ${key}: ${value}`);
  });

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get environment variables - NOW USING SEPARATE SECRET FOR ORDERS
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const webhookSecret = Deno.env.get('WOOCOMMERCE_ORDER_WEBHOOK_SECRET');

    console.log('Environment check:');
    console.log('  Supabase URL:', supabaseUrl ? 'Set' : 'Missing');
    console.log('  Service Key:', supabaseServiceKey ? 'Set' : 'Missing');
    console.log('  Order Webhook Secret:', webhookSecret ? 'Set' : 'Missing');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing required environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Missing Supabase credentials' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get the raw request body first
    const rawBody = await req.text();
    console.log('Raw body received, length:', rawBody.length);
    console.log('Raw body preview (first 500 chars):', rawBody.substring(0, 500));

    // Check for signature in multiple possible header formats
    let signature = req.headers.get('X-WC-Webhook-Signature') || 
                   req.headers.get('x-wc-webhook-signature') ||
                   req.headers.get('X-Wc-Webhook-Signature');
    
    console.log('Signature check:');
    console.log('  X-WC-Webhook-Signature:', req.headers.get('X-WC-Webhook-Signature'));
    console.log('  x-wc-webhook-signature:', req.headers.get('x-wc-webhook-signature'));
    console.log('  X-Wc-Webhook-Signature:', req.headers.get('X-Wc-Webhook-Signature'));
    console.log('  Final signature used:', signature);

    // If we have a webhook secret configured, validate the signature
    if (webhookSecret && webhookSecret.trim() !== '') {
      if (!signature) {
        console.error('Missing X-WC-Webhook-Signature header but webhook secret is configured');
        console.error('This usually means:');
        console.error('1. WooCommerce webhook is not configured with a secret');
        console.error('2. The webhook URL in WooCommerce is incorrect');
        console.error('3. WooCommerce version doesn\'t support webhook signatures');
        
        return new Response(
          JSON.stringify({ 
            error: 'Missing webhook signature', 
            details: 'WooCommerce order webhook must be configured with the secret: ' + webhookSecret,
            troubleshooting: [
              'Check that the order webhook secret in WooCommerce matches: ' + webhookSecret,
              'Ensure the webhook URL is correct',
              'Verify WooCommerce version supports webhook signatures'
            ]
          }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Validate the webhook signature
      const isValidSignature = await validateWebhookSignature(signature, rawBody, webhookSecret);
      console.log('Signature validation result:', isValidSignature);
      
      if (!isValidSignature) {
        console.error('Invalid webhook signature - returning 401');
        return new Response(
          JSON.stringify({ 
            error: 'Invalid webhook signature',
            details: 'The signature does not match the expected value',
            receivedSignature: signature,
            troubleshooting: [
              'Verify the order webhook secret in WooCommerce matches: ' + webhookSecret,
              'Check that the webhook URL is exactly correct',
              'Ensure no proxy or CDN is modifying the request'
            ]
          }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log('Signature validation passed, proceeding with webhook processing');
    } else {
      console.warn('⚠️  WARNING: No order webhook secret configured - skipping signature validation');
      console.warn('⚠️  This is insecure and should only be used for testing');
      console.warn('⚠️  Set WOOCOMMERCE_ORDER_WEBHOOK_SECRET environment variable for production');
    }

    // Parse the request body
    let order: WooCommerceOrder;
    try {
      order = JSON.parse(rawBody);
      console.log('Successfully parsed order JSON, ID:', order.id, 'Number:', order.number);
    } catch (error) {
      console.error('Error parsing request body:', error);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Validate that we have an order with an ID
    if (!order || !order.id) {
      console.error('Invalid order data: missing ID');
      return new Response(
        JSON.stringify({ error: 'Invalid order data: missing ID' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Processing webhook for order ID: ${order.id}, Number: ${order.number}, Status: ${order.status}`);

    // Determine customer name
    const customerName = order.billing.company || 
                        `${order.billing.first_name} ${order.billing.last_name}`.trim() ||
                        `Customer #${order.customer_id}`;

    // Calculate total items
    const totalItems = order.line_items.reduce((sum, item) => sum + item.quantity, 0);

    // Extract additional fields from meta_data and shipping_lines
    const deliveryDate = extractDeliveryDate(order.meta_data);
    const deliveryType = extractDeliveryType(order.meta_data);
    const shippingMethodTitle = extractShippingMethodTitle(order.shipping_lines);
    const billingAddressFormatted = formatBillingAddress(order.billing);

    console.log('Extracted data:');
    console.log('  Customer Name:', customerName);
    console.log('  Total Items:', totalItems);
    console.log('  Delivery Date:', deliveryDate);
    console.log('  Delivery Type:', deliveryType);
    console.log('  Shipping Method:', shippingMethodTitle);
    console.log('  Formatted Address:', billingAddressFormatted);

    // Use the new process_woocommerce_order function to handle the order and its line items
    console.log('Calling process_woocommerce_order function...');
    
    const { data, error } = await supabaseAdmin.rpc('process_woocommerce_order', {
      p_woocommerce_order_id: order.id,
      p_order_number: order.number,
      p_customer_name: customerName,
      p_woo_status: order.status,
      p_total_value: parseFloat(order.total),
      p_total_items: totalItems,
      p_date_created: new Date(order.date_created).toISOString(),
      p_line_items: order.line_items,
      p_meta_data: order.meta_data || {},
      p_billing_address: billingAddressFormatted,
      p_billing_address_json: order.billing,
      p_permalink: `https://yourstore.com/wp-admin/post.php?post=${order.id}&action=edit`,
      p_delivery_date: deliveryDate ? deliveryDate.toISOString().split('T')[0] : null,
      p_delivery_type: deliveryType,
      p_shipping_method_title: shippingMethodTitle
    });

    if (error) {
      console.error('Error processing order:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to process order', 
          details: error.message,
          code: error.code
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`✅ Successfully processed order ID: ${order.id} (${order.number}), internal ID: ${data}`);
    console.log('=== ORDER WEBHOOK PROCESSING COMPLETE ===');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Order ${order.id} (${order.number}) processed successfully`,
        orderId: data,
        signatureValidated: !!signature,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: errorMessage,
        stack: errorStack
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});