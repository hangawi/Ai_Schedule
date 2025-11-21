/**
 * 점수 계산 서비스
 */

const {
  SCORE_BASE,
  SCORE_CONTENDER_PENALTY,
  SCORE_PRIORITY_BONUS,
  SCORE_CONTINUITY_BONUS,
  SCORE_PROXIMITY_BONUS_MAX,
  SCORE_PROXIMITY_PENALTY_PER_HOUR,
  SCORE_FOCUS_TIME_BONUS
} = require('../constants/schedulingConstants');
const { isInPreferredTime } = require('../utils/timeUtils');
const { getPreviousSlotKey, extractTimeFromSlotKey } = require('../utils/slotUtils');
const { createConflictKeysSet } = require('../validators/conflictValidator');
const { findMemberById, getMemberPriority } = require('../helpers/memberHelper');

/**
 * 멤버에게 가장 좋은 슬롯 찾기
 * @param {Object} timetable - 타임테이블 객체
 * @param {Object} assignments - assignments 객체
 * @param {string} memberId - 멤버 ID
 * @param {number} priority - 최소 우선순위
 * @param {Array} members - 멤버 배열
 * @param {Object} ownerPreferences - 방장 선호 설정
 * @param {number} minSlotsPerWeek - 주당 최소 슬롯
 * @param {Array} conflictingSlots - 충돌 슬롯 배열
 * @returns {Object|null} 최적 슬롯 정보 또는 null
 */
const findBestSlotForMember = (timetable, assignments, memberId, priority, members = [], ownerPreferences = {}, minSlotsPerWeek = 6, conflictingSlots = []) => {
  let bestSlot = null;
  let bestScore = -1;

  const focusTimeType = ownerPreferences.focusTimeType || 'none';

  // 사용자의 이미 할당된 슬롯들에서 평균 시간대 계산
  const memberSlots = assignments[memberId].slots;
  let avgTime = 12; // 기본값 12시 (정오)

  if (memberSlots.length > 0) {
    const times = memberSlots.map(slot => {
      const timeStr = slot.startTime || slot.time;
      if (!timeStr) return 12;
      const [h, m] = timeStr.split(':').map(Number);
      return h + (m / 60);
    });
    avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
  }

  // 충돌 슬롯 키 Set
  const conflictingSlotKeys = createConflictKeysSet(conflictingSlots);

  for (const key in timetable) {
    const slot = timetable[key];
    if (slot.assignedTo) continue;

    // 협의 중인 슬롯 스킵
    if (conflictingSlotKeys.has(key)) {
      continue;
    }

    const memberAvailability = slot.available.find(a => a.memberId === memberId && a.priority >= priority && !a.isOwner);
    if (memberAvailability) {
      const contenders = slot.available.filter(a => !a.isOwner).length;

      // 기본 점수: 경쟁자 수에 따라 감점
      let score = SCORE_BASE - (contenders * SCORE_CONTENDER_PENALTY);

      // 선호도 보너스: 높은 priority일수록 보너스 점수
      score += (memberAvailability.priority - priority) * SCORE_PRIORITY_BONUS;

      // 연속성 보너스: 이전 슬롯이 같은 멤버에게 할당된 경우
      const prevKey = getPreviousSlotKey(key);
      if (prevKey && timetable[prevKey] && timetable[prevKey].assignedTo === memberId) {
        score += SCORE_CONTINUITY_BONUS;
      }

      // 시간대 근접성 보너스: 평균 시간에 가까울수록 높은 점수
      const timeStr = extractTimeFromSlotKey(key);
      const [h, m] = timeStr.split(':').map(Number);
      const slotTime = h + (m / 60);
      const timeDiff = Math.abs(slotTime - avgTime);
      const proximityBonus = Math.max(0, SCORE_PROXIMITY_BONUS_MAX - (timeDiff * SCORE_PROXIMITY_PENALTY_PER_HOUR));
      score += proximityBonus;

      // 집중시간 보너스: 설정된 집중시간에 맞는 시간대일 경우 추가 점수
      const slotTimeString = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      if (isInPreferredTime(slotTimeString, focusTimeType)) {
        score += SCORE_FOCUS_TIME_BONUS;
      }

      if (score > bestScore) {
        bestScore = score;
        bestSlot = { key, slot };
      }
    }
  }

  if (bestSlot) {
    return { bestSlot, score: bestScore };
  }
  return null;
};

/**
 * 방장 선호에 따라 슬롯 우선순위 정렬
 * @param {Array} slots - 슬롯 키 배열
 * @param {Object} ownerPreferences - 방장 선호 설정
 * @returns {Array} 정렬된 슬롯 키 배열
 */
const prioritizeSlotsByOwnerPreference = (slots, ownerPreferences) => {
  if (!ownerPreferences.focusTimeType || ownerPreferences.focusTimeType === 'none') {
    return slots;
  }

  // 날짜별로 슬롯 그룹화
  const slotsByDate = {};
  slots.forEach(key => {
    const [date] = key.split('-');
    if (!slotsByDate[date]) {
      slotsByDate[date] = [];
    }
    slotsByDate[date].push(key);
  });

  // 선호 시간대 내의 슬롯과 그 외 슬롯 분리
  const prioritizedSlots = [];
  const nonPreferredSlots = [];

  Object.keys(slotsByDate).forEach(date => {
    const daySlots = slotsByDate[date].sort();
    const preferredSlots = [];
    const otherSlots = [];

    daySlots.forEach(key => {
      const time = key.split('-').pop();
      if (isInPreferredTime(time, ownerPreferences.focusTimeType)) {
        preferredSlots.push(key);
      } else {
        otherSlots.push(key);
      }
    });

    prioritizedSlots.push(...preferredSlots);
    nonPreferredSlots.push(...otherSlots);
  });

  return [...prioritizedSlots, ...nonPreferredSlots];
};

module.exports = {
  findBestSlotForMember,
  prioritizeSlotsByOwnerPreference
};
