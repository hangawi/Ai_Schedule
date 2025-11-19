/**
 * ============================================================================
 * messageHandlers.js - 메시지 전송 관련 핸들러 함수들
 * ============================================================================
 */

import { auth } from '../../../config/firebaseConfig';
import { handleRegenerateSchedules } from './scheduleHandlers';
import { addSchedulesToCalendar } from '../utils/scheduleUtils';

/**
 * 메시지 전송 핸들러 생성 함수
 */
export const createSendHandler = (
  messages,
  inputText,
  selectedImage,
  extractedScheduleData,
  onSendMessage,
  setMessages,
  setInputText,
  setShowScheduleModal,
  setExtractedScheduleData,
  removeImage,
  onEventUpdate
) => {
  return async () => {
    if (!inputText.trim() && !selectedImage) return;

    // 마지막 봇 메시지 확인 (시간표 예시 보기 처리)
    const lastBotMessage = messages.filter(m => m.sender === 'bot').pop();

    // "다시 짜줘" 명령 처리
    const userInputLower = inputText.trim().toLowerCase();
    if ((userInputLower.includes('다시') && (userInputLower.includes('짜') || userInputLower.includes('생성') || userInputLower.includes('조합'))) ||
        userInputLower.includes('재생성') ||
        userInputLower.includes('다른 조합') ||
        userInputLower.includes('다른거')) {

      // 사용자 메시지 먼저 추가
      const userMessage = {
        id: Date.now(),
        text: inputText,
        sender: 'user',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);
      setInputText('');

      const handled = handleRegenerateSchedules(
        extractedScheduleData,
        setExtractedScheduleData,
        setShowScheduleModal,
        setMessages
      );

      if (handled) return;
    }

    // 시간표 예시 보기 처리
    if (lastBotMessage?._nextStep === 'show_schedule_examples') {
      const userResponse = inputText.trim().toLowerCase();

      const userMessage = {
        id: Date.now(),
        text: inputText,
        sender: 'user',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);
      setInputText('');

      if (userResponse.includes('예') || userResponse.includes('네') ||
          userResponse.includes('yes') || userResponse.includes('보여') || userResponse.includes('응')) {
        // 모달 표시
        setShowScheduleModal(true);
        const botMessage = {
          id: Date.now() + 1,
          text: '최적 시간표 예시를 보여드립니다. 원하시는 조합을 선택해주세요! 📅',
          sender: 'bot',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botMessage]);
        return;
      } else {
        // 사용자가 거절한 경우
        const botMessage = {
          id: Date.now() + 1,
          text: '알겠습니다. 원본 시간표를 그대로 적용하시겠습니까? (예/아니오)',
          sender: 'bot',
          timestamp: new Date(),
          _nextStep: 'confirm_add_schedules',
          _schedules: lastBotMessage._scheduleData?.schedules
        };
        setMessages(prev => [...prev, botMessage]);
        return;
      }
    }

    // 시간표 추가 확인 처리
    if (lastBotMessage?._nextStep === 'confirm_add_schedules') {
      const userResponse = inputText.trim().toLowerCase();

      const userMessage = {
        id: Date.now(),
        text: inputText,
        sender: 'user',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);
      setInputText('');

      if (userResponse.includes('예') || userResponse.includes('네') ||
          userResponse.includes('yes') || userResponse.includes('응')) {

        // 실제로 일정 추가
        const result = await addSchedulesToCalendar(lastBotMessage._schedules, 'month', onEventUpdate);

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
        return;
      } else {
        const botMessage = {
          id: Date.now() + 1,
          text: '알겠습니다. 시간표 추가를 취소했습니다.',
          sender: 'bot',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botMessage]);
        return;
      }
    }

    // 일반 메시지 처리
    const userMessage = {
      id: Date.now(),
      text: selectedImage ? (inputText.trim() || '사진에서 일정을 추출해주세요') : inputText,
      sender: 'user',
      timestamp: new Date(),
      image: selectedImage ? URL.createObjectURL(selectedImage) : null
    };

    setMessages(prev => [...prev, userMessage]);
    const originalMessage = inputText;
    const originalImage = selectedImage;

    setInputText('');
    removeImage();

    // 로딩 메시지 표시
    const loadingMessage = {
      id: Date.now() + 1,
      text: originalImage ? '사진에서 일정을 분석하고 있습니다...' : '일정을 처리하고 있습니다...',
      sender: 'bot',
      timestamp: new Date(),
      isLoading: true
    };

    setMessages(prev => [...prev, loadingMessage]);

    try {
      let result;
      if (originalImage) {
        // 이미지가 있는 경우 이미지 분석 API 호출
        const formData = new FormData();
        formData.append('image', originalImage);
        if (originalMessage.trim()) {
          formData.append('message', originalMessage);
        }

        const currentUser = auth.currentUser;
        if (!currentUser) {
          throw new Error('로그인이 필요합니다.');
        }
        const response = await fetch('/api/calendar/analyze-image', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${await currentUser.getIdToken()}`
          },
          body: formData
        });

        result = await response.json();
      } else {
        // 텍스트만 있는 경우 기존 API 호출
        // 최근 메시지 5개를 컨텍스트로 전달 (현재 메시지 제외)
        const recentMessages = messages.slice(-5).map(msg => ({
          text: msg.text,
          sender: msg.sender
        }));
        result = await onSendMessage(originalMessage, { recentMessages });
      }

      // 로딩 메시지 제거하고 실제 응답 추가
      setMessages(prev => prev.filter(msg => !msg.isLoading));

      const botMessage = {
        id: Date.now() + 2,
        text: result.message,
        sender: 'bot',
        timestamp: new Date(),
        success: result.success,
        extractedSchedules: result.extractedSchedules,
        suggestedTimes: result.suggestedTimes,
        hasConflict: result.hasConflict,
        conflictingEvents: result.conflictingEvents,
        pendingEvent: result.pendingEvent,
        actions: result.actions,
        _nextStep: result._nextStep
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      setMessages(prev => prev.filter(msg => !msg.isLoading));

      const errorMessage = {
        id: Date.now() + 2,
        text: '죄송합니다. 오류가 발생했습니다.',
        sender: 'bot',
        timestamp: new Date(),
        success: false
      };

      setMessages(prev => [...prev, errorMessage]);
    }
  };
};

/**
 * 키보드 입력 핸들러 생성 함수
 */
export const createKeyPressHandler = (handleSend) => {
  return (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
};
