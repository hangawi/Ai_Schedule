/**
 * ===================================================================================================
 * index.js - React 애플리케이션 엔트리 포인트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/index.js
 *
 * 🎯 주요 기능:
 *    - React 애플리케이션을 DOM에 마운트
 *    - React.StrictMode로 개발 모드 검사 활성화
 *    - 전역 CSS 스타일 로드
 *
 * 🔗 연결된 파일:
 *    - ./App.js - 최상위 App 컴포넌트
 *    - ./index.css - 전역 CSS 스타일
 *    - public/index.html - HTML 템플릿 (root div)
 *
 * 💡 UI 위치:
 *    - 앱의 시작점, 모든 화면의 기반
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 앱 초기화 방식이 변경됨
 *    - 전역 Provider 추가: App을 감싸는 Provider 추가
 *    - StrictMode 제거: 개발 모드 검사를 비활성화할 경우
 *
 * 📝 참고사항:
 *    - React 18+ createRoot API 사용
 *    - StrictMode는 개발 모드에서만 작동 (프로덕션에서는 영향 없음)
 *    - HTML의 'root' id를 가진 div에 앱이 렌더링됨
 *
 * ===================================================================================================
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
