/**
 * ===================================================================================================
 * coordinationHandlers.js - 조율(Coordination) 탭과 관련된 주요 비즈니스 로직 및 API 요청 핸들러 모음
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/utils/coordinationHandlers.js
 *
 * 🎯 주요 기능:
 *    - 멤버들의 이월 시간 및 완료 시간 초기화 (`handleResetCarryOverTimes`, `handleResetCompletedTimes`).
 *    - 자동 시간 배정 실행 및 결과 처리 (`handleRunAutoSchedule`).
 *    - 보낸/받은 요청 취소 처리 (`handleCancelRequest`).
 *    - 요청에 대한 승인/거절 처리 (`handleRequestWithUpdate`).
 *    - 시간 변경/양보/취소 요청 데이터 생성 (`createChangeRequestData`).
 *
 * 🔗 연결된 파일:
 *    - ../services/coordinationService.js: 조율 관련 API 호출을 위해 사용.
 *    - ./coordinationUtils.js: 날짜 및 시간 계산 유틸리티 함수 사용.
 *    - ../config/firebaseConfig.js: Firebase 인증 객체 `auth` 사용.
 *    - ../components/tabs/CoordinationTab/: 조율 탭의 주요 기능들(버튼 클릭, 액션 실행)에서 이 핸들러 함수들을 호출.
 *    - ../components/modals/RequestManagement.js: 요청 관리 모달에서 요청 취소 및 처리에 사용.
 *
 * 💡 UI 위치:
 *    - '일정 맞추기' 탭 (`CoordinationTab`) 내의 '자동배정 실행', '이월시간 초기화' 등의 버튼 클릭 이벤트 핸들러.
 *    - 요청 관리 모달(`RequestManagement`) 내의 '승인', '거절', '취소' 버튼 클릭 이벤트 핸들러.
 *    - 타임슬롯 클릭 시 나타나는 메뉴의 '시간 양보', '시간 취소' 등의 액션 핸들러.
 *
 * ✏️ 수정 가이드:
 *    - 자동 배정 로직(`handleRunAutoSchedule`) 변경 시: `coordinationService.runAutoSchedule`로 전달되는 `finalOptions` 객체의 구조와 내용을 확인하고 수정.
 *    - 요청 처리 로직(`handleRequestWithUpdate`) 변경 시: 요청 타입(`exchange_request` 등)에 따른 API 분기 처리를 확인하고 수정.
 *    - 새로운 요청 유형이 추가될 경우: `createChangeRequestData` 함수를 확장하여 새로운 요청 데이터 구조를 생성하도록 수정.
 *
 * 📝 참고사항:
 *    - 대부분의 핸들러는 API 호출 후, `showAlert`를 통해 사용자에게 피드백을 제공하고, `setCurrentRoom` 또는 `fetchRoomDetails`를 호출하여 UI를 갱신함.
 *    - `handleRunAutoSchedule`는 자동 배정 범위를 결정하기 위해 멤버들의 선호시간(`specificDate`)을 분석하는 로직을 포함하고 있음.
 *
 * ===================================================================================================
 */

import { coordinationService } from '../services/coordinationService';
import { days, getDayIndex, calculateEndTime } from './coordinationUtils';
import { auth } from '../config/firebaseConfig';

