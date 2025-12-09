/**
 * ===================================================================================================
 * syncUtils.js - CoordinationTab 동기화 유틸리티 함수
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/CoordinationTab/utils
 *
 * 🎯 주요 기능:
 *    - 방장의 개인시간을 방 설정(roomExceptions)으로 동기화
 *    - 개인시간 일정 예외(scheduleExceptions)를 시간대별로 병합
 *    - 반복되는 개인시간(personalTimes)을 방 예외로 변환
 *    - 자정을 넘나드는 시간을 분할 처리
 *
 * 🔗 연결된 파일:
 *    - ../../../../services/coordinationService.js - 방 업데이트 API
 *    - ../../../../services/userService.js - 사용자 스케줄 조회 API
 *    - ../../../../utils/coordinationUtils.js - isRoomOwner 유틸리티
 *    - ../constants/index.js - DAY_OF_WEEK_MAP 상수
 *    - ../index.js (CoordinationTab) - 방 선택 시 호출
 *
 * 💡 UI 위치:
 *    - 탭: 조율 탭 (CoordinationTab)
 *    - 섹션: 방 선택 시 자동 실행 (백그라운드)
 *    - 경로: 앱 실행 > 조율 탭 > 방 선택
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 방장의 개인시간이 방에 반영되는 방식 변경
 *    - 동기화 주기 변경: 호출하는 곳(CoordinationTab)에서 조정
 *    - 예외 형식 변경: syncedExceptions 생성 로직 수정
 *    - 병합 로직 변경: mergedRanges 계산 로직 수정
 *
 * 📝 참고사항:
 *    - 동기화는 방장만 실행 가능 (isRoomOwner 체크)
 *    - 기존 isSynced=true 또는 "(방장)" 포함 예외는 삭제 후 재생성
 *    - 동기화 실패 시 에러 로그만 출력 (사용자 알림 없음)
 *    - 자정 넘나드는 시간은 00:00 기준으로 분할됨
 *
 * ===================================================================================================
 */

import { coordinationService } from '../../../../services/coordinationService';
import { userService } from '../../../../services/userService';
import { isRoomOwner } from '../../../../utils/coordinationUtils';
import { DAY_OF_WEEK_MAP } from '../constants';

/**
 * syncOwnerPersonalTimes - 방장의 개인시간을 방 설정으로 동기화
 *
 * @description 방장의 개인시간(personalTimes, scheduleExceptions)을 방 예외(roomExceptions)로 동기화
 * @param {Object} currentRoom - 현재 선택된 방 객체
 * @param {string} currentRoom._id - 방 ID
 * @param {Object} user - 현재 사용자 객체
 * @param {Function} fetchRoomDetails - 방 세부정보 새로고침 함수
 * @param {Function} showAlert - 알림 표시 함수 (현재 미사용)
 *
 * @example
 * await syncOwnerPersonalTimes(
 *   currentRoom,
 *   user,
 *   fetchRoomDetails,
 *   showAlert
 * );
 *
 * @note
 * - 방장이 아니면 즉시 반환 (권한 체크)
 * - 기존에 동기화된 예외들(isSynced=true, "(방장)" 포함)은 모두 삭제 후 재생성
 * - scheduleExceptions는 시간대별로 병합되어 중복 방지
 * - personalTimes는 반복 일정으로 각 요일별로 생성됨
 * - 자정을 넘나드는 시간(23:00~07:00)은 두 개로 분할됨:
 *   1. 해당 요일 시작~23:50
 *   2. 다음 요일 00:00~종료시간
 * - 동기화 성공 시 알림 없음 (silent sync)
 * - 동기화 실패 시 콘솔 에러만 출력
 * - defaultSchedule은 roomExceptions에 추가되지 않음 (ownerOriginalSchedule로 별도 렌더링)
 *
 * @async
 * @returns {Promise<void>}
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
