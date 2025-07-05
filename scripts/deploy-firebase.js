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

// Check if we have a service account key file in the project root
if (!credentialsPath) {
  const projectKeyFile = 'order-flow-bolt-4ece69eb63c3.json';
  if (fs.existsSync(projectKeyFile)) {
    credentialsPath = path.resolve(projectKeyFile);
    console.log(`💡 Found service account key file in project root: ${projectKeyFile}`);
  }
}

if (!credentialsPath) {
  console.error('❌ No service account credentials found.');
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

try {
  // First, try to activate the service account with gcloud (if available)
  console.log('🔐 Activating service account...');
  try {
    execSync(`gcloud auth activate-service-account --key-file="${absoluteCredentialsPath}" --project=order-flow-bolt`, { 
      stdio: 'pipe'
    });
    console.log('✅ Service account activated successfully');
  } catch (gcloudError) {
    console.log('⚠️ gcloud not available or failed, proceeding with Firebase CLI authentication...');
  }

  // Set up environment for Firebase CLI
  const deployEnv = {
    ...process.env,
    GOOGLE_APPLICATION_CREDENTIALS: absoluteCredentialsPath,
    FIREBASE_PROJECT: 'order-flow-bolt'
  };

  console.log('🚀 Running Firebase deploy command...');

  // Try using the service account token directly with Firebase CLI
  try {
    execSync('firebase use order-flow-bolt --token "$(gcloud auth print-access-token)" 2>/dev/null || firebase use order-flow-bolt', { 
      stdio: 'pipe',
      env: deployEnv
    });
  } catch (useError) {
    console.log('⚠️ Could not set Firebase project with token, proceeding...');
  }

  // Run the Firebase deploy command with enhanced authentication
  execSync('firebase deploy --only functions --project order-flow-bolt --non-interactive --force', { 
    stdio: 'inherit',
    env: deployEnv
  });

  console.log('\n✅ Firebase deployment completed successfully!'); 
} catch (error) {
  console.error('\n❌ Firebase deployment failed:', error.message);
  
  // Provide more helpful error messages
  if (error.message.includes('Failed to authenticate') || error.message.includes('authentication')) {
    console.error('\n🔍 Authentication troubleshooting:');
    console.error('1. Verify your service account has the following roles in Google Cloud Console:');
    console.error('   - Firebase Admin (recommended) OR');
    console.error('   - Cloud Functions Admin + Service Account User + Firebase Rules Admin');
    console.error('2. Ensure the service account key JSON is complete and valid');
    console.error('3. Check that the Firebase project ID "order-flow-bolt" is correct');
    console.error('4. Try running: gcloud auth activate-service-account --key-file=order-flow-bolt-4ece69eb63c3.json');
    console.error('5. Verify the service account has access to the Firebase project');
    
    // Try to provide more specific guidance
    try {
      const keyContent = fs.readFileSync(absoluteCredentialsPath, 'utf8');
      const keyData = JSON.parse(keyContent);
      console.error(`\n📧 Service account email: ${keyData.client_email}`);
      console.error(`🆔 Project ID in key: ${keyData.project_id}`);
      
      if (keyData.project_id !== 'order-flow-bolt') {
        console.error('⚠️ WARNING: Project ID in service account key does not match target project!');
      }
    } catch (e) {
      console.error('Could not read service account details for debugging');
    }
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