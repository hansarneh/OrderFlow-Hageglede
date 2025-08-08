import { initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Firebase config
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
  try {
    console.log('🔍 Testing Ongoing WMS sync to verify separate collections...');
    
    // Test 1: Get order statuses
    console.log('\n1. Getting available order statuses...');
    const getOrderStatuses = httpsCallable(functions, 'getOngoingOrderStatuses');
    const statusesResult = await getOrderStatuses({});
    console.log('✅ Order statuses:', statusesResult.data);
    
    // Test 2: Sync orders with status 200 (Open)
    console.log('\n2. Syncing orders with status 200 (Open)...');
    const syncOrders = httpsCallable(functions, 'syncOngoingOrdersByStatus');
    const syncResult = await syncOrders({ 
      status: 200, 
      limit: 10 
    });
    console.log('✅ Sync result:', syncResult.data);
    
    // Test 3: Check if collections were created
    console.log('\n3. Checking Firestore collections...');
    console.log('📊 Expected collections:');
    console.log('   - customerOrders (WooCommerce orders)');
    console.log('   - orderLines (WooCommerce order lines)');
    console.log('   - ongoingOrders (Ongoing WMS orders) - NEW!');
    console.log('   - ongoingOrderLines (Ongoing WMS order lines) - NEW!');
    
    console.log('\n🎯 Next steps:');
    console.log('1. Check Firebase Console → Firestore Database');
    console.log('2. Look for ongoingOrders and ongoingOrderLines collections');
    console.log('3. Verify data is being saved to correct collections');
    
  } catch (error) {
    console.error('❌ Error testing Ongoing WMS sync:', error);
  }
}

// Run the test
testOngoingWMSSync();
