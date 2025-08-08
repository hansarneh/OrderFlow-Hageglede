import { initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD2Jzx87Bm7rY20GyrwzLEDeAL-MfBwTrg",
  authDomain: "order-flow-bolt.firebaseapp.com",
  projectId: "order-flow-bolt",
  storageBucket: "order-flow-bolt.firebasestorage.app",
  messagingSenderId: "617904912539",
  appId: "1:617904912539:web:17d1eba2be8b1c65d7ee3e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);

async function testOngoingFunctions() {
  console.log('🧪 Testing Ongoing WMS Firebase Functions...\n');
  
  try {
    // Test fetchOngoingArticles function
    console.log('Testing fetchOngoingArticles...');
    const fetchOngoingArticles = httpsCallable(functions, 'fetchOngoingArticles');
    
    const articlesResult = await fetchOngoingArticles({
      goodsOwnerId: 85,
      limit: 5,
      offset: 0
    });
    
    console.log('✅ fetchOngoingArticles result:', articlesResult.data);
    
    // Test fetchOngoingWarehouses function
    console.log('\nTesting fetchOngoingWarehouses...');
    const fetchOngoingWarehouses = httpsCallable(functions, 'fetchOngoingWarehouses');
    
    const warehousesResult = await fetchOngoingWarehouses({
      goodsOwnerId: 85
    });
    
    console.log('✅ fetchOngoingWarehouses result:', warehousesResult.data);
    
    // Test syncOngoingOrders function (placeholder)
    console.log('\nTesting syncOngoingOrders...');
    const syncOngoingOrders = httpsCallable(functions, 'syncOngoingOrders');
    
    const ordersResult = await syncOngoingOrders({});
    
    console.log('✅ syncOngoingOrders result:', ordersResult.data);
    
  } catch (error) {
    console.error('❌ Error testing functions:', error);
  }
}

// Run the test
testOngoingFunctions().catch(console.error);
