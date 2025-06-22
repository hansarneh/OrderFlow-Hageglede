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
}

interface MissingProduct {
  id: number;
  name: string;
  sku: string;
  status: string;
  type: string;
  stock_quantity: number;
  price: string;
  date_created: string;
  date_modified: string;
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

// Fetch all WooCommerce products
async function fetchAllWooCommerceProducts(baseUrl: string, auth: string): Promise<WooCommerceProduct[]> {
  const apiUrl = `${baseUrl}/wp-json/wc/v3/products`;
  let allProducts: WooCommerceProduct[] = [];
  let page = 1;
  let hasMoreProducts = true;

  console.log('Fetching all WooCommerce products...');

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
      }, 30000);

      if (!wooResponse.ok) {
        const errorText = await wooResponse.text();
        console.error('WooCommerce API error:', wooResponse.status, errorText);
        
        if (wooResponse.status === 401) {
          throw new Error('Invalid WooCommerce credentials. Please check your Consumer Key and Consumer Secret.');
        }
        
        if (wooResponse.status === 404) {
          throw new Error('WooCommerce API not found. Please check your store URL and ensure WooCommerce REST API is enabled.');
        }

        if (wooResponse.status === 403) {
          throw new Error('Access forbidden. Please check your WooCommerce API permissions.');
        }

        throw new Error(`WooCommerce API error: ${wooResponse.status} ${wooResponse.statusText}`);
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
      throw error;
    }
  }

  console.log(`Total WooCommerce products fetched: ${allProducts.length}`);
  return allProducts;
}

// Get existing product IDs from Supabase
async function getExistingProductIds(supabaseAdmin: any): Promise<Set<number>> {
  console.log('Fetching existing product IDs from Supabase...');
  
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('woocommerce_id');

  if (error) {
    console.error('Error fetching existing products:', error);
    throw new Error('Failed to fetch existing products from database');
  }

  // Convert to Set of numbers and filter out any null/undefined values
  const existingIds = new Set<number>();
  
  if (data && Array.isArray(data)) {
    data.forEach((product: any) => {
      if (product.woocommerce_id && typeof product.woocommerce_id === 'number') {
        existingIds.add(product.woocommerce_id);
      }
    });
  }
  
  console.log(`Found ${existingIds.size} existing products in Supabase`);
  console.log('Sample existing IDs:', Array.from(existingIds).slice(0, 10));
  
  return existingIds;
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

    // Create basic auth header
    const auth = btoa(`${credentials.consumerKey}:${credentials.consumerSecret}`);

    console.log('Starting product audit...');

    // Fetch all products from WooCommerce
    const wooCommerceProducts = await fetchAllWooCommerceProducts(baseUrl, auth);
    console.log(`WooCommerce products sample IDs:`, wooCommerceProducts.slice(0, 10).map(p => p.id));

    // Get existing product IDs from Supabase
    const existingProductIds = await getExistingProductIds(supabaseAdmin);

    // Find missing products with detailed logging
    console.log('Comparing products...');
    const missingProducts: MissingProduct[] = [];
    const existingProducts: number[] = [];

    for (const wooProduct of wooCommerceProducts) {
      if (existingProductIds.has(wooProduct.id)) {
        existingProducts.push(wooProduct.id);
      } else {
        missingProducts.push({
          id: wooProduct.id,
          name: wooProduct.name,
          sku: wooProduct.sku || '',
          status: wooProduct.status,
          type: wooProduct.type,
          stock_quantity: wooProduct.stock_quantity || 0,
          price: wooProduct.price || '0',
          date_created: wooProduct.date_created,
          date_modified: wooProduct.date_modified
        });
      }
    }

    // Sort missing products by name
    missingProducts.sort((a, b) => a.name.localeCompare(b.name));

    console.log(`Audit completed:`);
    console.log(`- Total WooCommerce products: ${wooCommerceProducts.length}`);
    console.log(`- Total Supabase products: ${existingProductIds.size}`);
    console.log(`- Products found in both: ${existingProducts.length}`);
    console.log(`- Missing products: ${missingProducts.length}`);
    console.log(`Sample missing product IDs:`, missingProducts.slice(0, 10).map(p => p.id));

    return new Response(
      JSON.stringify({ 
        success: true,
        totalWooProducts: wooCommerceProducts.length,
        totalSupabaseProducts: existingProductIds.size,
        existingProductsCount: existingProducts.length,
        missingProducts: missingProducts,
        auditTimestamp: new Date().toISOString(),
        debugInfo: {
          sampleWooIds: wooCommerceProducts.slice(0, 5).map(p => p.id),
          sampleSupabaseIds: Array.from(existingProductIds).slice(0, 5),
          sampleMissingIds: missingProducts.slice(0, 5).map(p => p.id)
        }
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