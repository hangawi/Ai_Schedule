import React, { useState, useCallback } from 'react';
import CustomAlertModal from '../modals/CustomAlertModal';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

const AuthScreen = ({ onLoginSuccess }) => {
  const [showLogin, setShowLogin] = useState(true);

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

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      {showLogin ? (
        <LoginForm
          onClose={() => {}} 
          onRegisterClick={() => setShowLogin(false)}
          onLoginSuccess={onLoginSuccess}
        />
      ) : (
        <RegisterForm
          onClose={() => {
            if (window.confirm('회원가입을 하지 않으시겠습니까?')) {
              setShowLogin(true);
            }
          }}
          onRegisterSuccess={() => {
            showAlert('회원가입 성공! 로그인 해주세요.', 'success', '회원가입 성공', false, () => setShowLogin(true));
          }}
          onLoginClick={() => setShowLogin(true)}
        />
      )}
      
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
  );
};

export default AuthScreen;