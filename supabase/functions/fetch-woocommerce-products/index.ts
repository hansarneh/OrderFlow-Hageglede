import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
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
  total: string;
  date_created: string;
  billing: {
    first_name: string;
    last_name: string;
    company: string;
  };
  line_items: Array<{
    id: number;
    name: string;
    product_id: number;
    quantity: number;
    total: string;
    sku: string;
  }>;
  meta_data: Array<{
    id: number;
    key: string;
    value: string;
  }>;
}

interface BackorderedProduct {
  id: number;
  name: string;
  sku: string;
  stockQuantity: number;
  stockStatus: string;
  manageStock: boolean;
  price: string;
  regularPrice: string;
  salePrice: string;
  categories: Array<{ id: number; name: string; slug: string }>;
  images: Array<{ id: number; src: string; name: string; alt: string }>;
  permalink: string;
  dateCreated: string;
  dateModified: string;
  type: string;
  status: string;
  productType?: string | null; // Changed from array to string
  rawTaxonomies?: any;
  totalOrderValue?: number;
  affectedOrders?: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    orderValue: number;
    orderDate: string;
    wooCommerceUrl: string;
    deliveryDate?: string;
    isOverdue?: boolean;
  }>;
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

async function fetchWooCommerceOrders(storeUrl: string, auth: string): Promise<WooCommerceOrder[]> {
  const ordersUrl = `${storeUrl}/wp-json/wc/v3/orders`;
  let allOrders: WooCommerceOrder[] = [];
  let page = 1;
  let hasMoreOrders = true;

  console.log('Fetching WooCommerce orders...');

  while (hasMoreOrders && page <= 10) { // Limit to 10 pages for performance
    console.log(`Fetching orders page ${page}...`);
    
    // Fetch orders from last 90 days with processing/on-hold status
    const pageUrl = `${ordersUrl}?per_page=100&page=${page}&status=processing,on-hold,pending&after=${new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()}`;
    
    try {
      const response = await fetchWithTimeout(pageUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          'User-Agent': 'Supabase-Edge-Function/1.0'
        }
      }, 30000);

      if (!response.ok) {
        console.error(`Orders API error on page ${page}:`, response.status);
        break;
      }

      const pageOrders: WooCommerceOrder[] = await response.json();
      console.log(`Fetched ${pageOrders.length} orders from page ${page}`);
      
      if (pageOrders.length === 0) {
        hasMoreOrders = false;
      } else {
        allOrders = allOrders.concat(pageOrders);
        page++;
      }
    } catch (error) {
      console.error(`Error fetching orders page ${page}:`, error);
      break;
    }
  }

  console.log(`Total orders fetched: ${allOrders.length}`);
  return allOrders;
}

function parseDeliveryDate(dateString: string): Date | null {
  try {
    // Handle DD.MM.YYYY format (e.g., "30.08.2025")
    if (dateString.includes('.')) {
      const parts = dateString.split('.');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed in JavaScript
        const year = parseInt(parts[2], 10);
        
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          return new Date(year, month, day);
        }
      }
    }
    
    // Try parsing as ISO date or other standard formats
    const parsed = new Date(dateString);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to parse delivery date:', dateString, error);
    return null;
  }
}

