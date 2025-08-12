const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();
const fetch = require("node-fetch");

// Cloud Tasks imports
const {CloudTasksClient} = require('@google-cloud/tasks');
const tasksClient = new CloudTasksClient();

// Cloud Tasks configuration
const PROJECT_ID = process.env.GCLOUD_PROJECT || 'order-flow-bolt';
const LOCATION = 'us-central1';
const QUEUE_NAME = 'ongoing-wms-sync';

// Helper function to get or create the Cloud Tasks queue
async function getOrCreateQueue() {
  const parent = tasksClient.locationPath(PROJECT_ID, LOCATION);
  const queuePath = tasksClient.queuePath(PROJECT_ID, LOCATION, QUEUE_NAME);
  
  try {
    // Try to get the existing queue
    await tasksClient.getQueue({ name: queuePath });
    console.log(`Queue ${QUEUE_NAME} already exists`);
  } catch (error) {
    if (error.code === 5) { // NOT_FOUND
      // Create the queue
      const queue = {
        name: queuePath,
        rateLimits: {
          maxConcurrentDispatches: 10, // Process 10 tasks concurrently
          maxDispatchesPerSecond: 5,   // Max 5 tasks per second
        },
        retryConfig: {
          maxAttempts: 5,
          maxRetryDuration: { seconds: 3600 }, // 1 hour max retry
          minBackoff: { seconds: 10 },         // Start with 10s backoff
          maxBackoff: { seconds: 300 },        // Max 5min backoff
          maxDoublings: 5,                     // Double backoff up to 5 times
        },
      };
      
      const [createdQueue] = await tasksClient.createQueue({
        parent,
        queue: queue,
      });
      console.log(`Created queue: ${createdQueue.name}`);
    } else {
      throw error;
    }
  }
  
  return queuePath;
}

// Helper function to remove undefined values from objects
function removeUndefinedValues(obj) {
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (typeof obj === 'object' && !Array.isArray(obj)) {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = removeUndefinedValues(value);
      }
    }
    return cleaned;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefinedValues(item));
  }
  
  return obj;
}

// Function to delete a user (for admin use)
exports.deleteUser = functions.https.onCall(async (data, context) => {
  // Check if the caller is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  // Check if the caller is an admin
  const callerProfile = await db.collection("profiles").doc(context.auth.uid).get();
  if (!callerProfile.exists || callerProfile.data().role !== "admin") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only admin users can delete other users."
    );
  }

  const userId = data.userId;
  if (!userId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function must be called with a userId."
    );
  }

  // Prevent admin from deleting themselves
  if (userId === context.auth.uid) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Cannot delete your own account."
    );
  }

  try {
    // Delete the user's profile document
    await db.collection("profiles").doc(userId).delete();
    
    // Delete the user from Firebase Auth
    await admin.auth().deleteUser(userId);
    
    return { success: true, message: "User deleted successfully" };
  } catch (error) {
    console.error("Error deleting user:", error);
    throw new functions.https.HttpsError(
      "internal",
      "An error occurred while deleting the user.",
      error
    );
  }
});

// Function to sync WooCommerce products
exports.syncWooCommerceProducts = functions.https.onCall(async (data, context) => {
  // Check if the caller is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  // Get WooCommerce credentials for this user
  const integrationsSnapshot = await db.collection("integrations")
    .where("userId", "==", context.auth.uid)
    .where("integrationType", "==", "woocommerce")
    .limit(1)
    .get();

  if (integrationsSnapshot.empty) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "WooCommerce integration not configured. Please add your WooCommerce credentials in Settings."
    );
  }

  const credentials = integrationsSnapshot.docs[0].data().credentials;

  // Validate credentials
  if (!credentials.storeUrl || !credentials.consumerKey || !credentials.consumerSecret) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Incomplete WooCommerce credentials. Please check your settings."
    );
  }

  // In a real implementation, you would make API calls to WooCommerce here
  // For this example, we'll just return a success message
  return {
    success: true,
    message: "Products sync initiated. This would normally sync products from WooCommerce."
  };
});

// Function to sync WooCommerce orders
exports.syncWooCommerceOrders = functions.https.onCall(async (data, context) => {
  // Check if the caller is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  // Get WooCommerce credentials for this user
  const integrationsSnapshot = await db.collection("integrations")
    .where("userId", "==", context.auth.uid)
    .where("integrationType", "==", "woocommerce")
    .limit(1)
    .get();

  if (integrationsSnapshot.empty) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "WooCommerce integration not configured. Please add your WooCommerce credentials in Settings."
    );
  }

  const credentials = integrationsSnapshot.docs[0].data().credentials;

  // Validate credentials
  if (!credentials.storeUrl || !credentials.consumerKey || !credentials.consumerSecret) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Incomplete WooCommerce credentials. Please check your settings."
    );
  }

  try {
    // Normalize store URL
    let baseUrl = credentials.storeUrl.replace(/\/$/, "");
    if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
      baseUrl = "https://" + baseUrl;
    }

    // Create basic auth header
    const auth = Buffer.from(`${credentials.consumerKey}:${credentials.consumerSecret}`).toString("base64");
    
    // Fetch orders from WooCommerce API
    const apiUrl = `${baseUrl}/wp-json/wc/v3/orders?status=processing,delvis-levert&per_page=100`;
    
    console.log(`Fetching orders from: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("WooCommerce API error:", response.status, errorText);
      
      if (response.status === 401) {
        throw new functions.https.HttpsError(
          "unauthenticated",
          "Invalid WooCommerce credentials. Please check your Consumer Key and Consumer Secret."
        );
      }
      
      throw new functions.https.HttpsError(
        "internal",
        `WooCommerce API error: ${response.status} ${response.statusText}`
      );
    }

    const orders = await response.json();
    console.log(`Fetched ${orders.length} orders from WooCommerce`);

    // Process and store orders in Firestore
    let syncedCount = 0;
    let errorCount = 0;

    for (const wooOrder of orders) {
      try {
        // Determine customer name
        const customerName = wooOrder.billing.company || 
                            `${wooOrder.billing.first_name} ${wooOrder.billing.last_name}`.trim() ||
                            `Customer #${wooOrder.customer_id}`;

        // Calculate total items
        const totalItems = wooOrder.line_items.reduce((sum, item) => sum + item.quantity, 0);

        // Extract delivery date from meta_data
        let deliveryDate = null;
        if (wooOrder.meta_data) {
          const deliveryDateMeta = wooOrder.meta_data.find(meta => meta.key === "_delivery_date");
          if (deliveryDateMeta && deliveryDateMeta.value) {
            // Convert DD.MM.YYYY to YYYY-MM-DD
            const dateParts = deliveryDateMeta.value.split(".");
            if (dateParts.length === 3) {
              deliveryDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
            }
          }
        }

        // Extract delivery type from meta_data
        let deliveryType = null;
        if (wooOrder.meta_data) {
          const deliveryTypeMeta = wooOrder.meta_data.find(meta => meta.key === "_delivery_type");
          if (deliveryTypeMeta) {
            deliveryType = deliveryTypeMeta.value;
          }
        }

        // Extract shipping method title
        let shippingMethodTitle = null;
        if (wooOrder.shipping_lines && wooOrder.shipping_lines.length > 0) {
          shippingMethodTitle = wooOrder.shipping_lines[0].method_title;
        }

        // Format billing address
        let billingAddress = null;
        if (wooOrder.billing && wooOrder.billing.address_1 && wooOrder.billing.postcode && wooOrder.billing.city) {
          billingAddress = `${wooOrder.billing.address_1}\n${wooOrder.billing.postcode} ${wooOrder.billing.city}`;
        }

        // Create or update order in Firestore
        const orderRef = db.collection("customerOrders").doc(wooOrder.id.toString());
        
        await orderRef.set({
          woocommerceOrderId: wooOrder.id,
          orderNumber: wooOrder.number,
          customerName: customerName,
          wooStatus: wooOrder.status,
          totalValue: parseFloat(wooOrder.total),
          totalItems: totalItems,
          dateCreated: wooOrder.date_created,
          lineItems: wooOrder.line_items,
          metaData: wooOrder.meta_data || {},
          billingAddress: billingAddress,
          billingAddressJson: wooOrder.billing,
          permalink: `${baseUrl}/wp-admin/post.php?post=${wooOrder.id}&action=edit`,
          deliveryDate: deliveryDate,
          deliveryType: deliveryType,
          shippingMethodTitle: shippingMethodTitle,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Process order lines
        for (const lineItem of wooOrder.line_items) {
          const lineRef = db.collection("orderLines").doc(`${wooOrder.id}_${lineItem.id}`);
          
          // Extract meta_data for this line item
          const lineMetaData = {};
          if (lineItem.meta_data) {
            for (const meta of lineItem.meta_data) {
              lineMetaData[meta.key] = meta.value;
            }
          }
          
          await lineRef.set({
            orderId: orderRef.id,
            woocommerceLineItemId: lineItem.id,
            productId: lineItem.product_id,
            productName: lineItem.name,
            sku: lineItem.sku || "",
            quantity: lineItem.quantity,
            unitPrice: parseFloat(lineItem.price),
            totalPrice: parseFloat(lineItem.total),
            taxAmount: parseFloat(lineItem.total_tax),
            metaData: lineMetaData,
            deliveredQuantity: 0, // Default values
            deliveryStatus: "pending",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        }

        syncedCount++;
      } catch (error) {
        console.error(`Error processing order ${wooOrder.id}:`, error);
        errorCount++;
      }
    }

    return {
      success: true,
      message: `Successfully synced ${syncedCount} orders from WooCommerce`,
      statusFilter: "processing,delvis-levert",
      dateRange: "Last 200 days",
      syncedCount,
      errorCount
    };
  } catch (error) {
    console.error("Error syncing WooCommerce orders:", error);
    throw new functions.https.HttpsError(
      "internal",
      error.message || "Failed to sync orders from WooCommerce",
      error
    );
  }
});

