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
  console.log('🔍 Testing Ongoing WMS API Structure (v4 - Documentation and Help)...\n');
  
  const authHeader = createBasicAuthHeader(credentials.username, credentials.password);
  const baseUrl = credentials.baseUrl.replace(/\/$/, '');
  
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Username: ${credentials.username}`);
  console.log('Password: [HIDDEN]');
  console.log('Auth Header: [HIDDEN]\n');
  
  // Test documentation and help endpoints
  const testEndpoints = [
    // Try documentation endpoints
    { endpoint: '/', method: 'GET', body: null },
    { endpoint: '/docs', method: 'GET', body: null },
    { endpoint: '/documentation', method: 'GET', body: null },
    { endpoint: '/help', method: 'GET', body: null },
    { endpoint: '/api', method: 'GET', body: null },
    { endpoint: '/swagger', method: 'GET', body: null },
    { endpoint: '/openapi', method: 'GET', body: null },
    
    // Try some Spedify-specific endpoints
    { endpoint: '/spedify', method: 'GET', body: null },
    { endpoint: '/spedify/orders', method: 'GET', body: null },
    { endpoint: '/spedify/articles', method: 'GET', body: null },
    { endpoint: '/spedify/goods-owners', method: 'GET', body: null },
    
    // Try some common REST patterns
    { endpoint: '/v1', method: 'GET', body: null },
    { endpoint: '/v1/', method: 'GET', body: null },
    { endpoint: '/api/v1', method: 'GET', body: null },
    { endpoint: '/api/v1/', method: 'GET', body: null },
    
    // Try some alternative naming conventions
    { endpoint: '/outgoing-orders', method: 'GET', body: null },
    { endpoint: '/incoming-orders', method: 'GET', body: null },
    { endpoint: '/customer-orders', method: 'GET', body: null },
    { endpoint: '/supplier-orders', method: 'GET', body: null },
    { endpoint: '/purchase-orders', method: 'GET', body: null },
    { endpoint: '/sales-orders', method: 'GET', body: null },
    
    // Try some specific Spedify endpoints
    { endpoint: '/goods-owner-orders', method: 'GET', body: null },
    { endpoint: '/goods-owner-articles', method: 'GET', body: null },
    { endpoint: '/goods-owner-inventory', method: 'GET', body: null },
    
    // Try some status endpoints
    { endpoint: '/order-statuses', method: 'GET', body: null },
    { endpoint: '/article-statuses', method: 'GET', body: null },
    { endpoint: '/inventory-statuses', method: 'GET', body: null },
    
    // Try some configuration endpoints
    { endpoint: '/configuration', method: 'GET', body: null },
    { endpoint: '/settings', method: 'GET', body: null },
    { endpoint: '/config', method: 'GET', body: null },
    
    // Try some metadata endpoints
    { endpoint: '/metadata', method: 'GET', body: null },
    { endpoint: '/schema', method: 'GET', body: null },
    { endpoint: '/types', method: 'GET', body: null },
    
    // Try the working warehouse endpoint with different variations
    { endpoint: '/warehouses', method: 'GET', body: null },
    { endpoint: '/warehouse', method: 'GET', body: null },
    { endpoint: '/warehouse/list', method: 'GET', body: null },
    { endpoint: '/warehouse/search', method: 'GET', body: null },
  ];
  
  const results = [];
  
  for (const test of testEndpoints) {
    try {
      const apiUrl = `${baseUrl}${test.endpoint}`;
      console.log(`Testing ${test.method} ${test.endpoint}`);
      
      const options = {
        method: test.method,
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'User-Agent': 'LogiFlow/1.0'
        }
      };
      
      if (test.body) {
        options.body = JSON.stringify(test.body);
      }
      
      const response = await fetchWithTimeout(apiUrl, options);
      
      if (response.ok) {
        const data = await response.json();
        const result = {
          endpoint: test.endpoint,
          method: test.method,
          status: response.status,
          success: true,
          dataType: Array.isArray(data) ? 'array' : 'object',
          itemCount: Array.isArray(data) ? data.length : 1,
          sampleData: Array.isArray(data) ? data.slice(0, 2) : data
        };
        
        console.log(`✅ ${test.method} ${test.endpoint} - Status: ${response.status}, Type: ${result.dataType}, Count: ${result.itemCount}`);
        results.push(result);
      } else {
        const result = {
          endpoint: test.endpoint,
          method: test.method,
          status: response.status,
          success: false,
          error: response.statusText
        };
        
        console.log(`❌ ${test.method} ${test.endpoint} - Status: ${response.status}, Error: ${response.statusText}`);
        results.push(result);
      }
    } catch (error) {
      const result = {
        endpoint: test.endpoint,
        method: test.method,
        status: 'error',
        success: false,
        error: error.message
      };
      
      console.log(`❌ ${test.method} ${test.endpoint} - Error: ${error.message}`);
      results.push(result);
    }
  }
  
  console.log('\n📊 API Structure Summary:');
  console.log('========================');
  
  const successfulEndpoints = results.filter(r => r.success);
  const failedEndpoints = results.filter(r => !r.success);
  
  console.log(`✅ Successful endpoints: ${successfulEndpoints.length}`);
  successfulEndpoints.forEach(r => {
    console.log(`  - ${r.method} ${r.endpoint}: ${r.dataType} (${r.itemCount} items)`);
  });
  
  console.log(`\n❌ Failed endpoints: ${failedEndpoints.length}`);
  failedEndpoints.forEach(r => {
    console.log(`  - ${r.method} ${r.endpoint}: ${r.error}`);
  });
  
  // Show sample data for successful endpoints
  console.log('\n📋 Sample Data:');
  console.log('===============');
  
  successfulEndpoints.forEach(r => {
    console.log(`\n${r.method} ${r.endpoint}:`);
    console.log(JSON.stringify(r.sampleData, null, 2));
  });
  
  return results;
}

// Run the test
testOngoingWMSAPI().catch(console.error);
