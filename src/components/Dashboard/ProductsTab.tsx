import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  Package, 
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Edit3,
  Trash2,
  Eye,
  RefreshCw,
  Loader2,
  Settings,
  ExternalLink,
  Tag,
  ShoppingCart,
  Calendar,
  Clock,
  Zap,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getProducts, Product } from '../../lib/firebaseUtils';

const ProductsTab: React.FC = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [produkttypeFilter, setProdukttypeFilter] = useState('all');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  // Load products from Firebase
  const loadProducts = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('Starting to load published products...');
      
      const { products: loadedProducts } = await getProducts('all', 'all', 1, 1000);
      
      console.log(`Finished loading all published products. Total: ${loadedProducts.length}`);
      setProducts(loadedProducts);
      setLastSyncTime(new Date().toLocaleString());
    } catch (err: any) {
      console.error('Error loading products:', err);
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  // Load products on component mount
  useEffect(() => {
    loadProducts();
  }, []);

  const getStockStatusColor = (status: string, quantity: number) => {
    if (quantity < 0) return 'text-red-700 bg-red-100';
    if (quantity === 0) return 'text-orange-700 bg-orange-100';
    if (quantity < 10) return 'text-yellow-700 bg-yellow-100';
    return 'text-green-700 bg-green-100';
  };

  const getStockStatusIcon = (status: string, quantity: number) => {
    if (quantity < 0) return AlertTriangle;
    if (quantity === 0) return AlertTriangle;
    if (quantity < 10) return TrendingDown;
    return CheckCircle;
  };

  // Helper function to safely display stock quantity
  const displayStockQuantity = (quantity: number | null | undefined): number => {
    return quantity ?? 0;
  };

  // Get unique produkttype values for filter
  const allProdukttypes = Array.from(
    new Set(
      products
        .map(product => product.produkttype)
        .filter(Boolean) // Remove null/undefined values
    )
  ).sort();

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const stockQuantity = displayStockQuantity(product.stockQuantity);
    const matchesStock = stockFilter === 'all' || 
                        (stockFilter === 'in-stock' && stockQuantity > 0) ||
                        (stockFilter === 'low-stock' && stockQuantity > 0 && stockQuantity < 10) ||
                        (stockFilter === 'out-of-stock' && stockQuantity === 0) ||
                        (stockFilter === 'backordered' && stockQuantity < 0);
    
    const matchesProduktttype = produkttypeFilter === 'all' || product.produkttype === produkttypeFilter;
    
    return matchesSearch && matchesStock && matchesProduktttype;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = filteredProducts.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, stockFilter, produkttypeFilter]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of table
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const totalProductsCount = products.length;
  const inStockProducts = products.filter(p => displayStockQuantity(p.stockQuantity) > 0).length;
  const lowStockProducts = products.filter(p => {
    const qty = displayStockQuantity(p.stockQuantity);
    return qty > 0 && qty < 10;
  }).length;
  const outOfStockProducts = products.filter(p => displayStockQuantity(p.stockQuantity) === 0).length;
  const backorderedProducts = products.filter(p => displayStockQuantity(p.stockQuantity) < 0).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-600 mt-2">Manage your published product catalog</p>
          {lastSyncTime && (
            <p className="text-sm text-gray-500 mt-1">Last updated: {lastSyncTime}</p>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={loadProducts}
            disabled={loading}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200 flex items-center space-x-2 disabled:opacity-50"
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
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-gray-600">Loading published products...</span>
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
              <p className="text-red-700 text-sm mt-1">{error}</p>
              <div className="mt-3 flex items-center space-x-3">
                <button 
                  onClick={loadProducts}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
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

      {/* Stats Cards */}
      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Published Products</p>
                  <p className="text-2xl font-bold text-gray-900">{totalProductsCount.toLocaleString()}</p>
                </div>
                <Package className="w-8 h-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">In Stock</p>
                  <p className="text-2xl font-bold text-green-600">{inStockProducts.toLocaleString()}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Low Stock</p>
                  <p className="text-2xl font-bold text-yellow-600">{lowStockProducts.toLocaleString()}</p>
                </div>
                <TrendingDown className="w-8 h-8 text-yellow-500" />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Out of Stock</p>
                  <p className="text-2xl font-bold text-orange-600">{outOfStockProducts.toLocaleString()}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-orange-500" />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Backordered</p>
                  <p className="text-2xl font-bold text-red-600">{backorderedProducts.toLocaleString()}</p>
                </div>
                <TrendingDown className="w-8 h-8 text-red-500" />
              </div>
            </div>
          </div>

          {/* Sync Status Info */}
          {products.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      Product database contains {totalProductsCount.toLocaleString()} published products
                    </p>
                    <p className="text-xs text-blue-700">
                      Only published products are shown. Draft and private products are filtered out.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

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
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Tag className="w-4 h-4 text-gray-500" />
                  <select
                    value={stockFilter}
                    onChange={(e) => setStockFilter(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Stock</option>
                    <option value="in-stock">In Stock</option>
                    <option value="low-stock">Low Stock</option>
                    <option value="out-of-stock">Out of Stock</option>
                    <option value="backordered">Backordered</option>
                  </select>
                </div>
                {allProdukttypes.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <Package className="w-4 h-4 text-gray-500" />
                    <select
                      value={produkttypeFilter}
                      onChange={(e) => setProdukttypeFilter(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">All Product Types</option>
                      {allProdukttypes.map((produkttype) => (
                        <option key={produkttype} value={produkttype || ''}>{produkttype}</option>
                      ))}
                    </select>
                  </div>
                )}
                <span className="text-sm text-gray-600">
                  Showing {startIndex + 1}-{Math.min(endIndex, filteredProducts.length)} of {filteredProducts.length} products
                </span>
              </div>
            </div>
          </div>

          {/* Products Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Published Product Catalog</h3>
                <div className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Product</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">SKU</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Stock</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Price</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Type</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Produkttype</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Last Updated</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {currentProducts.map((product) => {
                    const stockQuantity = displayStockQuantity(product.stockQuantity);
                    const StockIcon = getStockStatusIcon(product.stockStatus, stockQuantity);
                    return (
                      <tr key={product.id} className="hover:bg-gray-50 transition-colors duration-150">
                        <td className="py-3 px-4">
                          <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                            {product.name}
                          </div>
                          <div className="text-xs text-gray-500">ID: {product.woocommerceId}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm font-mono text-gray-700">{product.sku || 'N/A'}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStockStatusColor(product.stockStatus, stockQuantity)}`}>
                              <StockIcon className="w-3 h-3 mr-1" />
                              {stockQuantity}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm font-medium text-gray-900">
                            {product.price ? `$${product.price}` : 'N/A'}
                          </div>
                          {product.salePrice && (
                            <div className="text-xs text-green-600">Sale: ${product.salePrice}</div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-gray-700 capitalize">{product.productType}</span>
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
                          <div className="text-sm text-gray-500">
                            {new Date(product.updatedAt).toLocaleDateString()}
                          </div>
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
                            <button className="text-gray-500 hover:text-blue-600 transition-colors duration-200">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button className="text-gray-500 hover:text-green-600 transition-colors duration-200">
                              <Edit3 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredProducts.length)} of {filteredProducts.length} results
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </button>
                    
                    {/* Page numbers */}
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
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
                            onClick={() => handlePageChange(pageNum)}
                            className={`px-3 py-2 text-sm font-medium rounded-lg ${
                              currentPage === pageNum
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50 hover:text-gray-700'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {filteredProducts.length === 0 && products.length > 0 && (
              <div className="bg-gray-50 px-6 py-8 text-center">
                <p className="text-gray-600">No products match your search criteria.</p>
              </div>
            )}
            {products.length === 0 && !loading && !error && (
              <div className="bg-gray-50 px-6 py-8 text-center">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">No published products found</p>
                <p className="text-sm text-gray-500">Sync your published products from WooCommerce to get started.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ProductsTab;