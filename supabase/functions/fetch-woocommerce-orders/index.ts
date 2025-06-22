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
  discount_total: string;
  discount_tax: string;
  shipping_total: string;
  shipping_tax: string;
  cart_tax: string;
  total: string;
  total_tax: string;
  customer_id: number;
  order_key: string;
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
  shipping: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  payment_method: string;
  payment_method_title: string;
  transaction_id: string;
  customer_ip_address: string;
  customer_user_agent: string;
  created_via: string;
  customer_note: string;
  date_completed: string | null;
  date_paid: string | null;
  cart_hash: string;
  number_formatted: string;
  meta_data: any[];
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
    taxes: any[];
    meta_data: any[];
    sku: string;
    price: number;
  }>;
  tax_lines: any[];
  shipping_lines: any[];
  fee_lines: any[];
  coupon_lines: any[];
  refunds: any[];
  payment_url: string;
  is_editable: boolean;
  needs_payment: boolean;
  needs_processing: boolean;
  date_created_gmt: string;
  date_modified_gmt: string;
  date_completed_gmt: string | null;
  date_paid_gmt: string | null;
  currency_symbol: string;
}

interface CustomerOrder {
  id: string;
  orderNumber: string;
  customer: string;
  wooStatus: string;
  relatedPOs: string[];
  expectedShipDates: string[];
  multipleShipments: boolean;
  status: 'fully-planned' | 'partially-planned' | 'at-risk';
  priority: 'high' | 'medium' | 'low';
  value: number;
  items: number;
  createdDate: string;
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

    // Prepare WooCommerce API request
    const apiUrl = `${baseUrl}/wp-json/wc/v3/orders`;
    
    // Create basic auth header
    const auth = btoa(`${credentials.consumerKey}:${credentials.consumerSecret}`);
    
    console.log('Fetching orders from:', apiUrl);

    // Fetch ALL orders using pagination
    let allOrders: WooCommerceOrder[] = [];
    let page = 1;
    let hasMoreOrders = true;

    while (hasMoreOrders) {
      console.log(`Fetching page ${page}...`);
      
      const wooResponse = await fetchWithTimeout(`${apiUrl}?per_page=100&page=${page}&status=processing,on-hold`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'User-Agent': 'LogiFlow/1.0'
        }
      });

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
            JSON.stringify({ error: 'WooCommerce API not found. Please check your store URL.' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        return new Response(
          JSON.stringify({ error: `WooCommerce API error: ${wooResponse.status} ${wooResponse.statusText}` }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const pageOrders: WooCommerceOrder[] = await wooResponse.json();
      console.log(`Fetched ${pageOrders.length} orders from page ${page}`);
      
      if (pageOrders.length === 0) {
        hasMoreOrders = false;
      } else {
        allOrders = allOrders.concat(pageOrders);
        page++;
        
        // Safety check to prevent infinite loops
        if (page > 100) {
          console.warn('Reached maximum page limit (100), stopping pagination');
          hasMoreOrders = false;
        }
      }
    }

    console.log(`Total orders fetched: ${allOrders.length}`);

    // Map WooCommerce orders to our CustomerOrder interface
    const customerOrders: CustomerOrder[] = allOrders.map((wooOrder) => {
      // Determine customer name
      const customerName = wooOrder.billing.company || 
                          `${wooOrder.billing.first_name} ${wooOrder.billing.last_name}`.trim() ||
                          `Customer #${wooOrder.customer_id}`;

      // Map WooCommerce status to our status
      let status: 'fully-planned' | 'partially-planned' | 'at-risk';
      switch (wooOrder.status) {
        case 'processing':
          status = 'fully-planned';
          break;
        case 'on-hold':
          status = 'partially-planned';
          break;
        default:
          status = 'partially-planned';
      }

      // Determine priority based on order value
      const orderValue = parseFloat(wooOrder.total);
      let priority: 'high' | 'medium' | 'low';
      if (orderValue > 1000) {
        priority = 'high';
      } else if (orderValue > 500) {
        priority = 'medium';
      } else {
        priority = 'low';
      }

      // Calculate total items
      const totalItems = wooOrder.line_items.reduce((sum, item) => sum + item.quantity, 0);

      // Generate placeholder data for fields not available in WooCommerce
      const relatedPOs = ['1017', '1031', '1034'].slice(0, Math.floor(Math.random() * 3) + 1);
      const expectedShipDates = status === 'at-risk' 
        ? ['OVERDUE - ' + new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })]
        : status === 'partially-planned'
        ? ['01/03/2026', '01/04/2026', 'PO MISSING']
        : ['01/03/2026', '01/04/2026', '01/05/2026'];

      return {
        id: wooOrder.id.toString(),
        orderNumber: wooOrder.number,
        customer: customerName,
        wooStatus: wooOrder.status, // Add original WooCommerce status
        relatedPOs,
        expectedShipDates,
        multipleShipments: totalItems > 5, // Assume multiple shipments for larger orders
        status,
        priority,
        value: orderValue,
        items: totalItems,
        createdDate: new Date(wooOrder.date_created).toISOString().split('T')[0]
      };
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        orders: customerOrders,
        totalCount: customerOrders.length 
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