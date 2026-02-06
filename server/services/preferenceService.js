/**
 * ===================================================================================================
 * Preference Service (선호시간 체크 서비스)
 * ===================================================================================================
 *
 * 설명: AI 일정 제안 시 방 멤버들의 선호시간과 충돌 여부를 체크하는 서비스
 *
 * 주요 기능:
 * - 방 멤버들의 선호시간 조회
 * - 제안 시간과 선호시간 충돌 체크
 * - 충돌 발생 시 경고 메시지 생성
 *
 * 관련 파일:
 * - server/models/user.js - 사용자 선호시간 스키마
 * - server/models/room.js - 방 모델
 * - server/services/aiScheduleService.js - AI 일정 제안 서비스
 *
 * ===================================================================================================
 */

const User = require('../models/user');
const Room = require('../models/room');
const Event = require('../models/event');

/**
 * 시간 문자열(HH:MM)을 분으로 변환
 * @param {string} timeStr - "09:00" 형식
 * @returns {number} - 분 단위 (예: 540)
 */
function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * 두 시간 범위가 겹치는지 확인
 * @param {string} start1 - 범위1 시작 시간 (HH:MM)
 * @param {string} end1 - 범위1 종료 시간 (HH:MM)
 * @param {string} start2 - 범위2 시작 시간 (HH:MM)
 * @param {string} end2 - 범위2 종료 시간 (HH:MM)
 * @returns {boolean} - 겹치면 true
 */
function isTimeOverlap(start1, end1, start2, end2) {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);

  // 두 범위가 겹치지 않는 경우: 범위1이 범위2보다 완전히 이전 또는 이후
  // 겹치는 경우는 이것의 부정
  return !(e1 <= s2 || e2 <= s1);
}

/**
 * 날짜 문자열(YYYY-MM-DD)에서 요일 추출 (0: 일요일, 1: 월요일, ..., 6: 토요일)
 * @param {string} dateStr - "2026-01-10" 형식
 * @returns {number} - 요일 (0-6)
 */
function getDayOfWeek(dateStr) {
  const date = new Date(dateStr);
  return date.getDay(); // 0: Sunday, 1: Monday, ..., 6: Saturday
}

/**
 * 방 멤버들의 확정된 일정과 제안 시간의 충돌 여부 체크
 * (선호시간은 체크하지 않음 - 친구끼리 약속은 선호시간 무관)
 * @param {string} roomId - 방 ID
 * @param {Object} suggestion - AI 제안 일정
 * @param {string} suggestion.date - 날짜 (YYYY-MM-DD)
 * @param {string} suggestion.startTime - 시작 시간 (HH:MM)
 * @param {string} suggestion.endTime - 종료 시간 (HH:MM)
 * @returns {Promise<Object>} - 충돌 정보
 */
