/**
 * Coordination API handlers and business logic
 */

import { coordinationService } from '../services/coordinationService';
import { days, getDayIndex, calculateEndTime } from './coordinationUtils';

/**
 * Handle auto-resolution of timeout negotiations
 */
export const handleAutoResolveNegotiations = async (currentRoom, fetchRoomDetails, showAlert) => {
  if (!currentRoom?._id) return;

  console.log('Auto-resolving negotiations for room:', currentRoom._id);

  try {
    const result = await coordinationService.autoResolveTimeoutNegotiations(currentRoom._id, 24);

    if (result.resolvedCount > 0) {
      // Show notification about auto-resolved negotiations
      showAlert(`${result.resolvedCount}개의 협의가 자동으로 해결되었습니다.`);

      // Refresh room data
      await fetchRoomDetails(currentRoom._id);
    }
  } catch (error) {
    // Silent error handling
  }
};

/**
 * Handle force resolve negotiation
 */
export const handleForceResolveNegotiation = async (currentRoom, negotiationId, fetchRoomDetails, showAlert, method = 'random') => {
  if (!currentRoom?._id) return;

  try {
    const result = await coordinationService.forceResolveNegotiation(currentRoom._id, negotiationId, method);

    showAlert(`협의가 ${result.assignmentMethod}으로 해결되었습니다.`);

    // Refresh room data
    await fetchRoomDetails(currentRoom._id);
  } catch (error) {
    showAlert(`협의 해결 실패: ${error.message}`);
  }
};

/**
 * Handle reset carryover times
 */
