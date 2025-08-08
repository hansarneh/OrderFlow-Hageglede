import React, { useState } from 'react';
import { 
  BarChart3, 
  Package, 
  Users, 
  Settings, 
  Bell, 
  Menu,
  X,
  LogOut,
  User,
  Calendar,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Box,
  ShoppingCart,
  Link
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, activeTab, onTabChange }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [shipmentPlannerOpen, setShipmentPlannerOpen] = useState(false);
  const { user, logout } = useAuth();

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'products', label: 'Products', icon: Box },
    { id: 'backordered-products', label: 'Backordered Products', icon: AlertTriangle },
    { id: 'orders-at-risk', label: 'Orders at Risk', icon: AlertTriangle },
    { id: 'customer-orders', label: 'Customer Orders', icon: ShoppingCart },
    { id: 'order-mappings', label: 'Order Mappings', icon: Link },
    { id: 'purchase-orders', label: 'Purchase Orders', icon: Package },
    { 
      id: 'shipment-planner', 
      label: 'Shipment Planner', 
      icon: Calendar,
      hasSubmenu: true,
      submenuOpen: shipmentPlannerOpen,
      onToggle: () => setShipmentPlannerOpen(!shipmentPlannerOpen),
      submenuItems: [
        { id: 'purchase-orders-planner', label: 'Purchase Orders' },
        { id: 'resource-planner', label: 'Resource Planner' },
        { id: 'playground', label: 'Playground' }
      ]
    },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const filteredMenuItems = menuItems;

  const handleMenuItemClick = (itemId: string) => {
    if (itemId === 'shipment-planner') {
      setShipmentPlannerOpen(!shipmentPlannerOpen);
      // If opening the submenu, navigate to the first submenu item
      if (!shipmentPlannerOpen) {
        onTabChange('shipment-planner');
      }
    } else {
      onTabChange(itemId);
      setSidebarOpen(false);
    }
  };

  const isShipmentPlannerActive = activeTab === 'shipment-planner' || 
    ['purchase-orders-planner', 'resource-planner', 'playground'].includes(activeTab);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">LogiFlow</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="mt-6 px-3">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.hasSubmenu ? isShipmentPlannerActive : activeTab === item.id;
            
            return (
              <div key={item.id}>
                <button
                  onClick={() => handleMenuItemClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-left transition-colors duration-200 mb-1 ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </div>
                  {item.hasSubmenu && (
                    <div className="transition-transform duration-200">
                      {item.submenuOpen ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </div>
                  )}
                </button>
                
                {/* Submenu */}
                {item.hasSubmenu && item.submenuOpen && (
                  <div className="ml-6 mt-1 space-y-1">
                    {item.submenuItems?.map((subItem) => (
                      <button
                        key={subItem.id}
                        onClick={() => {
                          onTabChange(subItem.id);
                          setSidebarOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors duration-200 ${
                          activeTab === subItem.id
                            ? 'bg-blue-100 text-blue-700'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-700'
                        }`}
                      >
                        {subItem.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <div className="font-medium text-gray-900">{user?.name}</div>
              <div className="text-sm text-gray-500 capitalize">{user?.role}</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center space-x-2 px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors duration-200"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:ml-64">
        {/* Top header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              <Menu className="w-6 h-6" />
            </button>
            
            <div className="flex items-center space-x-4">
              <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200">
                <Bell className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;