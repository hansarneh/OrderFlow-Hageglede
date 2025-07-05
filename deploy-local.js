#!/usr/bin/env node

/**
 * This script handles Firebase deployment using a service account key.
 * It's designed to be run from a local terminal outside of bolt.new.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n🔥 Firebase Local Deployment Helper 🔥\n');

// Check if service account key file path is provided as argument
const args = process.argv.slice(2);
let serviceAccountPath = args[0];

if (!serviceAccountPath) {
  console.error('❌ Please provide the path to your service account key file as an argument.');
  console.error('Example: node deploy-local.js /path/to/service-account-key.json');
  process.exit(1);
}

// Resolve the path (in case it's relative)
const absoluteCredentialsPath = path.resolve(serviceAccountPath);

// Check if the credentials file exists
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

try {
  // Run the Firebase deploy command with explicit project ID
  execSync(`firebase deploy --only functions --project order-flow-bolt --token-bypass --non-interactive`, { 
    stdio: 'inherit',
    env: {
      ...process.env, // Pass all current environment variables
      GOOGLE_APPLICATION_CREDENTIALS: absoluteCredentialsPath // Set the credentials path
    }
  });

  console.log('\n✅ Firebase deployment completed successfully!'); 
} catch (error) {
  console.error('\n❌ Firebase deployment failed:', error.message); 
  process.exit(1);
}