import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  addDoc, 
  serverTimestamp,
  Timestamp,
  orderBy,
  limit,
  startAfter,
  DocumentData,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { db } from './firebaseClient';

// Products
export interface Product {
  id: string;
  woocommerceId: number;
  name: string;
  sku: string | null;
  stockQuantity: number;
  stockStatus: string;
  manageStock: boolean;
  price: string;
  regularPrice: string;
  salePrice: string;
  permalink: string | null;
  productType: string;
  status: string;
  dateCreated: string | null;
  dateModified: string | null;
  lastWebhookUpdate: string;
  createdAt: string;
  updatedAt: string;
  produkttype?: string | null;
}

export const getProducts = async (
  statusFilter: string = 'all',
  produkttypeFilter: string = 'all',
  page: number = 1,
  pageSize: number = 50,
  lastDoc?: QueryDocumentSnapshot<DocumentData>
): Promise<{ products: Product[], lastDoc?: QueryDocumentSnapshot<DocumentData> }> => {
  try {
    let q = query(
      collection(db, 'products'),
      where('status', '==', 'publish'),
      orderBy('name', 'asc'),
      limit(pageSize)
    );
    
    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }
    
    if (statusFilter !== 'all') {
      // Apply stock status filter
      if (statusFilter === 'in-stock') {
        q = query(q, where('stockQuantity', '>', 0));
      } else if (statusFilter === 'low-stock') {
        q = query(q, where('stockQuantity', '>', 0), where('stockQuantity', '<', 10));
      } else if (statusFilter === 'out-of-stock') {
        q = query(q, where('stockQuantity', '==', 0));
      } else if (statusFilter === 'backordered') {
        q = query(q, where('stockQuantity', '<', 0));
      }
    }
    
    if (produkttypeFilter !== 'all') {
      q = query(q, where('produkttype', '==', produkttypeFilter));
    }
    
    const snapshot = await getDocs(q);
    
    const products = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        woocommerceId: data.woocommerceId,
        name: data.name,
        sku: data.sku,
        stockQuantity: data.stockQuantity,
        stockStatus: data.stockStatus,
        manageStock: data.manageStock,
        price: data.price,
        regularPrice: data.regularPrice,
        salePrice: data.salePrice,
        permalink: data.permalink,
        productType: data.productType,
        status: data.status,
        dateCreated: data.dateCreated,
        dateModified: data.dateModified,
        lastWebhookUpdate: data.lastWebhookUpdate,
        createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString() || new Date().toISOString(),
        produkttype: data.produkttype
      } as Product;
    });
    
    const lastVisible = snapshot.docs[snapshot.docs.length - 1];
    
    return { 
      products, 
      lastDoc: lastVisible 
    };
  } catch (error) {
    console.error('Error getting products:', error);
    // Return empty array on error to prevent app from crashing
    return { products: [] };
  }
};

export const getBackorderedProducts = async (): Promise<Product[]> => {
  try {
    const q = query(
      collection(db, 'products'),
      where('stockQuantity', '<', 0),
      where('status', '==', 'publish')
    );
    
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        woocommerceId: data.woocommerceId,
        name: data.name,
        sku: data.sku,
        stockQuantity: data.stockQuantity,
        stockStatus: data.stockStatus,
        manageStock: data.manageStock,
        price: data.price,
        regularPrice: data.regularPrice,
        salePrice: data.salePrice,
        permalink: data.permalink,
        productType: data.productType,
        status: data.status,
        dateCreated: data.dateCreated,
        dateModified: data.dateModified,
        lastWebhookUpdate: data.lastWebhookUpdate,
        createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString() || new Date().toISOString(),
        produkttype: data.produkttype
      } as Product;
    });
  } catch (error) {
    console.error('Error getting backordered products:', error);
    // Return empty array on error to prevent app from crashing
    return [];
  }
};

// Integrations
export interface Integration {
  id: string;
  userId: string;
  integrationType: string;
  credentials: any;
  createdAt: string;
  updatedAt: string;
}

export const getIntegrations = async (userId: string): Promise<Integration[]> => {
  try {
    const q = query(
      collection(db, 'integrations'),
      where('userId', '==', userId)
    );
    
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        integrationType: data.integrationType,
        credentials: data.credentials,
        createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString() || new Date().toISOString()
      } as Integration;
    });
  } catch (error) {
    console.error('Error getting integrations:', error);
    // Return empty array on error to prevent app from crashing
    return [];
  }
};

