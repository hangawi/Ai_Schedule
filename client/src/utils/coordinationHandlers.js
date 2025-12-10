/**
 * Coordination API handlers and business logic
 */

import { coordinationService } from '../services/coordinationService';
import { days, getDayIndex, calculateEndTime } from './coordinationUtils';
import { auth } from '../config/firebaseConfig';

/**
 * Handle reset carryover times
 */
export const handleResetCarryOverTimes = async (currentRoom, fetchRoomDetails, setCurrentRoom, showAlert) => {
  if (!currentRoom?._id) return;

  try {
    const apiUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
    const response = await fetch(`${apiUrl}/api/coordination/reset-carryover/${currentRoom._id}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to reset carryover times');
    }

    const result = await response.json();
    showAlert(`${result.resetCount}명의 멤버 이월시간이 초기화되었습니다.`);

    // Immediately update room data without refresh
    if (result.room) {
      setCurrentRoom(result.room);
    } else {
      // Fallback to refresh if room data not returned
      await fetchRoomDetails(currentRoom._id);
    }
  } catch (error) {
    showAlert(`이월시간 초기화 실패: ${error.message}`);
  }
};

/**
 * Handle reset completed times
 */
export const handleResetCompletedTimes = async (currentRoom, fetchRoomDetails, setCurrentRoom, showAlert) => {
  if (!currentRoom?._id) return;

  try {
    const apiUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
    const response = await fetch(`${apiUrl}/api/coordination/reset-completed/${currentRoom._id}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to reset completed times');
    }

    const result = await response.json();
    showAlert(`${result.resetCount}명의 멤버 완료시간이 초기화되었습니다.`);

    // Immediately update room data without refresh
    if (result.room) {
      setCurrentRoom(result.room);
    } else {
      // Fallback to refresh if room data not returned
      await fetchRoomDetails(currentRoom._id);
    }
  } catch (error) {
    showAlert(`완료시간 초기화 실패: ${error.message}`);
  }
};

/**
 * Handle auto-scheduling
 */
