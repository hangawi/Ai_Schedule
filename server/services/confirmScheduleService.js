/**
 * confirmScheduleService.js
 *
 * 자동 확정과 수동 확정의 공통 로직을 담당하는 서비스
 * 슬롯 병합, personalTimes 추가, 선호시간 제거 등을 수행
 */

const User = require('../models/user');
const ActivityLog = require('../models/ActivityLog');

/**
 * 시간 문자열을 분 단위로 변환 (예: "09:30" -> 570)
 */
const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * 분을 시간 문자열로 변환 (예: 570 -> "09:30")
 */
const minutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

/**
 * 연속된 슬롯 병합
 */
const mergeConsecutiveSlots = (slots) => {
  if (slots.length === 0) return [];

  // 시간순으로 정렬
  slots.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  const merged = [];
  let current = {
    startTime: slots[0].startTime,
    endTime: slots[0].endTime
  };

  for (let i = 1; i < slots.length; i++) {
    const slot = slots[i];

    // 현재 슬롯의 끝 시간과 다음 슬롯의 시작 시간이 연속되는지 확인
    if (current.endTime === slot.startTime) {
      // 연속되면 병합 (끝 시간만 업데이트)
      current.endTime = slot.endTime;
    } else {
      // 연속되지 않으면 현재 블록을 결과에 추가하고 새 블록 시작
      merged.push(current);
      current = {
        startTime: slot.startTime,
        endTime: slot.endTime
      };
    }
  }

  // 마지막 블록 추가
  merged.push(current);

  return merged;
};

/**
 * day 문자열을 숫자로 변환
 */
const getDayOfWeekNumber = (day) => {
  const dayMap = {
    'monday': 1,
    'tuesday': 2,
    'wednesday': 3,
    'thursday': 4,
    'friday': 5,
    'saturday': 6,
    'sunday': 7
  };
  return dayMap[day] || 1;
};

/**
 * 선호시간에서 배정된 부분만 제거하고 나머지는 분할하여 유지 + 백업
 */
const removePreferenceTimes = (user, slots, roomId) => {
  const deletedTimes = [];
  const newDefaultSchedule = [];

  // 1. 슬롯을 날짜별로 그룹화하고 개별 시간 범위 저장 (병합하지 않음)
  const assignedRangesByDate = {};

  slots.forEach(slot => {
    const dateStr = slot.date.toISOString().split('T')[0];
    const dayOfWeek = getDayOfWeekNumber(slot.day);

    if (!assignedRangesByDate[dateStr]) {
      assignedRangesByDate[dateStr] = {
        dateStr,
        dayOfWeek,
        ranges: [] // 개별 범위들을 배열로 저장
      };
    }

    assignedRangesByDate[dateStr].ranges.push({
      start: timeToMinutes(slot.startTime),
      end: timeToMinutes(slot.endTime)
    });
  });

  // 2. 각 선호시간을 확인하고 배정 범위와 겹치면 분할
  if (user.defaultSchedule) {
    user.defaultSchedule.forEach(schedule => {
      const scheduleDayOfWeek = schedule.dayOfWeek === 0 ? 7 : schedule.dayOfWeek;

      // 이 선호시간과 겹치는 배정 범위들 찾기
      const prefStart = timeToMinutes(schedule.startTime);
      const prefEnd = timeToMinutes(schedule.endTime);
      const scheduleDayOfWeekForMatch = schedule.dayOfWeek === 0 ? 7 : schedule.dayOfWeek;

      let matchingDateRanges = null;

      for (const [dateStr, dateData] of Object.entries(assignedRangesByDate)) {
        const matches = schedule.specificDate
          ? schedule.specificDate === dateStr
          : scheduleDayOfWeekForMatch === dateData.dayOfWeek;

        if (matches) {
          matchingDateRanges = dateData;
          break;
        }
      }

      if (!matchingDateRanges) {
        // 배정과 겹치지 않으면 그대로 유지
        newDefaultSchedule.push(schedule);
      } else {
        // 배정 범위들과 겹침 확인 및 분할 처리
        let currentSegments = [{ start: prefStart, end: prefEnd }];

        // 각 배정 범위에 대해 겹치는 부분 제거
        for (const assignedRange of matchingDateRanges.ranges) {
          const newSegments = [];

          for (const segment of currentSegments) {
            const overlapStart = Math.max(segment.start, assignedRange.start);
            const overlapEnd = Math.min(segment.end, assignedRange.end);

            if (overlapStart < overlapEnd) {
              // 실제로 겹침 - 백업에 추가
              deletedTimes.push({
                dayOfWeek: schedule.dayOfWeek,
                startTime: minutesToTime(overlapStart),
                endTime: minutesToTime(overlapEnd),
                priority: schedule.priority,
                specificDate: schedule.specificDate
              });

              // 세그먼트 분할
              if (segment.start < assignedRange.start) {
                newSegments.push({ start: segment.start, end: assignedRange.start });
              }
              if (segment.end > assignedRange.end) {
                newSegments.push({ start: assignedRange.end, end: segment.end });
              }
            } else {
              // 겹치지 않으면 그대로 유지
              newSegments.push(segment);
            }
          }

          currentSegments = newSegments;
        }

        // 남은 세그먼트들을 새 선호시간으로 추가
        for (const segment of currentSegments) {
          newDefaultSchedule.push({
            dayOfWeek: schedule.dayOfWeek,
            startTime: minutesToTime(segment.start),
            endTime: minutesToTime(segment.end),
            priority: schedule.priority,
            specificDate: schedule.specificDate
          });
        }
      }
    });

    // 분할된 새 선호시간으로 교체
    user.defaultSchedule = newDefaultSchedule;
  }

  // scheduleExceptions에서 해당 날짜 삭제 (기존 로직 유지)
  if (user.scheduleExceptions) {
    slots.forEach(slot => {
      const dateStr = slot.date.toISOString().split('T')[0];
      user.scheduleExceptions = user.scheduleExceptions.filter(exception => {
        if (exception.specificDate) {
          return exception.specificDate !== dateStr;
        }
        return true;
      });
    });
  }

  // 백업된 삭제 시간을 user.deletedPreferencesByRoom에 저장
  if (deletedTimes.length > 0) {
    if (!user.deletedPreferencesByRoom) {
      user.deletedPreferencesByRoom = [];
    }

    // 기존에 이 방에 대한 백업이 있으면 제거 (새로 덮어쓰기)
    user.deletedPreferencesByRoom = user.deletedPreferencesByRoom.filter(
      item => item.roomId.toString() !== roomId.toString()
    );

    // 새 백업 추가
    user.deletedPreferencesByRoom.push({
      roomId: roomId,
      deletedTimes: deletedTimes,
      deletedAt: new Date()
    });
  }
};

