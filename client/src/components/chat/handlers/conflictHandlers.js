/**
 * ============================================================================
 * conflictHandlers.js - 충돌 처리 핸들러 함수들
 * ============================================================================
 */

import { API_BASE_URL } from '../constants/chatConstants';
import { generateAlternativeTimeRecommendations, generateRescheduleTimeRecommendations, createRecommendationMessage } from '../utils/timeRecommendation';
import { auth } from '../../../config/firebaseConfig';

/**
 * 충돌 선택 핸들러 생성 함수
 */
export const createConflictChoiceHandler = (
  currentTab,
  onSendMessage,
  setMessages,
  onEventUpdate
) => {
  return async (choice, pendingEvent, conflictingEvent) => {
    try {
      const loadingMessage = { id: Date.now(), text: '처리 중...', sender: 'bot', timestamp: new Date(), isLoading: true };
      setMessages(prev => [...prev, loadingMessage]);

      if (choice === 1) {
        // "다른 시간 추천" 선택
        setMessages(prev => prev.filter(msg => !msg.isLoading));

        const recommendations = generateAlternativeTimeRecommendations(
          pendingEvent,
          pendingEvent.allExistingEvents || []
        );

        const message = createRecommendationMessage(recommendations);

        const botMessage = {
          id: Date.now() + 1,
          text: message,
          sender: 'bot',
          timestamp: new Date(),
          success: recommendations.length > 0,
          recommendations: recommendations,
          pendingEvent: pendingEvent,
          _nextStep: 'select_alternative_time'
        };
        setMessages(prev => [...prev, botMessage]);
        return;

      } else if (choice === 2) {
        // "기존 일정 변경" 선택
        if (currentTab === 'profile' || currentTab === 'events') {
          // 프로필 탭과 나의 일정 탭은 동일한 로직 사용
          await handleRescheduleForProfileTab(
            pendingEvent,
            conflictingEvent,
            onSendMessage,
            setMessages,
            currentTab
          );
        } else {
          // 다른 탭 (구글 캘린더)은 백엔드 API 사용
          await handleRescheduleForOtherTabs(
            pendingEvent,
            conflictingEvent,
            setMessages
          );
        }
      }
    } catch (error) {
      setMessages(prev => prev.filter(msg => !msg.isLoading));
      const errorMessage = { id: Date.now() + 1, text: '처리 중 오류가 발생했습니다.', sender: 'bot', timestamp: new Date(), success: false };
      setMessages(prev => [...prev, errorMessage]);
    }
  };
};

/**
 * 프로필/이벤트 탭의 일정 변경 처리
 */
const handleRescheduleForProfileTab = async (
  pendingEvent,
  conflictingEvent,
  onSendMessage,
  setMessages,
  currentTab
) => {
  setMessages(prev => prev.filter(msg => !msg.isLoading));

  // Step 1: 기존 일정 삭제
  const deleteLoadingMessage = { id: Date.now(), text: '기존 일정을 삭제하고 있습니다...', sender: 'bot', timestamp: new Date(), isLoading: true };
  setMessages(prev => [...prev, deleteLoadingMessage]);

  const deleteResult = await onSendMessage({
    intent: 'delete_specific_event',
    eventId: conflictingEvent.id || conflictingEvent._id
  });

  setMessages(prev => prev.filter(msg => !msg.isLoading));
  const deleteResultMessage = { id: Date.now() + 1, text: deleteResult.message || '기존 일정을 삭제했습니다.', sender: 'bot', timestamp: new Date(), success: deleteResult.success !== false };
  setMessages(prev => [...prev, deleteResultMessage]);

  if (deleteResult.success === false) {
    return;
  }

  // Step 2: 새 일정을 원래 자리에 추가
  await new Promise(resolve => setTimeout(resolve, 800));
  const newEventLoadingMessage = { id: Date.now() + 2, text: '새 일정을 추가하고 있습니다...', sender: 'bot', timestamp: new Date(), isLoading: true };
  setMessages(prev => [...prev, newEventLoadingMessage]);

  const newPendingStart = new Date(pendingEvent.startTime);
  const newDateStr = `${newPendingStart.getMonth() + 1}월 ${newPendingStart.getDate()}일`;
  const newTimeStr = newPendingStart.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true });
  const newEventMessage = `${newDateStr} ${newTimeStr}에 "${pendingEvent.title}" 일정을 추가해줘`;
  const newEventResult = await onSendMessage(newEventMessage);

  setMessages(prev => prev.filter(msg => !msg.isLoading));
  const newEventResultMessage = { id: Date.now() + 3, text: newEventResult.message || '새 일정을 추가했습니다.', sender: 'bot', timestamp: new Date(), success: newEventResult.success !== false };
  setMessages(prev => [...prev, newEventResultMessage]);

  // Step 3: 기존 일정 옮길 시간 추천
  await new Promise(resolve => setTimeout(resolve, 500));

  // 최신 일정 목록 가져오기
  const updatedEvents = await fetchUpdatedEvents(conflictingEvent);

  const recommendations = generateRescheduleTimeRecommendations(
    conflictingEvent,
    updatedEvents
  );

  const message = createRecommendationMessage(recommendations, conflictingEvent);

  const botMessage = {
    id: Date.now() + 4,
    text: message,
    sender: 'bot',
    timestamp: new Date(),
    success: recommendations.length > 0,
    recommendations: recommendations,
    conflictingEvent: conflictingEvent,
    pendingEvent: pendingEvent,
    _nextStep: currentTab === 'profile' ? 'select_reschedule_time_profile' : 'select_reschedule_time_events'
  };
  setMessages(prev => [...prev, botMessage]);
};

