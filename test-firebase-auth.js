import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

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
const auth = getAuth(app);

async function testFirebaseAuth(email, password) {
  try {
    console.log('Testing Firebase authentication...');
    console.log('Email:', email);
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('✅ Authentication successful!');
    console.log('User ID:', userCredential.user.uid);
    console.log('User Email:', userCredential.user.email);
    
    return true;
  } catch (error) {
    console.error('❌ Authentication failed:');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    // Common error codes
    switch (error.code) {
      case 'auth/user-not-found':
        console.log('User does not exist');
        break;
      case 'auth/wrong-password':
        console.log('Wrong password');
        break;
      case 'auth/invalid-email':
        console.log('Invalid email format');
        break;
      case 'auth/too-many-requests':
        console.log('Too many failed attempts');
        break;
      default:
        console.log('Other authentication error');
    }
    
    return false;
  }
}

// Test with your credentials
// Replace with your actual email and password
const testEmail = process.argv[2] || 'your-email@example.com';
const testPassword = process.argv[3] || 'your-password';

console.log('Firebase Auth Test');
console.log('==================');
testFirebaseAuth(testEmail, testPassword)
  .then(success => {
    console.log('\nTest completed:', success ? 'SUCCESS' : 'FAILED');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test error:', error);
    process.exit(1);
  });
