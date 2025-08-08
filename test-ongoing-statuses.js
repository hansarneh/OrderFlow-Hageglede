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

async function getOngoingStatuses() {
  try {
    console.log('🔍 Getting Ongoing WMS order statuses...');

    // Test 1: Get order statuses
    console.log('\n1. Getting available order statuses...');
    const getOrderStatuses = httpsCallable(functions, 'getOngoingOrderStatuses');
    const statusesResult = await getOrderStatuses({});
    console.log('✅ Order statuses:', statusesResult.data);

    // Test 2: Get purchase order statuses
    console.log('\n2. Getting available purchase order statuses...');
    const getPurchaseOrderStatuses = httpsCallable(functions, 'getOngoingPurchaseOrderStatuses');
    const purchaseStatusesResult = await getPurchaseOrderStatuses({});
    console.log('✅ Purchase order statuses:', purchaseStatusesResult.data);

    console.log('\n📊 Summary of statuses:');
    console.log('Order Statuses:', statusesResult.data);
    console.log('Purchase Order Statuses:', purchaseStatusesResult.data);

  } catch (error) {
    console.error('❌ Error getting Ongoing WMS statuses:', error);
  }
}

// Run the test
getOngoingStatuses();
