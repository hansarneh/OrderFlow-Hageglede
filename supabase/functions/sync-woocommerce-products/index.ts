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

// Helper function to validate and normalize store URL
function validateAndNormalizeUrl(storeUrl: string): string {
  try {
    // Remove trailing slash
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
    
    // Validate URL format
    const url = new URL(normalizedUrl);
    
    // Basic validation - must have a valid hostname
    if (!url.hostname || url.hostname.length < 3) {
      throw new Error('Invalid hostname');
    }
    
    return normalizedUrl;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid store URL format: ${storeUrl}. Please ensure it's a valid URL (e.g., https://yourstore.com). Details: ${errorMessage}`);
  }
}

// Helper function to make fetch request with timeout and better error handling
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

    const apiUrl = `${baseUrl}/wp-json/wc/v3/products`;
    
    // Create basic auth header
    const auth = btoa(`${credentials.consumerKey}:${credentials.consumerSecret}`);
    
    console.log('Fetching products from WooCommerce...');
    console.log('API URL:', apiUrl);

    // Fetch ALL products using pagination
    let allProducts: WooCommerceProduct[] = [];
    let page = 1;
    let hasMoreProducts = true;

    while (hasMoreProducts) {
      console.log(`Fetching page ${page}...`);
      
      try {
        const wooResponse = await fetchWithTimeout(`${apiUrl}?per_page=100&page=${page}`, {
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
          allProducts = allProducts.concat(pageProducts);
          page++;
          
          // Safety check to prevent infinite loops
          if (page > 100) {
            console.warn('Reached maximum page limit (100), stopping pagination');
            hasMoreProducts = false;
          }
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

    console.log(`Total products fetched: ${allProducts.length}`);

    // Process and upsert products to Supabase
    let syncedCount = 0;
    let errorCount = 0;

    for (const wooProduct of allProducts) {
      try {
        // Extract produkttype as a simple string
        let produkttype: string | null = null;
        
        // Check if produkttype is directly available as an array
        if (wooProduct.produkttype && Array.isArray(wooProduct.produkttype) && wooProduct.produkttype.length > 0) {
          produkttype = wooProduct.produkttype[0]?.name || null;
        }
        // Check in meta_data for produkttype
        else if (wooProduct.meta_data && Array.isArray(wooProduct.meta_data)) {
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

        const { error: upsertError } = await supabaseAdmin
          .from('products')
          .upsert({
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
          }, {
            onConflict: 'woocommerce_id'
          });

        if (upsertError) {
          console.error(`Error upserting product ${wooProduct.id}:`, upsertError);
          errorCount++;
        } else {
          syncedCount++;
        }
      } catch (error) {
        console.error(`Error processing product ${wooProduct.id}:`, error);
        errorCount++;
      }
    }

    console.log(`Sync completed: ${syncedCount} products synced, ${errorCount} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully synced ${syncedCount} products from WooCommerce`,
        syncedCount,
        errorCount,
        totalProducts: allProducts.length
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