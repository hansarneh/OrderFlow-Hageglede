import fetch from 'node-fetch';

// Ongoing WMS credentials
const credentials = {
  username: 'WSI_hahHageglede',
  password: 'iGdCHSqe3pCp',
  baseUrl: 'https://api.ongoingsystems.se/Spedify/api/v1/',
  goodsOwnerId: 85,
  goodsOwnerCode: 'Hageglede.no'
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
  console.log('🔍 Testing Ongoing WMS API Structure (v7 - With Correct Goods Owner ID)...\n');
  
  const authHeader = createBasicAuthHeader(credentials.username, credentials.password);
  const baseUrl = credentials.baseUrl.replace(/\/$/, '');
  
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Username: ${credentials.username}`);
  console.log('Password: [HIDDEN]');
  console.log(`Goods Owner ID: ${credentials.goodsOwnerId}`);
  console.log(`Goods Owner Code: ${credentials.goodsOwnerCode}`);
  console.log('Auth Header: [HIDDEN]\n');
  
  // Test endpoints with the correct goods owner ID
  const testEndpoints = [
    // Basic endpoints
    '/orders',
    '/order',
    '/articles',
    '/article',
    '/goods-owners',
    '/goods-owner',
    
    // Try with goods owner ID in path
    '/goods-owner/85/orders',
    '/goods-owner/85/articles',
    '/goods-owner/85/inventory',
    '/goods-owner/85/stock',
    
    // Try some specific Ongoing WMS patterns
    '/outgoing-orders',
    '/incoming-orders',
    '/customer-orders',
    '/supplier-orders',
    '/purchase-orders',
    '/sales-orders',
    
    // Try some status endpoints
    '/order-statuses',
    '/article-statuses',
    '/inventory-statuses',
    
    // Try some configuration endpoints
    '/configuration',
    '/settings',
    '/config',
    
    // Try some metadata endpoints
    '/metadata',
    '/schema',
    '/types',
    
    // Try the working warehouse endpoint
    '/warehouses',
  ];
  
  const results = [];
  
  for (const endpoint of testEndpoints) {
    try {
      // Replace placeholder with actual goods owner ID
      let apiUrl = `${baseUrl}${endpoint}`;
      apiUrl = apiUrl.replace('{id}', credentials.goodsOwnerId);
      
      // Add goods owner ID as query parameter
      const separator = apiUrl.includes('?') ? '&' : '?';
      apiUrl = `${apiUrl}${separator}goodsOwnerId=${credentials.goodsOwnerId}`;
      
      console.log(`Testing GET ${apiUrl}`);
      
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
          endpoint: endpoint.replace('{id}', credentials.goodsOwnerId),
          goodsOwnerId: credentials.goodsOwnerId,
          status: response.status,
          success: true,
          dataType: Array.isArray(data) ? 'array' : 'object',
          itemCount: Array.isArray(data) ? data.length : 1,
          sampleData: Array.isArray(data) ? data.slice(0, 2) : data
        };
        
        console.log(`✅ GET ${endpoint} (goodsOwnerId: ${credentials.goodsOwnerId}) - Status: ${response.status}, Type: ${result.dataType}, Count: ${result.itemCount}`);
        results.push(result);
      } else {
        console.log(`❌ GET ${endpoint} (goodsOwnerId: ${credentials.goodsOwnerId}) - Status: ${response.status}, Error: ${response.statusText}`);
      }
    } catch (error) {
      console.log(`❌ GET ${endpoint} (goodsOwnerId: ${credentials.goodsOwnerId}) - Error: ${error.message}`);
    }
  }
  
  // Also try some POST requests with goods owner ID in body
  const postEndpoints = [
    '/orders',
    '/order',
    '/articles',
    '/article',
    '/goods-owners',
    '/goods-owner',
  ];
  
  for (const endpoint of postEndpoints) {
    try {
      const apiUrl = `${baseUrl}${endpoint}`;
      console.log(`Testing POST ${apiUrl} with goodsOwnerId: ${credentials.goodsOwnerId}`);
      
      const response = await fetchWithTimeout(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'User-Agent': 'LogiFlow/1.0'
        },
        body: JSON.stringify({
          goodsOwnerId: credentials.goodsOwnerId,
          limit: 10
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        const result = {
          endpoint,
          method: 'POST',
          goodsOwnerId: credentials.goodsOwnerId,
          status: response.status,
          success: true,
          dataType: Array.isArray(data) ? 'array' : 'object',
          itemCount: Array.isArray(data) ? data.length : 1,
          sampleData: Array.isArray(data) ? data.slice(0, 2) : data
        };
        
        console.log(`✅ POST ${endpoint} (goodsOwnerId: ${credentials.goodsOwnerId}) - Status: ${response.status}, Type: ${result.dataType}, Count: ${result.itemCount}`);
        results.push(result);
      } else {
        console.log(`❌ POST ${endpoint} (goodsOwnerId: ${credentials.goodsOwnerId}) - Status: ${response.status}, Error: ${response.statusText}`);
      }
    } catch (error) {
      console.log(`❌ POST ${endpoint} (goodsOwnerId: ${credentials.goodsOwnerId}) - Error: ${error.message}`);
    }
  }
  
  // Try PUT requests as mentioned in documentation
  const putEndpoints = [
    '/orders',
    '/order',
    '/articles',
    '/article',
    '/goods-owners',
    '/goods-owner',
  ];
  
  for (const endpoint of putEndpoints) {
    try {
      const apiUrl = `${baseUrl}${endpoint}`;
      console.log(`Testing PUT ${apiUrl} with goodsOwnerId: ${credentials.goodsOwnerId}`);
      
      const response = await fetchWithTimeout(apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'User-Agent': 'LogiFlow/1.0'
        },
        body: JSON.stringify({
          goodsOwnerId: credentials.goodsOwnerId,
          limit: 10
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        const result = {
          endpoint,
          method: 'PUT',
          goodsOwnerId: credentials.goodsOwnerId,
          status: response.status,
          success: true,
          dataType: Array.isArray(data) ? 'array' : 'object',
          itemCount: Array.isArray(data) ? data.length : 1,
          sampleData: Array.isArray(data) ? data.slice(0, 2) : data
        };
        
        console.log(`✅ PUT ${endpoint} (goodsOwnerId: ${credentials.goodsOwnerId}) - Status: ${response.status}, Type: ${result.dataType}, Count: ${result.itemCount}`);
        results.push(result);
      } else {
        console.log(`❌ PUT ${endpoint} (goodsOwnerId: ${credentials.goodsOwnerId}) - Status: ${response.status}, Error: ${response.statusText}`);
      }
    } catch (error) {
      console.log(`❌ PUT ${endpoint} (goodsOwnerId: ${credentials.goodsOwnerId}) - Error: ${error.message}`);
    }
  }
  
  console.log('\n📊 API Structure Summary:');
  console.log('========================');
  
  const successfulEndpoints = results.filter(r => r.success);
  const failedEndpoints = results.filter(r => !r.success);
  
  console.log(`✅ Successful endpoints: ${successfulEndpoints.length}`);
  successfulEndpoints.forEach(r => {
    const method = r.method || 'GET';
    console.log(`  - ${method} ${r.endpoint} (goodsOwnerId: ${r.goodsOwnerId}): ${r.dataType} (${r.itemCount} items)`);
  });
  
  console.log(`\n❌ Failed endpoints: ${failedEndpoints.length}`);
  
  // Show sample data for successful endpoints
  console.log('\n📋 Sample Data:');
  console.log('===============');
  
  successfulEndpoints.forEach(r => {
    const method = r.method || 'GET';
    console.log(`\n${method} ${r.endpoint} (goodsOwnerId: ${r.goodsOwnerId}):`);
    console.log(JSON.stringify(r.sampleData, null, 2));
  });
  
  return results;
}

// Run the test
testOngoingWMSAPI().catch(console.error);
