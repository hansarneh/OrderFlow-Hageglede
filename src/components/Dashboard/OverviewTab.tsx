import React from 'react';
import { 
  TrendingUp, 
  Package, 
  Truck, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Users
} from 'lucide-react';

const OverviewTab: React.FC = () => {
  const stats = [
    {
      title: 'Total Shipments',
      value: '2,847',
      change: '+12%',
      trend: 'up',
      icon: Truck,
      color: 'blue'
    },
    {
      title: 'Revenue',
      value: '$89,247',
      change: '+8%',
      trend: 'up',
      icon: DollarSign,
      color: 'green'
    },
    {
      title: 'Inventory Items',
      value: '15,492',
      change: '-3%',
      trend: 'down',
      icon: Package,
      color: 'purple'
    },
    {
      title: 'Active Users',
      value: '124',
      change: '+5%',
      trend: 'up',
      icon: Users,
      color: 'orange'
    }
  ];

  const recentShipments = [
    { id: 'SH001', customer: 'Acme Corp', status: 'delivered', date: '2024-01-15', value: '$2,450' },
    { id: 'SH002', customer: 'TechFlow Ltd', status: 'in-transit', date: '2024-01-14', value: '$1,890' },
    { id: 'SH003', customer: 'Global Inc', status: 'pending', date: '2024-01-14', value: '$3,200' },
    { id: 'SH004', customer: 'FastTrack Co', status: 'delivered', date: '2024-01-13', value: '$1,250' },
    { id: 'SH005', customer: 'MegaCorp', status: 'in-transit', date: '2024-01-13', value: '$4,100' }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'text-green-700 bg-green-100';
      case 'in-transit': return 'text-blue-700 bg-blue-100';
      case 'pending': return 'text-yellow-700 bg-yellow-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  const getStatColor = (color: string) => {
    switch (color) {
      case 'blue': return 'bg-blue-500';
      case 'green': return 'bg-emerald-500';
      case 'purple': return 'bg-purple-500';
      case 'orange': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="text-gray-600 mt-2">Welcome back! Here's what's happening with your logistics operations.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
                  <div className="flex items-center mt-2">
                    <TrendingUp className={`w-4 h-4 ${stat.trend === 'up' ? 'text-green-500' : 'text-red-500'} ${stat.trend === 'down' ? 'rotate-180' : ''}`} />
                    <span className={`text-sm font-medium ml-1 ${stat.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                      {stat.change}
                    </span>
                    <span className="text-sm text-gray-500 ml-1">from last month</span>
                  </div>
                </div>
                <div className={`${getStatColor(stat.color)} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Overview</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">On-Time Delivery</span>
              <span className="text-sm font-bold text-gray-900">94%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full" style={{ width: '94%' }}></div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Customer Satisfaction</span>
              <span className="text-sm font-bold text-gray-900">98%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full" style={{ width: '98%' }}></div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Cost Efficiency</span>
              <span className="text-sm font-bold text-gray-900">87%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-purple-500 h-2 rounded-full" style={{ width: '87%' }}></div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            <button className="flex flex-col items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors duration-200">
              <Package className="w-8 h-8 text-blue-600 mb-2" />
              <span className="text-sm font-medium text-blue-700">New Shipment</span>
            </button>
            <button className="flex flex-col items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors duration-200">
              <CheckCircle className="w-8 h-8 text-green-600 mb-2" />
              <span className="text-sm font-medium text-green-700">Track Package</span>
            </button>
            <button className="flex flex-col items-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors duration-200">
              <Clock className="w-8 h-8 text-purple-600 mb-2" />
              <span className="text-sm font-medium text-purple-700">Schedule Pickup</span>
            </button>
            <button className="flex flex-col items-center p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors duration-200">
              <AlertTriangle className="w-8 h-8 text-orange-600 mb-2" />
              <span className="text-sm font-medium text-orange-700">View Alerts</span>
            </button>
          </div>
        </div>
      </div>

      {/* Recent Shipments */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Shipments</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Shipment ID</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Customer</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recentShipments.map((shipment) => (
                <tr key={shipment.id} className="hover:bg-gray-50 transition-colors duration-150">
                  <td className="py-4 px-6 text-sm font-medium text-gray-900">{shipment.id}</td>
                  <td className="py-4 px-6 text-sm text-gray-700">{shipment.customer}</td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(shipment.status)}`}>
                      {shipment.status.replace('-', ' ')}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-sm text-gray-500">{shipment.date}</td>
                  <td className="py-4 px-6 text-sm font-medium text-gray-900">{shipment.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;