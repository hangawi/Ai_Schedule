// 스케줄 확정 서비스
const User = require('../../../models/user');
const ActivityLog = require('../../../models/ActivityLog');
const { VALIDATION_RULES } = require('../constants/validationRules');
const { mergeConsecutiveSlots } = require('../utils/slotUtils');
const { getDayOfWeekNumber } = require('../utils/timeUtils');
const { removePreferenceTimes } = require('../helpers/preferenceTimeHelper');

/**
 * 슬롯을 사용자별, 날짜별로 그룹화
 * @param {Array} autoAssignedSlots - 자동 배정 슬롯
 * @returns {Object} 그룹화된 슬롯 객체
 */
const groupSlotsByUserAndDate = (autoAssignedSlots) => {
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

  return slotsByUserAndDate;
};

/**
 * 그룹화된 슬롯을 사용자별로 병합
 * @param {Object} slotsByUserAndDate - 날짜별 그룹화된 슬롯
 * @returns {Object} 사용자별 병합된 슬롯
 */
const mergeSlotsPerUser = (slotsByUserAndDate) => {
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

  return mergedSlotsByUser;
};

/**
 * 조원들의 personalTimes에 슬롯 추가
 * @param {Object} mergedSlotsByUser - 사용자별 병합된 슬롯
 * @param {Array} autoAssignedSlots - 원본 자동 배정 슬롯 (선호시간 삭제용)
 * @param {Object} room - 방 객체
 * @param {Map} userMap - 사용자 맵
 */
const addSlotsToMembersPersonalTimes = async (mergedSlotsByUser, autoAssignedSlots, room, userMap) => {
  const ownerName = `${room.owner.firstName || ''} ${room.owner.lastName || ''}`.trim() || '방장';

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
        user.personalTimes.push({
          id: nextId++,
          title: `${room.name} - ${ownerName}`,
          type: 'personal',
          startTime: slot.originalStartTime || slot.startTime,
          endTime: slot.originalEndTime || slot.endTime,
          days: [dayOfWeek],
          isRecurring: false,
          specificDate: dateStr,
          color: '#10B981' // 초록색
        });
      }
    });
  }
};

/**
 * 방장의 personalTimes에 슬롯 추가
 * @param {Object} mergedSlotsByUser - 사용자별 병합된 슬롯
 * @param {Array} autoAssignedSlots - 원본 자동 배정 슬롯
 * @param {Object} room - 방 객체
 * @param {Map} userMap - 사용자 맵
 */
const addSlotsToOwnerPersonalTimes = async (mergedSlotsByUser, autoAssignedSlots, room, userMap) => {

  const ownerId = (room.owner._id || room.owner).toString();

  let owner = userMap.get(ownerId);
  if (!owner) {
    owner = await User.findById(ownerId);
    if (owner) {
      userMap.set(ownerId, owner);
    }
  }

  if (!owner) return;

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
        // 방장: 이동시간 포함하여 저장 (slot.startTime은 이미 이동시간 포함된 시간)
        owner.personalTimes.push({
          id: nextId++,
          title: `${room.name} - ${memberName}`,
          type: 'personal',
          startTime: slot.startTime,
          endTime: slot.endTime,
          days: [dayOfWeek],
          isRecurring: false,
          specificDate: dateStr,
          color: '#3B82F6' // 파란색 (방장 수업 시간)
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
          color: '#FFA500' // Orange color for travel time
        });
      } else {
      }
    });
  }
};

/**
 * 사용자 저장 (재시도 로직 포함)
 * @param {Object} user - 사용자 객체
 * @param {number} maxRetries - 최대 재시도 횟수
 */
