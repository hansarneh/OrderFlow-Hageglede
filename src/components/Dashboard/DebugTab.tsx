import React, { useState } from 'react';
import { 
  Database, 
  RefreshCw, 
  Search, 
  Wrench, 
  Trash2, 
  Play,
  Info,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const DebugTab: React.FC = () => {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `${timestamp}: ${message}`]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const testSyncKnownOrders = async () => {
    if (!user?.id) {
      setError('User not authenticated');
      return;
    }
    addLog('Testing sync with known orders...');
    try {
      const { httpsCallable } = await import('firebase/functions');
      const { getFunctions } = await import('firebase/functions');
      const functions = getFunctions();
      
      const testSync = httpsCallable(functions, 'testSyncKnownOrders');
      const result = await testSync({ status: 450 });
      
      const data = result.data as any;
      if (data.success) {
        addLog(`✅ Test sync completed: ${data.totalSynced} orders synced, ${data.totalErrors} errors`);
      } else {
        addLog(`❌ Test sync failed: ${data.error}`);
      }
    } catch (err: any) {
      addLog(`❌ Test sync error: ${err.message}`);
    }
  };

  const runDiagnostic = async () => {
    if (!user?.id) {
      setError('User not authenticated');
      return;
    }
    addLog('Running diagnostic on known orders...');
    try {
      const { httpsCallable } = await import('firebase/functions');
      const { getFunctions } = await import('firebase/functions');
      const functions = getFunctions();
      
      const diagnose = httpsCallable(functions, 'diagnoseOngoingOrders');
      const result = await diagnose({ orderIds: [214600, 216042] });
      
      const data = result.data as any;
      if (data.success) {
        addLog(`✅ Diagnostic completed: ${data.orders.length} orders checked`);
        data.orders.forEach((order: any) => {
          addLog(`  Order ${order.orderId}: Status ${order.status} (${order.statusText})`);
        });
      } else {
        addLog(`❌ Diagnostic failed: ${data.error}`);
      }
    } catch (err: any) {
      addLog(`❌ Diagnostic error: ${err.message}`);
    }
  };

  const testOrder214600 = async () => {
    if (!user?.id) {
      setError('User not authenticated');
      return;
    }
    addLog('Testing order 214600 specifically...');
    try {
      const { httpsCallable } = await import('firebase/functions');
      const { getFunctions } = await import('firebase/functions');
      const functions = getFunctions();
      
      const diagnose = httpsCallable(functions, 'diagnoseOngoingOrders');
      const result = await diagnose({ orderIds: [214600] });
      
      const data = result.data as any;
      if (data.success) {
        addLog(`✅ Order 214600 diagnostic: ${data.orders[0]?.status || 'Unknown'}`);
      } else {
        addLog(`❌ Order 214600 diagnostic failed: ${data.error}`);
      }
    } catch (err: any) {
      addLog(`❌ Order 214600 test error: ${err.message}`);
    }
  };

  const checkFirestoreOrders = async () => {
    if (!user?.id) {
      setError('User not authenticated');
      return;
    }
    addLog('Checking Firestore orders and order lines...');
    try {
      const { collection, getDocs } = await import('firebase/firestore');
      const { getFirestore } = await import('firebase/firestore');
      const db = getFirestore();
      
      const ordersSnapshot = await getDocs(collection(db, 'ongoingOrders'));
      const orderLinesSnapshot = await getDocs(collection(db, 'ongoingOrderLines'));
      
      addLog(`Found ${ordersSnapshot.size} orders and ${orderLinesSnapshot.size} order lines in Firestore`);
      
      if (ordersSnapshot.size > 0) {
        const sampleOrder = ordersSnapshot.docs[0].data();
        addLog(`Sample order structure:`, sampleOrder);
      }
    } catch (err: any) {
      addLog(`❌ Check Firestore error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Debug Tools</h2>
        <p className="text-gray-600 mt-2">Development and debugging tools for troubleshooting Ongoing WMS integration</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Debug Tools */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <button
          onClick={testSyncKnownOrders}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2"
        >
          <Play className="w-4 h-4" />
          <span>Test Sync Known Orders</span>
        </button>

        <button
          onClick={runDiagnostic}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center space-x-2"
        >
          <Search className="w-4 h-4" />
          <span>Run Diagnostic</span>
        </button>

        <button
          onClick={testOrder214600}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors duration-200 flex items-center space-x-2"
        >
          <Info className="w-4 h-4" />
          <span>Test Order 214600</span>
        </button>

        <button
          onClick={checkFirestoreOrders}
          className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors duration-200 flex items-center space-x-2"
        >
          <Database className="w-4 h-4" />
          <span>Check Firestore Data</span>
        </button>

        <button
          onClick={async () => {
            if (!user?.id) {
              setError('User not authenticated');
              return;
            }
            addLog('Checking Ongoing WMS order data structure...');
            try {
              const { httpsCallable } = await import('firebase/functions');
              const { getFunctions } = await import('firebase/functions');
              const functions = getFunctions();
              
              // Use the new debug function
              const debugOrder = httpsCallable(functions, 'debugOrderData');
              const result = await debugOrder({ orderId: 214600 });
              
              const data = result.data as any;
              if (data.success) {
                addLog('Order 214600 data structure:');
                addLog(`  📊 Debug Info:`, JSON.stringify(data.debugInfo, null, 2));
                addLog(`  📊 Full Order Data:`, JSON.stringify(data.fullOrderData, null, 2));
              } else {
                addLog(`❌ Failed to get order data: ${data.error}`);
              }
            } catch (err: any) {
              addLog(`❌ Check order structure error: ${err.message}`);
            }
          }}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors duration-200 flex items-center space-x-2"
        >
          <Search className="w-4 h-4" />
          <span>Check Order Structure</span>
        </button>
      </div>

      {/* Debug Logs */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Debug Logs</h3>
          <button
            onClick={clearLogs}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            Clear Logs
          </button>
        </div>
        
        <div className="bg-white rounded border p-4 h-64 overflow-y-auto font-mono text-sm">
          {logs.length === 0 ? (
            <p className="text-gray-500">No logs yet. Run a debug tool to see output.</p>
          ) : (
            logs.map((log, index) => (
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
            <h4 className="text-blue-900 font-medium">Debug Information</h4>
            <p className="text-blue-800 text-sm mt-1">
              These tools are for development and debugging purposes only. Use them to troubleshoot 
              Ongoing WMS integration issues, test API connections, and verify data synchronization.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebugTab;