// Function to fetch WooCommerce orders for the shipment planner
exports.fetchWooCommerceOrders = functions.https.onCall(async (data, context) => {
  // Check if the caller is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  // Get WooCommerce credentials for this user
  const integrationsSnapshot = await db.collection("integrations")
    .where("userId", "==", context.auth.uid)
    .where("integrationType", "==", "woocommerce")
    .limit(1)
    .get();

  if (integrationsSnapshot.empty) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "WooCommerce integration not configured. Please add your WooCommerce credentials in Settings."
    );
  }

  const credentials = integrationsSnapshot.docs[0].data().credentials;

  // Validate credentials
  if (!credentials.storeUrl || !credentials.consumerKey || !credentials.consumerSecret) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Incomplete WooCommerce credentials. Please check your settings."
    );
  }

  try {
    // Normalize store URL
    let baseUrl = credentials.storeUrl.replace(/\/$/, "");
    if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
      baseUrl = "https://" + baseUrl;
    }

    // Create basic auth header
    const auth = Buffer.from(`${credentials.consumerKey}:${credentials.consumerSecret}`).toString("base64");
    
    // Fetch orders from WooCommerce API
    const apiUrl = `${baseUrl}/wp-json/wc/v3/orders?status=processing,on-hold&per_page=100`;
    
    console.log(`Fetching orders from: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("WooCommerce API error:", response.status, errorText);
      
      if (response.status === 401) {
        throw new functions.https.HttpsError(
          "unauthenticated",
          "Invalid WooCommerce credentials. Please check your Consumer Key and Consumer Secret."
        );
      }
      
      throw new functions.https.HttpsError(
        "internal",
        `WooCommerce API error: ${response.status} ${response.statusText}`
      );
    }

    const wooOrders = await response.json();
    console.log(`Fetched ${wooOrders.length} orders from WooCommerce`);

    // Map WooCommerce orders to our CustomerOrder interface
    const customerOrders = wooOrders.map((wooOrder) => {
      // Determine customer name
      const customerName = wooOrder.billing.company || 
                          `${wooOrder.billing.first_name} ${wooOrder.billing.last_name}`.trim() ||
                          `Customer #${wooOrder.customer_id}`;

      // Map WooCommerce status to our status
      let status = "partially-planned";
      switch (wooOrder.status) {
        case "processing":
          status = "fully-planned";
          break;
        case "on-hold":
          status = "partially-planned";
          break;
        default:
          status = "partially-planned";
      }

      // Determine priority based on order value
      const orderValue = parseFloat(wooOrder.total);
      let priority = "medium";
      if (orderValue > 1000) {
        priority = "high";
      } else if (orderValue > 500) {
        priority = "medium";
      } else {
        priority = "low";
      }

      // Calculate total items
      const totalItems = wooOrder.line_items.reduce((sum, item) => sum + item.quantity, 0);

      // Generate placeholder data for fields not available in WooCommerce
      const relatedPOs = ["1017", "1031", "1034"].slice(0, Math.floor(Math.random() * 3) + 1);
      const expectedShipDates = status === "at-risk" 
        ? ["OVERDUE - " + new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })]
        : status === "partially-planned"
        ? ["01/03/2026", "01/04/2026", "PO MISSING"]
        : ["01/03/2026", "01/04/2026", "01/05/2026"];

      return {
        id: wooOrder.id.toString(),
        orderNumber: wooOrder.number,
        customer: customerName,
        wooStatus: wooOrder.status, // Add original WooCommerce status
        relatedPOs,
        expectedShipDates,
        multipleShipments: totalItems > 5, // Assume multiple shipments for larger orders
        status,
        priority,
        value: orderValue,
        items: totalItems,
        createdDate: new Date(wooOrder.date_created).toISOString().split("T")[0]
      };
    });

    return {
      success: true,
      orders: customerOrders,
      totalCount: customerOrders.length
    };
  } catch (error) {
    console.error("Error fetching WooCommerce orders:", error);
    throw new functions.https.HttpsError(
      "internal",
      error.message || "Failed to fetch orders from WooCommerce",
      error
    );
  }
});

// Function to fetch Rackbeat purchase orders
exports.fetchRackbeatPurchaseOrders = functions.https.onCall(async (data, context) => {
  // Check if the caller is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  // Get Rackbeat credentials for this user
  const integrationsSnapshot = await db.collection("integrations")
    .where("userId", "==", context.auth.uid)
    .where("integrationType", "==", "rackbeat")
    .limit(1)
    .get();

  if (integrationsSnapshot.empty) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Rackbeat integration not configured. Please add your Rackbeat API key in Settings."
    );
  }

  const credentials = integrationsSnapshot.docs[0].data().credentials;

  // Validate credentials
  if (!credentials.apiKey) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Incomplete Rackbeat credentials. Please check your settings."
    );
  }

  // In a real implementation, you would make API calls to Rackbeat here
  // For this example, we'll just return a success message
  return {
    success: true,
    message: "Purchase orders sync initiated. This would normally sync purchase orders from Rackbeat.",
    purchaseOrders: []
  };
});

// Function to get orders at risk
exports.getOrdersAtRisk = functions.https.onCall(async (data, context) => {
  // Check if the caller is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  try {
    // Get all orders with processing or delvis-levert status
    const ordersSnapshot = await db.collection("customerOrders")
      .where("wooStatus", "in", ["processing", "delvis-levert"])
      .get();

    const orders = ordersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Process orders to identify those at risk
    // In a real implementation, you would check for backordered products and overdue delivery dates
    // For this example, we'll just return a placeholder response
    return {
      success: true,
      orders: orders,
      atRiskOrders: [],
      totalOrders: orders.length,
      totalAtRiskOrders: 0,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error("Error getting orders at risk:", error);
    throw new functions.https.HttpsError(
      "internal",
      "An error occurred while getting orders at risk.",
      error
    );
  }
});

