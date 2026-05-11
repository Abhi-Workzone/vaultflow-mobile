import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, setStoredToken } from '../api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const MIN_SPLASH_TIME = 1000; // 1 second for branding
      const timerPromise = new Promise(resolve => setTimeout(resolve, MIN_SPLASH_TIME));

      try {
        const [[token, storedUser]] = await Promise.all([
          Promise.all([
            AsyncStorage.getItem('token'),
            AsyncStorage.getItem('user')
          ]),
          timerPromise
        ]);

        if (token) {
          setStoredToken(token);
          if (storedUser) {
            const userData = JSON.parse(storedUser);
            setUser(userData);
            setLoading(false);
          } else {
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      } catch (error) {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  const login = async (credentials) => {
    console.log("🚀 ~ login ~ credentials:", credentials)
    const response = await authApi.login(credentials);
    console.log("🚀 ~ login ~ response:", response)
    const { accessToken, ...user } = response;
    setStoredToken(accessToken);
    await Promise.all([
      AsyncStorage.setItem('token', accessToken),
      AsyncStorage.setItem('user', JSON.stringify(user))
    ]);
    setUser(user);
    return user;
  };

  const register = async (userData) => {
    const response = await authApi.register(userData);
    const { token, ...newUserData } = response.data;
    setStoredToken(token);
    await Promise.all([
      AsyncStorage.setItem('token', token),
      AsyncStorage.setItem('user', JSON.stringify(newUserData))
    ]);
    setUser(newUserData);
    return newUserData;
  };

  const logout = async () => {
    setStoredToken(null);
    await Promise.all([
      AsyncStorage.removeItem('token'),
      AsyncStorage.removeItem('user')
    ]);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
