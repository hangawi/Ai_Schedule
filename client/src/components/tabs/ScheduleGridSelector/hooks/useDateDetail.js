import { useState } from 'react';

/**
 * 날짜 상세 모달 관련 상태를 관리하는 커스텀 훅
 * @returns {Object} 날짜 상세 모달 상태 및 함수들
 */
const useDateDetail = () => {
  const [selectedDateForDetail, setSelectedDateForDetail] = useState(null);
  const [showDateDetailModal, setShowDateDetailModal] = useState(false);

  /**
   * 날짜 상세 모달 열기
   * @param {Date} date - 선택된 날짜
   */
  const openDateDetail = (date) => {
    setSelectedDateForDetail(date);
    setShowDateDetailModal(true);
  };

  /**
   * 날짜 상세 모달 닫기
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
