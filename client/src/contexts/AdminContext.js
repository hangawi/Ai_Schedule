import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../config/firebaseConfig';

const AdminContext = createContext();

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};

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