/**
 * 사용자를 재시도 로직과 함께 저장
 */
const saveUserWithRetry = async (user, maxRetries = 3) => {
  let currentUser = user;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await currentUser.save();
      return; // 성공
    } catch (error) {
      if (error.name === 'VersionError' && attempt < maxRetries) {

        // 최신 버전 다시 조회
        const freshUser = await User.findById(user._id);
        if (!freshUser) {
          throw new Error(`User ${user._id} not found during retry`);
        }

        // 변경사항 재적용
        freshUser.personalTimes = user.personalTimes;
        freshUser.defaultSchedule = user.defaultSchedule;
        if (user.deletedPreferencesByRoom) {
          freshUser.deletedPreferencesByRoom = user.deletedPreferencesByRoom;
        }

        currentUser = freshUser;
        // 잠시 대기 후 재시도 (동시성 충돌 완화)
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
      } else {
        throw error;
      }
    }
  }
};

/**
 * 스케줄 확정 로직 (자동/수동 확정 공통)
 *
 * @param {Object} room - populate된 Room 객체
 * @param {String} travelMode - 이동수단 모드 ('normal', 'transit', 'driving', etc.)
 * @param {String} requestUserId - 요청한 사용자 ID
 * @param {String} requestUserName - 요청한 사용자 이름
 * @returns {Object} { confirmedSlotsCount, mergedSlotsCount, affectedMembersCount, confirmedTravelMode }
 */
