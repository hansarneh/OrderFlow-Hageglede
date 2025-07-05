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
import os from 'os'; // Import the 'os' module for temporary directory access

// Load environment variables from .env file
dotenv.config();

console.log('\n🔥 Firebase Deployment Helper 🔥\n');

let credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
let tempKeyFileCreated = false; // Flag to know if we created a temporary file

// NEW LOGIC: Check for service account JSON directly from an environment variable
const serviceAccountJsonContent = process.env.FIREBASE_SA_KEY_JSON;

if (!credentialsPath && serviceAccountJsonContent) {
  console.log('💡 Found service account JSON content in FIREBASE_SA_KEY_JSON environment variable.');
  try {
    // Parse to validate and ensure it's JSON
    JSON.parse(serviceAccountJsonContent);

    // Create a temporary file to store the service account key
    const tempDir = os.tmpdir(); // Get the system's temporary directory
    const tempFileName = `temp-firebase-key-${Date.now()}.json`; // Unique name
    credentialsPath = path.join(tempDir, tempFileName);

    fs.writeFileSync(credentialsPath, serviceAccountJsonContent, 'utf8');
    tempKeyFileCreated = true;
    console.log(`✅ Created temporary service account key file at: ${credentialsPath}`);

    // Set GOOGLE_APPLICATION_CREDENTIALS to point to this temporary file for the CLI
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;

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

// Check if the credentials file exists (this will now check the temporary file if created)
if (!fs.existsSync(absoluteCredentialsPath)) {
  console.error(`❌ Service account key file not found at: ${absoluteCredentialsPath}`);
  console.error('Please make sure the file exists and the path is correct.');
  process.exit(1);
}

// Validate that it's a JSON file with the expected structure
try {
  const keyData = JSON.parse(fs.readFileSync(absoluteCredentialsPath, 'utf8'));
  if (!keyData.type || keyData.type !== 'service_account') {
    console.error('❌ The file does not appear to be a valid service account key.');
    process.exit(1);
  }
  console.log(`✅ Found valid service account key: ${path.basename(absoluteCredentialsPath)}`);
  console.log(`📧 Service account email: ${keyData.client_email}`);
  console.log('✅ Using service account key for authentication');
} catch (e) {
  console.error('❌ The service account key file is not valid JSON or could not be read.');
  process.exit(1);
}

console.log('🚀 Running Firebase deploy command...'); 
console.log('GOOGLE_APPLICATION_CREDENTIALS:', absoluteCredentialsPath);
console.log('Checking if file exists:', fs.existsSync(absoluteCredentialsPath));
console.log('File size:', fs.statSync(absoluteCredentialsPath).size, 'bytes');

try {
  // First, try a simpler command to test authentication
  console.log('Testing authentication with a simpler command...');
  execSync('firebase projects:list --non-interactive', { 
    stdio: 'inherit',
    env: {
      ...process.env, // Pass all current environment variables
      GOOGLE_APPLICATION_CREDENTIALS: absoluteCredentialsPath // Ensure this is explicitly set for the child process
    }
  });
  
  console.log('✅ Authentication successful! Now attempting deployment...');
  
  // Run the Firebase deploy command with explicit project ID and token authentication
  execSync('firebase deploy --only functions --project order-flow-bolt --non-interactive', { 
    stdio: 'inherit',
    env: {
      ...process.env, // Pass all current environment variables
      GOOGLE_APPLICATION_CREDENTIALS: absoluteCredentialsPath // Ensure this is explicitly set for the child process
    }
  });

  console.log('\n✅ Firebase deployment completed successfully!'); 
} catch (error) {
  console.error('\n❌ Firebase deployment failed:', error.message); 
  console.error('Command output:', error.stdout?.toString() || 'No stdout');
  console.error('Command error output:', error.stderr?.toString() || 'No stderr');
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