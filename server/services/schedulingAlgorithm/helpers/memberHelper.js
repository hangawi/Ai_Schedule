/**
 * 멤버 관련 헬퍼 함수
 */

const { DEFAULT_PRIORITY } = require('../constants/priorityConstants');

/**
 * 멤버의 우선순위 가져오기
 * @param {Object} member - 멤버 객체
 * @returns {number} 우선순위 (1-5)
 */
const getMemberPriority = (member) => {
  // Room-level priority 우선 체크
  if (member && member.priority) {
    return member.priority;
  }
  // User-level priority
  if (member && member.user && member.user.priority) {
    return member.user.priority;
  }
  return DEFAULT_PRIORITY;
};

/**
 * 멤버 ID 추출
 * @param {Object} member - 멤버 객체
 * @returns {string|null} 멤버 ID
 */
const extractMemberId = (member) => {
  if (!member || !member.user) return null;
  return member.user._id ? member.user._id.toString() : null;
};

/**
 * 멤버 배열에서 특정 ID의 멤버 찾기
 * @param {Array} members - 멤버 배열
 * @param {string} memberId - 찾을 멤버 ID
 * @returns {Object|null} 멤버 객체
 */
const findMemberById = (members, memberId) => {
  return members.find(m => {
    const id = extractMemberId(m);
    return id === memberId;
  }) || null;
};

/**
 * 방장 제외 멤버 필터링
 * @param {Array} members - 멤버 배열
 * @param {string} ownerId - 방장 ID
 * @returns {Array} 방장 제외 멤버 배열
 */
const filterNonOwnerMembers = (members, ownerId) => {
  return members.filter(m => {
    const memberId = extractMemberId(m);
    return memberId !== ownerId;
  });
};

/**
 * 멤버 배열을 우선순위로 정렬 (높은 순)
 * @param {Array} members - 멤버 배열
 * @returns {Array} 정렬된 멤버 배열
 */
const sortMembersByPriority = (members) => {
  return [...members].sort((a, b) => {
    const priorityA = getMemberPriority(a);
    const priorityB = getMemberPriority(b);
    return priorityB - priorityA; // 높은 순
  });
};

/**
 * 멤버의 필요 슬롯 계산
 * @param {Object} member - 멤버 객체
 * @param {Object} memberRequiredSlots - 필요 슬롯 정보
 * @param {Object} assignments - assignments 객체
 * @returns {number} 필요 슬롯 수
 */
const getMemberNeededSlots = (member, memberRequiredSlots, assignments) => {
  const memberId = extractMemberId(member);
  if (!memberId) return 0;

  const requiredSlots = memberRequiredSlots[memberId] || 0;
  const assignedSlots = assignments[memberId]?.assignedHours || 0;
  return Math.max(0, requiredSlots - assignedSlots);
};

/**
 * 멤버별 유연성 점수 계산 (대체 가능한 슬롯 수)
 * @param {Array} members - 멤버 배열
 * @param {Object} memberAvailableSlots - 멤버별 가용 슬롯 수
 * @returns {Array} {memberId, score} 배열
 */
const calculateFlexibilityScores = (members, memberAvailableSlots) => {
  return members.map(member => {
    const memberId = extractMemberId(member);
    return {
      memberId,
      score: memberAvailableSlots[memberId] || 0
    };
  });
};

/**
 * 유연성 점수로 멤버 정렬 (낮은 순 - 유연성이 적은 순)
 * @param {Array} flexibilityScores - 유연성 점수 배열
 * @returns {Array} 정렬된 배열
 */
const sortByFlexibility = (flexibilityScores) => {
  return [...flexibilityScores].sort((a, b) => a.score - b.score);
};

/**
 * 멤버들의 평균 할당 시간 계산
 * @param {Object} assignments - assignments 객체
 * @param {Array} memberIds - 멤버 ID 배열
 * @returns {number} 평균 할당 시간
 */
const calculateAverageAssignedHours = (assignments, memberIds) => {
  if (memberIds.length === 0) return 0;
  const total = memberIds.reduce((sum, id) => {
    return sum + (assignments[id]?.assignedHours || 0);
  }, 0);
  return total / memberIds.length;
};

/**
 * 미충족 멤버 정보 생성
 * @param {Object} assignments - assignments 객체
 * @param {Object} memberRequiredSlots - 필요 슬롯 정보
 * @param {string} ownerId - 방장 ID
 * @param {Array} members - 멤버 배열
 * @returns {Array} 미충족 멤버 정보 배열
 */
const createUnassignedMembersInfo = (assignments, memberRequiredSlots, ownerId, members) => {
  return Object.keys(assignments)
    .filter(id => {
      if (id === ownerId) return false;
      const requiredSlots = memberRequiredSlots[id] || assignments[id]?.requiredSlots || 18;
      return assignments[id].assignedHours < requiredSlots;
    })
    .map(id => {
      const requiredSlots = memberRequiredSlots[id] || assignments[id]?.requiredSlots || 18;
      const neededHours = (requiredSlots - assignments[id].assignedHours) / 2;

      return {
        memberId: id,
        neededHours: neededHours,
        assignedSlots: assignments[id].slots,
        needsIntervention: assignments[id].needsIntervention || false,
        interventionReason: assignments[id].interventionReason || null
      };
    });
};

/**
 * 캐리오버 배정 생성
 * @param {Object} assignments - assignments 객체
 * @param {Object} memberRequiredSlots - 필요 슬롯 정보
 * @param {string} ownerId - 방장 ID
 * @param {Array} members - 멤버 배열
 * @param {Date} startDate - 시작 날짜
 * @returns {Array} 캐리오버 배정 배열
 */
const createCarryOverAssignments = (assignments, memberRequiredSlots, ownerId, members, startDate) => {
  const carryOverAssignments = [];

  Object.keys(assignments)
    .filter(id => {
      if (id === ownerId) return false;
      const requiredSlots = memberRequiredSlots[id] || assignments[id]?.requiredSlots || 18;
      return assignments[id].assignedHours < requiredSlots;
    })
    .forEach(id => {
      const requiredSlots = memberRequiredSlots[id] || assignments[id]?.requiredSlots || 18;
      const neededHours = (requiredSlots - assignments[id].assignedHours) / 2;
      const member = members.find(m => m.user._id.toString() === id);

      if (neededHours > 0) {
        carryOverAssignments.push({
          memberId: id,
          neededHours: neededHours,
          priority: getMemberPriority(member),
          week: startDate,
          consecutiveCarryOvers: (member?.carryOverHistory || []).filter(h => {
            const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
            return h.timestamp >= twoWeeksAgo;
          }).length
        });
      }
    });

  return carryOverAssignments;
};

module.exports = {
  getMemberPriority,
  extractMemberId,
  findMemberById,
  filterNonOwnerMembers,
  sortMembersByPriority,
  getMemberNeededSlots,
  calculateFlexibilityScores,
  sortByFlexibility,
  calculateAverageAssignedHours,
  createUnassignedMembersInfo,
  createCarryOverAssignments
};
