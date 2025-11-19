/**
 * ============================================================================
 * scheduleHandlers.js - 스케줄 관련 핸들러 함수들
 * ============================================================================
 */

import { addSchedulesToCalendar } from '../utils/scheduleUtils';
import { generateMultipleCombinations } from '../utils/chatUtils';

/**
 * 시간표 추출 완료 핸들러
 */
export const createSchedulesExtractedHandler = (
  setMessages,
  setExtractedScheduleData,
  setShowTimetableUpload,
  addSchedulesToCalendar
) => {
  return async (result) => {
    // 나이 필터링으로 0개가 된 경우
    if (result.type === 'age_filtered') {
      const botMessage = {
        id: Date.now(),
        text: `총 ${result.allSchedulesCount}개의 시간표를 찾았지만, 나이(${result.data.age}세)에 맞지 않아 필터링되었습니다.\n\n예상 학년부: ${result.data.gradeLevel === 'elementary' ? '초등부' : result.data.gradeLevel === 'middle' ? '중등부' : '고등부'}\n\n그래도 추가하시겠습니까?`,
        sender: 'bot',
        timestamp: new Date(),
        _nextStep: 'force_add_filtered_schedules',
        _scheduleData: result.data,
        _showButtons: true,
        _buttons: [
          { text: '예, 강제로 추가', value: '강제추가' },
          { text: '아니오', value: '취소' }
        ],
        _isScheduleMessage: true
      };
      setMessages(prev => [...prev, botMessage]);
      setExtractedScheduleData(result.data);
      setShowTimetableUpload(false);
      return;
    }

    // 충돌 여부와 관계없이 항상 모달을 보여줌
    const botMessage = {
      id: Date.now(),
      text: `총 ${result.data.schedules.length}개의 시간표를 찾았습니다.${result.data.conflicts.length > 0 ? ` (${result.data.conflicts.length}개의 충돌 발견)` : ''}\n시간표 예시를 보시겠습니까?`,
      sender: 'bot',
      timestamp: new Date(),
      _nextStep: 'show_schedule_examples',
      _scheduleData: result.data,
      _showButtons: true,
      _buttons: [
        { text: '예', value: '예' },
        { text: '아니오', value: '아니오' }
      ],
      _isScheduleMessage: true
    };
    setMessages(prev => [...prev, botMessage]);
    setExtractedScheduleData(result.data);
    setShowTimetableUpload(false);

    if (result.type === 'schedule_selected') {
      // 사용자가 최적 조합 중 하나를 선택함
      const schedules = result.schedules;
      const applyScope = result.applyScope || 'month';

      // 실제로 일정 추가
      const result_add = await addSchedulesToCalendar(schedules, applyScope);

      const botMessage = {
        id: Date.now(),
        text: result_add.success
          ? `선택하신 시간표 ${result_add.count}개를 일정에 추가했습니다! ✅ 프로필 탭에서 확인하세요!`
          : `시간표 추가 중 오류가 발생했습니다: ${result_add.error}`,
        sender: 'bot',
        timestamp: new Date(),
        success: result_add.success
      };
      setMessages(prev => [...prev, botMessage]);
    }
  };
};

/**
 * 스케줄 추가 핸들러
 */
export const createAddSchedulesHandler = (onSendMessage, setMessages) => {
  return async (schedules) => {
    try {
      // 로딩 메시지 추가
      const loadingMessage = {
        id: Date.now(),
        text: '일정을 추가하고 있습니다...',
        sender: 'bot',
        timestamp: new Date(),
        isLoading: true
      };
      setMessages(prev => [...prev, loadingMessage]);

      // 각 스케줄을 개별적으로 추가
      const results = [];
      for (const schedule of schedules) {
        try {
          const result = await onSendMessage(`"${schedule.title}" 일정을 ${schedule.date} ${schedule.time}에 추가해줘${schedule.location ? ` 장소: ${schedule.location}` : ''}`);
          results.push({
            schedule,
            success: result.success,
            message: result.message
          });
        } catch (error) {
          results.push({
            schedule,
            success: false,
            message: '일정 추가 중 오류가 발생했습니다.'
          });
        }
      }

      // 로딩 메시지 제거
      setMessages(prev => prev.filter(msg => !msg.isLoading));

      // 결과 메시지 생성
      const successCount = results.filter(r => r.success).length;
      const totalCount = results.length;

      const resultMessage = {
        id: Date.now() + 1,
        text: `총 ${totalCount}개 일정 중 ${successCount}개를 성공적으로 추가했습니다.`,
        sender: 'bot',
        timestamp: new Date(),
        success: successCount === totalCount
      };

      setMessages(prev => [...prev, resultMessage]);

    } catch (error) {
      // 로딩 메시지 제거
      setMessages(prev => prev.filter(msg => !msg.isLoading));

      const errorMessage = {
        id: Date.now() + 1,
        text: '일정 추가 중 오류가 발생했습니다.',
        sender: 'bot',
        timestamp: new Date(),
        success: false
      };

      setMessages(prev => [...prev, errorMessage]);
    }
  };
};

/**
 * "다시 짜줘" 명령 처리 핸들러
 */
export const handleRegenerateSchedules = (
  extractedScheduleData,
  setExtractedScheduleData,
  setShowScheduleModal,
  setMessages
) => {
  if (extractedScheduleData) {
    // 기존 스케줄 데이터로 다른 조합 생성
    const allSchedules = extractedScheduleData.allSchedulesBeforeFilter || extractedScheduleData.schedules || [];

    // 여러 조합 생성
    const combinations = generateMultipleCombinations(allSchedules);

    // extractedScheduleData 업데이트
    const updatedData = {
      ...extractedScheduleData,
      optimalCombinations: combinations,
      schedules: combinations[0]
    };

    setExtractedScheduleData(updatedData);
    setShowScheduleModal(true);

    const botMessage = {
      id: Date.now() + 1,
      text: `새로운 조합 ${combinations.length}개를 생성했습니다! 충돌 없는 최적 시간표를 확인해보세요 📅✨`,
      sender: 'bot',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, botMessage]);
    return true;
  } else {
    const botMessage = {
      id: Date.now() + 1,
      text: '먼저 시간표 이미지를 업로드해주세요! 그래야 다시 생성할 수 있어요 📸',
      sender: 'bot',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, botMessage]);
    return false;
  }
};
