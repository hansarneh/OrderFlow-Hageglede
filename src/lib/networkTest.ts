import { getConnectionState } from './firebaseClient';

/**
 * Tests connectivity to Firebase API endpoints
 * @param projectId The Firebase project ID
 * @returns An object with success status and detailed information
 */
export async function testFirebaseConnectivity(projectId: string = 'order-flow-bolt'): Promise<{
  success: boolean;
  message: string;
  details: {
    endpoints: Record<string, boolean>;
    errors: Record<string, string>;
    connectionState: boolean;
  };
}> {
  console.log('Testing Firebase connectivity...');
  
  // Get the current connection state from firebaseClient
  const connectionState = getConnectionState();
  
  // Critical Firebase/Google Cloud endpoints to test
  const endpoints = {
    'Google Auth': `https://oauth2.googleapis.com/token`,
    'Google APIs': `https://www.googleapis.com/discovery/v1/apis`,
    'Firebase API': `https://firebase.googleapis.com/v1beta1/projects/${projectId}`,
    'Firestore API': `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`,
    'Cloud Functions': `https://cloudfunctions.googleapis.com/v1/projects/${projectId}/locations/-/functions`,
    'Public Internet': 'https://www.cloudflare.com/cdn-cgi/trace' // Public endpoint to test general internet connectivity
  };
  
  const results: Record<string, boolean> = {};
  const errors: Record<string, string> = {};
  let overallSuccess = true;
  
  // Test each endpoint with a timeout
  const testPromises = Object.entries(endpoints).map(async ([name, url]) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(url, {
        method: 'HEAD', // Just check if the endpoint is reachable, don't download content
        signal: controller.signal,
        // Don't send credentials to avoid CORS issues
        credentials: 'omit',
        // Set a user agent to avoid being blocked
        headers: {
          'User-Agent': 'LogiFlow-ConnectivityTest/1.0'
        }
      });
      
      clearTimeout(timeoutId);
      
      // Even a 401/403 response means the endpoint is reachable
      results[name] = true;
      console.log(`✅ ${name} endpoint is reachable (${response.status})`);
    } catch (error) {
      results[name] = false;
      overallSuccess = false;
      
      // Provide detailed error information
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        errors[name] = 'Network error: Failed to fetch. This usually indicates a network connectivity issue.';
      } else if (error.name === 'AbortError') {
        errors[name] = 'Timeout: Request took too long to complete.';
      } else {
        errors[name] = `Error: ${error.message || 'Unknown error'}`;
      }
      
      console.error(`❌ ${name} endpoint is not reachable:`, errors[name]);
    }
  });
  
  // Wait for all tests to complete
  await Promise.all(testPromises);
  
  // Determine overall message
  let message = '';
  if (overallSuccess) {
    message = 'All Firebase endpoints are reachable. Network connectivity looks good.';
  } else if (results['Public Internet'] && !results['Google Auth']) {
    message = 'General internet connectivity works, but Firebase/Google Cloud endpoints are unreachable. This suggests a firewall or proxy issue specifically blocking Google services.';
  } else if (!results['Public Internet']) {
    message = 'Unable to reach any external endpoints. This suggests a complete network connectivity issue.';
  } else {
    message = 'Some Firebase endpoints are unreachable. This may cause authentication or deployment issues.';
  }
  
  return {
    success: overallSuccess,
    message,
    details: {
      endpoints: results,
      errors,
      connectionState
    }
  };
}

/**
 * Tests connectivity to a specific URL
 * @param url The URL to test
 * @param timeout Timeout in milliseconds
 * @returns An object with success status and error message if applicable
 */
export async function testUrlConnectivity(url: string, timeout: number = 5000): Promise<{
  success: boolean;
  status?: number;
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      credentials: 'omit',
      headers: {
        'User-Agent': 'LogiFlow-ConnectivityTest/1.0'
      }
    });
    
    clearTimeout(timeoutId);
    
    return {
      success: true,
      status: response.status
    };
  } catch (error) {
    let errorMessage = 'Unknown error';
    
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      errorMessage = 'Network error: Failed to fetch. This usually indicates a network connectivity issue.';
    } else if (error.name === 'AbortError') {
      errorMessage = 'Timeout: Request took too long to complete.';
    } else {
      errorMessage = error.message || 'Unknown error';
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
}