/**
 * handleResetCarryOverTimes
 * @description 현재 방의 모든 멤버들의 이월 시간을 초기화합니다.
 * @param {object} currentRoom - 현재 방 정보 객체.
 * @param {function} fetchRoomDetails - 방 세부 정보를 다시 가져오는 함수.
 * @param {function} setCurrentRoom - 현재 방 상태를 업데이트하는 함수.
 * @param {function} showAlert - 사용자에게 알림을 표시하는 함수.
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
 * handleResetCompletedTimes
 * @description 현재 방의 모든 멤버들의 완료 시간을 초기화합니다.
 * @param {object} currentRoom - 현재 방 정보 객체.
 * @param {function} fetchRoomDetails - 방 세부 정보를 다시 가져오는 함수.
 * @param {function} setCurrentRoom - 현재 방 상태를 업데이트하는 함수.
 * @param {function} showAlert - 사용자에게 알림을 표시하는 함수.
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
 * handleRunAutoSchedule
 * @description 자동 시간 배정을 실행하고 그 결과를 처리합니다. 멤버들의 선호시간을 분석하여 배정 범위를 동적으로 결정합니다.
 * @param {object} currentRoom - 현재 방 정보 객체.
 * @param {Date} currentWeekStartDate - 현재 주의 시작 날짜.
 * @param {object} user - 현재 로그인된 사용자 정보.
 * @param {object} scheduleOptions - 자동 배정 옵션 (minHoursPerWeek, assignmentMode 등).
 * @param {function} setIsScheduling - 스케줄링 진행 상태를 설정하는 함수.
 * @param {function} setScheduleError - 스케줄링 에러 상태를 설정하는 함수.
 * @param {function} setUnassignedMembersInfo - 미배정 멤버 정보를 설정하는 함수.
 * @param {function} setConflictSuggestions - 충돌 제안 정보를 설정하는 함수.
 * @param {function} setCurrentRoom - 현재 방 상태를 업데이트하는 함수.
 * @param {function} showAlert - 사용자에게 알림을 표시하는 함수.
 * @param {string} [viewMode='week'] - 현재 뷰 모드.
 * @param {string} [travelMode='normal'] - 선택된 이동 수단.
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
  console.log('\n\n' + '🚨'.repeat(50));
  console.log('🔥🔥🔥 handleRunAutoSchedule 호출됨! (프론트엔드)');
  console.log('전달받은 travelMode:', travelMode);
  console.log('🚨'.repeat(50) + '\n');

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

    // ✅ viewMode에 따라 배정 범위 설정
    if (viewMode === 'week') {
      // 주간 보기: 현재 주만 배정
      uiCurrentWeek = currentDateObj;
      numWeeks = 1;
    } else {
      // 월간 보기: 모든 멤버의 선호시간이 있는 날짜를 포함하도록 범위 계산
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


      }
    }
    } // else 블록 닫기
    // minHoursPerWeek를 분 단위로 변환하여 minClassDurationMinutes로 설정
    const minClassDurationMinutes = Math.ceil((scheduleOptions.minHoursPerWeek || 1) * 60);

    const finalOptions = {
      ...scheduleOptions,
      currentWeek: uiCurrentWeek,
      numWeeks,
      transportMode: travelMode, // 서버가 기대하는 파라미터명: transportMode
      minClassDurationMinutes, // 추가: 연속 블록 크기 설정
      clientToday: new Date().toISOString().slice(0, 10)
    };
    
    // 자동배정 요청 전송 (먼저 사전 체크)
    const response = await coordinationService.runAutoSchedule(currentRoom._id, { ...finalOptions, skipConfirmation: false });
    
    // 🔍 선호시간 부족 확인 필요 시
    if (response.needsConfirmation && response.insufficientMembers) {
      console.log('⚠️ 선호시간 부족 멤버:', response.insufficientMembers);
      
      // 확인 메시지 생성
      let confirmMessage = '⚠️ 다음 멤버들의 선호시간이 부족합니다:\n\n';
      response.insufficientMembers.forEach(m => {
        confirmMessage += `• ${m.memberName}: ${m.availableMinutes}분 (필요: ${m.requiredMinutes}분)\n`;
      });
      confirmMessage += '\n해당 멤버를 제외하고 나머지 멤버만 배정하시겠습니까?';
      
      // 사용자 확인 요청
      const confirmed = window.confirm(confirmMessage);
      
      if (!confirmed) {
        setIsScheduling(false);
        showAlert('자동배정이 취소되었습니다.');
        return;
      }
      
      // 확인했으면 skipConfirmation: true로 재시도
      console.log('✅ 사용자 확인 완료 - 부족한 멤버 제외하고 배정 진행');
      const retryResponse = await coordinationService.runAutoSchedule(currentRoom._id, { ...finalOptions, skipConfirmation: true });
      
      // retryResponse를 response로 덮어쓰기
      Object.assign(response, retryResponse);
    }
    
    // 응답 처리
    const { room: updatedRoom, unassignedMembersInfo: newUnassignedMembersInfo, conflictSuggestions: newConflictSuggestions, warnings } = response;
    
    // ===== warnings 처리 (선호시간 부족 알림) =====
    if (warnings && warnings.length > 0) {
      console.log('⚠️ [자동배정] warnings 수신:', warnings);

      // warnings를 유형별로 분류
      const noPreferenceMembers = warnings.filter(w => w.type === 'no_preference');
      const insufficientMembers = warnings.filter(w => w.type === 'insufficient_preference');
      const insufficientPreferredTime = warnings.filter(w => w.type === 'insufficient_preferred_time');
      const otherFailures = warnings.filter(w => w.type === 'assignment_failed');

      // 알림 메시지 생성
      let alertMessage = '⚠️ 일부 주차를 배정하지 못했습니다:\n\n';

      if (insufficientPreferredTime.length > 0) {
        alertMessage += '⏰ 선호시간 부족으로 건너뛴 주차:\n\n';
        insufficientPreferredTime.forEach(w => {
          alertMessage += `${w.message}\n\n`;
        });
        alertMessage += '다른 주차는 정상적으로 배정되었습니다.\n\n';
      }

      if (noPreferenceMembers.length > 0) {
        alertMessage += '📅 선호시간 미설정:\n';
        noPreferenceMembers.forEach(w => {
          alertMessage += `  - ${w.memberName}\n`;
        });
        alertMessage += '\n';
      }

      if (insufficientMembers.length > 0) {
        alertMessage += '⏰ 선호시간 부족:\n';
        insufficientMembers.forEach(w => {
          alertMessage += `  - ${w.memberName}: 필요 ${w.requiredMinutes}분, 가용 ${w.availableMinutes}분\n`;
        });
        alertMessage += '\n';
      }

      if (otherFailures.length > 0) {
        alertMessage += '❌ 기타 배정 실패:\n';
        otherFailures.forEach(w => {
          alertMessage += `  - ${w.memberName}: ${w.message}\n`;
        });
      }

      // 사용자에게 알림 표시
      showAlert(alertMessage);
    }

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
    
    // setCurrentRoom 호출
    
    setCurrentRoom(newRoomState);

    // 자동 배정 완료 알림
    showAlert('자동 시간 배정이 완료되었습니다.');
  } catch (error) {
    console.error('❌ [클라이언트] 자동배정 에러:', error);
    setScheduleError(error.message);
    showAlert(`자동 배정 실패: ${error.message}`);
  } finally {

    setIsScheduling(false);
  }
};;

/**
 * handleCancelRequest
 * @description 보낸 요청 또는 받은 요청을 취소합니다. 낙관적 업데이트를 적용하여 UI에서 즉시 제거 후 API를 호출합니다.
 * @param {string} requestId - 취소할 요청의 ID.
 * @param {function} setSentRequests - 보낸 요청 목록 상태를 업데이트하는 함수.
 * @param {function} setReceivedRequests - 받은 요청 목록 상태를 업데이트하는 함수.
 * @param {function} cancelRequest - 요청 취소 API를 호출하는 서비스 함수.
 * @param {function} loadSentRequests - 보낸 요청 목록을 다시 로드하는 함수.
 * @param {function} loadReceivedRequests - 받은 요청 목록을 다시 로드하는 함수.
 * @param {function} onRefreshExchangeCount - 교환 요청 카운트를 새로고침하는 함수.
 * @param {function} showAlert - 사용자에게 알림을 표시하는 함수.
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
 * handleRequestWithUpdate
 * @description 교환 요청 또는 일반 요청에 대해 승인/거절 액션을 처리하고, 관련된 모든 데이터를 새로고침합니다.
 * @param {string} requestId - 처리할 요청의 ID.
 * @param {string} action - 수행할 액션 ('approved' 또는 'rejected').
 * @param {object} request - 처리할 요청 객체.
 * @param {function} handleRequest - 일반 요청 처리 API를 호출하는 서비스 함수.
 * @param {object} currentRoom - 현재 방 정보 객체.
 * @param {function} fetchRoomDetails - 방 세부 정보를 다시 가져오는 함수.
 * @param {function} loadReceivedRequests - 받은 요청 목록을 다시 로드하는 함수.
 * @param {function} loadSentRequests - 보낸 요청 목록을 다시 로드하는 함수.
 * @param {function} loadRoomExchangeCounts - 방별 교환 요청 카운트를 다시 로드하는 함수.
 * @param {function} onRefreshExchangeCount - 교환 요청 카운트를 새로고침하는 함수.
 * @param {function} showAlert - 사용자에게 알림을 표시하는 함수.
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
 * createChangeRequestData
 * @description 사용자가 타임슬롯에 대해 수행한 액션(시간 취소, 시간 요청)에 따라 API 요청에 필요한 데이터 객체를 생성합니다.
 * @param {object} slotToChange - 변경 대상 슬롯 정보.
 * @param {object} currentRoom - 현재 방 정보 객체.
 * @param {object} user - 현재 로그인된 사용자 정보.
 * @returns {object} API 요청에 사용될 데이터 객체.
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


/**
 * handleValidateScheduleWithTransportMode
 * @description 기존 스케줄을 다른 이동수단 모드로 검증합니다 (스케줄을 수정하지 않음).
 * @param {object} currentRoom - 현재 방 정보 객체.
 * @param {string} transportMode - 검증할 이동수단 모드 ('normal', 'transit', 'driving', 'walking', 'bicycling').
 * @param {function} showAlert - 사용자에게 알림을 표시하는 함수.
 * @param {string} viewMode - 현재 보기 모드 ('week' 또는 'month').
 * @param {Date} currentWeekStartDate - 주간 모드일 때 현재 주의 시작 날짜.
 * @returns {Promise<object>} 검증 결과 { isValid, warnings }
 */
