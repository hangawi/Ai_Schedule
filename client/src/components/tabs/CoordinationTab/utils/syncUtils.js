// Sync utility functions for CoordinationTab

import { coordinationService } from '../../../../services/coordinationService';
import { userService } from '../../../../services/userService';
import { isRoomOwner } from '../../../../utils/coordinationUtils';
import { DAY_OF_WEEK_MAP } from '../constants';

/**
 * Sync owner's personal times to room settings
 * @param {Object} currentRoom - Current room object
 * @param {Object} user - Current user
 * @param {Function} fetchRoomDetails - Function to fetch room details
 * @param {Function} showAlert - Function to show alert
 */
export const syncOwnerPersonalTimes = async (currentRoom, user, fetchRoomDetails, showAlert) => {
  if (!currentRoom || !isRoomOwner(user, currentRoom)) {
    return;
  }

  try {
    // 현재 사용자의 개인시간 데이터 가져오기
    const ownerScheduleData = await userService.getUserSchedule();

    // 현재 방 세부정보 가져오기
    const roomData = await coordinationService.fetchRoomDetails(currentRoom._id);
    const existingSettings = roomData.settings || { roomExceptions: [] };

    // 기존의 방장 연동 예외들 모두 제거
    // - isSynced: true인 것들
    // - name에 "(방장)"이 포함된 것들 (이전 버전에서 추가된 것)
    const nonSyncedExceptions = existingSettings.roomExceptions.filter(ex => {
      const hasIsSynced = ex.isSynced === true;
      const hasOwnerInName = ex.name && ex.name.includes('(방장)');
      return !hasIsSynced && !hasOwnerInName;
    });

    // 새로운 방장 시간표 예외들 생성
    const syncedExceptions = [];

    // defaultSchedule은 roomExceptions에 추가하지 않음
    // 대신 ownerOriginalSchedule로 WeekView에서 렌더링 처리됨

    // scheduleExceptions을 roomExceptions으로 변환 (시간대별 병합)
    const scheduleExceptionGroups = {};
    (ownerScheduleData.scheduleExceptions || []).forEach(exception => {
      const startDate = new Date(exception.startTime);
      const dateKey = startDate.toISOString().split('T')[0]; // YYYY-MM-DD 형식
      const title = exception.title || '일정';
      const groupKey = `${dateKey}_${title}`;

      if (!scheduleExceptionGroups[groupKey]) {
        scheduleExceptionGroups[groupKey] = [];
      }
      scheduleExceptionGroups[groupKey].push(exception);
    });

    // 각 그룹별로 시간 범위 병합
    Object.values(scheduleExceptionGroups).forEach(group => {
      // 시작 시간 순으로 정렬
      group.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

      const mergedRanges = [];
      let currentRange = null;

      group.forEach(exception => {
        const startDate = new Date(exception.startTime);
        const endDate = new Date(exception.endTime);

        if (!currentRange) {
          currentRange = {
            title: exception.title || '일정',
            startTime: exception.startTime,
            endTime: exception.endTime,
            startDate: startDate,
            endDate: endDate
          };
        } else {
          // 현재 범위의 끝 시간과 새 예외의 시작 시간이 연속되는지 확인
          if (new Date(currentRange.endTime).getTime() === startDate.getTime()) {
            // 연속되므로 현재 범위 확장
            currentRange.endTime = exception.endTime;
            currentRange.endDate = endDate;
          } else {
            // 연속되지 않으므로 현재 범위를 완성하고 새 범위 시작
            mergedRanges.push(currentRange);
            currentRange = {
              title: exception.title || '일정',
              startTime: exception.startTime,
              endTime: exception.endTime,
              startDate: startDate,
              endDate: endDate
            };
          }
        }
      });

      // 마지막 범위 추가
      if (currentRange) {
        mergedRanges.push(currentRange);
      }

      // 병합된 범위들을 syncedExceptions에 추가
      mergedRanges.forEach(range => {
        const displayDate = range.startDate.toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).replace(/\. /g, '.').replace(/\.$/, '');

        const displayStartTime = range.startDate.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit'
        });

        const displayEndTime = range.endDate.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit'
        });

        syncedExceptions.push({
          type: 'date_specific',
          name: `${displayDate} ${displayStartTime}~${displayEndTime} (방장)`,
          startTime: displayStartTime,
          endTime: displayEndTime,
          startDate: range.startTime,
          endDate: range.endTime,
          isSynced: true
        });
      });
    });

    // personalTimes을 roomExceptions으로 변환
    (ownerScheduleData.personalTimes || []).forEach(personalTime => {
      if (personalTime.isRecurring !== false && personalTime.days && personalTime.days.length > 0) {
        personalTime.days.forEach(dayOfWeek => {
          const jsDay = dayOfWeek === 7 ? 0 : dayOfWeek;

          // 시간을 분으로 변환하여 자정 넘나드는지 확인
          const [startHour, startMin] = personalTime.startTime.split(':').map(Number);
          const [endHour, endMin] = personalTime.endTime.split(':').map(Number);
          const startMinutes = startHour * 60 + startMin;
          const endMinutes = endHour * 60 + endMin;

          if (endMinutes <= startMinutes) {
            // 자정을 넘나드는 시간 (예: 23:00~07:00) 분할
            syncedExceptions.push({
              type: 'daily_recurring',
              name: `${personalTime.title || '개인시간'} (방장)`,
              dayOfWeek: jsDay,
              startTime: personalTime.startTime,
              endTime: '23:50',
              isPersonalTime: true,
              isSynced: true
            });

            syncedExceptions.push({
              type: 'daily_recurring',
              name: `${personalTime.title || '개인시간'} (방장)`,
              dayOfWeek: jsDay,
              startTime: '00:00',
              endTime: personalTime.endTime,
              isPersonalTime: true,
              isSynced: true
            });
          } else {
            // 일반적인 하루 내 시간
            syncedExceptions.push({
              type: 'daily_recurring',
              name: `${personalTime.title || '개인시간'} (방장)`,
              dayOfWeek: jsDay,
              startTime: personalTime.startTime,
              endTime: personalTime.endTime,
              isPersonalTime: true,
              isSynced: true
            });
          }
        });
      }
    });

    // 업데이트된 설정으로 방 업데이트
    const updatedSettings = {
      ...existingSettings,
      roomExceptions: [...nonSyncedExceptions, ...syncedExceptions]
    };

    await coordinationService.updateRoom(currentRoom._id, {
      settings: updatedSettings
    });

    // 현재 방 데이터 새로고침
    await fetchRoomDetails(currentRoom._id);

    // Silent sync - no alert

  } catch (err) {
    // Silent error handling
    console.error('개인시간 동기화 실패:', err.message);
  }
};
