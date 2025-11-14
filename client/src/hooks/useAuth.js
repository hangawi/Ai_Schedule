import { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

export const useAuth = () => {
   const [isLoggedIn, setIsLoggedIn] = useState(false);
   const [user, setUser] = useState(null);
   const [loginMethod, setLoginMethod] = useState(null);

   const fetchUser = useCallback(async () => {
      const token = localStorage.getItem('token');
      const loginMethod = localStorage.getItem('loginMethod');
      if (token) {
         try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            console.log('[useAuth] Fetching user data from /api/auth...');
            const response = await fetch(`${API_BASE_URL}/api/auth`, {
               headers: { 'x-auth-token': token },
               signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
               const userData = await response.json();
               console.log('[useAuth] Received user data:', userData);
               setIsLoggedIn(true);
               setUser(userData);
               if (loginMethod) {
                setLoginMethod(loginMethod);
               }
            } else {
               console.error('[useAuth] Failed to fetch user data, status:', response.status);
               localStorage.removeItem('token');
               localStorage.removeItem('loginMethod');
               setIsLoggedIn(false);
               setUser(null);
            }
         } catch (error) {
            if (error.name !== 'AbortError') {
               console.error('[useAuth] Error fetching user:', error);
            }
            localStorage.removeItem('token');
            localStorage.removeItem('loginMethod');
            setIsLoggedIn(false);
            setUser(null);
         }
      }
   }, []);

   useEffect(() => {
      fetchUser();

      // Listen for profile update events
      const handleProfileUpdate = () => {
         console.log('[useAuth] Received userProfileUpdated event, refetching user...');
         fetchUser();
      };

      window.addEventListener('userProfileUpdated', handleProfileUpdate);

      return () => {
         window.removeEventListener('userProfileUpdated', handleProfileUpdate);
      };
   }, [fetchUser]);

   const handleLoginSuccess = useCallback((userData, loginType) => {
      localStorage.setItem('loginMethod', loginType);
      setIsLoggedIn(true);
      setUser(userData);
      setLoginMethod(loginType);
   }, []);

   const handleLogout = useCallback(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('loginMethod');
      setIsLoggedIn(false);
      setUser(null);
   }, []);

   return { isLoggedIn, user, loginMethod, handleLoginSuccess, handleLogout };
};