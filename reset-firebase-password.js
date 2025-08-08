import { initializeApp } from 'firebase/app';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';

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

async function resetPassword(email) {
  try {
    console.log('Sending password reset email to:', email);
    
    await sendPasswordResetEmail(auth, email);
    console.log('✅ Password reset email sent successfully!');
    console.log('Check your email for the reset link.');
    
    return true;
  } catch (error) {
    console.error('❌ Password reset failed:');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    switch (error.code) {
      case 'auth/user-not-found':
        console.log('User does not exist with this email');
        break;
      case 'auth/invalid-email':
        console.log('Invalid email format');
        break;
      case 'auth/too-many-requests':
        console.log('Too many reset attempts. Try again later.');
        break;
      default:
        console.log('Other error occurred');
    }
    
    return false;
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.log('Usage: node reset-firebase-password.js "your-email@example.com"');
  console.log('Example: node reset-firebase-password.js "admin@logistics.com"');
  process.exit(1);
}

console.log('Firebase Password Reset');
console.log('======================');
resetPassword(email)
  .then(success => {
    console.log('\nReset process:', success ? 'SUCCESS' : 'FAILED');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Script error:', error);
    process.exit(1);
  });
