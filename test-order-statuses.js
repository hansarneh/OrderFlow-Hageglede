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

async function testOrderStatuses() {
  console.log('🔍 Testing Ongoing WMS Order Statuses...\n');
  
  const authHeader = createBasicAuthHeader(credentials.username, credentials.password);
  const baseUrl = credentials.baseUrl.replace(/\/$/, '');
  
  console.log('⚙️ Test Configuration:');
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Username: ${credentials.username}`);
  console.log('Password: [HIDDEN]');
  console.log(`Goods Owner ID: ${credentials.goodsOwnerId}`);
  console.log(`Goods Owner Code: ${credentials.goodsOwnerCode}`);
  console.log('Auth Header: [HIDDEN]\n');
  
  // Test order statuses endpoints
  const testEndpoints = [
    { path: '/orders/statuses', description: 'Order Statuses' },
    { path: '/purchaseOrders/statuses', description: 'Purchase Order Statuses' },
  ];
  
  console.log(' Starting Status Tests...\n');
  
  for (const endpoint of testEndpoints) {
    try {
      const method = 'GET';
      let apiUrl = `${baseUrl}${endpoint.path}`;
      
      console.log(`Testing: ${method} ${endpoint.description}`);
      console.log(`URL: ${apiUrl}`);
      
      const response = await fetchWithTimeout(apiUrl, {
        method: method,
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'User-Agent': 'LogiFlow/1.0'
        }
      }, 15000);
      
      const status = response.status;
      const statusText = response.statusText;
      
      let responseData = null;
      let responseText = '';
      
      try {
        responseText = await response.text();
        if (responseText) {
          responseData = JSON.parse(responseText);
        }
      } catch (parseError) {
        responseData = null;
      }
      
      if (status >= 200 && status < 300) {
        console.log(`✅ SUCCESS (${status}) - ${responseData ? (Array.isArray(responseData) ? 'array' : 'object') : 'text'}`);
        console.log(`   Full Response: ${JSON.stringify(responseData, null, 2)}`);
      } else {
        console.log(`❌ FAILED (${status} ${statusText})`);
        if (responseText && responseText.length < 200) {
          console.log(`   Error: ${responseText}`);
        }
      }
      
      console.log(''); // Empty line for readability
      
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
      console.log('');
    }
  }
  
  console.log('✅ Status test completed!');
}

// Run the test
testOrderStatuses()
  .then(() => {
    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  });
