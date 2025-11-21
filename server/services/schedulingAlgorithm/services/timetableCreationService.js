/**
 * 타임테이블 생성 서비스
 */

const { DEFAULT_SCHEDULE_START_TIME, DEFAULT_SCHEDULE_END_TIME } = require('../constants/timeConstants');
const { generateTimeSlots, createSlotKey } = require('../utils/slotUtils');
const { getHourFromSettings } = require('../utils/timeUtils');
const { convertToOneIndexedDay } = require('../utils/dateUtils');
const { filterValidSchedules, isWeekendDay, isScheduleApplicableToDate } = require('../validators/scheduleValidator');
const { addOrUpdateSlot, addMemberAvailability, removeMemberFromSlot, createOwnerAvailableSlots, removeOwnerPersonalTimes } = require('../helpers/timetableHelper');
const { getMemberPriority } = require('../helpers/memberHelper');

/**
 * 개인 시간표 기반으로 타임테이블 생성
 * @param {Array} members - 멤버 배열
 * @param {Object} owner - 방장 객체
 * @param {Date} startDate - 시작 날짜
 * @param {number} numWeeks - 주 수
 * @param {Object} roomSettings - 방 설정
 * @param {Date} fullRangeStart - 전체 범위 시작
 * @param {Date} fullRangeEnd - 전체 범위 끝
 * @returns {Object} 타임테이블 객체
 */
const createTimetableFromPersonalSchedules = (members, owner, startDate, numWeeks, roomSettings = {}, fullRangeStart, fullRangeEnd) => {
  const timetable = {};

  const scheduleStartHour = getHourFromSettings(roomSettings.scheduleStartTime, DEFAULT_SCHEDULE_START_TIME);
  const scheduleEndHour = getHourFromSettings(roomSettings.scheduleEndTime, DEFAULT_SCHEDULE_END_TIME);

  // 스케줄링 윈도우 종료일 계산
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + (numWeeks * 7));

  // 방장 가용 시간 계산은 전체 범위 사용 (다중 주 배정 시)
  const ownerRangeStart = fullRangeStart ? new Date(fullRangeStart) : startDate;
  const ownerRangeEnd = fullRangeEnd ? new Date(fullRangeEnd) : endDate;

  const ownerId = owner._id.toString();

  console.log('\n========== 자동 배정 디버그 로그 시작 ==========');
  console.log('📅 배정 범위:', {
    start: ownerRangeStart.toISOString(),
    end: ownerRangeEnd.toISOString()
  });

  // Step 1: 방장의 가능한 시간대 수집
  const ownerAvailableSlots = createOwnerAvailableSlots(owner, ownerRangeStart, ownerRangeEnd);
  console.log('✅ Step 1 완료: ownerAvailableSlots 생성, 크기:', ownerAvailableSlots.size);

  // Step 1.5: 방장의 개인시간 제거
  removeOwnerPersonalTimes(ownerAvailableSlots, owner, ownerRangeStart, ownerRangeEnd);
  console.log('✅ Step 1.5 완료: personalTimes 제거 후, 크기:', ownerAvailableSlots.size);

  // Step 2: 조원들의 개인 시간표 추가 (방장 가능 시간대와 겹치는 것만)
  members.forEach(member => {
    const user = member.user;
    const userId = user._id.toString();
    const priority = getMemberPriority(member);

    // 개인 시간표(defaultSchedule) 처리
    if (user.defaultSchedule && Array.isArray(user.defaultSchedule)) {
      const validSchedules = filterValidSchedules(user.defaultSchedule);

      validSchedules.forEach(schedule => {
        const { dayOfWeek, startTime, endTime, specificDate } = schedule;
        const schedulePriority = schedule.priority || priority;

        // 주말 제외
        if (isWeekendDay(dayOfWeek)) return;

        if (specificDate) {
          // 특정 날짜 처리
          const targetDate = new Date(specificDate);

          if (targetDate >= startDate && targetDate < endDate) {
            const slots = generateTimeSlots(startTime, endTime);

            slots.forEach(slotTime => {
              const dateKey = targetDate.toISOString().split('T')[0];
              const key = createSlotKey(dateKey, slotTime);

              // 방장이 가능한 시간대인지 확인
              if (!ownerAvailableSlots.has(key)) return;

              if (!timetable[key]) {
                const oneIndexedDayOfWeek = convertToOneIndexedDay(targetDate.getDay());
                timetable[key] = {
                  assignedTo: null,
                  available: [],
                  date: new Date(targetDate),
                  dayOfWeek: oneIndexedDayOfWeek
                };
              }

              addMemberAvailability(timetable[key], userId, schedulePriority, false);
            });
          }
        } else {
          // 주간 반복 처리
          const currentDate = new Date(startDate);
          while (currentDate < endDate) {
            if (currentDate.getUTCDay() === dayOfWeek) {
              const slots = generateTimeSlots(startTime, endTime);

              slots.forEach(slotTime => {
                const dateKey = currentDate.toISOString().split('T')[0];
                const key = createSlotKey(dateKey, slotTime);

                // 방장이 가능한 시간대인지 확인
                if (!ownerAvailableSlots.has(key)) return;

                if (!timetable[key]) {
                  const oneIndexedDayOfWeek = convertToOneIndexedDay(dayOfWeek);
                  timetable[key] = {
                    assignedTo: null,
                    available: [],
                    date: new Date(currentDate),
                    dayOfWeek: oneIndexedDayOfWeek
                  };
                }

                addMemberAvailability(timetable[key], userId, schedulePriority, false);
              });
            }
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
          }
        }
      });
    }

    // 개인시간(personalTimes) 처리 - 이 시간대는 제외
    if (user.personalTimes && Array.isArray(user.personalTimes)) {
      user.personalTimes.forEach(personalTime => {
        if (personalTime.isRecurring !== false && personalTime.days && personalTime.days.length > 0) {
          personalTime.days.forEach(dayOfWeek => {
            const jsDay = dayOfWeek === 7 ? 0 : dayOfWeek;

            const currentDate = new Date(startDate);
            while (currentDate < endDate) {
              if (currentDate.getUTCDay() === jsDay) {
                const slots = generateTimeSlots(personalTime.startTime, personalTime.endTime);

                slots.forEach(slotTime => {
                  const dateKey = currentDate.toISOString().split('T')[0];
                  const key = createSlotKey(dateKey, slotTime);
                  removeMemberFromSlot(timetable, key, userId);
                });
              }
              currentDate.setUTCDate(currentDate.getUTCDate() + 1);
            }
          });
        }
      });
    }
  });

  const totalSlots = Object.keys(timetable).length;
  console.log('\n========== 최종 타임테이블 ==========');
  console.log('📊 전체 슬롯 개수:', totalSlots);
  console.log('========== 자동 배정 디버그 로그 끝 ==========\n');

  return timetable;
};

