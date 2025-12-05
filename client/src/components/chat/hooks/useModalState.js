/**
 * ===================================================================================================
 * useModalState.js - 모달 관련 상태 관리 커스텀 훅
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/chat/hooks
 *
 * 🎯 주요 기능:
 *    - 시간표 최적화 모달(`ScheduleOptimizationModal`)의 표시 여부 상태 관리
 *    - 모달 내 슬라이드 애니메이션 방향 상태 관리
 *    - 중복 이미지 정보(`duplicateInfo`) 및 중복 이미지 모달 표시 여부 상태 관리
 *
 * 🔗 연결된 파일:
 *    - ../components/TimetableUploadWithChat.js - 이 훅을 사용하여 모달 관련 상태를 종합적으로 관리
 *    - ../components/DuplicateModal.js - `showDuplicateModal`, `duplicateInfo` 상태를 사용
 *    - ../../modals/ScheduleOptimizationModal.js - `showOptimizationModal` 상태를 사용
 *
 * 💡 UI 위치:
 *    - 챗봇 화면 > 시간표 추출 후 나타나는 '일정 최적화 모달'
 *    - 챗봇 화면 > 이미지 업로드 시 나타나는 '중복 이미지 확인 모달'
 *
 * ✏️ 수정 가이드:
 *    - 새로운 모달 상태 추가: 이 훅에 `useState`를 추가하여 관련 상태를 중앙에서 관리
 *    - 슬라이드 애니메이션 로직 변경: `slideDirection` 상태를 사용하는 컴포넌트에서 로직 수정
 *
 * 📝 참고사항:
 *    - 이 훅은 `TimetableUploadWithChat` 컴포넌트에서 사용되는 다양한 모달들의 상태를
 *      한 곳에서 관리하여 코드의 복잡성을 줄이고 가독성을 높입니다.
 *
 * ===================================================================================================
 */

import { useState } from 'react';

/**
 * useModalState
 *
 * @description `TimetableUploadWithChat` 컴포넌트와 관련된 여러 모달들의 상태를 관리하는 커스텀 훅입니다.
 * @returns {Object} 모달 관련 상태와 해당 상태를 업데이트하는 셋터 함수들을 포함하는 객체
 *
 * @property {boolean} showOptimizationModal - 시간표 최적화 모달의 표시 여부
 * @property {Function} setShowOptimizationModal - `showOptimizationModal` 상태를 업데이트하는 함수
 * @property {string} slideDirection - 슬라이드 애니메이션의 방향 ('left' 또는 'right')
 * @property {Function} setSlideDirection - `slideDirection` 상태를 업데이트하는 함수
 * @property {Object | null} duplicateInfo - 중복 이미지에 대한 정보
 * @property {Function} setDuplicateInfo - `duplicateInfo` 상태를 업데이트하는 함수
 * @property {boolean} showDuplicateModal - 중복 이미지 모달의 표시 여부
 * @property {Function} setShowDuplicateModal - `showDuplicateModal` 상태를 업데이트하는 함수
 *
 * @example
 * // TimetableUploadWithChat 컴포넌트 내에서 사용
 * const {
 *   showOptimizationModal,
 *   setShowOptimizationModal,
 *   showDuplicateModal,
 *   setShowDuplicateModal
 * } = useModalState();
 */
export const useModalState = () => {
  const [showOptimizationModal, setShowOptimizationModal] = useState(false);
  const [slideDirection, setSlideDirection] = useState('left');
  const [duplicateInfo, setDuplicateInfo] = useState(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  return {
    showOptimizationModal,
    setShowOptimizationModal,
    slideDirection,
    setSlideDirection,
    duplicateInfo,
    setDuplicateInfo,
    showDuplicateModal,
    setShowDuplicateModal
  };
};
