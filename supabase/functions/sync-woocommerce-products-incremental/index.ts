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

interface WooCommerceProduct {
  id: number;
  name: string;
  sku: string;
  stock_quantity: number | null;
  stock_status: string;
  manage_stock: boolean;
  price: string;
  regular_price: string;
  sale_price: string;
  permalink: string;
  type: string;
  status: string;
  date_created: string;
  date_modified: string;
  produkttype?: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  meta_data?: Array<{
    id: number;
    key: string;
    value: any;
  }>;
}

interface SyncRequest {
  syncType?: 'full' | 'incremental' | 'date-range' | 'missing-products';
  startDate?: string;
  endDate?: string;
  batchSize?: number;
  pageLimit?: number;
  productStatus?: string;
  selectedProducts?: number[];
}

// Helper function to validate and normalize store URL
function validateAndNormalizeUrl(storeUrl: string): string {
  try {
    let normalizedUrl = storeUrl.replace(/\/$/, '');
    
    // For localhost, allow http, otherwise force https
    if (normalizedUrl.includes('localhost') || normalizedUrl.includes('127.0.0.1')) {
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = 'http://' + normalizedUrl;
      }
    } else {
      // Force HTTPS for all non-localhost URLs
      if (normalizedUrl.startsWith('http://')) {
        normalizedUrl = normalizedUrl.replace('http://', 'https://');
      } else if (!normalizedUrl.startsWith('https://')) {
        normalizedUrl = 'https://' + normalizedUrl;
      }
    }
    
    const url = new URL(normalizedUrl);
    
    if (!url.hostname || url.hostname.length < 3) {
      throw new Error('Invalid hostname');
    }
    
    return normalizedUrl;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid store URL format: ${storeUrl}. Please ensure it's a valid URL (e.g., https://yourstore.com). Details: ${errorMessage}`);
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
        throw new Error('Unable to connect to WooCommerce store. Please verify your store URL is correct and accessible.');
      }
      const errorMessage = error.message || 'Unknown network error';
      throw new Error(`Network error: ${errorMessage}`);
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Request failed: ${errorMessage}`);
  }
}

// Get the last sync timestamp from the database
async function getLastSyncTimestamp(supabaseAdmin: any): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('last_webhook_update')
      .order('last_webhook_update', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.log('No previous sync found, will perform full sync');
      return null;
    }

    return data.last_webhook_update;
  } catch (error) {
    console.warn('Error getting last sync timestamp:', error);
    return null;
  }
}

// Build WooCommerce API URL with filters
function buildApiUrl(baseUrl: string, syncType: string, startDate?: string, endDate?: string, page: number = 1, perPage: number = 50, productStatus?: string): string {
  const apiUrl = `${baseUrl}/wp-json/wc/v3/products`;
  const params = new URLSearchParams({
    per_page: perPage.toString(),
    page: page.toString(),
    orderby: 'date',
    order: 'desc'
  });

  if (syncType === 'incremental' && startDate) {
    // For incremental sync, get products modified after the last sync
    params.append('modified_after', startDate);
  } else if (syncType === 'date-range' && startDate) {
    // For date range sync
    params.append('after', startDate);
    if (endDate) {
      params.append('before', endDate);
    }
  }

  // Add product status filter if specified
  if (productStatus && productStatus !== 'any') {
    params.append('status', productStatus);
  }

  return `${apiUrl}?${params.toString()}`;
}

// Fetch specific products by IDs
async function fetchProductsByIds(baseUrl: string, auth: string, productIds: number[]): Promise<WooCommerceProduct[]> {
  const apiUrl = `${baseUrl}/wp-json/wc/v3/products`;
  const products: WooCommerceProduct[] = [];

  // WooCommerce API doesn't support fetching multiple products by ID in a single request
  // So we need to fetch them individually or in small batches
  console.log(`Fetching ${productIds.length} specific products...`);

  for (const productId of productIds) {
    try {
      const response = await fetchWithTimeout(`${apiUrl}/${productId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'User-Agent': 'LogiFlow/1.0'
        }
      }, 10000); // Shorter timeout for individual requests

      if (response.ok) {
        const product: WooCommerceProduct = await response.json();
        products.push(product);
        console.log(`Fetched product ${productId}: ${product.name}`);
      } else {
        console.warn(`Failed to fetch product ${productId}: ${response.status}`);
      }
    } catch (error) {
      console.warn(`Error fetching product ${productId}:`, error);
    }
  }

  console.log(`Successfully fetched ${products.length} out of ${productIds.length} requested products`);
  return products;
}

