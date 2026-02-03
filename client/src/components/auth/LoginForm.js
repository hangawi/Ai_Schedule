/**
 * ===================================================================================================
 * LoginForm.js - 로그인 폼 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/auth/LoginForm.js
 *
 * 🎯 주요 기능:
 *    - 이메일/비밀번호 로그인
 *    - Google 소셜 로그인
 *    - Firebase 인증 처리
 *    - MongoDB 사용자 생성/조회
 *    - 로그인 성공 시 콜백 호출
 *
 * 🔗 연결된 파일:
 *    - ../../config/firebaseConfig.js - Firebase 설정 (auth, googleProvider)
 *    - ./SocialLoginButtons.js - 소셜 로그인 버튼 컴포넌트
 *    - ../modals/CustomAlertModal.js - 커스텀 알림 모달
 *    - /api/auth/login - 이메일 로그인 API
 *    - /api/auth/google - Google 로그인 API
 *
 * 💡 UI 위치:
 *    - 화면: AuthScreen에서 표시되는 로그인 폼
 *    - 접근: 비로그인 상태에서 기본 표시
 *    - 섹션: 이메일/비밀번호 입력, 로그인 버튼, 회원가입 버튼, Google 로그인 버튼
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 로그인 폼 UI 및 로그인 처리 로직 변경
 *    - 소셜 로그인 추가: handleGoogleLogin과 유사한 함수 생성 및 SocialLoginButtons에 전달
 *    - 유효성 검증 추가: handleLogin 내부에 검증 로직 추가
 *
 * 📝 참고사항:
 *    - Firebase 인증 후 MongoDB에 사용자 정보 저장/조회
 *    - Enter 키로 로그인 가능 (handleKeyPress)
 *    - Google 로그인 성공 시 localStorage에 'googleConnected' 저장
 *
 * ===================================================================================================
 */

import React, { useState, useCallback, useEffect } from 'react';
import { signInWithPopup, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, googleProvider } from '../../config/firebaseConfig';
import CustomAlertModal from '../modals/CustomAlertModal';
import SocialLoginButtons from './SocialLoginButtons';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL
   ? process.env.REACT_APP_API_BASE_URL.trim().replace(/^"|"$/g, '')
   : 'http://localhost:5000';

