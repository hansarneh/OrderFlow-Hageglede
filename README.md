# LogiFlow - Logistics Dashboard

A comprehensive logistics dashboard for managing inventory, orders, and shipments.

## Setup Instructions

### Firebase Authentication

This project uses Firebase for authentication and backend services. To set up Firebase authentication:

1. **Generate a Firebase CI Token (Recommended for Deployments):**
   - On your local machine, run:
     ```bash
     firebase login:ci
     ```
   - This will open a browser window for authentication
   - After authenticating, it will output a token in your terminal
   - Copy this token and add it to your `.env` file as `FIREBASE_TOKEN=your_token_here`

2. **Alternative: Create a Service Account Key:**
   - Go to your [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to your project
   - Go to "IAM & Admin" > "Service Accounts"
   - Create a new service account or select an existing one
   - Grant it the necessary Firebase roles:
     - **Firebase Admin** (recommended - includes all necessary permissions)
     - Or individually: **Cloud Functions Admin**, **Service Account User**, **Firebase Rules Admin**
   - Create and download a new JSON key

3. **Configure Environment Variables:**
   - Copy `.env.example` to `.env`
   - Fill in your Firebase configuration values
   - Set `FIREBASE_TOKEN` to your CI token (preferred method)
   - Or set `GOOGLE_APPLICATION_CREDENTIALS` to the path of your service account key JSON file

4. **Verify Service Account Permissions:**
   - Ensure your service account has the **Firebase Admin** role in your Google Cloud Project
   - This role includes all necessary permissions for Firebase CLI operations
   - If you prefer granular permissions, ensure these roles are assigned:
     - Cloud Functions Admin
     - Service Account User
     - Firebase Rules Admin

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Deploy Firebase functions
npm run firebase:deploy
```

## Features

- User authentication and role-based access control
- Inventory management
- Order tracking and management
- Shipment planning and tracking
- Integration with WooCommerce and Rackbeat
- Real-time analytics and reporting

## Troubleshooting

### Firebase Authentication Issues

If you encounter authentication errors during deployment:

1. **Check Firebase Token:**
   - Verify that your `FIREBASE_TOKEN` is correctly set in your `.env` file
   - If the token has expired, generate a new one with `firebase login:ci`

2. **Check Service Account Permissions:**
   - Verify your service account has the **Firebase Admin** role
   - Go to Google Cloud Console > IAM & Admin > IAM
   - Find your service account and ensure it has proper roles

3. **Re-authenticate if needed:**
   - Run `firebase logout` followed by `firebase login` on your local machine
   - Then generate a new CI token with `firebase login:ci`