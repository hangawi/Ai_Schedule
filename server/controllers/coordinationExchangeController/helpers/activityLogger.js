/**
 * ActivityLog 기록 헬퍼
 */

const ActivityLog = require('../../../models/ActivityLog');

/**
 * 슬롯 교환 로그 기록
 * @param {string} roomId - 방 ID
 * @param {string} userId - 사용자 ID
 * @param {string} userName - 사용자 이름
 * @param {Object} prevSlot - 이전 슬롯 정보
 * @param {Object} targetSlot - 타겟 슬롯 정보
 */
async function logSlotSwap(roomId, userId, userName, prevSlot, targetSlot) {
  const prevDate = new Date(prevSlot.date);
  const prevMonth = prevDate.getUTCMonth() + 1;
  const prevDay = prevDate.getUTCDate();
  const prevTimeRange = `${prevSlot.startTime}-${prevSlot.endTime}`;

  const message = `${userName}님: ${prevMonth}월 ${prevDay}일 ${prevTimeRange} → ${targetSlot.month}월 ${targetSlot.day}일 ${targetSlot.startTime}-${targetSlot.endTime}로 즉시 변경`;

  await ActivityLog.logActivity(
    roomId,
    userId,
    userName,
    'slot_swap',
    message,
    {
      prevDate: `${prevMonth}월 ${prevDay}일`,
      prevTime: prevTimeRange,
      targetDate: `${targetSlot.month}월 ${targetSlot.day}일`,
      targetTime: `${targetSlot.startTime}-${targetSlot.endTime}`
    }
  );
}

/**
 * 자동 배치 로그 기록
 * @param {string} roomId - 방 ID
 * @param {string} userId - 사용자 ID
 * @param {string} userName - 사용자 이름
 * @param {Object} prevSlot - 이전 슬롯 정보
 * @param {Object} targetSlot - 타겟 슬롯 정보
 */
async function logAutoPlacement(roomId, userId, userName, prevSlot, targetSlot) {
  const prevDate = new Date(prevSlot.date);
  const prevMonth = prevDate.getUTCMonth() + 1;
  const prevDay = prevDate.getUTCDate();
  const prevTimeRange = `${prevSlot.startTime}-${prevSlot.endTime}`;

  const message = `${userName}님: ${prevMonth}월 ${prevDay}일 ${prevTimeRange} → ${targetSlot.month}월 ${targetSlot.day}일 ${targetSlot.startTime}-${targetSlot.endTime}로 자동 배치`;

  await ActivityLog.logActivity(
    roomId,
    userId,
    userName,
    'slot_swap',
    message,
    {
      prevDate: `${prevMonth}월 ${prevDay}일`,
      prevTime: prevTimeRange,
      targetDate: `${targetSlot.month}월 ${targetSlot.day}일`,
      targetTime: `${targetSlot.startTime}-${targetSlot.endTime}`
    }
  );
}

/**
 * 변경 요청 로그 기록
 * @param {string} roomId - 방 ID
 * @param {string} userId - 사용자 ID
 * @param {string} userName - 사용자 이름
 * @param {Object} prevSlot - 이전 슬롯 정보
 * @param {Object} targetSlot - 타겟 슬롯 정보
 * @param {Array} targetUsers - 타겟 사용자 배열
 */
async function logChangeRequest(roomId, userId, userName, prevSlot, targetSlot, targetUsers) {
  const prevDate = new Date(prevSlot.date);
  const prevMonth = prevDate.getUTCMonth() + 1;
  const prevDay = prevDate.getUTCDate();
  const prevTimeRange = `${prevSlot.startTime}-${prevSlot.endTime}`;

  const message = `${userName}님(${prevMonth}월 ${prevDay}일 ${prevTimeRange})이 ${targetUsers.join(', ')}님에게 ${targetSlot.month}월 ${targetSlot.day}일 ${targetSlot.startTime}-${targetSlot.endTime} 자리 요청`;

  await ActivityLog.logActivity(
    roomId,
    userId,
    userName,
    'change_request',
    message,
    {
      prevDate: `${prevMonth}월 ${prevDay}일`,
      prevTime: prevTimeRange,
      targetDate: `${targetSlot.month}월 ${targetSlot.day}일`,
      targetTime: `${targetSlot.startTime}-${targetSlot.endTime}`,
      targetUsers,
      requester: userName
    }
  );
}

module.exports = {
  logSlotSwap,
  logAutoPlacement,
  logChangeRequest
};
