import React, { useState } from 'react';
import { 
  Calendar, 
  Users, 
  Package, 
  AlertTriangle,
  TrendingUp,
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface WorkloadDay {
  date: string;
  dayOfWeek: string;
  customerOrders: number;
  purchaseOrders: number;
  workloadLevel: 'low' | 'medium' | 'high' | 'critical';
  availableCapacity: number;
  requiredCapacity: number;
  backloggedOrders: string[];
  readyToFulfill: string[];
}

const ResourcePlannerTab: React.FC = () => {
  const [currentWeekStart, setCurrentWeekStart] = useState(new Date('2026-01-05'));
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

  // Generate workload data for the next few weeks
  const generateWorkloadData = (startDate: Date): WorkloadDay[] => {
    const days: WorkloadDay[] = [];
    const daysToShow = viewMode === 'week' ? 7 : 30;
    
    for (let i = 0; i < daysToShow; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
      const isWeekend = dayOfWeek === 'Sat' || dayOfWeek === 'Sun';
      
      // Simulate workload data
      const baseWorkload = isWeekend ? 0 : Math.floor(Math.random() * 15) + 5;
      const customerOrders = baseWorkload;
      const purchaseOrders = Math.floor(Math.random() * 8) + 2;
      const requiredCapacity = customerOrders * 2 + purchaseOrders;
      const availableCapacity = isWeekend ? 0 : 40;
      
      let workloadLevel: 'low' | 'medium' | 'high' | 'critical';
      if (isWeekend || requiredCapacity < availableCapacity * 0.5) {
        workloadLevel = 'low';
      } else if (requiredCapacity < availableCapacity * 0.8) {
        workloadLevel = 'medium';
      } else if (requiredCapacity <= availableCapacity) {
        workloadLevel = 'high';
      } else {
        workloadLevel = 'critical';
      }
      
      days.push({
        date: date.toISOString().split('T')[0],
        dayOfWeek,
        customerOrders,
        purchaseOrders,
        workloadLevel,
        availableCapacity,
        requiredCapacity,
        backloggedOrders: ['2546587', '2546588'].slice(0, Math.floor(Math.random() * 3)),
        readyToFulfill: ['2546589', '2546590'].slice(0, Math.floor(Math.random() * 3))
      });
    }
    
    return days;
  };

  const workloadData = generateWorkloadData(currentWeekStart);

  const getWorkloadColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-100 border-green-300 text-green-800';
      case 'medium': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'high': return 'bg-orange-100 border-orange-300 text-orange-800';
      case 'critical': return 'bg-red-100 border-red-300 text-red-800';
      default: return 'bg-gray-100 border-gray-300 text-gray-800';
    }
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Resource Planner</h1>
          <p className="text-gray-600 mt-2">Visualize workload and resource allocation</p>
        </div>
        <div className="flex items-center space-x-4">
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Workload</p>
              <p className="text-2xl font-bold text-gray-900">{totalWorkload}</p>
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
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Daily Workload Overview</h3>
        <div className={`grid gap-4 ${viewMode === 'week' ? 'grid-cols-7' : 'grid-cols-7 md:grid-cols-10 lg:grid-cols-15'}`}>
          {workloadData.map((day, index) => (
            <div
              key={index}
              className={`border-2 rounded-lg p-3 transition-all duration-200 hover:shadow-md cursor-pointer ${getWorkloadColor(day.workloadLevel)} ${getWorkloadHeight(day.requiredCapacity, day.availableCapacity)}`}
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
                  </div>
                  {day.workloadLevel === 'critical' && (
                    <AlertTriangle className="w-3 h-3 text-red-600 mx-auto" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Legend</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        <div className="mt-4 text-sm text-gray-600">
          <p><strong>CO:</strong> Customer Orders | <strong>PO:</strong> Purchase Orders</p>
          <p>Numbers show required capacity / available capacity</p>
        </div>
      </div>
    </div>
  );
};

export default ResourcePlannerTab;