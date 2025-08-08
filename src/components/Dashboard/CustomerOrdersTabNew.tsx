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
import { getCustomerOrders, getOrderLines, getOngoingOrders, getOngoingOrderLines, CustomerOrder, OngoingOrder, OrderLine, OngoingOrderLine } from '../../lib/firebaseUtils';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebaseClient';
import OrderDetailsModal from './CustomerOrders/OrderDetailsModal';

// Union type for both order types
type OrderData = CustomerOrder | OngoingOrder;

type OrderSource = 'woocommerce' | 'ongoing_wms' | 'combined';

const CustomerOrdersTabNew: React.FC = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deliveryFilter, setDeliveryFilter] = useState<string>('all');
  const [customerOrders, setCustomerOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderData | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [isLoadingLines, setIsLoadingLines] = useState(false);
  const [activeTab, setActiveTab] = useState<OrderSource>('ongoing_wms');
  
  console.log('CustomerOrdersTabNew rendered with activeTab:', activeTab);

  // Load orders from Firestore database without order lines
  const loadOrdersFromDatabase = async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      console.log('Loading orders from database...');
      
      let orders: OrderData[] = [];
      
      if (activeTab === 'woocommerce') {
        const wooOrders = await getCustomerOrders(statusFilter);
        orders = wooOrders;
        console.log(`Loaded ${orders.length} WooCommerce orders`);
      } else if (activeTab === 'ongoing_wms') {
        const ongoingOrders = await getOngoingOrders(statusFilter);
        orders = ongoingOrders;
        console.log(`Loaded ${orders.length} Ongoing WMS orders`);
      } else if (activeTab === 'combined') {
        // Load both types of orders for combined view
        const [wooOrders, ongoingOrders] = await Promise.all([
          getCustomerOrders(statusFilter),
          getOngoingOrders(statusFilter)
        ]);
        orders = [...wooOrders, ...ongoingOrders];
        console.log(`Loaded ${wooOrders.length} WooCommerce + ${ongoingOrders.length} Ongoing WMS orders = ${orders.length} total`);
      }
      
      setCustomerOrders(orders);
      console.log(`Loaded ${orders.length} orders from database (${activeTab})`);
    } catch (err: any) {
      console.error('Error loading orders from database:', err);
      setError(err.message || 'Failed to load orders from database');
    } finally {
      setLoading(false);
    }
  };

  // Load order lines for a specific order
  const loadOrderLines = async (orderId: string, source: 'woocommerce' | 'ongoing_wms') => {
    if (!user?.id) return [];

    setIsLoadingLines(true);

    try {
      console.log(`Loading order lines for order ${orderId} (${source})...`);
      
      let orderLines: any[] = [];
      
      if (source === 'woocommerce') {
        const wooLines = await getOrderLines(orderId);
        orderLines = wooLines;
      } else {
        const ongoingLines = await getOngoingOrderLines(orderId);
        orderLines = ongoingLines;
      }
      
      console.log(`Loaded ${orderLines.length} order lines for order ${orderId} (${source})`);
      return orderLines;
    } catch (err: any) {
      console.error(`Error loading order lines for order ${orderId}:`, err);
      return [];
    } finally {
      setIsLoadingLines(false);
    }
  };

  // Load orders from database on component mount and when active tab changes
  useEffect(() => {
    loadOrdersFromDatabase();
  }, [activeTab]);

  const handleRefresh = () => {
    loadOrdersFromDatabase();
  };

  const handleSync = () => {
    if (activeTab === 'woocommerce') {
      // syncOrdersFromWooCommerce();
      console.log('Would sync WooCommerce');
    } else if (activeTab === 'ongoing_wms') {
      // syncOrdersFromOngoingWMS();
      console.log('Would sync Ongoing WMS');
    } else {
      console.log('Would sync both');
    }
  };

  return (
    <div className="space-y-6">
      {/* TEST INDICATOR */}
      <div className="bg-red-500 text-white p-4 rounded-lg text-center font-bold text-2xl">
        🚨 NEW COMPONENT DEPLOYED - CUSTOMERORDERSTABNEW 🚨
        <br />
        <span className="text-sm">Timestamp: {new Date().toISOString()}</span>
        <br />
        <span className="text-sm">Active Tab: {activeTab}</span>
      </div>
      
      {/* Header with Tabs */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customer Orders - NEW COMPONENT</h1>
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
            <span>
              {syncing 
                ? `Syncing ${activeTab === 'combined' ? 'all sources' : activeTab === 'woocommerce' ? 'WooCommerce' : 'Ongoing WMS'}...` 
                : `Sync ${activeTab === 'combined' ? 'All Sources' : activeTab === 'woocommerce' ? 'WooCommerce' : 'Ongoing WMS'}`
              }
            </span>
          </button>
          
          <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>New Order</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('ongoing_wms')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'ongoing_wms'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Ongoing WMS Orders
          </button>
          
          <button
            onClick={() => setActiveTab('woocommerce')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'woocommerce'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            WooCommerce Orders
          </button>
          
          <button
            onClick={() => setActiveTab('combined')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'combined'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Combined View
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Orders from {activeTab === 'ongoing_wms' ? 'Ongoing WMS' : activeTab === 'woocommerce' ? 'WooCommerce' : 'Combined View'}
        </h2>
        <p className="text-gray-600">
          Total orders: {customerOrders.length}
        </p>
        <p className="text-gray-600">
          Active tab: {activeTab}
        </p>
      </div>
    </div>
  );
};

export default CustomerOrdersTabNew;
