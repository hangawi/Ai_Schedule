/**
 * ===================================================================================================
 * useDateDetail.js - 날짜 상세 모달 상태 관리 훅
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/ScheduleGridSelector/hooks
 *
 * 🎯 주요 기능:
 *    - 날짜 상세 모달 표시 상태 관리
 *    - 선택된 날짜 정보 상태 관리
 *    - 모달 열기/닫기 함수 제공
 *
 * 🔗 연결된 파일:
 *    - ../index.js (ScheduleGridSelector) - 이 훅을 사용하여 모달 상태 관리
 *    - ../components/DateDetailModal.js - 모달 표시 여부 및 날짜 정보 전달
 *    - ../components/MonthView.js - 날짜 클릭 시 openDateDetail 호출
 *
 * 💡 UI 위치:
 *    - 탭: 프로필 탭
 *    - 섹션: 월간 뷰
 *    - 경로: 앱 실행 > 프로필 탭 > 스케줄 그리드 > 월간 뷰 > 날짜 클릭
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 날짜 상세 모달의 동작 방식이 변경됨
 *    - 모달 상태 추가: useState 훅 추가 및 반환 객체에 포함
 *    - 열기/닫기 로직 변경: openDateDetail, closeDateDetail 함수 수정
 *
 * 📝 참고사항:
 *    - useState를 사용한 간단한 상태 관리 훅
 *    - selectedDateForDetail: 선택된 날짜 데이터 (date, dayOfWeek 등)
 *    - showDateDetailModal: 모달 표시 여부 (boolean)
 *
 * ===================================================================================================
 */

import { useState } from 'react';

/**
 * useDateDetail - 날짜 상세 모달 관련 상태를 관리하는 커스텀 훅
 *
 * @description 월간 뷰에서 날짜 클릭 시 상세 시간표 모달을 표시하기 위한 상태 관리
 * @returns {Object} 날짜 상세 모달 상태 및 함수들
 * @returns {Object|null} return.selectedDateForDetail - 선택된 날짜 데이터
 * @returns {boolean} return.showDateDetailModal - 모달 표시 여부
 * @returns {Function} return.openDateDetail - 모달 열기 함수
 * @returns {Function} return.closeDateDetail - 모달 닫기 함수
 * @returns {Function} return.setSelectedDateForDetail - 선택된 날짜 설정 함수
 * @returns {Function} return.setShowDateDetailModal - 모달 표시 여부 설정 함수
 *
 * @example
 * const {
 *   selectedDateForDetail,
 *   showDateDetailModal,
 *   openDateDetail,
 *   closeDateDetail
 * } = useDateDetail();
 *
 * // 날짜 클릭 시
 * openDateDetail({ date: new Date(), dayOfWeek: 1 });
 *
 * @note
 * - openDateDetail 호출 시 모달이 열리고 날짜 정보 저장
 * - closeDateDetail 호출 시 모달이 닫히고 날짜 정보 초기화
 */
const useDateDetail = () => {
  const [selectedDateForDetail, setSelectedDateForDetail] = useState(null);
  const [showDateDetailModal, setShowDateDetailModal] = useState(false);

  /**
   * openDateDetail - 날짜 상세 모달 열기
   *
   * @description 선택된 날짜 정보를 저장하고 모달을 표시
   * @param {Object} date - 선택된 날짜 정보
   * @param {Date} date.date - 날짜 객체
   * @param {number} date.dayOfWeek - 요일 (0=일, 1=월, ...)
   *
   * @example
   * openDateDetail({
   *   date: new Date('2025-12-08'),
   *   dayOfWeek: 1,
   *   hasSchedule: true
   * });
   *
   * @note
   * - 모달이 열리면 DateDetailModal 컴포넌트가 렌더링됨
   */
  const openDateDetail = (date) => {
    setSelectedDateForDetail(date);
    setShowDateDetailModal(true);
  };

  /**
   * closeDateDetail - 날짜 상세 모달 닫기
   *
   * @description 모달을 닫고 선택된 날짜 정보를 초기화
   *
   * @example
   * <button onClick={closeDateDetail}>닫기</button>
   *
   * @note
   * - 모달이 닫히면 selectedDateForDetail이 null로 초기화됨
   */
  const closeDateDetail = () => {
    setShowDateDetailModal(false);
    setSelectedDateForDetail(null);
  };

  return {
    selectedDateForDetail,
    showDateDetailModal,
    openDateDetail,
    closeDateDetail,
    setSelectedDateForDetail,
    setShowDateDetailModal
  };
};

export default useDateDetail;
