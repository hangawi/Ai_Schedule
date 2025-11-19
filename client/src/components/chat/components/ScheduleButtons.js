/**
 * ============================================================================
 * ScheduleButtons.js - 스케줄 선택 버튼 컴포넌트
 * ============================================================================
 */

import React from 'react';

/**
 * 예/아니오 버튼 컴포넌트
 */
const ScheduleButtons = ({
  buttons,
  nextStep,
  scheduleData,
  schedules,
  onButtonClick,
  onAddSchedules,
  onShowModal,
  setExtractedScheduleData,
  setShowScheduleModal,
  setMessages,
  setInputText,
  handleSend
}) => {
  if (!buttons || buttons.length === 0) return null;

  const handleClick = (button) => {
    // "예" 버튼이면 바로 모달 열기
    if (button.value === '예' && nextStep === 'show_schedule_examples') {
      if (onShowModal) {
        onShowModal();
      }
    } else if (button.value === '강제추가' && nextStep === 'force_add_filtered_schedules') {
      // 필터링 전 전체 스케줄로 모달 열기
      const updatedData = {
        ...scheduleData,
        schedules: scheduleData.allSchedulesBeforeFilter,
        conflicts: [],
        optimalCombinations: [scheduleData.allSchedulesBeforeFilter]
      };
      setExtractedScheduleData(updatedData);
      setShowScheduleModal(true);
    } else if (button.value === '예' && nextStep === 'confirm_add_schedules') {
      // 시간표 추가
      onAddSchedules(schedules).then(result => {
        const botMessage = {
          id: Date.now() + 1,
          text: result.success
            ? `시간표 ${result.count}개를 일정에 추가했습니다! ✅ 프로필 탭에서 확인하세요!`
            : `시간표 추가 중 오류가 발생했습니다: ${result.error}`,
          sender: 'bot',
          timestamp: new Date(),
          success: result.success
        };
        setMessages(prev => [...prev, botMessage]);
      });
    } else {
      // "아니오"는 기본 처리
      setInputText(button.value);
      setTimeout(() => handleSend(), 100);
    }

    if (onButtonClick) {
      onButtonClick(button);
    }
  };

  return (
    <div className="mt-3 p-2 bg-white bg-opacity-20 rounded border">
      <div className="space-y-2">
        {buttons.map((button, index) => (
          <button
            key={index}
            onClick={() => handleClick(button)}
            className="w-full px-3 py-2 bg-white bg-opacity-40 hover:bg-opacity-60 rounded text-xs text-left transition-all font-medium"
          >
            {button.text}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ScheduleButtons;
