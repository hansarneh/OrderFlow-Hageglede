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
  console.log('🔍 Testing Ongoing WMS API Structure (v6 - PUT requests and different formats)...\n');
  
  const authHeader = createBasicAuthHeader(credentials.username, credentials.password);
  const baseUrl = credentials.baseUrl.replace(/\/$/, '');
  
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Username: ${credentials.username}`);
  console.log('Password: [HIDDEN]');
  console.log('Auth Header: [HIDDEN]\n');
  
  // Try different goods owner IDs
  const goodsOwnerIds = [1, 2, 3, 4, 5];
  
  // Test PUT requests (as mentioned in documentation)
  const putEndpoints = [
    '/orders',
    '/order',
    '/articles',
    '/article',
    '/goods-owners',
    '/goods-owner',
  ];
  
  const results = [];
  
  for (const endpoint of putEndpoints) {
    for (const goodsOwnerId of goodsOwnerIds) {
      try {
        const apiUrl = `${baseUrl}${endpoint}`;
        console.log(`Testing PUT ${apiUrl} with goodsOwnerId: ${goodsOwnerId}`);
        
        // Try different request body formats
        const requestBodies = [
          { goodsOwnerId: goodsOwnerId },
          { goodsOwnerId: goodsOwnerId, limit: 10 },
          { goodsOwnerId: goodsOwnerId, offset: 0, limit: 10 },
          { goodsOwnerId: goodsOwnerId, search: "" },
          { goodsOwnerId: goodsOwnerId, status: "all" },
          { goodsOwnerId: goodsOwnerId, dateFrom: "2024-01-01", dateTo: "2024-12-31" }
        ];
        
        for (const body of requestBodies) {
          try {
            const response = await fetchWithTimeout(apiUrl, {
              method: 'PUT',
              headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
                'User-Agent': 'LogiFlow/1.0'
              },
              body: JSON.stringify(body)
            });
            
            if (response.ok) {
              const data = await response.json();
              const result = {
                endpoint,
                method: 'PUT',
                goodsOwnerId,
                requestBody: body,
                status: response.status,
                success: true,
                dataType: Array.isArray(data) ? 'array' : 'object',
                itemCount: Array.isArray(data) ? data.length : 1,
                sampleData: Array.isArray(data) ? data.slice(0, 2) : data
              };
              
              console.log(`✅ PUT ${endpoint} (goodsOwnerId: ${goodsOwnerId}) - Status: ${response.status}, Type: ${result.dataType}, Count: ${result.itemCount}`);
              results.push(result);
              
              // If we found a working endpoint, don't test other request bodies
              break;
            } else {
              console.log(`❌ PUT ${endpoint} (goodsOwnerId: ${goodsOwnerId}) - Status: ${response.status}, Error: ${response.statusText}`);
            }
          } catch (error) {
            console.log(`❌ PUT ${endpoint} (goodsOwnerId: ${goodsOwnerId}) - Error: ${error.message}`);
          }
        }
      } catch (error) {
        console.log(`❌ PUT ${endpoint} (goodsOwnerId: ${goodsOwnerId}) - Error: ${error.message}`);
      }
    }
  }
  
  // Also try some GET requests with different parameter formats
  const getEndpoints = [
    '/orders',
    '/articles',
    '/goods-owners',
  ];
  
  for (const endpoint of getEndpoints) {
    for (const goodsOwnerId of goodsOwnerIds) {
      try {
        // Try different query parameter formats
        const queryParams = [
          `goodsOwnerId=${goodsOwnerId}`,
          `goodsOwnerId=${goodsOwnerId}&limit=10`,
          `goodsOwnerId=${goodsOwnerId}&offset=0&limit=10`,
          `goodsOwnerId=${goodsOwnerId}&status=all`,
          `goodsOwnerId=${goodsOwnerId}&dateFrom=2024-01-01&dateTo=2024-12-31`
        ];
        
        for (const queryParam of queryParams) {
          const apiUrl = `${baseUrl}${endpoint}?${queryParam}`;
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
              endpoint,
              method: 'GET',
              goodsOwnerId,
              queryParams: queryParam,
              status: response.status,
              success: true,
              dataType: Array.isArray(data) ? 'array' : 'object',
              itemCount: Array.isArray(data) ? data.length : 1,
              sampleData: Array.isArray(data) ? data.slice(0, 2) : data
            };
            
            console.log(`✅ GET ${endpoint} (goodsOwnerId: ${goodsOwnerId}) - Status: ${response.status}, Type: ${result.dataType}, Count: ${result.itemCount}`);
            results.push(result);
            
            // If we found a working endpoint, don't test other query parameters
            break;
          } else {
            console.log(`❌ GET ${endpoint} (goodsOwnerId: ${goodsOwnerId}) - Status: ${response.status}, Error: ${response.statusText}`);
          }
        }
      } catch (error) {
        console.log(`❌ GET ${endpoint} (goodsOwnerId: ${goodsOwnerId}) - Error: ${error.message}`);
      }
    }
  }
  
  console.log('\n📊 API Structure Summary:');
  console.log('========================');
  
  const successfulEndpoints = results.filter(r => r.success);
  const failedEndpoints = results.filter(r => !r.success);
  
  console.log(`✅ Successful endpoints: ${successfulEndpoints.length}`);
  successfulEndpoints.forEach(r => {
    console.log(`  - ${r.method} ${r.endpoint} (goodsOwnerId: ${r.goodsOwnerId}): ${r.dataType} (${r.itemCount} items)`);
    if (r.requestBody) {
      console.log(`    Request Body: ${JSON.stringify(r.requestBody)}`);
    }
    if (r.queryParams) {
      console.log(`    Query Params: ${r.queryParams}`);
    }
  });
  
  console.log(`\n❌ Failed endpoints: ${failedEndpoints.length}`);
  
  // Show sample data for successful endpoints
  console.log('\n📋 Sample Data:');
  console.log('===============');
  
  successfulEndpoints.forEach(r => {
    console.log(`\n${r.method} ${r.endpoint} (goodsOwnerId: ${r.goodsOwnerId}):`);
    console.log(JSON.stringify(r.sampleData, null, 2));
  });
  
  return results;
}

// Run the test
testOngoingWMSAPI().catch(console.error);