exports.checkTimeConflict = async (roomId, suggestion) => {
  try {
    const { date, startTime, endTime } = suggestion;

    // 1. 방 정보 조회 (멤버 및 timeSlots populate)
    const room = await Room.findById(roomId).populate({
      path: 'members.user',
      select: 'firstName lastName personalTimes'
    });

    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    const proposedDate = new Date(date);
    proposedDate.setHours(0, 0, 0, 0); // 날짜만 비교

    // 3. 각 멤버의 확정된 일정 체크
    const conflicts = [];
    const availableMembers = [];

    console.log('[충돌체크] 방 멤버 수:', room.members.length);
    for (const member of room.members) {
      const user = member.user;
      console.log('[충돌체크] 멤버:', user?.firstName, '- personalTimes 있음?', !!user?.personalTimes, '개수:', user?.personalTimes?.length);
      if (!user) continue;

      let hasConflict = false;
      const conflictReasons = [];

      // 체크 1: Room의 timeSlots (이미 확정된 그룹 일정)
      if (room.timeSlots && room.timeSlots.length > 0) {
        for (const slot of room.timeSlots) {
          // 이 멤버의 슬롯인지 확인
          const slotUserId = slot.user._id ? slot.user._id.toString() : slot.user.toString();
          if (slotUserId !== user._id.toString()) continue;

          // 같은 날짜인지 확인
          const slotDate = new Date(slot.date);
          slotDate.setHours(0, 0, 0, 0);

          if (slotDate.getTime() === proposedDate.getTime()) {
            // 시간이 겹치는지 확인
            if (isTimeOverlap(startTime, endTime, slot.startTime, slot.endTime)) {
              hasConflict = true;
              conflictReasons.push({
                type: 'confirmed',
                title: slot.subject,
                time: `${slot.startTime}-${slot.endTime}`
              });
            }
          }
        }
      }

      // 체크 2: personalTimes 중 specificDate가 있는 것만 (특정 날짜 약속)
      console.log(`[충돌체크] ${user.firstName}의 personalTimes:`, user.personalTimes?.length || 0, '개');
      if (user.personalTimes && user.personalTimes.length > 0) {
        for (const pt of user.personalTimes) {
          console.log(`[충돌체크] - ${pt.title}: ${pt.specificDate} ${pt.startTime}-${pt.endTime}`);
          // specificDate가 있고, 날짜가 일치하는지 확인
          if (pt.specificDate) {
            const ptDate = new Date(pt.specificDate);
            ptDate.setHours(0, 0, 0, 0);

            if (ptDate.getTime() === proposedDate.getTime()) {
              // 시간이 겹치는지 확인
              if (isTimeOverlap(startTime, endTime, pt.startTime, pt.endTime)) {
                hasConflict = true;
                conflictReasons.push({
                  type: 'personal',
                  title: pt.title,
                  time: `${pt.startTime}-${pt.endTime}`,
                  slotType: pt.type
                });
              }
            }
          }
        }
      }

      // 체크 3: events (개인 일정) 체크
      try {
        const userEvents = await Event.find({
          userId: user._id,
          startTime: {
            $gte: new Date(`${date}T00:00:00`),
            $lt: new Date(`${date}T23:59:59`)
          },
          status: { $ne: 'cancelled' }
        });

        for (const event of userEvents) {
          const eventStartTime = event.startTime.toTimeString().substring(0, 5);
          const eventEndTime = event.endTime.toTimeString().substring(0, 5);

          if (isTimeOverlap(startTime, endTime, eventStartTime, eventEndTime)) {
            hasConflict = true;
            conflictReasons.push({
              type: 'event',
              title: '일정 있음', // 제목 비공개
              time: `${eventStartTime}-${eventEndTime}`
            });
          }
        }
      } catch (eventErr) {
        console.warn('⚠️ [Preference Service] Failed to check events for user:', user._id, eventErr.message);
      }

      // 결과 저장
      if (hasConflict) {
        conflicts.push({
          userId: user._id,
          userName: `${user.firstName} ${user.lastName}`,
          reasons: conflictReasons
        });
      } else {
        availableMembers.push({
          userId: user._id,
          userName: `${user.firstName} ${user.lastName}`
        });
      }
    }

    // 4. 결과 반환
    return {
      hasConflict: conflicts.length > 0,
      conflicts,
      availableMembers,
      totalMembers: room.members.length,
      conflictCount: conflicts.length,
      availableCount: availableMembers.length
    };

  } catch (error) {
    console.error('❌ [Preference Service] checkTimeConflict failed:', error);
    throw error;
  }
};

/**
 * 충돌 정보를 사용자 친화적인 메시지로 변환
 * @param {Object} conflictInfo - checkTimeConflict의 결과
 * @returns {string} - 경고 메시지
 */
exports.generateConflictMessage = (conflictInfo) => {
  if (!conflictInfo.hasConflict) {
    return `✅ 모든 멤버가 이 시간에 가능합니다. (${conflictInfo.totalMembers}명)`;
  }

  let message = `⚠️ ${conflictInfo.conflictCount}명의 멤버가 이 시간에 이미 다른 약속이 있습니다:\n\n`;

  for (const conflict of conflictInfo.conflicts) {
    message += `• ${conflict.userName}\n`;
    for (const reason of conflict.reasons) {
      if (reason.type === 'confirmed') {
        message += `  - ${reason.title} (${reason.time}) [확정된 일정]\n`;
      } else if (reason.type === 'personal') {
        message += `  - ${reason.title} (${reason.time})\n`;
      }
    }
  }

  if (conflictInfo.availableCount > 0) {
    message += `\n✅ 가능한 멤버: ${conflictInfo.availableCount}명`;
  }

  return message;
};
