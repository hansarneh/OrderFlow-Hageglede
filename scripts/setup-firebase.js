#!/usr/bin/env node

/**
 * This script helps set up Firebase authentication using a service account key.
 * It guides the user through the process of creating and configuring a service account.
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n🔥 Firebase Service Account Setup Helper 🔥\n');
console.log('This script will help you set up Firebase authentication using a service account key.\n');

console.log('Step 1: Create a Service Account Key in Google Cloud Console');
console.log('  - Go to https://console.cloud.google.com/');
console.log('  - Navigate to your project');
console.log('  - Go to "IAM & Admin" > "Service Accounts"');
console.log('  - Create a new service account or select an existing one');
console.log('  - Grant it the necessary Firebase roles (Firebase Admin, etc.)');
console.log('  - Create and download a new JSON key\n');

rl.question('Have you downloaded the service account key? (y/n): ', (answer) => {
  if (answer.toLowerCase() !== 'y') {
    console.log('\n⚠️ Please download the service account key before continuing.');
    console.log('Run this script again after you have downloaded the key.');
    rl.close();
    return;
  }

  rl.question('\nEnter the path to your service account key JSON file: ', (keyPath) => {
    const absolutePath = path.resolve(keyPath);
    
    try {
      // Check if the file exists
      if (!fs.existsSync(absolutePath)) {
        console.log(`\n❌ File not found: ${absolutePath}`);
        rl.close();
        return;
      }

      // Validate that it's a JSON file
      try {
        const keyData = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
        if (!keyData.type || keyData.type !== 'service_account') {
          console.log('\n❌ The file does not appear to be a valid service account key.');
          rl.close();
          return;
        }
        
        // Read the file content
        const keyContent = fs.readFileSync(absolutePath, 'utf8');
        
        // Create or update .env file
        const envPath = path.join(process.cwd(), '.env');
        let envContent = '';
        
        if (fs.existsSync(envPath)) {
          envContent = fs.readFileSync(envPath, 'utf8');
        }

        // Update FIREBASE_SA_KEY_JSON in .env
        if (envContent.includes('FIREBASE_SA_KEY_JSON=')) {
          // Replace existing value
          envContent = envContent.replace(
            /FIREBASE_SA_KEY_JSON=.*/,
            `FIREBASE_SA_KEY_JSON=${JSON.stringify(keyContent)}`
          );
        } else {
          // Add new entry
          envContent += `\n# Google Application Credentials JSON\nFIREBASE_SA_KEY_JSON=${JSON.stringify(keyContent)}\n`;
        }

        fs.writeFileSync(envPath, envContent);
        console.log(`\n✅ Updated .env file with FIREBASE_SA_KEY_JSON`);

        console.log('\n🎉 Setup complete! You can now use Firebase with service account authentication.');
        console.log('\nTo deploy Firebase functions, run:');
        console.log('  npm run firebase:deploy');

        rl.close();
      } catch (e) {
        console.log('\n❌ The file is not valid JSON.');
        rl.close();
        return;
      }
    } catch (error) {
      console.error('\n❌ An error occurred:', error.message);
      rl.close();
    }
  });
});