export const handleRunAutoSchedule = async (
  currentRoom,
  currentWeekStartDate,
  user,
  scheduleOptions,
  setIsScheduling,
  setScheduleError,
  setUnassignedMembersInfo,
  setConflictSuggestions,
  setCurrentRoom,
  showAlert,
  viewMode = 'week',
  travelMode = 'normal' // Add travelMode parameter
) => {
  if (!currentRoom || !currentWeekStartDate) {
    showAlert('현재 방 정보나 주차 정보가 없습니다.');
    return;
  }

  // Check if there are any members
  const nonOwnerMembers = currentRoom.members?.filter(m =>
    (m.user._id || m.user) !== user?.id
  ) || [];

  if (nonOwnerMembers.length === 0) {
    showAlert('자동 배정을 위해서는 최소 1명의 멤버가 필요합니다.');
    return;
  }

  setIsScheduling(true);
  setScheduleError(null);
  setUnassignedMembersInfo(null);
  setConflictSuggestions([]); // Reset unassigned members info

  try {
    let uiCurrentWeek;
    let numWeeks;

    // currentWeekStartDate를 Date 객체로 변환 (이미 Date일 수도 있음)
    const currentDateObj = currentWeekStartDate instanceof Date
      ? currentWeekStartDate
      : new Date(currentWeekStartDate);

    // ✅ 자동배정: 모든 멤버의 선호시간이 있는 날짜를 포함하도록 범위 계산
    {
      // 모든 멤버의 specificDate 수집 (defaultSchedule + scheduleExceptions)
      let minDate = null;
      let maxDate = null;

      const allMembers = currentRoom.members || [];

      allMembers.forEach(member => {
        // defaultSchedule 확인
        const schedules = member.defaultSchedule || [];
        schedules.forEach(schedule => {
          if (schedule.specificDate) {
            const date = new Date(schedule.specificDate);
            if (!minDate || date < minDate) {
              minDate = date;
            }
            if (!maxDate || date > maxDate) {
              maxDate = date;
            }
          }
        });

        // scheduleExceptions 확인 (챗봇으로 추가된 선호시간)
        const exceptions = member.scheduleExceptions || [];
        exceptions.forEach(exception => {
          if (exception.specificDate) {
            const date = new Date(exception.specificDate);
            if (!minDate || date < minDate) {
              minDate = date;
            }
            if (!maxDate || date > maxDate) {
              maxDate = date;
            }
          }
        });
      });

      if (minDate && maxDate) {
        // specificDate가 있는 경우: 최소~최대 날짜를 커버
        const minDateDay = minDate.getUTCDay();
        const daysToMonday = minDateDay === 0 ? 6 : minDateDay - 1;
        const firstMonday = new Date(Date.UTC(
          minDate.getUTCFullYear(),
          minDate.getUTCMonth(),
          minDate.getUTCDate() - daysToMonday
        ));

        const millisInWeek = 7 * 24 * 60 * 60 * 1000;
        const weeksDiff = Math.ceil((maxDate - firstMonday) / millisInWeek) + 1;

        uiCurrentWeek = firstMonday;
        numWeeks = Math.max(weeksDiff, 12);

        console.log('📅 [Auto Schedule] specificDate 기반 범위:', firstMonday.toISOString().split('T')[0], '~', maxDate.toISOString().split('T')[0], '(', numWeeks, '주)');
      } else {
        // specificDate가 없는 경우: 충분히 긴 범위 사용 (현재 날짜 기준 6개월 전부터 1년간)
        const today = new Date();
        const sixMonthsAgo = new Date(Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth() - 6,
          1
        ));
        const sixMonthsAgoDay = sixMonthsAgo.getUTCDay();
        const daysToMonday = sixMonthsAgoDay === 0 ? 6 : sixMonthsAgoDay - 1;
        const firstMonday = new Date(sixMonthsAgo);
        firstMonday.setUTCDate(sixMonthsAgo.getUTCDate() - daysToMonday);

        uiCurrentWeek = firstMonday;
        numWeeks = 52; // 1년

        console.log('📅 [Auto Schedule] dayOfWeek 기반 범위: 6개월 전부터 1년간 (52주)');
      }
    }
    const finalOptions = {
      ...scheduleOptions,
      currentWeek: uiCurrentWeek,
      numWeeks,
      transportMode: travelMode, // 서버가 기대하는 파라미터명: transportMode
      clientToday: new Date().toISOString().slice(0, 10)
    };
    
    console.log('🔍 ===== [클라이언트] 자동배정 요청 전송 =====');
    console.log('📤 보내는 파라미터:', {
      currentWeek: uiCurrentWeek ? uiCurrentWeek.toISOString().split('T')[0] : 'undefined',
      numWeeks,
      minHoursPerWeek: finalOptions.minHoursPerWeek,
      assignmentMode: finalOptions.assignmentMode,
      transportMode: travelMode,  // 추가
      clientToday: finalOptions.clientToday
    });
    console.log('🔍 ==========================================');
    const { room: updatedRoom, unassignedMembersInfo: newUnassignedMembersInfo, conflictSuggestions: newConflictSuggestions } = await coordinationService.runAutoSchedule(currentRoom._id, finalOptions);

    // 배정된 슬롯들의 상세 정보 출력
    if (updatedRoom.timeSlots && updatedRoom.timeSlots.length > 0) {
      updatedRoom.timeSlots.forEach((slot, index) => {
        const user = slot.user;
        const userName = user && typeof user === 'object'
          ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.firstName || '이름없음'
          : '미populate';
        const userId = user?._id || user;
      });
    }

    if (newUnassignedMembersInfo) {
      setUnassignedMembersInfo(newUnassignedMembersInfo);
    }
    if (newConflictSuggestions && newConflictSuggestions.length > 0) {
      setConflictSuggestions(newConflictSuggestions);
    }

    // Force a deep copy to break memoization in child components
    const newRoomState = JSON.parse(JSON.stringify(updatedRoom));
    setCurrentRoom(newRoomState);

    // 자동 배정 완료 알림
    showAlert('자동 시간 배정이 완료되었습니다.');
  } catch (error) {
    setScheduleError(error.message);
    showAlert(`자동 배정 실패: ${error.message}`);
  } finally {
    setIsScheduling(false);
  }
};

