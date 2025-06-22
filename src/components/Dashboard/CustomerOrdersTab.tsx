import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  Package, 
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
  User,
  DollarSign,
  ChevronDown,
  ChevronRight,
  ShoppingCart,
  Box,
  Truck
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getCustomerOrders, getOrderLines } from '../../lib/firebaseUtils';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebaseClient';
import OrderDetailsModal from './CustomerOrders/OrderDetailsModal';

interface OrderLine {
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

interface CustomerOrder {
  id: string;
  woocommerceOrderId: number;
  orderNumber: string;
  customerName: string;
  wooStatus: string;
  totalValue: number;
  totalItems: number;
  dateCreated: string;
  lineItems: Array<{
    id: number;
    name: string;
    product_id: number;
    quantity: number;
    total: string;
    sku: string;
  }>;
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

const CustomerOrdersTab: React.FC = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deliveryFilter, setDeliveryFilter] = useState<string>('all');
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [isLoadingLines, setIsLoadingLines] = useState(false);

  // Load orders from Firestore database without order lines
  const loadOrdersFromDatabase = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('Loading orders from database...');
      
      // Get all orders without order_lines to improve performance
      const orders = await getCustomerOrders();

      console.log(`Loaded ${orders?.length || 0} orders from database`);
      setCustomerOrders(orders || []);
      setLastSyncTime(new Date().toLocaleString());
    } catch (err: any) {
      console.error('Error loading orders from database:', err);
      setError(err.message || 'Failed to load orders from database');
      setCustomerOrders([]);
    } finally {
      setLoading(false);
    }
  };

  // Load order lines for a specific order
  const loadOrderLines = async (orderId: string) => {
    setIsLoadingLines(true);
    try {
      console.log(`Loading order lines for order ${orderId}...`);
      
      const lines = await getOrderLines(orderId);

      console.log(`Loaded ${lines?.length || 0} order lines for order ${orderId}`);
      return lines || [];
    } catch (err: any) {
      console.error(`Error loading order lines for order ${orderId}:`, err);
      return [];
    } finally {
      setIsLoadingLines(false);
    }
  };

  // Helper function to extract detailed error message from Edge Function response
  const extractDetailedError = (functionError: any): string => {
    try {
      // Check if the error has context with a response body
      if (functionError.context?.body) {
        const errorData = JSON.parse(functionError.context.body);
        if (errorData.error) {
          // If there are additional details, include them
          if (errorData.details && errorData.details !== errorData.error) {
            return `${errorData.error}\n\nDetails: ${errorData.details}`;
          }
          return errorData.error;
        }
      }
      
      // Check if the error message itself contains useful information
      if (functionError.message) {
        return functionError.message;
      }
      
      // Fallback to the original error
      return functionError.toString();
    } catch (parseError) {
      // If we can't parse the error, return the original message
      return functionError.message || functionError.toString() || 'Unknown error occurred';
    }
  };

  // Sync orders from WooCommerce
  const syncOrdersFromWooCommerce = async () => {
    if (!user?.id) return;

    setSyncing(true);
    setError(null);

    try {
      console.log('Syncing orders from WooCommerce (processing, delvis-levert)...');

      const syncWooCommerceOrders = httpsCallable(functions, 'syncWooCommerceOrders');
      const result = await syncWooCommerceOrders();
      
      const data = result.data as any;

      if (data.error) {
        throw new Error(data.error);
      }

      console.log('Orders sync completed:', data);
      
      // Show success message with details
      const message = `${data.message}\n\nDetails:\n- Status Filter: ${data.statusFilter}\n- Date Range: ${data.dateRange}\n- Orders Synced: ${data.syncedCount}\n- Errors: ${data.errorCount}`;
      alert(message);

      // Reload orders from database after sync
      await loadOrdersFromDatabase();
      
    } catch (err: any) {
      console.error('Error syncing orders from WooCommerce:', err);
      
      // Provide more helpful error messages for common connection issues
      let userFriendlyError = err.message || 'Failed to sync orders from WooCommerce';
      
      if (userFriendlyError.includes('Failed to send a request to the Edge Function')) {
        userFriendlyError = 'Unable to connect to WooCommerce. This usually means:\n\n' +
          '1. Your WooCommerce store URL is set to a local address (localhost, 127.0.0.1, etc.) which cannot be accessed by Firebase Functions\n' +
          '2. Your store is behind a firewall or VPN\n' +
          '3. Your store URL is incorrect or the domain doesn\'t exist\n\n' +
          'Please check your WooCommerce settings and ensure your store URL is publicly accessible.';
      } else if (userFriendlyError.includes('TypeError: Failed to fetch')) {
        userFriendlyError = 'Network connection failed. Please check:\n\n' +
          '1. Your WooCommerce store URL is publicly accessible (not localhost or private IP)\n' +
          '2. Your store is online and responding\n' +
          '3. Your WooCommerce API credentials are correct\n\n' +
          'Go to Settings → Integrations to verify your configuration.';
      } else if (userFriendlyError.includes('Edge Function returned a non-2xx status code')) {
        userFriendlyError = 'Service temporarily unavailable. Please check your WooCommerce API configuration in Settings and try again.';
      }
      
      setError(userFriendlyError);
    } finally {
      setSyncing(false);
    }
  };

  // Load orders from database on component mount
  useEffect(() => {
    loadOrdersFromDatabase();
  }, []);

  const getStatusCounts = () => {
    const processing = customerOrders.filter(o => o.wooStatus === 'processing').length;
    const delvisLevert = customerOrders.filter(o => o.wooStatus === 'delvis-levert').length;
    const onHold = customerOrders.filter(o => o.wooStatus === 'on-hold').length;
    const pending = customerOrders.filter(o => o.wooStatus === 'pending').length;
    const completed = customerOrders.filter(o => o.wooStatus === 'completed').length;
    const totalBacklog = processing + delvisLevert + onHold + pending;
    
    return {
      'total-backlog': totalBacklog,
      'processing': processing,
      'delvis-levert': delvisLevert,
      'on-hold': onHold,
      'pending': pending,
      'completed': completed
    };
  };

  const getDeliveryCounts = () => {
    let fullyDelivered = 0;
    let partiallyDelivered = 0;
    let pendingDelivery = 0;

    customerOrders.forEach(order => {
      if (order.orderLines && order.orderLines.length > 0) {
        const deliveredLines = order.orderLines.filter(line => line.deliveryStatus === 'delivered').length;
        const partialLines = order.orderLines.filter(line => line.deliveryStatus === 'partial').length;
        const totalLines = order.orderLines.length;

        if (deliveredLines === totalLines) {
          fullyDelivered++;
        } else if (deliveredLines > 0 || partialLines > 0) {
          partiallyDelivered++;
        } else {
          pendingDelivery++;
        }
      } else {
        pendingDelivery++;
      }
    });

    return {
      'fully-delivered': fullyDelivered,
      'partially-delivered': partiallyDelivered,
      'pending-delivery': pendingDelivery
    };
  };

  const statusCounts = getStatusCounts();
  const deliveryCounts = getDeliveryCounts();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-700 bg-green-100';
      case 'processing': return 'text-blue-700 bg-blue-100';
      case 'delvis-levert': return 'text-purple-700 bg-purple-100';
      case 'on-hold': return 'text-orange-700 bg-orange-100';
      case 'pending': return 'text-yellow-700 bg-yellow-100';
      case 'cancelled': return 'text-red-700 bg-red-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return CheckCircle;
      case 'processing': return Package;
      case 'delvis-levert': return Truck;
      case 'on-hold': return Clock;
      case 'pending': return AlertTriangle;
      case 'cancelled': return XCircle;
      default: return Package;
    }
  };

  const getOrderDeliveryStatus = (order: CustomerOrder) => {
    if (!order.orderLines || order.orderLines.length === 0) {
      return 'pending-delivery';
    }

    const deliveredLines = order.orderLines.filter(line => line.deliveryStatus === 'delivered').length;
    const partialLines = order.orderLines.filter(line => line.deliveryStatus === 'partial').length;
    const totalLines = order.orderLines.length;

    if (deliveredLines === totalLines) {
      return 'fully-delivered';
    } else if (deliveredLines > 0 || partialLines > 0) {
      return 'partially-delivered';
    } else {
      return 'pending-delivery';
    }
  };

  const filteredOrders = customerOrders.filter(order => {
    const matchesSearch = order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.wooStatus === statusFilter;
    
    // For delivery filter, we need to calculate the delivery status on the fly
    // since we're not eagerly loading order_lines for all orders
    let matchesDelivery = true;
    if (deliveryFilter !== 'all' && order.orderLines) {
      const orderDeliveryStatus = getOrderDeliveryStatus(order);
      matchesDelivery = orderDeliveryStatus === deliveryFilter;
    } else if (deliveryFilter !== 'all') {
      // If we don't have order_lines and a delivery filter is set, assume it doesn't match
      matchesDelivery = false;
    }
    
    return matchesSearch && matchesStatus && matchesDelivery;
  });

  const handleStatusFilterClick = (status: string) => {
    setStatusFilter(statusFilter === status ? 'all' : status);
  };

  const handleDeliveryFilterClick = (status: string) => {
    setDeliveryFilter(deliveryFilter === status ? 'all' : status);
  };

  const handleRefresh = () => {
    loadOrdersFromDatabase();
  };

  const handleSync = () => {
    syncOrdersFromWooCommerce();
  };

  const handleOrderClick = async (order: CustomerOrder) => {
    // If order lines are not loaded yet, load them
    if (!order.orderLines || order.orderLines.length === 0) {
      const orderLines = await loadOrderLines(order.id);
      
      // Create a copy of the order with order lines
      const orderWithLines = {
        ...order,
        orderLines
      };
      
      setSelectedOrder(orderWithLines);
    } else {
      setSelectedOrder(order);
    }
    
    setShowOrderModal(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('no-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('no-NO');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customer Orders</h1>
          <p className="text-gray-600 mt-2">Manage and track customer orders with delivery status</p>
          {lastSyncTime && (
            <p className="text-sm text-gray-500 mt-1">Last updated: {lastSyncTime}</p>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={handleRefresh}
            disabled={loading || syncing}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200 flex items-center space-x-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button 
            onClick={handleSync}
            disabled={loading || syncing}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Sync from WooCommerce'}</span>
          </button>
          <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>New Order</span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {(loading || syncing) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center justify-center space-x-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-gray-600">
              {syncing ? 'Syncing orders from WooCommerce...' : 'Loading orders...'}
            </span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && !syncing && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-red-800 font-medium">Operation failed</h3>
              <div className="text-red-700 text-sm mt-2 whitespace-pre-line">{error}</div>
              <div className="mt-4 flex items-center space-x-3">
                <button 
                  onClick={handleRefresh}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Try loading from database
                </button>
                <button 
                  onClick={handleSync}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Try sync again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Data State */}
      {!loading && !syncing && !error && customerOrders.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-gray-900 font-medium mb-2">No orders found</h3>
            <p className="text-gray-600 text-sm mb-4">
              Sync orders from your WooCommerce store to get started. Only orders with status "processing" or "delvis-levert" will be imported.
            </p>
            <button 
              onClick={handleSync}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Sync Orders from WooCommerce
            </button>
          </div>
        </div>
      )}

      {/* Status Filter Cards */}
      {!loading && !syncing && !error && customerOrders.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
            <button
              onClick={() => handleStatusFilterClick('all')}
              className={`bg-white rounded-xl shadow-sm border-2 p-6 text-left transition-all duration-200 hover:shadow-md ${
                statusFilter === 'all' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Orders</p>
                  <p className="text-4xl font-bold text-gray-900 mt-2">{customerOrders.length}</p>
                </div>
                <Package className="w-8 h-8 text-blue-500" />
              </div>
            </button>

            <button
              onClick={() => handleStatusFilterClick('processing')}
              className={`bg-white rounded-xl shadow-sm border-2 p-6 text-left transition-all duration-200 hover:shadow-md ${
                statusFilter === 'processing' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Processing</p>
                  <p className="text-4xl font-bold text-gray-900 mt-2">{statusCounts['processing']}</p>
                </div>
                <Package className="w-8 h-8 text-blue-500" />
              </div>
            </button>

            <button
              onClick={() => handleStatusFilterClick('delvis-levert')}
              className={`bg-white rounded-xl shadow-sm border-2 p-6 text-left transition-all duration-200 hover:shadow-md ${
                statusFilter === 'delvis-levert' ? 'border-purple-500 bg-purple-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Delvis Levert</p>
                  <p className="text-4xl font-bold text-gray-900 mt-2">{statusCounts['delvis-levert']}</p>
                </div>
                <Truck className="w-8 h-8 text-purple-500" />
              </div>
            </button>

            <button
              onClick={() => handleStatusFilterClick('on-hold')}
              className={`bg-white rounded-xl shadow-sm border-2 p-6 text-left transition-all duration-200 hover:shadow-md ${
                statusFilter === 'on-hold' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">On Hold</p>
                  <p className="text-4xl font-bold text-gray-900 mt-2">{statusCounts['on-hold']}</p>
                </div>
                <Clock className="w-8 h-8 text-orange-500" />
              </div>
            </button>

            <button
              onClick={() => handleStatusFilterClick('pending')}
              className={`bg-white rounded-xl shadow-sm border-2 p-6 text-left transition-all duration-200 hover:shadow-md ${
                statusFilter === 'pending' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-4xl font-bold text-gray-900 mt-2">{statusCounts['pending']}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-yellow-500" />
              </div>
            </button>

            <button
              onClick={() => handleStatusFilterClick('completed')}
              className={`bg-white rounded-xl shadow-sm border-2 p-6 text-left transition-all duration-200 hover:shadow-md ${
                statusFilter === 'completed' ? 'border-green-500 bg-green-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Completed</p>
                  <p className="text-4xl font-bold text-gray-900 mt-2">{statusCounts['completed']}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </button>
          </div>

          {/* Sync Status Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    Showing orders with status: "processing" and "delvis-levert"
                  </p>
                  <p className="text-xs text-blue-700">
                    Only orders from the last 200 days are synced. Orders with other statuses are automatically removed from the database.
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="text-xs text-blue-700 hover:text-blue-900 font-medium"
                >
                  Sync Now
                </button>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search orders..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">
                  Showing {filteredOrders.length} of {customerOrders.length} orders
                </span>
              </div>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {statusFilter === 'all' && deliveryFilter === 'all' ? 'All Orders' : 
                 `Filtered Orders (${statusFilter !== 'all' ? statusFilter.replace('-', ' ') : ''}${statusFilter !== 'all' && deliveryFilter !== 'all' ? ' + ' : ''}${deliveryFilter !== 'all' ? deliveryFilter.replace('-', ' ') : ''})`}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide w-32">Order #</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide w-64 max-w-xs">Customer</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Delivery</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Value</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Items</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Date Created</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredOrders.map((order) => {
                    const StatusIcon = getStatusIcon(order.wooStatus);
                    
                    return (
                      <tr 
                        key={order.id} 
                        className="hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
                        onClick={() => handleOrderClick(order)}
                      >
                        <td className="py-4 px-4">
                          <div className="text-sm font-medium text-gray-900">{order.orderNumber}</div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-2">
                            <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <div className="text-sm text-gray-900 truncate max-w-[200px]">{order.customerName}</div>
                          </div>
                          {order.billingAddress && (
                            <div className="text-xs text-gray-500 mt-1 ml-6 truncate max-w-[200px]">
                              {order.billingAddress.replace('\n', ', ')}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.wooStatus)}`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {order.wooStatus.replace('-', ' ')}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="space-y-1">
                            {order.deliveryType && (
                              <div className="text-xs text-gray-600 flex items-center space-x-1">
                                <Truck className="w-3 h-3 text-gray-400" />
                                <span className="truncate max-w-[150px]">{order.deliveryType}</span>
                              </div>
                            )}
                            
                            {order.shippingMethodTitle && (
                              <div className="text-xs text-gray-600 flex items-center space-x-1">
                                <Package className="w-3 h-3 text-gray-400" />
                                <span className="truncate max-w-[150px]">{order.shippingMethodTitle}</span>
                              </div>
                            )}
                            
                            {order.deliveryDate && (
                              <div className="text-xs text-gray-600 flex items-center space-x-1">
                                <Calendar className="w-3 h-3 text-gray-400" />
                                <span>{formatDate(order.deliveryDate)}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-1">
                            <DollarSign className="w-4 h-4 text-gray-400" />
                            <div className="text-sm font-medium text-gray-900">
                              {formatCurrency(order.totalValue)}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-1">
                            <ShoppingCart className="w-4 h-4 text-gray-400" />
                            <div className="text-sm text-gray-900">{order.totalItems}</div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-1 text-sm text-gray-700">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <div>
                              <div className="text-gray-900">{new Date(order.dateCreated).toLocaleDateString()}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-2">
                            {order.permalink && (
                              <a
                                href={order.permalink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 transition-colors duration-200"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredOrders.length === 0 && customerOrders.length > 0 && (
              <div className="bg-gray-50 px-6 py-8 text-center">
                <p className="text-gray-600">No orders match your search criteria.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Order Details Modal */}
      <OrderDetailsModal
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        order={selectedOrder}
        isLoadingLines={isLoadingLines}
      />
    </div>
  );
};

export default CustomerOrdersTab;