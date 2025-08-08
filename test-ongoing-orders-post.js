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

async function testOngoingWMSOrdersWithPost() {
  console.log('🔍 Testing Ongoing WMS Orders with POST/PUT Methods...\n');
  
  const authHeader = createBasicAuthHeader(credentials.username, credentials.password);
  const baseUrl = credentials.baseUrl.replace(/\/$/, '');
  
  console.log('⚙️ Test Configuration:');
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Username: ${credentials.username}`);
  console.log('Password: [HIDDEN]');
  console.log(`Goods Owner ID: ${credentials.goodsOwnerId}`);
  console.log(`Goods Owner Code: ${credentials.goodsOwnerCode}`);
  console.log('Auth Header: [HIDDEN]\n');
  
  // Test endpoints that require POST/PUT methods
  const testEndpoints = [
    // Orders endpoints with POST method
    { 
      path: '/orders', 
      method: 'POST', 
      description: 'Get all orders (POST method)',
      body: { goodsOwnerId: 85 }
    },
    { 
      path: '/orders', 
      method: 'PUT', 
      description: 'Get all orders (PUT method)',
      body: { goodsOwnerId: 85 }
    },
    
    // Purchase Orders endpoints with POST method
    { 
      path: '/purchaseOrders', 
      method: 'POST', 
      description: 'Get all purchase orders (POST method)',
      body: { goodsOwnerId: 85 }
    },
    { 
      path: '/purchaseOrders', 
      method: 'PUT', 
      description: 'Get all purchase orders (PUT method)',
      body: { goodsOwnerId: 85 }
    },
    
    // Try with different search criteria
    { 
      path: '/orders', 
      method: 'POST', 
      description: 'Get orders with search criteria',
      body: { 
        goodsOwnerId: 85,
        limit: 10,
        offset: 0
      }
    },
    { 
      path: '/purchaseOrders', 
      method: 'POST', 
      description: 'Get purchase orders with search criteria',
      body: { 
        goodsOwnerId: 85,
        limit: 10,
        offset: 0
      }
    },
  ];
  
  const results = [];
  
  console.log(' Starting API Tests with POST/PUT Methods...\n');
  
  for (const endpoint of testEndpoints) {
    try {
      const method = endpoint.method;
      let apiUrl = `${baseUrl}${endpoint.path}`;
      
      console.log(`Testing: ${method} ${endpoint.description}`);
      console.log(`URL: ${apiUrl}`);
      console.log(`Body: ${JSON.stringify(endpoint.body)}`);
      
      const response = await fetchWithTimeout(apiUrl, {
        method: method,
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'User-Agent': 'LogiFlow/1.0'
        },
        body: JSON.stringify(endpoint.body)
      }, 15000); // 15 second timeout
      
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
        // Response is not JSON, use text as is
        responseData = null;
      }
      
      const result = {
        endpoint: endpoint.description,
        url: apiUrl,
        method: method,
        status: status,
        statusText: statusText,
        success: status >= 200 && status < 300,
        hasData: responseData && (Array.isArray(responseData) ? responseData.length > 0 : Object.keys(responseData).length > 0),
        dataType: responseData ? (Array.isArray(responseData) ? 'array' : 'object') : 'text',
        dataLength: responseData ? (Array.isArray(responseData) ? responseData.length : Object.keys(responseData).length) : responseText.length,
        sampleData: responseData ? (Array.isArray(responseData) ? responseData.slice(0, 2) : Object.keys(responseData).slice(0, 5)) : null
      };
      
      results.push(result);
      
      // Display result
      if (result.success) {
        console.log(`✅ SUCCESS (${status}) - ${result.dataType} with ${result.dataLength} items`);
        if (result.sampleData) {
          console.log(`   Sample: ${JSON.stringify(result.sampleData).substring(0, 150)}...`);
        }
      } else {
        console.log(`❌ FAILED (${status} ${statusText})`);
        if (responseText && responseText.length < 200) {
          console.log(`   Error: ${responseText}`);
        }
      }
      
      console.log(''); // Empty line for readability
      
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
      console.log('');
      
      results.push({
        endpoint: endpoint.description,
        url: `${baseUrl}${endpoint.path}`,
        method: endpoint.method,
        status: 'ERROR',
        statusText: error.message,
        success: false,
        hasData: false,
        dataType: 'error',
        dataLength: 0,
        sampleData: null
      });
    }
  }
  
  // Summary
  console.log(' Test Summary:');
  console.log('================');
  
  const successfulTests = results.filter(r => r.success);
  const failedTests = results.filter(r => !r.success);
  const testsWithData = results.filter(r => r.success && r.hasData);
  
  console.log(`Total Tests: ${results.length}`);
  console.log(`Successful: ${successfulTests.length}`);
  console.log(`Failed: ${failedTests.length}`);
  console.log(`With Data: ${testsWithData.length}`);
  
  if (testsWithData.length > 0) {
    console.log('\n🎉 Working Endpoints with Data:');
    testsWithData.forEach(test => {
      console.log(`✅ ${test.endpoint}`);
      console.log(`   URL: ${test.url}`);
      console.log(`   Data Type: ${test.dataType} (${test.dataLength} items)`);
    });
  }
  
  if (failedTests.length > 0) {
    console.log('\n❌ Failed Endpoints:');
    failedTests.forEach(test => {
      console.log(`❌ ${test.endpoint} - ${test.status} ${test.statusText}`);
    });
  }
  
  console.log('\n🔍 Next Steps:');
  console.log('1. Review the working endpoints above');
  console.log('2. Check the data structure of successful responses');
  console.log('3. Identify which endpoints provide order data');
  console.log('4. Plan integration based on available data');
}

// Run the test
testOngoingWMSOrdersWithPost()
  .then(() => {
    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  });
