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
  Truck,
  RefreshCw,
  Loader2,
  Settings,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { getPurchaseOrders } from '../../../lib/firebaseUtils';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../lib/firebaseClient';

interface PurchaseOrder {
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

const PurchaseOrdersTab: React.FC = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Load purchase orders from Firebase database
  const loadPurchaseOrdersFromDatabase = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('Loading purchase orders from database...');
      
      // Get purchase orders from the database
      const poData = await getPurchaseOrders();

      console.log(`Loaded ${poData?.length || 0} purchase orders from database`);
      setPurchaseOrders(poData || []);
      setLastSyncTime(new Date().toLocaleString());
    } catch (err: any) {
      console.error('Error loading purchase orders from database:', err);
      setError(err.message || 'Failed to load purchase orders from database');
      setPurchaseOrders([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch purchase orders from Rackbeat API
  const fetchRackbeatPurchaseOrders = async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      console.log('Starting sync with Rackbeat API');

      const fetchRackbeatPOsFunction = httpsCallable(functions, 'fetchRackbeatPurchaseOrders');
      const result = await fetchRackbeatPOsFunction();
      
      const data = result.data as any;

      if (data.error) {
        throw new Error(data.error);
      }

      // Check if we have valid data
      if (!data || !data.success) {
        throw new Error('Invalid response from Rackbeat API');
      }

      console.log('Sync completed successfully');
      setPurchaseOrders(data.purchaseOrders || []);
      setLastSyncTime(new Date().toLocaleString());
      
      // After successful sync, reload from database to get the latest data
      await loadPurchaseOrdersFromDatabase();
    } catch (err: any) {
      console.error('Error fetching Rackbeat purchase orders:', err);
      
      // Provide more specific error messages based on the error content
      let errorMessage = err.message || 'Failed to fetch purchase orders from Rackbeat';
      
      // Handle specific error cases
      if (errorMessage.includes('not configured')) {
        errorMessage = 'Rackbeat integration not configured. Please add your Rackbeat API key in Settings.';
      } else if (errorMessage.includes('Invalid Rackbeat API key')) {
        errorMessage = 'Invalid Rackbeat API key. Please check your credentials in Settings.';
      } else if (errorMessage.includes('Access denied')) {
        errorMessage = 'Access denied. Please ensure your Rackbeat API key has the necessary permissions.';
      } else if (errorMessage.includes('Unable to connect')) {
        errorMessage = 'Unable to connect to Rackbeat API. Please verify your API key and network connection.';
      } else if (errorMessage.includes('Connection timeout')) {
        errorMessage = 'Connection timeout. Please check if Rackbeat API is accessible and try again.';
      } else if (errorMessage.includes('Edge Function returned a non-2xx status code')) {
        errorMessage = 'Service temporarily unavailable. Please check your Rackbeat API configuration in Settings and try again.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Load purchase orders from database on component mount
  useEffect(() => {
    loadPurchaseOrdersFromDatabase();
  }, []);

  const getStatusCounts = () => {
    return {
      pending: purchaseOrders.filter(po => po.status === 'pending').length,
      'in-transit': purchaseOrders.filter(po => po.status === 'in-transit').length,
      delivered: purchaseOrders.filter(po => po.status === 'delivered').length,
      delayed: purchaseOrders.filter(po => po.status === 'delayed').length
    };
  };

  const statusCounts = getStatusCounts();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'text-green-700 bg-green-100';
      case 'in-transit': return 'text-blue-700 bg-blue-100';
      case 'delayed': return 'text-red-700 bg-red-100';
      case 'pending': return 'text-yellow-700 bg-yellow-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered': return CheckCircle;
      case 'in-transit': return Truck;
      case 'delayed': return AlertTriangle;
      case 'pending': return Clock;
      default: return Package;
    }
  };

  const filteredOrders = purchaseOrders.filter(order => {
    const matchesSearch = (order.poNumber?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                         (order.supplier?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesFilter = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesFilter;
  });

  const handleStatusFilterClick = (status: string) => {
    setStatusFilter(statusFilter === status ? 'all' : status);
  };

  const handleRefresh = async () => {
    try {
      await fetchRackbeatPurchaseOrders();
    } catch (err) {
      console.error("Error in handleRefresh:", err);
      // Error is already handled in fetchRackbeatPurchaseOrders
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-gray-600 mt-2">Purchase Order Management - Rackbeat Integration</p>
          {lastSyncTime && (
            <p className="text-sm text-gray-500 mt-1">Last synced: {lastSyncTime}</p>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={handleRefresh}
            disabled={loading}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors duration-200 flex items-center space-x-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>New PO</span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center justify-center space-x-3">
            <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
            <span className="text-gray-600">Loading purchase orders from Rackbeat...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <div className="flex-1">
              <h3 className="text-red-800 font-medium">Failed to load purchase orders</h3>
              <p className="text-red-700 text-sm mt-1">{error}</p>
              <div className="mt-3 flex items-center space-x-3">
                <button 
                  onClick={handleRefresh}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Try again
                </button>
                {(error.includes('not configured') || error.includes('API key') || error.includes('credentials') || error.includes('configuration')) ? (
                  <a 
                    href="#settings"
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center space-x-1"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Check Settings</span>
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Data State - Show when no orders and no loading/error */}
      {!loading && !error && purchaseOrders.length === 0 && !lastSyncTime && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-gray-900 font-medium mb-2">No data available</h3>
            <p className="text-gray-600 text-sm mb-4">
              Click the refresh button to sync purchase orders from your Rackbeat account.
            </p>
            <button 
              onClick={handleRefresh}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors duration-200"
            >
              Sync Purchase Orders
            </button>
          </div>
        </div>
      )}

      {/* No Orders State - Show when synced but no orders found */}
      {!loading && !error && purchaseOrders.length === 0 && lastSyncTime && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-gray-900 font-medium mb-2">No purchase orders found</h3>
            <p className="text-gray-600 text-sm mb-4">
              No purchase orders were found in your Rackbeat account.
            </p>
            <button 
              onClick={handleRefresh}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors duration-200"
            >
              Refresh Orders
            </button>
          </div>
        </div>
      )}

      {/* Status Filter Cards */}
      {!loading && !error && purchaseOrders.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <button
              onClick={() => handleStatusFilterClick('pending')}
              className={`bg-white rounded-xl shadow-sm border-2 p-6 text-left transition-all duration-200 hover:shadow-md ${
                statusFilter === 'pending' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending POs:</p>
                  <p className="text-4xl font-bold text-gray-900 mt-2">{statusCounts.pending}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500" />
              </div>
            </button>

            <button
              onClick={() => handleStatusFilterClick('in-transit')}
              className={`bg-white rounded-xl shadow-sm border-2 p-6 text-left transition-all duration-200 hover:shadow-md ${
                statusFilter === 'in-transit' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">In Transit:</p>
                  <p className="text-4xl font-bold text-gray-900 mt-2">{statusCounts['in-transit']}</p>
                </div>
                <Truck className="w-8 h-8 text-blue-500" />
              </div>
            </button>

            <button
              onClick={() => handleStatusFilterClick('delivered')}
              className={`bg-white rounded-xl shadow-sm border-2 p-6 text-left transition-all duration-200 hover:shadow-md ${
                statusFilter === 'delivered' ? 'border-green-500 bg-green-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Delivered:</p>
                  <p className="text-4xl font-bold text-gray-900 mt-2">{statusCounts.delivered}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </button>

            <button
              onClick={() => handleStatusFilterClick('delayed')}
              className={`bg-white rounded-xl shadow-sm border-2 p-6 text-left transition-all duration-200 hover:shadow-md ${
                statusFilter === 'delayed' ? 'border-red-500 bg-red-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Delayed:</p>
                  <p className="text-4xl font-bold text-gray-900 mt-2">{statusCounts.delayed}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </button>
          </div>

          {/* Search and Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search purchase orders..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">
                  Showing {filteredOrders.length} of {purchaseOrders.length} POs
                </span>
              </div>
            </div>
          </div>

          {/* Purchase Orders Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {statusFilter === 'all' ? 'All Purchase Orders' : `${statusFilter.replace('-', ' ')} Purchase Orders`}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">PO #</th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Supplier</th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Value</th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Currency</th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Items</th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Expected Delivery</th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredOrders.map((order) => {
                    const StatusIcon = getStatusIcon(order.status);
                    return (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors duration-150">
                        <td className="py-4 px-6">
                          <div className="text-sm font-medium text-gray-900">{order.poNumber}</div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="text-sm text-gray-900">{order.supplier}</div>
                          <div className="text-xs text-gray-500">#{order.supplierNumber}</div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {order.status.replace('-', ' ')}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="text-sm font-medium text-gray-900">
                            {formatCurrency(order.value, order.currency)}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="text-sm text-gray-900">{order.currency}</div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="text-sm text-gray-900">{order.items}</div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center space-x-1 text-sm text-gray-700">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <div>
                              <div className="text-gray-900">{formatDate(order.expectedDelivery)}</div>
                              {order.actualDelivery && (
                                <div className="text-green-600 text-xs">✓ {formatDate(order.actualDelivery)}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="text-sm text-gray-500">{formatDate(order.createdDate)}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredOrders.length === 0 && purchaseOrders.length > 0 && (
              <div className="bg-gray-50 px-6 py-8 text-center">
                <p className="text-gray-600">No purchase orders match your search criteria.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default PurchaseOrdersTab;