// 방장 방 동기화 유틸리티

import { coordinationService } from '../../../../services/coordinationService';
import { DAY_OF_WEEK_MAP } from '../constants/dayMapping';
import { groupExceptionsByDateAndTitle } from './scheduleGrouper';
import { mergeTimeRanges } from './slotMerger';

/**
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