export const handleResetCarryOverTimes = async (currentRoom, fetchRoomDetails, setCurrentRoom, showAlert) => {
  if (!currentRoom?._id) return;

  console.log('Resetting carryover times for room:', currentRoom._id);

  try {
    const apiUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
    const token = localStorage.getItem('token');
    const response = await fetch(`${apiUrl}/api/coordination/reset-carryover/${currentRoom._id}`, {
      method: 'POST',
      headers: {
        'x-auth-token': token,
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
    console.error('Carryover reset failed:', error);
    showAlert(`이월시간 초기화 실패: ${error.message}`);
  }
};

/**
 * Handle reset completed times
 */
export const handleResetCompletedTimes = async (currentRoom, fetchRoomDetails, setCurrentRoom, showAlert) => {
  if (!currentRoom?._id) return;

  console.log('Resetting completed times for room:', currentRoom._id);

  try {
    const apiUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
    const token = localStorage.getItem('token');
    const response = await fetch(`${apiUrl}/api/coordination/reset-completed/${currentRoom._id}`, {
      method: 'POST',
      headers: {
        'x-auth-token': token,
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
  setNegotiationAlertData,
  setShowNegotiationAlert,
  showAlert,
  viewMode = 'week'
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
    // currentWeekStartDate를 Date 객체로 변환 (이미 Date일 수도 있음)
    const currentDateObj = currentWeekStartDate instanceof Date
      ? currentWeekStartDate
      : new Date(currentWeekStartDate);

    // 💡 주간/월간 모두 월 전체 기간으로 배정 (뷰만 다름)
    const year = currentDateObj.getFullYear();
    const month = currentDateObj.getMonth();

    // 해당 월의 1일 (월요일 기준으로 조정)
    const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
    const dayOfWeek = firstDayOfMonth.getUTCDay(); // 0=일요일, 1=월요일, ...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    firstDayOfMonth.setUTCDate(firstDayOfMonth.getUTCDate() + mondayOffset);

    // 해당 월의 마지막 날
    const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0));

    // 월 전체를 커버하는 주 수 계산
    const daysDiff = Math.ceil((lastDayOfMonth - firstDayOfMonth) / (1000 * 60 * 60 * 24));
    const numWeeks = Math.ceil(daysDiff / 7) + 1; // 여유있게 +1주

    console.log(`${viewMode === 'month' ? '월간' : '주간'} 모드: ${year}년 ${month + 1}월 전체 (${numWeeks}주) 배정 (뷰만 ${viewMode === 'month' ? '월 전체' : '현재 주'}로 표시)`);

    const finalOptions = {
      ...scheduleOptions,
      currentWeek: firstDayOfMonth, // 항상 월 초부터
      numWeeks, // 월 전체 주 수
      viewMode // 뷰 모드 전달
    };

    console.log('🚀 Starting auto-schedule with options:', {
      ...finalOptions,
      viewMode,
      currentWeekStartDate: currentDateObj.toISOString(),
      firstDayOfMonth: firstDayOfMonth.toISOString(),
      numWeeks,
    });

    const { room: updatedRoom, unassignedMembersInfo: newUnassignedMembersInfo, conflictSuggestions: newConflictSuggestions } = await coordinationService.runAutoSchedule(currentRoom._id, finalOptions);

    console.log('Auto-schedule completed:', { updatedRoom, newUnassignedMembersInfo, newConflictSuggestions });

    if (newUnassignedMembersInfo) {
      setUnassignedMembersInfo(newUnassignedMembersInfo);
    }
    if (newConflictSuggestions && newConflictSuggestions.length > 0) {
      setConflictSuggestions(newConflictSuggestions);
    }

    // Force a deep copy to break memoization in child components
    const newRoomState = JSON.parse(JSON.stringify(updatedRoom));
    setCurrentRoom(newRoomState);

    // Check for active negotiations and show notification
    const activeNegotiations = updatedRoom.negotiations?.filter(neg =>
      neg.status === 'active' && neg.conflictingMembers?.length > 0
    ) || [];

    // Filter negotiations where current user is involved
    const userNegotiations = activeNegotiations.filter(neg =>
      neg.conflictingMembers?.some(cm =>
        (cm.user._id || cm.user) === user?.id
      )
    );

    if (userNegotiations.length > 0) {
      // Show alert for negotiations user is involved in
      setNegotiationAlertData({
        count: userNegotiations.length,
        negotiations: userNegotiations,
        totalCount: activeNegotiations.length
      });
      setShowNegotiationAlert(true);
    } else if (activeNegotiations.length > 0) {
      // Show passive notification for other negotiations
      showAlert(`자동 시간 배정이 완료되었습니다. ${activeNegotiations.length}개의 협의가 생성되었습니다. 같은 우선순위의 멤버들 간 조율이 필요한 시간대입니다.`);
    } else {
      showAlert('자동 시간 배정이 완료되었습니다. 모든 시간이 성공적으로 할당되었습니다.');
    }
  } catch (error) {
    console.error('Auto-schedule failed:', error);
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
    console.log('🔄 Calling handleRequest...');
    await handleRequest(requestId, action);
    console.log('✅ handleRequest completed');

    showAlert(`요청을 ${action === 'approved' ? '승인' : '거절'}했습니다.`);

    // To ensure the UI is fully updated, we'll refresh all relevant data sources.
    if (currentRoom?._id) {
      console.log('🔄 Fetching room details for:', currentRoom._id);
      await fetchRoomDetails(currentRoom._id);
      console.log('✅ fetchRoomDetails completed');

      // 상태 업데이트가 완전히 반영되도록 작은 딜레이 추가
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('🔄 Loading received requests...');
    await loadReceivedRequests();
    console.log('✅ loadReceivedRequests completed');

    console.log('🔄 Loading sent requests...');
    await loadSentRequests();
    console.log('✅ loadSentRequests completed');

    console.log('🔄 Loading room exchange counts...');
    await loadRoomExchangeCounts();
    console.log('✅ loadRoomExchangeCounts completed');

    console.log('🔄 Calling onRefreshExchangeCount...');
    onRefreshExchangeCount();
    console.log('✅ onRefreshExchangeCount completed');
  } catch (error) {
    console.error('Failed to handle request:', error);
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