import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  Globe, 
  Server, 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw,
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { runConnectivityTests } from '../lib/connectivityTest';
import { testFirebaseConnectivity } from '../lib/networkTest';

interface NetworkDiagnosticsProps {
  projectId?: string;
  onClose?: () => void;
  showDetailed?: boolean;
}

const NetworkDiagnostics: React.FC<NetworkDiagnosticsProps> = ({ 
  projectId = 'order-flow-bolt',
  onClose,
  showDetailed = false
}) => {
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(showDetailed);
  const [showRecommendations, setShowRecommendations] = useState(true);

  const runTests = async () => {
    setIsRunningTests(true);
    setTestResults(null);
    
    try {
      // Run both test suites
      const [connectivityResults, firebaseResults] = await Promise.all([
        runConnectivityTests(projectId),
        testFirebaseConnectivity(projectId)
      ]);
      
      // Combine results
      setTestResults({
        ...connectivityResults,
        firebaseSpecific: firebaseResults
      });
    } catch (error) {
      console.error('Error running network tests:', error);
      setTestResults({
        overallStatus: 'failure',
        message: `Error running tests: ${(error as Error).message || 'Unknown error'}`,
        timestamp: new Date().toISOString(),
        error: (error as Error).message || 'Unknown error'
      });
    } finally {
      setIsRunningTests(false);
    }
  };

  // Run tests on component mount
  useEffect(() => {
    runTests();
  }, []);

  if (!testResults && !isRunningTests) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Server className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-medium text-gray-900">Network Diagnostics</h3>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={runTests}
            disabled={isRunningTests}
            className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50 transition-colors"
            title="Run tests again"
          >
            <RefreshCw className={`w-5 h-5 ${isRunningTests ? 'animate-spin' : ''}`} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-colors"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {isRunningTests ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
            <p className="text-gray-700">Running network diagnostics...</p>
            <p className="text-sm text-gray-500 mt-2">Testing connectivity to Firebase and other services</p>
          </div>
        ) : testResults ? (
          <div className="space-y-6">
            {/* Overall Status */}
            <div className={`p-4 rounded-lg ${
              testResults.overallStatus === 'success' ? 'bg-green-50 border border-green-200' :
              testResults.overallStatus === 'partial' ? 'bg-yellow-50 border border-yellow-200' :
              'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-start space-x-3">
                {testResults.overallStatus === 'success' ? (
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                ) : testResults.overallStatus === 'partial' ? (
                  <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
                ) : (
                  <WifiOff className="w-6 h-6 text-red-600 flex-shrink-0" />
                )}
                <div>
                  <h4 className={`font-medium ${
                    testResults.overallStatus === 'success' ? 'text-green-800' :
                    testResults.overallStatus === 'partial' ? 'text-yellow-800' :
                    'text-red-800'
                  }`}>
                    {testResults.overallStatus === 'success' ? 'Network Connectivity: Good' :
                     testResults.overallStatus === 'partial' ? 'Network Connectivity: Partial' :
                     'Network Connectivity: Failed'}
                  </h4>
                  <p className={`text-sm mt-1 ${
                    testResults.overallStatus === 'success' ? 'text-green-700' :
                    testResults.overallStatus === 'partial' ? 'text-yellow-700' :
                    'text-red-700'
                  }`}>
                    {testResults.message}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Test completed at: {new Date(testResults.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Connectivity Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`p-4 rounded-lg border ${
                testResults.internetConnectivity ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Globe className={`w-5 h-5 ${
                      testResults.internetConnectivity ? 'text-green-600' : 'text-red-600'
                    }`} />
                    <h5 className="font-medium text-gray-900">Internet</h5>
                  </div>
                  {testResults.internetConnectivity ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-red-600" />
                  )}
                </div>
                <p className="text-sm mt-2 text-gray-700">
                  {testResults.internetConnectivity 
                    ? 'Public internet is accessible' 
                    : 'Cannot reach public internet'}
                </p>
              </div>

              <div className={`p-4 rounded-lg border ${
                testResults.firebaseConnectivity ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Server className={`w-5 h-5 ${
                      testResults.firebaseConnectivity ? 'text-green-600' : 'text-red-600'
                    }`} />
                    <h5 className="font-medium text-gray-900">Firebase</h5>
                  </div>
                  {testResults.firebaseConnectivity ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-red-600" />
                  )}
                </div>
                <p className="text-sm mt-2 text-gray-700">
                  {testResults.firebaseConnectivity 
                    ? 'Firebase services are reachable' 
                    : 'Cannot reach Firebase services'}
                </p>
              </div>

              <div className={`p-4 rounded-lg border ${
                testResults.behindProxy ? 'border-yellow-200 bg-yellow-50' : 'border-green-200 bg-green-50'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Shield className={`w-5 h-5 ${
                      testResults.behindProxy ? 'text-yellow-600' : 'text-green-600'
                    }`} />
                    <h5 className="font-medium text-gray-900">Network</h5>
                  </div>
                  {testResults.behindProxy ? (
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  )}
                </div>
                <p className="text-sm mt-2 text-gray-700">
                  {testResults.behindProxy 
                    ? 'Behind proxy or firewall' 
                    : 'Direct connection detected'}
                </p>
              </div>
            </div>

            {/* Recommendations */}
            {testResults.recommendations && testResults.recommendations.length > 0 && (
              <div className="mt-4">
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setShowRecommendations(!showRecommendations)}
                >
                  <h4 className="font-medium text-gray-900">Recommendations</h4>
                  {showRecommendations ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </div>
                
                {showRecommendations && (
                  <div className="mt-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <ul className="space-y-2 text-sm text-blue-800">
                      {testResults.recommendations.map((recommendation: string, index: number) => (
                        <li key={index} className="flex items-start space-x-2">
                          <span className="inline-block w-4 h-4 rounded-full bg-blue-200 text-blue-800 flex-shrink-0 text-xs flex items-center justify-center mt-0.5">
                            {index + 1}
                          </span>
                          <span>{recommendation}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Detailed Results */}
            <div className="mt-4">
              <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowDetails(!showDetails)}
              >
                <h4 className="font-medium text-gray-900">Detailed Results</h4>
                {showDetails ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
              </div>
              
              {showDetails && testResults.endpoints && (
                <div className="mt-2 overflow-hidden border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Endpoint</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Latency</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {Object.entries(testResults.endpoints).map(([name, data]: [string, any]) => (
                        <tr key={name} className={data.success ? '' : 'bg-red-50'}>
                          <td className="px-4 py-3 text-sm text-gray-900">{name}</td>
                          <td className="px-4 py-3">
                            {data.success ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                {data.status ? data.status : 'OK'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                <WifiOff className="w-3 h-3 mr-1" />
                                Failed
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {data.latency ? `${data.latency}ms` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {data.error || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {showDetails && testResults.proxyEvidence && testResults.proxyEvidence.length > 0 && (
                <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <h5 className="font-medium text-yellow-800 mb-2">Proxy/Firewall Evidence:</h5>
                  <ul className="space-y-1 text-sm text-yellow-800">
                    {testResults.proxyEvidence.map((evidence: string, index: number) => (
                      <li key={index}>• {evidence}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={runTests}
                disabled={isRunningTests}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isRunningTests ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Running Tests...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Run Tests Again
                  </>
                )}
              </button>
              
              <a
                href="https://firebase.google.com/docs/hosting/troubleshooting"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
              >
                Firebase Troubleshooting
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8">
            <AlertTriangle className="w-10 h-10 text-red-600 mb-4" />
            <p className="text-gray-700">Failed to run network diagnostics</p>
            <button
              onClick={runTests}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NetworkDiagnostics;