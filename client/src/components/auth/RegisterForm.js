import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import CustomAlertModal from '../modals/CustomAlertModal';

const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL ? process.env.REACT_APP_API_BASE_URL.trim().replace(/^"|"$/g, '') : 'http://localhost:5000');

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

  // 유효성 검사 로직을 별도 함수로 분리
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

      onRegisterSuccess();
    } catch (error) {
      showAlert(`회원가입 실패: ${error.message}`, 'error', '회원가입 실패');
      console.error('Register error:', error);
    }
  };

  // isFormValid는 모든 필드가 채워지고, 유효성 검사 오류가 없어야 함
  const isFormValid = firstName && lastName && email && password && password2 && !passwordMatchError && Object.keys(validationErrors).length === 0;

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      handleRegister();
    }
  };

  // onBlur 핸들러: 필드를 벗어났을 때 해당 필드를 touched 상태로 변경
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