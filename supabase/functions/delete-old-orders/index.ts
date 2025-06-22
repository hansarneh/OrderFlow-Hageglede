import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface DeleteOrdersResponse {
  success: boolean;
  message: string;
  deletedCount: number;
  ordersDeleted: Array<{
    id: string;
    order_number: string;
    customer_name: string;
    woo_status: string;
    total_value: number;
  }>;
  timestamp: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== BACKGROUND DELETE OLD ORDERS OPERATION ===');
    console.log('Starting automatic cleanup of orders with non-target statuses...');

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing required environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Missing Supabase environment variables' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create Supabase admin client (no user authentication needed for background task)
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

    // Define the statuses we want to keep
    const statusesToKeep = ['processing', 'delvis-levert'];
    console.log('Statuses to keep:', statusesToKeep);

    // First, find orders that should be deleted (any status other than processing/delvis-levert)
    console.log('Querying orders to delete...');
    const { data: ordersToDelete, error: selectError } = await supabaseAdmin
      .from('customer_orders')
      .select('id, order_number, customer_name, woo_status, total_value')
      .not('woo_status', 'in', `(${statusesToKeep.map(s => `"${s}"`).join(',')})`);

    if (selectError) {
      console.error('Error selecting orders to delete:', selectError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to query orders for deletion', 
          details: selectError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const ordersCount = ordersToDelete?.length || 0;
    console.log(`Found ${ordersCount} orders to delete`);

    if (ordersCount === 0) {
      console.log('✅ No orders found for deletion - database is already clean');
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Database is already clean - no orders found that need to be deleted',
          deletedCount: 0,
          ordersDeleted: [],
          timestamp: new Date().toISOString()
        } as DeleteOrdersResponse),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log details of orders that will be deleted
    console.log('Orders that will be deleted:');
    const statusCounts: Record<string, number> = {};
    
    ordersToDelete.forEach(order => {
      statusCounts[order.woo_status] = (statusCounts[order.woo_status] || 0) + 1;
    });

    console.log('Orders by status:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  - ${status}: ${count} orders`);
    });

    // Show sample orders
    console.log('Sample orders to be deleted:');
    ordersToDelete.slice(0, 5).forEach(order => {
      console.log(`  - ${order.order_number} (${order.woo_status}) - ${order.customer_name} - ${order.total_value} NOK`);
    });
    if (ordersToDelete.length > 5) {
      console.log(`  ... and ${ordersToDelete.length - 5} more orders`);
    }

    // Perform the actual deletion
    console.log(`🗑️  Deleting ${ordersCount} orders...`);
    
    const { error: deleteError } = await supabaseAdmin
      .from('customer_orders')
      .delete()
      .not('woo_status', 'in', `(${statusesToKeep.map(s => `"${s}"`).join(',')})`);

    if (deleteError) {
      console.error('❌ Error deleting orders:', deleteError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to delete orders', 
          details: deleteError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verify the cleanup by checking remaining orders
    const { data: remainingOrders, error: verifyError } = await supabaseAdmin
      .from('customer_orders')
      .select('woo_status')
      .not('woo_status', 'in', `(${statusesToKeep.map(s => `"${s}"`).join(',')})`);

    if (verifyError) {
      console.warn('Warning: Could not verify cleanup:', verifyError);
    } else {
      const remainingCount = remainingOrders?.length || 0;
      if (remainingCount > 0) {
        console.warn(`⚠️  Warning: ${remainingCount} orders with non-target statuses still remain`);
      } else {
        console.log('✅ Verification successful: No orders with non-target statuses remain');
      }
    }

    // Get final count of remaining orders
    const { data: finalOrders, error: countError } = await supabaseAdmin
      .from('customer_orders')
      .select('woo_status', { count: 'exact' });

    if (!countError && finalOrders) {
      console.log(`📊 Final database state: ${finalOrders.length} total orders remaining`);
      const finalStatusCounts: Record<string, number> = {};
      finalOrders.forEach(order => {
        finalStatusCounts[order.woo_status] = (finalStatusCounts[order.woo_status] || 0) + 1;
      });
      console.log('Remaining orders by status:');
      Object.entries(finalStatusCounts).forEach(([status, count]) => {
        console.log(`  - ${status}: ${count} orders`);
      });
    }

    console.log(`✅ Successfully deleted ${ordersCount} orders`);
    console.log('=== BACKGROUND DELETE OPERATION COMPLETE ===');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Background cleanup completed: Deleted ${ordersCount} orders with statuses other than: ${statusesToKeep.join(', ')}. Database now contains only processing and delvis-levert orders.`,
        deletedCount: ordersCount,
        ordersDeleted: ordersToDelete,
        timestamp: new Date().toISOString()
      } as DeleteOrdersResponse),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Unexpected error in background delete operation:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error during background cleanup', 
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