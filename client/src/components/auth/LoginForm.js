import React, { useState, useCallback } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import CustomAlertModal from '../modals/CustomAlertModal';
import SocialLoginButtons from './SocialLoginButtons';

const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL ? process.env.REACT_APP_API_BASE_URL.trim().replace(/^"|"$/g, '') : 'http://localhost:5000');

const LoginForm = ({ onClose, onRegisterClick, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // CustomAlert 상태
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
    showCancel: false,
    onConfirm: null
  });

  // Alert 표시 유틸리티 함수
  const showAlert = useCallback((message, type = 'info', title = '', showCancel = false, onConfirm = null) => {
    setAlertModal({
      isOpen: true,
      title,
      message,
      type,
      showCancel,
      onConfirm
    });
  }, []);

  // Alert 닫기 함수
  const closeAlert = useCallback(() => {
    setAlertModal(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert('이메일과 비밀번호를 입력해주세요.', 'warning', '입력 오류');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || '로그인 실패');
      }

      localStorage.setItem('token', data.token);
      onLoginSuccess(data.user, 'general');

    } catch (error) {
      showAlert('이메일/비밀번호가 일치하지 않습니다.', 'error', '로그인 실패');
      console.error('Login error:', error);
    }
  };

  const handleGoogleLoginSuccess = async (codeResponse) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: codeResponse.code }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || 'Google 로그인 실패');
      }

      localStorage.setItem('token', data.token);
      onLoginSuccess(data.user, 'google');
    } catch (error) {
      showAlert(`Google 로그인 실패: ${error.message}`, 'error', 'Google 로그인 실패');
      console.error('Google Login Error:', error);
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: handleGoogleLoginSuccess,
    onError: () => {
      showAlert('Google 로그인에 실패했습니다.', 'error', 'Google 로그인 실패');
    },
    flow: 'auth-code',
    scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
    access_type: 'offline',
    prompt: 'consent',
    redirect_uri: 'https://aisch-9258c2a376c0.herokuapp.com', // 명시적으로 redirect_uri 설정
  });

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
      <div className="bg-white w-11/12 max-w-md rounded-lg shadow-xl p-6">
        <div className="relative mb-4">
          <h2 className="text-xl font-bold text-gray-800 text-center">로그인</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
            <input
              type="email"
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={handleKeyPress}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
            <input
              type="password"
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col space-y-3">
          <button
            onClick={handleLogin}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            로그인
          </button>
          <button
            onClick={onRegisterClick}
            className="px-4 py-2 border border-blue-500 text-blue-500 rounded-md hover:bg-blue-50"
          >
            회원가입
          </button>
          
          <SocialLoginButtons googleLogin={googleLogin} showAlert={showAlert} />
        </div>
        
        <CustomAlertModal
          isOpen={alertModal.isOpen}
          onClose={closeAlert}
          onConfirm={alertModal.onConfirm}
          title={alertModal.title}
          message={alertModal.message}
          type={alertModal.type}
          showCancel={alertModal.showCancel}
        />
      </div>
    </div>
  );
};

export default LoginForm;