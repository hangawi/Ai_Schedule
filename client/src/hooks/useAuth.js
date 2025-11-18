import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebaseConfig';
import { apiGet } from '../utils/apiClient';

export const useAuth = () => {
   const [isLoggedIn, setIsLoggedIn] = useState(false);
   const [user, setUser] = useState(null);
   const [loginMethod, setLoginMethod] = useState(null);
   const [firebaseUser, setFirebaseUser] = useState(null);

   const fetchUser = useCallback(async () => {
      const currentUser = auth.currentUser;
      
      if (currentUser) {
         try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            console.log('[useAuth] Fetching user data from /api/auth...');
            const response = await apiGet('/api/auth');

            clearTimeout(timeoutId);

            if (response.ok) {
               const userData = await response.json();
               console.log('[useAuth] Received user data:', userData);
               setIsLoggedIn(true);
               setUser(userData);
            } else {
               console.error('[useAuth] Failed to fetch user data, status:', response.status);
               // Don't log out on API errors - user is still authenticated in Firebase
               setIsLoggedIn(true);
            }
         } catch (error) {
            if (error.name !== 'AbortError') {
               console.error('[useAuth] Error fetching user:', error);
            }
            // Don't log out on API errors - user is still authenticated in Firebase
         }
      }
   }, []);

   useEffect(() => {
      // Firebase auth state listener
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
         console.log('[useAuth] Firebase auth state changed:', firebaseUser ? 'User logged in' : 'User logged out');

         if (firebaseUser) {
            setFirebaseUser(firebaseUser);

            // Store login method
            const storedLoginMethod = localStorage.getItem('loginMethod') || 'google';
            setLoginMethod(storedLoginMethod);

            // Fetch user data from backend
            await fetchUser();
         } else {
            setFirebaseUser(null);
            setIsLoggedIn(false);
            setUser(null);
            setLoginMethod(null);
            localStorage.removeItem('loginMethod');
         }
      });

      // Listen for profile update events
      const handleProfileUpdate = async () => {
         console.log('[useAuth] Received userProfileUpdated event, refetching user...');
         await fetchUser();
      };

      window.addEventListener('userProfileUpdated', handleProfileUpdate);

      return () => {
         unsubscribe();
         window.removeEventListener('userProfileUpdated', handleProfileUpdate);
      };
   }, [fetchUser, firebaseUser]);

   const handleLoginSuccess = useCallback((userData, loginType) => {
      localStorage.setItem('loginMethod', loginType);
      setIsLoggedIn(true);
      setUser(userData);
      setLoginMethod(loginType);
   }, []);

   const handleLogout = useCallback(async () => {
      try {
         await auth.signOut();
         localStorage.removeItem('loginMethod');
         setIsLoggedIn(false);
         setUser(null);
         setLoginMethod(null);
         console.log('[useAuth] User logged out successfully');
      } catch (error) {
         console.error('[useAuth] Error during logout:', error);
      }
   }, []);

   return { isLoggedIn, user, loginMethod, handleLoginSuccess, handleLogout, firebaseUser };
};
