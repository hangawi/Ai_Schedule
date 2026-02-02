/**
 * ===================================================================================================
 * useAuth.js - 사용자 인증 상태 및 사용자 데이터 관리를 위한 React Hook
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/hooks
 *
 * 🎯 주요 기능:
 *    - Firebase Authentication을 통한 사용자 로그인/로그아웃 상태 관리
 *    - 백엔드 API를 호출하여 사용자 상세 정보 조회 및 `user` 상태에 저장
 *    - 로그인 방식(`loginMethod`) 및 Firebase 사용자 객체(`firebaseUser`) 관리
 *    - 로그인 성공(`handleLoginSuccess`) 및 로그아웃(`handleLogout`) 처리 함수 제공
 *    - 사용자 프로필 업데이트 이벤트 감지 및 데이터 재조회
 *
 * 🔗 연결된 파일:
 *    - src/App.js - 최상위 컴포넌트에서 전역 인증 상태를 관리하고 하위 컴포넌트에 제공
 *    - src/config/firebaseConfig.js - Firebase 인증 인스턴스 `auth` 사용
 *    - src/utils/apiClient.js - 백엔드 API 호출을 위해 `apiGet` 사용
 *    - src/components/auth/* - 로그인/회원가입 UI 컴포넌트에서 `handleLoginSuccess`, `handleLogout` 등 사용
 *
 * ✏️ 수정 가이드:
 *    - 새로운 인증 방식 추가: `onAuthStateChanged` 로직 및 `handleLoginSuccess`에 새로운 `loginMethod` 처리 추가
 *    - 백엔드 사용자 데이터 구조 변경: `fetchUser` 함수의 응답 처리 로직 수정
 *    - 로그인/로그아웃 시 추가 작업: `handleLoginSuccess` 또는 `handleLogout`에 필요한 로직 추가
 *
 * 📝 참고사항:
 *    - 사용자 인증 상태는 `localStorage`에 `loginMethod`로 저장되어 유지됩니다.
 *    - 백엔드에서 사용자 데이터를 가져오는 데 실패하더라도 Firebase 인증 상태는 유지됩니다.
 *    - `userProfileUpdated` 이벤트를 통해 외부에서 사용자 데이터 재조회를 트리거할 수 있습니다.
 *
 * ===================================================================================================
 */
import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebaseConfig';
import { apiGet } from '../utils/apiClient';

/**
 * useAuth - 사용자 인증 상태(로그인 여부, 사용자 정보)를 관리하고 관련 기능을 제공하는 커스텀 훅
 *
 * @returns {object} 인증 상태 및 관련 함수를 포함하는 객체
 * @property {boolean} isLoggedIn - 사용자가 로그인되어 있는지 여부
 * @property {object|null} user - 백엔드에서 가져온 사용자 상세 정보 객체 (로그아웃 시 null)
 * @property {string|null} loginMethod - 로그인 방식 (예: 'google', 'email'), 로그아웃 시 null
 * @property {object|null} firebaseUser - Firebase에서 제공하는 사용자 객체 (로그아웃 시 null)
 * @property {Function} handleLoginSuccess - 로그인 성공 시 호출되는 콜백 함수
 *   @param {object} userData - 백엔드에서 반환된 사용자 데이터
 *   @param {string} loginType - 사용된 로그인 방식 (예: 'google')
 * @property {Function} handleLogout - 사용자 로그아웃을 처리하는 함수
 */
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
               console.log('🔥 [useAuth] 서버에서 받은 userData:', {
                  personalTimes개수: userData.personalTimes?.length || 0,
                  첫5개: userData.personalTimes?.slice(0, 5).map(pt => ({
                     title: pt.title,
                     startTime: pt.startTime,
                     endTime: pt.endTime
                  }))
               });
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
         // ⭐ 즉시 로그인 상태로 설정 (깜빡임 방지)
         setIsLoggedIn(true);

         // Store login method
         const storedLoginMethod = localStorage.getItem('loginMethod') || 'google';
         setLoginMethod(storedLoginMethod);

         // Fetch user data from backend (비동기로 실행하지만 isLoggedIn은 이미 true)
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

      // Listen for refreshUser events (e.g., after schedule confirmation)
      const handleRefreshUser = async () => {
         await fetchUser();
      };

      window.addEventListener('userProfileUpdated', handleProfileUpdate);
      window.addEventListener('refreshUser', handleRefreshUser);

      return () => {
         unsubscribe();
         window.removeEventListener('userProfileUpdated', handleProfileUpdate);
         window.removeEventListener('refreshUser', handleRefreshUser);
      };
   }, [fetchUser]); // ⚠️ firebaseUser 제거 - 이벤트 리스너가 계속 재등록되는 문제 방지

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
