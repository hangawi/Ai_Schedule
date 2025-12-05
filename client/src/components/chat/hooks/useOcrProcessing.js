/**
 * ===================================================================================================
 * useOcrProcessing.js - OCR 처리 관련 상태 관리 커스텀 훅
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/chat/hooks
 *
 * 🎯 주요 기능:
 *    - OCR 처리 중인지 여부(`isProcessing`) 상태 관리
 *    - OCR 처리 진행률(`progress`) 상태 관리 (현재값, 총량, 메시지 포함)
 *    - OCR 처리 중 발생한 에러(`error`) 상태 관리
 *
 * 🔗 연결된 파일:
 *    - ../components/TimetableUploadWithChat.js - 이 훅을 사용하여 OCR 처리 상태를 관리
 *    - ../handlers/ocrHandlers.js - 이 훅이 관리하는 상태를 업데이트하는 핸들러들이 위치
 *
 * 💡 UI 위치:
 *    - 챗봇 화면 > 이미지 업로드 후 OCR이 진행되는 동안의 프로그레스 바 및 에러 메시지
 *
 * ✏️ 수정 가이드:
 *    - 진행률 표시 방식 변경: `progress` 상태 객체의 구조를 변경하거나, 이를 사용하는 컴포넌트에서 렌더링 로직 수정
 *    - 새로운 OCR 관련 상태 추가: 이 훅에 `useState`를 추가하여 관리
 *
 * 📝 참고사항:
 *    - 이 훅은 OCR 처리와 관련된 UI 상태(로딩, 진행률, 에러)를 캡슐화하여,
 *      `TimetableUploadWithChat` 컴포넌트의 가독성을 높이고 로직을 분리합니다.
 *
 * ===================================================================================================
 */

import { useState } from 'react';

/**
 * useOcrProcessing
 *
 * @description OCR(이미지 인식) 처리 과정과 관련된 상태(진행 여부, 진행률, 에러)를 관리하는 커스텀 훅입니다.
 * @returns {Object} OCR 처리 관련 상태와 해당 상태를 업데이트하는 셋터 함수들을 포함하는 객체
 *
 * @property {boolean} isProcessing - OCR 처리가 현재 진행 중인지 여부
 * @property {Function} setIsProcessing - `isProcessing` 상태를 업데이트하는 함수
 * @property {Object} progress - OCR 처리 진행률 정보 객체
 * @property {number} progress.current - 현재 진행 값
 * @property {number} progress.total - 전체 진행량
 * @property {string} progress.message - 현재 진행 상태에 대한 메시지
 * @property {Function} setProgress - `progress` 상태를 업데이트하는 함수
 * @property {string | null} error - OCR 처리 중 발생한 에러 메시지
 * @property {Function} setError - `error` 상태를 업데이트하는 함수
 *
 * @example
 * // TimetableUploadWithChat 컴포넌트 내에서 사용
 * const { isProcessing, progress, error, setError } = useOcrProcessing();
 *
 * if (isProcessing) {
 *   return <ProgressBar progress={progress} />;
 * }
 * if (error) {
 *   return <ErrorMessage message={error} />;
 * }
 */
export const useOcrProcessing = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
  const [error, setError] = useState(null);

  return {
    isProcessing,
    setIsProcessing,
    progress,
    setProgress,
    error,
    setError
  };
};
