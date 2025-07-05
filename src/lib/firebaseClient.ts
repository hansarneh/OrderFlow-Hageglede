import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, enableNetwork, disableNetwork } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getDatabase, ref, onValue, set, serverTimestamp } from 'firebase/database';

// Your web app's Firebase configuration
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

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const database = getDatabase(app);

// Enable network connectivity for Firestore
enableNetwork(db).catch((error) => {
  console.warn('Failed to enable Firestore network:', error);
});

// Add connection state monitoring
let isOnline = navigator.onLine;

const handleOnline = () => {
  isOnline = true;
  enableNetwork(db).catch((error) => {
    console.warn('Failed to enable Firestore network:', error);
  });
};

const handleOffline = () => {
  isOnline = false;
  disableNetwork(db).catch((error) => {
    console.warn('Failed to disable Firestore network:', error);
  });
};

window.addEventListener('online', handleOnline);
window.addEventListener('offline', handleOffline);

// Test connectivity by writing to a special location in Realtime Database
export function testDatabaseConnectivity(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const connectivityRef = ref(database, '.info/connected');
      const unsubscribe = onValue(connectivityRef, (snapshot) => {
        unsubscribe(); // Only need one update
        resolve(snapshot.val() === true);
      }, (error) => {
        console.error('Database connectivity test error:', error);
        resolve(false);
      });
      
      // Set a timeout in case onValue never fires
      setTimeout(() => {
        unsubscribe();
        resolve(false);
      }, 5000);
    } catch (error) {
      console.error('Error setting up database connectivity test:', error);
      resolve(false);
    }
  });
}

// Ping function to test if we can write to the database
export async function pingDatabase(): Promise<boolean> {
  try {
    const pingRef = ref(database, `connectivity_tests/${Date.now()}`);
    await set(pingRef, {
      timestamp: serverTimestamp(),
      client: 'web',
      userAgent: navigator.userAgent
    });
    return true;
  } catch (error) {
    console.error('Ping database error:', error);
    return false;
  }
}

// Export connection state
export const getConnectionState = () => isOnline;

export default app;