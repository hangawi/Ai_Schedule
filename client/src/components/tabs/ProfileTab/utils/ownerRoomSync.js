/**
 * ===================================================================================================
 * ownerRoomSync.js - 방장 방 동기화 유틸리티
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/ProfileTab/utils
 *
 * 🎯 주요 기능:
 *    - 방장이 개인 스케줄 저장 시 자신이 방장인 모든 방의 설정 자동 업데이트
 *    - scheduleExceptions(예외 일정)를 날짜/제목별로 그룹화하여 병합
 *    - personalTimes(개인시간)를 roomExceptions로 변환
 *    - 자정 넘나드는 시간대 분할 처리
 *
 * 🔗 연결된 파일:
 *    - ../../../../services/coordinationService.js - 방 목록 조회, 방 업데이트 API
 *    - ../constants/dayMapping.js - DAY_OF_WEEK_MAP (현재 import만 되고 미사용)
 *    - ./scheduleGrouper.js - 예외 일정 그룹화 유틸리티
 *    - ./slotMerger.js - 시간대 병합 유틸리티
 *    - ../handlers/saveHandlers.js - 저장 완료 후 이 함수 호출
 *
 * 💡 UI 위치:
 *    - 탭: 프로필 탭 (ProfileTab)
 *    - 섹션: 저장 버튼 클릭 시 백그라운드에서 자동 실행
 *    - 경로: 앱 실행 > 프로필 탭 > 저장 버튼 > 방장 방 동기화
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 방장 스케줄 동기화 로직이 변경됨
 *    - 동기화 대상 변경: syncedExceptions 생성 로직 수정
 *    - 예외 필터링 변경: nonSyncedExceptions 필터 조건 수정
 *    - 자정 분할 로직 변경: endMinutes <= startMinutes 처리 수정
 *
 * 📝 참고사항:
 *    - 방장만 실행 (ownedRooms만 처리)
 *    - 기존 isSynced=true 예외는 모두 삭제 후 재생성
 *    - 개별 방 업데이트 실패는 무시 (다음 방 계속 처리)
 *    - 전체 동기화 실패도 무시 (사용자에게 알림 없음)
 *    - 자정 넘나드는 시간: 23:50 기준으로 분할 (00:00~23:50, 다음날 00:00~종료)
 *
 * ===================================================================================================
 */

// 방장 방 동기화 유틸리티

import { coordinationService } from '../../../../services/coordinationService';
import { DAY_OF_WEEK_MAP } from '../constants/dayMapping';
import { groupExceptionsByDateAndTitle } from './scheduleGrouper';
import { mergeTimeRanges } from './slotMerger';

/**
 * updateOwnerRoomsSettings - 방장인 방들의 설정을 업데이트하는 함수
 *
 * @description 방장의 개인 스케줄(scheduleExceptions, personalTimes)을 방장인 모든 방의 roomExceptions에 동기화
 * @param {Object} ownerScheduleData - 방장의 스케줄 데이터
 * @param {Array} [ownerScheduleData.scheduleExceptions] - 예외 일정 배열
 * @param {Array} [ownerScheduleData.personalTimes] - 개인시간 배열
 *
 * @example
 * await updateOwnerRoomsSettings({
 *   scheduleExceptions: [
 *     { startTime: '2025-12-08T09:00:00', endTime: '2025-12-08T10:00:00', title: '회의' }
 *   ],
 *   personalTimes: [
 *     { startTime: '08:00', endTime: '09:00', days: [1, 2, 3], isRecurring: true, title: '운동' }
 *   ]
 * });
 *
 * @note
 * - 방장인 방 목록을 자동으로 조회 (coordinationService.fetchMyRooms)
 * - 각 방의 기존 roomExceptions 중 isSynced=true인 것만 삭제 후 재생성
 * - scheduleExceptions는 날짜/제목별로 그룹화하여 병합 (중복 방지)
 * - personalTimes는 반복 일정(isRecurring=true)인 것만 처리
 * - 자정 넘나드는 시간(예: 23:00~07:00)은 두 슬롯으로 분할:
 *   1. 해당 요일 시작~23:50
 *   2. 다음 요일 00:00~종료
 * - 개별 방 업데이트 실패는 무시하고 다음 방 계속 처리
 * - 전체 동기화 실패도 무시 (사용자 알림 없음, silent sync)
 *
 * @async
 * @returns {Promise<void>}
 */
 * 방장인 방들의 설정을 업데이트하는 함수
 * @param {Object} ownerScheduleData - 방장의 스케줄 데이터
 */