export const saveIntegration = async (
  userId: string, 
  integrationType: string, 
  credentials: any
): Promise<void> => {
  try {
    // Check if integration already exists
    const q = query(
      collection(db, 'integrations'),
      where('userId', '==', userId),
      where('integrationType', '==', integrationType)
    );
    
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      // Update existing integration
      const docRef = snapshot.docs[0].ref;
      await updateDoc(docRef, {
        credentials,
        updatedAt: serverTimestamp()
      });
    } else {
      // Create new integration
      await addDoc(collection(db, 'integrations'), {
        userId,
        integrationType,
        credentials,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Error saving integration:', error);
    throw error;
  }
};

// Customer Orders
export interface CustomerOrder {
  id: string;
  woocommerceOrderId: number;
  orderNumber: string;
  customerName: string;
  wooStatus: string;
  totalValue: number;
  totalItems: number;
  dateCreated: string;
  lineItems: any[];
  metaData: any;
  billingAddress: string;
  billingAddressJson: any;
  permalink: string | null;
  createdAt: string;
  updatedAt: string;
  deliveryType: string | null;
  shippingMethodTitle: string | null;
  deliveryDate: string | null;
  orderLines?: OrderLine[];
}

export interface OrderLine {
  id: string;
  orderId: string;
  woocommerceLineItemId: number;
  productId: number;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  taxAmount: number;
  metaData: any;
  deliveredQuantity: number;
  deliveryDate: string | null;
  deliveryStatus: 'pending' | 'partial' | 'delivered' | 'cancelled';
  partialDeliveryDetails: any;
  product?: {
    id: string;
    woocommerceId: number;
    name: string;
    sku: string | null;
    stockQuantity: number;
    stockStatus: string;
    produkttype: string | null;
  };
}

export const getCustomerOrders = async (statusFilter: string = 'all'): Promise<CustomerOrder[]> => {
  try {
    let q = query(
      collection(db, 'customerOrders'),
      orderBy('dateCreated', 'desc')
    );
    
    if (statusFilter !== 'all') {
      q = query(q, where('wooStatus', '==', statusFilter));
    }
    
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        woocommerceOrderId: data.woocommerceOrderId,
        orderNumber: data.orderNumber,
        customerName: data.customerName,
        wooStatus: data.wooStatus,
        totalValue: data.totalValue,
        totalItems: data.totalItems,
        dateCreated: data.dateCreated,
        lineItems: data.lineItems || [],
        metaData: data.metaData || {},
        billingAddress: data.billingAddress,
        billingAddressJson: data.billingAddressJson,
        permalink: data.permalink,
        createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString() || new Date().toISOString(),
        deliveryType: data.deliveryType,
        shippingMethodTitle: data.shippingMethodTitle,
        deliveryDate: data.deliveryDate
      } as CustomerOrder;
    });
  } catch (error) {
    console.error('Error getting customer orders:', error);
    // Return empty array on error to prevent app from crashing
    return [];
  }
};

export const getOrderLines = async (orderId: string): Promise<OrderLine[]> => {
  try {
    const q = query(
      collection(db, 'orderLines'),
      where('orderId', '==', orderId)
    );
    
    const snapshot = await getDocs(q);
    
    const orderLines = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        orderId: data.orderId,
        woocommerceLineItemId: data.woocommerceLineItemId,
        productId: data.productId,
        productName: data.productName,
        sku: data.sku,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        totalPrice: data.totalPrice,
        taxAmount: data.taxAmount,
        metaData: data.metaData,
        deliveredQuantity: data.deliveredQuantity,
        deliveryDate: data.deliveryDate,
        deliveryStatus: data.deliveryStatus,
        partialDeliveryDetails: data.partialDeliveryDetails
      } as OrderLine;
    });
    
    // Fetch product details for each order line
    for (const line of orderLines) {
      if (line.productId) {
        try {
          const productsQuery = query(
            collection(db, 'products'),
            where('woocommerceId', '==', line.productId)
          );
          
          const productSnapshot = await getDocs(productsQuery);
          
          if (!productSnapshot.empty) {
            const productData = productSnapshot.docs[0].data();
            line.product = {
              id: productSnapshot.docs[0].id,
              woocommerceId: productData.woocommerceId,
              name: productData.name,
              sku: productData.sku,
              stockQuantity: productData.stockQuantity,
              stockStatus: productData.stockStatus,
              produkttype: productData.produkttype
            };
          }
        } catch (productError) {
          console.warn(`Error fetching product details for line ${line.id}:`, productError);
          // Continue without product details
        }
      }
    }
    
    return orderLines;
  } catch (error) {
    console.error('Error getting order lines:', error);
    // Return empty array on error to prevent app from crashing
    return [];
  }
};

