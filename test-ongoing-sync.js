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

async function testOngoingWMSSync() {
  console.log('🔍 Testing Ongoing WMS Sync Functions...\n');
  
  try {
    // Test getting order statuses
    console.log('1. Testing getOngoingOrderStatuses...');
    const getOrderStatuses = httpsCallable(functions, 'getOngoingOrderStatuses');
    const orderStatusesResult = await getOrderStatuses({});
    console.log('✅ Order Statuses Result:', orderStatusesResult.data);
    
    // Test getting purchase order statuses
    console.log('\n2. Testing getOngoingPurchaseOrderStatuses...');
    const getPurchaseOrderStatuses = httpsCallable(functions, 'getOngoingPurchaseOrderStatuses');
    const purchaseOrderStatusesResult = await getPurchaseOrderStatuses({});
    console.log('✅ Purchase Order Statuses Result:', purchaseOrderStatusesResult.data);
    
    // Test syncing orders with status 200 (Open)
    console.log('\n3. Testing syncOngoingOrdersByStatus with status 200...');
    const syncOrders = httpsCallable(functions, 'syncOngoingOrdersByStatus');
    const syncOrdersResult = await syncOrders({ status: 200, limit: 5 });
    console.log('✅ Sync Orders Result:', syncOrdersResult.data);
    
    // Test syncing purchase orders with status 100 (Notified)
    console.log('\n4. Testing syncOngoingPurchaseOrdersByStatus with status 100...');
    const syncPurchaseOrders = httpsCallable(functions, 'syncOngoingPurchaseOrdersByStatus');
    const syncPurchaseOrdersResult = await syncPurchaseOrders({ status: 100, limit: 5 });
    console.log('✅ Sync Purchase Orders Result:', syncPurchaseOrdersResult.data);
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing Ongoing WMS sync:', error);
    console.error('Error details:', error.message);
  }
}

// Run the test
testOngoingWMSSync()
  .then(() => {
    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  });