/**
 * LoginForm - 로그인 폼 컴포넌트
 *
 * @param {Object} props - 컴포넌트 props
 * @param {Function} props.onClose - 폼 닫기 핸들러
 * @param {Function} props.onRegisterClick - 회원가입 버튼 클릭 핸들러
 * @param {Function} props.onLoginSuccess - 로그인 성공 시 콜백 (user, loginType)
 *
 * @returns {JSX.Element} 로그인 폼 UI
 */
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
      onConfirm: null,
   });

   // 구글 캘린더 동의 후 복귀 처리
   useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const calendarConnected = params.get('calendarConnected');
      const calendarError = params.get('calendarError');

      if (calendarConnected === 'true') {
         const pendingUser = localStorage.getItem('pendingGoogleUser');
         if (pendingUser) {
            localStorage.removeItem('pendingGoogleUser');
            window.history.replaceState({}, document.title, window.location.pathname);
            // 서버에서 최신 user 정보 다시 조회 (refreshToken 반영)
            const parsedUser = JSON.parse(pendingUser);
            const fetchUpdatedUser = async () => {
               try {
                  // Firebase 초기화 완료 대기
                  const currentUser = await new Promise((resolve) => {
                     if (auth.currentUser) return resolve(auth.currentUser);
                     const unsub = auth.onAuthStateChanged((u) => { unsub(); resolve(u); });
                  });
                  if (currentUser) {
                     const idToken = await currentUser.getIdToken();
                     const res = await fetch(`${API_BASE_URL}/api/auth/google`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` }
                     });
                     if (res.ok) {
                        const data = await res.json();
                        onLoginSuccess(data.user, 'google');
                        return;
                     }
                  }
               } catch (e) {
                  console.warn('최신 유저 정보 조회 실패, 캐시 사용:', e);
               }
               onLoginSuccess(parsedUser, 'google');
            };
            fetchUpdatedUser();
         }
      } else if (calendarError) {
         const pendingUser = localStorage.getItem('pendingGoogleUser');
         if (pendingUser) {
            localStorage.removeItem('pendingGoogleUser');
            window.history.replaceState({}, document.title, window.location.pathname);
            // 에러가 있어도 로그인은 진행 (캘린더 없이)
            onLoginSuccess(JSON.parse(pendingUser), 'google');
         }
      }
   }, [onLoginSuccess]);

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
         onConfirm,
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
    * handleLogin - 이메일/비밀번호 로그인 처리
    *
    * @description Firebase 인증 후 MongoDB에 사용자 정보 저장/조회하여 로그인 처리
    */
   const handleLogin = async () => {
      if (!email || !password) {
         showAlert('이메일과 비밀번호를 입력해주세요.', 'warning', '입력 오류');
         return;
      }

      try {
         // Sign in with Firebase
         const userCredential = await signInWithEmailAndPassword(auth, email, password);
         const firebaseUser = userCredential.user;

         // Get ID token
         const idToken = await firebaseUser.getIdToken();

         // Send to backend to get/create user in MongoDB
         const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
               'Authorization': `Bearer ${idToken}`
            }
         });

         const data = await response.json();

         if (!response.ok) {
            throw new Error(data.msg || '로그인 실패');
         }

         onLoginSuccess(data.user, 'general');
      } catch (error) {
         showAlert('이메일/비밀번호가 일치하지 않습니다.', 'error', '로그인 실패');
      }
   };

   /**
    * handleGoogleLogin - Google 소셜 로그인 처리
    *
    * @description Firebase Google 인증 후 MongoDB에 사용자 정보 저장/조회하여 로그인 처리
    */
   const handleGoogleLogin = async () => {
      try {
         // Sign in with Google using Firebase
         const result = await signInWithPopup(auth, googleProvider);
         const firebaseUser = result.user;

         // Get ID token
         const idToken = await firebaseUser.getIdToken();

         // Send to backend to get/create user in MongoDB
         const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
               'Authorization': `Bearer ${idToken}`
            }
         });

         const data = await response.json();

         if (!response.ok) {
            localStorage.setItem('googleConnected', 'false');
            throw new Error(data.msg || 'Google 로그인 실패');
         }

         localStorage.setItem('googleConnected', 'true');

         // 구글 캘린더 refreshToken이 없으면 동의 화면으로 이동
         if (!data.user.google || !data.user.google.refreshToken) {
            try {
               const consentRes = await fetch(`${API_BASE_URL}/api/auth/google/calendar-consent`, {
                  headers: { 'Authorization': `Bearer ${idToken}` }
               });
               const consentData = await consentRes.json();
               if (consentRes.ok && consentData.url) {
                  // 로그인 정보를 임시 저장 후 동의 페이지로 이동
                  localStorage.setItem('pendingGoogleUser', JSON.stringify(data.user));
                  window.location.href = consentData.url;
                  return;
               }
            } catch (consentError) {
               console.warn('캘린더 동의 요청 실패, 일반 진입:', consentError);
            }
         }

         onLoginSuccess(data.user, 'google');
      } catch (error) {
         localStorage.setItem('googleConnected', 'false');
         showAlert(`Google 로그인 실패: ${error.message}`, 'error', 'Google 로그인 실패');
      }
   };

   /**
    * handleKeyPress - Enter 키 입력 처리
    *
    * @description Enter 키 입력 시 로그인 실행
    * @param {KeyboardEvent} event - 키보드 이벤트
    */
   const handleKeyPress = event => {
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
                     onChange={e => setEmail(e.target.value)}
                     onKeyPress={handleKeyPress}
                  />
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
                  <input
                     type="password"
                     className="w-full border border-gray-300 rounded-md px-3 py-2"
                     value={password}
                     onChange={e => setPassword(e.target.value)}
                     onKeyPress={handleKeyPress}
                  />
               </div>
            </div>

            <div className="mt-6 flex flex-col space-y-3">
               <button onClick={handleLogin} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">
                  로그인
               </button>
               <button
                  onClick={onRegisterClick}
                  className="px-4 py-2 border border-blue-500 text-blue-500 rounded-md hover:bg-blue-50">
                  회원가입
               </button>

               <SocialLoginButtons googleLogin={handleGoogleLogin} showAlert={showAlert} />
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
