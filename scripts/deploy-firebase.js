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
import { readFileSync } from 'fs';

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
  console.log('🚀 Running Firebase deploy command...');
  console.log('GOOGLE_APPLICATION_CREDENTIALS:', absoluteCredentialsPath);
  console.log('Checking if file exists:', fs.existsSync(absoluteCredentialsPath));
  console.log('File size:', fs.statSync(absoluteCredentialsPath).size, 'bytes');
  
  // Export the credentials path directly in the command to ensure it's available
  const deployCommand = `firebase deploy --only functions --project order-flow-bolt --non-interactive`;
  
  // Run the Firebase deploy command
  execSync(deployCommand, { 
    stdio: 'inherit',
    env: {
      ...process.env,
      GOOGLE_APPLICATION_CREDENTIALS: absoluteCredentialsPath
    }
  });

  console.log('\n✅ Firebase deployment completed successfully!'); 
} catch (error) {
  console.error('\n❌ Firebase deployment failed:', error.message);
  
  // Provide more helpful error messages
  if (error.message.includes('Failed to authenticate') || error.message.includes('authentication')) {
    console.error('\n🔍 Authentication troubleshooting:');
    console.error('1. Verify your service account has the following roles in Google Cloud Console:');
    console.error('   - Firebase Admin');
    console.error('   - Service Account User');
    console.error('   - Cloud Functions Admin');
    console.error('2. Ensure the service account key JSON is complete and valid');
    console.error('3. Check that the Firebase project ID "order-flow-bolt" is correct');
    console.error('4. Verify the service account has access to the Firebase project');
    console.error('5. Try running the deployment from your local machine using deploy-local.js');
    
    // Try to provide more specific guidance
    try {
      const keyContent = fs.readFileSync(absoluteCredentialsPath, 'utf8');
      const keyData = JSON.parse(keyContent);
      console.error(`\n📧 Service account email: ${keyData.client_email}`);
      console.error(`🆔 Project ID in key: ${keyData.project_id}`);
      console.error(`🔑 Private key length: ${keyData.private_key ? keyData.private_key.length : 'missing'} characters`);
      
      if (keyData.project_id !== 'order-flow-bolt') {
        console.error('⚠️ WARNING: Project ID in service account key does not match target project!');
      }
      
      // Check if the key has the required fields
      const requiredFields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email', 'client_id'];
      const missingFields = requiredFields.filter(field => !keyData[field]);
      if (missingFields.length > 0) {
        console.error(`⚠️ WARNING: Service account key is missing required fields: ${missingFields.join(', ')}`);
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