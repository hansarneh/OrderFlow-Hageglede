// Ongoing WMS Order Sync Functions
// These functions will be added to functions/index.js

// Helper function to get Ongoing WMS credentials
async function getOngoingWMSCredentials() {
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

  return { authHeader, baseUrl };
}

// Helper function to transform Ongoing WMS order to Firestore format
function transformOngoingOrderToFirestore(ongoingOrder) {
  const orderInfo = ongoingOrder.orderInfo;
  const consignee = ongoingOrder.consignee;
  const orderLines = ongoingOrder.orderLines || [];

  return {
    // Order identification
    ongoingOrderId: orderInfo.orderId,
    orderNumber: orderInfo.orderNumber,
    goodsOwnerOrderId: orderInfo.goodsOwnerOrderId,
    
    // Order status and dates
    orderStatus: orderInfo.orderStatus,
    deliveryDate: orderInfo.deliveryDate,
    createdDate: orderInfo.createdDate,
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
    totalValue: orderInfo.customerPrice || 0,
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

    const { status, goodsOwnerId = 85, limit = 100 } = data;

    if (!status) {
      throw new functions.https.HttpsError('invalid-argument', 'Status is required');
    }

    const { authHeader, baseUrl } = await getOngoingWMSCredentials();

    console.log(`Syncing orders with status: ${status}, goodsOwnerId: ${goodsOwnerId}`);

    // Since we can't list all orders directly, we'll need to use a different approach
    // For now, we'll fetch orders by testing a range of order IDs
    const orderIds = [];
    const syncedOrders = [];
    const errors = [];

    // Test a range of order IDs (you can adjust this range)
    const startOrderId = 214000;
    const endOrderId = 217000;
    const batchSize = 10;

    for (let i = startOrderId; i <= endOrderId && syncedOrders.length < limit; i += batchSize) {
      const batch = [];
      for (let j = 0; j < batchSize && i + j <= endOrderId; j++) {
        batch.push(i + j);
      }

      // Fetch orders in parallel
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
            
            // Check if order matches the requested status
            if (order.orderInfo?.orderStatus?.number === status) {
              const firestoreOrder = transformOngoingOrderToFirestore(order);
              
              // Store in Firestore
              await db.collection('ongoingOrders').doc(orderId.toString()).set(firestoreOrder);
              
              syncedOrders.push({
                orderId: orderId,
                orderNumber: order.orderInfo.orderNumber,
                status: order.orderInfo.orderStatus.text
              });
              
              console.log(`Synced order ${orderId} (${order.orderInfo.orderNumber})`);
            }
          }
        } catch (error) {
          console.error(`Error fetching order ${orderId}:`, error.message);
          errors.push({ orderId, error: error.message });
        }
      });

      await Promise.all(promises);
      
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
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

    const { authHeader, baseUrl } = await getOngoingWMSCredentials();

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

    const { authHeader, baseUrl } = await getOngoingWMSCredentials();

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

    const { authHeader, baseUrl } = await getOngoingWMSCredentials();

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
    const { authHeader, baseUrl } = await getOngoingWMSCredentials();

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
    const { authHeader, baseUrl } = await getOngoingWMSCredentials();

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
