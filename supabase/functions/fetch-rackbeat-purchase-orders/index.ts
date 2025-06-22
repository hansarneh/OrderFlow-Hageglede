import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RackbeatCredentials {
  apiKey: string;
}

interface RackbeatPurchaseOrder {
  number: string;
  id: number;
  supplier_id: number;
  supplier_name: string;
  supplier_number: string;
  status: string;
  currency_code: string;
  total_price_incl_vat: number;
  total_price_excl_vat: number;
  total_amount: number; // Added for the correct value field
  total_subtotal: number; // Added for the correct value field
  vat_amount: number;
  created_at: string;
  updated_at: string;
  expected_delivery_date: string | null;
  preferred_delivery_date: string | null; // Added for the correct expected delivery date
  actual_delivery_date: string | null;
  is_received: boolean; // Added to check if the PO is received
  supplier?: { // Added nested supplier object
    name: string;
  };
}

interface RackbeatPurchaseOrderLine {
  id: number;
  purchase_order_id: number;
  supplier_product_number: string;
  name: string;
  quantity: number;
  line_price: number;
  line_total: number;
  unit_id?: number;
  child_id?: string;
  child_type?: string;
  line_price_incl_vat?: number;
  line_total_incl_vat?: number;
  discount_percentage?: number;
  vat_percentage?: number;
  delivery_date?: string | null;
}

interface ProcessedPurchaseOrder {
  poNumber: string;
  supplier: string;
  supplierNumber: string;
  status: 'delivered' | 'in-transit' | 'delayed' | 'pending';
  priority: 'high' | 'medium' | 'low';
  value: number;
  currency: string;
  items: number;
  createdDate: string;
  expectedDelivery: string | null;
  actualDelivery: string | null;
  trackingNumber?: string;
  orderLines: Array<{
    productNumber: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
}

interface RequestOptions {
  limit?: number;
  page?: number;
  testConnection?: boolean;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== FETCH RACKBEAT PURCHASE ORDERS FUNCTION STARTED ===');
    
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

    console.log('Authorization header present');

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

    console.log('Environment variables loaded successfully');

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

    console.log('Supabase clients created');

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

    console.log('User authenticated:', user.id);

    // Parse request body for options
    let requestOptions: RequestOptions = {};
    try {
      const requestBody = await req.text();
      if (requestBody) {
        requestOptions = JSON.parse(requestBody);
        console.log('Request options:', requestOptions);
      }
    } catch (e) {
      console.log('No valid JSON body or parsing error:', e);
      // Continue with default options
    }