/**
 * 다른 탭의 일정 변경 처리 (백엔드 API 사용)
 */
const handleRescheduleForOtherTabs = async (
  pendingEvent,
  conflictingEvent,
  setMessages
) => {
  try {
    setMessages(prev => prev.filter(msg => !msg.isLoading));

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setMessages(prev => [...prev, { id: Date.now(), text: '로그인이 필요합니다.', sender: 'bot', timestamp: new Date(), success: false }]);
      return;
    }
    const idToken = await currentUser.getIdToken();

    // Step 1: 기존 일정 삭제
    const deleteLoadingMessage = { id: Date.now(), text: '기존 일정을 삭제하고 있습니다...', sender: 'bot', timestamp: new Date(), isLoading: true };
    setMessages(prev => [...prev, deleteLoadingMessage]);

    const deleteResponse = await fetch(`${API_BASE_URL}/api/conflict/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({ conflictingEventId: conflictingEvent.id })
    });

    const deleteData = await deleteResponse.json();
    setMessages(prev => prev.filter(msg => !msg.isLoading));
    const deleteResultMessage = { id: Date.now() + 1, text: deleteData.message || '기존 일정을 삭제했습니다.', sender: 'bot', timestamp: new Date(), success: deleteResponse.ok };
    setMessages(prev => [...prev, deleteResultMessage]);

    if (!deleteResponse.ok) {
      return;
    }

    // Step 2: 새 일정을 원래 자리에 추가
    await new Promise(resolve => setTimeout(resolve, 800));
    const newEventLoadingMessage = { id: Date.now() + 2, text: '새 일정을 추가하고 있습니다...', sender: 'bot', timestamp: new Date(), isLoading: true };
    setMessages(prev => [...prev, newEventLoadingMessage]);

    const addResponse = await fetch(`${API_BASE_URL}/api/conflict/confirm-alternative`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({ pendingEvent })
    });

    const addData = await addResponse.json();
    setMessages(prev => prev.filter(msg => !msg.isLoading));
    const addResultMessage = { id: Date.now() + 3, text: addData.message || '새 일정을 추가했습니다.', sender: 'bot', timestamp: new Date(), success: addResponse.ok };
    setMessages(prev => [...prev, addResultMessage]);

    // Step 3: 기존 일정 옮길 시간 추천
    await new Promise(resolve => setTimeout(resolve, 500));

    const recommendResponse = await fetch(`${API_BASE_URL}/api/conflict/recommend-reschedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({ conflictingEventId: conflictingEvent.id })
    });

    const recommendData = await recommendResponse.json();
    const botMessage = {
      id: Date.now() + 4,
      text: recommendData.message,
      sender: 'bot',
      timestamp: new Date(),
      success: recommendResponse.ok,
      recommendations: recommendData.recommendations || [],
      conflictingEvent: conflictingEvent,
      pendingEvent: pendingEvent,
      _nextStep: 'select_reschedule_time'
    };
    setMessages(prev => [...prev, botMessage]);
  } catch (err) {
    setMessages(prev => prev.filter(msg => !msg.isLoading));
    const errorMessage = { id: Date.now() + 1, text: '처리 중 오류가 발생했습니다.', sender: 'bot', timestamp: new Date(), success: false };
    setMessages(prev => [...prev, errorMessage]);
  }
};

