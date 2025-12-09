/**
 * ===================================================================================================
 * ErrorState.js - 에러 상태 표시 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/ProfileTab/components
 *
 * 🎯 주요 기능:
 *    - 프로필 탭에서 에러 발생 시 에러 메시지 표시
 *    - 간단한 빨간색 텍스트로 에러 상태 UI 렌더링
 *
 * 🔗 연결된 파일:
 *    - ../index.js (ProfileTab) - 에러 상태일 때 이 컴포넌트 렌더링
 *    - ../hooks/useProfileData.js - 데이터 로드 실패 시 에러 전달
 *
 * 💡 UI 위치:
 *    - 탭: 프로필 탭 (ProfileTab)
 *    - 섹션: 전체 화면 (에러 발생 시)
 *    - 경로: 앱 실행 > 프로필 탭 > 데이터 로드 실패 시 표시
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 에러 상태 UI가 변경됨
 *    - 에러 스타일 변경: text-red-500 클래스 수정
 *    - 에러 메시지 형식 변경: return 문의 JSX 수정
 *    - 자세한 에러 정보 추가: error 객체의 추가 속성 표시
 *
 * 📝 참고사항:
 *    - 매우 간단한 에러 표시 컴포넌트 (재사용 가능)
 *    - props로 error 문자열을 받아 표시
 *    - Tailwind CSS 사용 (text-red-500)
 *
 * ===================================================================================================
 */

// 에러 상태 컴포넌트

import React from 'react';

/**
 * ErrorState - 에러 상태 표시 컴포넌트
 *
 * @description 데이터 로드 실패 등 에러 발생 시 에러 메시지를 표시하는 UI 컴포넌트
 * @param {Object} props - 컴포넌트 props
 * @param {string} props.error - 표시할 에러 메시지
 * @returns {JSX.Element} 에러 상태 UI
 *
 * @example
 * <ErrorState error="데이터를 불러오는 데 실패했습니다." />
 *
 * @note
 * - 빨간색 텍스트로 에러 메시지 표시
 * - 간단한 재사용 가능한 에러 UI 컴포넌트
 */
export const ErrorState = ({ error }) => {
  return <div className="text-red-500">오류: {error}</div>;
};
