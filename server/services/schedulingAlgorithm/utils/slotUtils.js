/**
 * 슬롯 관련 유틸리티 함수
 */

const { MINUTES_PER_SLOT } = require('../constants/timeConstants');
const { DAY_MAP } = require('../constants/schedulingConstants');
const { timeToMinutes, minutesToTime } = require('./timeUtils');

/**
 * 시간 범위에서 30분 단위 슬롯 배열 생성
 * @param {string} startTime - 시작 시간 (HH:MM)
 * @param {string} endTime - 종료 시간 (HH:MM)
 * @returns {string[]} 슬롯 시간 배열
 */
const generateTimeSlots = (startTime, endTime) => {
  const slots = [];
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  let currentTime = startHour * 60 + startMin;
  const endTimeInMinutes = endHour * 60 + endMin;

  while (currentTime < endTimeInMinutes) {
    const hour = Math.floor(currentTime / 60);
    const minute = currentTime % 60;
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    slots.push(timeStr);
    currentTime += MINUTES_PER_SLOT;
  }

  return slots;
};

/**
 * 슬롯 키에서 날짜 추출
 * @param {string} slotKey - 슬롯 키 (YYYY-MM-DD-HH:MM)
 * @returns {string} 날짜 (YYYY-MM-DD)
 */
const extractDateFromSlotKey = (slotKey) => {
  const parts = slotKey.split('-');
  return `${parts[0]}-${parts[1]}-${parts[2]}`;
};

/**
 * 슬롯 키에서 시간 추출
 * @param {string} slotKey - 슬롯 키 (YYYY-MM-DD-HH:MM)
 * @returns {string} 시간 (HH:MM)
 */
const extractTimeFromSlotKey = (slotKey) => {
  const lastDashIndex = slotKey.lastIndexOf('-');
  return slotKey.substring(lastDashIndex + 1);
};

/**
 * 슬롯 키 생성
 * @param {string} dateKey - 날짜 (YYYY-MM-DD)
 * @param {string} time - 시간 (HH:MM)
 * @returns {string} 슬롯 키
 */
const createSlotKey = (dateKey, time) => {
  return `${dateKey}-${time}`;
};

/**
 * 이전 슬롯 키 계산 (30분 전)
 * @param {string} key - 현재 슬롯 키
 * @returns {string|null} 이전 슬롯 키 또는 null
 */
const getPreviousSlotKey = (key) => {
  const lastDashIndex = key.lastIndexOf('-');
  if (lastDashIndex === -1) return null;

  const dateKey = key.substring(0, lastDashIndex);
  const time = key.substring(lastDashIndex + 1);
  const [h, m] = time.split(':').map(Number);

  let prevH = h;
  let prevM = m - MINUTES_PER_SLOT;

  if (prevM < 0) {
    prevM = 30;
    prevH = h - 1;
  }

  if (prevH < 0) return null;

  const prevTime = `${String(prevH).padStart(2, '0')}:${String(prevM).padStart(2, '0')}`;
  return `${dateKey}-${prevTime}`;
};

/**
 * 다음 슬롯 키 계산 (30분 후)
 * @param {string} key - 현재 슬롯 키
 * @returns {string} 다음 슬롯 키
 */
const getNextSlotKey = (key) => {
  const lastDashIndex = key.lastIndexOf('-');
  if (lastDashIndex === -1) return null;

  const dateKey = key.substring(0, lastDashIndex);
  const time = key.substring(lastDashIndex + 1);
  const [h, m] = time.split(':').map(Number);

  let nextH = h;
  let nextM = m + MINUTES_PER_SLOT;

  if (nextM >= 60) {
    nextM = 0;
    nextH = h + 1;
  }

  const nextTime = `${String(nextH).padStart(2, '0')}:${String(nextM).padStart(2, '0')}`;
  return `${dateKey}-${nextTime}`;
};

/**
 * 두 슬롯이 연속인지 확인 (30분 차이)
 * @param {string} key1 - 첫 번째 슬롯 키
 * @param {string} key2 - 두 번째 슬롯 키
 * @returns {boolean}
 */
const areConsecutiveSlots = (key1, key2) => {
  const date1 = extractDateFromSlotKey(key1);
  const date2 = extractDateFromSlotKey(key2);

  if (date1 !== date2) return false;

  const time1 = extractTimeFromSlotKey(key1);
  const time2 = extractTimeFromSlotKey(key2);

  const [h1, m1] = time1.split(':').map(Number);
  const [h2, m2] = time2.split(':').map(Number);

  const minutes1 = h1 * 60 + m1;
  const minutes2 = h2 * 60 + m2;

  return minutes2 - minutes1 === MINUTES_PER_SLOT;
};

/**
 * 요일 숫자를 영문 요일명으로 변환
 * @param {number} dayOfWeek - 요일 숫자
 * @returns {string} 영문 요일명
 */
const getDayString = (dayOfWeek) => {
  return DAY_MAP[dayOfWeek] || '';
};

/**
 * 슬롯 데이터 객체 생성
 * @param {Object} params - 슬롯 파라미터
 * @returns {Object} 슬롯 데이터 객체
 */
const createSlotData = ({ date, dayString, startTime, endTime, memberId, subject = '자동 배정', status = 'confirmed' }) => {
  return {
    date,
    day: dayString,
    startTime,
    endTime,
    subject,
    user: memberId,
    status
  };
};

/**
 * 슬롯의 종료 시간 계산
 * @param {string} startTime - 시작 시간
 * @returns {string} 종료 시간 (30분 후)
 */
const calculateSlotEndTime = (startTime) => {
  const [h, m] = startTime.split(':').map(Number);
  let endMinute = m + MINUTES_PER_SLOT;
  let endHour = h;

  if (endMinute >= 60) {
    endMinute -= 60;
    endHour += 1;
  }

  return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
};

module.exports = {
  generateTimeSlots,
  extractDateFromSlotKey,
  extractTimeFromSlotKey,
  createSlotKey,
  getPreviousSlotKey,
  getNextSlotKey,
  areConsecutiveSlots,
  getDayString,
  createSlotData,
  calculateSlotEndTime
};
