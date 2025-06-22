# LogiFlow - Logistics Dashboard

A comprehensive logistics dashboard for managing inventory, orders, and shipments.

## Setup Instructions

### Firebase Authentication

This project uses Firebase for authentication and backend services. To set up Firebase authentication:

1. **Create a Service Account Key:**
   - Go to your [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to your project
   - Go to "IAM & Admin" > "Service Accounts"
   - Create a new service account or select an existing one
   - Grant it the necessary Firebase roles:
     - **Firebase Admin** (recommended - includes all necessary permissions)
     - Or individually: **Cloud Functions Admin**, **Service Account User**, **Firebase Rules Admin**
   - Create and download a new JSON key

2. **Configure Environment Variables:**
   - Copy `.env.example` to `.env`
   - Fill in your Firebase configuration values
   - Set `GOOGLE_APPLICATION_CREDENTIALS` to the path of your service account key JSON file
   - Or set `FIREBASE_SA_KEY_JSON` to the entire JSON content of your service account key

3. **Verify Service Account Permissions:**
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

1. **Check Service Account Permissions:**
   - Verify your service account has the **Firebase Admin** role
   - Go to Google Cloud Console > IAM & Admin > IAM
   - Find your service account and ensure it has proper roles

2. **Verify Service Account Key:**
   - Make sure your service account key file exists and is correctly referenced
   - Check that the JSON content is valid and complete
   - Ensure the service account has not been deleted or disabled