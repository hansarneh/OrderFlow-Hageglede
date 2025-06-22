import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CSVProduct {
  woocommerce_id: number;
  name: string;
  sku?: string;
  stock_quantity?: number;
  stock_status?: string;
  manage_stock?: boolean;
  regular_price?: string;
  sale_price?: string;
  permalink?: string;
  product_type?: string;
  status?: string;
  produkttype?: string;
}

interface ImportResult {
  success: number;
  errors: number;
  errorDetails: Array<{
    row: number;
    error: string;
    data?: any;
  }>;
}

// Parse CSV content
function parseCSV(csvContent: string): CSVProduct[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV must contain at least a header row and one data row');
  }

  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  const products: CSVProduct[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0 || (values.length === 1 && values[0].trim() === '')) continue; // Skip empty lines

    const product: any = {};
    
    headers.forEach((header, index) => {
      const value = values[index]?.trim() || '';
      
      switch (header.toLowerCase()) {
        case 'woocommerce_id':
          product.woocommerce_id = parseInt(value);
          break;
        case 'name':
          product.name = value;
          break;
        case 'sku':
          product.sku = value || null;
          break;
        case 'stock_quantity':
          product.stock_quantity = value ? parseInt(value) : 0;
          break;
        case 'stock_status':
          product.stock_status = value || 'instock';
          break;
        case 'manage_stock':
          // Handle both 'yes'/'no' and 'true'/'false' values
          const lowerValue = value.toLowerCase();
          product.manage_stock = lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes';
          break;
        case 'regular_price':
          product.regular_price = value || '0';
          break;
        case 'sale_price':
          product.sale_price = value || '';
          break;
        case 'permalink':
          product.permalink = value || null;
          break;
        case 'product_type':
          product.product_type = value || 'simple';
          break;
        case 'status':
          product.status = value || 'publish';
          break;
        case 'produkttype':
          product.produkttype = value || null;
          break;
        // Note: 'price' column is ignored - it will be derived
      }
    });

    // Validate required fields
    if (!product.woocommerce_id || !product.name) {
      throw new Error(`Row ${i + 1}: Missing required fields (woocommerce_id, name)`);
    }

    products.push(product as CSVProduct);
  }

  return products;
}

// Parse a single CSV line, handling quoted values with commas and escaped quotes
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;
  
  while (i < line.length) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        // Handle escaped double quote ("")
        current += '"';
        i += 2; // Skip both quotes
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator found outside quotes
      result.push(current);
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }
  
  // Add the last field
  result.push(current);
  return result;
}

// Process products in batches
async function processProductsBatch(products: CSVProduct[], supabaseAdmin: any): Promise<ImportResult> {
  const result: ImportResult = {
    success: 0,
    errors: 0,
    errorDetails: []
  };

  const chunkSize = 10;
  for (let i = 0; i < products.length; i += chunkSize) {
    const chunk = products.slice(i, i + chunkSize);
    
    try {
      const upsertData = chunk.map((product, index) => {
        // Derive price from sale_price or regular_price
        const regularPrice = product.regular_price || '0';
        const salePrice = product.sale_price || '';
        const derivedPrice = salePrice && salePrice !== '' ? salePrice : regularPrice;

        return {
          woocommerce_id: product.woocommerce_id,
          name: product.name,
          sku: product.sku,
          stock_quantity: product.stock_quantity || 0,
          stock_status: product.stock_status || 'instock',
          manage_stock: product.manage_stock || false,
          price: derivedPrice, // Automatically derived
          regular_price: regularPrice,
          sale_price: salePrice,
          permalink: product.permalink,
          product_type: product.product_type || 'simple',
          status: product.status || 'publish',
          produkttype: product.produkttype,
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
        result.errors += chunk.length;
        result.errorDetails.push({
          row: i + 1,
          error: upsertError.message,
          data: chunk
        });
      } else {
        result.success += chunk.length;
        console.log(`Successfully processed chunk of ${chunk.length} products`);
      }
    } catch (error) {
      console.error(`Error processing chunk:`, error);
      result.errors += chunk.length;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errorDetails.push({
        row: i + 1,
        error: errorMessage,
        data: chunk
      });
    }
  }

  return result;
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

    // Parse the request body to get CSV content
    const requestBody = await req.text();
    if (!requestBody) {
      return new Response(
        JSON.stringify({ error: 'Missing CSV content in request body' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    let csvContent: string;
    try {
      const body = JSON.parse(requestBody);
      csvContent = body.csvContent;
      
      if (!csvContent) {
        return new Response(
          JSON.stringify({ error: 'Missing csvContent in request body' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Starting CSV import...');
    console.log(`CSV content length: ${csvContent.length} characters`);

    // Parse CSV content
    let products: CSVProduct[];
    try {
      products = parseCSV(csvContent);
      console.log(`Parsed ${products.length} products from CSV`);
    } catch (error) {
      console.error('CSV parsing error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return new Response(
        JSON.stringify({ error: `CSV parsing error: ${errorMessage}` }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (products.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid products found in CSV' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Process products
    const result = await processProductsBatch(products, supabaseAdmin);

    console.log(`Import completed: ${result.success} success, ${result.errors} errors`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `CSV import completed: ${result.success} products imported, ${result.errors} errors`,
        importedCount: result.success,
        errorCount: result.errors,
        totalProcessed: products.length,
        errorDetails: result.errorDetails.slice(0, 10), // Limit error details to first 10
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