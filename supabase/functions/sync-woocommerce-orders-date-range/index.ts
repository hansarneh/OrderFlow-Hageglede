import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface WooCommerceCredentials {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
}

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

interface SyncRequest {
  startDate: string;
  endDate: string;
  pageLimit?: number; // Add optional pageLimit parameter
}

// Helper function to create standardized error responses
function createErrorResponse(message: string, status: number = 500, details?: any): Response {
  console.error(`Error Response (${status}):`, message, details ? JSON.stringify(details) : '');
  
  const errorBody = {
    error: message,
    status,
    timestamp: new Date().toISOString(),
    ...(details && { details })
  };

  return new Response(
    JSON.stringify(errorBody),
    { 
      status, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

// Helper function to validate and normalize store URL
function validateAndNormalizeUrl(storeUrl: string): string {
  try {
    let normalizedUrl = storeUrl.replace(/\/$/, '');
    
    // Add protocol if missing
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }
    
    const url = new URL(normalizedUrl);
    
    // Check for localhost or local IP addresses
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' || 
        hostname === '127.0.0.1' || 
        hostname.startsWith('192.168.') || 
        hostname.startsWith('10.') || 
        hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
      throw new Error('Local URLs (localhost, 127.0.0.1, private IP addresses) cannot be accessed by Supabase Edge Functions. Please use a publicly accessible domain name or set up a tunnel service like ngrok.');
    }
    
    if (!url.hostname || url.hostname.length < 3) {
      throw new Error('Invalid hostname');
    }
    
    return normalizedUrl;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Local URLs')) {
      throw error; // Re-throw our custom error
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid store URL format: ${storeUrl}. Please ensure it's a valid, publicly accessible URL (e.g., https://yourstore.com). Details: ${errorMessage}`);
  }
}

// Helper function to make fetch request with timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 30000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs / 1000} seconds. Please check your store URL and internet connection.`);
    }
    
    if (error instanceof TypeError) {
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Unable to connect to WooCommerce store. Please verify your store URL is correct and accessible from the public internet.');
      }
      const errorMessage = error.message || 'Unknown network error';
      throw new Error(`Network error: ${errorMessage}`);
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Request failed: ${errorMessage}`);
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

// Fetch a single page of WooCommerce orders with date range
async function fetchWooCommerceOrdersPage(baseUrl: string, auth: string, page: number, startDate: string, endDate: string): Promise<{ orders: WooCommerceOrder[], hasMore: boolean }> {
  const apiUrl = `${baseUrl}/wp-json/wc/v3/orders`;
  
  console.log(`--- FETCHING PAGE ${page} ---`);
  
  try {
    // Build URL with date range and status filters
    const params = new URLSearchParams({
      per_page: '100',
      page: page.toString(),
      status: 'processing,delvis-levert',
      after: startDate + 'T00:00:00',
      before: endDate + 'T23:59:59',
      orderby: 'date',
      order: 'desc'
    });
    
    const pageUrl = `${apiUrl}?${params.toString()}`;
    
    console.log(`Page URL: ${pageUrl}`);
    console.log(`Requesting page ${page} with date range ${startDate} to ${endDate}...`);
    
    const wooResponse = await fetchWithTimeout(pageUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'User-Agent': 'LogiFlow/1.0'
      }
    }, 30000);

    if (!wooResponse.ok) {
      const errorText = await wooResponse.text();
      console.error('WooCommerce API error:', wooResponse.status, errorText);
      
      if (wooResponse.status === 401) {
        throw new Error('Invalid WooCommerce credentials. Please check your Consumer Key and Consumer Secret in the Settings.');
      }
      
      if (wooResponse.status === 404) {
        throw new Error('WooCommerce API not found. Please check your store URL and ensure WooCommerce REST API is enabled.');
      }

      if (wooResponse.status === 403) {
        throw new Error('Access forbidden. Please check your WooCommerce API permissions and ensure the API key has read access.');
      }

      if (wooResponse.status >= 500) {
        throw new Error(`WooCommerce server error (${wooResponse.status}). Please try again later or contact your hosting provider.`);
      }

      throw new Error(`WooCommerce API error: ${wooResponse.status} ${wooResponse.statusText}. Response: ${errorText}`);
    }

    let pageOrders: WooCommerceOrder[];
    try {
      pageOrders = await wooResponse.json();
    } catch (parseError) {
      console.error('Error parsing WooCommerce response as JSON:', parseError);
      const responseText = await wooResponse.text();
      console.error('Response text:', responseText.substring(0, 500));
      throw new Error('WooCommerce API returned invalid JSON. This might indicate a server error or misconfigured API endpoint.');
    }

    console.log(`✓ Successfully fetched ${pageOrders.length} orders from page ${page}`);
    
    // Log some sample order info from this page
    if (pageOrders.length > 0) {
      const sampleOrder = pageOrders[0];
      console.log(`Sample order from page ${page}: ID=${sampleOrder.id}, Number=${sampleOrder.number}, Status=${sampleOrder.status}, Date=${sampleOrder.date_created}`);
    }
    
    const hasMore = pageOrders.length === 100; // If we got a full page, there might be more
    
    return {
      orders: pageOrders,
      hasMore: hasMore && pageOrders.length > 0
    };
    
  } catch (error) {
    console.error(`Error fetching orders page ${page}:`, error);
    throw error;
  }
}

// Process orders using the new PostgreSQL function
async function processOrdersBatch(orders: WooCommerceOrder[], supabaseAdmin: any, storeUrl: string): Promise<{ success: number; errors: number }> {
  let successCount = 0;
  let errorCount = 0;

  console.log(`Processing batch of ${orders.length} orders...`);

  for (const wooOrder of orders) {
    try {
      // Determine customer name
      const customerName = wooOrder.billing.company || 
                          `${wooOrder.billing.first_name} ${wooOrder.billing.last_name}`.trim() ||
                          `Customer #${wooOrder.customer_id}`;

      // Calculate total items
      const totalItems = wooOrder.line_items.reduce((sum, item) => sum + item.quantity, 0);

      // Extract additional fields from meta_data and shipping_lines
      const deliveryDate = extractDeliveryDate(wooOrder.meta_data);
      const deliveryType = extractDeliveryType(wooOrder.meta_data);
      const shippingMethodTitle = extractShippingMethodTitle(wooOrder.shipping_lines);
      const billingAddressFormatted = formatBillingAddress(wooOrder.billing);

      console.log(`Processing order ${wooOrder.id}:`);
      console.log('  Customer Name:', customerName);
      console.log('  Total Items:', totalItems);
      console.log('  Delivery Date:', deliveryDate);
      console.log('  Delivery Type:', deliveryType);
      console.log('  Shipping Method:', shippingMethodTitle);
      console.log('  Formatted Address:', billingAddressFormatted);

      // Use the new process_woocommerce_order function
      const { data, error } = await supabaseAdmin.rpc('process_woocommerce_order', {
        p_woocommerce_order_id: wooOrder.id,
        p_order_number: wooOrder.number,
        p_customer_name: customerName,
        p_woo_status: wooOrder.status,
        p_total_value: parseFloat(wooOrder.total),
        p_total_items: totalItems,
        p_date_created: new Date(wooOrder.date_created).toISOString(),
        p_line_items: wooOrder.line_items,
        p_meta_data: wooOrder.meta_data || {},
        p_billing_address: billingAddressFormatted,
        p_billing_address_json: wooOrder.billing,
        p_permalink: `${storeUrl}/wp-admin/post.php?post=${wooOrder.id}&action=edit`,
        p_delivery_date: deliveryDate ? deliveryDate.toISOString().split('T')[0] : null,
        p_delivery_type: deliveryType,
        p_shipping_method_title: shippingMethodTitle
      });

      if (error) {
        console.error(`Error processing order ${wooOrder.id}:`, error);
        errorCount++;
      } else {
        console.log(`Successfully processed order ${wooOrder.id}, internal ID: ${data}`);
        successCount++;
      }
      
    } catch (error) {
      console.error(`Error processing order ${wooOrder.id}:`, error);
      errorCount++;
    }
  }

  console.log(`Batch complete: ${successCount} success, ${errorCount} errors`);
  return { success: successCount, errors: errorCount };
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== EDGE FUNCTION REQUEST RECEIVED ===');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Headers:');
    req.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value}`);
    });

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return createErrorResponse('Missing authorization header', 401);
    }

    console.log('Authorization header present:', !!authHeader);

    // Parse request body for date range
    let syncRequest: SyncRequest;
    try {
      console.log('=== PARSING REQUEST BODY ===');
      const body = await req.text();
      console.log('Raw body received:');
      console.log('  Body length:', body.length);
      console.log('  Body content:', body);
      console.log('  Body type:', typeof body);
      console.log('  Body is empty:', body === '');
      console.log('  Body is null/undefined:', body == null);
      
      if (!body) {
        console.error('Request body is empty or null');
        return createErrorResponse('Missing request body. Expected JSON with startDate and endDate.', 400);
      }
      
      console.log('Attempting to parse JSON...');
      syncRequest = JSON.parse(body);
      console.log('Successfully parsed JSON:');
      console.log('  Parsed object:', JSON.stringify(syncRequest, null, 2));
      console.log('  Type of parsed object:', typeof syncRequest);
      console.log('  Has startDate:', 'startDate' in syncRequest);
      console.log('  Has endDate:', 'endDate' in syncRequest);
      console.log('  Has pageLimit:', 'pageLimit' in syncRequest);
      console.log('  startDate value:', syncRequest.startDate);
      console.log('  endDate value:', syncRequest.endDate);
      console.log('  pageLimit value:', syncRequest.pageLimit);
      
    } catch (error) {
      console.error('=== JSON PARSING ERROR ===');
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      return createErrorResponse('Invalid request body. Expected JSON with startDate and endDate.', 400, {
        parseError: error.message,
        receivedBody: await req.text()
      });
    }

    console.log('=== VALIDATING REQUEST DATA ===');

    // Validate date range
    if (!syncRequest.startDate || !syncRequest.endDate) {
      console.error('Missing date fields:');
      console.error('  startDate:', syncRequest.startDate);
      console.error('  endDate:', syncRequest.endDate);
      return createErrorResponse('Both startDate and endDate are required', 400, {
        received: syncRequest
      });
    }

    // Validate date format and order
    const startDate = new Date(syncRequest.startDate);
    const endDate = new Date(syncRequest.endDate);
    
    console.log('Date validation:');
    console.log('  startDate string:', syncRequest.startDate);
    console.log('  endDate string:', syncRequest.endDate);
    console.log('  startDate parsed:', startDate);
    console.log('  endDate parsed:', endDate);
    console.log('  startDate valid:', !isNaN(startDate.getTime()));
    console.log('  endDate valid:', !isNaN(endDate.getTime()));
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      console.error('Invalid date format');
      return createErrorResponse('Invalid date format. Use YYYY-MM-DD format.', 400, {
        startDate: syncRequest.startDate,
        endDate: syncRequest.endDate,
        startDateParsed: startDate.toString(),
        endDateParsed: endDate.toString()
      });
    }

    if (startDate > endDate) {
      console.error('Start date is after end date');
      return createErrorResponse('Start date must be before or equal to end date', 400);
    }

    // Get pageLimit from request or use default
    const pageLimit = syncRequest.pageLimit || 5; // Default to 5 pages to prevent timeouts
    console.log('Page limit set to:', pageLimit);

    console.log('✓ Request validation passed');

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      console.error('Missing Supabase environment variables');
      return createErrorResponse('Server configuration error: Missing Supabase environment variables', 500);
    }

    // Create Supabase clients
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

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey
    );

    // Verify the user making the request
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('Auth error:', authError);
      return createErrorResponse('Invalid authorization token', 401, authError);
    }

    console.log('✓ User authenticated:', user.id);

    // Get WooCommerce credentials for this user
    const { data: integration, error: integrationError } = await supabaseAdmin
      .from('integrations')
      .select('credentials')
      .eq('user_id', user.id)
      .eq('integration_type', 'woocommerce')
      .maybeSingle();

    if (integrationError) {
      console.error('Error fetching integration:', integrationError);
      return createErrorResponse('Failed to fetch integration settings', 500, integrationError);
    }

    if (!integration || !integration.credentials) {
      return createErrorResponse('WooCommerce integration not configured. Please add your WooCommerce credentials in Settings → Integrations.', 400);
    }

    const credentials = integration.credentials as WooCommerceCredentials;

    // Validate credentials
    if (!credentials.storeUrl || !credentials.consumerKey || !credentials.consumerSecret) {
      return createErrorResponse('Incomplete WooCommerce credentials. Please check your settings and ensure all fields are filled.', 400);
    }

    // Validate and normalize store URL
    let baseUrl: string;
    try {
      baseUrl = validateAndNormalizeUrl(credentials.storeUrl);
      console.log('Validated store URL:', baseUrl);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return createErrorResponse(errorMessage, 400);
    }

    // Create basic auth header
    const auth = btoa(`${credentials.consumerKey}:${credentials.consumerSecret}`);

    console.log('=== STARTING DATE RANGE ORDERS SYNC ===');
    console.log(`Date range: ${syncRequest.startDate} to ${syncRequest.endDate}`);
    console.log(`Page limit: ${pageLimit} pages`);
    console.log('Fetching WooCommerce orders with status: processing, delvis-levert...');
    console.log('Base URL:', baseUrl);

    // Test connection first with a simple API call
    try {
      console.log('Testing WooCommerce API connection...');
      const testUrl = `${baseUrl}/wp-json/wc/v3/orders?per_page=1`;
      const testResponse = await fetchWithTimeout(testUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'User-Agent': 'LogiFlow/1.0'
        }
      }, 10000);

      if (!testResponse.ok) {
        const errorText = await testResponse.text();
        console.error('WooCommerce API test failed:', testResponse.status, errorText);
        
        if (testResponse.status === 401) {
          return createErrorResponse('Invalid WooCommerce credentials. Please check your Consumer Key and Consumer Secret in the Settings.', 401);
        }
        
        if (testResponse.status === 404) {
          return createErrorResponse('WooCommerce API not found. Please check your store URL and ensure WooCommerce REST API is enabled.', 404);
        }

        if (testResponse.status === 403) {
          return createErrorResponse('Access forbidden. Please check your WooCommerce API permissions and ensure the API key has read access.', 403);
        }

        if (testResponse.status >= 500) {
          return createErrorResponse(`WooCommerce server error (${testResponse.status}). Please try again later or contact your hosting provider.`, 502);
        }

        return createErrorResponse(`WooCommerce API error: ${testResponse.status} ${testResponse.statusText}`, testResponse.status, { responseBody: errorText });
      }

      console.log('✓ WooCommerce API connection test successful');
    } catch (error) {
      console.error('WooCommerce API connection test failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return createErrorResponse(`Failed to connect to WooCommerce API: ${errorMessage}`, 502);
    }

    // INCREMENTAL PROCESSING: Fetch and process one page at a time
    let page = 1;
    let hasMoreOrders = true;
    let totalSyncedCount = 0;
    let totalErrorCount = 0;
    let totalOrdersProcessed = 0;

    while (hasMoreOrders && page <= pageLimit) {
      try {
        // Fetch one page of orders with date range
        const { orders: pageOrders, hasMore } = await fetchWooCommerceOrdersPage(
          baseUrl, 
          auth, 
          page, 
          syncRequest.startDate, 
          syncRequest.endDate
        );
        
        if (pageOrders.length === 0) {
          console.log(`No orders found on page ${page}, stopping pagination`);
          hasMoreOrders = false;
          break;
        }

        totalOrdersProcessed += pageOrders.length;
        console.log(`Running total: ${totalOrdersProcessed} orders fetched`);

        // IMMEDIATELY process this page's orders using the new function
        const batchResult = await processOrdersBatch(pageOrders, supabaseAdmin, baseUrl);
        totalSyncedCount += batchResult.success;
        totalErrorCount += batchResult.errors;

        console.log(`Page ${page} complete: ${batchResult.success} synced, ${batchResult.errors} errors`);
        console.log(`Overall progress: ${totalSyncedCount} synced, ${totalErrorCount} errors`);

        // Check if there are more pages
        hasMoreOrders = hasMore;
        page++;

      } catch (error) {
        console.error(`Error processing page ${page}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return createErrorResponse(`Error processing page ${page}: ${errorMessage}`, 500, { page, error: errorMessage });
      }
    }

    console.log(`\n=== DATE RANGE SYNC COMPLETE ===`);
    console.log(`Date range: ${syncRequest.startDate} to ${syncRequest.endDate}`);
    console.log(`Total pages processed: ${page - 1}`);
    console.log(`Total orders processed: ${totalOrdersProcessed}`);
    console.log(`Successfully synced: ${totalSyncedCount} orders`);
    console.log(`Errors: ${totalErrorCount} orders`);

    const message = page > pageLimit 
      ? `Date range sync completed (limited to ${pageLimit} pages): ${totalSyncedCount} orders synced, ${totalErrorCount} errors. Consider using a smaller date range or running the sync again to continue.`
      : `Date range sync completed: ${totalSyncedCount} orders synced, ${totalErrorCount} errors`;

    console.log(message);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message,
        syncedCount: totalSyncedCount,
        errorCount: totalErrorCount,
        totalOrdersProcessed,
        pagesProcessed: page - 1,
        pageLimit,
        dateRange: `${syncRequest.startDate} to ${syncRequest.endDate}`,
        statusFilter: 'processing, delvis-levert',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error in main handler:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Provide more helpful error messages for common issues
    let userFriendlyMessage = errorMessage;
    let statusCode = 500;
    
    if (errorMessage.includes('Failed to fetch') || errorMessage.includes('TypeError: Failed to fetch')) {
      userFriendlyMessage = 'Unable to connect to your WooCommerce store. Please verify that your store URL is publicly accessible and not a local address (localhost, 127.0.0.1, etc.). Check your Settings → Integrations to ensure the store URL is correct.';
      statusCode = 502;
    } else if (errorMessage.includes('Invalid WooCommerce credentials')) {
      userFriendlyMessage = 'Invalid WooCommerce API credentials. Please check your Consumer Key and Consumer Secret in Settings → Integrations.';
      statusCode = 401;
    } else if (errorMessage.includes('Local URLs')) {
      userFriendlyMessage = errorMessage; // Already user-friendly
      statusCode = 400;
    } else if (errorMessage.includes('timeout')) {
      userFriendlyMessage = 'Request timed out while connecting to WooCommerce store. Please check your store URL and try again.';
      statusCode = 504;
    }
    
    return createErrorResponse(
      userFriendlyMessage,
      statusCode,
      {
        originalError: errorMessage !== userFriendlyMessage ? errorMessage : undefined,
        stack: errorStack
      }
    );
  }
});