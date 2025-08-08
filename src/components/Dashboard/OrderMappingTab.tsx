import React, { useState, useEffect } from 'react';
import { 
  Link, 
  Search, 
  Filter, 
  Plus, 
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  User,
  DollarSign,
  RefreshCw,
  Loader2,
  Eye,
  Edit,
  Trash2,
  Link as LinkIcon,
  Unlink,
  Target,
  TrendingUp
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getOrderMappings, 
  getOrderMapping, 
  createOrderMapping, 
  updateOrderMapping, 
  deactivateOrderMapping,
  findOrderMappingCandidates,
  OrderMapping,
  OrderMappingCandidate
} from '../../lib/firebaseUtils';

const OrderMappingTab: React.FC = () => {
  const { user } = useAuth();
  const [mappings, setMappings] = useState<OrderMapping[]>([]);
  const [candidates, setCandidates] = useState<OrderMappingCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'exact' | 'manual' | 'suggested'>('all');
  const [showCandidates, setShowCandidates] = useState(false);
  const [selectedMapping, setSelectedMapping] = useState<OrderMapping | null>(null);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing mappings
  const loadMappings = async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const mappingsData = await getOrderMappings();
      setMappings(mappingsData);
      console.log(`Loaded ${mappingsData.length} order mappings`);
    } catch (err: any) {
      console.error('Error loading order mappings:', err);
      setError(err.message || 'Failed to load order mappings');
    } finally {
      setLoading(false);
    }
  };

  // Find mapping candidates
  const findCandidates = async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const candidatesData = await findOrderMappingCandidates();
      setCandidates(candidatesData);
      console.log(`Found ${candidatesData.length} mapping candidates`);
    } catch (err: any) {
      console.error('Error finding mapping candidates:', err);
      setError(err.message || 'Failed to find mapping candidates');
    } finally {
      setLoading(false);
    }
  };

  // Create a new mapping
  const handleCreateMapping = async (
    wooOrderId: string,
    ongoingOrderId: string,
    mappingType: 'exact' | 'manual' | 'suggested',
    confidence: number,
    notes?: string
  ) => {
    if (!user?.id) return;

    try {
      await createOrderMapping(wooOrderId, ongoingOrderId, mappingType, confidence, notes);
      await loadMappings(); // Reload mappings
      setShowMappingModal(false);
      setSelectedMapping(null);
    } catch (err: any) {
      console.error('Error creating mapping:', err);
      setError(err.message || 'Failed to create mapping');
    }
  };

  // Deactivate a mapping
  const handleDeactivateMapping = async (mappingId: string) => {
    if (!user?.id) return;

    try {
      await deactivateOrderMapping(mappingId);
      await loadMappings(); // Reload mappings
    } catch (err: any) {
      console.error('Error deactivating mapping:', err);
      setError(err.message || 'Failed to deactivate mapping');
    }
  };

  // Load mappings on component mount
  useEffect(() => {
    loadMappings();
  }, []);

  const getMappingTypeColor = (type: string) => {
    switch (type) {
      case 'exact':
        return 'text-green-700 bg-green-100';
      case 'manual':
        return 'text-blue-700 bg-blue-100';
      case 'suggested':
        return 'text-yellow-700 bg-yellow-100';
      default:
        return 'text-gray-700 bg-gray-100';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 80) return <CheckCircle className="w-4 h-4" />;
    if (confidence >= 60) return <AlertTriangle className="w-4 h-4" />;
    return <XCircle className="w-4 h-4" />;
  };

  // Filter mappings based on search and filter
  const filteredMappings = mappings.filter(mapping => {
    const matchesSearch = mapping.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         mapping.orderNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'all' || mapping.mappingType === filterType;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Order Mappings</h1>
          <p className="text-gray-600 mt-2">Link orders between WooCommerce and Ongoing WMS</p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={loadMappings}
            disabled={loading}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200 flex items-center space-x-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          
          <button 
            onClick={() => {
              setShowCandidates(true);
              findCandidates();
            }}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2 disabled:opacity-50"
          >
            <Target className="w-4 h-4" />
            <span>Find Candidates</span>
          </button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center space-x-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by customer name or order number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Types</option>
          <option value="exact">Exact Matches</option>
          <option value="manual">Manual Mappings</option>
          <option value="suggested">Suggested</option>
        </select>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center justify-center space-x-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-gray-600">Loading order mappings...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-red-800 font-medium">Operation failed</h3>
              <div className="text-red-700 text-sm mt-2">{error}</div>
              <button 
                onClick={() => setError(null)}
                className="mt-4 text-red-600 hover:text-red-800 text-sm font-medium"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mappings List */}
      {!loading && !error && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Order Mappings ({filteredMappings.length})
            </h3>
          </div>
          
          {filteredMappings.length === 0 ? (
            <div className="p-8 text-center">
              <LinkIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No mappings found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || filterType !== 'all' 
                  ? 'Try adjusting your search or filter criteria.'
                  : 'No order mappings have been created yet. Use "Find Candidates" to discover potential matches.'
                }
              </p>
              {!searchTerm && filterType === 'all' && (
                <button
                  onClick={() => {
                    setShowCandidates(true);
                    findCandidates();
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  Find Mapping Candidates
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredMappings.map((mapping) => (
                <div key={mapping.id} className="p-6 hover:bg-gray-50 transition-colors duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="text-lg font-medium text-gray-900">
                          {mapping.customerName}
                        </h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getMappingTypeColor(mapping.mappingType)}`}>
                          {mapping.mappingType}
                        </span>
                        <div className={`flex items-center space-x-1 ${getConfidenceColor(mapping.confidence)}`}>
                          {getConfidenceIcon(mapping.confidence)}
                          <span className="text-sm font-medium">{mapping.confidence}%</span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                        <div>
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-medium">WooCommerce:</span>
                            <span>{mapping.wooOrderData?.orderNumber || 'N/A'}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">Status:</span>
                            <span>{mapping.wooOrderData?.wooStatus || 'N/A'}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">Value:</span>
                            <span>{mapping.wooOrderData?.totalValue ? `NOK ${mapping.wooOrderData.totalValue}` : 'N/A'}</span>
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-medium">Ongoing WMS:</span>
                            <span>{mapping.ongoingOrderData?.orderNumber || 'N/A'}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">Status:</span>
                            <span>{mapping.ongoingOrderData?.ongoingStatus || 'N/A'}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">Value:</span>
                            <span>{mapping.ongoingOrderData?.totalValue ? `NOK ${mapping.ongoingOrderData.totalValue}` : 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                      
                      {mapping.notes && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <span className="text-sm text-gray-600">{mapping.notes}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => {
                          setSelectedMapping(mapping);
                          setShowMappingModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 transition-colors duration-200"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeactivateMapping(mapping.id)}
                        className="text-red-600 hover:text-red-800 transition-colors duration-200"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mapping Candidates Modal */}
      {showCandidates && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Mapping Candidates ({candidates.length})
                </h3>
                <button
                  onClick={() => setShowCandidates(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {candidates.length === 0 ? (
                <div className="text-center py-8">
                  <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No candidates found</h3>
                  <p className="text-gray-600">
                    No potential order mappings were found. This could mean:
                  </p>
                  <ul className="text-gray-600 text-sm mt-2 space-y-1">
                    <li>• Orders have different order numbers</li>
                    <li>• Customer names don't match</li>
                    <li>• Orders are already mapped</li>
                  </ul>
                </div>
              ) : (
                <div className="space-y-4">
                  {candidates.slice(0, 10).map((candidate, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className={`flex items-center space-x-1 ${getConfidenceColor(candidate.confidence)}`}>
                            {getConfidenceIcon(candidate.confidence)}
                            <span className="font-medium">{candidate.confidence}% match</span>
                          </div>
                          <span className="text-sm text-gray-500">{candidate.matchReason}</span>
                        </div>
                        <button
                          onClick={() => {
                            handleCreateMapping(
                              candidate.wooOrder.id,
                              candidate.ongoingOrder.id,
                              'suggested',
                              candidate.confidence
                            );
                          }}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors duration-200"
                        >
                          Create Mapping
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="bg-blue-50 p-3 rounded">
                          <h4 className="font-medium text-blue-900 mb-2">WooCommerce Order</h4>
                          <div className="space-y-1 text-blue-800">
                            <div><span className="font-medium">Order:</span> {candidate.wooOrder.orderNumber}</div>
                            <div><span className="font-medium">Customer:</span> {candidate.wooOrder.customerName}</div>
                            <div><span className="font-medium">Status:</span> {candidate.wooOrder.wooStatus}</div>
                            <div><span className="font-medium">Value:</span> NOK {candidate.wooOrder.totalValue}</div>
                          </div>
                        </div>
                        
                        <div className="bg-green-50 p-3 rounded">
                          <h4 className="font-medium text-green-900 mb-2">Ongoing WMS Order</h4>
                          <div className="space-y-1 text-green-800">
                            <div><span className="font-medium">Order:</span> {candidate.ongoingOrder.orderNumber}</div>
                            <div><span className="font-medium">Customer:</span> {candidate.ongoingOrder.customerName}</div>
                            <div><span className="font-medium">Status:</span> {candidate.ongoingOrder.ongoingStatus}</div>
                            <div><span className="font-medium">Value:</span> NOK {candidate.ongoingOrder.totalValue}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {candidates.length > 10 && (
                    <div className="text-center py-4 text-gray-600">
                      Showing top 10 candidates. {candidates.length - 10} more available.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mapping Modal */}
      {showMappingModal && selectedMapping && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Edit Order Mapping</h3>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mapping Type
                  </label>
                  <select
                    value={selectedMapping.mappingType}
                    onChange={(e) => setSelectedMapping({
                      ...selectedMapping,
                      mappingType: e.target.value as 'exact' | 'manual' | 'suggested'
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="exact">Exact Match</option>
                    <option value="manual">Manual Mapping</option>
                    <option value="suggested">Suggested</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confidence (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={selectedMapping.confidence}
                    onChange={(e) => setSelectedMapping({
                      ...selectedMapping,
                      confidence: parseInt(e.target.value)
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={selectedMapping.notes || ''}
                    onChange={(e) => setSelectedMapping({
                      ...selectedMapping,
                      notes: e.target.value
                    })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Add notes about this mapping..."
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowMappingModal(false);
                    setSelectedMapping(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (selectedMapping) {
                      await updateOrderMapping(selectedMapping.id, {
                        mappingType: selectedMapping.mappingType,
                        confidence: selectedMapping.confidence,
                        notes: selectedMapping.notes
                      });
                      await loadMappings();
                      setShowMappingModal(false);
                      setSelectedMapping(null);
                    }
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderMappingTab;
