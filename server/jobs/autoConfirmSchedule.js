const cron = require('node-cron');
const Room = require('../models/room');
const User = require('../models/user');
const ActivityLog = require('../models/activityLog');

/**
 * 자동 확정 로직 (confirmSchedule과 동일한 로직)
 */
async function confirmRoomSchedule(room) {
  try {
    // 1. 방 조회 (populate members)
    await room.populate('owner', 'firstName lastName email personalTimes defaultSchedule scheduleExceptions');
    await room.populate('members.user', '_id firstName lastName email personalTimes defaultSchedule scheduleExceptions');

    // 2. 자동배정된 슬롯 필터링 (assignedBy가 있고 status가 'confirmed'인 것)
    const autoAssignedSlots = room.timeSlots.filter(slot =>
      slot.assignedBy && slot.status === 'confirmed'
    );

    if (autoAssignedSlots.length === 0) {
      console.log(`⚠️ [자동확정] 방 ${room._id}: 확정할 자동배정 시간이 없음`);
      return { success: false, reason: 'no_slots' };
    }

    // 헬퍼 함수: 시간 문자열을 분 단위로 변환 (예: "09:30" -> 570)
    const timeToMinutes = (timeStr) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };

    // 헬퍼 함수: 분을 시간 문자열로 변환 (예: 570 -> "09:30")
    const minutesToTime = (minutes) => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    };

    // 헬퍼 함수: 연속된 슬롯 병합
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

    // 3. 조원별, 날짜별로 그룹화 후 병합
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

    // 각 그룹의 슬롯을 병합
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

    // 헬퍼 함수: day 문자열을 숫자로 변환
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

    // 헬퍼 함수: 선호시간에서 배정된 부분만 제거하고 나머지는 분할하여 유지 + 백업
    const removePreferenceTimes = (user, slots, roomId) => {
      const deletedTimes = [];
      const newDefaultSchedule = [];

      // 1. 슬롯을 날짜/요일별로 그룹화하고 병합된 시간 범위 계산
      const assignedRangesByKey = {};

      slots.forEach(slot => {
        const dateStr = slot.date.toISOString().split('T')[0];
        const dayOfWeek = getDayOfWeekNumber(slot.day);
        const key = dateStr; // 날짜별로 그룹화

        if (!assignedRangesByKey[key]) {
          assignedRangesByKey[key] = {
            dateStr,
            dayOfWeek,
            minStart: Infinity,
            maxEnd: -Infinity
          };
        }

        const start = timeToMinutes(slot.startTime);
        const end = timeToMinutes(slot.endTime);
        assignedRangesByKey[key].minStart = Math.min(assignedRangesByKey[key].minStart, start);
        assignedRangesByKey[key].maxEnd = Math.max(assignedRangesByKey[key].maxEnd, end);
      });

      // 2. 각 선호시간을 확인하고 배정 범위와 겹치면 분할
      if (user.defaultSchedule) {
        user.defaultSchedule.forEach(schedule => {
          const scheduleDayOfWeek = schedule.dayOfWeek === 0 ? 7 : schedule.dayOfWeek;

          // 이 선호시간과 겹치는 배정이 있는지 찾기
          let hasOverlap = false;
          let assignedRange = null;

          for (const [key, range] of Object.entries(assignedRangesByKey)) {
            // specificDate가 있으면 날짜로 매칭, 없으면 요일로 매칭
            const matches = schedule.specificDate
              ? schedule.specificDate === range.dateStr
              : scheduleDayOfWeek === range.dayOfWeek;

            if (matches) {
              hasOverlap = true;
              assignedRange = range;
              break;
            }
          }

          if (!hasOverlap) {
            // 배정과 겹치지 않으면 그대로 유지
            newDefaultSchedule.push(schedule);
          } else {
            // 배정과 겹침 - 분할 처리
            const prefStart = timeToMinutes(schedule.startTime);
            const prefEnd = timeToMinutes(schedule.endTime);
            const assignedStart = assignedRange.minStart;
            const assignedEnd = assignedRange.maxEnd;

            // 겹치는 부분 계산
            const overlapStart = Math.max(prefStart, assignedStart);
            const overlapEnd = Math.min(prefEnd, assignedEnd);

            if (overlapStart < overlapEnd) {
              // 실제로 겹침 - 겹치는 부분을 백업
              deletedTimes.push({
                dayOfWeek: schedule.dayOfWeek,
                startTime: minutesToTime(overlapStart),
                endTime: minutesToTime(overlapEnd),
                priority: schedule.priority,
                specificDate: schedule.specificDate
              });

              // 선호시간의 앞부분이 배정보다 이전이면 유지
              if (prefStart < assignedStart) {
                newDefaultSchedule.push({
                  dayOfWeek: schedule.dayOfWeek,
                  startTime: schedule.startTime,
                  endTime: minutesToTime(assignedStart),
                  priority: schedule.priority,
                  specificDate: schedule.specificDate
                });
              }

              // 선호시간의 뒷부분이 배정보다 이후면 유지
              if (prefEnd > assignedEnd) {
                newDefaultSchedule.push({
                  dayOfWeek: schedule.dayOfWeek,
                  startTime: minutesToTime(assignedEnd),
                  endTime: schedule.endTime,
                  priority: schedule.priority,
                  specificDate: schedule.specificDate
                });
              }
            } else {
              // 겹치지 않으면 그대로 유지
              newDefaultSchedule.push(schedule);
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

    // 4. 각 조원의 personalTimes에 추가 + 선호시간 삭제
    // User 객체를 Map으로 관리하여 중복 저장 방지 (VersionError 해결)
    const userMap = new Map();
    const ownerName = `${room.owner.firstName || ''} ${room.owner.lastName || ''}`.trim() || '방장';

    // 4-1. 조원들 처리
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
          user.personalTimes.push({
            id: nextId++,
            title: `${room.name} - ${ownerName}`,
            type: 'event',
            startTime: slot.startTime,
            endTime: slot.endTime,
            days: [dayOfWeek],
            isRecurring: false,
            specificDate: dateStr,
            color: '#10B981' // 초록색
          });
        }
      });
    }

    // 4-2. 방장 처리
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

      // 방장의 선호시간 삭제 + 백업
      removePreferenceTimes(owner, autoAssignedSlots, room._id);

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
            owner.personalTimes.push({
              id: nextId++,
              title: `${room.name} - ${memberName}`,
              type: 'event',
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
    }

    // 4-3. 모든 사용자 한 번에 저장 (각 사용자는 한 번만 저장됨) with retry logic
    const saveUserWithRetry = async (user, maxRetries = 3) => {
      let currentUser = user;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await currentUser.save();
          return; // 성공
        } catch (error) {
          if (error.name === 'VersionError' && attempt < maxRetries) {
            console.log(`⚠️ VersionError for user ${user._id}, retrying (${attempt}/${maxRetries})...`);

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

    const updatePromises = Array.from(userMap.values()).map(user => saveUserWithRetry(user));
    await Promise.all(updatePromises);

    // 자동 확정 타이머 해제 (수동 확정 완료) with retry logic
    room.autoConfirmAt = null;

    let roomSaved = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await room.save();
        roomSaved = true;
        break;
      } catch (error) {
        if (error.name === 'VersionError' && attempt < 3) {
          console.log(`⚠️ VersionError for room ${room._id}, retrying (${attempt}/3)...`);
          // 최신 버전 다시 조회
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

    // 5. 활동 로그 기록
    const ownerUser = await User.findById(room.owner._id || room.owner);
    const ownerDisplayName = ownerUser ? `${ownerUser.firstName} ${ownerUser.lastName}` : '방장';

    await ActivityLog.logActivity(
      room._id,
      room.owner._id || room.owner,
      ownerDisplayName,
      'confirm_schedule',
      `[자동] 자동배정 시간 확정 완료 (${autoAssignedSlots.length}개 슬롯 → ${Object.values(mergedSlotsByUser).reduce((sum, slots) => sum + slots.length, 0)}개 병합, 조원 ${Object.keys(mergedSlotsByUser).length}명 + 방장)`
    );

    console.log(`✅ [자동확정] 방 ${room._id} (${room.name}): 성공적으로 확정됨`);

    // Socket.io로 실시간 알림 전송
    if (global.io) {
      global.io.to(`room-${room._id}`).emit('schedule-confirmed', {
        roomId: room._id,
        message: '자동배정 시간이 확정되었습니다.',
        timestamp: new Date()
      });
      console.log(`📡 [자동확정] Socket 이벤트 전송: room-${room._id}`);
    }

    return { success: true };

  } catch (error) {
    console.error(`❌ [자동확정] 방 ${room._id} 확정 실패:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 자동 확정이 필요한 방들을 찾아서 확정
 */
async function processAutoConfirm() {
  try {
    const now = new Date();

    // autoConfirmAt이 현재 시간보다 이전이고 null이 아닌 방들 찾기
    const roomsToConfirm = await Room.find({
      autoConfirmAt: { $ne: null, $lt: now }
    })
    .populate('owner', 'firstName lastName email personalTimes defaultSchedule scheduleExceptions')
    .populate('members.user', '_id firstName lastName email personalTimes defaultSchedule scheduleExceptions');

    if (roomsToConfirm.length === 0) {
      return;
    }

    console.log(`\n🔔 [자동확정] ${roomsToConfirm.length}개 방의 자동 확정 시작...`);

    for (const room of roomsToConfirm) {
      await confirmRoomSchedule(room);
    }

    console.log(`✅ [자동확정] 처리 완료\n`);

  } catch (error) {
    console.error('❌ [자동확정] 처리 중 오류:', error);
  }
}

/**
 * Cron Job 시작
 * 매 1분마다 자동 확정 체크
 */
function startAutoConfirmJob() {
  // 매 1분마다 실행 (*/1 * * * *)
  cron.schedule('*/1 * * * *', () => {
    processAutoConfirm();
  });

  console.log('✅ 자동 확정 Cron Job이 시작되었습니다. (매 1분마다 실행)');
}

module.exports = { startAutoConfirmJob };
