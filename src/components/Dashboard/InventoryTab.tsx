import React, { useState } from 'react';
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
  Eye
} from 'lucide-react';

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  minStock: number;
  unitPrice: number;
  supplier: string;
  location: string;
  status: 'in-stock' | 'low-stock' | 'out-of-stock';
  lastUpdated: string;
}

const InventoryTab: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const inventoryItems: InventoryItem[] = [
    {
      id: '1',
      sku: 'SKU001',
      name: 'Wireless Headphones',
      category: 'Electronics',
      quantity: 150,
      minStock: 50,
      unitPrice: 99.99,
      supplier: 'TechSupply Co',
      location: 'Warehouse A',
      status: 'in-stock',
      lastUpdated: '2024-01-15'
    },
    {
      id: '2',
      sku: 'SKU002',
      name: 'Office Chair',
      category: 'Furniture',
      quantity: 25,
      minStock: 30,
      unitPrice: 249.99,
      supplier: 'FurniCorp',
      location: 'Warehouse B',
      status: 'low-stock',
      lastUpdated: '2024-01-14'
    },
    {
      id: '3',
      sku: 'SKU003',
      name: 'Laptop Stand',
      category: 'Accessories',
      quantity: 0,
      minStock: 20,
      unitPrice: 39.99,
      supplier: 'AccessPro',
      location: 'Warehouse A',
      status: 'out-of-stock',
      lastUpdated: '2024-01-13'
    },
    {
      id: '4',
      sku: 'SKU004',
      name: 'Bluetooth Speaker',
      category: 'Electronics',
      quantity: 85,
      minStock: 40,
      unitPrice: 79.99,
      supplier: 'TechSupply Co',
      location: 'Warehouse C',
      status: 'in-stock',
      lastUpdated: '2024-01-15'
    },
    {
      id: '5',
      sku: 'SKU005',
      name: 'Desk Lamp',
      category: 'Furniture',
      quantity: 12,
      minStock: 15,
      unitPrice: 59.99,
      supplier: 'LightWorks',
      location: 'Warehouse B',
      status: 'low-stock',
      lastUpdated: '2024-01-12'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in-stock': return 'text-green-700 bg-green-100';
      case 'low-stock': return 'text-yellow-700 bg-yellow-100';
      case 'out-of-stock': return 'text-red-700 bg-red-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'in-stock': return CheckCircle;
      case 'low-stock': return AlertTriangle;
      case 'out-of-stock': return AlertTriangle;
      default: return Package;
    }
  };

  const filteredItems = inventoryItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const totalValue = inventoryItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const lowStockItems = inventoryItems.filter(item => item.status === 'low-stock').length;
  const outOfStockItems = inventoryItems.filter(item => item.status === 'out-of-stock').length;
  const totalItems = inventoryItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-600 mt-2">Track and manage your inventory items</p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2">
          <Plus className="w-4 h-4" />
          <span>Add Item</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Items</p>
              <p className="text-2xl font-bold text-gray-900">{totalItems.toLocaleString()}</p>
            </div>
            <Package className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Value</p>
              <p className="text-2xl font-bold text-gray-900">${totalValue.toLocaleString()}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Low Stock</p>
              <p className="text-2xl font-bold text-gray-900">{lowStockItems}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Out of Stock</p>
              <p className="text-2xl font-bold text-gray-900">{outOfStockItems}</p>
            </div>
            <TrendingDown className="w-8 h-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search inventory..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Categories</option>
                <option value="Electronics">Electronics</option>
                <option value="Furniture">Furniture</option>
                <option value="Accessories">Accessories</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Item</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Category</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Quantity</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Unit Price</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Supplier</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Location</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredItems.map((item) => {
                const StatusIcon = getStatusIcon(item.status);
                return (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="py-4 px-6">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{item.name}</div>
                        <div className="text-sm text-gray-500">{item.sku}</div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm text-gray-700">{item.category}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{item.quantity}</div>
                        <div className="text-xs text-gray-500">Min: {item.minStock}</div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {item.status.replace('-', ' ')}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm font-medium text-gray-900">${item.unitPrice}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm text-gray-700">{item.supplier}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm text-gray-700">{item.location}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-2">
                        <button className="text-gray-500 hover:text-blue-600 transition-colors duration-200">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="text-gray-500 hover:text-green-600 transition-colors duration-200">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button className="text-gray-500 hover:text-red-600 transition-colors duration-200">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InventoryTab;