const saveUserWithRetry = async (user, maxRetries = VALIDATION_RULES.MAX_USER_SAVE_RETRIES) => {
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
 * 모든 사용자 저장
 * @param {Map} userMap - 사용자 맵
 */
const saveAllUsers = async (userMap) => {

  const updatePromises = Array.from(userMap.values()).map(user => saveUserWithRetry(user));
  await Promise.all(updatePromises);

};

/**
 * 방 저장 (재시도 로직 포함)
 * @param {Object} room - 방 객체
 * @param {string} travelMode - 이동 모드
 */
const saveRoomAfterConfirm = async (room, travelMode) => {
  // 자동 확정 타이머 해제
  room.autoConfirmAt = null;

  let roomSaved = false;
  for (let attempt = 1; attempt <= VALIDATION_RULES.MAX_RETRIES; attempt++) {
    try {
      await room.save();
      roomSaved = true;
      break;
    } catch (error) {
      if (error.name === 'VersionError' && attempt < VALIDATION_RULES.MAX_RETRIES) {

        const Room = require('../../../models/room');
        const freshRoom = await Room.findById(room._id);
        if (freshRoom) {
          freshRoom.autoConfirmAt = null;
          room = freshRoom;
        }
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
      } else {
        throw error;
      }
    }
  }

  if (!roomSaved) {
    throw new Error('Failed to save room after multiple retries');
  }

  return room;
};

/**
 * 확정 후 처리 (슬롯 마킹, 이동 모드 설정)
 * @param {Array} autoAssignedSlots - 자동 배정 슬롯
 * @param {Object} room - 방 객체
 * @param {string} travelMode - 이동 모드
 */
const finalizeConfirmation = async (autoAssignedSlots, room, travelMode) => {
  // 확정된 슬롯 표시 (자동배정 시 중복 방지)
  autoAssignedSlots.forEach(slot => {
    slot.confirmedToPersonalCalendar = true;
  });

  // 확정된 이동수단 모드 저장 및 confirmedAt 설정
  room.confirmedAt = new Date();
  if (travelMode) {
    room.confirmedTravelMode = travelMode;

    // 일반 모드로 확정하는 경우, 이동시간 슬롯 제거
    if (travelMode === 'normal') {
      const beforeCount = room.timeSlots.length;
      room.timeSlots = room.timeSlots.filter(slot => !slot.isTravel);
      room.travelTimeSlots = [];
      const afterCount = room.timeSlots.length;
    }
  }

  await room.save();
};

/**
 * 활동 로그 기록
 * @param {string} roomId - 방 ID
 * @param {string} userId - 사용자 ID
 * @param {string} userName - 사용자 이름
 * @param {number} slotsCount - 슬롯 개수
 * @param {number} mergedCount - 병합된 슬롯 개수
 * @param {number} membersCount - 조원 수
 */
const logConfirmActivity = async (roomId, userId, userName, slotsCount, mergedCount, membersCount) => {
  await ActivityLog.logActivity(
    roomId,
    userId,
    userName,
    'confirm_schedule',
    `자동배정 시간 확정 완료 (${slotsCount}개 슬롯 → ${mergedCount}개 병합, 조원 ${membersCount}명 + 방장)`
  );
};

/**
 * Socket.io 이벤트 전송
 * @param {string} roomId - 방 ID
 */
const emitConfirmEvent = (roomId) => {

  if (global.io) {
    global.io.to(`room-${roomId}`).emit('schedule-confirmed', {
      roomId: roomId,
      message: '자동배정 시간이 확정되었습니다.',
      timestamp: new Date()
    });
  }
};

/**
 * 스케줄 확정 메인 함수
 * @param {Array} autoAssignedSlots - 자동 배정된 슬롯
 * @param {Object} room - 방 객체
 * @param {string} travelMode - 이동 모드
 * @param {string} userId - 사용자 ID
 * @param {string} userName - 사용자 이름
 * @returns {Promise<Object>} 확정 결과
 */
const confirmSlotsToPersonalCalendar = async (autoAssignedSlots, room, travelMode, userId, userName) => {
  // 사용자별 + 날짜별로 그룹화
  const slotsByUserAndDate = groupSlotsByUserAndDate(autoAssignedSlots);

  // 각 그룹의 슬롯을 병합
  const mergedSlotsByUser = mergeSlotsPerUser(slotsByUserAndDate);

  // User 객체를 Map으로 관리하여 중복 저장 방지 (VersionError 해결)
  const userMap = new Map();

  // 조원들 처리
  await addSlotsToMembersPersonalTimes(mergedSlotsByUser, autoAssignedSlots, room, userMap);

  // 방장 처리
  await addSlotsToOwnerPersonalTimes(mergedSlotsByUser, autoAssignedSlots, room, userMap);

  // 모든 사용자 저장
  await saveAllUsers(userMap);

  // 방 저장
  await saveRoomAfterConfirm(room, travelMode);

  // 확정 후 처리
  await finalizeConfirmation(autoAssignedSlots, room, travelMode);

  // 활동 로그
  const mergedCount = Object.values(mergedSlotsByUser).reduce((sum, slots) => sum + slots.length, 0);
  await logConfirmActivity(
    room._id,
    userId,
    userName,
    autoAssignedSlots.length,
    mergedCount,
    Object.keys(mergedSlotsByUser).length
  );

  // Socket.io 이벤트
  emitConfirmEvent(room._id);

  return {
    confirmedSlotsCount: autoAssignedSlots.length,
    mergedSlotsCount: mergedCount,
    affectedMembersCount: Object.keys(mergedSlotsByUser).length,
    confirmedTravelMode: travelMode || 'normal'
  };
};

module.exports = {
  confirmSlotsToPersonalCalendar,
  groupSlotsByUserAndDate,
  mergeSlotsPerUser,
  addSlotsToMembersPersonalTimes,
  addSlotsToOwnerPersonalTimes,
  saveUserWithRetry,
  saveAllUsers,
  saveRoomAfterConfirm,
  finalizeConfirmation,
  logConfirmActivity,
  emitConfirmEvent,
};
