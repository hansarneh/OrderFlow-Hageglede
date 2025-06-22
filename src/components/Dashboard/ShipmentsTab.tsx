import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  MapPin, 
  Calendar,
  Truck,
  Package,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

const ShipmentsTab: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const shipments = [
    {
      id: 'SH001',
      trackingNumber: 'TRK123456789',
      customer: 'Acme Corporation',
      origin: 'New York, NY',
      destination: 'Los Angeles, CA',
      status: 'delivered',
      priority: 'high',
      weight: '45.2 kg',
      value: '$2,450',
      estimatedDelivery: '2024-01-15',
      actualDelivery: '2024-01-15',
      carrier: 'FedEx'
    },
    {
      id: 'SH002',
      trackingNumber: 'TRK987654321',
      customer: 'TechFlow Limited',
      origin: 'Chicago, IL',
      destination: 'Miami, FL',
      status: 'in-transit',
      priority: 'medium',
      weight: '23.8 kg',
      value: '$1,890',
      estimatedDelivery: '2024-01-16',
      actualDelivery: null,
      carrier: 'UPS'
    },
    {
      id: 'SH003',
      trackingNumber: 'TRK456789123',
      customer: 'Global Industries',
      origin: 'Seattle, WA',
      destination: 'Austin, TX',
      status: 'pending',
      priority: 'low',
      weight: '67.1 kg',
      value: '$3,200',
      estimatedDelivery: '2024-01-18',
      actualDelivery: null,
      carrier: 'DHL'
    },
    {
      id: 'SH004',
      trackingNumber: 'TRK789123456',
      customer: 'FastTrack Company',
      origin: 'Phoenix, AZ',
      destination: 'Denver, CO',
      status: 'delivered',
      priority: 'high',
      weight: '12.5 kg',
      value: '$1,250',
      estimatedDelivery: '2024-01-13',
      actualDelivery: '2024-01-13',
      carrier: 'FedEx'
    },
    {
      id: 'SH005',
      trackingNumber: 'TRK321654987',
      customer: 'MegaCorp Enterprises',
      origin: 'Boston, MA',
      destination: 'San Francisco, CA',
      status: 'delayed',
      priority: 'high',
      weight: '89.3 kg',
      value: '$4,100',
      estimatedDelivery: '2024-01-14',
      actualDelivery: null,
      carrier: 'UPS'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'text-green-700 bg-green-100';
      case 'in-transit': return 'text-blue-700 bg-blue-100';
      case 'pending': return 'text-yellow-700 bg-yellow-100';
      case 'delayed': return 'text-red-700 bg-red-100';
      default: return 'text-gray-700 bg-gray-100';
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered': return CheckCircle;
      case 'in-transit': return Truck;
      case 'pending': return Clock;
      case 'delayed': return AlertCircle;
      default: return Package;
    }
  };

  const filteredShipments = shipments.filter(shipment => {
    const matchesSearch = shipment.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         shipment.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = statusFilter === 'all' || shipment.status === statusFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shipments</h1>
          <p className="text-gray-600 mt-2">Manage and track all your shipments</p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2">
          <Plus className="w-4 h-4" />
          <span>New Shipment</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Shipments</p>
              <p className="text-2xl font-bold text-gray-900">2,847</p>
            </div>
            <Package className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">In Transit</p>
              <p className="text-2xl font-bold text-gray-900">156</p>
            </div>
            <Truck className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Delivered</p>
              <p className="text-2xl font-bold text-gray-900">2,658</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Delayed</p>
              <p className="text-2xl font-bold text-gray-900">33</p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-500" />
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
                placeholder="Search shipments..."
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
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="in-transit">In Transit</option>
                <option value="delivered">Delivered</option>
                <option value="delayed">Delayed</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Shipments Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Shipment</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Customer</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Route</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Priority</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Value</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Delivery</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredShipments.map((shipment) => {
                const StatusIcon = getStatusIcon(shipment.status);
                return (
                  <tr key={shipment.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="py-4 px-6">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{shipment.id}</div>
                        <div className="text-sm text-gray-500">{shipment.trackingNumber}</div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm text-gray-900">{shipment.customer}</div>
                      <div className="text-sm text-gray-500">{shipment.carrier}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-2 text-sm text-gray-700">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <div>
                          <div>{shipment.origin}</div>
                          <div className="text-gray-500">→ {shipment.destination}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(shipment.status)}`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {shipment.status.replace('-', ' ')}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(shipment.priority)}`}>
                        {shipment.priority}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm font-medium text-gray-900">{shipment.value}</div>
                      <div className="text-sm text-gray-500">{shipment.weight}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-1 text-sm text-gray-700">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="text-gray-900">{shipment.estimatedDelivery}</div>
                          {shipment.actualDelivery && (
                            <div className="text-green-600">✓ {shipment.actualDelivery}</div>
                          )}
                        </div>
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

export default ShipmentsTab;