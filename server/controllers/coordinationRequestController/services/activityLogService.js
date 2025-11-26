// Activity Log 서비스

const ActivityLog = require('../../../models/ActivityLog');

/**
 * 요청 승인 로그 기록
 * @param {string} roomId - 방 ID
 * @param {string} userId - 사용자 ID
 * @param {string} responderName - 응답자 이름
 * @param {string} requesterName - 요청자 이름
 * @param {string} slotDetails - 슬롯 상세 정보
 * @param {string} prevSlotDetails - 이전 슬롯 상세 정보
 */
const logApproval = async (roomId, userId, responderName, requesterName, slotDetails, prevSlotDetails) => {
  await ActivityLog.logActivity(
    roomId,
    userId,
    responderName,
    'change_approve',
    `${requesterName}님의 요청(${slotDetails})을 승인`,
    { responder: responderName, requester: requesterName, slot: slotDetails }
  );

  const requesterLogDetails = prevSlotDetails
    ? `${requesterName}님: ${prevSlotDetails} → ${slotDetails}로 변경 완료 (${responderName}님 승인)`
    : `${requesterName}님: ${slotDetails}로 변경 완료 (${responderName}님 승인)`;

  await ActivityLog.logActivity(
    roomId,
    userId,
    requesterName,
    'slot_swap',
    requesterLogDetails,
    {
      prevSlot: prevSlotDetails,
      slot: slotDetails,
      type: 'from_request',
      approver: responderName
    }
  );
};

/**
 * 요청 거절 로그 기록
 * @param {string} roomId - 방 ID
 * @param {string} userId - 사용자 ID
 * @param {string} responderName - 응답자 이름
 * @param {string} requesterName - 요청자 이름
 * @param {string} slotDetails - 슬롯 상세 정보
 */
const logRejection = async (roomId, userId, responderName, requesterName, slotDetails) => {
  await ActivityLog.logActivity(
    roomId,
    userId,
    responderName,
    'change_reject',
    `${requesterName}님의 요청(${slotDetails})을 거절`,
    { responder: responderName, requester: requesterName, slot: slotDetails }
  );
};

/**
 * 슬롯 정보 포맷팅
 * @param {Object} timeSlot - 시간 슬롯
 * @returns {string} 포맷된 슬롯 정보
 */
const formatSlotDetails = (timeSlot) => {
  if (!timeSlot) return '';

  if (timeSlot.date) {
    const slotDate = new Date(timeSlot.date);
    const slotMonth = slotDate.getUTCMonth() + 1;
    const slotDay = slotDate.getUTCDate();
    return `${slotMonth}월 ${slotDay}일 ${timeSlot.startTime}-${timeSlot.endTime}`;
  } else {
    return `${timeSlot.day} ${timeSlot.startTime}-${timeSlot.endTime}`;
  }
};

module.exports = {
  logApproval,
  logRejection,
  formatSlotDetails
};
