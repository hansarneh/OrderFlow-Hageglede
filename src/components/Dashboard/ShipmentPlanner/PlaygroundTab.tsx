import React, { useState } from 'react';
import { 
  Calendar, 
  Users, 
  Package, 
  AlertTriangle,
  TrendingUp,
  Filter,
  ChevronLeft,
  ChevronRight,
  Settings,
  RotateCcw,
  Save
} from 'lucide-react';

interface PurchaseOrderScenario {
  id: string;
  poNumber: string;
  supplier: string;
  originalDelivery: string;
  adjustedDelivery: string;
  relatedOrders: string[];
  impact: 'positive' | 'negative' | 'neutral';
}

interface WorkloadDay {
  date: string;
  dayOfWeek: string;
  customerOrders: number;
  purchaseOrders: number;
  workloadLevel: 'low' | 'medium' | 'high' | 'critical';
  availableCapacity: number;
  requiredCapacity: number;
  originalRequiredCapacity: number;
}

const PlaygroundTab: React.FC = () => {
  const [currentWeekStart, setCurrentWeekStart] = useState(new Date('2026-01-05'));
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [showScenarioPanel, setShowScenarioPanel] = useState(true);
  
  const [scenarios, setScenarios] = useState<PurchaseOrderScenario[]>([
    {
      id: '1',
      poNumber: '1031',
      supplier: 'ComponentCorp',
      originalDelivery: '01/04/2026',
      adjustedDelivery: '01/04/2026',
      relatedOrders: ['2546587', '2546588', '2546589'],
      impact: 'neutral'
    },
    {
      id: '2',
      poNumber: '1034',
      supplier: 'PartsPlus Ltd',
      originalDelivery: '01/05/2026',
      adjustedDelivery: '01/05/2026',
      relatedOrders: ['2546587', '2546589'],
      impact: 'neutral'
    },
    {
      id: '3',
      poNumber: '1035',
      supplier: 'QuickParts Inc',
      originalDelivery: '01/06/2026',
      adjustedDelivery: '01/06/2026',
      relatedOrders: ['2546588'],
      impact: 'neutral'
    }
  ]);

  // Generate workload data with scenario adjustments
  const generateWorkloadData = (startDate: Date): WorkloadDay[] => {
    const days: WorkloadDay[] = [];
    const daysToShow = viewMode === 'week' ? 7 : 30;
    
    for (let i = 0; i < daysToShow; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
      const isWeekend = dayOfWeek === 'Sat' || dayOfWeek === 'Sun';
      
      // Base workload calculation
      const baseWorkload = isWeekend ? 0 : Math.floor(Math.random() * 15) + 5;
      const customerOrders = baseWorkload;
      const purchaseOrders = Math.floor(Math.random() * 8) + 2;
      const originalRequiredCapacity = customerOrders * 2 + purchaseOrders;
      
      // Apply scenario adjustments
      let adjustedRequiredCapacity = originalRequiredCapacity;
      const dateStr = date.toISOString().split('T')[0];
      
      scenarios.forEach(scenario => {
        const adjustedDate = new Date(scenario.adjustedDelivery);
        const originalDate = new Date(scenario.originalDelivery);
        
        if (adjustedDate.toISOString().split('T')[0] === dateStr && 
            adjustedDate.getTime() !== originalDate.getTime()) {
          // Add workload impact based on scenario change
          adjustedRequiredCapacity += scenario.relatedOrders.length * 3;
        }
        
        if (originalDate.toISOString().split('T')[0] === dateStr && 
            adjustedDate.getTime() !== originalDate.getTime()) {
          // Remove workload from original date
          adjustedRequiredCapacity -= scenario.relatedOrders.length * 3;
        }
      });
      
      const availableCapacity = isWeekend ? 0 : 40;
      
      let workloadLevel: 'low' | 'medium' | 'high' | 'critical';
      if (isWeekend || adjustedRequiredCapacity < availableCapacity * 0.5) {
        workloadLevel = 'low';
      } else if (adjustedRequiredCapacity < availableCapacity * 0.8) {
        workloadLevel = 'medium';
      } else if (adjustedRequiredCapacity <= availableCapacity) {
        workloadLevel = 'high';
      } else {
        workloadLevel = 'critical';
      }
      
      days.push({
        date: dateStr,
        dayOfWeek,
        customerOrders,
        purchaseOrders,
        workloadLevel,
        availableCapacity,
        requiredCapacity: Math.max(0, adjustedRequiredCapacity),
        originalRequiredCapacity
      });
    }
    
    return days;
  };

  const workloadData = generateWorkloadData(currentWeekStart);

  const updateScenarioDelivery = (scenarioId: string, newDelivery: string) => {
    setScenarios(prev => prev.map(scenario => {
      if (scenario.id === scenarioId) {
        const originalDate = new Date(scenario.originalDelivery);
        const newDate = new Date(newDelivery);
        let impact: 'positive' | 'negative' | 'neutral' = 'neutral';
        
        if (newDate < originalDate) {
          impact = 'positive'; // Earlier delivery
        } else if (newDate > originalDate) {
          impact = 'negative'; // Later delivery
        }
        
        return {
          ...scenario,
          adjustedDelivery: newDelivery,
          impact
        };
      }
      return scenario;
    }));
  };

  const resetAllScenarios = () => {
    setScenarios(prev => prev.map(scenario => ({
      ...scenario,
      adjustedDelivery: scenario.originalDelivery,
      impact: 'neutral'
    })));
  };

  const getWorkloadColor = (level: string, hasChanged: boolean = false) => {
    const baseColors = {
      'low': 'bg-green-100 border-green-300 text-green-800',
      'medium': 'bg-yellow-100 border-yellow-300 text-yellow-800',
      'high': 'bg-orange-100 border-orange-300 text-orange-800',
      'critical': 'bg-red-100 border-red-300 text-red-800'
    };
    
    if (hasChanged) {
      return baseColors[level as keyof typeof baseColors] + ' ring-2 ring-blue-400';
    }
    
    return baseColors[level as keyof typeof baseColors];
  };

  const getWorkloadHeight = (required: number, available: number) => {
    if (available === 0) return 'h-8';
    const percentage = Math.min((required / available) * 100, 100);
    if (percentage < 25) return 'h-12';
    if (percentage < 50) return 'h-16';
    if (percentage < 75) return 'h-20';
    return 'h-24';
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentWeekStart);
    const daysToMove = viewMode === 'week' ? 7 : 30;
    newDate.setDate(newDate.getDate() + (direction === 'next' ? daysToMove : -daysToMove));
    setCurrentWeekStart(newDate);
  };

  const formatDateRange = () => {
    const endDate = new Date(currentWeekStart);
    const daysToAdd = viewMode === 'week' ? 6 : 29;
    endDate.setDate(endDate.getDate() + daysToAdd);
    
    return `${currentWeekStart.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    })} - ${endDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })}`;
  };

  const totalWorkload = workloadData.reduce((sum, day) => sum + day.requiredCapacity, 0);
  const totalCapacity = workloadData.reduce((sum, day) => sum + day.availableCapacity, 0);
  const utilizationRate = totalCapacity > 0 ? (totalWorkload / totalCapacity) * 100 : 0;
  
  const originalTotalWorkload = workloadData.reduce((sum, day) => sum + day.originalRequiredCapacity, 0);
  const workloadChange = totalWorkload - originalTotalWorkload;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Resource Playground</h1>
          <p className="text-gray-600 mt-2">Experiment with delivery scenarios and see their impact</p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowScenarioPanel(!showScenarioPanel)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            <Settings className="w-4 h-4" />
            <span>{showScenarioPanel ? 'Hide' : 'Show'} Scenarios</span>
          </button>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                viewMode === 'week' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                viewMode === 'month' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      {/* Scenario Panel */}
      {showScenarioPanel && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Delivery Scenarios</h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={resetAllScenarios}
                className="flex items-center space-x-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200 text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset All</span>
              </button>
              <button className="flex items-center space-x-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200 text-sm">
                <Save className="w-4 h-4" />
                <span>Save Scenario</span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {scenarios.map((scenario) => (
              <div key={scenario.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">PO {scenario.poNumber}</h4>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    scenario.impact === 'positive' ? 'bg-green-100 text-green-700' :
                    scenario.impact === 'negative' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {scenario.impact}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3">{scenario.supplier}</p>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Original Delivery: {scenario.originalDelivery}
                    </label>
                    <input
                      type="date"
                      value={scenario.adjustedDelivery}
                      onChange={(e) => updateScenarioDelivery(scenario.id, e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="text-xs text-gray-500">
                    Affects: {scenario.relatedOrders.join(', ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Workload</p>
              <p className="text-2xl font-bold text-gray-900">{totalWorkload}</p>
              {workloadChange !== 0 && (
                <p className={`text-sm font-medium ${workloadChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {workloadChange > 0 ? '+' : ''}{workloadChange} from original
                </p>
              )}
            </div>
            <Package className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Available Capacity</p>
              <p className="text-2xl font-bold text-gray-900">{totalCapacity}</p>
            </div>
            <Users className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Utilization Rate</p>
              <p className="text-2xl font-bold text-gray-900">{utilizationRate.toFixed(1)}%</p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Critical Days</p>
              <p className="text-2xl font-bold text-gray-900">
                {workloadData.filter(d => d.workloadLevel === 'critical').length}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigateWeek('prev')}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-gray-500" />
            <span className="text-lg font-semibold text-gray-900">{formatDateRange()}</span>
          </div>
          <button
            onClick={() => navigateWeek('next')}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Workload Visualization */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Daily Workload Overview (Interactive)</h3>
        <div className={`grid gap-4 ${viewMode === 'week' ? 'grid-cols-7' : 'grid-cols-7 md:grid-cols-10 lg:grid-cols-15'}`}>
          {workloadData.map((day, index) => {
            const hasChanged = day.requiredCapacity !== day.originalRequiredCapacity;
            return (
              <div
                key={index}
                className={`border-2 rounded-lg p-3 transition-all duration-200 hover:shadow-md cursor-pointer ${getWorkloadColor(day.workloadLevel, hasChanged)} ${getWorkloadHeight(day.requiredCapacity, day.availableCapacity)}`}
              >
                <div className="text-center">
                  <div className="text-xs font-medium mb-1">{day.dayOfWeek}</div>
                  <div className="text-xs text-gray-600 mb-2">
                    {new Date(day.date).getDate()}
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs">
                      <div className="font-medium">CO: {day.customerOrders}</div>
                      <div className="font-medium">PO: {day.purchaseOrders}</div>
                    </div>
                    <div className="text-xs">
                      <div className="text-gray-600">
                        {day.requiredCapacity}/{day.availableCapacity}
                      </div>
                      {hasChanged && (
                        <div className={`font-medium ${day.requiredCapacity > day.originalRequiredCapacity ? 'text-red-600' : 'text-green-600'}`}>
                          {day.requiredCapacity > day.originalRequiredCapacity ? '+' : ''}
                          {day.requiredCapacity - day.originalRequiredCapacity}
                        </div>
                      )}
                    </div>
                    {day.workloadLevel === 'critical' && (
                      <AlertTriangle className="w-3 h-3 text-red-600 mx-auto" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Legend</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
            <span className="text-sm text-gray-700">Low workload (&lt;50%)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
            <span className="text-sm text-gray-700">Medium workload (50-80%)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-orange-100 border border-orange-300 rounded"></div>
            <span className="text-sm text-gray-700">High workload (80-100%)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
            <span className="text-sm text-gray-700">Critical (&gt;100%)</span>
          </div>
        </div>
        <div className="flex items-center space-x-4 mb-2">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-blue-100 border-2 border-blue-400 rounded ring-2 ring-blue-400"></div>
            <span className="text-sm text-gray-700">Modified by scenario</span>
          </div>
        </div>
        <div className="text-sm text-gray-600">
          <p><strong>CO:</strong> Customer Orders | <strong>PO:</strong> Purchase Orders</p>
          <p>Numbers show required capacity / available capacity</p>
          <p>Green/red numbers show change from original scenario</p>
        </div>
      </div>
    </div>
  );
};

export default PlaygroundTab;