/**
 * 기존 roomTimeSlots 기반 타임테이블 생성 (레거시)
 * @param {Array} roomTimeSlots - 방 타임슬롯 배열
 * @param {Date} startDate - 시작 날짜
 * @param {number} numWeeks - 주 수
 * @param {Object} roomSettings - 방 설정
 * @param {Array} members - 멤버 배열
 * @returns {Object} 타임테이블 객체
 */
const createTimetable = (roomTimeSlots, startDate, numWeeks, roomSettings = {}, members = []) => {
  const timetable = {};

  const scheduleStartHour = getHourFromSettings(roomSettings.scheduleStartTime, DEFAULT_SCHEDULE_START_TIME);
  const scheduleEndHour = getHourFromSettings(roomSettings.scheduleEndTime, DEFAULT_SCHEDULE_END_TIME);

  const endDate = new Date(startDate);
  endDate.setUTCDate(startDate.getUTCDate() + (numWeeks * 7));

  // 사용자별로 슬롯 그룹화
  const userSlots = {};
  roomTimeSlots.forEach(slot => {
    let userId;
    if (slot.user && slot.user._id) {
      userId = slot.user._id.toString();
    } else if (slot.user) {
      userId = slot.user.toString();
    } else {
      return;
    }

    if (!userSlots[userId]) {
      userSlots[userId] = [];
    }
    userSlots[userId].push(slot);
  });

  // 각 사용자의 슬롯 처리
  Object.keys(userSlots).forEach(userId => {
    const member = members.find(m => (m.user._id || m.user).toString() === userId);
    if (!member) return;

    const priority = getMemberPriority(member);

    userSlots[userId].forEach(slot => {
      const date = new Date(slot.date);
      const slotDateStr = date.toISOString().split('T')[0];
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      if (slotDateStr < startDateStr || slotDateStr >= endDateStr) return;

      const dateKey = date.toISOString().split('T')[0];
      const key = createSlotKey(dateKey, slot.startTime);

      if (!timetable[key]) {
        const dayOfWeek = date.getDay();
        const oneIndexedDayOfWeek = convertToOneIndexedDay(dayOfWeek);

        timetable[key] = {
          assignedTo: null,
          available: [],
          date: new Date(date),
          dayOfWeek: oneIndexedDayOfWeek
        };
      }

      addMemberAvailability(timetable[key], userId, priority, false);
    });
  });

  return timetable;
};

module.exports = {
  createTimetableFromPersonalSchedules,
  createTimetable
};