export const updateOwnerRoomsSettings = async (ownerScheduleData) => {
  try {
    // 내가 방장인 방 목록 가져오기
    const myRooms = await coordinationService.fetchMyRooms();
    const ownedRooms = myRooms?.owned || [];

    for (const room of ownedRooms) {
      try {
        // 기존 방 세부정보 가져오기
        const roomData = await coordinationService.fetchRoomDetails(room._id);
        const existingSettings = roomData.settings || { roomExceptions: [] };

        // 기존의 방장 연동 예외들 제거 (isSynced: true인 것들)
        const nonSyncedExceptions = existingSettings.roomExceptions.filter(ex => !ex.isSynced);

        // 새로운 방장 시간표 예외들 생성 (불가능한 시간만 포함)
        const syncedExceptions = [];

        // scheduleExceptions을 날짜/제목별로 그룹화하여 병합 처리
        const exceptionGroups = groupExceptionsByDateAndTitle(ownerScheduleData.scheduleExceptions || []);

        // 각 그룹별로 시간대를 병합하여 roomException 생성
        Object.values(exceptionGroups).forEach(group => {
          // 시간순으로 정렬
          group.exceptions.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

          // 연속된 시간대들을 병합
          const mergedTimeRanges = mergeTimeRanges(group.exceptions);

          // 병합된 시간대들을 roomException으로 변환
          mergedTimeRanges.forEach(range => {
            const startTimeStr = range.startTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            const endTimeStr = range.endTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

            syncedExceptions.push({
              type: 'date_specific',
              name: `${group.title} (${group.date} ${startTimeStr}~${endTimeStr}) (방장)`,
              startTime: startTimeStr,
              endTime: endTimeStr,
              startDate: range.startTime.toISOString(),
              endDate: range.endTime.toISOString(),
              isSynced: true
            });
          });
        });

        // personalTimes을 roomExceptions으로 변환
        (ownerScheduleData.personalTimes || []).forEach(personalTime => {
          // 반복 개인시간인 경우에만 처리
          if (personalTime.isRecurring !== false && personalTime.days && personalTime.days.length > 0) {
            personalTime.days.forEach(dayOfWeek => {
              // 데이터베이스 요일 시스템을 JavaScript 요일 시스템으로 변환
              const jsDay = dayOfWeek === 7 ? 0 : dayOfWeek;

              // 시간을 분으로 변환하여 자정 넘나드는지 확인
              const [startHour, startMin] = personalTime.startTime.split(':').map(Number);
              const [endHour, endMin] = personalTime.endTime.split(':').map(Number);
              const startMinutes = startHour * 60 + startMin;
              const endMinutes = endHour * 60 + endMin;

              if (endMinutes <= startMinutes) {
                // 밤 부분 (예: 23:00~23:50)
                syncedExceptions.push({
                  type: 'daily_recurring',
                  name: `${personalTime.title || '개인시간'} (방장)`,
                  dayOfWeek: jsDay,
                  startTime: personalTime.startTime,
                  endTime: '23:50',
                  isPersonalTime: true,
                  isSynced: true
                });

                // 아침 부분 (예: 00:00~07:00)
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

        await coordinationService.updateRoom(room._id, {
          settings: updatedSettings
        });
      } catch (roomErr) {
        // 개별 방 업데이트 실패는 무시
      }
    }
  } catch (err) {
    // 전체 동기화 실패는 무시
  }
};