/**
 * Handle cancel request
 */
export const handleCancelRequest = async (
  requestId,
  setSentRequests,
  setReceivedRequests,
  cancelRequest,
  loadSentRequests,
  loadReceivedRequests,
  onRefreshExchangeCount,
  showAlert
) => {
  try {
    // 먼저 UI에서 즉시 제거 (낙관적 업데이트)
    setSentRequests(prev => prev.filter(req => req._id !== requestId));
    setReceivedRequests(prev => prev.filter(req => req._id !== requestId));

    // 백그라운드에서 서버 삭제 실행 (알림 없음)
    await cancelRequest(requestId);

    // 상위 컴포넌트의 교환 요청 카운트 업데이트 (현재 룸의 pending 요청만 영향)
    if (onRefreshExchangeCount) {
      onRefreshExchangeCount();
    }
  } catch (error) {
    // 삭제 실패 시 데이터 새로고침으로 롤백
    await Promise.all([
      loadSentRequests(),
      loadReceivedRequests()
    ]);

    showAlert(`내역 삭제에 실패했습니다: ${error.message}`);
  }
};

/**
 * Handle request with update
 */
export const handleRequestWithUpdate = async (
  requestId,
  action,
  request,
  handleRequest,
  currentRoom,
  fetchRoomDetails,
  loadReceivedRequests,
  loadSentRequests,
  loadRoomExchangeCounts,
  onRefreshExchangeCount,
  showAlert
) => {
  try {
    console.log('🔍 [handleRequestWithUpdate] Request type:', request?.type);
    console.log('🔍 [handleRequestWithUpdate] Request ID:', requestId);
    console.log('🔍 [handleRequestWithUpdate] Action:', action);

    // exchange_request 타입은 별도의 API 사용
    let result;
    if (request?.type === 'exchange_request') {
      console.log('✅ [handleRequestWithUpdate] Using exchange request API');
      const { coordinationService } = await import('../services/coordinationService');
      result = await coordinationService.respondToExchangeRequest(currentRoom._id, requestId, action);
    } else {
      console.log('✅ [handleRequestWithUpdate] Using regular request API');
      result = await handleRequest(requestId, action);
    }

    // 🔍 DEBUG: API 응답 확인
    console.log('🔍 [handleRequestWithUpdate] API response:', result);

    showAlert(`요청을 ${action === 'approved' ? '승인' : '거절'}했습니다.`);

    // To ensure the UI is fully updated, we'll refresh all relevant data sources.
    if (currentRoom?._id) {
      await fetchRoomDetails(currentRoom._id);

      // 상태 업데이트가 완전히 반영되도록 작은 딜레이 추가
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    await loadReceivedRequests();

    await loadSentRequests();

    await loadRoomExchangeCounts();

    onRefreshExchangeCount();

  } catch (error) {
    showAlert(`요청 처리에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
  }
};

/**
 * Create request data for slot changes
 */
export const createChangeRequestData = (slotToChange, currentRoom, user) => {
  // Helper function to get correct day index from Date object
  const dayKey = slotToChange.date
    ? days[getDayIndex(slotToChange.date)]
    : days[slotToChange.dayIndex - 1];

  // endTime 계산: slotToChange에 있으면 사용, 없으면 계산
  const endTime = slotToChange.endTime || calculateEndTime(slotToChange.time);

  if (slotToChange.action === 'release') {
    return {
      roomId: currentRoom._id,
      type: 'slot_release',
      timeSlot: {
        day: dayKey,
        date: slotToChange.date, // 날짜 추가
        startTime: slotToChange.time,
        endTime: endTime,
      },
      message: '시간을 취소합니다.',
    };
  } else {
    // 모든 다른 요청은 시간 양보 요청으로 처리
    return {
      roomId: currentRoom._id,
      type: 'time_request',
      timeSlot: {
        day: dayKey,
        date: slotToChange.date ? slotToChange.date.toISOString() : undefined, // 날짜를 ISO 문자열로 변환
        startTime: slotToChange.time,
        endTime: endTime,
      },
      targetUserId: slotToChange.targetUserId,
      message: '자리를 요청합니다.',
    };
  }
};