// Create a user profile when a new user is created
exports.createUserProfile = functions.auth.user().onCreate(async (user) => {
  try {
    // Create a profile document for the new user
    await db.collection("profiles").doc(user.uid).set({
      name: user.displayName || user.email?.split("@")[0] || "New User",
      email: user.email,
      role: "operator", // Default role
      department: "General", // Default department
      status: "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`Created profile for user ${user.uid}`);
    return { success: true };
  } catch (error) {
    console.error("Error creating user profile:", error);
    return { error: error.message };
  }
});

// Delete user data when a user is deleted
exports.cleanupUserData = functions.auth.user().onDelete(async (user) => {
  try {
    // Delete the user's profile
    await db.collection("profiles").doc(user.uid).delete();
    
    // Delete the user's integrations
    const integrationsSnapshot = await db.collection("integrations")
      .where("userId", "==", user.uid)
      .get();
    
    const batch = db.batch();
    integrationsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    console.log(`Cleaned up data for user ${user.uid}`);
    return { success: true };
  } catch (error) {
    console.error("Error cleaning up user data:", error);
    return { error: error.message };
  }
});

// Function to fetch Ongoing WMS orders
exports.fetchOngoingOrders = functions.https.onCall(async (data, context) => {
  // Check if the caller is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  // Get Ongoing WMS credentials for this user
  const integrationsSnapshot = await db.collection("integrations")
    .where("userId", "==", context.auth.uid)
    .where("integrationType", "==", "ongoing_wms")
    .limit(1)
    .get();

  if (integrationsSnapshot.empty) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Ongoing WMS integration not configured. Please add your Ongoing WMS credentials in Settings."
    );
  }

  const credentials = integrationsSnapshot.docs[0].data().credentials;

  // Validate credentials
  if (!credentials.username || !credentials.password || !credentials.baseUrl) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Incomplete Ongoing WMS credentials. Please check your settings."
    );
  }

  try {
    // Normalize base URL
    let baseUrl = credentials.baseUrl.replace(/\/$/, "");
    if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
      baseUrl = "https://" + baseUrl;
    }

    // Create Basic Auth header
    const auth = Buffer.from(`${credentials.username}:${credentials.password}`).toString("base64");
    
    // Fetch orders from Ongoing WMS API
    const apiUrl = `${baseUrl}/api/v1/orders`;
    
    console.log(`Fetching orders from: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Ongoing WMS API error:", response.status, errorText);
      
      if (response.status === 401) {
        throw new functions.https.HttpsError(
          "unauthenticated",
          "Invalid Ongoing WMS credentials. Please check your username and password."
        );
      }
      
      throw new functions.https.HttpsError(
        "internal",
        `Ongoing WMS API error: ${response.status} ${response.statusText}`
      );
    }

    const ongoingOrders = await response.json();
    console.log(`Fetched ${ongoingOrders.length || 0} orders from Ongoing WMS`);

    // Process and store orders in Firestore
    let syncedCount = 0;
    let errorCount = 0;

    for (const ongoingOrder of ongoingOrders) {
      try {
        // For now, we'll store the raw data until we understand the structure
        // We'll map this properly once we see the actual API response
        const orderRef = db.collection("customerOrders").doc(ongoingOrder.id || `ongoing_${Date.now()}_${Math.random()}`);
        
        await orderRef.set({
          ongoingOrderId: ongoingOrder.id,
          orderNumber: ongoingOrder.orderNumber || ongoingOrder.number || ongoingOrder.id,
          customerName: ongoingOrder.customerName || ongoingOrder.customer?.name || `Customer ${ongoingOrder.id}`,
          ongoingStatus: ongoingOrder.status,
          totalValue: ongoingOrder.totalValue || ongoingOrder.total || 0,
          totalItems: ongoingOrder.totalItems || ongoingOrder.items?.length || 0,
          dateCreated: ongoingOrder.dateCreated || ongoingOrder.createdAt || new Date().toISOString(),
          lineItems: ongoingOrder.lineItems || ongoingOrder.items || [],
          billingAddress: ongoingOrder.billingAddress || ongoingOrder.billing?.address || "",
          shippingAddress: ongoingOrder.shippingAddress || ongoingOrder.shipping?.address || "",
          deliveryDate: ongoingOrder.deliveryDate || ongoingOrder.delivery?.date || null,
          deliveryType: ongoingOrder.deliveryType || ongoingOrder.delivery?.type || null,
          shippingMethod: ongoingOrder.shippingMethod || ongoingOrder.shipping?.method || null,
          rawData: ongoingOrder, // Store raw data for debugging
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        syncedCount++;
      } catch (error) {
        console.error(`Error processing Ongoing WMS order ${ongoingOrder.id}:`, error);
        errorCount++;
      }
    }

    return {
      success: true,
      message: `Successfully synced ${syncedCount} orders from Ongoing WMS`,
      syncedCount,
      errorCount,
      totalOrders: ongoingOrders.length || 0
    };
  } catch (error) {
    console.error("Error syncing Ongoing WMS orders:", error);
    throw new functions.https.HttpsError(
      "internal",
      error.message || "Failed to sync orders from Ongoing WMS",
      error
    );
  }
});

// Function to sync Ongoing WMS orders to Firestore (placeholder)
exports.syncOngoingOrders = functions.https.onCall(async (data, context) => {
  try {
    // Check if user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    // For now, this is a placeholder function
    // We'll implement this once we find the correct order endpoints
    return {
      success: true,
      message: 'Ongoing WMS order sync is not yet implemented. We need to find the correct order endpoints first.',
      orders: []
    };

  } catch (error) {
    console.error('Error syncing Ongoing WMS orders:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Fetch articles from Ongoing WMS
exports.fetchOngoingArticles = functions.https.onCall(async (data, context) => {
  try {
    // Check if user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { goodsOwnerId = 85, limit = 50, offset = 0, search = '', articleNumber = '' } = data;

    // Get Ongoing WMS credentials from Firestore
    const integrationsRef = admin.firestore().collection('integrations');
    const ongoingWMSDoc = await integrationsRef.doc('ongoing_wms').get();
    
    if (!ongoingWMSDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Ongoing WMS credentials not found');
    }

    const credentials = ongoingWMSDoc.data();
    const { username, password, baseUrl } = credentials;

    if (!username || !password || !baseUrl) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing Ongoing WMS credentials');
    }

    // Create Basic Auth header
    const authString = `${username}:${password}`;
    const authHeader = `Basic ${Buffer.from(authString).toString('base64')}`;

    // Build query parameters
    const queryParams = new URLSearchParams({
      goodsOwnerId: goodsOwnerId.toString(),
      limit: limit.toString(),
      offset: offset.toString()
    });

    if (search) {
      queryParams.append('search', search);
    }

    if (articleNumber) {
      queryParams.append('articleNumber', articleNumber);
    }

    const apiUrl = `${baseUrl.replace(/\/$/, '')}/articles?${queryParams.toString()}`;

    console.log(`Fetching articles from Ongoing WMS: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'User-Agent': 'LogiFlow/1.0'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Ongoing WMS API error: ${response.status} ${response.statusText}`);
      console.error(`Response: ${errorText}`);
      throw new functions.https.HttpsError('internal', `Ongoing WMS API error: ${response.status} ${response.statusText}`);
    }

    const articles = await response.json();

    console.log(`Successfully fetched ${articles.length} articles from Ongoing WMS`);

    return {
      success: true,
      articles: articles,
      total: articles.length,
      goodsOwnerId: goodsOwnerId
    };

  } catch (error) {
    console.error('Error fetching Ongoing WMS articles:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Fetch warehouses from Ongoing WMS
exports.fetchOngoingWarehouses = functions.https.onCall(async (data, context) => {
  try {
    // Check if user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { goodsOwnerId = 85 } = data;

    // Get Ongoing WMS credentials from Firestore
    const integrationsRef = admin.firestore().collection('integrations');
    const ongoingWMSDoc = await integrationsRef.doc('ongoing_wms').get();
    
    if (!ongoingWMSDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Ongoing WMS credentials not found');
    }

    const credentials = ongoingWMSDoc.data();
    const { username, password, baseUrl } = credentials;

    if (!username || !password || !baseUrl) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing Ongoing WMS credentials');
    }

    // Create Basic Auth header
    const authString = `${username}:${password}`;
    const authHeader = `Basic ${Buffer.from(authString).toString('base64')}`;

    const apiUrl = `${baseUrl.replace(/\/$/, '')}/warehouses?goodsOwnerId=${goodsOwnerId}`;

    console.log(`Fetching warehouses from Ongoing WMS: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'User-Agent': 'LogiFlow/1.0'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Ongoing WMS API error: ${response.status} ${response.statusText}`);
      console.error(`Response: ${errorText}`);
      throw new functions.https.HttpsError('internal', `Ongoing WMS API error: ${response.status} ${response.statusText}`);
    }

    const warehouses = await response.json();

    console.log(`Successfully fetched ${warehouses.length} warehouses from Ongoing WMS`);

    return {
      success: true,
      warehouses: warehouses,
      total: warehouses.length,
      goodsOwnerId: goodsOwnerId
    };

  } catch (error) {
    console.error('Error fetching Ongoing WMS warehouses:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});// Ongoing WMS Order Sync Functions
// These functions will be added to functions/index.js

// Helper function to get Ongoing WMS credentials
async function getOngoingWMSCredentials(userId) {
  const integrationsRef = admin.firestore().collection('integrations');
  
  // Query for Ongoing WMS integration by type
  const querySnapshot = await integrationsRef
    .where('integrationType', '==', 'ongoing_wms')
    .where('userId', '==', userId) // Add userId filter
    .limit(1)
    .get();
  
  if (querySnapshot.empty) {
    throw new functions.https.HttpsError('not-found', 'Ongoing WMS credentials not found for this user');
  }

  const doc = querySnapshot.docs[0];
  const data = doc.data();
  const credentials = data.credentials;

  if (!credentials || !credentials.username || !credentials.password || !credentials.baseUrl) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing Ongoing WMS credentials for this user');
  }

  // Create Basic Auth header
  const authString = `${credentials.username}:${credentials.password}`;
  const authHeader = `Basic ${Buffer.from(authString).toString('base64')}`;

  return { authHeader, baseUrl: credentials.baseUrl };
}

// Helper function to transform Ongoing WMS order to Firestore format
function transformOngoingOrderToFirestore(ongoingOrder) {
  const orderInfo = ongoingOrder.orderInfo;
  const consignee = ongoingOrder.consignee;
  const orderLines = ongoingOrder.orderLines || [];

  // Calculate total value from order lines
  const totalValue = orderLines.reduce((sum, line) => {
    // Use customerLinePrice if available, otherwise fall back to linePrice
    const lineValue = line.prices?.customerLinePrice || line.prices?.linePrice || 0;
    return sum + (parseFloat(lineValue) || 0);
  }, 0);

  // Parse created date properly
  let createdDate = null;
  if (orderInfo.createdDate) {
    try {
      // Handle both ISO string and timestamp formats
      if (typeof orderInfo.createdDate === 'string') {
        createdDate = new Date(orderInfo.createdDate);
      } else if (orderInfo.createdDate && typeof orderInfo.createdDate === 'object') {
        // If it's already a Date object or Firestore timestamp
        createdDate = orderInfo.createdDate;
      }
    } catch (error) {
      console.warn('Error parsing createdDate:', error);
      createdDate = null;
    }
  }

  return {
    // Order identification
    ongoingOrderId: orderInfo.orderId,
    orderNumber: orderInfo.orderNumber,
    goodsOwnerOrderId: orderInfo.goodsOwnerOrderId,
    
    // Order status and dates
    orderStatus: orderInfo.orderStatus,
    deliveryDate: orderInfo.deliveryDate,
    createdDate: createdDate,
    shippedTime: orderInfo.shippedTime,
    
    // Customer information
    customerName: consignee.name,
    customerNumber: consignee.customerNumber,
    billingAddress: `${consignee.address1}, ${consignee.postCode} ${consignee.city}`,
    billingAddressJson: {
      name: consignee.name,
      address1: consignee.address1,
      address2: consignee.address2,
      address3: consignee.address3,
      postCode: consignee.postCode,
      city: consignee.city,
      countryCode: consignee.countryCode
    },
    
    // Order details
    totalValue: totalValue,
    totalItems: orderInfo.orderedNumberOfItems || 0,
    allocatedItems: orderInfo.allocatedNumberOfItems || 0,
    pickedItems: orderInfo.pickedNumberOfItems || 0,
    
    // Shipping information
    wayOfDelivery: orderInfo.wayOfDelivery,
    transporter: ongoingOrder.transporter,
    wayBill: orderInfo.wayBill,
    returnWayBill: orderInfo.returnWayBill,
    
    // Additional information
    orderRemark: orderInfo.orderRemark,
    deliveryInstruction: orderInfo.deliveryInstruction,
    freeText1: orderInfo.freeText1,
    freeText2: orderInfo.freeText2,
    freeText3: orderInfo.freeText3,
    
    // Notifications
    emailNotification: orderInfo.emailNotification,
    smsNotification: orderInfo.smsNotification,
    telephoneNotification: orderInfo.telephoneNotification,
    
    // Order lines
    orderLines: orderLines.map(line => {
      const lineData = {
        id: line.id,
        rowNumber: line.rowNumber,
        articleNumber: line.article?.articleNumber,
        articleName: line.article?.articleName,
        productCode: line.article?.productCode,
        orderedQuantity: line.orderedNumberOfItems,
        allocatedQuantity: line.allocatedNumberOfItems,
        pickedQuantity: line.pickedNumberOfItems,
        packedQuantity: line.packedNumberOfItems,
        linePrice: line.prices?.linePrice,
        customerLinePrice: line.prices?.customerLinePrice,
        currencyCode: line.prices?.currencyCode,
        deliveryDate: line.deliveryDate,
        comment: line.comment
      };
      
      // Clean undefined values
      return removeUndefinedValues(lineData);
    }),
    
    // Metadata
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    source: 'ongoing_wms'
  };
}

// Helper function to transform Ongoing WMS purchase order to Firestore format
function transformOngoingPurchaseOrderToFirestore(ongoingPurchaseOrder) {
  const orderInfo = ongoingPurchaseOrder.orderInfo;
  const orderLines = ongoingPurchaseOrder.orderLines || [];

  return {
    // Order identification
    ongoingPurchaseOrderId: orderInfo.orderId,
    purchaseOrderNumber: orderInfo.orderNumber,
    goodsOwnerOrderId: orderInfo.goodsOwnerOrderId,
    
    // Order status and dates
    orderStatus: orderInfo.orderStatus,
    deliveryDate: orderInfo.deliveryDate,
    createdDate: orderInfo.createdDate,
    
    // Supplier information
    supplier: ongoingPurchaseOrder.supplier?.name || '',
    supplierNumber: ongoingPurchaseOrder.supplier?.supplierNumber || '',
    
    // Order details
    totalValue: orderInfo.customerPrice || 0,
    totalItems: orderInfo.orderedNumberOfItems || 0,
    allocatedItems: orderInfo.allocatedNumberOfItems || 0,
    pickedItems: orderInfo.pickedNumberOfItems || 0,
    
    // Additional information
    orderRemark: orderInfo.orderRemark,
    deliveryInstruction: orderInfo.deliveryInstruction,
    freeText1: orderInfo.freeText1,
    freeText2: orderInfo.freeText2,
    freeText3: orderInfo.freeText3,
    
    // Order lines
    orderLines: orderLines.map(line => ({
      id: line.id,
      rowNumber: line.rowNumber,
      articleNumber: line.article?.articleNumber,
      articleName: line.article?.articleName,
      productCode: line.article?.productCode,
      orderedQuantity: line.orderedNumberOfItems,
      allocatedQuantity: line.allocatedNumberOfItems,
      pickedQuantity: line.pickedNumberOfItems,
      packedQuantity: line.packedNumberOfItems,
      linePrice: line.prices?.linePrice,
      customerLinePrice: line.prices?.customerLinePrice,
      currencyCode: line.prices?.currencyCode,
      deliveryDate: line.deliveryDate,
      comment: line.comment
    })),
    
    // Metadata
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    source: 'ongoing_wms'
  };
}

// Function to fetch and sync orders by status from Ongoing WMS
exports.syncOngoingOrdersByStatus = functions.https.onCall(async (data, context) => {
  try {
    // Check if user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { status, goodsOwnerId = 85, limit = 20 } = data;

    if (!status) {
      throw new functions.https.HttpsError('invalid-argument', 'Status is required');
    }

    const { authHeader, baseUrl } = await getOngoingWMSCredentials(context.auth.uid);

    console.log(`Syncing orders with status: ${status}, goodsOwnerId: ${goodsOwnerId}, limit: ${limit}`);

    const syncedOrders = [];
    const errors = [];
    
    // Start with known order IDs that we know exist
    const knownOrderIds = [214600, 216042];
    
    // Also test a small range around these known orders
    const testRanges = [
      // Around known order 214600
      { start: 214590, end: 214610 },
      // Around known order 216042  
      { start: 216030, end: 216060 }
    ];
    
    // Combine known orders and test ranges
    const orderIdsToTest = [...knownOrderIds];
    testRanges.forEach(range => {
      for (let i = range.start; i <= range.end; i++) {
        if (!orderIdsToTest.includes(i)) {
          orderIdsToTest.push(i);
        }
      }
    });

    console.log(`Testing ${orderIdsToTest.length} order IDs for status ${status}`);

    // Test orders in small batches
    const batchSize = 3; // Very small batches to avoid timeouts
    
    for (let i = 0; i < orderIdsToTest.length && syncedOrders.length < limit; i += batchSize) {
      // Check for cancellation by looking for a cancellation flag in Firestore
      try {
        const cancellationDoc = await db.collection('syncCancellation').doc(context.auth.uid).get();
        if (cancellationDoc.exists && cancellationDoc.data().cancelled) {
          console.log('Sync cancelled by user');
          // Clear the cancellation flag
          await db.collection('syncCancellation').doc(context.auth.uid).delete();
          return {
            success: true,
            cancelled: true,
            message: 'Sync cancelled by user',
            syncedOrders: syncedOrders,
            totalSynced: syncedOrders.length,
            errors: errors
          };
        }
      } catch (error) {
        console.log('Could not check cancellation flag:', error.message);
      }

      const batch = orderIdsToTest.slice(i, i + batchSize);
      
      console.log(`Testing batch: ${batch.join(', ')}`);

      // Fetch orders in parallel with strict timeout
      const promises = batch.map(async (orderId) => {
        try {
          const apiUrl = `${baseUrl.replace(/\/$/, '')}/orders/${orderId}`;
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
          
          const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
              'User-Agent': 'LogiFlow/1.0'
            },
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const order = await response.json();
            
            // Debug logging to see what we're comparing
            console.log(`Order ${orderId}: Comparing status ${order.orderInfo?.orderStatus?.number} (type: ${typeof order.orderInfo?.orderStatus?.number}) with requested ${status} (type: ${typeof status})`);
            
            // Check if order matches the requested status
            if (order.orderInfo?.orderStatus?.number === status) {
              console.log(`Found matching order: ${orderId} (${order.orderInfo.orderNumber})`);
              
              const firestoreOrder = transformOngoingOrderToFirestore(order);
              
              // Store order in Firestore using order number as document ID to prevent duplicates
              await db.collection('ongoingOrders').doc(order.orderInfo.orderNumber.toString()).set(firestoreOrder, { merge: true });
              
              // Store order lines separately in ongoingOrderLines collection
              if (order.orderLines && order.orderLines.length > 0) {
                for (const line of order.orderLines) {
                  const lineRef = db.collection('ongoingOrderLines').doc(`${order.orderInfo.orderNumber}_${line.id}`);
                  
                  const lineData = {
                    orderId: order.orderInfo.orderNumber.toString(),
                    ongoingLineItemId: line.id,
                    rowNumber: line.rowNumber,
                    articleNumber: line.article?.articleNumber,
                    articleName: line.article?.articleName,
                    productCode: line.article?.productCode,
                    productId: line.article?.articleId,
                    orderedQuantity: line.orderedNumberOfItems,
                    allocatedQuantity: line.allocatedNumberOfItems,
                    pickedQuantity: line.pickedNumberOfItems,
                    packedQuantity: line.packedNumberOfItems,
                    linePrice: line.prices?.linePrice,
                    customerLinePrice: line.prices?.customerLinePrice,
                    currencyCode: line.prices?.currencyCode,
                    deliveryDate: line.deliveryDate,
                    comment: line.comment,
                    deliveryStatus: 'pending', // Default status
                    deliveredQuantity: 0, // Default value
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                  };
                  
                  // Clean undefined values before saving
                  const cleanedLineData = removeUndefinedValues(lineData);
                  
                  await lineRef.set(cleanedLineData);
                }
              }
              
              syncedOrders.push({
                orderId: orderId,
                orderNumber: order.orderInfo.orderNumber,
                status: order.orderInfo.orderStatus.text
              });
              
              console.log(`Synced order ${orderId} (${order.orderInfo.orderNumber}) with ${order.orderLines?.length || 0} order lines`);
            } else {
              console.log(`Order ${orderId} status ${order.orderInfo?.orderStatus?.number} doesn't match requested ${status}`);
            }
          } else if (response.status === 404) {
            // Order doesn't exist, skip silently
            console.log(`Order ${orderId} not found, skipping`);
          } else {
            console.log(`Order ${orderId} returned status ${response.status}`);
          }
        } catch (error) {
          if (error.name === 'AbortError') {
            console.log(`Timeout fetching order ${orderId}`);
            errors.push({ orderId, error: 'Request timeout' });
          } else {
            console.error(`Error fetching order ${orderId}:`, error.message);
            errors.push({ orderId, error: error.message });
          }
        }
      });

      await Promise.all(promises);
      
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`Sync completed. Synced ${syncedOrders.length} orders, ${errors.length} errors`);

    return {
      success: true,
      syncedOrders: syncedOrders,
      totalSynced: syncedOrders.length,
      errors: errors,
      status: status,
      goodsOwnerId: goodsOwnerId
    };

  } catch (error) {
    console.error('Error syncing Ongoing WMS orders:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Function to fetch and sync purchase orders by status from Ongoing WMS
exports.syncOngoingPurchaseOrdersByStatus = functions.https.onCall(async (data, context) => {
  try {
    // Check if user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { status, goodsOwnerId = 85, limit = 100 } = data;

    if (!status) {
      throw new functions.https.HttpsError('invalid-argument', 'Status is required');
    }

    const { authHeader, baseUrl } = await getOngoingWMSCredentials(context.auth.uid);

    console.log(`Syncing purchase orders with status: ${status}, goodsOwnerId: ${goodsOwnerId}`);

    // Similar approach as orders - test a range of purchase order IDs
    const purchaseOrderIds = [];
    const syncedPurchaseOrders = [];
    const errors = [];

    // Test a range of purchase order IDs (you can adjust this range)
    const startPurchaseOrderId = 100000;
    const endPurchaseOrderId = 103000;
    const batchSize = 10;

    for (let i = startPurchaseOrderId; i <= endPurchaseOrderId && syncedPurchaseOrders.length < limit; i += batchSize) {
      const batch = [];
      for (let j = 0; j < batchSize && i + j <= endPurchaseOrderId; j++) {
        batch.push(i + j);
      }

      // Fetch purchase orders in parallel
      const promises = batch.map(async (purchaseOrderId) => {
        try {
          const apiUrl = `${baseUrl.replace(/\/$/, '')}/purchaseOrders/${purchaseOrderId}`;
          
          const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
              'User-Agent': 'LogiFlow/1.0'
            }
          });

          if (response.ok) {
            const purchaseOrder = await response.json();
            
            // Check if purchase order matches the requested status
            if (purchaseOrder.orderInfo?.orderStatus?.number === status) {
              const firestorePurchaseOrder = transformOngoingPurchaseOrderToFirestore(purchaseOrder);
              
              // Store in Firestore
              await db.collection('ongoingPurchaseOrders').doc(purchaseOrderId.toString()).set(firestorePurchaseOrder);
              
              syncedPurchaseOrders.push({
                purchaseOrderId: purchaseOrderId,
                purchaseOrderNumber: purchaseOrder.orderInfo.orderNumber,
                status: purchaseOrder.orderInfo.orderStatus.text
              });
              
              console.log(`Synced purchase order ${purchaseOrderId} (${purchaseOrder.orderInfo.orderNumber})`);
            }
          }
        } catch (error) {
          console.error(`Error fetching purchase order ${purchaseOrderId}:`, error.message);
          errors.push({ purchaseOrderId, error: error.message });
        }
      });

      await Promise.all(promises);
      
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`Sync completed. Synced ${syncedPurchaseOrders.length} purchase orders, ${errors.length} errors`);

    return {
      success: true,
      syncedPurchaseOrders: syncedPurchaseOrders,
      totalSynced: syncedPurchaseOrders.length,
      errors: errors,
      status: status,
      goodsOwnerId: goodsOwnerId
    };

  } catch (error) {
    console.error('Error syncing Ongoing WMS purchase orders:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Function to get order statuses from Ongoing WMS
exports.getOngoingOrderStatuses = functions.https.onCall(async (data, context) => {
  try {
    // Check if user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { authHeader, baseUrl } = await getOngoingWMSCredentials(context.auth.uid);

    const apiUrl = `${baseUrl.replace(/\/$/, '')}/orders/statuses`;

    console.log(`Fetching order statuses from Ongoing WMS: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'User-Agent': 'LogiFlow/1.0'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Ongoing WMS API error: ${response.status} ${response.statusText}`);
      console.error(`Response: ${errorText}`);
      throw new functions.https.HttpsError('internal', `Ongoing WMS API error: ${response.status} ${response.statusText}`);
    }

    const statuses = await response.json();

    console.log(`Successfully fetched ${statuses.orderStatuses?.length || 0} order statuses from Ongoing WMS`);

    return {
      success: true,
      statuses: statuses.orderStatuses || [],
      total: statuses.orderStatuses?.length || 0
    };

  } catch (error) {
    console.error('Error fetching Ongoing WMS order statuses:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Function to get purchase order statuses from Ongoing WMS
exports.getOngoingPurchaseOrderStatuses = functions.https.onCall(async (data, context) => {
  try {
    // Check if user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { authHeader, baseUrl } = await getOngoingWMSCredentials(context.auth.uid);

    const apiUrl = `${baseUrl.replace(/\/$/, '')}/purchaseOrders/statuses`;

    console.log(`Fetching purchase order statuses from Ongoing WMS: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'User-Agent': 'LogiFlow/1.0'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Ongoing WMS API error: ${response.status} ${response.statusText}`);
      console.error(`Response: ${errorText}`);
      throw new functions.https.HttpsError('internal', `Ongoing WMS API error: ${response.status} ${response.statusText}`);
    }

    const statuses = await response.json();

    console.log(`Successfully fetched ${statuses.orderStatuses?.length || 0} purchase order statuses from Ongoing WMS`);

    return {
      success: true,
      statuses: statuses.orderStatuses || [],
      total: statuses.orderStatuses?.length || 0
    };

  } catch (error) {
    console.error('Error fetching Ongoing WMS purchase order statuses:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Scheduled function to sync orders every hour
exports.scheduledOngoingOrderSync = functions.pubsub.schedule('every 1 hours').onRun(async (context) => {
  try {
    console.log('Starting scheduled Ongoing WMS order sync...');

    // Get Ongoing WMS credentials
    const { authHeader, baseUrl } = await getOngoingWMSCredentials(context.auth.uid);

    // Sync orders with different statuses
    const orderStatuses = [200, 210, 300, 320, 400, 450, 451, 500, 600]; // Common statuses
    let totalSynced = 0;

    for (const status of orderStatuses) {
      try {
        // Test a range of order IDs for each status
        const startOrderId = 214000;
        const endOrderId = 217000;
        const batchSize = 5;

        for (let i = startOrderId; i <= endOrderId; i += batchSize) {
          const batch = [];
          for (let j = 0; j < batchSize && i + j <= endOrderId; j++) {
            batch.push(i + j);
          }

          const promises = batch.map(async (orderId) => {
            try {
              const apiUrl = `${baseUrl.replace(/\/$/, '')}/orders/${orderId}`;
              
              const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                  'Authorization': authHeader,
                  'Content-Type': 'application/json',
                  'User-Agent': 'LogiFlow/1.0'
                }
              });

              if (response.ok) {
                const order = await response.json();
                
                if (order.orderInfo?.orderStatus?.number === status) {
                  const firestoreOrder = transformOngoingOrderToFirestore(order);
                  
                  // Store in Firestore
                  await db.collection('ongoingOrders').doc(orderId.toString()).set(firestoreOrder);
                  totalSynced++;
                  
                  console.log(`Scheduled sync: Synced order ${orderId} (${order.orderInfo.orderNumber})`);
                }
              }
            } catch (error) {
              console.error(`Error in scheduled sync for order ${orderId}:`, error.message);
            }
          });

          await Promise.all(promises);
          await new Promise(resolve => setTimeout(resolve, 50)); // Small delay
        }
      } catch (error) {
        console.error(`Error syncing orders with status ${status}:`, error);
      }
    }

    console.log(`Scheduled sync completed. Total synced: ${totalSynced}`);

    return { success: true, totalSynced };

  } catch (error) {
    console.error('Error in scheduled Ongoing WMS order sync:', error);
    throw error;
  }
});

// Scheduled function to sync purchase orders every hour
exports.scheduledOngoingPurchaseOrderSync = functions.pubsub.schedule('every 1 hours').onRun(async (context) => {
  try {
    console.log('Starting scheduled Ongoing WMS purchase order sync...');

    // Get Ongoing WMS credentials
    const { authHeader, baseUrl } = await getOngoingWMSCredentials(context.auth.uid);

    // Sync purchase orders with different statuses
    const purchaseOrderStatuses = [100, 150, 151, 200, 300, 400, 500]; // Common statuses
    let totalSynced = 0;

    for (const status of purchaseOrderStatuses) {
      try {
        // Test a range of purchase order IDs for each status
        const startPurchaseOrderId = 100000;
        const endPurchaseOrderId = 103000;
        const batchSize = 5;

        for (let i = startPurchaseOrderId; i <= endPurchaseOrderId; i += batchSize) {
          const batch = [];
          for (let j = 0; j < batchSize && i + j <= endPurchaseOrderId; j++) {
            batch.push(i + j);
          }

          const promises = batch.map(async (purchaseOrderId) => {
            try {
              const apiUrl = `${baseUrl.replace(/\/$/, '')}/purchaseOrders/${purchaseOrderId}`;
              
              const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                  'Authorization': authHeader,
                  'Content-Type': 'application/json',
                  'User-Agent': 'LogiFlow/1.0'
                }
              });

              if (response.ok) {
                const purchaseOrder = await response.json();
                
                if (purchaseOrder.orderInfo?.orderStatus?.number === status) {
                  const firestorePurchaseOrder = transformOngoingPurchaseOrderToFirestore(purchaseOrder);
                  
                  // Store in Firestore
                  await db.collection('ongoingPurchaseOrders').doc(purchaseOrderId.toString()).set(firestorePurchaseOrder);
                  totalSynced++;
                  
                  console.log(`Scheduled sync: Synced purchase order ${purchaseOrderId} (${purchaseOrder.orderInfo.orderNumber})`);
                }
              }
            } catch (error) {
              console.error(`Error in scheduled sync for purchase order ${purchaseOrderId}:`, error.message);
            }
          });

          await Promise.all(promises);
          await new Promise(resolve => setTimeout(resolve, 50)); // Small delay
        }
      } catch (error) {
        console.error(`Error syncing purchase orders with status ${status}:`, error);
      }
    }

    console.log(`Scheduled purchase order sync completed. Total synced: ${totalSynced}`);

    return { success: true, totalSynced };

  } catch (error) {
    console.error('Error in scheduled Ongoing WMS purchase order sync:', error);
    throw error;
  }
});

// Diagnostic function to test specific order IDs and see their statuses
exports.diagnoseOngoingOrders = functions.https.onCall(async (data, context) => {
  try {
    // Check if user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { orderIds = [214600, 216042] } = data;

    const { authHeader, baseUrl } = await getOngoingWMSCredentials(context.auth.uid);

    console.log(`Diagnosing orders: ${orderIds.join(', ')}`);

    const results = [];

    for (const orderId of orderIds) {
      try {
        const apiUrl = `${baseUrl.replace(/\/$/, '')}/orders/${orderId}`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
            'User-Agent': 'LogiFlow/1.0'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const order = await response.json();
          
          results.push({
            orderId: orderId,
            found: true,
            orderNumber: order.orderInfo?.orderNumber,
            status: {
              number: order.orderInfo?.orderStatus?.number,
              text: order.orderInfo?.orderStatus?.text
            },
            orderLines: order.orderLines?.length || 0,
            rawStatus: order.orderInfo?.orderStatus,
            // Add full order data for debugging
            fullOrderData: order
          });
          
          console.log(`Order ${orderId}: Status ${order.orderInfo?.orderStatus?.number} (${order.orderInfo?.orderStatus?.text})`);
        } else {
          results.push({
            orderId: orderId,
            found: false,
            status: response.status,
            error: `HTTP ${response.status}`
          });
          
          console.log(`Order ${orderId}: Not found (HTTP ${response.status})`);
        }
      } catch (error) {
        results.push({
          orderId: orderId,
          found: false,
          error: error.message
        });
        
        console.log(`Order ${orderId}: Error - ${error.message}`);
      }
    }

    return {
      success: true,
      results: results
    };

  } catch (error) {
    console.error('Error diagnosing Ongoing WMS orders:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Simple test function to sync only known orders
exports.testSyncKnownOrders = functions.https.onCall(async (data, context) => {
  try {
    console.log('=== testSyncKnownOrders function started ===');
    
    // Check if user is authenticated
    if (!context.auth) {
      console.log('User not authenticated');
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    console.log('User authenticated:', context.auth.uid);

    const { status = 320 } = data;  // Changed from 200 to 320
    console.log('Requested status:', status);

    const { authHeader, baseUrl } = await getOngoingWMSCredentials(context.auth.uid);
    console.log('Got credentials, baseUrl:', baseUrl);

    console.log(`Testing sync for status: ${status}`);

    const syncedOrders = [];
    const errors = [];
    
    // Only test the two known orders
    const orderIdsToTest = [214600, 216042];

    console.log(`Testing ${orderIdsToTest.length} known orders for status ${status}`);

    for (const orderId of orderIdsToTest) {
      console.log(`=== Testing order ${orderId} ===`);
      
      try {
        const apiUrl = `${baseUrl.replace(/\/$/, '')}/orders/${orderId}`;
        console.log(`API URL: ${apiUrl}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        console.log(`Fetching order ${orderId}...`);
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
            'User-Agent': 'LogiFlow/1.0'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        console.log(`Response status: ${response.status}`);

        if (response.ok) {
          console.log(`Parsing JSON for order ${orderId}...`);
          const order = await response.json();
          
          console.log(`Order ${orderId}: Status ${order.orderInfo?.orderStatus?.number} (${order.orderInfo?.orderStatus?.text})`);
          console.log(`Order ${orderId}: Raw orderInfo:`, JSON.stringify(order.orderInfo, null, 2));
          console.log(`Order ${orderId}: Raw orderStatus:`, JSON.stringify(order.orderInfo?.orderStatus, null, 2));
          
          // Check if order matches the requested status
          console.log(`Order ${orderId}: Comparing ${order.orderInfo?.orderStatus?.number} (type: ${typeof order.orderInfo?.orderStatus?.number}) with ${status} (type: ${typeof status})`);
          
          if (order.orderInfo?.orderStatus?.number === status) {
            console.log(`Found matching order: ${orderId} (${order.orderInfo.orderNumber})`);
            
            const firestoreOrder = transformOngoingOrderToFirestore(order);
            
            // Store order in Firestore
            await db.collection('ongoingOrders').doc(orderId.toString()).set(firestoreOrder);
            
            // Store order lines separately in ongoingOrderLines collection
            if (order.orderLines && order.orderLines.length > 0) {
              for (const line of order.orderLines) {
                const lineRef = db.collection('ongoingOrderLines').doc(`${orderId}_${line.id}`);
                
                const lineData = {
                  orderId: orderId.toString(),
                  ongoingLineItemId: line.id,
                  rowNumber: line.rowNumber,
                  articleNumber: line.article?.articleNumber,
                  articleName: line.article?.articleName,
                  productCode: line.article?.productCode,
                  productId: line.article?.articleId,
                  orderedQuantity: line.orderedNumberOfItems,
                  allocatedQuantity: line.allocatedNumberOfItems,
                  pickedQuantity: line.pickedNumberOfItems,
                  packedQuantity: line.packedNumberOfItems,
                  linePrice: line.prices?.linePrice,
                  customerLinePrice: line.prices?.customerLinePrice,
                  currencyCode: line.prices?.currencyCode,
                  deliveryDate: line.deliveryDate,
                  comment: line.comment,
                  deliveryStatus: 'pending', // Default status
                  deliveredQuantity: 0, // Default value
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };
                
                // Clean undefined values before saving
                const cleanedLineData = removeUndefinedValues(lineData);
                
                await lineRef.set(cleanedLineData);
              }
            }
            
            syncedOrders.push({
              orderId: orderId,
              orderNumber: order.orderInfo.orderNumber,
              status: order.orderInfo.orderStatus.text
            });
            
            console.log(`Synced order ${orderId} (${order.orderInfo.orderNumber}) with ${order.orderLines?.length || 0} order lines`);
          } else {
            console.log(`Order ${orderId} status ${order.orderInfo?.orderStatus?.number} doesn't match requested ${status}`);
          }
        } else if (response.status === 404) {
          console.log(`Order ${orderId} not found, skipping`);
        } else {
          console.log(`Order ${orderId} returned status ${response.status}`);
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log(`Timeout fetching order ${orderId}`);
          errors.push({ orderId, error: 'Request timeout' });
        } else {
          console.error(`Error fetching order ${orderId}:`, error.message);
          errors.push({ orderId, error: error.message });
        }
      }
    }

    console.log(`Test completed. Synced ${syncedOrders.length} orders, ${errors.length} errors`);

    return {
      success: true,
      syncedOrders: syncedOrders,
      totalSynced: syncedOrders.length,
      errors: errors,
      status: status
    };

  } catch (error) {
    console.error('Error testing Ongoing WMS orders:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Function to sync Ongoing WMS orders by date range
exports.syncOngoingOrdersByDateRange = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { startDate, endDate, limit = 50 } = data;
  
  if (!startDate || !endDate) {
    throw new functions.https.HttpsError('invalid-argument', 'startDate and endDate are required');
  }

  try {
    console.log(`Syncing Ongoing WMS orders from ${startDate} to ${endDate} (limit: ${limit})`);
    
    // Get Ongoing WMS credentials
    const { authHeader, baseUrl } = await getOngoingWMSCredentials(context.auth.uid);

    // Set up cancellation check
    const cancellationRef = db.collection('syncCancellation').doc(context.auth.uid);
    await cancellationRef.set({ cancelled: false });

    const syncedOrders = [];
    const errors = [];
    let totalSynced = 0;
    let consecutive403Errors = 0;
    const maxConsecutive403Errors = 5; // Stop after 5 consecutive 403 errors

    // Convert dates to ISO strings for API
    const startDateISO = new Date(startDate + 'T00:00:00Z').toISOString();
    const endDateISO = new Date(endDate + 'T23:59:59Z').toISOString();

    console.log(`Date range: ${startDateISO} to ${endDateISO}`);

    // For date-based sync, we'll need to iterate through order IDs
    // Since Ongoing WMS doesn't have a direct date filter, we'll use a range of order IDs
    // and filter by createdDate in the response
    const startOrderId = 214600; // Focus on known orders
    const endOrderId = 214610;   // Reduced range to avoid timeouts
    const batchSize = 1; // Single orders to avoid timeouts

    for (let orderId = startOrderId; orderId <= endOrderId; orderId += batchSize) {
      // Check for cancellation
      const cancellationDoc = await cancellationRef.get();
      if (cancellationDoc.exists && cancellationDoc.data().cancelled) {
        console.log('Sync cancelled by user');
        break;
      }

      const batchEnd = Math.min(orderId + batchSize - 1, endOrderId);
      console.log(`Processing orders ${orderId} to ${batchEnd}`);

      for (let currentOrderId = orderId; currentOrderId <= batchEnd; currentOrderId++) {
        try {
          const apiUrl = `${baseUrl.replace(/\/$/, '')}/orders/${currentOrderId}`;
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000); // Reduced timeout
          
          const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
              'User-Agent': 'LogiFlow/1.0'
            },
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const order = await response.json();
            
            // Check if order was created within the date range
            const orderCreatedDate = order.orderInfo?.createdDate;
            if (orderCreatedDate) {
              const orderDate = new Date(orderCreatedDate);
              const startDateObj = new Date(startDateISO);
              const endDateObj = new Date(endDateISO);
              
              if (orderDate >= startDateObj && orderDate <= endDateObj) {
                console.log(`Order ${currentOrderId} (${order.orderInfo.orderNumber}) created on ${orderCreatedDate} - within range`);
                
                const firestoreOrder = transformOngoingOrderToFirestore(order);
                
                // Store order in Firestore using order number as document ID
                await db.collection('ongoingOrders').doc(order.orderInfo.orderNumber.toString()).set(firestoreOrder, { merge: true });
                
                // Store order lines separately
                if (order.orderLines && order.orderLines.length > 0) {
                  for (const line of order.orderLines) {
                    const lineRef = db.collection('ongoingOrderLines').doc(`${order.orderInfo.orderNumber}_${line.id}`);
                    
                    const lineData = {
                      orderId: order.orderInfo.orderNumber.toString(),
                      ongoingLineItemId: line.id,
                      rowNumber: line.rowNumber,
                      articleNumber: line.article?.articleNumber,
                      articleName: line.article?.articleName,
                      productCode: line.article?.productCode,
                      productId: line.article?.articleId,
                      orderedQuantity: line.orderedNumberOfItems,
                      allocatedQuantity: line.allocatedNumberOfItems,
                      pickedQuantity: line.pickedNumberOfItems,
                      packedQuantity: line.packedNumberOfItems,
                      linePrice: line.prices?.linePrice,
                      customerLinePrice: line.prices?.customerLinePrice,
                      currencyCode: line.prices?.currencyCode,
                      deliveryDate: line.deliveryDate,
                      comment: line.comment,
                      deliveryStatus: 'pending',
                      deliveredQuantity: 0,
                      createdAt: admin.firestore.FieldValue.serverTimestamp(),
                      updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    };
                    
                    const cleanedLineData = removeUndefinedValues(lineData);
                    await lineRef.set(cleanedLineData);
                  }
                }
                
                syncedOrders.push({
                  orderId: currentOrderId,
                  orderNumber: order.orderInfo.orderNumber,
                  createdDate: orderCreatedDate
                });
                
                totalSynced++;
                
                if (totalSynced >= limit) {
                  console.log(`Reached limit of ${limit} orders`);
                  break;
                }
              } else {
                console.log(`Order ${currentOrderId} created on ${orderCreatedDate} - outside range`);
              }
            }
          } else if (response.status === 404) {
            console.log(`Order ${currentOrderId} not found`);
            consecutive403Errors = 0; // Reset counter for non-403 errors
          } else if (response.status === 403) {
            console.log(`Order ${currentOrderId} returned status 403 (Forbidden)`);
            consecutive403Errors++;
            
            if (consecutive403Errors >= maxConsecutive403Errors) {
              console.log(`Stopping sync due to ${consecutive403Errors} consecutive 403 errors`);
              errors.push({ 
                orderId: currentOrderId, 
                error: `Stopped due to ${consecutive403Errors} consecutive 403 errors - check API credentials` 
              });
              break;
            }
          } else {
            console.log(`Order ${currentOrderId} returned status ${response.status}`);
            consecutive403Errors = 0; // Reset counter for non-403 errors
          }
        } catch (error) {
          if (error.name === 'AbortError') {
            console.log(`Timeout fetching order ${currentOrderId}`);
            errors.push({ orderId: currentOrderId, error: 'Request timeout' });
          } else {
            console.error(`Error fetching order ${currentOrderId}:`, error.message);
            errors.push({ orderId: currentOrderId, error: error.message });
          }
        }
      }
      
      if (totalSynced >= limit) {
        break;
      }
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 200)); // Reduced delay
    }

    console.log(`Date range sync completed: ${totalSynced} orders synced, ${errors.length} errors`);
    return {
      success: true,
      totalSynced,
      errors,
      syncedOrders
    };

  } catch (error) {
    console.error('Error syncing Ongoing WMS orders by date range:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Function to sync order lines for a specific Ongoing WMS order
exports.syncOngoingOrderLinesByOrderId = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { orderId, orderNumber, documentId } = data;
  
  if (!orderId || !orderNumber || !documentId) {
    throw new functions.https.HttpsError('invalid-argument', 'orderId, orderNumber, and documentId are required');
  }

  try {
    console.log(`Syncing order lines for order ${orderNumber} (Ongoing ID: ${orderId}, Document ID: ${documentId})`);
    
    // Get Ongoing WMS credentials
    const { authHeader, baseUrl } = await getOngoingWMSCredentials(context.auth.uid);

    // Fetch order details from Ongoing WMS
    const orderResponse = await fetch(`${baseUrl}/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    });

    if (!orderResponse.ok) {
      if (orderResponse.status === 404) {
        console.log(`Order ${orderId} not found in Ongoing WMS`);
        return { success: false, error: 'Order not found in Ongoing WMS', orderLinesCount: 0 };
      }
      throw new Error(`Failed to fetch order: ${orderResponse.status} ${orderResponse.statusText}`);
    }

    const orderData = await orderResponse.json();
    console.log(`Fetched order data for ${orderId}:`, orderData);

    if (!orderData.orderInfo || !orderData.orderLines) {
      console.log(`Order ${orderId} has no order lines`);
      return { success: false, error: 'Order has no order lines', orderLinesCount: 0 };
    }

    // Save order lines to Firestore
    let savedCount = 0;
    for (const line of orderData.orderLines) {
      try {
        const lineData = {
          orderId: documentId, // Use the Firestore document ID, not the order number
          orderNumber: orderNumber, // Keep the order number for reference
          ongoingLineItemId: line.id,
          rowNumber: line.rowNumber,
          // Map article information correctly
          articleNumber: line.article?.articleNumber || line.articleNumber,
          articleName: line.article?.articleName || line.articleName,
          // Map quantity information correctly
          orderedQuantity: line.orderedNumberOfItems || line.orderedQuantity,
          deliveredQuantity: line.orderedNumberOfItems || line.deliveredQuantity || 0, // Corrected to use orderedNumberOfItems as primary
          // Map price information correctly
          linePrice: line.prices?.linePrice || line.linePrice,
          unitPrice: line.prices?.unitPrice || line.unitPrice,
          customerLinePrice: line.prices?.customerLinePrice,
          // Map additional information
          taxAmount: line.taxAmount || 0,
          metaData: line.metaData || {},
          deliveryDate: line.deliveryDate,
          deliveryStatus: line.deliveryStatus || 'pending',
          partialDeliveryDetails: line.partialDeliveryDetails || {},
          // Map product information
          productId: line.article?.articleId,
          productCode: line.article?.productCode,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // Remove undefined values
        const cleanLineData = removeUndefinedValues(lineData);

        // Use a unique document ID for the order line
        const lineDocId = `${documentId}_${line.id}`;
        await db.collection('ongoingOrderLines').doc(lineDocId).set(cleanLineData, { merge: true });
        
        console.log(`Saved order line ${lineDocId} for order ${orderNumber}`);
        savedCount++;
      } catch (lineError) {
        console.error(`Error saving order line ${line.id}:`, lineError);
      }
    }

    console.log(`Successfully synced ${savedCount} order lines for order ${orderNumber}`);
    return { 
      success: true, 
      orderLinesCount: savedCount,
      orderNumber: orderNumber,
      orderId: orderId
    };

  } catch (error) {
    console.error(`Error syncing order lines for order ${orderNumber}:`, error);
    throw new functions.https.HttpsError('internal', `Failed to sync order lines: ${error.message}`);
  }
});

// Debug function to get full order data structure
exports.debugOrderData = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { orderId = 214600 } = data;

  try {
    console.log(`Debugging order data for order ${orderId}`);
    
    // Get Ongoing WMS credentials
    const { authHeader, baseUrl } = await getOngoingWMSCredentials(context.auth.uid);

    // Fetch order details from Ongoing WMS
    const orderResponse = await fetch(`${baseUrl}/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    });

    if (!orderResponse.ok) {
      throw new Error(`Failed to fetch order: ${orderResponse.status} ${orderResponse.statusText}`);
    }

    const orderData = await orderResponse.json();
    console.log(`Fetched order data for ${orderId}:`, orderData);

    // Extract key fields for debugging
    const orderInfo = orderData.orderInfo || {};
    const debugInfo = {
      orderId: orderId,
      orderNumber: orderInfo.orderNumber,
      status: orderInfo.orderStatus,
      // Total value fields
      customerPrice: orderInfo.customerPrice,
      totalPrice: orderInfo.totalPrice,
      price: orderInfo.price,
      // Date fields
      createdDate: orderInfo.createdDate,
      orderDate: orderInfo.orderDate,
      deliveryDate: orderInfo.deliveryDate,
      // Full orderInfo for reference
      fullOrderInfo: orderInfo
    };

    return {
      success: true,
      debugInfo: debugInfo,
      fullOrderData: orderData
    };

  } catch (error) {
    console.error(`Error debugging order ${orderId}:`, error);
    throw new functions.https.HttpsError('internal', `Failed to debug order: ${error.message}`);
  }
});

// Function to test Ongoing WMS credentials and API connectivity
exports.testOngoingWMSCredentials = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    console.log('Testing Ongoing WMS credentials...');
    
    // Get credentials
    const { authHeader, baseUrl } = await getOngoingWMSCredentials(context.auth.uid);
    
    console.log('Credentials retrieved successfully');
    console.log('Base URL:', baseUrl);
    console.log('Auth header present:', !!authHeader);
    
    // Test with a known order ID (214600)
    const testOrderId = 214600;
    const apiUrl = `${baseUrl.replace(/\/$/, '')}/orders/${testOrderId}`;
    
    console.log('Testing API call to:', apiUrl);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'User-Agent': 'LogiFlow/1.0'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const order = await response.json();
      return {
        success: true,
        message: 'Credentials and API connectivity verified',
        orderId: testOrderId,
        orderNumber: order.orderInfo?.orderNumber,
        status: response.status,
        hasOrderData: !!order
      };
    } else {
      const errorText = await response.text();
      console.log('Error response body:', errorText);
      
      return {
        success: false,
        message: `API returned status ${response.status}`,
        status: response.status,
        error: errorText,
        headers: Object.fromEntries(response.headers.entries())
      };
    }
    
  } catch (error) {
    console.error('Error testing credentials:', error);
    
    if (error.name === 'AbortError') {
      throw new functions.https.HttpsError('deadline-exceeded', 'Request timed out');
    }
    
    throw new functions.https.HttpsError('internal', `Error testing credentials: ${error.message}`);
  }
});

// Kickoff function for Cloud Tasks pattern - starts the sync process
exports.kickoffOngoingWMSSync = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { startDate, endDate, chunkSize = 50, maxConcurrentChunks = 10 } = data;
  
  if (!startDate || !endDate) {
    throw new functions.https.HttpsError('invalid-argument', 'startDate and endDate are required');
  }

  try {
    console.log(`Kickoff: Starting Ongoing WMS sync from ${startDate} to ${endDate}`);
    
    // Get or create the Cloud Tasks queue
    const queuePath = await getOrCreateQueue();
    
    // Create sync run document to track progress
    const syncRunId = `sync_${Date.now()}`;
    const syncRunRef = db.collection('syncRuns').doc(syncRunId);
    
    const syncRunData = {
      userId: context.auth.uid,
      startDate,
      endDate,
      chunkSize,
      maxConcurrentChunks,
      status: 'initializing',
      totalChunks: 0,
      completedChunks: 0,
      failedChunks: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      errors: []
    };
    
    await syncRunRef.set(syncRunData);
    
    // Calculate order ID chunks based on date range
    // For Ongoing WMS, we'll use a range of order IDs and filter by date
    const startOrderId = 200000; // Wide range discovery - start from lower number
    const endOrderId = 250000;   // Wide range discovery - go much higher
    const totalOrders = endOrderId - startOrderId + 1;
    
    // Use larger chunks to reduce total number of tasks
    const optimizedChunkSize = 500; // Increased from 75 to 500
    const totalChunks = Math.ceil(totalOrders / optimizedChunkSize);
    
    console.log(`Kickoff: Processing potential ${totalOrders} orders in ${totalChunks} chunks of ${optimizedChunkSize} orders each (discovery mode)`);
    
    // Update sync run with total chunks
    await syncRunRef.update({
      totalChunks,
      status: 'queuing',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Enqueue tasks in smaller batches to avoid timeouts
    const batchSize = 5; // Reduced batch size for task creation
    let tasksCreated = 0;
    
    for (let i = 0; i < totalChunks; i += batchSize) {
      const currentBatch = Math.min(batchSize, totalChunks - i);
      
      // Create tasks for current batch
      for (let j = 0; j < currentBatch; j++) {
        const chunkIndex = i + j;
        const chunkStartOrderId = startOrderId + (chunkIndex * optimizedChunkSize);
        const chunkEndOrderId = Math.min(chunkStartOrderId + optimizedChunkSize - 1, endOrderId);
        
        const task = {
          httpRequest: {
            httpMethod: 'POST',
            url: `https://${LOCATION}-${PROJECT_ID}.cloudfunctions.net/processOngoingWMSChunk`,
            headers: {
              'Content-Type': 'application/json',
            },
            body: Buffer.from(JSON.stringify({
              syncRunId,
              chunkIndex,
              startOrderId: chunkStartOrderId,
              endOrderId: chunkEndOrderId,
              startDate,
              endDate,
              userId: context.auth.uid,
              discoveryMode: true
            })).toString('base64'),
          },
          scheduleTime: {
            seconds: Date.now() / 1000 + (chunkIndex * 3), // Stagger tasks by 3 seconds
          },
        };
        
        await tasksClient.createTask({
          parent: queuePath,
          task: task,
        });
        
        tasksCreated++;
      }
      
      console.log(`Kickoff: Enqueued batch ${Math.floor(i / batchSize) + 1} (${currentBatch} tasks, total: ${tasksCreated}/${totalChunks})`);
      
      // Longer delay between batches to avoid rate limits and timeouts
      if (i + batchSize < totalChunks) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }
    }
    
    // Update sync run status
    await syncRunRef.update({
      status: 'queued',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`Kickoff: Successfully enqueued ${tasksCreated} tasks for sync run ${syncRunId}`);
    
    return {
      success: true,
      syncRunId,
      totalChunks,
      message: `Sync started with ${totalChunks} chunks (discovery mode)`
    };
    
  } catch (error) {
    console.error('Kickoff error:', error);
    throw new functions.https.HttpsError('internal', `Kickoff failed: ${error.message}`);
  }
});

