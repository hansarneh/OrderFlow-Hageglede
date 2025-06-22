import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface OrderLine {
  id: string;
  order_id: string;
  woocommerce_line_item_id: number;
  product_id: number;
  product_name: string;
  sku: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  tax_amount: number;
  meta_data: any;
  delivered_quantity: number;
  delivery_date: string | null;
  delivery_status: 'pending' | 'partial' | 'delivered' | 'cancelled';
  partial_delivery_details: any;
  product?: {
    id: string;
    woocommerce_id: number;
    name: string;
    sku: string | null;
    stock_quantity: number;
    stock_status: string;
    produkttype: string | null;
  };
}

interface CustomerOrder {
  id: string;
  woocommerce_order_id: number;
  order_number: string;
  customer_name: string;
  woo_status: string;
  total_value: number;
  total_items: number;
  date_created: string;
  permalink: string | null;
  delivery_date: string | null;
  delivery_type: string | null;
  shipping_method_title: string | null;
  order_lines?: OrderLine[];
  isAtRisk?: boolean;
  riskReason?: string;
  riskLevel?: 'high' | 'medium' | 'low';
  daysSinceDeliveryDate?: number;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== GET AT-RISK ORDERS FUNCTION STARTED ===');
    
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
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
      console.error('Missing required environment variables');
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
      console.error('User authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Authenticated user:', user.id);

    // Parse request parameters if any
    let params: any = {};
    if (req.method === 'POST') {
      try {
        const body = await req.text();
        if (body) {
          params = JSON.parse(body);
        }
      } catch (error) {
        console.warn('Failed to parse request body, using defaults');
      }
    }

    // Get query parameters if any
    const url = new URL(req.url);
    const statusFilter = url.searchParams.get('status') || params.status || 'processing,on-hold,pending,delvis-levert';
    const limit = parseInt(url.searchParams.get('limit') || params.limit || '1000');
    
    console.log('Query parameters:');
    console.log('- Status filter:', statusFilter);
    console.log('- Limit:', limit);

    // Step 1: Get all orders with the specified statuses
    console.log('Fetching orders with statuses:', statusFilter);
    
    const statuses = statusFilter.split(',').map(s => s.trim());
    
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('customer_orders')
      .select(`
        id,
        woocommerce_order_id,
        order_number,
        customer_name,
        woo_status,
        total_value,
        total_items,
        date_created,
        permalink,
        delivery_date,
        delivery_type,
        shipping_method_title,
        order_lines:order_lines(
          id,
          order_id,
          woocommerce_line_item_id,
          product_id,
          product_name,
          sku,
          quantity,
          unit_price,
          total_price,
          tax_amount,
          meta_data,
          delivered_quantity,
          delivery_date,
          delivery_status,
          partial_delivery_details,
          product:products(
            id,
            woocommerce_id,
            name,
            sku,
            stock_quantity,
            stock_status,
            produkttype
          )
        )
      `)
      .in('woo_status', statuses)
      .order('date_created', { ascending: false })
      .limit(limit);

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch orders', details: ordersError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Fetched ${orders?.length || 0} orders`);
    
    if (!orders || orders.length === 0) {
      console.log('No orders found, returning empty result');
      return new Response(
        JSON.stringify({ 
          orders: [],
          atRiskOrders: [],
          totalOrders: 0,
          totalAtRiskOrders: 0,
          timestamp: new Date().toISOString()
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Step 2: Process orders and identify those at risk
    console.log('Processing orders to identify those at risk...');
    
    const processedOrders: CustomerOrder[] = orders.map(order => {
      // Check if order has a delivery date and it's in the past
      const hasOverdueDeliveryDate = order.delivery_date && new Date(order.delivery_date) < new Date();
      
      // Check if any order line has a backordered product (negative stock)
      const hasBackorderedProducts = (order.order_lines || []).some(line => 
        line.product && 
        line.product.stock_quantity !== undefined && 
        line.product.stock_quantity < 0
      );
      
      // An order is at risk if it has both an overdue delivery date AND contains backordered products
      const isAtRisk = hasOverdueDeliveryDate && hasBackorderedProducts;
      
      // Calculate days since delivery date
      let daysSinceDeliveryDate = 0;
      if (isAtRisk && order.delivery_date) {
        const deliveryDate = new Date(order.delivery_date);
        const today = new Date();
        const diffTime = Math.abs(today.getTime() - deliveryDate.getTime());
        daysSinceDeliveryDate = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
      
      // Determine risk level based on days overdue
      let riskLevel: 'high' | 'medium' | 'low' = 'low';
      if (daysSinceDeliveryDate > 30) {
        riskLevel = 'high';
      } else if (daysSinceDeliveryDate > 14) {
        riskLevel = 'medium';
      }
      
      // Count backordered products in this order
      const backorderedProductCount = isAtRisk ? 
        (order.order_lines || []).filter(line => 
          line.product && 
          line.product.stock_quantity !== undefined && 
          line.product.stock_quantity < 0
        ).length : 0;
      
      return {
        ...order,
        isAtRisk,
        riskReason: isAtRisk ? 
          `Order is ${daysSinceDeliveryDate} days past delivery date and contains ${backorderedProductCount} backordered product(s)` : 
          undefined,
        riskLevel: isAtRisk ? riskLevel : undefined,
        daysSinceDeliveryDate: isAtRisk ? daysSinceDeliveryDate : undefined
      };
    });

    // Filter to only at-risk orders
    const atRiskOrders = processedOrders.filter(order => order.isAtRisk);
    
    console.log(`Identified ${atRiskOrders.length} orders at risk`);
    console.log('Risk level breakdown:');
    console.log('- High risk:', atRiskOrders.filter(o => o.riskLevel === 'high').length);
    console.log('- Medium risk:', atRiskOrders.filter(o => o.riskLevel === 'medium').length);
    console.log('- Low risk:', atRiskOrders.filter(o => o.riskLevel === 'low').length);

    // Return the results
    return new Response(
      JSON.stringify({ 
        orders: processedOrders,
        atRiskOrders: atRiskOrders,
        totalOrders: processedOrders.length,
        totalAtRiskOrders: atRiskOrders.length,
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