/**
 * ===================================================================================================
 * SocialLoginButtons.js - 소셜 로그인 버튼 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/auth/SocialLoginButtons.js
 *
 * 🎯 주요 기능:
 *    - Google 로그인 버튼
 *    - Naver 로그인 버튼 (미구현, 알림 표시)
 *    - 소셜 로그인 섹션 구분선 표시
 *
 * 🔗 연결된 파일:
 *    - ./LoginForm.js - 로그인 폼에서 사용
 *
 * 💡 UI 위치:
 *    - 화면: 로그인 폼 하단
 *    - 접근: 로그인 화면에서 자동 표시
 *    - 섹션: "또는" 구분선 아래 Google, Naver 버튼
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 소셜 로그인 버튼 UI 변경
 *    - 소셜 로그인 추가: 새 버튼 JSX 추가 및 부모 컴포넌트에 핸들러 전달
 *    - 버튼 스타일 변경: commonButtonStyle 수정
 *
 * 📝 참고사항:
 *    - Google 로그인만 구현됨
 *    - Naver 로그인은 미구현 상태 (클릭 시 알림 표시)
 *    - 버튼 아이콘은 외부 URL 이미지 사용
 *
 * ===================================================================================================
 */

import React from 'react';

/**
 * SocialLoginButtons - 소셜 로그인 버튼 컴포넌트
 *
 * @param {Object} props - 컴포넌트 props
 * @param {Function} props.googleLogin - Google 로그인 핸들러
 * @param {Function} props.showAlert - 알림 표시 함수
 *
 * @returns {JSX.Element} 소셜 로그인 버튼 UI
 */
const SocialLoginButtons = ({ googleLogin, showAlert }) => {
  const commonButtonStyle = "px-4 py-2 bg-white border border-gray-300 text-gray-800 rounded-md hover:bg-gray-50 flex items-center justify-start w-full";

  return (
    <>
      <div className="relative flex py-5 items-center">
        <div className="flex-grow border-t border-gray-300"></div>
        <span className="flex-shrink mx-4 text-gray-400 text-sm">또는</span>
        <div className="flex-grow border-t border-gray-300"></div>
      </div>
      <button onClick={() => googleLogin()} className={commonButtonStyle}>
        <img src="https://img.icons8.com/color/16/000000/google-logo.png" alt="Google" className="mr-4" />
        <span>Google 계정으로 로로그인</span>
      </button>
      <button
        onClick={() => showAlert('네이버 로그인 기능은 아직 구현되지 않았습니다.', 'info', '알림')}
        className={commonButtonStyle}
      >
        <img src="/naver.jpeg" alt="Naver" className="mr-4 w-4 h-4" />
        <span>Naver 계정으로 로그인</span>
      </button>
    </>
  );
};

export default SocialLoginButtons;