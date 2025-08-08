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

async function testArticlesStructure() {
  console.log('🔍 Testing Articles Endpoint Structure...\n');
  
  const authHeader = createBasicAuthHeader(credentials.username, credentials.password);
  const baseUrl = credentials.baseUrl.replace(/\/$/, '');
  
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Goods Owner ID: ${credentials.goodsOwnerId}`);
  console.log(`Goods Owner Code: ${credentials.goodsOwnerCode}\n`);
  
  // Test different query parameters for articles
  const testQueries = [
    'goodsOwnerId=85',
    'goodsOwnerId=85&limit=5',
    'goodsOwnerId=85&limit=10',
    'goodsOwnerId=85&offset=0&limit=5',
    'goodsOwnerId=85&offset=10&limit=5',
    'goodsOwnerId=85&isActive=true',
    'goodsOwnerId=85&isStockArticle=true',
    'goodsOwnerId=85&articleGroup=1002',
    'goodsOwnerId=85&search=test',
    'goodsOwnerId=85&articleNumber=999',
    'goodsOwnerId=85&articleNumber=001'
  ];
  
  const results = [];
  
  for (const query of testQueries) {
    try {
      const apiUrl = `${baseUrl}/articles?${query}`;
      console.log(`Testing: ${apiUrl}`);
      
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
          query,
          status: response.status,
          success: true,
          dataType: Array.isArray(data) ? 'array' : 'object',
          itemCount: Array.isArray(data) ? data.length : 1,
          sampleData: Array.isArray(data) ? data.slice(0, 3) : data
        };
        
        console.log(`✅ ${query} - Status: ${response.status}, Type: ${result.dataType}, Count: ${result.itemCount}`);
        results.push(result);
      } else {
        console.log(`❌ ${query} - Status: ${response.status}, Error: ${response.statusText}`);
      }
    } catch (error) {
      console.log(`❌ ${query} - Error: ${error.message}`);
    }
  }
  
  console.log('\n📊 Articles Structure Summary:');
  console.log('==============================');
  
  const successfulQueries = results.filter(r => r.success);
  
  console.log(`✅ Successful queries: ${successfulQueries.length}`);
  successfulQueries.forEach(r => {
    console.log(`  - ${r.query}: ${r.dataType} (${r.itemCount} items)`);
  });
  
  // Show detailed sample data
  console.log('\n📋 Detailed Sample Data:');
  console.log('========================');
  
  successfulQueries.forEach(r => {
    console.log(`\n${r.query}:`);
    console.log(JSON.stringify(r.sampleData, null, 2));
  });
  
  // Analyze the data structure
  if (successfulQueries.length > 0) {
    const firstResult = successfulQueries[0];
    if (firstResult.sampleData && firstResult.sampleData.length > 0) {
      const sampleArticle = firstResult.sampleData[0];
      
      console.log('\n🔍 Article Data Structure Analysis:');
      console.log('===================================');
      console.log('Available fields:');
      
      const analyzeObject = (obj, prefix = '') => {
        for (const [key, value] of Object.entries(obj)) {
          const fieldPath = prefix ? `${prefix}.${key}` : key;
          const valueType = Array.isArray(value) ? 'array' : typeof value;
          const valuePreview = Array.isArray(value) 
            ? `[${value.length} items]` 
            : typeof value === 'object' && value !== null 
              ? `{${Object.keys(value).length} fields}` 
              : String(value).substring(0, 50);
          
          console.log(`  - ${fieldPath}: ${valueType} (${valuePreview})`);
          
          if (typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length > 0) {
            analyzeObject(value, fieldPath);
          }
        }
      };
      
      analyzeObject(sampleArticle);
    }
  }
  
  return results;
}

// Run the test
testArticlesStructure().catch(console.error);
