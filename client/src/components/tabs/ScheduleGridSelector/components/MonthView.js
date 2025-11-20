import React from 'react';

/**
 * 월간 뷰 컴포넌트
 * - 달력 형태로 일정 표시
 * - 각 날짜에 선호 일정, 개인 일정 태그 표시
 * - 날짜 클릭 시 해당 날짜의 세부 시간표 모달 오픈
 *
 * @param {Object} props
 * @param {Date} props.currentDate - 현재 선택된 날짜
 * @param {Array} props.allPersonalTimes - 개인 시간 배열
 * @param {Array} props.schedule - 기본 일정 (선호 시간)
 * @param {Array} props.exceptions - 특정 날짜 예외 일정
 * @param {Function} props.onDateClick - 날짜 클릭 핸들러
 */
const MonthView = ({
  currentDate,
  allPersonalTimes,
  schedule,
  exceptions,
  onDateClick
}) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // 월의 첫날과 마지막날
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // 월의 첫 주 일요일부터 시작 (헤더와 맞춤)
  const startDate = new Date(firstDay);
  const startDayOfWeek = firstDay.getDay();
  startDate.setDate(startDate.getDate() - startDayOfWeek); // 일요일부터 시작

  // 월의 마지막 주 토요일까지
  const endDate = new Date(lastDay);
  const endDayOfWeek = lastDay.getDay();
  endDate.setDate(endDate.getDate() + (6 - endDayOfWeek)); // 토요일까지

  const weeks = [];
  let currentWeek = [];

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const date = new Date(d);
    const dayOfWeek = date.getDay();

    // 일~토 모두 표시
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    // 해당 날짜의 일정 확인
    const hasSchedule = schedule.some(s => s.dayOfWeek === dayOfWeek);
    const hasException = exceptions.some(e => e.specificDate === dateStr);
    const hasPersonal = allPersonalTimes.some(p => {
      const personalDays = p.days || [];

      // ⭐ specificDate가 있으면 정확한 날짜로 비교
      if (p.specificDate && personalDays.length === 0) {
        const scheduleDate = new Date(p.specificDate);
        const scheduleDateStr = `${scheduleDate.getFullYear()}-${String(scheduleDate.getMonth() + 1).padStart(2, '0')}-${String(scheduleDate.getDate()).padStart(2, '0')}`;
        return dateStr === scheduleDateStr;
      }

      // 반복 일정인 경우 요일로 비교
      const convertedDays = personalDays.map(day => day === 7 ? 0 : day);
      const isRecurring = p.isRecurring !== false;
      return isRecurring && convertedDays.includes(dayOfWeek);
    });

    currentWeek.push({
      date,
      dayOfWeek,
      isCurrentMonth: date.getMonth() === month,
      hasSchedule,
      hasException,
      hasPersonal,
      dateStr
    });

    if (dayOfWeek === 6 && currentWeek.length === 7) { // 토요일이면 현재 주 완료
      weeks.push([...currentWeek]);
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  const handleDateClick = (dayData) => {
    // 날짜 정보만 저장 (blocks는 모달 내에서 실시간으로 생성)
    onDateClick(dayData);
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white shadow-inner" style={{ minHeight: '500px' }}>
      {/* 헤더: 요일 */}
      <div className="grid grid-cols-7 bg-gray-100 border-b border-gray-200">
        {['일', '월', '화', '수', '목', '금', '토'].map(day => (
          <div key={day} className="p-4 text-center font-semibold text-gray-700 border-r border-gray-200 last:border-r-0">
            {day}
          </div>
        ))}
      </div>

      {/* 본문: 주별 날짜 그리드 */}
      {weeks.map((week, weekIndex) => (
        <div key={weekIndex} className="grid grid-cols-7 border-b border-gray-200 last:border-b-0">
          {week.map((day, dayIndex) => (
            <div
              key={dayIndex}
              onClick={() => handleDateClick(day)}
              className={`p-3 min-h-[120px] border-r border-gray-200 last:border-r-0 ${
                day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'
              } hover:bg-blue-50 transition-colors cursor-pointer`}
              title={`${day.date.getMonth() + 1}/${day.date.getDate()} - 클릭하여 세부 시간표 보기`}
            >
              {/* 날짜 숫자 */}
              <div className={`text-base font-medium mb-2 ${
                day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
              }`}>
                {day.date.getDate()}
              </div>

              {/* 일정 태그들 */}
              <div className="space-y-1">
                {day.hasSchedule && (
                  <div className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded truncate">
                    선호 일정
                  </div>
                )}
                {day.hasException && (
                  <div className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded truncate">
                    선호 일정
                  </div>
                )}
                {day.hasPersonal && (
                  <div className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded truncate">
                    개인 일정
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default MonthView;
