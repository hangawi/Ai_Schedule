// 자동 스케줄링 서비스
const User = require('../../../models/user');
const schedulingAlgorithm = require('../../../services/schedulingAlgorithm');
const { addDays } = require('../utils/timeUtils');

/**
 * 자동 스케줄링 실행
 * @param {Array} membersOnly - 조원 목록
 * @param {Object} owner - 방장 객체
 * @param {Array} existingSlots - 기존 슬롯
 * @param {Object} options - 옵션 객체
 * @param {Array} carryOvers - 이월 정보
 * @returns {Promise<Object>} 스케줄링 결과
 */
const runAutoScheduling = async (membersOnly, owner, existingSlots, options, carryOvers) => {
  return await schedulingAlgorithm.runAutoSchedule(
    membersOnly,
    owner,
    existingSlots,
    options,
    carryOvers
  );
};

/**
 * 장기 이월 멤버 확인
 * @param {Array} members - 멤버 배열
 * @param {Date} startDate - 시작 날짜
 * @returns {Promise<Array>} 충돌 제안 배열
 */
const checkLongTermCarryOvers = async (members, startDate) => {
  const twoWeeksAgo = addDays(startDate, -14);
  const oneWeekAgo = addDays(startDate, -7);
  const suggestions = [];

  for (const member of members) {
    const memberUser = await User.findById(member.user);
    if (member.carryOver > 0) {
      const history = member.carryOverHistory || [];

      const hasConsecutiveCarryOver = history.some(h =>
        new Date(h.week).getTime() >= twoWeeksAgo.getTime() &&
        new Date(h.week).getTime() < oneWeekAgo.getTime() &&
        h.amount > 0
      );

      if (hasConsecutiveCarryOver) {
        const memberName = memberUser.name || `${memberUser.firstName} ${memberUser.lastName}`;
        suggestions.push({
          title: '장기 이월 멤버 발생',
          content: `멤버 '${memberName}'의 시간이 2주 이상 연속으로 이월되었습니다. 최소 할당 시간을 줄이거나, 멤버의 참여 가능 시간을 늘리거나, 직접 시간을 할당하여 문제를 해결해야 합니다.`
        });
      }
    }
  }

  return suggestions;
};

/**
 * 스케줄링 결과 처리
 * @param {Object} room - 방 객체
 * @param {Object} result - 스케줄링 결과
 */
const applySchedulingResult = (room, result) => {
  // 새로운 슬롯 추가
  room.timeSlots.push(...result.newSlots);

  // 멤버 업데이트
  for (const member of room.members) {
    const memberId = member.user._id ? member.user._id.toString() : member.user.toString();
    const updatedMember = result.updatedMembers.find(m => m.memberId.toString() === memberId);

    if (updatedMember) {
      member.carryOver = updatedMember.carryOver;
      member.priority = updatedMember.priority;

      if (!member.carryOverHistory) {
        member.carryOverHistory = [];
      }

      if (updatedMember.carryOver > 0) {
        member.carryOverHistory.push({
          week: result.currentWeek || new Date(),
          amount: updatedMember.carryOver
        });
      }
    }
  }
};

module.exports = {
  runAutoScheduling,
  checkLongTermCarryOvers,
  applySchedulingResult,
};
