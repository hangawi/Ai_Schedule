/**
 * 타임테이블 생성 서비스
 */

const { DEFAULT_SCHEDULE_START_TIME, DEFAULT_SCHEDULE_END_TIME } = require('../constants/timeConstants');
const { generateTimeSlots, createSlotKey } = require('../utils/slotUtils');
const { getHourFromSettings } = require('../utils/timeUtils');
const { convertToOneIndexedDay } = require('../utils/dateUtils');
const { filterValidSchedules, isWeekendDay, isScheduleApplicableToDate } = require('../validators/scheduleValidator');
const { addOrUpdateSlot, addMemberAvailability, removeMemberFromSlot, createOwnerAvailableSlots, removeOwnerPersonalTimes, removeBlockedTimes } = require('../helpers/timetableHelper');
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

  // 타임테이블 생성 로그 (디버깅용)
  const ownerSchedule = owner.user?.defaultSchedule || owner.defaultSchedule || [];
  console.log('\n🔍 [타임테이블] 생성:', ownerRangeStart.toISOString().split('T')[0], '~', ownerRangeEnd.toISOString().split('T')[0]);

  // Step 1: 방장의 가능한 시간대 수집
  const ownerAvailableSlots = createOwnerAvailableSlots(owner, ownerRangeStart, ownerRangeEnd);

  // Step 1.5: 방장의 개인시간 제거
  removeOwnerPersonalTimes(ownerAvailableSlots, owner, ownerRangeStart, ownerRangeEnd);

  // Step 1.6: 방 설정의 금지 시간 제거 (점심시간 등)
  if (roomSettings.ownerBlockedTimes && roomSettings.ownerBlockedTimes.length > 0) {
    removeBlockedTimes(ownerAvailableSlots, roomSettings.ownerBlockedTimes, ownerRangeStart, ownerRangeEnd);
  }

  // Step 2: 조원들의 개인 시간표 추가 (방장 가능 시간대와 겹치는 것만)
  members.forEach(member => {
    const user = member.user;
    const userId = user._id.toString();
    const priority = getMemberPriority(member);

    let memberSlotsAdded = 0;
    let memberSlotsSkipped = 0;

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

          if (targetDate >= ownerRangeStart && targetDate < ownerRangeEnd) {
            const slots = generateTimeSlots(startTime, endTime);

            slots.forEach(slotTime => {
              const dateKey = targetDate.toISOString().split('T')[0];
              const key = createSlotKey(dateKey, slotTime);

              // 방장이 가능한 시간대인지 확인
              if (!ownerAvailableSlots.has(key)) {
                memberSlotsSkipped++;
                return;
              }

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
              memberSlotsAdded++;
            });
          }
        } else {
          // 주간 반복 처리
          const currentDate = new Date(ownerRangeStart);
          while (currentDate < ownerRangeEnd) {
            if (currentDate.getUTCDay() === dayOfWeek) {
              const slots = generateTimeSlots(startTime, endTime);

              slots.forEach(slotTime => {
                const dateKey = currentDate.toISOString().split('T')[0];
                const key = createSlotKey(dateKey, slotTime);

                // 방장이 가능한 시간대인지 확인
                if (!ownerAvailableSlots.has(key)) {
                  memberSlotsSkipped++;
                  return;
                }

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
                memberSlotsAdded++;
              });
            }
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
          }
        }
      });
    }

    // 선호시간(scheduleExceptions) 처리 - 챗봇으로 추가된 시간
    if (user.scheduleExceptions && Array.isArray(user.scheduleExceptions)) {
      user.scheduleExceptions.forEach(exception => {
        const { specificDate, priority: exceptionPriority } = exception;
        const schedulePriority = exceptionPriority || priority;

        if (!specificDate) return;

        const targetDate = new Date(specificDate);

        // 주말 제외
        if (isWeekendDay(targetDate.getUTCDay())) return;

        if (targetDate >= ownerRangeStart && targetDate < ownerRangeEnd) {
          // ISO datetime에서 HH:MM 추출
          const startDateTime = new Date(exception.startTime);
          const endDateTime = new Date(exception.endTime);

          const startTime = `${String(startDateTime.getHours()).padStart(2, '0')}:${String(startDateTime.getMinutes()).padStart(2, '0')}`;
          const endTime = `${String(endDateTime.getHours()).padStart(2, '0')}:${String(endDateTime.getMinutes()).padStart(2, '0')}`;

          const slots = generateTimeSlots(startTime, endTime);

          slots.forEach(slotTime => {
            const dateKey = targetDate.toISOString().split('T')[0];
            const key = createSlotKey(dateKey, slotTime);

            // 방장이 가능한 시간대인지 확인
            if (!ownerAvailableSlots.has(key)) {
              memberSlotsSkipped++;
              return;
            }

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
            memberSlotsAdded++;
          });
        }
      });
    }

    // 개인시간(personalTimes) 처리 - 이 시간대는 제외
    if (user.personalTimes && Array.isArray(user.personalTimes)) {
      user.personalTimes.forEach(personalTime => {
        // specificDate가 있는 경우 (일회성 개인 일정 - 채팅으로 추가된 경우)
        if (personalTime.specificDate) {
          const targetDate = new Date(personalTime.specificDate);
          if (targetDate >= ownerRangeStart && targetDate < ownerRangeEnd) {
            const slots = generateTimeSlots(personalTime.startTime, personalTime.endTime);
            slots.forEach(slotTime => {
              const dateKey = targetDate.toISOString().split('T')[0];
              const key = createSlotKey(dateKey, slotTime);
              removeMemberFromSlot(timetable, key, userId);
            });
          }
        }
        // 반복되는 개인 일정
        else if (personalTime.isRecurring !== false && personalTime.days && personalTime.days.length > 0) {
          personalTime.days.forEach(dayOfWeek => {
            const jsDay = dayOfWeek === 7 ? 0 : dayOfWeek;

            const currentDate = new Date(ownerRangeStart);
            while (currentDate < ownerRangeEnd) {
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

/**
 * 오늘 이후 날짜만 필터링
 * @param {Object} timetable - 전체 타임테이블
 * @returns {Object} 필터링된 타임테이블
 */
const filterFutureDates = (timetable, todayString) => {
  // Use client-provided date string for consistency, with a fallback to server's UTC date.
  const today = new Date(todayString || new Date().toISOString().slice(0, 10));
  console.log(`[filterFutureDates] Filtering based on date: ${today.toISOString()}`);

  const futureTimetable = {};

  for (const slotKey in timetable) {
    if (Object.prototype.hasOwnProperty.call(timetable, slotKey)) {
      const slotData = timetable[slotKey];
      if (slotData && slotData.date) {
        const slotDate = new Date(slotData.date);
        if (slotDate >= today) {
          futureTimetable[slotKey] = slotData;
        }
      }
    }
  }
  console.log(`[filterFutureDates] Original timetable slots: ${Object.keys(timetable).length}. Filtered to: ${Object.keys(futureTimetable).length}`);
  return futureTimetable;
};

module.exports = {
  createTimetableFromPersonalSchedules,
  createTimetable,
  filterFutureDates
};
