import React, { useState } from 'react';
import { 
  Play, 
  Square, 
  RefreshCw, 
  AlertCircle,
  Info
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const InitialSyncTab: React.FC = () => {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState({
    isRunning: false,
    currentStep: '',
    progress: 0,
    syncedOrders: 0,
    errors: 0,
    logs: [] as string[]
  });

  const [syncConfig, setSyncConfig] = useState({
    source: 'ongoing_wms' as 'ongoing_wms' | 'woocommerce' | 'both',
    strategy: 'status-based' as 'status-based' | 'date-range',
    maxOrders: 10,
    dateRange: {
      start: '',
      end: ''
    },
    statuses: [200, 210, 300, 320, 400, 450, 451]
  });

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setSyncProgress(prev => ({
      ...prev,
      logs: [...prev.logs, `${timestamp}: ${message}`]
    }));
  };

  const startSync = async () => {
    if (!user?.id) {
      setError('User not authenticated');
      return;
    }

    setError(null);
    setSyncProgress({
      isRunning: true,
      currentStep: 'Initializing sync...',
      progress: 0,
      syncedOrders: 0,
      errors: 0,
      logs: []
    });

    try {
      if (syncConfig.source === 'ongoing_wms' || syncConfig.source === 'both') {
        await syncOngoingWMS();
      }
      
      if (syncConfig.source === 'woocommerce' || syncConfig.source === 'both') {
        await syncWooCommerce();
      }

      addLog('🎉 Initial sync completed successfully!');
    } catch (err: any) {
      addLog(`❌ Sync failed: ${err.message}`);
      setError(err.message);
    } finally {
      setSyncProgress(prev => ({ ...prev, isRunning: false }));
    }
  };

  const syncOngoingWMS = async () => {
    addLog('Starting Ongoing WMS sync...');
    setSyncProgress(prev => ({ ...prev, currentStep: 'Syncing Ongoing WMS orders...' }));

    try {
      const { httpsCallable } = await import('firebase/functions');
      const { getFunctions } = await import('firebase/functions');
      const functions = getFunctions();

      let totalSynced = 0;
      let totalErrors = 0;

      if (syncConfig.strategy === 'status-based') {
        addLog(`Using status-based sync with ${syncConfig.statuses.length} statuses`);
        
        for (const status of syncConfig.statuses) {
          addLog(`Syncing orders with status ${status}...`);
          
          const syncOrders = httpsCallable(functions, 'syncOngoingOrdersByStatus');
          const result = await syncOrders({ 
            status, 
            limit: syncConfig.maxOrders 
          });
          
          const data = result.data as any;

          if (data.error) {
            addLog(`❌ Error syncing status ${status}: ${data.error}`);
            totalErrors++;
          } else {
            addLog(`✅ Synced ${data.totalSynced} orders with status ${status}`);
            totalSynced += data.totalSynced;
          }

          setSyncProgress(prev => ({ 
            ...prev, 
            syncedOrders: totalSynced,
            errors: totalErrors,
            progress: ((syncConfig.statuses.indexOf(status) + 1) / syncConfig.statuses.length) * 100
          }));
        }
      } else if (syncConfig.strategy === 'date-range') {
        if (!syncConfig.dateRange.start || !syncConfig.dateRange.end) {
          throw new Error('Please select both start and end dates for date-range sync');
        }
        
        addLog(`Using date-range sync from ${syncConfig.dateRange.start} to ${syncConfig.dateRange.end}`);
        
        const syncOrders = httpsCallable(functions, 'syncOngoingOrdersByDateRange');
        const result = await syncOrders({ 
          startDate: syncConfig.dateRange.start,
          endDate: syncConfig.dateRange.end,
          limit: syncConfig.maxOrders 
        });
        
        const data = result.data as any;

        if (data.error) {
          addLog(`❌ Error syncing date range: ${data.error}`);
          totalErrors++;
        } else {
          addLog(`✅ Synced ${data.totalSynced} orders in date range`);
          totalSynced += data.totalSynced;
        }

        setSyncProgress(prev => ({ 
          ...prev, 
          syncedOrders: totalSynced,
          errors: totalErrors,
          progress: 100
        }));
      }

      addLog(`✅ Ongoing WMS sync completed: ${totalSynced} orders synced, ${totalErrors} errors`);
    } catch (err: any) {
      addLog(`❌ Ongoing WMS sync error: ${err.message}`);
      throw err;
    }
  };

  const syncWooCommerce = async () => {
    addLog('Starting WooCommerce sync...');
    setSyncProgress(prev => ({ ...prev, currentStep: 'Syncing WooCommerce orders...' }));

    try {
      const { httpsCallable } = await import('firebase/functions');
      const { getFunctions } = await import('firebase/functions');
      const functions = getFunctions();

      const syncWooCommerceOrders = httpsCallable(functions, 'syncWooCommerceOrders');
      const result = await syncWooCommerceOrders();
      
      const data = result.data as any;

      if (data.error) {
        addLog(`❌ WooCommerce sync error: ${data.error}`);
      } else {
        addLog(`✅ WooCommerce sync completed: ${data.syncedCount} orders synced`);
      }
    } catch (err: any) {
      addLog(`❌ WooCommerce sync error: ${err.message}`);
      throw err;
    }
  };

  const stopSync = () => {
    setSyncProgress(prev => ({ ...prev, isRunning: false }));
    addLog('⏹️ Sync stopped by user');
  };

  const clearLogs = () => {
    setSyncProgress(prev => ({ ...prev, logs: [] }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Initial Data Sync</h2>
        <p className="text-gray-600 mt-2">Perform initial synchronization of orders and products from integrated systems</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Sync Configuration */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Sync Configuration</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Data Source */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Data Source</label>
            <select
              value={syncConfig.source}
              onChange={(e) => setSyncConfig({ ...syncConfig, source: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ongoing_wms">Ongoing WMS</option>
              <option value="woocommerce">WooCommerce</option>
              <option value="both">Both Systems</option>
            </select>
          </div>

          {/* Sync Strategy */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sync Strategy</label>
            <select
              value={syncConfig.strategy}
              onChange={(e) => setSyncConfig({ ...syncConfig, strategy: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="status-based">Status Based</option>
              <option value="date-range">Date Range</option>
            </select>
          </div>

          {/* Max Orders */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Max Orders per Status</label>
            <input
              type="number"
              value={syncConfig.maxOrders}
              onChange={(e) => setSyncConfig({ ...syncConfig, maxOrders: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="1"
              max="100"
            />
          </div>
        </div>

        {/* Status Selection - Only show when strategy is status-based */}
        {syncConfig.strategy === 'status-based' && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Statuses to Sync</label>
            <div className="space-y-2">
              {syncConfig.statuses.map((status, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={status}
                    onChange={(e) => {
                      const newStatuses = [...syncConfig.statuses];
                      newStatuses[index] = parseInt(e.target.value);
                      setSyncConfig({ ...syncConfig, statuses: newStatuses });
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Status number"
                  />
                  <button
                    onClick={() => {
                      const newStatuses = syncConfig.statuses.filter((_, i) => i !== index);
                      setSyncConfig({ ...syncConfig, statuses: newStatuses });
                    }}
                    className="px-3 py-2 text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                onClick={() => setSyncConfig({ ...syncConfig, statuses: [...syncConfig.statuses, 200] })}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                + Add Status
              </button>
            </div>
          </div>
        )}

        {/* Date Range Selection - Only show when strategy is date-range */}
        {syncConfig.strategy === 'date-range' && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Start Date</label>
                <input
                  type="date"
                  value={syncConfig.dateRange.start}
                  onChange={(e) => setSyncConfig({ 
                    ...syncConfig, 
                    dateRange: { ...syncConfig.dateRange, start: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">End Date</label>
                <input
                  type="date"
                  value={syncConfig.dateRange.end}
                  onChange={(e) => setSyncConfig({ 
                    ...syncConfig, 
                    dateRange: { ...syncConfig.dateRange, end: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-500">
              Select the date range for orders to sync. Orders created within this range will be included.
            </div>
          </div>
        )}
      </div>

      {/* Sync Controls */}
      <div className="flex items-center space-x-4">
        {!syncProgress.isRunning ? (
          <button
            onClick={startSync}
            disabled={syncProgress.isRunning}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2 disabled:opacity-50"
          >
            <Play className="w-5 h-5" />
            <span>Start Initial Sync</span>
          </button>
        ) : (
          <button
            onClick={stopSync}
            className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center space-x-2"
          >
            <Stop className="w-5 h-5" />
            <span>Stop Sync</span>
          </button>
        )}

        <button
          onClick={clearLogs}
          className="bg-gray-600 text-white px-4 py-3 rounded-lg hover:bg-gray-700 transition-colors duration-200 flex items-center space-x-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Clear Logs</span>
        </button>
      </div>

      {/* Progress Tracking */}
      {syncProgress.isRunning && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sync Progress</h3>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Progress</span>
                <span>{Math.round(syncProgress.progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${syncProgress.progress}%` }}
                ></div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{syncProgress.syncedOrders}</div>
                <div className="text-sm text-gray-600">Orders Synced</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{syncProgress.errors}</div>
                <div className="text-sm text-gray-600">Errors</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600">{syncProgress.currentStep}</div>
                <div className="text-xs text-gray-500">Current Step</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sync Logs */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Sync Logs</h3>
        
        <div className="bg-gray-50 rounded border p-4 h-64 overflow-y-auto font-mono text-sm">
          {syncProgress.logs.length === 0 ? (
            <p className="text-gray-500">No logs yet. Start a sync to see progress.</p>
          ) : (
            syncProgress.logs.map((log, index) => (
              <div key={index} className="text-gray-700 mb-1">
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Information Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="w-5 h-5 text-blue-400 mr-2 mt-0.5" />
          <div>
            <h4 className="text-blue-900 font-medium">Initial Sync Information</h4>
            <p className="text-blue-800 text-sm mt-1">
              Initial sync is used to populate your database with existing orders and products from 
              your integrated systems. This should only be run once when setting up the system or 
              when you need to backfill missing data. Regular updates are handled automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InitialSyncTab;