    // Get Rackbeat credentials for this user
    const { data: integration, error: integrationError } = await supabaseAdmin
      .from('integrations')
      .select('credentials')
      .eq('user_id', user.id)
      .eq('integration_type', 'rackbeat')
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
      console.error('No Rackbeat integration found for user');
      return new Response(
        JSON.stringify({ error: 'Rackbeat integration not configured. Please add your Rackbeat API key in Settings.' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Rackbeat integration found');

    const credentials = integration.credentials as RackbeatCredentials;

    // Validate credentials
    if (!credentials.apiKey) {
      console.error('Missing Rackbeat API key');
      return new Response(
        JSON.stringify({ error: 'Incomplete Rackbeat credentials. Please check your settings.' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Rackbeat API key found');

    // Check if this is a connection test
    const isTestConnection = requestOptions.testConnection === true;
    console.log('Is test connection:', isTestConnection);

    // Prepare for pagination
    const limit = requestOptions.limit || 0; // 0 means no limit
    let page = requestOptions.page || 1;
    let hasMorePages = true;
    let allPurchaseOrders: RackbeatPurchaseOrder[] = [];
    
    console.log(`Starting pagination with limit: ${limit}, starting page: ${page}`);

    try {
      // Fetch purchase orders from Rackbeat with pagination
      while (hasMorePages) {
        // If we've reached the limit, stop fetching more pages
        if (limit > 0 && allPurchaseOrders.length >= limit) {
          console.log(`Reached limit of ${limit} purchase orders, stopping pagination`);
          break;
        }

        // Prepare Rackbeat API request URL with pagination
        const rackbeatApiUrl = `https://app.rackbeat.com/api/purchase-orders?page=${page}&per_page=20`;
        
        console.log(`Fetching purchase orders from Rackbeat API, page ${page}...`);
        console.log('API URL:', rackbeatApiUrl);

        const rackbeatResponse = await fetch(rackbeatApiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${credentials.apiKey}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'LogiFlow/1.0'
          },
          signal: AbortSignal.timeout(30000) // 30 second timeout
        });

        console.log('Rackbeat API response status:', rackbeatResponse.status);
        
        // Get the raw response text for logging
        const responseText = await rackbeatResponse.text();
        console.log('Rackbeat API raw response (first 1000 chars):', responseText.substring(0, 1000));
        
        // Try to parse the response as JSON
        let rackbeatData;
        try {
          rackbeatData = JSON.parse(responseText);
          console.log('Successfully parsed response as JSON');
          
          // Check if we have data and pagination info
          if (rackbeatData.data && Array.isArray(rackbeatData.data)) {
            console.log(`Fetched ${rackbeatData.data.length} purchase orders from page ${page}`);
            
            // Filter out purchase orders with is_received = true
            const filteredPOs = rackbeatData.data.filter((po: RackbeatPurchaseOrder) => !po.is_received);
            console.log(`Filtered out ${rackbeatData.data.length - filteredPOs.length} received purchase orders`);
            
            // Add this page's purchase orders to our collection
            allPurchaseOrders = [...allPurchaseOrders, ...filteredPOs];
            
            // Check if there are more pages
            if (rackbeatData.meta && rackbeatData.meta.pagination) {
              const pagination = rackbeatData.meta.pagination;
              console.log('Pagination info:', pagination);
              
              // If current_page < last_page, there are more pages
              if (pagination.current_page < pagination.last_page) {
                page++;
                console.log(`Moving to page ${page}`);
              } else {
                hasMorePages = false;
                console.log('No more pages available');
              }
            } else {
              // If no pagination info or empty data, assume no more pages
              if (rackbeatData.data.length === 0) {
                hasMorePages = false;
                console.log('No more data, stopping pagination');
              } else {
                // If we got data but no pagination info, try next page anyway
                page++;
                console.log(`No pagination info, trying page ${page}`);
              }
            }
            
            // If we've reached the limit, stop fetching more pages
            if (limit > 0 && allPurchaseOrders.length >= limit) {
              console.log(`Reached limit of ${limit} purchase orders, will stop after processing current page`);
              hasMorePages = false;
            }
          } else if (rackbeatData.purchase_orders && Array.isArray(rackbeatData.purchase_orders)) {
            // Alternative data structure
            console.log(`Fetched ${rackbeatData.purchase_orders.length} purchase orders from page ${page}`);
            
            // Filter out purchase orders with is_received = true
            const filteredPOs = rackbeatData.purchase_orders.filter((po: RackbeatPurchaseOrder) => !po.is_received);
            console.log(`Filtered out ${rackbeatData.purchase_orders.length - filteredPOs.length} received purchase orders`);
            
            allPurchaseOrders = [...allPurchaseOrders, ...filteredPOs];
            
            // Without pagination info, we'll just increment the page and continue until we get no data
            if (rackbeatData.purchase_orders.length === 0) {
              hasMorePages = false;
              console.log('No more data, stopping pagination');
            } else {
              page++;
              console.log(`Moving to page ${page}`);
            }
          } else {
            console.log('No purchase orders data found in response');
            hasMorePages = false;
          }
          
          // If this is just a test connection, we can stop after the first page
          if (isTestConnection) {
            console.log('Test connection successful, stopping after first page');
            hasMorePages = false;
          }
          
        } catch (parseError) {
          console.error('Failed to parse response as JSON:', parseError);
          
          // Return the raw response for debugging
          if (isTestConnection) {
            return new Response(
              JSON.stringify({ 
                error: 'Invalid JSON response from Rackbeat API',
                rawResponse: responseText.substring(0, 5000),
                status: rackbeatResponse.status
              }),
              { 
                status: 500, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            );
          }
          
          throw new Error('Invalid JSON response from Rackbeat API');
        }

        if (!rackbeatResponse.ok) {
          console.error('Rackbeat API error response:', rackbeatData);
          
          if (rackbeatResponse.status === 401) {
            return new Response(
              JSON.stringify({ error: 'Invalid Rackbeat API key. Please check your credentials in Settings.' }),
              { 
                status: 400, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            );
          }
          
          if (rackbeatResponse.status === 403) {
            return new Response(
              JSON.stringify({ error: 'Access denied. Please ensure your Rackbeat API key has the necessary permissions.' }),
              { 
                status: 400, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            );
          }

          if (rackbeatResponse.status === 404) {
            return new Response(
              JSON.stringify({ error: 'Rackbeat API endpoint not found. Please verify your account has access to purchase orders.' }),
              { 
                status: 400, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            );
          }

          return new Response(
            JSON.stringify({ 
              error: `Rackbeat API error: ${rackbeatResponse.status} ${rackbeatResponse.statusText}`,
              details: rackbeatData
            }),
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
      }

      // Apply limit if needed (in case we got more than requested)
      if (limit > 0 && allPurchaseOrders.length > limit) {
        console.log(`Trimming results to limit of ${limit} purchase orders`);
        allPurchaseOrders = allPurchaseOrders.slice(0, limit);
      }

      console.log(`Total purchase orders fetched: ${allPurchaseOrders.length}`);

      // If this is just a connection test, return success
      if (isTestConnection) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Connection successful',
            purchaseOrdersCount: allPurchaseOrders.length,
            responseData: { data: allPurchaseOrders.slice(0, 2) } // Just return first 2 for sample
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Process the purchase orders data
      console.log(`Processing ${allPurchaseOrders.length} purchase orders`);
      
      // Function to fetch purchase order lines for a specific purchase order
      async function fetchPurchaseOrderLines(poNumber: string, apiKey: string): Promise<RackbeatPurchaseOrderLine[]> {
        try {
          console.log(`Fetching lines for purchase order number: ${poNumber}`);
          
          const linesUrl = `https://app.rackbeat.com/api/purchase-orders/${poNumber}/lines`;
          console.log(`Lines API URL: ${linesUrl}`);
          
          const linesResponse = await fetch(linesUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'User-Agent': 'LogiFlow/1.0'
            },
            signal: AbortSignal.timeout(15000) // 15 second timeout for line items
          });
          
          if (!linesResponse.ok) {
            console.error(`Error fetching lines for PO ${poNumber}: ${linesResponse.status} ${linesResponse.statusText}`);
            return [];
          }
          
          const linesData = await linesResponse.json();
          
          if (!linesData.data || !Array.isArray(linesData.data)) {
            console.error(`No line items data found for PO ${poNumber}`);
            return [];
          }
          
          console.log(`Fetched ${linesData.data.length} line items for PO ${poNumber}`);
          
          // Log the first line item for debugging
          if (linesData.data.length > 0) {
            console.log(`Sample line item for PO ${poNumber}:`, JSON.stringify(linesData.data[0]).substring(0, 500));
          }
          
          return linesData.data;
        } catch (error) {
          console.error(`Error fetching lines for PO ${poNumber}:`, error);
          return [];
        }
      }
      
      // Process purchase orders and fetch their line items
      const processedPurchaseOrders: ProcessedPurchaseOrder[] = [];
      
      for (const rackbeatPO of allPurchaseOrders) {
        try {
          console.log(`Processing purchase order ID: ${rackbeatPO.id}, Number: ${rackbeatPO.number}`);
          
          // Fetch line items for this purchase order
          const orderLines = await fetchPurchaseOrderLines(rackbeatPO.number, credentials.apiKey);
          console.log(`Fetched ${orderLines.length} line items for purchase order ${rackbeatPO.number}`);
          
          // Map Rackbeat status to our status based on is_received
          let status: 'delivered' | 'in-transit' | 'delayed' | 'pending';
          
          // Check is_received flag to determine status
          if (rackbeatPO.is_received === true) {
            status = 'delivered';
          } else {
            // For non-received POs, use other fields to determine status
            // Fix: Safely handle undefined status by providing a default empty string
            const statusValue = (rackbeatPO.status || '').toLowerCase();
            
            if (statusValue.includes('transit') || statusValue.includes('shipped') || statusValue.includes('sent')) {
              status = 'in-transit';
            } else if (statusValue.includes('delayed') || statusValue.includes('overdue')) {
              status = 'delayed';
            } else {
              status = 'pending';
            }
          }

          // Determine priority based on order value
          let priority: 'high' | 'medium' | 'low';
          // Use total_subtotal for value if available, otherwise fall back to total_amount or total_price_excl_vat
          const orderValue = rackbeatPO.total_subtotal || rackbeatPO.total_amount || rackbeatPO.total_price_excl_vat || 0;
          if (orderValue > 50000) {
            priority = 'high';
          } else if (orderValue > 20000) {
            priority = 'medium';
          } else {
            priority = 'low';
          }

          // Process order lines
          const processedOrderLines = orderLines.map(line => ({
            productNumber: line.supplier_product_number || '',
            productName: line.name || '',
            quantity: line.quantity || 0,
            unitPrice: line.line_price || 0,
            totalPrice: line.line_total || 0
          }));

          // Calculate total items from order lines
          const totalItems = processedOrderLines.reduce((sum, line) => sum + line.quantity, 0);

          // FIX: Explicitly convert poNumber to string using String() constructor
          const poNumber = String(rackbeatPO.number || `PO-${rackbeatPO.id || 'unknown'}`);
          const supplierId = rackbeatPO.supplier_id || 0;
          
          // FIX: Prioritize the nested supplier.name if available
          const supplierName = rackbeatPO.supplier?.name || rackbeatPO.supplier_name || 'Unknown Supplier';
          
          const supplierNumber = rackbeatPO.supplier_number || `S-${supplierId}`;
          const currencyCode = rackbeatPO.currency_code || 'NOK';
          const createdAt = rackbeatPO.created_at || new Date().toISOString();
          
          // Format dates safely
          const createdDate = createdAt ? new Date(createdAt).toISOString().split('T')[0] : '';
          
          // FIX: Use preferred_delivery_date if available, otherwise fall back to expected_delivery_date
          const expectedDelivery = rackbeatPO.preferred_delivery_date ? 
            new Date(rackbeatPO.preferred_delivery_date).toISOString().split('T')[0] : 
            (rackbeatPO.expected_delivery_date ? 
              new Date(rackbeatPO.expected_delivery_date).toISOString().split('T')[0] : null);
              
          const actualDelivery = rackbeatPO.actual_delivery_date ? 
            new Date(rackbeatPO.actual_delivery_date).toISOString().split('T')[0] : null;

          const processedPO: ProcessedPurchaseOrder = {
            poNumber,
            supplier: supplierName,
            supplierNumber,
            status,
            priority,
            // FIX: Use total_subtotal for value if available
            value: rackbeatPO.total_subtotal || rackbeatPO.total_amount || rackbeatPO.total_price_excl_vat || 0,
            currency: currencyCode,
            items: totalItems,
            createdDate,
            expectedDelivery,
            actualDelivery,
            orderLines: processedOrderLines
          };
          
          processedPurchaseOrders.push(processedPO);
        } catch (error) {
          console.error(`Error processing purchase order ${rackbeatPO.id}:`, error);
          // Continue with other purchase orders even if one fails
        }
      }

      console.log(`Processed ${processedPurchaseOrders.length} purchase orders with their line items`);
      
      // If we have purchase orders, log a sample
      if (processedPurchaseOrders.length > 0) {
        console.log('Sample processed purchase order:', JSON.stringify(processedPurchaseOrders[0]).substring(0, 500));
        console.log('Sample order lines:', JSON.stringify(processedPurchaseOrders[0].orderLines).substring(0, 500));
      } else {
        console.log('No purchase orders to process');
      }

      // Store purchase orders and their line items in Supabase
      console.log('Storing purchase orders in Supabase...');
      
      let storedCount = 0;
      let errorCount = 0;
      
      for (const po of processedPurchaseOrders) {
        try {
          console.log(`Processing purchase order ${po.poNumber}...`);
          
          // First, store the purchase order
          const { data: poData, error: poError } = await supabaseAdmin
            .from('purchase_orders')
            .upsert({
              po_number: po.poNumber,
              po_status: po.status,
              supplier: po.supplier,
              supplier_number: po.supplierNumber, // Add supplier_number to the upsert
              currency: po.currency,
              eta: po.expectedDelivery,
              order_date: po.createdDate,
              total_value: po.value  // Added total_value field
            }, {
              onConflict: 'po_number'  // Use po_number as the conflict target
            });
            
          if (poError) {
            console.error(`Error storing purchase order ${po.poNumber}:`, poError);
            errorCount++;
            continue;
          }
          
          console.log(`Successfully stored purchase order ${po.poNumber}`);
          console.log(`Order has ${po.orderLines.length} line items`);
          
          // Then, store the purchase order lines
          for (const line of po.orderLines) {
            console.log(`Processing line item: ${line.productNumber} - ${line.productName} (${line.quantity} units)`);
            
            // Use po_number as the foreign key
            const { data: lineData, error: lineError } = await supabaseAdmin
              .from('purchase_order_lines')
              .upsert({
                purchase_order_id: po.poNumber,  // Use po_number as the foreign key
                product_number: line.productNumber,
                product_name: line.productName,
                qty: line.quantity,
                unit_price: line.unitPrice,
                total_price: line.totalPrice
              }, {
                onConflict: 'purchase_order_id, product_number'
              });
              
            if (lineError) {
              console.error(`Error storing purchase order line for PO ${po.poNumber}, product ${line.productNumber}:`, lineError);
              console.error('Line data:', JSON.stringify({
                purchase_order_id: po.poNumber,
                product_number: line.productNumber,
                product_name: line.productName,
                qty: line.quantity,
                unit_price: line.unitPrice,
                total_price: line.totalPrice
              }));
              // Continue with other lines even if one fails
            } else {
              console.log(`Successfully stored line item: ${line.productNumber}`);
            }
          }
          
          storedCount++;
          console.log(`Completed processing purchase order ${po.poNumber}`);
        } catch (error) {
          console.error(`Error processing purchase order ${po.poNumber}:`, error);
          errorCount++;
        }
      }
      
      console.log(`Stored ${storedCount} purchase orders in Supabase (${errorCount} errors)`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          purchaseOrders: processedPurchaseOrders,
          totalCount: processedPurchaseOrders.length,
          storedCount: storedCount,
          errorCount: errorCount,
          timestamp: new Date().toISOString()
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );

    } catch (fetchError) {
      console.error('Network error fetching from Rackbeat:', fetchError);
      
      if (fetchError.name === 'TimeoutError') {
        return new Response(
          JSON.stringify({ error: 'Connection timeout. Please check if Rackbeat API is accessible and try again.' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
      return new Response(
        JSON.stringify({ 
          error: 'Unable to connect to Rackbeat API. Please verify your API key and try again.',
          details: errorMessage 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

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