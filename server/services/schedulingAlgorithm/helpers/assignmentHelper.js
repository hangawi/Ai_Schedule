/**
 * 배정 관련 헬퍼 함수
 */

const { DAY_MAP, DEFAULT_REQUIRED_SLOTS, AUTO_ASSIGNMENT_SUBJECT, SLOT_STATUS } = require('../constants/schedulingConstants');
const { SLOTS_PER_HOUR, MINUTES_PER_SLOT } = require('../constants/timeConstants');
const { extractDateFromSlotKey, extractTimeFromSlotKey, calculateSlotEndTime, createSlotData } = require('../utils/slotUtils');

/**
 * 멤버별 assignments 초기화
 * @param {Array} members - 멤버 배열
 * @param {Object} memberRequiredSlots - 멤버별 필요 슬롯 수
 * @returns {Object} 초기화된 assignments 객체
 */
const initializeMemberAssignments = (members, memberRequiredSlots = {}) => {
  const assignments = {};
  members.forEach(m => {
    const memberId = m.user._id.toString();
    assignments[memberId] = {
      memberId: memberId,
      assignedHours: 0,
      requiredSlots: memberRequiredSlots[memberId] || DEFAULT_REQUIRED_SLOTS,
      slots: []
    };
  });
  return assignments;
};

/**
 * 멤버별 필요 슬롯 계산
 * @param {Array} members - 멤버 배열
 * @param {number} minHoursPerWeek - 주당 최소 시간
 * @param {number} actualWeeksInRange - 실제 주 수
 * @returns {Object} 멤버 ID -> 필요 슬롯 수
 */
const calculateMemberRequiredSlots = (members, minHoursPerWeek, actualWeeksInRange = 1) => {
  const memberRequiredSlots = {};
  members.forEach(m => {
    const memberId = m.user._id.toString();
    const carryOverHours = m.carryOver || 0;
    const totalRequiredHours = (minHoursPerWeek * actualWeeksInRange) + carryOverHours;
    memberRequiredSlots[memberId] = totalRequiredHours * SLOTS_PER_HOUR;
  });
  return memberRequiredSlots;
};

/**
 * 타임테이블에 슬롯 배정
 * @param {Object} timetable - 타임테이블 객체
 * @param {Object} assignments - assignments 객체
 * @param {string} key - 슬롯 키
 * @param {string} memberId - 배정할 멤버 ID
 */
const assignSlot = (timetable, assignments, key, memberId) => {
  const lastDashIndex = key.lastIndexOf('-');
  const dateKey = key.substring(0, lastDashIndex);
  const startTimeRaw = key.substring(lastDashIndex + 1);

  if (!timetable[key]) {
    return;
  }

  const endTime = calculateSlotEndTime(startTimeRaw);
  const slotDate = timetable[key].date;
  const slotDayOfWeek = timetable[key].dayOfWeek;

  if (!slotDate || !slotDayOfWeek) {
    return;
  }

  const dayString = DAY_MAP[slotDayOfWeek];
  if (!dayString) {
    return;
  }

  // 타임테이블에 배정 표시
  timetable[key].assignedTo = memberId;

  // assignments 객체 업데이트
  if (!assignments[memberId]) {
    assignments[memberId] = {
      memberId: memberId,
      assignedHours: 0,
      slots: []
    };
  }

  assignments[memberId].assignedHours += 1;

  const slotData = createSlotData({
    date: slotDate,
    dayString,
    startTime: startTimeRaw,
    endTime,
    memberId,
    subject: AUTO_ASSIGNMENT_SUBJECT,
    status: SLOT_STATUS.CONFIRMED
  });

  if (slotData.date && slotData.day && slotData.startTime && slotData.endTime) {
    assignments[memberId].slots.push(slotData);
  }
};

/**
 * 멤버가 필요한 슬롯을 모두 채웠는지 확인
 * @param {Object} assignments - assignments 객체
 * @param {string} memberId - 멤버 ID
 * @param {Object} memberRequiredSlots - 필요 슬롯 정보
 * @returns {boolean}
 */
const isMemberFullyAssigned = (assignments, memberId, memberRequiredSlots) => {
  const requiredSlots = memberRequiredSlots[memberId] || assignments[memberId]?.requiredSlots || DEFAULT_REQUIRED_SLOTS;
  return assignments[memberId].assignedHours >= requiredSlots;
};

/**
 * 미충족 멤버 목록 반환
 * @param {Object} assignments - assignments 객체
 * @param {Object} memberRequiredSlots - 필요 슬롯 정보
 * @param {string} excludeOwnerId - 제외할 방장 ID
 * @returns {Array} 미충족 멤버 ID 배열
 */
const getUnsatisfiedMembers = (assignments, memberRequiredSlots, excludeOwnerId = null) => {
  return Object.keys(assignments).filter(id => {
    if (id === excludeOwnerId) return false;
    return !isMemberFullyAssigned(assignments, id, memberRequiredSlots);
  });
};

/**
 * 자동 배정 처리 (협의 생성 후)
 * @param {Object} assignments - assignments 객체
 * @param {Array} autoAssignments - 자동 배정 목록
 */
const processAutoAssignments = (assignments, autoAssignments) => {
  for (const autoAssign of autoAssignments) {
    const { memberId, dateObj, dayString, startTime, endTime, neededSlots, totalSlots } = autoAssign;

    const [startH, startM] = startTime.split(':').map(Number);
    const slotsToAssign = Math.min(neededSlots, totalSlots);
    const minutesToAssign = slotsToAssign * MINUTES_PER_SLOT;
    const startMinutes = startH * 60 + startM;
    const endMinutes = startMinutes + minutesToAssign;

    for (let currentMin = startMinutes; currentMin < endMinutes; currentMin += MINUTES_PER_SLOT) {
      const slotStart = `${Math.floor(currentMin / 60).toString().padStart(2, '0')}:${(currentMin % 60).toString().padStart(2, '0')}`;
      const slotEnd = `${Math.floor((currentMin + MINUTES_PER_SLOT) / 60).toString().padStart(2, '0')}:${((currentMin + MINUTES_PER_SLOT) % 60).toString().padStart(2, '0')}`;

      if (!assignments[memberId]) {
        assignments[memberId] = { memberId: memberId, assignedHours: 0, slots: [] };
      }

      assignments[memberId].slots.push({
        date: dateObj,
        day: dayString,
        startTime: slotStart,
        endTime: slotEnd,
        subject: AUTO_ASSIGNMENT_SUBJECT,
        user: memberId,
        status: SLOT_STATUS.CONFIRMED
      });
    }
  }
};

/**
 * 기존 슬롯을 assignments에 로드
 * @param {Array} roomTimeSlots - 방 타임슬롯 배열
 * @param {Object} assignments - assignments 객체
 * @param {string} ownerId - 방장 ID
 */
const loadExistingSlots = (roomTimeSlots, assignments, ownerId) => {
  if (!roomTimeSlots || roomTimeSlots.length === 0) return;

  roomTimeSlots.forEach(slot => {
    const slotUserId = slot.user._id ? slot.user._id.toString() : slot.user.toString();
    if (slotUserId === ownerId) return; // 방장 제외

    if (assignments[slotUserId]) {
      assignments[slotUserId].slots.push({
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        subject: slot.subject
      });
      assignments[slotUserId].assignedHours += 1;
    }
  });
};

module.exports = {
  initializeMemberAssignments,
  calculateMemberRequiredSlots,
  assignSlot,
  isMemberFullyAssigned,
  getUnsatisfiedMembers,
  processAutoAssignments,
  loadExistingSlots
};
