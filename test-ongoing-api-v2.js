import fetch from 'node-fetch';

// Ongoing WMS credentials
const credentials = {
  username: 'WSI_hahHageglede',
  password: 'iGdCHSqe3pCp',
  baseUrl: 'https://api.ongoingsystems.se/Spedify/api/v1/'
};

// Helper function to create Basic Auth header
function createBasicAuthHeader(username, password) {
  const credentials = `${username}:${password}`;
  const encodedCredentials = Buffer.from(credentials).toString('base64');
  return `Basic ${encodedCredentials}`;
}

// Helper function to make fetch request with timeout
async function fetchWithTimeout(url, options, timeoutMs = 30000) {
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
    throw error;
  }
}

async function testOngoingWMSAPI() {
  console.log('🔍 Testing Ongoing WMS API Structure (v2)...\n');
  
  const authHeader = createBasicAuthHeader(credentials.username, credentials.password);
  const baseUrl = credentials.baseUrl.replace(/\/$/, '');
  
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Username: ${credentials.username}`);
  console.log('Password: [HIDDEN]');
  console.log('Auth Header: [HIDDEN]\n');
  
  // Test different endpoint variations based on common WMS API patterns
  const testEndpoints = [
    // Try different order-related endpoints
    '/orders',
    '/order',
    '/order/list',
    '/order/search',
    '/order/status',
    '/order-status',
    '/order-statuses',
    
    // Try different customer-related endpoints
    '/customers',
    '/customer',
    '/customer/list',
    '/goods-owner',
    '/goods-owners',
    
    // Try different product-related endpoints
    '/articles',
    '/article',
    '/article/list',
    '/products',
    '/product',
    '/product/list',
    
    // Try different inventory-related endpoints
    '/inventory',
    '/inventory/list',
    '/stock',
    '/stock/list',
    
    // Try different shipment-related endpoints
    '/shipments',
    '/shipment',
    '/shipment/list',
    '/deliveries',
    '/delivery',
    '/delivery/list',
    
    // Try different purchase order endpoints
    '/purchase-orders',
    '/purchase-order',
    '/purchase-order/list',
    '/po',
    '/po/list',
    
    // Try status and configuration endpoints
    '/statuses',
    '/status',
    '/configuration',
    '/config',
    '/settings',
    
    // Try warehouse endpoints (we know this works)
    '/warehouses',
    '/warehouse',
    '/warehouse/list'
  ];
  
  const results = [];
  
  for (const endpoint of testEndpoints) {
    try {
      const apiUrl = `${baseUrl}${endpoint}`;
      console.log(`Testing endpoint: ${apiUrl}`);
      
      const response = await fetchWithTimeout(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'User-Agent': 'LogiFlow/1.0'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const result = {
          endpoint,
          status: response.status,
          success: true,
          dataType: Array.isArray(data) ? 'array' : 'object',
          itemCount: Array.isArray(data) ? data.length : 1,
          sampleData: Array.isArray(data) ? data.slice(0, 2) : data
        };
        
        console.log(`✅ ${endpoint} - Status: ${response.status}, Type: ${result.dataType}, Count: ${result.itemCount}`);
        results.push(result);
      } else {
        const result = {
          endpoint,
          status: response.status,
          success: false,
          error: response.statusText
        };
        
        console.log(`❌ ${endpoint} - Status: ${response.status}, Error: ${response.statusText}`);
        results.push(result);
      }
    } catch (error) {
      const result = {
        endpoint,
        status: 'error',
        success: false,
        error: error.message
      };
      
      console.log(`❌ ${endpoint} - Error: ${error.message}`);
      results.push(result);
    }
  }
  
  console.log('\n📊 API Structure Summary:');
  console.log('========================');
  
  const successfulEndpoints = results.filter(r => r.success);
  const failedEndpoints = results.filter(r => !r.success);
  
  console.log(`✅ Successful endpoints: ${successfulEndpoints.length}`);
  successfulEndpoints.forEach(r => {
    console.log(`  - ${r.endpoint}: ${r.dataType} (${r.itemCount} items)`);
  });
  
  console.log(`\n❌ Failed endpoints: ${failedEndpoints.length}`);
  failedEndpoints.forEach(r => {
    console.log(`  - ${r.endpoint}: ${r.error}`);
  });
  
  // Show sample data for successful endpoints
  console.log('\n📋 Sample Data:');
  console.log('===============');
  
  successfulEndpoints.forEach(r => {
    console.log(`\n${r.endpoint}:`);
    console.log(JSON.stringify(r.sampleData, null, 2));
  });
  
  return results;
}

// Run the test
testOngoingWMSAPI().catch(console.error);
