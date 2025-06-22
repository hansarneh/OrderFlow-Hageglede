import React, { useState, useEffect } from 'react';
import { 
  Search, 
  AlertTriangle, 
  Package, 
  TrendingDown,
  RefreshCw,
  Loader2,
  ExternalLink,
  Truck,
  Settings,
  Tag,
  ShoppingCart,
  X,
  Eye
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getBackorderedProducts, Product } from '../../lib/firebaseUtils';

interface BackorderedProduct extends Product {
  totalOrderValue?: number;
  affectedOrders?: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    orderValue: number;
    orderDate: string;
    wooCommerceUrl: string;
    deliveryDate?: string;
    isOverdue?: boolean;
  }>;
}

interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: BackorderedProduct | null;
}

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ isOpen, onClose, product }) => {
  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Affected Orders</h3>
            <p className="text-sm text-gray-600 mt-1">{product.name}</p>
            <p className="text-xs text-gray-500 mt-1">
              Total Value: {(product.totalOrderValue || 0).toLocaleString()} NOK
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {product.affectedOrders && product.affectedOrders.length > 0 ? (
            <div className="space-y-4">
              {product.affectedOrders.map((order) => (
                <div key={order.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h4 className="font-medium text-gray-900">Order #{order.orderNumber}</h4>
                        <span className="text-sm text-gray-500">{order.orderDate}</span>
                        {order.deliveryDate && (
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            order.isOverdue 
                              ? 'bg-red-100 text-red-700' 
                              : 'bg-green-100 text-green-700'
                          }`}>
                            Delivery: {order.deliveryDate} {order.isOverdue ? '(OVERDUE)' : ''}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{order.customerName}</p>
                      <p className="text-sm font-medium text-blue-600 mt-1">
                        {order.orderValue.toLocaleString()} NOK
                      </p>
                    </div>
                    <a
                      href={order.wooCommerceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>View in WooCommerce</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No affected orders found for this product.</p>
              <p className="text-sm text-gray-500 mt-2">
                This product may be backordered but not currently in any pending orders.
              </p>
            </div>
          )}
        </div>
        
        <div className="flex justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const BackorderedProductsTab: React.FC = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [produkttypeFilter, setProdukttypeFilter] = useState('all');
  const [backorderedProducts, setBackorderedProducts] = useState<BackorderedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<BackorderedProduct | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Load backordered products from Firebase
  const loadBackorderedProducts = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('Loading backordered products from database...');
      
      // Fetch backordered products (stock_quantity < 0)
      const products = await getBackorderedProducts();

      console.log(`Found ${products.length} backordered products`);

      // Process products and add placeholder data for affected orders
      // In a real implementation, you would fetch actual order data from Firebase
      const processedProducts: BackorderedProduct[] = products.map(product => {
        // Generate some placeholder affected orders
        const affectedOrdersCount = Math.floor(Math.random() * 5) + 1;
        const affectedOrders = Array.from({ length: affectedOrdersCount }, (_, i) => {
          const isOverdue = Math.random() > 0.5;
          const orderValue = Math.floor(Math.random() * 5000) + 500;
          
          return {
            id: `order-${product.id}-${i}`,
            orderNumber: `ORD-${Math.floor(Math.random() * 10000) + 1000}`,
            customerName: `Customer ${i + 1}`,
            orderValue: orderValue,
            orderDate: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toLocaleDateString('no-NO'),
            wooCommerceUrl: product.permalink || '#',
            deliveryDate: isOverdue ? 
              new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toLocaleDateString('no-NO') : 
              new Date(Date.now() + Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toLocaleDateString('no-NO'),
            isOverdue
          };
        });
        
        // Calculate total order value from affected orders
        const totalOrderValue = affectedOrders.reduce((sum, order) => sum + order.orderValue, 0);

        return {
          ...product,
          totalOrderValue,
          affectedOrders
        };
      });

      console.log(`Processed ${processedProducts.length} backordered products with order data`);
      setBackorderedProducts(processedProducts);
      setLastSyncTime(new Date().toLocaleString());
      
    } catch (err: any) {
      console.error('Error loading backordered products:', err);
      setError(err.message || 'Failed to load backordered products');
      setBackorderedProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    loadBackorderedProducts();
  }, []);

  const getStockSeverityColor = (product: BackorderedProduct) => {
    const isOverdue = product.affectedOrders?.some(order => order.isOverdue) || false;
    
    if (!isOverdue) {
      // Product has negative stock but no overdue orders - this is a planned backorder
      return 'text-blue-700 bg-blue-100 border-blue-300';
    }
    
    // Product has overdue orders - use severity based on stock level
    if (product.stockQuantity <= -50) return 'text-red-700 bg-red-100 border-red-300';
    if (product.stockQuantity <= -20) return 'text-orange-700 bg-orange-100 border-orange-300';
    if (product.stockQuantity <= -10) return 'text-yellow-700 bg-yellow-100 border-yellow-300';
    if (product.stockQuantity < 0) return 'text-gray-700 bg-gray-100 border-gray-300';
    return 'text-gray-700 bg-gray-100 border-gray-300';
  };

  const getStockSeverityLabel = (product: BackorderedProduct) => {
    const isOverdue = product.affectedOrders?.some(order => order.isOverdue) || false;
    
    if (!isOverdue) {
      return 'Planned Backorder';
    }
    
    // Product has overdue orders - use severity based on stock level
    if (product.stockQuantity <= -50) return 'Critical';
    if (product.stockQuantity <= -20) return 'High';
    if (product.stockQuantity <= -10) return 'Medium';
    if (product.stockQuantity < 0) return 'Low';
    return 'Low';
  };

  const handleOrdersClick = (product: BackorderedProduct) => {
    setSelectedProduct(product);
    setShowOrderModal(true);
  };

  const filteredProducts = backorderedProducts.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesProduktttype = produkttypeFilter === 'all' || product.produkttype === produkttypeFilter;
    
    return matchesSearch && matchesProduktttype;
  });

  // Get unique product types for filter
  const allProdukttypes = Array.from(
    new Set(
      backorderedProducts
        .map(product => product.produkttype)
        .filter(Boolean) // Remove null/undefined values
    )
  ).sort();

  const handleRefresh = () => {
    loadBackorderedProducts();
  };

  const totalBackorderedUnits = backorderedProducts.reduce((sum, product) => {
    return sum + Math.abs(product.stockQuantity);
  }, 0);
  
  const totalOrderValue = backorderedProducts.reduce((sum, product) => {
    return sum + (product.totalOrderValue || 0);
  }, 0);
  
  const criticalProducts = backorderedProducts.filter(p => {
    const isOverdue = p.affectedOrders?.some(order => order.isOverdue) || false;
    return isOverdue && p.stockQuantity <= -50;
  }).length;
  
  const highPriorityProducts = backorderedProducts.filter(p => {
    const isOverdue = p.affectedOrders?.some(order => order.isOverdue) || false;
    return isOverdue && p.stockQuantity <= -20 && p.stockQuantity > -50;
  }).length;
  
  const plannedBackorders = backorderedProducts.filter(p => {
    const isOverdue = p.affectedOrders?.some(order => order.isOverdue) || false;
    return !isOverdue;
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Backordered Products</h1>
          <p className="text-gray-600 mt-2">Products with negative stock levels requiring immediate attention</p>
          {lastSyncTime && (
            <p className="text-sm text-gray-500 mt-1">Last updated: {lastSyncTime}</p>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={handleRefresh}
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
            <span className="text-gray-600">Loading backordered products and order data...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <div className="flex-1">
              <h3 className="text-red-800 font-medium">Failed to load products</h3>
              <div className="text-red-700 text-sm mt-1 whitespace-pre-line">{error}</div>
              <div className="mt-4 flex items-center space-x-3">
                <button 
                  onClick={handleRefresh}
                  className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
                >
                  Try again
                </button>
                <a 
                  href="#settings"
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center space-x-1"
                >
                  <Settings className="w-4 h-4" />
                  <span>Check Settings</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Backordered Products State */}
      {!loading && !error && backorderedProducts.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="text-center">
            <Package className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <h3 className="text-gray-900 font-medium mb-2">No backordered products found</h3>
            <p className="text-gray-600 text-sm mb-4">
              Great news! All your products have positive stock levels.
            </p>
            <button 
              onClick={handleRefresh}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200"
            >
              Refresh Products
            </button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {!loading && !error && backorderedProducts.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Backordered Products</p>
                  <p className="text-3xl font-bold text-red-600">{backorderedProducts.length}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Units Backordered</p>
                  <p className="text-3xl font-bold text-orange-600">{totalBackorderedUnits.toLocaleString()}</p>
                </div>
                <TrendingDown className="w-8 h-8 text-orange-500" />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Order Value</p>
                  <p className="text-3xl font-bold text-blue-600">{totalOrderValue.toLocaleString()} NOK</p>
                </div>
                <ShoppingCart className="w-8 h-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Critical Products</p>
                  <p className="text-3xl font-bold text-red-600">{criticalProducts}</p>
                  <p className="text-xs text-gray-500 mt-1">With overdue orders</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-600" />
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
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-4">
                {allProdukttypes.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <Tag className="w-4 h-4 text-gray-500" />
                    <select
                      value={produkttypeFilter}
                      onChange={(e) => setProdukttypeFilter(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    >
                      <option value="all">All Product Types</option>
                      {allProdukttypes.map((produkttype) => (
                        <option key={produkttype} value={produkttype}>{produkttype}</option>
                      ))}
                    </select>
                  </div>
                )}
                <span className="text-sm text-gray-600">
                  Showing {filteredProducts.length} of {backorderedProducts.length} products
                </span>
              </div>
            </div>
          </div>

          {/* Severity Legend */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <h4 className="font-medium text-red-900 mb-3">Backorder Severity Levels:</h4>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
                <span className="text-red-800"><strong>Critical:</strong> -50 or worse (overdue)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-orange-100 border border-orange-300 rounded"></div>
                <span className="text-orange-800"><strong>High:</strong> -20 to -49 (overdue)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
                <span className="text-yellow-800"><strong>Medium:</strong> -10 to -19 (overdue)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded"></div>
                <span className="text-gray-800"><strong>Low:</strong> -1 to -9 (overdue)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
                <span className="text-blue-800"><strong>Planned Backorder:</strong> No overdue orders</span>
              </div>
            </div>
          </div>

          {/* Products Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Backordered Products (Sorted by Stock Level)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Product Title</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">SKU</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Stock</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Severity</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Order Line Value</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Affected Orders</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Product Type</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="py-3 px-4">
                        <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                          {product.name}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm font-mono text-gray-700">{product.sku || 'N/A'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-bold text-red-600">
                            {product.stockQuantity}
                          </span>
                          <TrendingDown className="w-4 h-4 text-red-500" />
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStockSeverityColor(product)}`}>
                          {getStockSeverityLabel(product)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm font-medium text-blue-600">
                          {(product.totalOrderValue || 0).toLocaleString()} NOK
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleOrdersClick(product)}
                          className="flex items-center space-x-1 text-sm font-medium text-purple-600 hover:text-purple-800 transition-colors"
                          disabled={!product.affectedOrders || product.affectedOrders.length === 0}
                        >
                          <span>{product.affectedOrders?.length || 0}</span>
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        {product.produkttype ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-purple-100 text-purple-700">
                            {product.produkttype}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          {product.permalink && (
                            <a
                              href={product.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 transition-colors duration-200"
                              title="View in WooCommerce"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                          <button 
                            className="text-orange-600 hover:text-orange-800 transition-colors duration-200"
                            title="Create Purchase Order"
                          >
                            <Truck className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredProducts.length === 0 && backorderedProducts.length > 0 && (
              <div className="bg-gray-50 px-6 py-8 text-center">
                <p className="text-gray-600">No products match your search criteria.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Order Details Modal */}
      <OrderDetailsModal
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        product={selectedProduct}
      />
    </div>
  );
};

export default BackorderedProductsTab;