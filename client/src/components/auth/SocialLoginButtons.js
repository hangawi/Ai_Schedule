import React from 'react';

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
        <span>Google 계정으로 로그인</span>
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