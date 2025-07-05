import React from 'react';
import NetworkDiagnostics from '../components/NetworkDiagnostics';

const NetworkDiagnosticsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Firebase Network Diagnostics</h1>
        
        <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">About This Tool</h2>
          <p className="text-gray-700 mb-4">
            This diagnostic tool tests your network's ability to connect to Firebase and Google Cloud services.
            It can help identify connectivity issues that might prevent Firebase authentication, deployment, or other operations.
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-800 mb-2">Common Network Issues:</h3>
            <ul className="text-sm text-blue-700 space-y-1 list-disc pl-5">
              <li>Firewall blocking access to Google Cloud/Firebase domains</li>
              <li>Proxy server requiring authentication or modifying requests</li>
              <li>DNS resolution problems</li>
              <li>Corporate network restrictions</li>
              <li>VPN interference</li>
            </ul>
          </div>
        </div>
        
        <NetworkDiagnostics showDetailed={true} />
        
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Next Steps</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="text-md font-medium text-gray-800">If Tests Show Network Issues:</h3>
              <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5 mt-2">
                <li>Try a different network connection (e.g., mobile hotspot)</li>
                <li>Disable any VPN services you might be using</li>
                <li>If on a corporate network, contact your IT department to whitelist Firebase domains</li>
                <li>Try using a different DNS resolver (e.g., 8.8.8.8 or 1.1.1.1)</li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-md font-medium text-gray-800">Alternative Deployment Options:</h3>
              <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5 mt-2">
                <li>Deploy from a different network environment</li>
                <li>Use the Firebase REST API instead of the CLI</li>
                <li>Consider alternative hosting providers if Firebase remains inaccessible</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkDiagnosticsPage;