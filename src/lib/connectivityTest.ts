/**
 * Comprehensive network connectivity test utility
 * Tests connectivity to various services and endpoints
 */

/**
 * Tests connectivity to a specific URL with detailed diagnostics
 */
export async function testEndpoint(
  url: string, 
  options: {
    name: string;
    timeout?: number;
    method?: 'HEAD' | 'GET';
    headers?: Record<string, string>;
  }
): Promise<{
  name: string;
  url: string;
  success: boolean;
  status?: number;
  latency?: number;
  error?: string;
  errorType?: string;
  responseSize?: number;
}> {
  const { name, timeout = 5000, method = 'HEAD', headers = {} } = options;
  const startTime = Date.now();
  
  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    // Make the request
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      credentials: 'omit', // Don't send credentials to avoid CORS issues
      headers: {
        'User-Agent': 'OrderFlow-Hageglede-ConnectivityTest/1.0',
        ...headers
      }
    });
    
    // Clear timeout
    clearTimeout(timeoutId);
    
    // Calculate latency
    const latency = Date.now() - startTime;
    
    // Get response size if it's a GET request
    let responseSize;
    if (method === 'GET' && response.ok) {
      const text = await response.text();
      responseSize = text.length;
    }
    
    return {
      name,
      url,
      success: true,
      status: response.status,
      latency,
      responseSize
    };
  } catch (error) {
    // Calculate latency even for errors
    const latency = Date.now() - startTime;
    
    // Determine error type
    let errorType = 'unknown';
    let errorMessage = (error as Error).message || 'Unknown error';
    
    if ((error as Error).name === 'AbortError') {
      errorType = 'timeout';
      errorMessage = `Request timed out after ${timeout}ms`;
    } else if (error instanceof TypeError) {
      if (error.message.includes('Failed to fetch')) {
        errorType = 'network';
        errorMessage = 'Network error: Failed to fetch. This usually indicates a network connectivity issue.';
      } else {
        errorType = 'type';
      }
    } else if (error instanceof DOMException) {
      errorType = 'dom';
    }
    
    return {
      name,
      url,
      success: false,
      latency,
      error: errorMessage,
      errorType
    };
  }
}

/**
 * Tests DNS resolution by attempting to fetch a resource with a unique subdomain
 * This helps identify if DNS resolution is working properly
 */
export async function testDnsResolution(): Promise<{
  success: boolean;
  latency?: number;
  error?: string;
}> {
  const timestamp = Date.now();
  const uniqueSubdomain = `dns-test-${timestamp}`;
  const url = `https://${uniqueSubdomain}.cloudflaressl.com/cdn-cgi/trace`;
  
  const startTime = Date.now();
  
  try {
    await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(3000), // 3 second timeout
      credentials: 'omit'
    });
    
    // This should always fail with a DNS error, so if we get here, something is wrong
    return {
      success: false,
      latency: Date.now() - startTime,
      error: 'DNS resolution succeeded for a non-existent domain, which indicates DNS hijacking or other network issues'
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    
    // Check if it's a DNS error (name not resolved)
    if (error instanceof TypeError && 
        (error.message.includes('Failed to fetch') || 
         error.message.includes('Network error'))) {
      // This is expected - DNS resolution failed for a non-existent domain
      return {
        success: true,
        latency
      };
    }
    
    // Any other error is unexpected
    return {
      success: false,
      latency,
      error: `Unexpected error during DNS test: ${(error as Error).message || 'Unknown error'}`
    };
  }
}

/**
 * Tests if the client is behind a proxy or firewall that modifies requests
 */
export async function testForProxy(): Promise<{
  behindProxy: boolean;
  evidence: string[];
}> {
  const evidence: string[] = [];
  
  try {
    // Test 1: Check for common proxy headers in the response
    const response = await fetch('https://www.cloudflare.com/cdn-cgi/trace', {
      method: 'GET',
      credentials: 'omit',
      signal: AbortSignal.timeout(5000)
    });
    
    if (response.ok) {
      const text = await response.text();
      
      // Check for proxy indicators in the response
      if (text.includes('proxy=1') || text.includes('proxy=true')) {
        evidence.push('Proxy indicator found in response');
      }
      
      // Check for unexpected IP address
      const ipMatch = text.match(/ip=([0-9.]+)/);
      if (ipMatch && (ipMatch[1].startsWith('10.') || ipMatch[1].startsWith('172.16.') || ipMatch[1].startsWith('192.168.'))) {
        evidence.push(`Private IP address detected: ${ipMatch[1]}`);
      }
    }
    
    // Test 2: Check for header modifications
    const customHeaderValue = `test-${Date.now()}`;
    const response2 = await fetch('https://httpbin.org/headers', {
      method: 'GET',
      headers: {
        'X-Custom-Test-Header': customHeaderValue
      },
      credentials: 'omit',
      signal: AbortSignal.timeout(5000)
    });
    
    if (response2.ok) {
      const data = await response2.json();
      const headers = data.headers || {};
      
      // Check if our custom header was modified or removed
      if (!headers['X-Custom-Test-Header'] || headers['X-Custom-Test-Header'] !== customHeaderValue) {
        evidence.push('Custom header was modified or removed, indicating a proxy');
      }
      
      // Check for proxy-related headers
      const proxyHeaders = [
        'Via',
        'X-Forwarded-For',
        'X-Forwarded-Host',
        'X-Forwarded-Proto',
        'Forwarded',
        'X-Real-IP',
        'Proxy-Connection'
      ];
      
      for (const header of proxyHeaders) {
        if (headers[header]) {
          evidence.push(`Proxy header detected: ${header}: ${headers[header]}`);
        }
      }
    }
  } catch (error) {
    // If tests fail, we can't determine if there's a proxy
    evidence.push(`Proxy test failed: ${(error as Error).message || 'Unknown error'}`);
  }
  
  return {
    behindProxy: evidence.length > 0,
    evidence
  };
}