// Worker function - processes individual chunks
exports.processOngoingWMSChunk = functions.https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }
  
  try {
    const {
      syncRunId,
      chunkIndex,
      startOrderId,
      endOrderId,
      startDate,
      endDate,
      userId,
      discoveryMode = false
    } = req.body;
    
    console.log(`Worker: Processing chunk ${chunkIndex} (orders ${startOrderId}-${endOrderId})`);
    
    // Get sync run document
    const syncRunRef = db.collection('syncRuns').doc(syncRunId);
    const syncRunDoc = await syncRunRef.get();
    
    if (!syncRunDoc.exists) {
      throw new Error(`Sync run ${syncRunId} not found`);
    }
    
    const syncRun = syncRunDoc.data();
    
    // Get Ongoing WMS credentials
    const { authHeader, baseUrl } = await getOngoingWMSCredentials(userId);
    
    // Initialize BulkWriter for efficient Firestore writes
    const bulkWriter = db.bulkWriter();
    
    const syncedOrders = [];
    const errors = [];
    let totalSynced = 0;
    
    // Convert dates to ISO strings for filtering
    const startDateISO = new Date(startDate + 'T00:00:00Z').toISOString();
    const endDateISO = new Date(endDate + 'T23:59:59Z').toISOString();
    
    // Process orders in this chunk
    for (let orderId = startOrderId; orderId <= endOrderId; orderId++) {
      try {
        const apiUrl = `${baseUrl.replace(/\/$/, '')}/orders/${orderId}`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
            'User-Agent': 'LogiFlow/1.0'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        
        if (response.ok) {
          const order = await response.json();
          
          // Check if order was created within the date range
          const orderCreatedDate = order.orderInfo?.createdDate;
          if (orderCreatedDate) {
            const orderDate = new Date(orderCreatedDate);
            const startDateObj = new Date(startDateISO);
            const endDateObj = new Date(endDateISO);
            
            if (orderDate >= startDateObj && orderDate <= endDateObj) {
              console.log(`Worker: Order ${orderId} (${order.orderInfo.orderNumber}) within date range`);
              
              const firestoreOrder = transformOngoingOrderToFirestore(order);
              
              // Use BulkWriter for efficient writes
              const orderRef = db.collection('ongoingOrders').doc(order.orderInfo.orderNumber.toString());
              bulkWriter.set(orderRef, firestoreOrder, { merge: true });
              
              // Store order lines separately
              if (order.orderLines && order.orderLines.length > 0) {
                for (const line of order.orderLines) {
                  const lineRef = db.collection('ongoingOrderLines').doc(`${order.orderInfo.orderNumber}_${line.id}`);
                  
                  const lineData = {
                    orderId: order.orderInfo.orderNumber.toString(),
                    ongoingLineItemId: line.id,
                    rowNumber: line.rowNumber,
                    articleNumber: line.article?.articleNumber,
                    articleName: line.article?.articleName,
                    productCode: line.article?.productCode,
                    productId: line.article?.articleId,
                    orderedQuantity: line.orderedNumberOfItems,
                    allocatedQuantity: line.allocatedNumberOfItems,
                    pickedQuantity: line.pickedNumberOfItems,
                    packedQuantity: line.packedNumberOfItems,
                    linePrice: line.prices?.linePrice,
                    customerLinePrice: line.prices?.customerLinePrice,
                    currencyCode: line.prices?.currencyCode,
                    deliveryDate: line.deliveryDate,
                    comment: line.comment,
                    deliveryStatus: 'pending',
                    deliveredQuantity: 0,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                  };
                  
                  const cleanedLineData = removeUndefinedValues(lineData);
                  bulkWriter.set(lineRef, cleanedLineData);
                }
              }
              
              syncedOrders.push({
                orderId,
                orderNumber: order.orderInfo.orderNumber,
                createdDate: orderCreatedDate
              });
              
              totalSynced++;
            }
          }
        } else if (response.status === 404) {
          console.log(`Worker: Order ${orderId} not found (discovery mode)`);
        } else if (response.status === 403) {
          console.log(`Worker: Order ${orderId} access denied (discovery mode - skipping)`);
          // Don't count 403 errors in discovery mode - they're expected for non-existent orders
        } else {
          console.log(`Worker: Order ${orderId} returned status ${response.status}`);
          errors.push({ orderId, error: `HTTP ${response.status}` });
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log(`Worker: Timeout fetching order ${orderId}`);
          errors.push({ orderId, error: 'Request timeout' });
        } else {
          console.error(`Worker: Error fetching order ${orderId}:`, error.message);
          errors.push({ orderId, error: error.message });
        }
      }
    }
    
    // Commit all writes using BulkWriter
    await bulkWriter.close();
    
    // Update sync run progress
    await syncRunRef.update({
      completedChunks: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`Worker: Chunk ${chunkIndex} completed: ${totalSynced} orders synced, ${errors.length} errors`);
    
    res.status(200).json({
      success: true,
      chunkIndex,
      totalSynced,
      errors: errors.length,
      syncedOrders: syncedOrders.length
    });
    
  } catch (error) {
    console.error('Worker error:', error);
    
    // Update sync run with error
    if (req.body.syncRunId) {
      const syncRunRef = db.collection('syncRuns').doc(req.body.syncRunId);
      await syncRunRef.update({
        failedChunks: admin.firestore.FieldValue.increment(1),
        errors: admin.firestore.FieldValue.arrayUnion({
          chunkIndex: req.body.chunkIndex,
          error: error.message,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        }),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Function to get sync run status and progress
exports.getSyncRunStatus = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { syncRunId } = data;
  
  if (!syncRunId) {
    throw new functions.https.HttpsError('invalid-argument', 'syncRunId is required');
  }

  try {
    const syncRunRef = db.collection('syncRuns').doc(syncRunId);
    const syncRunDoc = await syncRunRef.get();
    
    if (!syncRunDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Sync run not found');
    }
    
    const syncRun = syncRunDoc.data();
    
    // Calculate progress
    const totalChunks = syncRun.totalChunks || 0;
    const completedChunks = syncRun.completedChunks || 0;
    const failedChunks = syncRun.failedChunks || 0;
    const progress = totalChunks > 0 ? Math.round((completedChunks / totalChunks) * 100) : 0;
    
    // Determine status
    let status = syncRun.status;
    if (status === 'queued' && completedChunks + failedChunks >= totalChunks) {
      status = failedChunks > 0 ? 'completed_with_errors' : 'completed';
    }
    
    return {
      success: true,
      syncRun: {
        ...syncRun,
        progress,
        status,
        totalChunks,
        completedChunks,
        failedChunks,
        remainingChunks: totalChunks - completedChunks - failedChunks
      }
    };
    
  } catch (error) {
    console.error('Get sync run status error:', error);
    throw new functions.https.HttpsError('internal', `Failed to get sync run status: ${error.message}`);
  }
});

// Function to list all sync runs for a user
exports.listSyncRuns = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    const syncRunsRef = db.collection('syncRuns')
      .where('userId', '==', context.auth.uid)
      .orderBy('createdAt', 'desc')
      .limit(20);
    
    const snapshot = await syncRunsRef.get();
    
    const syncRuns = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      const totalChunks = data.totalChunks || 0;
      const completedChunks = data.completedChunks || 0;
      const failedChunks = data.failedChunks || 0;
      const progress = totalChunks > 0 ? Math.round((completedChunks / totalChunks) * 100) : 0;
      
      syncRuns.push({
        id: doc.id,
        ...data,
        progress,
        remainingChunks: totalChunks - completedChunks - failedChunks
      });
    });
    
    return {
      success: true,
      syncRuns
    };
    
  } catch (error) {
    console.error('List sync runs error:', error);
    throw new functions.https.HttpsError('internal', `Failed to list sync runs: ${error.message}`);
  }
});
