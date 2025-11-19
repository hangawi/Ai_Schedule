// 10분 단위 시간 슬롯 생성
export const generateTimeSlots = (startHour = 0, endHour = 24) => {
  const slots = [];
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += 10) {
      const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      slots.push(time);
    }
  }
  return slots;
};

// 다음 시간 슬롯 계산
export const getNextTimeSlot = (timeString) => {
  const [hour, minute] = timeString.split(':').map(Number);
  const nextMinute = minute + 10;
  const nextHour = nextMinute >= 60 ? hour + 1 : hour;
  const finalMinute = nextMinute >= 60 ? 0 : nextMinute;
  return `${String(nextHour).padStart(2, '0')}:${String(finalMinute).padStart(2, '0')}`;
};

// 시간 차이 계산 (분 단위)
export const getTimeDifferenceInMinutes = (startTime, endTime) => {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  return (endHour * 60 + endMin) - (startHour * 60 + startMin);
};

// 시간을 분으로 변환
export const timeToMinutes = (timeString) => {
  const [hour, minute] = timeString.split(':').map(Number);
  return hour * 60 + minute;
};

// 종료 시간 계산 (10분 추가)
export const calculateEndTime = (startTime) => {
  const [h, m] = startTime.split(':').map(Number);
  const totalMinutes = h * 60 + m + 10;
  const endHour = Math.floor(totalMinutes / 60);
  const endMinute = totalMinutes % 60;
  return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
};