/**
 * 최신 일정 목록 가져오기 (프로필 탭용)
 */
const fetchUpdatedEvents = async (conflictingEvent) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return [];

    const scheduleResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
      headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` }
    });

    if (scheduleResponse.ok) {
      const scheduleData = await scheduleResponse.json();
      const targetDate = new Date(conflictingEvent.startTime).toISOString().split('T')[0];

      // scheduleExceptions와 personalTimes를 합침
      const exceptions = (scheduleData.scheduleExceptions || [])
        .filter(exc => exc.specificDate === targetDate);
      const personalTimes = (scheduleData.personalTimes || [])
        .filter(pt => pt.specificDate === targetDate)
        .map(pt => ({
          ...pt,
          startTime: `${targetDate}T${pt.startTime}:00+09:00`,
          endTime: `${targetDate}T${pt.endTime}:00+09:00`
        }));

      return [...exceptions, ...personalTimes];
    }
  } catch (error) {
    console.error('Error fetching updated events:', error);
  }
  return [];
};

/**
 * 시간 선택 핸들러 생성 함수
 */
export const createTimeSelectionHandler = (
  currentTab,
  onSendMessage,
  setMessages,
  onEventUpdate
) => {
  return async (selectedTime, pendingEvent, conflictingEvent, action, nextStep) => {
    try {
      const loadingMessage = { id: Date.now(), text: '일정을 확정하고 있습니다...', sender: 'bot', timestamp: new Date(), isLoading: true };
      setMessages(prev => [...prev, loadingMessage]);

      if (currentTab === 'profile' || currentTab === 'events') {
        if (action === 'reschedule' || nextStep === 'select_reschedule_time_profile' || nextStep === 'select_reschedule_time_events') {
          // 기존 일정을 선택한 시간에 추가
          const conflictingEventTitle = conflictingEvent?.title || '기존 일정';

          setMessages(prev => prev.filter(msg => !msg.isLoading));
          const rescheduleLoadingMessage = { id: Date.now(), text: '기존 일정을 옮기고 있습니다...', sender: 'bot', timestamp: new Date(), isLoading: true };
          setMessages(prev => [...prev, rescheduleLoadingMessage]);

          const selectedDate = new Date(selectedTime.startTime);
          const dateStr = `${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일`;
          const timeStr = selectedDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true });
          const rescheduleMessage = `${dateStr} ${timeStr}에 "${conflictingEventTitle}" 일정을 추가해줘`;
          const rescheduleResult = await onSendMessage(rescheduleMessage);

          setMessages(prev => prev.filter(msg => !msg.isLoading));
          const rescheduleResultMessage = { id: Date.now() + 1, text: rescheduleResult.message || '기존 일정을 옮겼습니다.', sender: 'bot', timestamp: new Date(), success: rescheduleResult.success !== false };
          setMessages(prev => [...prev, rescheduleResultMessage]);

          if (onEventUpdate) { onEventUpdate(); }
          window.dispatchEvent(new CustomEvent('calendarUpdate', {
            detail: { type: 'add', context: currentTab }
          }));
          return;
        }

        // Logic for action === 'alternative'
        const selectedDate = new Date(selectedTime.startTime);
        const dateStr = `${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일`;
        const timeStr = selectedDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true });
        const message = `${dateStr} ${timeStr}에 "${pendingEvent.title}" 일정을 추가해줘`;
        const result = await onSendMessage(message);
        setMessages(prev => prev.filter(msg => !msg.isLoading));
        const botMessage = { id: Date.now() + 1, text: result.message || '일정이 추가되었습니다.', sender: 'bot', timestamp: new Date(), success: result.success !== false };
        setMessages(prev => [...prev, botMessage]);
        if (result.success !== false) {
          if (onEventUpdate) { onEventUpdate(); }
          window.dispatchEvent(new Event('calendarUpdate'));
        }
        return;
      }
      // ... other tabs logic (구글 캘린더 등)
    } catch (error) {
      setMessages(prev => prev.filter(msg => !msg.isLoading));
      const errorMessage = { id: Date.now() + 1, text: '일정 확정 중 오류가 발생했습니다.', sender: 'bot', timestamp: new Date(), success: false };
      setMessages(prev => [...prev, errorMessage]);
    }
  };
};
