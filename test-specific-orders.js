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

async function testSpecificOrders() {
  console.log('🔍 Testing Specific Order IDs...\n');
  
  const authHeader = createBasicAuthHeader(credentials.username, credentials.password);
  const baseUrl = credentials.baseUrl.replace(/\/$/, '');
  
  console.log('⚙️ Test Configuration:');
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Username: ${credentials.username}`);
  console.log('Password: [HIDDEN]');
  console.log(`Goods Owner ID: ${credentials.goodsOwnerId}`);
  console.log(`Goods Owner Code: ${credentials.goodsOwnerCode}`);
  console.log('Auth Header: [HIDDEN]\n');
  
  // Test specific order IDs
  const orderIds = [214600, 216042];
  
  console.log(' Starting Order Tests...\n');
  
  for (const orderId of orderIds) {
    try {
      console.log(`Testing Order ID: ${orderId}`);
      
      // Test GET order by ID
      const orderUrl = `${baseUrl}/orders/${orderId}`;
      console.log(`GET URL: ${orderUrl}`);
      
      const response = await fetchWithTimeout(orderUrl, {
        method: 'GET',
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
        console.log(`✅ SUCCESS (${status}) - Order ${orderId} found!`);
        console.log(`   Order Data: ${JSON.stringify(responseData, null, 2)}`);
      } else {
        console.log(`❌ FAILED (${status} ${statusText}) - Order ${orderId} not found`);
        if (responseText && responseText.length < 200) {
          console.log(`   Error: ${responseText}`);
        }
      }
      
      console.log(''); // Empty line for readability
      
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.log(`❌ ERROR for Order ${orderId}: ${error.message}`);
      console.log('');
    }
  }
  
  console.log('✅ Order test completed!');
}

// Run the test
testSpecificOrders()
  .then(() => {
    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  });
