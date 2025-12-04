/**
 * ===================================================================================================
 * AuthScreen.js - 인증 화면 메인 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/auth/AuthScreen.js
 *
 * 🎯 주요 기능:
 *    - 로그인 / 회원가입 화면 전환
 *    - 로그인 성공 시 콜백 호출
 *    - 회원가입 성공 알림 표시
 *    - CustomAlertModal을 통한 메시지 표시
 *
 * 🔗 연결된 파일:
 *    - ./LoginForm.js - 로그인 폼 컴포넌트
 *    - ./RegisterForm.js - 회원가입 폼 컴포넌트
 *    - ../modals/CustomAlertModal.js - 커스텀 알림 모달
 *
 * 💡 UI 위치:
 *    - 화면: 앱 시작 시 인증 화면
 *    - 접근: 비로그인 상태에서 자동 표시
 *    - 섹션: 로그인 폼 ↔ 회원가입 폼 전환
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 인증 화면 전체 레이아웃 및 전환 로직 변경
 *    - 폼 전환 로직 변경: showLogin 상태 및 버튼 핸들러 수정
 *    - 알림 메시지 변경: showAlert 호출 시 전달하는 메시지 수정
 *
 * 📝 참고사항:
 *    - 로그인과 회원가입 폼 간 전환은 showLogin 상태로 제어
 *    - 회원가입 성공 시 자동으로 로그인 화면으로 전환
 *    - 회원가입 취소 시 확인 메시지 표시
 *
 * ===================================================================================================
 */

import React, { useState, useCallback } from 'react';
import CustomAlertModal from '../modals/CustomAlertModal';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

/**
 * AuthScreen - 인증 화면 메인 컴포넌트
 *
 * @param {Object} props - 컴포넌트 props
 * @param {Function} props.onLoginSuccess - 로그인 성공 시 호출되는 콜백 함수
 *
 * @returns {JSX.Element} 인증 화면 UI
 */
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

  /**
   * showAlert - 알림 모달 표시 함수
   *
   * @description CustomAlertModal을 통해 알림 메시지를 표시
   * @param {string} message - 표시할 메시지
   * @param {string} type - 알림 타입 (info, success, warning, error)
   * @param {string} title - 알림 제목
   * @param {boolean} showCancel - 취소 버튼 표시 여부
   * @param {Function} onConfirm - 확인 버튼 클릭 시 콜백 함수
   */
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

  /**
   * closeAlert - 알림 모달 닫기 함수
   *
   * @description 열려있는 알림 모달을 닫음
   */
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