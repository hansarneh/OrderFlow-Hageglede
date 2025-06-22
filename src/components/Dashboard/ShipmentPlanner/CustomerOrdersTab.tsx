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
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../lib/firebaseClient';

interface CustomerOrder {
  id: string;
  orderNumber: string;
  customer: string;
  wooStatus: string;
  relatedPOs: string[];
  expectedShipDates: string[];
  multipleShipments: boolean;
  status: 'fully-planned' | 'partially-planned' | 'at-risk';
  priority: 'high' | 'medium' | 'low';
  value: number;
  items: number;
  createdDate: string;
}

const CustomerOrdersTab: React.FC = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const fetchWooCommerceOrders = async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      console.log('Fetching orders from WooCommerce...');
      
      const fetchWooCommerceOrdersFunction = httpsCallable(functions, 'fetchWooCommerceOrders');
      const result = await fetchWooCommerceOrdersFunction();
      
      const data = result.data as any;

      if (data.error) {
        throw new Error(data.error);
      }

      setCustomerOrders(data.orders || []);
      setLastSyncTime(new Date().toLocaleString());
    } catch (err: any) {
      console.error('Error fetching WooCommerce orders:', err);
      setError(err.message || 'Failed to fetch orders from WooCommerce');
      setCustomerOrders([]);
    } finally {
      setLoading(false);
    }
  };

  // Remove automatic data fetching on component mount
  // Data will only be fetched when user clicks refresh button

  const getStatusCounts = () => {
    const fullyPlanned = customerOrders.filter(o => o.status === 'fully-planned').length;
    const partiallyPlanned = customerOrders.filter(o => o.status === 'partially-planned').length;
    const atRisk = customerOrders.filter(o => o.status === 'at-risk').length;
    const totalBacklog = fullyPlanned + partiallyPlanned + atRisk;
    
    return {
      'total-backlog': totalBacklog,
      'fully-planned': fullyPlanned,
      'partially-planned': partiallyPlanned,
      'at-risk': atRisk
    };
  };

  const statusCounts = getStatusCounts();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'fully-planned': return 'text-green-700 bg-green-100';
      case 'partially-planned': return 'text-yellow-700 bg-yellow-100';
      case 'at-risk': return 'text-red-700 bg-red-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'fully-planned': return CheckCircle;
      case 'partially-planned': return Clock;
      case 'at-risk': return AlertTriangle;
      default: return Package;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-700 bg-red-100';
      case 'medium': return 'text-yellow-700 bg-yellow-100';
      case 'low': return 'text-green-700 bg-green-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  const getWooStatusColor = (wooStatus: string) => {
    switch (wooStatus) {
      case 'processing': return 'text-blue-700 bg-blue-100';
      case 'on-hold': return 'text-orange-700 bg-orange-100';
      case 'pending': return 'text-yellow-700 bg-yellow-100';
      case 'completed': return 'text-green-700 bg-green-100';
      case 'cancelled': return 'text-red-700 bg-red-100';
      case 'refunded': return 'text-purple-700 bg-purple-100';
      case 'failed': return 'text-red-700 bg-red-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  const filteredOrders = customerOrders.filter(order => {
    const matchesSearch = order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.customer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesFilter;
  });

  const handleStatusFilterClick = (status: string) => {
    setStatusFilter(statusFilter === status ? 'all' : status);
  };

  const handleRefresh = () => {
    fetchWooCommerceOrders();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customer Orders</h1>
          <p className="text-gray-600 mt-2">Order Delivery Planner - WooCommerce Integration</p>
          {lastSyncTime && (
            <p className="text-sm text-gray-500 mt-1">Last synced: {lastSyncTime}</p>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={handleRefresh}
            disabled={loading}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200 flex items-center space-x-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>New Order</span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center justify-center space-x-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-gray-600">Loading orders from WooCommerce...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <div>
              <h3 className="text-red-800 font-medium">Failed to load orders</h3>
              <p className="text-red-700 text-sm mt-1">{error}</p>
              <button 
                onClick={handleRefresh}
                className="mt-3 text-red-600 hover:text-red-800 text-sm font-medium"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No Data State - Show when no orders and no loading/error */}
      {!loading && !error && customerOrders.length === 0 && !lastSyncTime && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-gray-900 font-medium mb-2">No data available</h3>
            <p className="text-gray-600 text-sm mb-4">
              Click the refresh button to sync orders from your WooCommerce store.
            </p>
            <button 
              onClick={handleRefresh}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Sync Orders
            </button>
          </div>
        </div>
      )}

      {/* No Orders State - Show when synced but no orders found */}
      {!loading && !error && customerOrders.length === 0 && lastSyncTime && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-gray-900 font-medium mb-2">No orders found</h3>
            <p className="text-gray-600 text-sm mb-4">
              No orders were found in your WooCommerce store, or your integration may not be configured.
            </p>
            <button 
              onClick={handleRefresh}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Refresh Orders
            </button>
          </div>
        </div>
      )}

      {/* Status Filter Cards */}
      {!loading && !error && customerOrders.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <button
              onClick={() => handleStatusFilterClick('all')}
              className={`bg-white rounded-xl shadow-sm border-2 p-6 text-left transition-all duration-200 hover:shadow-md ${
                statusFilter === 'all' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total order backlog:</p>
                  <p className="text-4xl font-bold text-gray-900 mt-2">{statusCounts['total-backlog']}</p>
                </div>
                <Package className="w-8 h-8 text-blue-500" />
              </div>
            </button>

            <button
              onClick={() => handleStatusFilterClick('fully-planned')}
              className={`bg-white rounded-xl shadow-sm border-2 p-6 text-left transition-all duration-200 hover:shadow-md ${
                statusFilter === 'fully-planned' ? 'border-green-500 bg-green-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Fully planned orders:</p>
                  <p className="text-4xl font-bold text-gray-900 mt-2">{statusCounts['fully-planned']}</p>
                  <p className="text-xs text-gray-500 mt-1">All items in stock or have PO</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </button>

            <button
              onClick={() => handleStatusFilterClick('partially-planned')}
              className={`bg-white rounded-xl shadow-sm border-2 p-6 text-left transition-all duration-200 hover:shadow-md ${
                statusFilter === 'partially-planned' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Partially planned:</p>
                  <p className="text-4xl font-bold text-gray-900 mt-2">{statusCounts['partially-planned']}</p>
                  <p className="text-xs text-gray-500 mt-1">Some items missing PO</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500" />
              </div>
            </button>

            <button
              onClick={() => handleStatusFilterClick('at-risk')}
              className={`bg-white rounded-xl shadow-sm border-2 p-6 text-left transition-all duration-200 hover:shadow-md ${
                statusFilter === 'at-risk' ? 'border-red-500 bg-red-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Orders at risk:</p>
                  <p className="text-4xl font-bold text-gray-900 mt-2">{statusCounts['at-risk']}</p>
                  <p className="text-xs text-gray-500 mt-1">Should have been fulfilled</p>
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

          {/* Status Definitions */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h4 className="font-medium text-blue-900 mb-2">Status Definitions:</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-blue-800">
              <div>
                <strong>Fully Planned:</strong> All order line items either in stock or have a PO with estimated delivery time
              </div>
              <div>
                <strong>Partially Planned:</strong> Some order lines in stock/have PO, one or more order lines do not
              </div>
              <div>
                <strong>Orders at Risk:</strong> Orders which should have been fulfilled but weren't for some reason
              </div>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {statusFilter === 'all' ? 'Total order backlog' : 
                 statusFilter === 'fully-planned' ? 'Fully planned orders' :
                 statusFilter === 'partially-planned' ? 'Partially planned orders' :
                 statusFilter === 'at-risk' ? 'Orders at risk' : 'All Orders'}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Order #</th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">WooCommerce Status</th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Customer</th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Related POs</th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Expected to ship</th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Multiple shipments</th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Priority</th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredOrders.slice(0, 20).map((order) => {
                    const StatusIcon = getStatusIcon(order.status);
                    return (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors duration-150">
                        <td className="py-4 px-6">
                          <div className="text-sm font-medium text-gray-900">{order.orderNumber}</div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getWooStatusColor(order.wooStatus)}`}>
                            {order.wooStatus}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="text-sm text-gray-900">{order.customer}</div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="space-y-1">
                            {order.relatedPOs.map((po, index) => (
                              <div key={index} className="text-sm text-gray-700">• {po}</div>
                            ))}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="space-y-1">
                            {order.expectedShipDates.map((date, index) => (
                              <div key={index} className={`text-sm ${
                                date === 'PO MISSING' ? 'text-red-600 font-medium' : 
                                date.includes('OVERDUE') ? 'text-red-600 font-medium' :
                                'text-gray-700'
                              }`}>
                                • {date}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sm font-medium text-gray-900">
                            {order.multipleShipments ? 'YES' : 'NO'}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {order.status.replace('-', ' ')}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(order.priority)}`}>
                            {order.priority}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="text-sm font-medium text-gray-900">${order.value.toLocaleString()}</div>
                          <div className="text-sm text-gray-500">{order.items} items</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredOrders.length > 20 && (
              <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Showing first 20 of {filteredOrders.length} orders. Use search to find specific orders.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default CustomerOrdersTab;