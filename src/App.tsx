import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginForm from './components/LoginForm';
import DashboardLayout from './components/Layout/DashboardLayout';
import OverviewTab from './components/Dashboard/OverviewTab';
import ProductsTab from './components/Dashboard/ProductsTab';
import BackorderedProductsTab from './components/Dashboard/BackorderedProductsTab';
import CustomerOrdersTab from './components/Dashboard/CustomerOrdersTab';
import OrdersAtRiskTab from './components/Dashboard/OrdersAtRiskTab';
import SettingsTab from './components/Dashboard/SettingsTab';
import ShipmentPlannerTab from './components/Dashboard/ShipmentPlanner/ShipmentPlannerTab';
import PurchaseOrdersTab from './components/Dashboard/ShipmentPlanner/PurchaseOrdersTab';
import ResourcePlannerTab from './components/Dashboard/ShipmentPlanner/ResourcePlannerTab';
import PlaygroundTab from './components/Dashboard/ShipmentPlanner/PlaygroundTab';

const DashboardContent: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  if (!user) {
    return <LoginForm />;
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab />;
      case 'products':
        return <ProductsTab />;
      case 'backordered-products':
        return <BackorderedProductsTab />;
      case 'customer-orders':
        return <CustomerOrdersTab />;
      case 'orders-at-risk':
        return <OrdersAtRiskTab />;
      case 'purchase-orders':
        return <PurchaseOrdersTab />;
      case 'shipment-planner':
        return <ShipmentPlannerTab />;
      case 'purchase-orders-planner':
        return <PurchaseOrdersTab />;
      case 'resource-planner':
        return <ResourcePlannerTab />;
      case 'playground':
        return <PlaygroundTab />;
      case 'settings':
        return <SettingsTab />;
      default:
        return <OverviewTab />;
    }
  };

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderTabContent()}
    </DashboardLayout>
  );
};

function App() {
  return (
    <AuthProvider>
      <DashboardContent />
    </AuthProvider>
  );
}

export default App;