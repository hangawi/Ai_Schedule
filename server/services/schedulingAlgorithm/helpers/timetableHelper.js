/**
 * 타임테이블 관련 헬퍼 함수
 */

const { generateTimeSlots, createSlotKey, extractDateFromSlotKey } = require('../utils/slotUtils');
const { formatDateToString } = require('../utils/dateUtils');
const { isWeekendDay, isScheduleApplicableToDate, filterValidSchedules } = require('../validators/scheduleValidator');

/**
 * 타임테이블에 슬롯 추가 또는 업데이트
 * @param {Object} timetable - 타임테이블 객체
 * @param {string} key - 슬롯 키
 * @param {Object} slotData - 슬롯 데이터
 */
const addOrUpdateSlot = (timetable, key, slotData) => {
  if (!timetable[key]) {
    timetable[key] = {
      assignedTo: null,
      available: [],
      ...slotData
    };
  }
  return timetable[key];
};

/**
 * 슬롯에 멤버 availability 추가
 * @param {Object} slot - 슬롯 객체
 * @param {string} memberId - 멤버 ID
 * @param {number} priority - 우선순위
 * @param {boolean} isOwner - 방장 여부
 */
const addMemberAvailability = (slot, memberId, priority, isOwner = false) => {
  const existingAvailability = slot.available.find(a => a.memberId === memberId);
  if (!existingAvailability) {
    slot.available.push({
      memberId,
      priority,
      isOwner
    });
  }
};

/**
 * 슬롯에서 멤버 제거
 * @param {Object} timetable - 타임테이블 객체
 * @param {string} key - 슬롯 키
 * @param {string} memberId - 제거할 멤버 ID
 */
const removeMemberFromSlot = (timetable, key, memberId) => {
  if (timetable[key]) {
    timetable[key].available = timetable[key].available.filter(a => a.memberId !== memberId);
    // 아무도 사용할 수 없는 시간대가 되면 삭제
    if (timetable[key].available.length === 0) {
      delete timetable[key];
    }
  }
};

/**
 * 방장의 가용 슬롯 Set 생성
 * @param {Object} owner - 방장 객체
 * @param {Date} rangeStart - 범위 시작
 * @param {Date} rangeEnd - 범위 끝
 * @returns {Set} 가용 슬롯 키 Set
 */
const createOwnerAvailableSlots = (owner, rangeStart, rangeEnd) => {
  const ownerAvailableSlots = new Set();

  // owner.user.defaultSchedule 또는 owner.defaultSchedule 지원
  const ownerSchedule = owner.user?.defaultSchedule || owner.defaultSchedule;

  if (!ownerSchedule || !Array.isArray(ownerSchedule)) {
    console.log('⚠️ 방장 스케줄이 없습니다:', { hasUser: !!owner.user, hasDefaultSchedule: !!owner.defaultSchedule });
    return ownerAvailableSlots;
  }

  const validSchedules = filterValidSchedules(ownerSchedule);

  validSchedules.forEach(schedule => {
    const { dayOfWeek, startTime, endTime, specificDate } = schedule;

    // 주말 제외
    if (isWeekendDay(dayOfWeek)) return;

    if (specificDate) {
      // specificDate가 있으면 그 날짜 하나에만 적용
      const specDate = new Date(specificDate);

      if (specDate >= rangeStart && specDate < rangeEnd) {
        const slots = generateTimeSlots(startTime, endTime);
        const dateKey = specDate.toISOString().split('T')[0];

        slots.forEach(slotTime => {
          ownerAvailableSlots.add(createSlotKey(dateKey, slotTime));
        });
      }
    } else {
      // 반복 요일 처리
      const currentDate = new Date(rangeStart);
      while (currentDate < rangeEnd) {
        if (currentDate.getUTCDay() === dayOfWeek) {
          const slots = generateTimeSlots(startTime, endTime);
          const dateKey = currentDate.toISOString().split('T')[0];

          slots.forEach(slotTime => {
            ownerAvailableSlots.add(createSlotKey(dateKey, slotTime));
          });
        }
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }
    }
  });

  return ownerAvailableSlots;
};

/**
 * 방장의 개인시간(personalTimes)으로 슬롯 제거
 * @param {Set} ownerAvailableSlots - 방장 가용 슬롯 Set
 * @param {Object} owner - 방장 객체
 * @param {Date} rangeStart - 범위 시작
 * @param {Date} rangeEnd - 범위 끝
 */
const removeOwnerPersonalTimes = (ownerAvailableSlots, owner, rangeStart, rangeEnd) => {
  // owner.user.personalTimes 또는 owner.personalTimes 지원
  const ownerPersonalTimes = owner.user?.personalTimes || owner.personalTimes;

  if (!ownerPersonalTimes || !Array.isArray(ownerPersonalTimes)) return;

  ownerPersonalTimes.forEach(personalTime => {
    // 반복 개인 시간
    if (personalTime.isRecurring !== false && personalTime.days && personalTime.days.length > 0) {
      personalTime.days.forEach(dayOfWeek => {
        const jsDay = dayOfWeek === 7 ? 0 : dayOfWeek;

        const currentDate = new Date(rangeStart);
        while (currentDate < rangeEnd) {
          if (currentDate.getUTCDay() === jsDay) {
            const slots = generateTimeSlots(personalTime.startTime, personalTime.endTime);
            const dateKey = currentDate.toISOString().split('T')[0];

            slots.forEach(slotTime => {
              ownerAvailableSlots.delete(createSlotKey(dateKey, slotTime));
            });
          }
          currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }
      });
    }

    // 특정 날짜 개인 시간
    if (personalTime.specificDate) {
      const personalDate = new Date(personalTime.specificDate);

      if (personalDate >= rangeStart && personalDate < rangeEnd) {
        const slots = generateTimeSlots(personalTime.startTime, personalTime.endTime);
        const dateKey = personalDate.toISOString().split('T')[0];

        slots.forEach(slotTime => {
          ownerAvailableSlots.delete(createSlotKey(dateKey, slotTime));
        });
      }
    }
  });
};

/**
 * 타임테이블에서 특정 날짜의 슬롯 필터링
 * @param {Object} timetable - 타임테이블 객체
 * @param {string} dateStr - YYYY-MM-DD 형식 날짜
 * @returns {Array} 해당 날짜의 슬롯 키 배열
 */
const getSlotsByDate = (timetable, dateStr) => {
  return Object.keys(timetable).filter(key => {
    return extractDateFromSlotKey(key) === dateStr;
  });
};

/**
 * 타임테이블 통계 계산
 * @param {Object} timetable - 타임테이블 객체
 * @returns {Object} 통계 정보
 */
const calculateTimetableStats = (timetable) => {
  const totalSlots = Object.keys(timetable).length;
  const assignedSlots = Object.values(timetable).filter(slot => slot.assignedTo).length;
  const availableSlots = totalSlots - assignedSlots;

  return {
    totalSlots,
    assignedSlots,
    availableSlots
  };
};

module.exports = {
  addOrUpdateSlot,
  addMemberAvailability,
  removeMemberFromSlot,
  createOwnerAvailableSlots,
  removeOwnerPersonalTimes,
  getSlotsByDate,
  calculateTimetableStats
};
