#!/usr/bin/env node

/**
 * This script handles Firebase deployment using a service account key.
 * It checks for the presence of the service account key and sets up the
 * GOOGLE_APPLICATION_CREDENTIALS environment variable before deploying.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import os from 'os';

// Load environment variables from .env file
dotenv.config();

console.log('\n🔥 Firebase Deployment Helper 🔥\n');

let credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
let tempKeyFileCreated = false;

// Check for service account JSON directly from an environment variable
const serviceAccountJsonContent = process.env.FIREBASE_SA_KEY_JSON;

if (!credentialsPath && serviceAccountJsonContent) {
  console.log('💡 Found service account JSON content in FIREBASE_SA_KEY_JSON environment variable.');
  try {
    // Parse to validate and ensure it's JSON
    const keyData = JSON.parse(serviceAccountJsonContent);
    
    // Validate that it's a service account key
    if (!keyData.type || keyData.type !== 'service_account') {
      console.error('❌ The JSON content does not appear to be a valid service account key.');
      process.exit(1);
    }

    // Create a temporary file to store the service account key
    const tempDir = os.tmpdir();
    const tempFileName = `temp-firebase-key-${Date.now()}.json`;
    credentialsPath = path.join(tempDir, tempFileName);

    fs.writeFileSync(credentialsPath, serviceAccountJsonContent, 'utf8');
    tempKeyFileCreated = true;
    console.log(`✅ Created temporary service account key file at: ${credentialsPath}`);
    console.log(`📧 Service account email: ${keyData.client_email}`);

  } catch (e) {
    console.error('❌ Failed to parse FIREBASE_SA_KEY_JSON content as valid JSON:', e.message);
    process.exit(1);
  }
}

if (!credentialsPath) {
  console.error('❌ Neither GOOGLE_APPLICATION_CREDENTIALS environment variable nor FIREBASE_SA_KEY_JSON content is set.');
  console.error('Please make sure you have configured your service account key.');
  process.exit(1);
}

// Resolve the path (in case it's relative)
const absoluteCredentialsPath = path.resolve(credentialsPath);

// Check if the credentials file exists
if (!fs.existsSync(absoluteCredentialsPath)) {
  console.error(`❌ Service account key file not found at: ${absoluteCredentialsPath}`);
  console.error('Please make sure the file exists and the path is correct.');
  process.exit(1);
}

console.log('✅ Using service account key for authentication');
console.log('🚀 Running Firebase deploy command...');

try {
  // Set up environment for Firebase CLI
  const deployEnv = {
    ...process.env,
    GOOGLE_APPLICATION_CREDENTIALS: absoluteCredentialsPath,
    // Explicitly set Firebase project
    FIREBASE_PROJECT: 'order-flow-bolt'
  };

  // First, authenticate using the service account
  console.log('🔐 Authenticating with service account...');
  execSync(`firebase auth:login --service-account "${absoluteCredentialsPath}"`, { 
    stdio: 'inherit',
    env: deployEnv
  });

  console.log('✅ Authentication successful! Now attempting deployment...');
  
  // Run the Firebase deploy command
  execSync('firebase deploy --only functions --project order-flow-bolt --non-interactive', { 
    stdio: 'inherit',
    env: deployEnv
  });

  console.log('\n✅ Firebase deployment completed successfully!'); 
} catch (error) {
  console.error('\n❌ Firebase deployment failed:', error.message);
  
  // Provide more helpful error messages
  if (error.message.includes('Failed to authenticate')) {
    console.error('\n🔍 Authentication troubleshooting:');
    console.error('1. Verify your service account has the following roles in Google Cloud Console:');
    console.error('   - Firebase Admin (or)');
    console.error('   - Cloud Functions Admin + Service Account User + Firebase Rules Admin');
    console.error('2. Ensure the service account key JSON is complete and valid');
    console.error('3. Check that the Firebase project ID "order-flow-bolt" is correct');
  }
  
  process.exit(1);
} finally {
  // Clean up the temporary file if we created one
  if (tempKeyFileCreated && fs.existsSync(absoluteCredentialsPath)) {
    try {
      fs.unlinkSync(absoluteCredentialsPath);
      console.log(`🗑️ Cleaned up temporary key file: ${absoluteCredentialsPath}`);
    } catch (e) {
      console.warn(`⚠️ Could not clean up temporary key file: ${absoluteCredentialsPath} - ${e.message}`);
    }
  }
}