async function confirmScheduleLogic(room, travelMode, requestUserId, requestUserName) {
  try {
    // 1. 중복 확정 방지
    if (room.confirmedAt) {
      throw new Error('이미 확정된 스케줄입니다.');
    }

    // 2. 자동배정된 슬롯 필터링 (assignedBy가 있고 status가 'confirmed'인 것)
    // ⚠️ 이동시간 슬롯은 제외! (조원은 순수 수업시간만 확정)
    const autoAssignedSlots = room.timeSlots.filter(slot =>
      slot.assignedBy &&
      slot.status === 'confirmed' &&
      !slot.isTravel &&
      slot.subject !== '이동시간'
    );

    if (autoAssignedSlots.length === 0) {
      throw new Error('확정할 자동배정 시간이 없습니다.');
    }

    // 3. 조원별, 날짜별로 그룹화
    const slotsByUserAndDate = {};
    autoAssignedSlots.forEach(slot => {
      const userId = slot.user.toString();
      const dateStr = slot.date.toISOString().split('T')[0];
      const key = `${userId}_${dateStr}`;

      if (!slotsByUserAndDate[key]) {
        slotsByUserAndDate[key] = {
          userId,
          date: slot.date,
          day: slot.day,
          slots: []
        };
      }
      slotsByUserAndDate[key].slots.push(slot);
    });

    // 4. 각 그룹의 슬롯을 병합
    const mergedSlotsByUser = {};
    for (const [key, group] of Object.entries(slotsByUserAndDate)) {
      const mergedSlots = mergeConsecutiveSlots(group.slots);

      if (!mergedSlotsByUser[group.userId]) {
        mergedSlotsByUser[group.userId] = [];
      }

      mergedSlots.forEach(slot => {
        mergedSlotsByUser[group.userId].push({
          startTime: slot.startTime,
          endTime: slot.endTime,
          date: group.date,
          day: group.day
        });
      });
    }

    // 5. 각 조원의 personalTimes에 추가 + 선호시간 삭제
    const userMap = new Map();
    const ownerName = `${room.owner.firstName || ''} ${room.owner.lastName || ''}`.trim() || '방장';

    // 5-1. 조원들 처리
    for (const [userId, mergedSlots] of Object.entries(mergedSlotsByUser)) {
      let user = userMap.get(userId);
      if (!user) {
        user = await User.findById(userId);
        if (!user) continue;
        userMap.set(userId, user);
      }

      // personalTimes 배열이 없으면 초기화
      if (!user.personalTimes) {
        user.personalTimes = [];
      }

      // 선호시간 삭제 (원본 슬롯 사용) + 백업
      const originalSlots = autoAssignedSlots.filter(s => s.user.toString() === userId);
      removePreferenceTimes(user, originalSlots, room._id);

      // 다음 ID 계산
      const maxId = user.personalTimes.reduce((max, pt) => Math.max(max, pt.id || 0), 0);
      let nextId = maxId + 1;

      // 병합된 각 슬롯을 personalTimes로 변환
      mergedSlots.forEach(slot => {
        const dayOfWeek = getDayOfWeekNumber(slot.day);
        const dateStr = slot.date.toISOString().split('T')[0];

        // 중복 체크 (같은 날짜, 같은 시간)
        const isDuplicate = user.personalTimes.some(pt =>
          pt.specificDate === dateStr &&
          pt.startTime === slot.startTime &&
          pt.endTime === slot.endTime
        );

        if (!isDuplicate) {
          // 조원: 수업시간만 저장 (이동시간 제외)
          // 장소는 방장의 주소
          const ownerLocation = room.owner.addressDetail
            ? `${room.owner.address} ${room.owner.addressDetail}`
            : room.owner.address;

          user.personalTimes.push({
            id: nextId++,
            title: `${room.name} - ${ownerName}`,
            type: 'personal',
            startTime: slot.startTime,
            endTime: slot.endTime,
            days: [dayOfWeek],
            isRecurring: false,
            specificDate: dateStr,
            color: '#10B981', // 초록색
            location: ownerLocation || null, // 방장의 주소
            locationLat: room.owner.addressLat || null,
            locationLng: room.owner.addressLng || null,
            transportMode: travelMode || null, // 교통수단
            roomId: room._id.toString() // 방 ID (추가 정보 조회용)
          });
        }
      });
    }

    // 5-2. 방장 처리
    const ownerId = (room.owner._id || room.owner).toString();
    let owner = userMap.get(ownerId);
    if (!owner) {
      owner = await User.findById(ownerId);
      if (owner) {
        userMap.set(ownerId, owner);
      }
    }

    if (owner) {
      if (!owner.personalTimes) {
        owner.personalTimes = [];
      }

      // 방장의 선호시간 삭제 + 백업 (수업 슬롯 + 이동시간 슬롯 모두 고려)
      const ownerSlotsForDeletion = [...autoAssignedSlots];

      // 이동시간 슬롯도 포함하여 선호시간 삭제
      if (room.travelTimeSlots && room.travelTimeSlots.length > 0) {
        ownerSlotsForDeletion.push(...room.travelTimeSlots);
      }

      removePreferenceTimes(owner, ownerSlotsForDeletion, room._id);

      const maxId = owner.personalTimes.reduce((max, pt) => Math.max(max, pt.id || 0), 0);
      let nextId = maxId + 1;

      // 각 조원별로 병합된 슬롯을 방장의 개인일정으로 추가
      for (const [userId, mergedSlots] of Object.entries(mergedSlotsByUser)) {
        // 해당 조원 정보 찾기
        const memberUser = room.members.find(m =>
          m.user._id?.toString() === userId ||
          m.user.toString() === userId
        );

        if (!memberUser) continue;

        const memberName = `${memberUser.user.firstName || ''} ${memberUser.user.lastName || ''}`.trim() || '조원';

        mergedSlots.forEach(slot => {
          const dayOfWeek = getDayOfWeekNumber(slot.day);
          const dateStr = slot.date.toISOString().split('T')[0];

          // 중복 체크 (같은 날짜, 같은 시간, 같은 조원)
          const isDuplicate = owner.personalTimes.some(pt =>
            pt.specificDate === dateStr &&
            pt.startTime === slot.startTime &&
            pt.endTime === slot.endTime &&
            pt.title.includes(memberName)
          );

          if (!isDuplicate) {
            // 방장: 이동시간 포함하여 저장
            // 장소는 해당 조원의 주소
            const member = userMap.get(userId);
            const memberLocation = member && member.addressDetail
              ? `${member.address} ${member.addressDetail}`
              : member?.address;

            owner.personalTimes.push({
              id: nextId++,
              title: `${room.name} - ${memberName}`,
              type: 'personal',
              startTime: slot.startTime,
              endTime: slot.endTime,
              days: [dayOfWeek],
              isRecurring: false,
              specificDate: dateStr,
              color: '#3B82F6', // 파란색 (방장 수업 시간)
              location: memberLocation || null, // 조원의 주소
              locationLat: member?.addressLat || null,
              locationLng: member?.addressLng || null,
              transportMode: travelMode || null, // 교통수단
              roomId: room._id.toString(), // 방 ID
              hasTravelTime: room.travelTimeSlots && room.travelTimeSlots.length > 0 // 이동시간 존재 여부
            });
          }
        });
      }

      // 방장의 이동시간 슬롯 추가 (travel mode only)
      if (room.travelTimeSlots && room.travelTimeSlots.length > 0) {
        room.travelTimeSlots.forEach(travelSlot => {
          const dayOfWeek = getDayOfWeekNumber(travelSlot.day);
          const dateStr = travelSlot.date.toISOString().split('T')[0];

          // 중복 체크
          const isDuplicate = owner.personalTimes.some(pt =>
            pt.specificDate === dateStr &&
            pt.startTime === travelSlot.startTime &&
            pt.endTime === travelSlot.endTime &&
            pt.title.includes('이동시간')
          );

          if (!isDuplicate) {
            owner.personalTimes.push({
              id: nextId++,
              title: `${room.name} - 이동시간`,
              type: 'personal',
              startTime: travelSlot.startTime,
              endTime: travelSlot.endTime,
              days: [dayOfWeek],
              isRecurring: false,
              specificDate: dateStr,
              color: '#FFA500', // Orange color for travel time
              transportMode: travelMode || null, // 교통수단
              roomId: room._id.toString(), // 방 ID
              isTravelTime: true // 이동시간 플래그
            });
          }
        });
      }
    }

    // 6. 모든 사용자 한 번에 저장 (각 사용자는 한 번만 저장됨) with retry logic
    const updatePromises = Array.from(userMap.values()).map(user => saveUserWithRetry(user));
    await Promise.all(updatePromises);

    // 7. Room 저장 (confirmedAt, autoConfirmAt 등)
    room.confirmedAt = new Date();
    room.autoConfirmAt = null;
    if (travelMode) {
      room.confirmedTravelMode = travelMode;
    }

    // 확정된 슬롯 표시 (자동배정 시 중복 방지)
    autoAssignedSlots.forEach(slot => {
      slot.confirmedToPersonalCalendar = true;
    });

    await room.save();

    // 8. 활동 로그 기록
    await ActivityLog.logActivity(
      room._id,
      requestUserId,
      requestUserName,
      'confirm_schedule',
      `자동배정 시간 확정 완료 (${autoAssignedSlots.length}개 슬롯 → ${Object.values(mergedSlotsByUser).reduce((sum, slots) => sum + slots.length, 0)}개 병합, 조원 ${Object.keys(mergedSlotsByUser).length}명 + 방장)`
    );

    // 9. Socket.io로 실시간 알림 전송
    if (global.io) {
      global.io.to(`room-${room._id}`).emit('schedule-confirmed', {
        roomId: room._id,
        message: '자동배정 시간이 확정되었습니다.',
        timestamp: new Date()
      });
    }

    // 10. 결과 반환
    return {
      confirmedSlotsCount: autoAssignedSlots.length,
      mergedSlotsCount: Object.values(mergedSlotsByUser).reduce((sum, slots) => sum + slots.length, 0),
      affectedMembersCount: Object.keys(mergedSlotsByUser).length,
      confirmedTravelMode: travelMode || 'normal'
    };

  } catch (error) {
    throw error;
  }
}

module.exports = {
  confirmScheduleLogic
};
