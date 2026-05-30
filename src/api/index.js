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

// Memory Cache for static data
let cache = {
  categories: null,
  tags: null,
  lastFetched: {
    categories: 0,
    tags: 0
  }
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

// Initialize token from storage immediately
AsyncStorage.getItem('token').then(token => {
  if (token) memoizedToken = token;
});

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
  // Use memory token if available, otherwise hit storage
  let token = memoizedToken;
  if (!token) {
    token = await AsyncStorage.getItem('token');
    memoizedToken = token;
  }
  
  if (token) {
    config.headers.Authorization = token;
  }
  
  // Minimal logging in production for speed
  if (__DEV__) {
    console.log(`🚀 ${config.method?.toUpperCase()} ${config.url}`);
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
        // Call refresh API with current token using a CLEAN axios instance
        // to avoid interceptor loops
        console.log('📞 Calling Refresh API...');
        const refreshApi = axios.create({ baseURL: api.defaults.baseURL });
        const response = await refreshApi.get('/v1/auth/refresh-access-token', {
          headers: {
            Authorization: memoizedToken || await AsyncStorage.getItem('token')
          },
          withCredentials: true
        });

        // Since this is a fresh axios instance, it returns the full response object
        // but if we used the intercepted one, it would return data.
        // Let's be safe and check both.
        const data = response.data || response;
        const newAccessToken = data.accessToken;
        const refreshedUser = data.user || {};
        
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
  register: (requestJson = {}) => api.post('/v1/auth/signup', requestJson),
  refreshAccessToken: () => api.get('/v1/auth/refresh-access-token'),
};

export const dashboardApi = {
  getDashboardChart: (requestJson = {}) => api.post('/v1/public/dashboard/getDashboardChart', requestJson),
  getDashboardCards: (requestJson = {}) => api.post('/v1/public/dashboard/getDashboardCards', requestJson),
};

export const categoryApi = {
  getCategories: async (requestJson = {}, forceRefresh = false) => {
    const now = Date.now();
    // Return cache if it exists and is fresh, unless forceRefresh is true
    // also add the total count of categories in the response
    if (!forceRefresh && cache.categories && (now - cache.lastFetched.categories < CACHE_DURATION) && !requestJson.searchTerm) {
      console.log('📦 Returning Cached Categories');
      return { data: { categories: cache.categories , total: cache.total }, success: true };
    }
    
    const response = await api.post('/v1/public/category/getAll', requestJson);
    if (response?.data?.categories && !requestJson.searchTerm) {
      cache.categories = response.data.categories;
      cache.lastFetched.categories = now;
      cache.total = response.data.total;
    }
    return response;
  },
  createCategory: (requestJson = {}) => {
    cache.categories = null; // Invalidate cache on change
    return api.post('/v1/public/category/create', requestJson);
  },
  updateCategory: (requestJson = {}) => {
    cache.categories = null;
    return api.post('/v1/public/category/update', requestJson);
  },
  deleteCategory: (requestJson = {}) => {
    cache.categories = null;
    return api.post('/v1/public/category/delete', requestJson);
  },
};

export const transactionApi = {
  getTransactions: (requestJson = {}) => api.post('/v1/public/transaction/getAll', requestJson),
  createTransaction: (requestJson = {}) => api.post('/v1/public/transaction/create', requestJson),
  updateTransaction: (requestJson = {}) => api.post('/v1/public/transaction/update', requestJson),
  deleteTransaction: (requestJson = {}) => api.post('/v1/public/transaction/delete', requestJson),
  getTransactionById: (requestJson = {}) => api.post('/v1/public/transaction/getById', requestJson),
};

export const tagApi = {
  getTags: async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && cache.tags && (now - cache.lastFetched.tags < CACHE_DURATION)) {
      console.log('📦 Returning Cached Tags');
      return cache.tags;
    }

    const response = await api.post('/v1/public/transaction/getTags', {});
    if (response) {
      cache.tags = response;
      cache.lastFetched.tags = now;
    }
    return response;
  },
};


export default api;
