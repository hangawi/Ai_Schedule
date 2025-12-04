/**
 * ===================================================================================================
 * RegisterForm.js - 회원가입 폼 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/auth/RegisterForm.js
 *
 * 🎯 주요 기능:
 *    - 이메일/비밀번호 기반 회원가입
 *    - 실시간 유효성 검사 (이름, 성, 이메일, 비밀번호)
 *    - 비밀번호 일치 확인
 *    - 필드별 오류 메시지 표시
 *    - 회원가입 성공 시 로그인 화면으로 이동
 *
 * 🔗 연결된 파일:
 *    - ../modals/CustomAlertModal.js - 커스텀 알림 모달
 *    - /api/auth/register - 회원가입 API
 *    - lucide-react - 아이콘 라이브러리 (ArrowLeft)
 *
 * 💡 UI 위치:
 *    - 화면: AuthScreen에서 표시되는 회원가입 폼
 *    - 접근: 로그인 화면에서 "회원가입" 버튼 클릭
 *    - 섹션: 이름/성/이메일/비밀번호 입력, 유효성 검사 메시지, 회원가입 버튼
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 회원가입 폼 UI 및 유효성 검사 로직 변경
 *    - 유효성 검사 규칙 변경: validateForm 함수 내부 조건 수정
 *    - 필드 추가: state, validateForm, handleRegister, JSX에 모두 추가 필요
 *
 * 📝 참고사항:
 *    - 모든 필드는 실시간 유효성 검사 적용
 *    - touched 상태로 필드 focus 후 blur 시에만 오류 메시지 표시
 *    - 비밀번호는 6-128자, 이름은 2-50자, 성은 1-5자 제한
 *    - Enter 키로 회원가입 가능 (handleKeyPress)
 *
 * ===================================================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import CustomAlertModal from '../modals/CustomAlertModal';

const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL ? process.env.REACT_APP_API_BASE_URL.trim().replace(/^"|"$/g, '') : 'http://localhost:5000');

/**
 * RegisterForm - 회원가입 폼 컴포넌트
 *
 * @param {Object} props - 컴포넌트 props
 * @param {Function} props.onClose - 폼 닫기 핸들러
 * @param {Function} props.onRegisterSuccess - 회원가입 성공 시 콜백
 * @param {Function} props.onLoginClick - 로그인 화면으로 이동 핸들러
 *
 * @returns {JSX.Element} 회원가입 폼 UI
 */