export const getOrdersAtRisk = async (): Promise<CustomerOrder[]> => {
  try {
    // Get all orders with processing or delvis-levert status
    const q = query(
      collection(db, 'customerOrders'),
      where('wooStatus', 'in', ['processing', 'delvis-levert'])
    );
    
    const snapshot = await getDocs(q);
    
    const orders = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        woocommerceOrderId: data.woocommerceOrderId,
        orderNumber: data.orderNumber,
        customerName: data.customerName,
        wooStatus: data.wooStatus,
        totalValue: data.totalValue,
        totalItems: data.totalItems,
        dateCreated: data.dateCreated,
        permalink: data.permalink,
        deliveryDate: data.deliveryDate,
        deliveryType: data.deliveryType,
        shippingMethodTitle: data.shippingMethodTitle
      } as CustomerOrder;
    });
    
    // Process orders to identify those at risk
    const processedOrders = await Promise.all(orders.map(async (order) => {
      // Check if order has a delivery date and it's in the past
      const hasOverdueDeliveryDate = order.deliveryDate && new Date(order.deliveryDate) < new Date();
      
      // Get order lines to check for backordered products
      let orderLines: OrderLine[] = [];
      try {
        orderLines = await getOrderLines(order.id);
      } catch (error) {
        console.warn(`Error getting order lines for order ${order.id}:`, error);
        // Continue with empty order lines
      }
      
      // Check if any order line has a backordered product (negative stock)
      const hasBackorderedProducts = orderLines.some(line => 
        line.product && 
        line.product.stockQuantity !== undefined && 
        line.product.stockQuantity < 0
      );
      
      // An order is at risk if it has both an overdue delivery date AND contains backordered products
      const isAtRisk = hasOverdueDeliveryDate && hasBackorderedProducts;
      
      // Calculate days since delivery date
      let daysSinceDeliveryDate = 0;
      if (isAtRisk && order.deliveryDate) {
        const deliveryDate = new Date(order.deliveryDate);
        const today = new Date();
        const diffTime = Math.abs(today.getTime() - deliveryDate.getTime());
        daysSinceDeliveryDate = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
      
      // Determine risk level based on days overdue
      let riskLevel: 'high' | 'medium' | 'low' = 'low';
      if (daysSinceDeliveryDate > 30) {
        riskLevel = 'high';
      } else if (daysSinceDeliveryDate > 14) {
        riskLevel = 'medium';
      }
      
      return {
        ...order,
        isAtRisk,
        riskReason: isAtRisk ? 
          `Order is ${daysSinceDeliveryDate} days past delivery date and contains backordered products` : 
          undefined,
        riskLevel: isAtRisk ? riskLevel : undefined,
        daysSinceDeliveryDate: isAtRisk ? daysSinceDeliveryDate : undefined,
        orderLines
      };
    }));
    
    // Filter to only at-risk orders
    const atRiskOrders = processedOrders.filter(order => order.isAtRisk);
    
    return atRiskOrders;
  } catch (error) {
    console.error('Error getting orders at risk:', error);
    // Return empty array on error to prevent app from crashing
    return [];
  }
};

// Purchase Orders
export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplier: string;
  supplierNumber: string;
  status: 'delivered' | 'in-transit' | 'delayed' | 'pending';
  priority: 'high' | 'medium' | 'low';
  value: number;
  currency: string;
  items: number;
  createdDate: string;
  expectedDelivery: string | null;
  actualDelivery: string | null;
  trackingNumber?: string;
  orderLines: Array<{
    productNumber: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
}

export const getPurchaseOrders = async (): Promise<PurchaseOrder[]> => {
  try {
    const snapshot = await getDocs(collection(db, 'purchaseOrders'));
    
    const purchaseOrders = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        poNumber: data.poNumber,
        supplier: data.supplier,
        supplierNumber: data.supplierNumber,
        status: data.status,
        priority: data.priority,
        value: data.value,
        currency: data.currency,
        items: data.items,
        createdDate: data.createdDate,
        expectedDelivery: data.expectedDelivery,
        actualDelivery: data.actualDelivery,
        trackingNumber: data.trackingNumber,
        orderLines: []
      } as PurchaseOrder;
    });
    
    // Fetch order lines for each purchase order
    for (const po of purchaseOrders) {
      try {
        const linesQuery = query(
          collection(db, 'purchaseOrderLines'),
          where('purchaseOrderId', '==', po.poNumber)
        );
        
        const linesSnapshot = await getDocs(linesQuery);
        
        po.orderLines = linesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            productNumber: data.productNumber,
            productName: data.productName,
            quantity: data.quantity,
            unitPrice: data.unitPrice,
            totalPrice: data.totalPrice
          };
        });
        
        // Calculate total items from order lines
        po.items = po.orderLines.reduce((sum, line) => sum + line.quantity, 0);
      } catch (error) {
        console.warn(`Error fetching order lines for PO ${po.id}:`, error);
        // Continue with empty order lines
      }
    }
    
    return purchaseOrders;
  } catch (error) {
    console.error('Error getting purchase orders:', error);
    // Return empty array on error to prevent app from crashing
    return [];
  }
};