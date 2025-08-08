import React, { useState } from 'react';
import { LogIn, Mail, Lock, AlertCircle, Loader2, Wifi, WifiOff, Globe } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { testFirebaseConnectivity } from '../lib/networkTest';

const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('admin@logistics.com');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState('');
  const [isTestingConnectivity, setIsTestingConnectivity] = useState(false);
  const [connectivityStatus, setConnectivityStatus] = useState<{
    success?: boolean;
    message?: string;
    details?: any;
  }>({});
  const { login, isLoading } = useAuth();

  // Test Firebase connectivity when component mounts
  React.useEffect(() => {
    const checkConnectivity = async () => {
      setIsTestingConnectivity(true);
      try {
        const result = await testFirebaseConnectivity();
        setConnectivityStatus(result);
        console.log('Connectivity test result:', result);
      } catch (err) {
        console.error('Error testing connectivity:', err);
        setConnectivityStatus({
          success: false,
          message: 'Error testing connectivity: ' + ((err as Error).message || 'Unknown error')
        });
      } finally {
        setIsTestingConnectivity(false);
      }
    };

    checkConnectivity();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const success = await login(email, password);
    if (!success) {
      setError('Invalid email or password');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="bg-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <LogIn className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Welcome Back</h1>
            <p className="text-gray-600 mt-2">Sign in to your logistics dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>

            {/* Connectivity Status */}
            {(isTestingConnectivity || connectivityStatus.message) && (
              <div className={`flex items-center space-x-2 p-3 rounded-lg ${
                isTestingConnectivity 
                  ? 'bg-blue-50 text-blue-600' 
                  : connectivityStatus.success 
                    ? 'bg-green-50 text-green-600'
                    : 'bg-yellow-50 text-yellow-600'
              }`}>
                {isTestingConnectivity ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Testing network connectivity...</span>
                  </>
                ) : connectivityStatus.success ? (
                  <>
                    <Wifi className="w-5 h-5" />
                    <span className="text-sm">{connectivityStatus.message}</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-5 h-5" />
                    <span className="text-sm">{connectivityStatus.message}</span>
                  </>
                )}
              </div>
            )}

            {error && (
              <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || isTestingConnectivity}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 font-medium flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <div className="text-sm text-gray-600 mb-2">Demo Credentials:</div>
            <div className="text-xs text-gray-500 space-y-1">
              <div>Admin: admin@logistics.com / password</div>
              <div>Manager: manager@logistics.com / password</div>
              <div>Operator: operator@logistics.com / password</div>
            </div>
          </div>
          
          {/* Network Diagnostics */}
          {!connectivityStatus.success && connectivityStatus.details && (
            <div className="mt-6 border-t border-gray-200 pt-6">
              <div className="text-sm font-medium text-gray-700 mb-2">Network Diagnostics:</div>
              <div className="text-xs text-gray-600 space-y-1">
                {Object.entries(connectivityStatus.details.endpoints || {}).map(([endpoint, reachable]) => (
                  <div key={endpoint} className="flex items-center space-x-2">
                    {reachable ? (
                      <Wifi className="w-3 h-3 text-green-500" />
                    ) : (
                      <WifiOff className="w-3 h-3 text-red-500" />
                    )}
                    <span>{endpoint}: {reachable ? 'Reachable' : 'Unreachable'}</span>
                  </div>
                ))}
                
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                  >
                    Retry Connectivity Test
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginForm;