/**
 * ===================================================================================================
 * messageHandlers.js - 메시지 전송 및 채팅 관련 핸들러 함수들
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/chat/handlers
 *
 * 🎯 주요 기능:
 *    - 사용자 메시지 (텍스트 및 이미지) 전송 처리
 *    - "다시 짜줘"와 같은 특정 사용자 명령 처리 (일정 재생성)
 *    - 시간표 예시 보기 및 추가 확인 대화 흐름 관리
 *    - 로딩 메시지 및 에러 메시지 처리
 *    - 엔터 키 입력 시 메시지 전송 처리
 *
 * 🔗 연결된 파일:
 *    - ../../../config/firebaseConfig - Firebase 인증 모듈 (auth)
 *    - ./scheduleHandlers - 일정 관련 핸들러 (handleRegenerateSchedules)
 *    - ../utils/scheduleUtils - 일정 유틸리티 (addSchedulesToCalendar)
 *    - ../TimetableUploadWithChat.js - 이 핸들러를 사용하는 상위 컴포넌트
 *
 * 💡 UI 위치:
 *    - 챗봇 화면 > 메시지 입력창, 이미지 업로드 섹션
 *
 * ✏️ 수정 가이드:
 *    - 특정 키워드에 대한 챗봇 응답 로직 추가: `createSendHandler` 내 `if (userInputLower...)` 블록 추가
 *    - 메시지 전송 로직 변경: `createSendHandler` 내 API 호출 부분 수정
 *    - 이미지 분석 로직 변경: `createSendHandler` 내 `if (originalImage)` 블록 수정
 *    - 새로운 대화 흐름 추가: `_nextStep` 기반의 조건부 로직 추가
 *
 * 📝 참고사항:
 *    - `auth.currentUser`를 통해 사용자 인증 토큰을 가져와 API 요청에 사용
 *    - 메시지 전송 후 입력창 초기화 및 이미지 제거 처리
 *    - 로딩 상태를 사용자에게 명확히 표시하기 위한 로딩 메시지 사용
 *
 * ===================================================================================================
 */

import { auth } from '../../../config/firebaseConfig';
import { handleRegenerateSchedules } from './scheduleHandlers';
import { addSchedulesToCalendar } from '../utils/scheduleUtils';

/**
 * createSendHandler
 *
 * @description 사용자 입력 (텍스트 및 이미지)을 처리하고 메시지를 전송하는 비동기 핸들러를 생성합니다.
 *              특정 명령어를 감지하여 일정 재생성, 시간표 추가 확인 등 대화 흐름을 제어합니다.
 * @param {Array<Object>} messages - 현재 채팅 메시지 목록 상태
 * @param {string} inputText - 현재 입력 필드의 텍스트 상태
 * @param {File | null} selectedImage - 현재 선택된 이미지 파일 상태
 * @param {Object | null} extractedScheduleData - 추출된 일정 데이터 상태
 * @param {Function} onSendMessage - 일반 텍스트 메시지를 처리하는 콜백 함수 (API 호출)
 * @param {Function} setMessages - 메시지 목록 상태를 업데이트하는 셋터 함수
 * @param {Function} setInputText - 입력 필드의 텍스트 상태를 업데이트하는 셋터 함수
 * @param {Function} setShowScheduleModal - 시간표 모달 표시 여부 상태를 업데이트하는 셋터 함수
 * @param {Function} setExtractedScheduleData - 추출된 일정 데이터 상태를 업데이트하는 셋터 함수
 * @param {Function} removeImage - 선택된 이미지를 제거하는 콜백 함수
 * @param {Function} onEventUpdate - 일정 변경 시 호출되는 콜백 함수
 * @returns {Function} 메시지 전송을 처리하는 비동기 함수
 *
 * @example
 * // TimetableUploadWithChat 컴포넌트 내에서 사용 예시
 * const handleSend = createSendHandler(
 *   messages, inputText, selectedImage, extractedScheduleData, onSendMessage,
 *   setMessages, setInputText, setShowScheduleModal, setExtractedScheduleData,
 *   removeImage, onEventUpdate
 * );
 * <button onClick={handleSend}>전송</button>
 *
 * @note
 * - `inputText`가 비어있고 `selectedImage`가 없으면 아무 작업도 수행하지 않습니다.
 * - '다시 짜줘'와 같은 키워드를 포함하는 사용자 입력은 `handleRegenerateSchedules`를 호출하여 처리합니다.
 * - 챗봇의 `_nextStep`을 기반으로 시간표 예시 보기, 시간표 추가 확인 등 복잡한 대화 흐름을 관리합니다.
 * - 이미지가 있는 경우 이미지 분석 API를, 텍스트만 있는 경우 일반 메시지 API를 호출합니다.
 * - API 호출 중 로딩 메시지를 표시하여 사용자 경험을 향상시킵니다.
 * - 인증된 사용자만 API 요청을 보낼 수 있도록 `auth.currentUser.getIdToken()`을 사용합니다.
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
 * createKeyPressHandler
 *
 * @description 키보드 입력(특히 Enter 키)을 처리하여 메시지 전송 핸들러를 호출하는 함수를 생성합니다.
 * @param {Function} handleSend - 메시지를 전송하는 함수
 * @returns {Function} 키보드 이벤트 핸들러
 *
 * @example
 * // ChatInput 컴포넌트 내에서 사용 예시
 * const handleKeyPress = createKeyPressHandler(handleSend);
 * <textarea onKeyPress={handleKeyPress} />
 *
 * @note
 * - Shift 키와 함께 Enter 키를 누르면 줄바꿈이 가능합니다.
 * - Shift 키 없이 Enter 키를 누르면 `event.preventDefault()`를 통해 기본 동작(줄바꿈)을 막고 `handleSend()`를 호출합니다.
 */
export const createKeyPressHandler = (handleSend) => {
  return (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
};
