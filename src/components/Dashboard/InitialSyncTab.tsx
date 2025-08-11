import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Target,
  BarChart3,
  CheckCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Database,
  Calendar,
  Clock,
  Package,
  ShoppingCart,
  Truck,
  FileText,
  Zap,
  Settings,
  Info,
  Trash2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface SyncConfig {
  source: 'woocommerce' | 'ongoing_wms' | 'both';
  strategy: 'known-orders-first' | 'date-range' | 'status-based';
  dateRange: 'last-7-days' | 'last-30-days' | 'last-90-days' | 'custom';
  maxOrders: number;
  knownOrderIds: string[];
  statuses: number[];
}

interface SyncProgress {
  isRunning: boolean;
  currentStep: string;
  progress: number;
  totalSteps: number;
  currentStepNumber: number;
  syncedOrders: number;
  errors: number;
  logs: string[];
}

const InitialSyncTab: React.FC = () => {
  const { user } = useAuth();
  const functions = getFunctions();
  const cancellationRef = useRef<boolean>(false);

  const [syncConfig, setSyncConfig] = useState<SyncConfig>({
    source: 'ongoing_wms',
    strategy: 'known-orders-first',
    dateRange: 'last-30-days',
    maxOrders: 50,
    knownOrderIds: ['214600', '216042'],
    statuses: [200, 210, 300, 320, 400, 450, 451]  // Multiple statuses to catch orders in different states
  });

  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    isRunning: false,
    currentStep: '',
    progress: 0,
    totalSteps: 0,
    currentStepNumber: 0,
    syncedOrders: 0,
    errors: 0,
    logs: []
  });

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const addLog = (message: string) => {
    setSyncProgress(prev => ({
      ...prev,
      logs: [...prev.logs, `${new Date().toLocaleTimeString()}: ${message}`]
    }));
  };

  const startSync = async () => {
    if (!user?.id) {
      setError('User not authenticated');
      return;
    }

    // Reset cancellation flag
    cancellationRef.current = false;

    setError(null);
    setSuccess(null);
    setSyncProgress({
      isRunning: true,
      currentStep: 'Initializing sync...',
      progress: 0,
      totalSteps: 0,
      currentStepNumber: 0,
      syncedOrders: 0,
      errors: 0,
      logs: []
    });

    addLog('Starting initial sync...');

    try {
      if (syncConfig.source === 'ongoing_wms' || syncConfig.source === 'both') {
        if (cancellationRef.current) {
          addLog('Sync cancelled by user');
          return;
        }
        await syncOngoingWMS();
      }

      if (syncConfig.source === 'woocommerce' || syncConfig.source === 'both') {
        if (cancellationRef.current) {
          addLog('Sync cancelled by user');
          return;
        }
        await syncWooCommerce();
      }

      if (!cancellationRef.current) {
        setSuccess('Initial sync completed successfully!');
        addLog('Initial sync completed successfully!');
      }
    } catch (err: any) {
      if (!cancellationRef.current) {
        setError(err.message || 'Sync failed');
        addLog(`Error: ${err.message}`);
      }
    } finally {
      setSyncProgress(prev => ({ ...prev, isRunning: false }));
    }
  };

  const syncOngoingWMS = async () => {
    addLog('Starting Ongoing WMS sync...');
    
    const totalStatuses = syncConfig.statuses.length;
    let totalSynced = 0;
    let totalErrors = 0;

    for (let i = 0; i < syncConfig.statuses.length; i++) {
      // Check for cancellation before each status
      if (cancellationRef.current) {
        addLog('Ongoing WMS sync cancelled by user');
        return;
      }

      const status = syncConfig.statuses[i];
      const progress = ((i + 1) / totalStatuses) * 100;
      
      setSyncProgress(prev => ({
        ...prev,
        currentStep: `Syncing orders with status ${status}...`,
        progress,
        currentStepNumber: i + 1,
        totalSteps: totalStatuses
      }));

      addLog(`Syncing orders with status ${status}...`);

      try {
        const syncOrders = httpsCallable(functions, 'syncOngoingOrdersByStatus');
        const result = await syncOrders({
          status,
          limit: Math.min(syncConfig.maxOrders, 10),  // Limit to 10 per status to avoid timeouts
          goodsOwnerId: 85
        });

        // Check for cancellation after the function call
        if (cancellationRef.current) {
          addLog('Ongoing WMS sync cancelled by user');
          return;
        }

        const data = result.data as any;
        if (data.success) {
          totalSynced += data.totalSynced;
          totalErrors += data.errors?.length || 0;
          addLog(`Status ${status}: Synced ${data.totalSynced} orders, ${data.errors?.length || 0} errors`);
        } else {
          totalErrors++;
          addLog(`Status ${status}: Failed to sync`);
        }
      } catch (err: any) {
        if (!cancellationRef.current) {
          totalErrors++;
          addLog(`Status ${status}: Error - ${err.message}`);
        }
      }
    }

    if (!cancellationRef.current) {
      setSyncProgress(prev => ({
        ...prev,
        syncedOrders: totalSynced,
        errors: totalErrors
      }));

      addLog(`Ongoing WMS sync completed: ${totalSynced} orders synced, ${totalErrors} errors`);
    }
  };

  const syncWooCommerce = async () => {
    addLog('Starting WooCommerce sync...');
    
    setSyncProgress(prev => ({
      ...prev,
      currentStep: 'Syncing WooCommerce orders...',
      progress: 50
    }));

    try {
      const syncOrders = httpsCallable(functions, 'syncWooCommerceOrders');
      const result = await syncOrders({
        statusFilter: 'processing,delvis-levert',
        dateRange: 'last-200-days'
      });

      // Check for cancellation after the function call
      if (cancellationRef.current) {
        addLog('WooCommerce sync cancelled by user');
        return;
      }

      const data = result.data as any;
      if (data.success) {
        addLog(`WooCommerce sync completed: ${data.syncedCount} orders synced`);
      } else {
        addLog('WooCommerce sync failed');
      }
    } catch (err: any) {
      if (!cancellationRef.current) {
        addLog(`WooCommerce sync error: ${err.message}`);
      }
    }
  };

  const stopSync = async () => {
    // Set cancellation flag
    cancellationRef.current = true;
    
    // Set cancellation flag in Firestore for the Firebase Function to check
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { getFirestore } = await import('firebase/firestore');
      const db = getFirestore();
      
      await setDoc(doc(db, 'syncCancellation', user?.id || 'unknown'), {
        cancelled: true,
        timestamp: new Date()
      });
    } catch (error) {
      console.log('Could not set cancellation flag:', error);
    }
    
    setSyncProgress(prev => ({ ...prev, isRunning: false }));
    addLog('Sync cancellation requested...');
    addLog('Note: Firebase Functions may continue running for a few seconds');
  };

  const clearLogs = () => {
    setSyncProgress(prev => ({ ...prev, logs: [] }));
  };

  const runDiagnostic = async () => {
    if (!user?.id) {
      setError('User not authenticated');
      return;
    }

    addLog('Running diagnostic on known orders...');

    try {
      const diagnoseOrders = httpsCallable(functions, 'diagnoseOngoingOrders');
      const result = await diagnoseOrders({
        orderIds: [214600, 216042]
      });

      const data = result.data as any;
      if (data.success) {
        addLog('Diagnostic results:');
        data.results.forEach((order: any) => {
          if (order.found) {
            addLog(`Order ${order.orderId}: Status ${order.status.number} (${order.status.text}) - ${order.orderLines} order lines`);
          } else {
            addLog(`Order ${order.orderId}: ${order.error}`);
          }
        });
      } else {
        addLog('Diagnostic failed');
      }
    } catch (err: any) {
      addLog(`Diagnostic error: ${err.message}`);
    }
  };

  const testSyncKnownOrders = async () => {
    if (!user?.id) {
      setError('User not authenticated');
      return;
    }

    // Use the first status from sync config, or default to 320
    const statusToTest = syncConfig.statuses.length > 0 ? syncConfig.statuses[0] : 320;
    
    addLog(`Testing sync with known orders only (status: ${statusToTest})...`);

    try {
      const testSync = httpsCallable(functions, 'testSyncKnownOrders');
      const result = await testSync({
        status: statusToTest
      });

      const data = result.data as any;
      if (data.success) {
        addLog(`Test sync completed: ${data.totalSynced} orders synced, ${data.errors.length} errors`);
        if (data.syncedOrders.length > 0) {
          addLog('Synced orders:');
          data.syncedOrders.forEach((order: any) => {
            addLog(`- Order ${order.orderId} (${order.orderNumber}): ${order.status}`);
          });
        }
        if (data.errors.length > 0) {
          addLog('Errors:');
          data.errors.forEach((error: any) => {
            addLog(`- Order ${error.orderId}: ${error.error}`);
          });
        }
      } else {
        addLog('Test sync failed');
      }
    } catch (err: any) {
      addLog(`Test sync error: ${err.message}`);
    }
  };

  const testOrder214600 = async () => {
    if (!user?.id) {
      setError('User not authenticated');
      return;
    }

    addLog('Testing ONLY order 214600...');

    try {
      const diagnoseOrders = httpsCallable(functions, 'diagnoseOngoingOrders');
      const result = await diagnoseOrders({
        orderIds: [214600]
      });

      const data = result.data as any;
      if (data.success) {
        addLog('Order 214600 diagnostic results:');
        data.results.forEach((order: any) => {
          if (order.found) {
            addLog(`Order ${order.orderId}: Status ${order.status.number} (${order.status.text}) - ${order.orderLines} order lines`);
            addLog(`Raw status data: ${JSON.stringify(order.rawStatus, null, 2)}`);
          } else {
            addLog(`Order ${order.orderId}: ${order.error}`);
          }
        });
      } else {
        addLog('Diagnostic failed');
      }
    } catch (err: any) {
      addLog(`Diagnostic error: ${err.message}`);
    }
  };

  const checkFirestoreOrders = async () => {
    if (!user?.id) {
      setError('User not authenticated');
      return;
    }

    addLog('Checking what orders are stored in Firestore...');

    try {
      const { collection, getDocs } = await import('firebase/firestore');
      const { getFirestore } = await import('firebase/firestore');
      const db = getFirestore();
      
      const ordersSnapshot = await getDocs(collection(db, 'ongoingOrders'));
      const orderLinesSnapshot = await getDocs(collection(db, 'ongoingOrderLines'));
      
      addLog(`Found ${ordersSnapshot.size} orders in ongoingOrders collection`);
      addLog(`Found ${orderLinesSnapshot.size} order lines in ongoingOrderLines collection`);
      
      addLog('Sample orders:');
      ordersSnapshot.forEach((doc) => {
        const data = doc.data();
        addLog(`Order ${doc.id}: ${data.orderNumber} - Status: ${data.orderStatus?.text || 'Unknown'} - Document ID: ${doc.id}`);
      });
      
      addLog('Sample order lines:');
      orderLinesSnapshot.forEach((doc) => {
        const data = doc.data();
        addLog(`Order line ${doc.id}: orderId="${data.orderId}", articleName="${data.articleName || 'N/A'}"`);
        addLog(`  Full data: ${JSON.stringify(data, null, 2)}`);
      });
      
    } catch (err: any) {
      addLog(`Firestore check error: ${err.message}`);
    }
  };

  const cleanupDuplicateOrders = async () => {
    if (!user?.id) {
      setError('User not authenticated');
      return;
    }

    addLog('Cleaning up duplicate orders...');

    try {
      const { collection, getDocs, doc, deleteDoc } = await import('firebase/firestore');
      const { getFirestore } = await import('firebase/firestore');
      const db = getFirestore();
      
      const ordersSnapshot = await getDocs(collection(db, 'ongoingOrders'));
      
      // Find orders with the same order number but different document IDs
      const orderNumberMap = new Map();
      const duplicatesToDelete = [];
      
      ordersSnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const orderNumber = data.orderNumber;
        
        if (orderNumberMap.has(orderNumber)) {
          // This is a duplicate - keep the one with the order number as document ID
          const existingDocId = orderNumberMap.get(orderNumber);
          const currentDocId = docSnapshot.id;
          
          if (existingDocId === orderNumber.toString()) {
            // Keep existing, delete current
            duplicatesToDelete.push(currentDocId);
          } else if (currentDocId === orderNumber.toString()) {
            // Keep current, delete existing
            duplicatesToDelete.push(existingDocId);
            orderNumberMap.set(orderNumber, currentDocId);
          } else {
            // Neither has order number as document ID, keep the first one
            duplicatesToDelete.push(currentDocId);
          }
        } else {
          orderNumberMap.set(orderNumber, docSnapshot.id);
        }
      });
      
      addLog(`Found ${duplicatesToDelete.length} duplicate orders to delete`);
      
      // Delete duplicates
      for (const docId of duplicatesToDelete) {
        await deleteDoc(doc(db, 'ongoingOrders', docId));
        addLog(`Deleted duplicate order document: ${docId}`);
      }
      
      addLog('Cleanup completed!');
      
    } catch (err: any) {
      addLog(`Cleanup error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Initial Sync</h2>
          <p className="text-gray-600 mt-1">Perform initial data synchronization from your integrated systems</p>
        </div>
        <div className="flex items-center space-x-3">
          {!syncProgress.isRunning ? (
            <>
              <button
                onClick={runDiagnostic}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200 flex items-center space-x-2"
              >
                <Target className="w-4 h-4" />
                <span>Diagnostic</span>
              </button>
              <button
                onClick={testOrder214600}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors duration-200 flex items-center space-x-2"
              >
                <Target className="w-4 h-4" />
                <span>Test 214600</span>
              </button>
                        <button
            onClick={checkFirestoreOrders}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center space-x-2"
          >
            <Database className="w-4 h-4" />
            <span>Check DB</span>
          </button>
          <button
            onClick={async () => {
              if (!user?.id) {
                setError('User not authenticated');
                return;
              }
              addLog('Cleaning up duplicate orders...');
              try {
                const { collection, getDocs, doc, deleteDoc } = await import('firebase/firestore');
                const { getFirestore } = await import('firebase/firestore');
                const db = getFirestore();
                const ordersSnapshot = await getDocs(collection(db, 'ongoingOrders'));
                const orderNumberMap: Map<string, string> = new Map();
                const duplicatesToDelete: string[] = [];
                ordersSnapshot.forEach((docSnapshot) => {
                  const data = docSnapshot.data();
                  const orderNumber = data.orderNumber;
                  if (orderNumberMap.has(orderNumber)) {
                    const existingDocId = orderNumberMap.get(orderNumber);
                    const currentDocId = docSnapshot.id;
                    if (existingDocId && existingDocId === orderNumber.toString()) {
                      duplicatesToDelete.push(currentDocId);
                    } else if (currentDocId === orderNumber.toString()) {
                      if (existingDocId) {
                        duplicatesToDelete.push(existingDocId);
                      }
                      orderNumberMap.set(orderNumber, currentDocId);
                    } else {
                      duplicatesToDelete.push(currentDocId);
                    }
                  } else {
                    orderNumberMap.set(orderNumber, docSnapshot.id);
                  }
                });
                addLog(`Found ${duplicatesToDelete.length} duplicate orders to delete`);
                for (const docId of duplicatesToDelete) {
                  await deleteDoc(doc(db, 'ongoingOrders', docId));
                  addLog(`Deleted duplicate order document: ${docId}`);
                }
                addLog('Cleanup completed!');
              } catch (err: any) {
                addLog(`Cleanup error: ${err.message}`);
              }
            }}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center space-x-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>Cleanup Duplicates</span>
          </button>
              <button
                onClick={testSyncKnownOrders}
                className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors duration-200 flex items-center space-x-2"
              >
                <Package className="w-4 h-4" />
                <span>Test Sync</span>
              </button>
              <button
                onClick={startSync}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2"
              >
                <Play className="w-4 h-4" />
                <span>Start Sync</span>
              </button>
            </>
          ) : (
            <button
              onClick={stopSync}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center space-x-2"
            >
              <Pause className="w-4 h-4" />
              <span>Stop Sync</span>
            </button>
          )}
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <div className="text-red-800 text-sm">{error}</div>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div className="text-green-800 text-sm">{success}</div>
          </div>
        </div>
      )}

      {/* Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sync Configuration */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Settings className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Sync Configuration</h3>
              <p className="text-sm text-gray-600">Configure your initial sync strategy</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Source Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Data Source</label>
              <select
                value={syncConfig.source}
                onChange={(e) => setSyncConfig({ ...syncConfig, source: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ongoing_wms">Ongoing WMS Only</option>
                <option value="woocommerce">WooCommerce Only</option>
                <option value="both">Both Sources</option>
              </select>
            </div>

            {/* Strategy Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sync Strategy</label>
              <select
                value={syncConfig.strategy}
                onChange={(e) => setSyncConfig({ ...syncConfig, strategy: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="known-orders-first">Known Orders First</option>
                <option value="date-range">Date Range</option>
                <option value="status-based">Status Based</option>
              </select>
            </div>

            {/* Max Orders */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Max Orders per Status</label>
              <input
                type="number"
                value={syncConfig.maxOrders}
                onChange={(e) => setSyncConfig({ ...syncConfig, maxOrders: parseInt(e.target.value) })}
                min="1"
                max="100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Status Selection - Only show when strategy is status-based */}
            {syncConfig.strategy === 'status-based' && (
              <div>
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

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <select
                value={syncConfig.dateRange}
                onChange={(e) => setSyncConfig({ ...syncConfig, dateRange: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="last-7-days">Last 7 Days</option>
                <option value="last-30-days">Last 30 Days</option>
                <option value="last-90-days">Last 90 Days</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
          </div>
        </div>

        {/* Progress Tracking */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Sync Progress</h3>
              <p className="text-sm text-gray-600">Track your sync progress</p>
            </div>
          </div>

          {syncProgress.isRunning ? (
            <div className="space-y-4">
              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-sm text-gray-600 mb-2">
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

              {/* Current Step */}
              <div>
                <p className="text-sm font-medium text-gray-700">Current Step</p>
                <p className="text-sm text-gray-600">{syncProgress.currentStep}</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">Synced Orders</p>
                  <p className="text-2xl font-bold text-green-600">{syncProgress.syncedOrders}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Errors</p>
                  <p className="text-2xl font-bold text-red-600">{syncProgress.errors}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No sync in progress</p>
            </div>
          )}
        </div>
      </div>

      {/* Sync Logs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Sync Logs</h3>
              <p className="text-sm text-gray-600">Detailed sync activity logs</p>
            </div>
          </div>
          <button
            onClick={clearLogs}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            Clear Logs
          </button>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 h-64 overflow-y-auto">
          {syncProgress.logs.length > 0 ? (
            <div className="space-y-1">
              {syncProgress.logs.map((log, index) => (
                <div key={index} className="text-sm font-mono text-gray-700">
                  {log}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Info className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600">No logs yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Information Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start space-x-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="text-blue-900 font-medium mb-2">About Initial Sync</h4>
            <div className="text-blue-800 text-sm space-y-2">
              <p>• <strong>Initial Sync</strong> is a one-time process to populate your database with existing orders</p>
              <p>• <strong>Maintenance Sync</strong> runs automatically in the background to keep data up-to-date</p>
              <p>• <strong>Recommended Strategy</strong>: Start with "Known Orders First" for Ongoing WMS</p>
              <p>• <strong>Time Estimate</strong>: 2-5 minutes depending on data volume</p>
              <p>• <strong>Safe to Run</strong>: Can be stopped and restarted at any time</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InitialSyncTab;
