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
  console.log('🔍 Testing Ongoing WMS API Structure (v3 - POST requests)...\n');
  
  const authHeader = createBasicAuthHeader(credentials.username, credentials.password);
  const baseUrl = credentials.baseUrl.replace(/\/$/, '');
  
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Username: ${credentials.username}`);
  console.log('Password: [HIDDEN]');
  console.log('Auth Header: [HIDDEN]\n');
  
  // Test endpoints that returned 405 with POST method
  const testEndpoints = [
    // Try POST for endpoints that returned 405
    { endpoint: '/orders', method: 'POST', body: {} },
    { endpoint: '/articles', method: 'POST', body: {} },
    
    // Try some common WMS API patterns with POST
    { endpoint: '/order/search', method: 'POST', body: { limit: 10 } },
    { endpoint: '/order/list', method: 'POST', body: { limit: 10 } },
    { endpoint: '/article/search', method: 'POST', body: { limit: 10 } },
    { endpoint: '/article/list', method: 'POST', body: { limit: 10 } },
    { endpoint: '/goods-owner/search', method: 'POST', body: { limit: 10 } },
    { endpoint: '/goods-owner/list', method: 'POST', body: { limit: 10 } },
    
    // Try some specific Ongoing WMS endpoints
    { endpoint: '/order', method: 'POST', body: { goodsOwnerId: 1 } },
    { endpoint: '/article', method: 'POST', body: { goodsOwnerId: 1 } },
    { endpoint: '/goods-owner', method: 'POST', body: {} },
    
    // Try with different query parameters
    { endpoint: '/orders?limit=10', method: 'GET', body: null },
    { endpoint: '/articles?limit=10', method: 'GET', body: null },
    { endpoint: '/goods-owners?limit=10', method: 'GET', body: null },
    
    // Try some alternative endpoints
    { endpoint: '/order-status', method: 'GET', body: null },
    { endpoint: '/order-statuses', method: 'GET', body: null },
    { endpoint: '/status', method: 'GET', body: null },
    { endpoint: '/statuses', method: 'GET', body: null },
    
    // Try warehouse with different methods
    { endpoint: '/warehouses', method: 'POST', body: {} },
    { endpoint: '/warehouse', method: 'GET', body: null },
    { endpoint: '/warehouse/1', method: 'GET', body: null },
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
