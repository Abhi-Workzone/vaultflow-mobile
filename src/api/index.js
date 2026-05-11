import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL || 'https://vaultflow-api.onrender.com/api',
  // baseURL: 'http://192.168.0.11:4061/api',
  timeout: 10000, // 10 second timeout
});

let memoizedToken = null;
let isRefreshing = false;
let failedQueue = [];
let navigationRef = null;

// Export function to set navigation reference
export const setNavigationRef = (navigation) => {
  navigationRef = navigation;
};

export const setStoredToken = (token) => {
  memoizedToken = token;
};

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

// Add token to requests
api.interceptors.request.use(async (config) => {
  const token = memoizedToken || await AsyncStorage.getItem('token');
  
  console.log('🚀 API Request:', {
    method: config.method?.toUpperCase(),
    url: config.url,
    baseURL: config.baseURL,
    hasToken: !!token,
    headers: config.headers
  });
  
  if (token) {
    memoizedToken = token;
    config.headers.Authorization = token; // Remove Bearer prefix
  }
  return config;
});

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => {
    console.log('✅ API Response:', {
      status: response.status,
      url: response.config?.url,
      method: response.config?.method?.toUpperCase(),
      hasData: !!response.data,
      dataSize: JSON.stringify(response.data).length
    });
    return response?.data;
  },
  async (error) => {
    const originalRequest = error.config;
    
    console.log('❌ API Error:', {
      status: error.response?.status,
      url: originalRequest?.url,
      method: originalRequest?.method?.toUpperCase(),
      message: error.response?.data?.message || error.message,
      isTokenExpired: error.response?.status === 401,
      isRetried: originalRequest._retry
    });

    // If token expired (401), and it's not already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // If a refresh is already in progress, wait for it
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject: reject
          });
        });
      }

      isRefreshing = true;

      console.log('🔄 Starting Token Refresh Process...');

      try {
        // Call refresh API with current token
        console.log('📞 Calling Refresh API...');
        const response = await api.get('/v1/auth/refresh-access-token', {
          headers: {
            Authorization: memoizedToken || await AsyncStorage.getItem('token') // Remove Bearer prefix
          }
        });

        const newAccessToken = response.data.accessToken;
        const refreshedUser = response.data.user || {};
        
        console.log('✅ Token Refresh Successful:', {
          newTokenLength: newAccessToken.length,
          responseStatus: response.status,
          userUpdated: !!response.data.user
        });
        
        // Store new token and user data
        console.log('💾 Storing New Token:', {
          tokenLength: newAccessToken.length,
          tokenPrefix: newAccessToken.substring(0, 20) + '...'
        });
        
        await AsyncStorage.setItem('token', newAccessToken);
        await AsyncStorage.setItem('user', JSON.stringify(refreshedUser));
        memoizedToken = newAccessToken;
        
        // Update default headers for all future requests (like web implementation)
        api.defaults.headers.common['Authorization'] = newAccessToken; // Remove Bearer prefix
        
        console.log('✅ Token Storage Complete:', {
          memoizedToken: memoizedToken.substring(0, 20) + '...',
          defaultHeadersUpdated: true
        });
        
        // Process queued requests
        processQueue(null, newAccessToken);

        console.log('🔄 Retrying Original Request with New Token...');

        // Add small delay to ensure token is properly set
        await new Promise(resolve => setTimeout(resolve, 100));

        // Retry original request with new token
        originalRequest.headers.Authorization = newAccessToken; // Remove Bearer prefix
        
        console.log('🔄 Retrying Request:', {
          originalUrl: originalRequest.url,
          originalMethod: originalRequest.method,
          newToken: newAccessToken.substring(0, 20) + '...',
          retryCount: originalRequest._retry ? 1 : 0
        });
        
        // Return the original request with updated headers, not a new axios call
        return api(originalRequest);

      } catch (refreshError) {
        console.log('❌ Token Refresh Failed:', {
          error: refreshError.message,
          status: refreshError.response?.status,
          clearingTokens: true
        });
        
        // Refresh failed, clear tokens and redirect to login
        await AsyncStorage.removeItem('token');
        memoizedToken = null;
        processQueue(refreshError, null);
        
        // Navigate to login if navigation reference is available
        if (navigationRef && navigationRef.reset) {
          console.log('🔄 Redirecting to Login Screen...');
          navigationRef.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        }
        
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export const authApi = {
  login: (requestJson = {}) => api.post('/v1/auth/login', requestJson),
  register: (requestJson = {}) => api.post('/v1/auth/register', requestJson),
  refreshAccessToken: () => api.get('/v1/auth/refresh-access-token'),
};

export const dashboardApi = {
  getDashboardChart: (requestJson = {}) => api.post('/v1/public/dashboard/getDashboardChart', requestJson),
  getDashboardCards: (requestJson = {}) => api.post('/v1/public/dashboard/getDashboardCards', requestJson),
};

export const categoryApi = {
  getCategories: (requestJson = {}) => api.post('/v1/public/category/getAll', requestJson),
  createCategory: (requestJson = {}) => api.post('/v1/public/category/create', requestJson),
  updateCategory: (requestJson = {}) => api.post('/v1/public/category/update', requestJson),
  deleteCategory: (requestJson = {}) => api.post('/v1/public/category/delete', { data: requestJson }),
};

export const transactionApi = {
  getTransactions: (requestJson = {}) => api.post('/v1/public/transaction/getAll', requestJson),
  createTransaction: (requestJson = {}) => api.post('/v1/public/transaction/create', requestJson),
  updateTransaction: (requestJson = {}) => api.post('/v1/public/transaction/update', requestJson),
  deleteTransaction: (requestJson = {}) => api.post('/v1/public/transaction/delete', { data: requestJson }),
  getTransactionById: (requestJson = {}) => api.post('/v1/public/transaction/getById', requestJson),
};

export const tagApi = {
  getTags: (requestJson = {}) => api.post('/v1/public/transaction/getTags', requestJson),
};


export default api;