/**
 * Runs a comprehensive connectivity test suite
 */
export async function runConnectivityTests(projectId: string = 'order-flow-bolt'): Promise<{
  overallStatus: 'success' | 'partial' | 'failure';
  message: string;
  timestamp: string;
  internetConnectivity: boolean;
  firebaseConnectivity: boolean;
  dnsResolution: boolean;
  behindProxy: boolean;
  endpoints: Record<string, {
    success: boolean;
    status?: number;
    latency?: number;
    error?: string;
  }>;
  proxyEvidence?: string[];
  recommendations: string[];
}> {
  const timestamp = new Date().toISOString();
  const recommendations: string[] = [];
  
  // Define endpoints to test
  const endpointsToTest = [
    // Public internet endpoints
    { name: 'Cloudflare', url: 'https://www.cloudflare.com/cdn-cgi/trace', method: 'GET' },
    { name: 'Google', url: 'https://www.google.com', method: 'HEAD' },
    
    // Firebase/Google Cloud endpoints
    { name: 'Firebase Auth', url: 'https://identitytoolkit.googleapis.com/v1/projects', method: 'HEAD' },
    { name: 'Google Auth', url: 'https://oauth2.googleapis.com/token', method: 'HEAD' },
    { name: 'Firebase API', url: `https://firebase.googleapis.com/v1beta1/projects/${projectId}`, method: 'HEAD' },
    { name: 'Firestore API', url: `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`, method: 'HEAD' },
    { name: 'Cloud Functions', url: `https://cloudfunctions.googleapis.com/v1/projects/${projectId}/locations/-/functions`, method: 'HEAD' }
  ];
  
  // Run all tests in parallel
  const [endpointResults, dnsResult, proxyResult] = await Promise.all([
    // Test all endpoints
    Promise.all(endpointsToTest.map(endpoint => 
      testEndpoint(endpoint.url, {
        name: endpoint.name,
        method: endpoint.method as 'HEAD' | 'GET'
      })
    )),
    
    // Test DNS resolution
    testDnsResolution(),
    
    // Test for proxy
    testForProxy()
  ]);
  
  // Process results
  const endpoints: Record<string, any> = {};
  endpointResults.forEach(result => {
    endpoints[result.name] = {
      success: result.success,
      status: result.status,
      latency: result.latency,
      error: result.error
    };
  });
  
  // Determine overall connectivity status
  const publicEndpoints = endpointResults.filter(r => r.name === 'Cloudflare' || r.name === 'Google');
  const firebaseEndpoints = endpointResults.filter(r => r.name !== 'Cloudflare' && r.name !== 'Google');
  
  const internetConnectivity = publicEndpoints.some(r => r.success);
  const firebaseConnectivity = firebaseEndpoints.some(r => r.success);
  
  let overallStatus: 'success' | 'partial' | 'failure' = 'failure';
  let message = 'Unable to determine connectivity status';
  
  if (internetConnectivity && firebaseConnectivity) {
    overallStatus = 'success';
    message = 'Network connectivity looks good. You can connect to both public internet and Firebase services.';
  } else if (internetConnectivity && !firebaseConnectivity) {
    overallStatus = 'partial';
    message = 'You have internet connectivity, but cannot reach Firebase services. This suggests a firewall or proxy issue specifically blocking Google services.';
    
    recommendations.push('Check if your network has a firewall blocking access to *.googleapis.com domains');
    recommendations.push('If you\'re behind a corporate network, ask your IT department to whitelist Firebase/Google Cloud domains');
    recommendations.push('Try using a different network connection if possible');
  } else if (!internetConnectivity) {
    overallStatus = 'failure';
    message = 'No internet connectivity detected. You cannot reach any external services.';
    
    recommendations.push('Check your internet connection');
    recommendations.push('If you\'re using a VPN, try disconnecting it');
    recommendations.push('Verify that your browser has network access');
  }
  
  // Add recommendations based on proxy detection
  if (proxyResult.behindProxy) {
    recommendations.push('Your connection appears to be behind a proxy or firewall that may be interfering with Firebase connections');
    recommendations.push('Contact your network administrator to ensure Firebase domains are allowed through the proxy');
  }
  
  // Add DNS-specific recommendations
  if (!dnsResult.success) {
    recommendations.push('DNS resolution issues detected. This may prevent connecting to Firebase services');
    recommendations.push('Try using a different DNS resolver (e.g., 8.8.8.8 or 1.1.1.1)');
  }
  
  return {
    overallStatus,
    message,
    timestamp,
    internetConnectivity,
    firebaseConnectivity,
    dnsResolution: dnsResult.success,
    behindProxy: proxyResult.behindProxy,
    endpoints,
    proxyEvidence: proxyResult.evidence,
    recommendations
  };
}