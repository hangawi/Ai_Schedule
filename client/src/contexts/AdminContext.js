/**
 * ===================================================================================================
 * AdminContext.js - 관리자 상태 관리를 위한 React Context
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/contexts
 *
 * 🎯 주요 기능:
 *    - 앱 전체에서 관리자(admin) 여부를 확인할 수 있는 Context 제공
 *    - `isAdmin` 상태와 로딩 상태(`loading`) 관리
 *    - 관리자 코드 인증(`verifyAdminCode`) 기능 제공
 *    - 관리자 권한 해제(`revokeAdmin`) 기능 제공
 *
 * 🔗 연결된 파일:
 *    - src/App.js - 앱 최상위 레벨에서 AdminProvider를 사용하여 하위 컴포넌트에 컨텍스트 제공
 *    - src/components/admin/* - 관리자 관련 컴포넌트에서 `useAdmin`을 통해 isAdmin 상태 및 함수 사용
 *
 * ✏️ 수정 가이드:
 *    - 관리자 인증 로직 변경: `verifyAdminCode` 함수의 API 호출 부분 수정
 *    - 새로운 관리자 관련 상태 추가: AdminProvider 내에 새로운 `useState`를 추가하고 `value` 객체에 포함
 *
 * 📝 참고사항:
 *    - `useAdmin` 커스텀 훅은 반드시 `AdminProvider` 하위에서 사용되어야 합니다.
 *    - 사용자(user) prop이 변경되거나 Firebase 인증 상태가 변경될 때마다 `isAdmin` 상태가 자동으로 업데이트됩니다.
 *
 * ===================================================================================================
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../config/firebaseConfig';

const AdminContext = createContext();

/**
 * useAdmin - AdminContext를 사용하기 위한 커스텀 훅
 * @returns {object} AdminContext의 value 객체 (isAdmin, loading, verifyAdminCode, revokeAdmin)
 * @throws {Error} AdminProvider 외부에서 사용될 경우 에러 발생
 */
export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};

/**
 * AdminProvider - 관리자 컨텍스트를 제공하는 컴포넌트
 * @param {object} props - 컴포넌트 props
 * @param {React.ReactNode} props.children - Provider가 감쌀 자식 컴포넌트들
 * @param {object} props.user - 현재 로그인된 사용자 객체 (상위 컴포넌트로부터 전달받음)
 */
export const AdminProvider = ({ children, user }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // user prop에서 role 확인
    if (user && user.role === 'admin') {
      setIsAdmin(true);
    } else {
      setIsAdmin(false);
    }
    setLoading(false);
  }, [user]);

  // 로그아웃 시 관리자 상태 초기화
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      if (!firebaseUser) {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const verifyAdminCode = async (code) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('로그인이 필요합니다.');
      }

      const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
      const response = await fetch(`${API_BASE_URL}/api/admin/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await currentUser.getIdToken()}`
        },
        body: JSON.stringify({ code })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || '관리자 인증 실패');
      }

      setIsAdmin(true);
      return { success: true, message: data.msg };
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  const revokeAdmin = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('로그인이 필요합니다.');
      }

      const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
      const response = await fetch(`${API_BASE_URL}/api/admin/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await currentUser.getIdToken()}`
        }
      });

      if (response.ok) {
        setIsAdmin(false);
        return { success: true };
      }

      const data = await response.json();
      throw new Error(data.msg || '권한 해제 실패');
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  const value = {
    isAdmin,
    loading,
    verifyAdminCode,
    revokeAdmin
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
};

export default AdminContext;
