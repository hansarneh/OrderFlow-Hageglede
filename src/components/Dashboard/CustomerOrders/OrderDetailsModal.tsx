import React from 'react';
import { 
  X, 
  Package, 
  Calendar, 
  Truck, 
  Box, 
  CheckCircle, 
  Clock, 
  XCircle,
  ExternalLink,
  User
} from 'lucide-react';
import { CustomerOrder, OrderLine, OngoingOrder, OngoingOrderLine } from '../../../lib/firebaseUtils';

type OrderData = CustomerOrder | OngoingOrder;

interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderData | null;
  isLoadingLines: boolean;
}

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ 
  isOpen, 
  onClose, 
  order, 
  isLoadingLines 
}) => {
  if (!isOpen || !order) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('no-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('no-NO');
  };

  const getDeliveryStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'text-green-700 bg-green-100';
      case 'partial': return 'text-yellow-700 bg-yellow-100';
      case 'pending': return 'text-gray-700 bg-gray-100';
      case 'cancelled': return 'text-red-700 bg-red-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  const getDeliveryStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered': return CheckCircle;
      case 'partial': return Package;
      case 'pending': return Clock;
      case 'cancelled': return XCircle;
      default: return Package;
    }
  };

  const getStatusColor = (status: string | number) => {
    if ('wooStatus' in order) {
      // WooCommerce status colors
      switch (status) {
        case 'completed': return 'text-green-700 bg-green-100';
        case 'processing': return 'text-blue-700 bg-blue-100';
        case 'delvis-levert': return 'text-purple-700 bg-purple-100';
        case 'on-hold': return 'text-orange-700 bg-orange-100';
        case 'pending': return 'text-yellow-700 bg-yellow-100';
        case 'cancelled': return 'text-red-700 bg-red-100';
        default: return 'text-gray-700 bg-gray-100';
      }
    } else {
      // Ongoing WMS status colors
      switch (status) {
        case 200: return 'text-blue-700 bg-blue-100';
        case 210: return 'text-red-700 bg-red-100';
        case 300: return 'text-yellow-700 bg-yellow-100';
        case 320: return 'text-purple-700 bg-purple-100';
        case 400: return 'text-green-700 bg-green-100';
        case 450: return 'text-green-700 bg-green-100';
        case 451: return 'text-orange-700 bg-orange-100';
        case 500: return 'text-green-700 bg-green-100';
        case 600: return 'text-gray-700 bg-gray-100';
        default: return 'text-gray-700 bg-gray-100';
      }
    }
  };

  const getStatusIcon = (status: string | number) => {
    if ('wooStatus' in order) {
      // WooCommerce status icons
      switch (status) {
        case 'completed': return CheckCircle;
        case 'processing': return Package;
        case 'delvis-levert': return Truck;
        case 'on-hold': return Clock;
        case 'pending': return Clock;
        case 'cancelled': return XCircle;
        default: return Package;
      }
    } else {
      // Ongoing WMS status icons
      switch (status) {
        case 200: return Package;
        case 210: return XCircle;
        case 300: return Truck;
        case 320: return User;
        case 400: return CheckCircle;
        case 450: return CheckCircle;
        case 451: return Package;
        case 500: return CheckCircle;
        case 600: return Clock;
        default: return Package;
      }
    }
  };

  const getStatusText = (status: string | number) => {
    if ('wooStatus' in order) {
      return status as string;
    } else {
      // Ongoing WMS status text
      switch (status) {
        case 200: return 'Open';
        case 210: return 'On Hold';
        case 300: return 'Picking';
        case 320: return 'Assigned';
        case 400: return 'Picked';
        case 450: return 'Sent';
        case 451: return 'Partially Sent';
        case 500: return 'Collected';
        case 600: return 'Waiting for customer';
        default: return `Status ${status}`;
      }
    }
  };

  const status = 'wooStatus' in order ? order.wooStatus : order.ongoingStatus;
  const StatusIcon = getStatusIcon(status);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h2 className="text-xl font-bold text-gray-900">Order #{order.orderNumber}</h2>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {getStatusText(status)}
              </span>
              </div>
                              <p className="text-sm text-gray-600 mt-1">ID: {'woocommerceOrderId' in order ? order.woocommerceOrderId : order.ongoingOrderId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-grow p-6">
          {/* Order Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Customer Information</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <User className="w-4 h-4 text-gray-500" />
                    <span className="font-medium text-gray-900">{order.customerName}</span>
                  </div>
                  {order.billingAddress && (
                    <div className="text-sm text-gray-600 ml-6 whitespace-pre-line">
                      {order.billingAddress}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Order Details</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Created Date:</span>
                    <span className="font-medium text-gray-900">{formatDate(order.dateCreated)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Value:</span>
                    <span className="font-medium text-gray-900">{formatCurrency(order.totalValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Items:</span>
                    <span className="font-medium text-gray-900">{order.totalItems}</span>
                  </div>
                  {'permalink' in order && order.permalink && (
                    <div className="pt-2">
                      <a
                        href={order.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 transition-colors duration-200 text-sm flex items-center space-x-1"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>View in WooCommerce</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Delivery Information</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  {order.deliveryDate && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Delivery Date:</span>
                      <span className="font-medium text-gray-900">{formatDate(order.deliveryDate)}</span>
                    </div>
                  )}
                  {order.deliveryType && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Delivery Type:</span>
                      <span className="font-medium text-gray-900">{order.deliveryType}</span>
                    </div>
                  )}
                  {order.shippingMethodTitle && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Shipping Method:</span>
                      <span className="font-medium text-gray-900">{order.shippingMethodTitle}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Order Lines */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Lines</h3>
            
            {isLoadingLines ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                  <p className="text-gray-600">Loading order lines...</p>
                </div>
              </div>
                          ) : order.orderLines && order.orderLines.length > 0 ? (
              <div className="space-y-4">
                {order.orderLines?.map((line) => {
                  const DeliveryIcon = getDeliveryStatusIcon(line.deliveryStatus);
                  return (
                    <div key={line.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                        <div className="md:col-span-4">
                          <div className="font-medium text-gray-900">{line.productName}</div>
                          {line.sku && (
                            <div className="text-xs text-gray-500 flex items-center space-x-1 mt-1">
                              <Box className="w-3 h-3" />
                              <span>{line.sku}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="md:col-span-2 flex flex-col items-center">
                          <div className="text-sm text-gray-600">Quantity</div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{line.quantity}</span>
                            <span className="text-gray-400">×</span>
                            <span className="text-sm">{formatCurrency(line.unitPrice)}</span>
                          </div>
                        </div>
                        
                        <div className="md:col-span-2 flex flex-col items-center">
                          <div className="text-sm text-gray-600">Delivered</div>
                          <div className="font-medium text-green-600">{line.deliveredQuantity}</div>
                        </div>
                        
                        <div className="md:col-span-2 flex flex-col items-center">
                          <div className="text-sm text-gray-600">Status</div>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getDeliveryStatusColor(line.deliveryStatus)}`}>
                            <DeliveryIcon className="w-3 h-3 mr-1" />
                            {line.deliveryStatus}
                          </span>
                        </div>
                        
                        <div className="md:col-span-2 flex flex-col items-center">
                          <div className="text-sm text-gray-600">Total</div>
                          <div className="font-medium text-blue-600">{formatCurrency(line.totalPrice)}</div>
                        </div>
                      </div>
                      
                      {/* Delivery Details */}
                      {(line.deliveryDate || line.partialDeliveryDetails) && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="flex items-start space-x-4">
                            {line.deliveryDate && (
                              <div className="flex items-center space-x-1 text-sm text-gray-600">
                                <Calendar className="w-3 h-3 text-gray-400" />
                                <span>Delivery: {formatDate(line.deliveryDate)}</span>
                              </div>
                            )}
                            
                            {line.partialDeliveryDetails && line.partialDeliveryDetails.length > 0 && (
                              <div className="flex items-center space-x-1 text-sm text-gray-600">
                                <Truck className="w-3 h-3 text-gray-400" />
                                <span>Partial delivery details available</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-12 text-center">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">No order lines found</h4>
                <p className="text-gray-600">This order doesn't have any line items or they haven't been loaded yet.</p>
              </div>
            )}
          </div>

          {/* Additional Meta Data - Moved below order lines */}
          {order.metaData && typeof order.metaData === 'object' && Object.keys(order.metaData).length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                {Object.entries(order.metaData).map(([key, value]) => {
                  // Skip keys that are already displayed elsewhere
                  if (key === '_delivery_date' || key === '_delivery_type' || key === '_shipping_method_title') {
                    return null;
                  }
                  
                  // Format the key for display
                  const displayKey = key.startsWith('_') 
                    ? key.substring(1).replace(/_/g, ' ') 
                    : key.replace(/_/g, ' ');
                  
                  // Format the value based on type
                  let displayValue = value;
                  if (typeof value === 'object') {
                    displayValue = JSON.stringify(value);
                  }
                  
                  return (
                    <div key={key} className="flex justify-between">
                      <span className="text-gray-600 capitalize">{displayKey}:</span>
                      <span className="font-medium text-gray-900 max-w-[60%] truncate">{String(displayValue)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg transition-colors duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailsModal;