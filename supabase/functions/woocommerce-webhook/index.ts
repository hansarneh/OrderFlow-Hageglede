import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wc-webhook-signature, x-wc-webhook-id, x-wc-webhook-topic, x-wc-webhook-source, x-wc-webhook-resource, x-wc-webhook-event, x-wc-webhook-delivery-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface WooCommerceProduct {
  id: number;
  name: string;
  sku?: string;
  stock_quantity?: number;
  stock_status?: string;
  manage_stock?: boolean;
  price?: string;
  regular_price?: string;
  sale_price?: string;
  permalink?: string;
  type?: string;
  status?: string;
  date_created?: string;
  date_modified?: string;
  produkttype?: Array<{
    id: number;
    name: string;
    slug: string;
  }> | string;
  meta_data?: Array<{
    id: number;
    key: string;
    value: any;
  }>;
}

/**
 * Validates the webhook signature from WooCommerce using Web Crypto API
 * @param signature The signature from the X-WC-Webhook-Signature header
 * @param payload The raw request body
 * @param secret The webhook secret configured in WooCommerce
 * @returns Promise<boolean> indicating if the signature is valid
 */
async function validateWebhookSignature(signature: string, payload: string, secret: string): Promise<boolean> {
  try {
    console.log('=== PRODUCT WEBHOOK SIGNATURE VALIDATION ===');
    console.log('Received signature:', signature);
    console.log('Webhook secret:', secret);
    console.log('Payload length:', payload.length);
    console.log('Payload preview (first 200 chars):', payload.substring(0, 200));
    
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
    console.log('=== END SIGNATURE VALIDATION ===');
    
    // Compare the calculated signature with the one provided in the header
    return signature === calculatedSignature;
  } catch (error) {
    console.error('Error validating webhook signature:', error);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  console.log('=== PRODUCT WEBHOOK REQUEST RECEIVED ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  // Log all headers for debugging
  console.log('Headers:');
  req.headers.forEach((value, key) => {
    console.log(`  ${key}: ${value}`);
  });

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get environment variables - NOW USING SEPARATE SECRET FOR PRODUCTS
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const webhookSecret = Deno.env.get('WOOCOMMERCE_PRODUCT_WEBHOOK_SECRET');

    console.log('Environment check:');
    console.log('  Supabase URL:', supabaseUrl ? 'Set' : 'Missing');
    console.log('  Service Key:', supabaseServiceKey ? 'Set' : 'Missing');
    console.log('  Product Webhook Secret:', webhookSecret ? 'Set' : 'Missing');

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

    // Get the raw request body for signature validation
    const rawBody = await req.text();
    console.log('Raw body received, length:', rawBody.length);
    console.log('Raw body preview (first 500 chars):', rawBody.substring(0, 500));
    
    // Get the signature from the header
    const signature = req.headers.get('X-WC-Webhook-Signature');
    console.log('X-WC-Webhook-Signature header:', signature);
    
    // If we have a webhook secret configured, validate the signature
    if (webhookSecret && webhookSecret.trim() !== '') {
      if (!signature) {
        console.error('Missing X-WC-Webhook-Signature header but webhook secret is configured');
        return new Response(
          JSON.stringify({ 
            error: 'Missing webhook signature',
            details: 'WooCommerce product webhook must be configured with the secret: ' + webhookSecret,
            troubleshooting: [
              'Check that the product webhook secret in WooCommerce matches: ' + webhookSecret,
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

      // Validate the webhook signature (now async)
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
              'Verify the product webhook secret in WooCommerce matches: ' + webhookSecret,
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
      console.warn('⚠️  WARNING: No product webhook secret configured - skipping signature validation');
      console.warn('⚠️  This is insecure and should only be used for testing');
      console.warn('⚠️  Set WOOCOMMERCE_PRODUCT_WEBHOOK_SECRET environment variable for production');
    }

    // Parse the request body with comprehensive error handling
    let product: WooCommerceProduct;
    try {
      console.log('Attempting to parse request body as JSON...');
      product = JSON.parse(rawBody);
      console.log('✅ Successfully parsed product JSON, ID:', product.id);
    } catch (parseError) {
      console.error('❌ Error parsing request body as JSON:', parseError);
      console.error('Raw body content type:', req.headers.get('content-type'));
      console.error('Raw body first 1000 chars:', rawBody.substring(0, 1000));
      
      // Provide detailed error information
      const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
      
      return new Response(
        JSON.stringify({ 
          error: 'Invalid JSON payload',
          details: `Failed to parse request body as JSON: ${errorMessage}`,
          contentType: req.headers.get('content-type'),
          bodyLength: rawBody.length,
          bodyPreview: rawBody.substring(0, 200),
          troubleshooting: [
            'Ensure WooCommerce webhook is configured to send JSON data',
            'Check that Content-Type header is application/json',
            'Verify the webhook payload format in WooCommerce settings',
            'Test the webhook with a tool like ngrok to inspect the actual payload'
          ]
        }),
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

    // Validate that we have a product with an ID
    if (!product || !product.id) {
      console.error('Invalid product data: missing ID');
      return new Response(
        JSON.stringify({ error: 'Invalid product data: missing ID' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Processing webhook for product ID: ${product.id}, Name: ${product.name}`);

    // Extract produkttype as a simple string
    let produkttype: string | null = null;
    
    if (product.produkttype) {
      if (Array.isArray(product.produkttype) && product.produkttype.length > 0) {
        // Extract name from first element if it's an array
        produkttype = product.produkttype[0]?.name || null;
      } else if (typeof product.produkttype === 'string') {
        produkttype = product.produkttype;
      }
    } else if (product.meta_data && Array.isArray(product.meta_data)) {
      const produkttypeMeta = product.meta_data.find(meta => 
        meta.key === 'produkttype' || meta.key === '_produkttype'
      );
      if (produkttypeMeta && produkttypeMeta.value) {
        if (Array.isArray(produkttypeMeta.value) && produkttypeMeta.value.length > 0) {
          produkttype = produkttypeMeta.value[0]?.name || null;
        } else if (typeof produkttypeMeta.value === 'string') {
          produkttype = produkttypeMeta.value;
        }
      }
    }

    console.log('Extracted produkttype:', produkttype);

    // Prepare data for upsert
    const productData = {
      woocommerce_id: product.id,
      name: product.name,
      sku: product.sku || null,
      stock_quantity: product.stock_quantity || 0,
      stock_status: product.stock_status || 'instock',
      manage_stock: product.manage_stock || false,
      price: product.price || '0',
      regular_price: product.regular_price || '0',
      sale_price: product.sale_price || '',
      permalink: product.permalink || null,
      product_type: product.type || 'simple',
      status: product.status || 'publish',
      date_created: product.date_created ? new Date(product.date_created).toISOString() : null,
      date_modified: product.date_modified ? new Date(product.date_modified).toISOString() : null,
      produkttype: produkttype,
      last_webhook_update: new Date().toISOString()
    };

    console.log('Upserting product data to Supabase...');

    // Upsert the product data into the products table
    const { data, error } = await supabaseAdmin
      .from('products')
      .upsert(productData, {
        onConflict: 'woocommerce_id'
      });

    if (error) {
      console.error('Error upserting product:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to update product in database', details: error.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Successfully updated product ID: ${product.id}`);
    console.log('=== PRODUCT WEBHOOK PROCESSING COMPLETE ===');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Product ${product.id} updated successfully`,
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