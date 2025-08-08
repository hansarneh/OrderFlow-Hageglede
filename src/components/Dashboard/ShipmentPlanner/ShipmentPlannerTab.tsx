import React, { useState } from 'react';
import CustomerOrdersTab from '../CustomerOrdersTab';
import PurchaseOrdersTab from './PurchaseOrdersTab';
import ResourcePlannerTab from './ResourcePlannerTab';
import PlaygroundTab from './PlaygroundTab';

const ShipmentPlannerTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState('customer-orders');

  const subTabs = [
    { id: 'customer-orders', label: 'Customer Orders' },
    { id: 'purchase-orders-planner', label: 'Purchase Orders' },
    { id: 'resource-planner', label: 'Resource Planner' },
    { id: 'playground', label: 'Playground' }
  ];

  const renderSubTabContent = () => {
    switch (activeSubTab) {
      case 'customer-orders':
        return <CustomerOrdersTab />;
      case 'purchase-orders-planner':
        return <PurchaseOrdersTab />;
      case 'resource-planner':
        return <ResourcePlannerTab />;
      case 'playground':
        return <PlaygroundTab />;
      default:
        return <CustomerOrdersTab />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {subTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                  activeSubTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Sub-tab content */}
      {renderSubTabContent()}
    </div>
  );
};

export default ShipmentPlannerTab;