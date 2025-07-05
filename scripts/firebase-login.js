#!/usr/bin/env node

/**
 * This script attempts to authenticate with Firebase using a service account key.
 * It's a diagnostic tool to help troubleshoot authentication issues.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import os from 'os';
import { GoogleAuth } from 'google-auth-library';

// Load environment variables from .env file
dotenv.config();

console.log('\n🔥 Firebase Authentication Test 🔥\n');

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
    console.log(`🆔 Project ID: ${keyData.project_id}`);
    console.log(`🔑 Private key length: ${keyData.private_key ? keyData.private_key.length : 'missing'} characters`);

  } catch (e) {
    console.error('❌ Failed to parse FIREBASE_SA_KEY_JSON content as valid JSON:', e.message);
    process.exit(1);
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
  // First, test Google Cloud authentication directly
  console.log('🔍 Testing Google Cloud authentication...');
  
  try {
    const auth = new GoogleAuth({
      keyFile: absoluteCredentialsPath,
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    
    const token = await auth.getAccessToken();
    console.log(`✅ Successfully obtained Google access token`);
    
    // Get project ID from the auth client
    const projectId = await auth.getProjectId();
    console.log(`✅ Authenticated for project: ${projectId}`);
    
  } catch (authError) {
    console.error(`❌ Google Cloud authentication failed: ${authError.message}`);
    throw authError;
  }

  // Test Firebase CLI access with the service account
  console.log('🔍 Testing Firebase CLI access...');
  
  // Set environment variable and test Firebase CLI
  process.env.GOOGLE_APPLICATION_CREDENTIALS = absoluteCredentialsPath;
  
  try {
    const result = execSync('npx firebase projects:list --non-interactive', {
      stdio: 'pipe',
      shell: true,
      env: {
        ...process.env,
        GOOGLE_APPLICATION_CREDENTIALS: absoluteCredentialsPath
      },
      timeout: 30000 // 30 second timeout
    });
    
    console.log('\n✅ Firebase CLI authentication successful! Firebase projects:');
    console.log(result.toString());
    
  } catch (firebaseError) {
    console.error('\n❌ Firebase CLI authentication failed');
    
    // Try to get more specific error information
    if (firebaseError.stderr) {
      console.error('Error output:', firebaseError.stderr.toString());
    }
    if (firebaseError.stdout) {
      console.error('Standard output:', firebaseError.stdout.toString());
    }
    
    throw firebaseError;
  }
  
} catch (error) {
  console.error('\n❌ Authentication test failed:', error.message);
  
  // Check if the environment variable is set in the current process
  console.error('\n🔍 Environment variable check:');
  console.error(`GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS || 'not set'}`);
  console.error(`Using credentials path: ${absoluteCredentialsPath}`);
  console.error(`File exists: ${fs.existsSync(absoluteCredentialsPath)}`);
  
  console.error('\n🔍 Authentication troubleshooting:');
  console.error('1. Verify your service account has the following roles in Google Cloud Console:');
  console.error('   - Firebase Admin');
  console.error('   - Service Account User');
  console.error('   - Cloud Functions Admin');
  console.error('   - Firebase Service Management Service Agent');
  console.error('2. Ensure the service account key JSON is complete and valid');
  console.error('3. Check that the Firebase project ID is correct');
  console.error('4. Verify the service account has access to the Firebase project');
  console.error('5. Make sure Firebase is enabled for your Google Cloud project');
  
  // Try to provide more specific guidance
  try {
    const keyContent = fs.readFileSync(absoluteCredentialsPath, 'utf8');
    const keyData = JSON.parse(keyContent);
    console.error(`\n📧 Service account email: ${keyData.client_email}`);
    console.error(`🆔 Project ID in key: ${keyData.project_id}`);
    
    // Check if the key has the required fields
    const requiredFields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email', 'client_id'];
    const missingFields = requiredFields.filter(field => !keyData[field]);
    if (missingFields.length > 0) {
      console.error(`⚠️ WARNING: Service account key is missing required fields: ${missingFields.join(', ')}`);
    } else {
      console.error('✅ Service account key contains all required fields');
    }
  } catch (e) {
    console.error('Could not read service account details for debugging');
  }
  
  console.error('\n📋 Next steps to resolve:');
  console.error('1. Go to Google Cloud Console (https://console.cloud.google.com)');
  console.error('2. Navigate to IAM & Admin > IAM');
  console.error('3. Find your service account: ha-152@order-flow-bolt.iam.gserviceaccount.com');
  console.error('4. Click "Edit" and add the required roles listed above');
  console.error('5. Save changes and wait a few minutes for permissions to propagate');
  console.error('6. Run this script again to test authentication');
  
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