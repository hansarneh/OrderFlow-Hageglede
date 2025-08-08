const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();
const fetch = require("node-fetch");

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
});