function findAffectedOrders(product: any, orders: WooCommerceOrder[], storeUrl: string) {
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0); // Set to start of day for comparison
  
  const affectedOrders = orders.filter(order => {
    return order.line_items.some(item => 
      item.product_id === product.id || 
      (item.sku && product.sku && item.sku === product.sku)
    );
  }).map(order => {
    // Calculate the total value for this specific product in this order
    const productLineItems = order.line_items.filter(item => 
      item.product_id === product.id || 
      (item.sku && product.sku && item.sku === product.sku)
    );
    
    const productOrderValue = productLineItems.reduce((sum, item) => {
      return sum + parseFloat(item.total || '0');
    }, 0);

    // Determine customer name
    const customerName = order.billing.company || 
                        `${order.billing.first_name} ${order.billing.last_name}`.trim() ||
                        `Customer #${order.id}`;

    // Extract delivery date from meta_data
    let deliveryDate: string | undefined;
    let isOverdue = false;
    
    if (order.meta_data && Array.isArray(order.meta_data)) {
      const deliveryDateMeta = order.meta_data.find(meta => meta.key === '_delivery_date');
      if (deliveryDateMeta && deliveryDateMeta.value) {
        deliveryDate = deliveryDateMeta.value;
        
        // Parse the delivery date and check if it's overdue
        const parsedDeliveryDate = parseDeliveryDate(deliveryDateMeta.value);
        if (parsedDeliveryDate) {
          isOverdue = parsedDeliveryDate < currentDate;
        }
      }
    }

    return {
      id: order.id.toString(),
      orderNumber: order.number,
      customerName,
      orderValue: Math.round(productOrderValue), // Convert to NOK (assuming WooCommerce is already in NOK)
      orderDate: new Date(order.date_created).toLocaleDateString('no-NO'),
      wooCommerceUrl: `${storeUrl}/wp-admin/post.php?post=${order.id}&action=edit`,
      deliveryDate,
      isOverdue
    };
  });

  return affectedOrders;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get the current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      console.error('User authentication failed:', userError);
      return new Response(
        JSON.stringify({ error: 'User not authenticated' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Authenticated user:', user.id);

    // Get WooCommerce credentials from the integrations table
    const { data: integration, error: integrationError } = await supabaseClient
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

    if (!integration?.credentials) {
      console.error('No WooCommerce integration found for user');
      return new Response(
        JSON.stringify({ error: 'WooCommerce integration not configured. Please set up your WooCommerce credentials in Settings.' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const credentials = integration.credentials as WooCommerceCredentials;
    console.log('WooCommerce credentials loaded for store:', credentials.storeUrl);

    // Validate credentials
    if (!credentials.storeUrl || !credentials.consumerKey || !credentials.consumerSecret) {
      console.error('Incomplete WooCommerce credentials');
      return new Response(
        JSON.stringify({ error: 'Incomplete WooCommerce credentials. Please check your settings.' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate and normalize store URL
    let storeUrl: string;
    try {
      storeUrl = validateAndNormalizeUrl(credentials.storeUrl);
    } catch (urlError) {
      console.error('Invalid store URL:', credentials.storeUrl, urlError);
      const errorMessage = urlError instanceof Error ? urlError.message : String(urlError);
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create basic auth header for WooCommerce API
    const auth = btoa(`${credentials.consumerKey}:${credentials.consumerSecret}`);
    
    // Fetch ALL products using pagination to find backordered items
    const apiUrl = `${storeUrl}/wp-json/wc/v3/products`;
    let allProducts: any[] = [];
    let page = 1;
    let hasMoreProducts = true;

    console.log('Starting to fetch all products from WooCommerce...');

    while (hasMoreProducts) {
      console.log(`Fetching products page ${page}...`);
      
      const pageUrl = `${apiUrl}?per_page=100&page=${page}&status=publish`;
      
      let wooResponse: Response;
      try {
        wooResponse = await fetchWithTimeout(pageUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json',
            'User-Agent': 'Supabase-Edge-Function/1.0'
          }
        }, 30000);
      } catch (fetchError) {
        console.error('Network error connecting to WooCommerce:', fetchError);
        
        let errorMessage = 'Failed to connect to WooCommerce store. ';
        if (fetchError instanceof TypeError) {
          errorMessage += 'Please check that your store URL is correct and accessible.';
        } else if (fetchError.name === 'AbortError') {
          errorMessage += 'Request timed out. Your store may be slow to respond.';
        } else {
          errorMessage += 'Network connectivity issue.';
        }

        return new Response(
          JSON.stringify({ 
            error: errorMessage,
            details: fetchError instanceof Error ? fetchError.message : String(fetchError),
            storeUrl: storeUrl
          }),
          { 
            status: 503, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log(`Page ${page} response status:`, wooResponse.status);

      if (!wooResponse.ok) {
        const errorText = await wooResponse.text();
        console.error('WooCommerce API error:', wooResponse.status, errorText);
        
        let errorMessage = 'WooCommerce API request failed. ';
        if (wooResponse.status === 401) {
          errorMessage += 'Invalid API credentials. Please check your Consumer Key and Consumer Secret.';
        } else if (wooResponse.status === 404) {
          errorMessage += 'WooCommerce REST API not found. Please ensure WooCommerce is installed and the REST API is enabled.';
        } else if (wooResponse.status === 403) {
          errorMessage += 'Access forbidden. Please check your API key permissions.';
        } else {
          errorMessage += `Server returned status ${wooResponse.status}.`;
        }

        return new Response(
          JSON.stringify({ 
            error: errorMessage,
            status: wooResponse.status,
            details: errorText
          }),
          { 
            status: wooResponse.status, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      let pageProducts: any[];
      try {
        pageProducts = await wooResponse.json();
      } catch (parseError) {
        console.error('Error parsing WooCommerce response:', parseError);
        return new Response(
          JSON.stringify({ error: 'Invalid response from WooCommerce API' }),
          { 
            status: 502, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log(`Fetched ${pageProducts.length} products from page ${page}`);
      
      if (pageProducts.length === 0) {
        hasMoreProducts = false;
      } else {
        allProducts = allProducts.concat(pageProducts);
        page++;
        
        if (page > 50) {
          console.warn('Reached maximum page limit (50), stopping pagination');
          hasMoreProducts = false;
        }
      }
    }

    console.log(`Total products fetched: ${allProducts.length}`);

    // Filter for backordered products (only negative stock quantities)
    const backorderedProducts = allProducts.filter(product => {
      return product.stock_quantity < 0;
    });

    console.log(`Found ${backorderedProducts.length} backordered products`);

    // Fetch orders to match with backordered products
    let allOrders: WooCommerceOrder[] = [];
    if (backorderedProducts.length > 0) {
      console.log('Fetching orders to match with backordered products...');
      allOrders = await fetchWooCommerceOrders(storeUrl, auth);
    }

    // Process backordered products and match with orders
    const processedProducts: BackorderedProduct[] = backorderedProducts.map((wooProduct) => {
      // Extract produkttype as a simple string
      let productType: string | null = null;
      
      if (wooProduct.produkttype) {
        if (Array.isArray(wooProduct.produkttype) && wooProduct.produkttype.length > 0) {
          // Extract name from first element if it's an array
          productType = wooProduct.produkttype[0]?.name || null;
        } else if (typeof wooProduct.produkttype === 'string') {
          productType = wooProduct.produkttype;
        }
      } else if (wooProduct.meta_data && Array.isArray(wooProduct.meta_data)) {
        const produkttypeMeta = wooProduct.meta_data.find((meta: any) => 
          meta.key && meta.key.toLowerCase().includes('produkttype')
        );
        if (produkttypeMeta && produkttypeMeta.value) {
          if (Array.isArray(produkttypeMeta.value) && produkttypeMeta.value.length > 0) {
            productType = produkttypeMeta.value[0]?.name || null;
          } else if (typeof produkttypeMeta.value === 'string') {
            productType = produkttypeMeta.value;
          }
        }
      }

      // Find affected orders for this product
      const affectedOrders = findAffectedOrders(wooProduct, allOrders, storeUrl);
      
      // Calculate total order value from affected orders
      const totalOrderValue = affectedOrders.reduce((sum, order) => sum + order.orderValue, 0);

      const rawTaxonomies = {
        produkttype: wooProduct.produkttype,
        product_type: wooProduct.product_type,
        meta_data_keys: wooProduct.meta_data ? wooProduct.meta_data.map((meta: any) => meta.key) : [],
        all_array_fields: Object.keys(wooProduct).filter(key => Array.isArray(wooProduct[key]))
      };

      return {
        id: wooProduct.id,
        name: wooProduct.name,
        sku: wooProduct.sku || '',
        stockQuantity: wooProduct.stock_quantity || 0,
        stockStatus: wooProduct.stock_status,
        manageStock: wooProduct.manage_stock || false,
        price: wooProduct.price || '0',
        regularPrice: wooProduct.regular_price || '0',
        salePrice: wooProduct.sale_price || '',
        categories: wooProduct.categories || [],
        images: wooProduct.images || [],
        permalink: wooProduct.permalink || '',
        dateCreated: wooProduct.date_created || '',
        dateModified: wooProduct.date_modified || '',
        type: wooProduct.type || 'simple',
        status: wooProduct.status || 'publish',
        productType: productType, // Changed from productTypes array to single string
        rawTaxonomies: rawTaxonomies,
        totalOrderValue: totalOrderValue,
        affectedOrders: affectedOrders
      };
    })
    .sort((a, b) => {
      if (a.stockQuantity === b.stockQuantity) {
        return a.name.localeCompare(b.name);
      }
      return a.stockQuantity - b.stockQuantity;
    });

    console.log(`Processed ${processedProducts.length} backordered products with order data`);

    // Log some examples
    if (processedProducts.length > 0) {
      console.log('Sample backordered products with order data:');
      processedProducts.slice(0, 3).forEach(product => {
        console.log(`- ${product.name} (ID: ${product.id}, Stock: ${product.stockQuantity})`);
        console.log(`  Affected Orders: ${product.affectedOrders?.length || 0}`);
        console.log(`  Total Order Value: ${product.totalOrderValue} NOK`);
        console.log(`  Product Type: ${product.productType || 'None'}`);
        if (product.affectedOrders && product.affectedOrders.length > 0) {
          const overdueOrders = product.affectedOrders.filter(order => order.isOverdue);
          console.log(`  Overdue Orders: ${overdueOrders.length}`);
          console.log(`  Sample Order: #${product.affectedOrders[0].orderNumber} - ${product.affectedOrders[0].customerName}`);
          if (product.affectedOrders[0].deliveryDate) {
            console.log(`  Delivery Date: ${product.affectedOrders[0].deliveryDate} (Overdue: ${product.affectedOrders[0].isOverdue})`);
          }
        }
      });
    }

    return new Response(
      JSON.stringify({ 
        products: processedProducts,
        total: processedProducts.length,
        totalProductsScanned: allProducts.length,
        totalOrdersScanned: allOrders.length,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error in fetch-woocommerce-products:', error);
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