// Process products in batches to avoid memory issues
async function processBatch(products: WooCommerceProduct[], supabaseAdmin: any): Promise<{ success: number; errors: number }> {
  let successCount = 0;
  let errorCount = 0;

  // Process products in smaller chunks to avoid overwhelming the database
  const chunkSize = 10;
  for (let i = 0; i < products.length; i += chunkSize) {
    const chunk = products.slice(i, i + chunkSize);
    
    try {
      const upsertData = chunk.map(wooProduct => {
        // Extract produkttype as a simple string
        let produkttype: string | null = null;
        
        if (wooProduct.produkttype && Array.isArray(wooProduct.produkttype) && wooProduct.produkttype.length > 0) {
          // Extract name from first element if it's an array
          produkttype = wooProduct.produkttype[0]?.name || null;
        } else if (wooProduct.meta_data && Array.isArray(wooProduct.meta_data)) {
          const produkttypeMeta = wooProduct.meta_data.find(meta => 
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

        return {
          woocommerce_id: wooProduct.id,
          name: wooProduct.name,
          sku: wooProduct.sku || null,
          stock_quantity: wooProduct.stock_quantity || 0,
          stock_status: wooProduct.stock_status || 'instock',
          manage_stock: wooProduct.manage_stock || false,
          price: wooProduct.price || '0',
          regular_price: wooProduct.regular_price || '0',
          sale_price: wooProduct.sale_price || '',
          permalink: wooProduct.permalink || null,
          product_type: wooProduct.type || 'simple',
          status: wooProduct.status || 'publish',
          date_created: wooProduct.date_created ? new Date(wooProduct.date_created).toISOString() : null,
          date_modified: wooProduct.date_modified ? new Date(wooProduct.date_modified).toISOString() : null,
          produkttype: produkttype, // Store as simple string
          last_webhook_update: new Date().toISOString()
        };
      });

      const { error: upsertError } = await supabaseAdmin
        .from('products')
        .upsert(upsertData, {
          onConflict: 'woocommerce_id'
        });

      if (upsertError) {
        console.error(`Error upserting chunk:`, upsertError);
        errorCount += chunk.length;
      } else {
        successCount += chunk.length;
        console.log(`Successfully processed chunk of ${chunk.length} products`);
      }
    } catch (error) {
      console.error(`Error processing chunk:`, error);
      errorCount += chunk.length;
    }
  }

  return { success: successCount, errors: errorCount };
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse request body for sync options
    let syncRequest: SyncRequest = {};
    try {
      const body = await req.text();
      if (body) {
        syncRequest = JSON.parse(body);
      }
    } catch (error) {
      console.warn('Failed to parse request body, using defaults');
    }

    // Set defaults
    const syncType = syncRequest.syncType || 'incremental';
    const batchSize = Math.min(syncRequest.batchSize || 50, 100); // Max 100 per page
    const pageLimit = syncRequest.pageLimit || 50; // Max 50 pages per sync
    const productStatus = syncRequest.productStatus || 'any';

    console.log(`Starting ${syncType} sync with batch size ${batchSize}, page limit ${pageLimit}, status filter: ${productStatus}`);

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
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
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get WooCommerce credentials for this user
    const { data: integration, error: integrationError } = await supabaseAdmin
      .from('integrations')
      .select('credentials')
      .eq('user_id', user.id)
      .eq('integration_type', 'woocommerce')
      .maybeSingle();

    if (integrationError) {
      console.error('Error fetching integration:', integrationError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch integration settings' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!integration || !integration.credentials) {
      return new Response(
        JSON.stringify({ error: 'WooCommerce integration not configured. Please add your WooCommerce credentials in Settings.' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const credentials = integration.credentials as WooCommerceCredentials;

    // Validate credentials
    if (!credentials.storeUrl || !credentials.consumerKey || !credentials.consumerSecret) {
      return new Response(
        JSON.stringify({ error: 'Incomplete WooCommerce credentials. Please check your settings.' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate and normalize store URL
    let baseUrl: string;
    try {
      baseUrl = validateAndNormalizeUrl(credentials.storeUrl);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create basic auth header
    const auth = btoa(`${credentials.consumerKey}:${credentials.consumerSecret}`);

    let totalSyncedCount = 0;
    let totalErrorCount = 0;
    let pagesProcessed = 0;

    // Handle missing-products sync type
    if (syncType === 'missing-products' && syncRequest.selectedProducts && syncRequest.selectedProducts.length > 0) {
      console.log(`Syncing ${syncRequest.selectedProducts.length} selected missing products...`);
      
      try {
        const products = await fetchProductsByIds(baseUrl, auth, syncRequest.selectedProducts);
        const batchResult = await processBatch(products, supabaseAdmin);
        totalSyncedCount = batchResult.success;
        totalErrorCount = batchResult.errors;
        pagesProcessed = 1; // Not really pages, but individual product fetches

        const message = `Missing products sync completed: ${totalSyncedCount} products synced, ${totalErrorCount} errors`;
        console.log(message);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message,
            syncType,
            syncedCount: totalSyncedCount,
            errorCount: totalErrorCount,
            pagesProcessed,
            selectedProductsCount: syncRequest.selectedProducts.length,
            timestamp: new Date().toISOString()
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      } catch (error) {
        console.error('Error syncing missing products:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new Response(
          JSON.stringify({ error: errorMessage }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Determine sync date range for other sync types
    let startDate = syncRequest.startDate;
    let endDate = syncRequest.endDate;

    if (syncType === 'incremental' && !startDate) {
      const lastSync = await getLastSyncTimestamp(supabaseAdmin);
      if (lastSync) {
        startDate = lastSync;
        console.log(`Incremental sync from: ${startDate}`);
      } else {
        console.log('No previous sync found, performing full sync');
        // Don't set startDate for full sync
      }
    }

    console.log(`Fetching products from WooCommerce (${syncType} sync)...`);
    console.log('Base URL:', baseUrl);
    if (startDate) console.log('Start date:', startDate);
    if (endDate) console.log('End date:', endDate);

    // Fetch products using pagination with date filters
    let page = 1;
    let hasMoreProducts = true;

    while (hasMoreProducts && page <= pageLimit) {
      console.log(`Fetching page ${page}...`);
      
      try {
        const apiUrl = buildApiUrl(baseUrl, syncType, startDate, endDate, page, batchSize, productStatus);
        console.log(`API URL: ${apiUrl}`);

        const wooResponse = await fetchWithTimeout(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
            'User-Agent': 'LogiFlow/1.0'
          }
        }, 30000); // 30 second timeout

        if (!wooResponse.ok) {
          const errorText = await wooResponse.text();
          console.error('WooCommerce API error:', wooResponse.status, errorText);
          
          if (wooResponse.status === 401) {
            return new Response(
              JSON.stringify({ error: 'Invalid WooCommerce credentials. Please check your Consumer Key and Consumer Secret.' }),
              { 
                status: 400, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            );
          }
          
          if (wooResponse.status === 404) {
            return new Response(
              JSON.stringify({ error: 'WooCommerce API not found. Please check your store URL and ensure WooCommerce REST API is enabled.' }),
              { 
                status: 400, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            );
          }

          if (wooResponse.status === 403) {
            return new Response(
              JSON.stringify({ error: 'Access forbidden. Please check your WooCommerce API permissions and ensure the Consumer Key has read access to products.' }),
              { 
                status: 400, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            );
          }

          return new Response(
            JSON.stringify({ error: `WooCommerce API error: ${wooResponse.status} ${wooResponse.statusText}. ${errorText}` }),
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        const pageProducts: WooCommerceProduct[] = await wooResponse.json();
        console.log(`Fetched ${pageProducts.length} products from page ${page}`);
        
        if (pageProducts.length === 0) {
          hasMoreProducts = false;
        } else {
          // Process this batch immediately to avoid memory issues
          const batchResult = await processBatch(pageProducts, supabaseAdmin);
          totalSyncedCount += batchResult.success;
          totalErrorCount += batchResult.errors;
          
          console.log(`Page ${page} processed: ${batchResult.success} success, ${batchResult.errors} errors`);
          
          page++;
          pagesProcessed++;
        }
      } catch (error) {
        console.error(`Error fetching page ${page}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new Response(
          JSON.stringify({ error: errorMessage }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    const message = page > pageLimit 
      ? `Sync completed (limited to ${pageLimit} pages): ${totalSyncedCount} products synced, ${totalErrorCount} errors`
      : `Sync completed: ${totalSyncedCount} products synced, ${totalErrorCount} errors`;

    console.log(message);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message,
        syncType,
        syncedCount: totalSyncedCount,
        errorCount: totalErrorCount,
        pagesProcessed,
        pageLimit,
        batchSize,
        productStatus,
        startDate,
        endDate,
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