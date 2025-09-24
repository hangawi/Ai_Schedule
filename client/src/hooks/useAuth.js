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
            
            const response = await fetch(`${API_BASE_URL}/api/auth`, {
               headers: { 'x-auth-token': token },
               signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
               const userData = await response.json();
               setIsLoggedIn(true);
               setUser(userData);
               if (loginMethod) {
                setLoginMethod(loginMethod);
               }
            } else {
               localStorage.removeItem('token');
               localStorage.removeItem('loginMethod');
               setIsLoggedIn(false);
               setUser(null);
            }
         } catch (error) {
            if (error.name !== 'AbortError') {
               // Error fetching user data - silently handle error
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