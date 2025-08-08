import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  AlertTriangle, 
  Package, 
  Calendar,
  RefreshCw,
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getOrdersAtRisk, getOrderLines, CustomerOrder, OrderLine } from '../../lib/firebaseUtils';
import OrderDetailsModal from './CustomerOrders/OrderDetailsModal';

type SortField = 'orderNumber' | 'customerName' | 'wooStatus' | 'riskLevel' | 'deliveryDate' | 'daysSinceDeliveryDate' | 'totalValue';
type SortDirection = 'asc' | 'desc';

const OrdersAtRiskTab: React.FC = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [riskLevelFilter, setRiskLevelFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [atRiskOrders, setAtRiskOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [isLoadingLines, setIsLoadingLines] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [sortField, setSortField] = useState<SortField>('daysSinceDeliveryDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Load orders at risk using the Edge Function
  const loadOrdersAtRisk = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('Fetching at-risk orders...');

      // Use the getOrdersAtRisk function from firebaseUtils
      const atRiskOrdersData = await getOrdersAtRisk();
      
      console.log('At-risk orders data received:', atRiskOrdersData);
      
      setOrders(atRiskOrdersData || []);
      setAtRiskOrders(atRiskOrdersData || []);
      setLastSyncTime(new Date().toLocaleString());
    } catch (err: any) {
      console.error('Error loading orders at risk:', err);
      setError(err.message || 'Failed to load orders at risk');
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

  // Load order details when an order is selected
  const handleOrderClick = async (order: CustomerOrder) => {
    // If order lines are not loaded yet, load them
    if (!order.orderLines || order.orderLines.length === 0) {
      const orderLines = await loadOrderLines(order.id);
      
      // Create a copy of the order with order lines
      const orderWithLines = {
        ...order,
        order_lines: orderLines
      };
      
      setSelectedOrder(orderWithLines);
    } else {
      setSelectedOrder(order);
    }
    
    setShowOrderModal(true);
  };

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Load orders on component mount
  useEffect(() => {
    loadOrdersAtRisk();
  }, []);

  // Filter orders based on search term, risk level, and status
  const filteredOrders = useMemo(() => {
    return atRiskOrders.filter(order => {
      const matchesSearch = order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                        order.customerName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRiskLevel = riskLevelFilter === 'all' || order.riskLevel === riskLevelFilter;
              const matchesStatus = statusFilter === 'all' || order.wooStatus === statusFilter;
      return matchesSearch && matchesRiskLevel && matchesStatus;
    });
  }, [atRiskOrders, searchTerm, riskLevelFilter, statusFilter]);

  // Sort filtered orders
  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'orderNumber':
          comparison = a.orderNumber.localeCompare(b.orderNumber);
          break;
        case 'customerName':
          comparison = a.customerName.localeCompare(b.customerName);
          break;
        case 'wooStatus':
          comparison = a.wooStatus.localeCompare(b.wooStatus);
          break;
        case 'riskLevel':
          // Convert risk levels to numeric values for comparison
          const riskValues = { high: 3, medium: 2, low: 1, undefined: 0 };
          comparison = (riskValues[a.riskLevel || 'undefined'] || 0) - (riskValues[b.riskLevel || 'undefined'] || 0);
          break;
        case 'deliveryDate':
          // Handle null dates
          if (!a.deliveryDate && !b.deliveryDate) comparison = 0;
          else if (!a.deliveryDate) comparison = -1;
          else if (!b.deliveryDate) comparison = 1;
          else comparison = new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime();
          break;
        case 'daysSinceDeliveryDate':
          comparison = (a.daysSinceDeliveryDate || 0) - (b.daysSinceDeliveryDate || 0);
          break;
        case 'totalValue':
          comparison = a.totalValue - b.totalValue;
          break;
        default:
          comparison = 0;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredOrders, sortField, sortDirection]);

  // Pagination
  const indexOfLastOrder = currentPage * itemsPerPage;
  const indexOfFirstOrder = indexOfLastOrder - itemsPerPage;
  const currentOrders = sortedOrders.slice(indexOfFirstOrder, indexOfLastOrder);
  const totalPages = Math.ceil(sortedOrders.length / itemsPerPage);

  // Get counts by risk level
  const getRiskLevelCounts = () => {
    return {
      'all': atRiskOrders.length,
      'high': atRiskOrders.filter(o => o.riskLevel === 'high').length,
      'medium': atRiskOrders.filter(o => o.riskLevel === 'medium').length,
      'low': atRiskOrders.filter(o => o.riskLevel === 'low').length
    };
  };

  // Get counts by status
  const getStatusCounts = () => {
    return {
      'all': atRiskOrders.length,
      'processing': atRiskOrders.filter(o => o.wooStatus === 'processing').length,
      'delvis-levert': atRiskOrders.filter(o => o.wooStatus === 'delvis-levert').length
    };
  };

  const riskLevelCounts = getRiskLevelCounts();
  const statusCounts = getStatusCounts();

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-red-700 bg-red-100 border-red-300';
      case 'medium': return 'text-orange-700 bg-orange-100 border-orange-300';
      case 'low': return 'text-yellow-700 bg-yellow-100 border-yellow-300';
      default: return 'text-gray-700 bg-gray-100 border-gray-300';
    }
  };

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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('no-NO');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('no-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Render sort indicator
  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-4 h-4 inline-block ml-1" /> 
      : <ChevronDown className="w-4 h-4 inline-block ml-1" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Orders at Risk</h1>
          <p className="text-gray-600 mt-2">Orders with backordered products and overdue delivery dates</p>
          {lastSyncTime && (
            <p className="text-sm text-gray-500 mt-1">Last updated: {lastSyncTime}</p>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={loadOrdersAtRisk}
            disabled={loading}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center space-x-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center justify-center space-x-3">
            <Loader2 className="w-6 h-6 animate-spin text-red-600" />
            <span className="text-gray-600">Analyzing orders and identifying risks...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <div className="flex-1">
              <h3 className="text-red-800 font-medium">Failed to load orders at risk</h3>
              <div className="text-red-700 text-sm mt-1 whitespace-pre-line">{error}</div>
              <div className="mt-4">
                <button 
                  onClick={loadOrdersAtRisk}
                  className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Data State */}
      {!loading && !error && orders.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-gray-900 font-medium mb-2">No orders found</h3>
            <p className="text-gray-600 text-sm mb-4">
              There are no orders in the system to analyze. Please sync orders from WooCommerce first.
            </p>
          </div>
        </div>
      )}

      {/* No At-Risk Orders State */}
      {!loading && !error && orders.length > 0 && atRiskOrders.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="text-center">
            <Package className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-gray-900 font-medium mb-2">No orders at risk</h3>
            <p className="text-gray-600 text-sm mb-4">
              Great news! None of your orders contain backordered products with overdue delivery dates.
            </p>
            <div className="text-sm text-gray-500">
              <p>Analyzed {orders.length} orders in total.</p>
            </div>
          </div>
        </div>
      )}

      {/* Risk Level Filter Cards */}
      {!loading && !error && atRiskOrders.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <button
              onClick={() => setRiskLevelFilter('all')}
              className={`bg-white rounded-xl shadow-sm border-2 p-6 text-left transition-all duration-200 hover:shadow-md ${
                riskLevelFilter === 'all' ? 'border-red-500 bg-red-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">All At-Risk Orders</p>
                  <p className="text-4xl font-bold text-gray-900 mt-2">{riskLevelCounts.all}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </button>

            <button
              onClick={() => setRiskLevelFilter('high')}
              className={`bg-white rounded-xl shadow-sm border-2 p-6 text-left transition-all duration-200 hover:shadow-md ${
                riskLevelFilter === 'high' ? 'border-red-500 bg-red-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">High Risk</p>
                  <p className="text-4xl font-bold text-gray-900 mt-2">{riskLevelCounts.high}</p>
                  <p className="text-xs text-gray-500 mt-1">Over 30 days overdue</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </button>

            <button
              onClick={() => setRiskLevelFilter('medium')}
              className={`bg-white rounded-xl shadow-sm border-2 p-6 text-left transition-all duration-200 hover:shadow-md ${
                riskLevelFilter === 'medium' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Medium Risk</p>
                  <p className="text-4xl font-bold text-gray-900 mt-2">{riskLevelCounts.medium}</p>
                  <p className="text-xs text-gray-500 mt-1">14-30 days overdue</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-orange-500" />
              </div>
            </button>

            <button
              onClick={() => setRiskLevelFilter('low')}
              className={`bg-white rounded-xl shadow-sm border-2 p-6 text-left transition-all duration-200 hover:shadow-md ${
                riskLevelFilter === 'low' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Low Risk</p>
                  <p className="text-4xl font-bold text-gray-900 mt-2">{riskLevelCounts.low}</p>
                  <p className="text-xs text-gray-500 mt-1">1-14 days overdue</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-yellow-500" />
              </div>
            </button>
          </div>

          {/* Status Filter Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <button
              onClick={() => setStatusFilter('all')}
              className={`bg-white rounded-xl shadow-sm border-2 p-6 text-left transition-all duration-200 hover:shadow-md ${
                statusFilter === 'all' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">All Statuses</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{statusCounts.all}</p>
                </div>
                <Package className="w-7 h-7 text-blue-500" />
              </div>
            </button>

            <button
              onClick={() => setStatusFilter('processing')}
              className={`bg-white rounded-xl shadow-sm border-2 p-6 text-left transition-all duration-200 hover:shadow-md ${
                statusFilter === 'processing' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Processing</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{statusCounts.processing}</p>
                </div>
                <Package className="w-7 h-7 text-blue-500" />
              </div>
            </button>

            <button
              onClick={() => setStatusFilter('delvis-levert')}
              className={`bg-white rounded-xl shadow-sm border-2 p-6 text-left transition-all duration-200 hover:shadow-md ${
                statusFilter === 'delvis-levert' ? 'border-purple-500 bg-purple-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Delvis Levert</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{statusCounts['delvis-levert']}</p>
                </div>
                <Package className="w-7 h-7 text-purple-500" />
              </div>
            </button>
          </div>

          {/* Risk Level Legend */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <h4 className="font-medium text-gray-900 mb-3">Risk Level Definitions:</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
                <span className="text-red-800"><strong>High Risk:</strong> Delivery date more than 30 days overdue</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-orange-100 border border-orange-300 rounded"></div>
                <span className="text-orange-800"><strong>Medium Risk:</strong> Delivery date 14-30 days overdue</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
                <span className="text-yellow-800"><strong>Low Risk:</strong> Delivery date 1-14 days overdue</span>
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
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1); // Reset to first page when search changes
                    }}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">
                  Showing {indexOfFirstOrder + 1}-{Math.min(indexOfLastOrder, filteredOrders.length)} of {filteredOrders.length} at-risk orders
                </span>
              </div>
            </div>
          </div>

          {/* At-Risk Orders Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {riskLevelFilter === 'all' && statusFilter === 'all' ? 'All At-Risk Orders' : 
                 `${riskLevelFilter !== 'all' ? `${riskLevelFilter.charAt(0).toUpperCase() + riskLevelFilter.slice(1)} Risk` : ''} 
                  ${statusFilter !== 'all' ? `${statusFilter.replace('-', ' ')}` : ''} 
                  Orders`}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('orderNumber')}
                    >
                                              Order # {renderSortIndicator('orderNumber')}
                    </th>
                    <th 
                      className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('customerName')}
                    >
                                              Customer {renderSortIndicator('customerName')}
                    </th>
                    <th 
                      className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('wooStatus')}
                    >
                                              Status {renderSortIndicator('wooStatus')}
                    </th>
                    <th 
                      className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('riskLevel')}
                    >
                      Risk Level {renderSortIndicator('riskLevel')}
                    </th>
                    <th 
                      className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('deliveryDate')}
                    >
                                              Delivery Date {renderSortIndicator('deliveryDate')}
                    </th>
                    <th 
                      className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('daysSinceDeliveryDate')}
                    >
                      Days Overdue {renderSortIndicator('daysSinceDeliveryDate')}
                    </th>
                    <th 
                      className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('totalValue')}
                    >
                                              Value {renderSortIndicator('totalValue')}
                    </th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {currentOrders.map((order) => (
                    <tr 
                      key={order.id} 
                      className="hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
                      onClick={() => handleOrderClick(order)}
                    >
                      <td className="py-4 px-6">
                        <div className="text-sm font-medium text-gray-900">{order.orderNumber}</div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-sm text-gray-900">{order.customerName}</div>
                      </td>
                      <td className="py-4 px-6">
                                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.wooStatus)}`}>
                            {order.wooStatus.replace('-', ' ')}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        {order.riskLevel && (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRiskLevelColor(order.riskLevel)}`}>
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            {order.riskLevel.charAt(0).toUpperCase() + order.riskLevel.slice(1)}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-sm text-gray-900">{formatDate(order.deliveryDate)}</div>
                      </td>
                      <td className="py-4 px-6">
                        {order.daysSinceDeliveryDate !== undefined && (
                          <div className="text-sm font-medium text-red-600">{order.daysSinceDeliveryDate}</div>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-sm font-medium text-gray-900">{formatCurrency(order.totalValue)}</div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2">
                          {order.permalink && (
                            <a
                              href={order.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 transition-colors duration-200"
                              title="View in WooCommerce"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing {indexOfFirstOrder + 1}-{Math.min(indexOfLastOrder, filteredOrders.length)} of {filteredOrders.length} orders
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      // Calculate page numbers to show
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1 border rounded-md text-sm ${
                            currentPage === pageNum
                              ? 'bg-red-600 text-white border-red-600'
                              : 'border-gray-300 hover:bg-gray-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {filteredOrders.length === 0 && atRiskOrders.length > 0 && (
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

export default OrdersAtRiskTab;