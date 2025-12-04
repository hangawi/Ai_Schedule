/**
 * ===================================================================================================
 * [ScheduleButtons.js] - AI 채팅창 내 스케줄 관련 액션 버튼 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > client/src/components/chat/components/ScheduleButtons.js
 *
 * 🎯 주요 기능:
 *    - AI 메시지에 대한 사용자의 '예/아니오' 또는 특정 액션 선택 버튼 렌더링
 *    - '최적 시간표 예시 보기', '필터링 전 전체 스케줄 추가' 등 다양한 후속 작업 트리거
 *    - 스케줄 추가 확인 및 결과 메시지 표시
 *
 * 🔗 연결된 파일:
 *    - ../MessageBubble.js: AI 응답 메시지 내에서 사용자 상호작용을 위한 버튼 그룹을 표시
 *    - ../../modals/ScheduleOptimizationModal.js: '최적 시간표 예시 보기' 액션 시 해당 모달을 호출
 *
 * 💡 UI 위치:
 *    - AI 채팅창 내, AI의 질문이나 제안 메시지 아래에 버튼 형태로 표시됨
 *
 * ✏️ 수정 가이드:
 *    - 새로운 버튼 유형이나 `nextStep`에 따른 동작을 추가하려면: `handleClick` 함수 내의 `if/else if` 로직을 확장합니다.
 *    - 버튼의 텍스트나 스타일을 변경하려면: `buttons.map` 내부의 `<button>` 요소의 내용을 수정합니다.
 *
 * 📝 참고사항:
 *    - `buttons` prop이 비어있거나 `null`이면 아무것도 렌더링하지 않습니다.
 *    - `nextStep`과 `button.value`를 조합하여 복합적인 상호작용 로직을 구현합니다.
 *
 * ===================================================================================================
 */
import React from 'react';

/**
 * ScheduleButtons
 *
 * @description AI 채팅창에서 스케줄 관련 질문이나 제안에 대한 사용자 응답 버튼 그룹을 렌더링합니다.
 *              버튼 클릭 시 `nextStep`과 `button.value`에 따라 다양한 액션을 수행합니다.
 * @param {object} props - 컴포넌트 props
 * @param {Array<object>} props.buttons - 렌더링할 버튼 객체 배열. 각 객체는 { text: string, value: string } 형태를 가짐.
 * @param {string} props.nextStep - 현재 AI 대화의 다음 단계(로직 분기점)를 나타내는 문자열.
 * @param {object} props.scheduleData - 전체 스케줄 데이터 (주로 `TimetableUploadWithChat`에서 추출된 데이터).
 * @param {Array<object>} props.schedules - 버튼 액션과 관련된 특정 스케줄 배열.
 * @param {function} [props.onButtonClick] - 모든 버튼 클릭 시 공통으로 호출되는 선택적 콜백 함수.
 * @param {function} props.onAddSchedules - 스케줄 추가 요청 시 호출되는 콜백 함수.
 * @param {function} props.onShowModal - '최적 시간표 예시' 모달 표시를 요청하는 콜백 함수.
 * @param {function} props.setExtractedScheduleData - 추출된 스케줄 데이터를 업데이트하는 함수.
 * @param {function} props.setShowScheduleModal - 스케줄 최적화 모달의 표시 여부를 설정하는 함수.
 * @param {function} props.setMessages - 채팅 메시지 목록을 업데이트하는 함수.
 * @param {function} props.setInputText - 채팅 입력 필드의 텍스트를 설정하는 함수.
 * @param {function} props.handleSend - 메시지 전송 로직을 트리거하는 함수.
 * @returns {JSX.Element|null} `buttons` 배열이 비어있으면 null을 반환, 그렇지 않으면 버튼 그룹을 렌더링.
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