export const handleValidateScheduleWithTransportMode = async (currentRoom, transportMode, showAlert, viewMode, currentWeekStartDate) => {
  try {
    console.log('\n' + '🔍'.repeat(50));
    console.log('🔍 [handleValidateScheduleWithTransportMode] 스케줄 검증 시작');
    console.log(`   roomId: ${currentRoom._id}`);
    console.log(`   transportMode: ${transportMode}`);
    console.log('🔍'.repeat(50) + '\n');

    // 1. API 호출하여 검증 수행
    const response = await coordinationService.validateScheduleWithTransportMode(
      currentRoom._id,
      transportMode,
      viewMode,
      currentWeekStartDate
    );

    console.log('✅ [handleValidateScheduleWithTransportMode] 검증 결과:', response);

    // 2. 검증 결과 처리
    if (response.success && response.isValid) {
      // 검증 성공
      console.log('✅ 스케줄이 유효합니다!');
      // 성공 시 알림 표시 (옵션)
      // showAlert(`${transportMode} 모드로 스케줄이 유효합니다.`, 'success');
      return { isValid: true, warnings: [] };
    } else if (response.success && !response.isValid) {
      // 검증 실패 - 경고 표시
      console.log('⚠️ 스케줄 검증 실패:', response.warnings);
      
      const warnings = response.warnings || [];
      
      // ✅ 멤버별로 그룹화
      const memberWarnings = {};
      
      warnings.forEach(w => {
        const memberName = w.memberName;
        if (!memberWarnings[memberName]) {
          memberWarnings[memberName] = {
            name: memberName,
            issues: []
          };
        }
        
        // 문제 유형별로 간단한 메시지 추가 (백엔드에서 이미 한글로 변환됨)
        if (w.type === 'insufficient_preference') {
          memberWarnings[memberName].issues.push(
            `${w.day} 선호시간 부족 (필요 ${w.requiredMinutes}분, 가용 ${w.availableMinutes}분)`
          );
        } else if (w.type === 'no_preference_for_day') {
          memberWarnings[memberName].issues.push(
            `${w.day} 선호시간 없음`
          );
        } else if (w.type === 'no_address') {
          memberWarnings[memberName].issues.push('주소 정보 없음');
        } else if (w.type === 'travel_time_error') {
          memberWarnings[memberName].issues.push('이동시간 계산 실패');
        } else if (w.type === 'not_assigned') {
          memberWarnings[memberName].issues.push('스케줄에 배정되지 않음');
        }
      });

      // ✅ 이동수단 한글 변환
      const transportModeNames = {
        'normal': '일반',
        'transit': '대중교통',
        'walking': '도보',
        'driving': '자동차'
      };
      const transportModeName = transportModeNames[transportMode] || transportMode;

      // ✅ 중복 제거 및 줄바꿈 처리
      const lines = [];
      lines.push(`⚠️ ${transportModeName} 모드는 현재 스케줄에 적합하지 않습니다.`);
      lines.push('');
      lines.push('📊 문제 요약:');
      lines.push('');

      Object.values(memberWarnings).forEach(member => {
        // 중복 제거
        const uniqueIssues = [...new Set(member.issues)];

        // 멤버당 표시
        if (uniqueIssues.length > 0) {
          lines.push(`   ${member.name}`);
          uniqueIssues.forEach(issue => {
            lines.push(`   • ${issue}`);
          });
          lines.push('');
        }
      });

      lines.push('💡 다른 이동수단을 선택하거나, 멤버의 선호시간을 조정하세요.');

      // ✅ 실제 줄바꿈으로 결합
      const alertMessage = lines.join('\n');

      showAlert(alertMessage, 'warning');
      
      return { isValid: false, warnings };
    } else {
      throw new Error(response.msg || '스케줄 검증에 실패했습니다.');
    }
  } catch (error) {
    console.error('❌ [handleValidateScheduleWithTransportMode] 오류:', error);
    showAlert(`스케줄 검증 실패: ${error.message}`, 'error');
    return { isValid: false, warnings: [], error: error.message };
  }
};
