import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, enableNetwork, disableNetwork } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

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

// Export connection state
export const getConnectionState = () => isOnline;

export default app;