const RegisterForm = ({ onClose, onRegisterSuccess, onLoginClick }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [passwordMatchError, setPasswordMatchError] = useState(false);

  // 유효성 검사 메시지 상태
  const [validationErrors, setValidationErrors] = useState({});
  // touched 상태 추가
  const [touched, setTouched] = useState({
    firstName: false,
    lastName: false,
    email: false,
    password: false,
    password2: false,
  });

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

  /**
   * validateForm - 폼 유효성 검사 함수
   *
   * @description 모든 입력 필드의 유효성을 검사하고 오류 메시지를 설정
   * @returns {Object} 유효성 검사 오류 객체 (필드명: 오류 메시지)
   */
  const validateForm = useCallback(() => {
    const errors = {};

    // 이름 (firstName) 유효성 검사
    if (!firstName) {
      errors.firstName = '이름은 필수입니다.';
    } else if (firstName.length < 2 || firstName.length > 50) {
      errors.firstName = '이름은 2-50자 사이여야 합니다.';
    }

    // 성 (lastName) 유효성 검사
    if (!lastName) {
      errors.lastName = '성은 필수입니다.';
    } else if (lastName.length < 1 || lastName.length > 5) { // 성은 1-5자 사이로 변경
      errors.lastName = '성은 1-5자 사이여야 합니다.';
    }

    // 이메일 (email) 유효성 검사
    if (!email) {
      errors.email = '이메일은 필수입니다.';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = '유효한 이메일 주소를 입력해주세요.';
    }

    // 비밀번호 (password) 유효성 검사
    if (!password) {
      errors.password = '비밀번호는 필수입니다.';
    } else if (password.length < 6 || password.length > 128) {
      errors.password = '비밀번호는 6-128자 사이여야 합니다.';
    }
    // 비밀번호 복잡성 조건은 서버에서 제거했으므로 클라이언트에서도 제거

    setValidationErrors(errors);
    return errors; // 현재 오류 객체를 반환
  }, [firstName, lastName, email, password]);

  useEffect(() => {
    // 비밀번호 일치 여부 검사
    if (password2 === '') {
      setPasswordMatchError(false);
    } else if (password !== password2) {
      setPasswordMatchError(true);
    } else {
      setPasswordMatchError(false);
    }

    // 입력값이 변경될 때마다 유효성 검사 실행
    validateForm();
  }, [firstName, lastName, email, password, password2, validateForm]);

  /**
   * handleRegister - 회원가입 처리 함수
   *
   * @description 유효성 검사 후 회원가입 API 호출, 성공 시 로그인 화면으로 이동
   */
  const handleRegister = async () => {
    // 모든 필드를 touched 상태로 만들어서 모든 오류 메시지를 표시
    setTouched({
      firstName: true,
      lastName: true,
      email: true,
      password: true,
      password2: true,
    });

    // 최종 유효성 검사
    const currentErrors = validateForm();

    // password2 확인 추가
    if (!password2) {
      showAlert('비밀번호 확인을 입력해주세요.', 'warning', '입력 오류');
      return;
    }

    const hasErrors = Object.keys(currentErrors).length > 0 || passwordMatchError;

    if (hasErrors) {
      showAlert('모든 필수 정보를 올바르게 입력해주세요.', 'warning', '입력 오류');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ firstName, lastName, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        // 서버에서 받은 유효성 검사 오류 메시지 처리
        if (data.errors) {
          const serverErrors = {};
          data.errors.forEach(err => {
            serverErrors[err.field] = err.message;
          });
          setValidationErrors(prev => ({ ...prev, ...serverErrors }));
          showAlert('회원가입 실패: 입력값을 확인해주세요.', 'error', '회원가입 실패');
        } else {
          throw new Error(data.msg || '회원가입 실패');
        }
        return; // 오류 발생 시 함수 종료
      }

      // 회원가입 성공 모달 표시 후 로그인 화면으로 이동
      showAlert(
        '회원가입이 완료되었습니다!',
        'success',
        '회원가입 성공',
        false,
        () => {
          closeAlert();
          onLoginClick(); // 로그인 화면으로 이동
        }
      );
    } catch (error) {
      showAlert(`회원가입 실패: ${error.message}`, 'error', '회원가입 실패');
      // Register error - silently handle error
    }
  };

  // isFormValid는 모든 필드가 채워지고, 유효성 검사 오류가 없어야 함
  const isFormValid = firstName && lastName && email && password && password2 && !passwordMatchError && Object.keys(validationErrors).length === 0;

  /**
   * handleKeyPress - Enter 키 입력 처리
   *
   * @description Enter 키 입력 시 회원가입 실행
   * @param {KeyboardEvent} event - 키보드 이벤트
   */
  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      handleRegister();
    }
  };

  /**
   * handleBlur - 필드 focus 해제 처리
   *
   * @description 필드를 벗어날 때 해당 필드를 touched 상태로 변경하여 오류 메시지 표시
   * @param {string} field - 필드명 (firstName, lastName, email, password, password2)
   */
  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
      <div className="bg-white w-11/12 max-w-md rounded-lg shadow-xl p-6">
        <div className="relative mb-4">
          <h2 className="text-xl font-bold text-gray-800 text-center">회원가입</h2>
          <button onClick={onLoginClick} className="absolute top-0 left-0 text-blue-500 hover:text-blue-700 text-sm px-2 py-1 rounded-md">
            <ArrowLeft size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
              <input
                type="text"
                className={`w-full border ${touched.firstName && validationErrors.firstName ? 'border-red-500' : 'border-gray-300'} rounded-md px-3 py-2`}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                onBlur={() => handleBlur('firstName')} // onBlur 이벤트 추가
                onKeyPress={handleKeyPress}
              />
              {touched.firstName && validationErrors.firstName && (
                <p className="text-red-500 text-xs mt-1">{validationErrors.firstName}</p>
              )}
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">성</label>
              <input
                type="text"
                className={`w-full border ${touched.lastName && validationErrors.lastName ? 'border-red-500' : 'border-gray-300'} rounded-md px-3 py-2`}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                onBlur={() => handleBlur('lastName')} // onBlur 이벤트 추가
                onKeyPress={handleKeyPress}
              />
              {touched.lastName && validationErrors.lastName && (
                <p className="text-red-500 text-xs mt-1">{validationErrors.lastName}</p>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
            <input
              type="email"
                className={`w-full border ${touched.email && validationErrors.email ? 'border-red-500' : 'border-gray-300'} rounded-md px-3 py-2`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => handleBlur('email')} // onBlur 이벤트 추가
              onKeyPress={handleKeyPress}
            />
            {touched.email && validationErrors.email && (
              <p className="text-red-500 text-xs mt-1">{validationErrors.email}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
            <input
              type="password"
                className={`w-full border ${touched.password && validationErrors.password ? 'border-red-500' : 'border-gray-300'} rounded-md px-3 py-2`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => handleBlur('password')} // onBlur 이벤트 추가
              onKeyPress={handleKeyPress}
            />
            {touched.password && validationErrors.password && (
              <p className="text-red-500 text-xs mt-1">{validationErrors.password}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 확인</label>
            <input
              type="password"
              className={`w-full border ${touched.password2 && passwordMatchError ? 'border-red-500' : 'border-gray-300'} rounded-md px-3 py-2`}
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              onBlur={() => handleBlur('password2')} // onBlur 이벤트 추가
              onKeyPress={handleKeyPress}
            />
            {touched.password2 && passwordMatchError && (
              <p className="text-red-500 text-xs mt-1">비밀번호가 일치하지 않습니다.</p>
            )}
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={handleRegister}
            className={`w-full px-4 py-2 rounded-md ${isFormValid ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-300 cursor-not-allowed'}`}
            disabled={!isFormValid}
          >
            회원가입
          </button>
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

export default RegisterForm;