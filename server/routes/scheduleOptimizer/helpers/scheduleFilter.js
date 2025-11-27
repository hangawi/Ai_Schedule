const { parseDayName } = require('../utils/timeParser');

/**
 * 코드 기반 스케줄 필터링 (AI 의존하지 않음)
 */
function filterScheduleByCode(message, currentSchedule) {
  // 1. "수요일 공연반까지만" 패턴
  const untilMatch = message.match(/(월|화|수|목|금|토|일|월요일|화요일|수요일|목요일|금요일|토요일|일요일)\s*([가-힣a-zA-Z0-9]+)까지만/);
  if (untilMatch && untilMatch[2].length < 10) {
    return handleUntilPattern(untilMatch, currentSchedule);
  }

  // 2. "금요일 6시까지만" 패턴
  const timeUntilMatch = message.match(/(월|화|수|목|금|토|일|월요일|화요일|수요일|목요일|금요일|토요일|일요일)\s*(\d{1,2})시까지만/);
  if (timeUntilMatch) {
    return handleTimeUntilPattern(timeUntilMatch, currentSchedule);
  }

  // 3. "수요일 주니어B만 남기고 삭제" 패턴
  const keepOnlyMatch = message.match(/(월|화|수|목|금|토|일|월요일|화요일|수요일|목요일|금요일|토요일|일요일)\s*([가-힣a-zA-Z0-9\s]+)만/);
  if (keepOnlyMatch) {
    return handleKeepOnlyPattern(keepOnlyMatch, currentSchedule);
  }

  // 4. "금요일 공연반 삭제" 패턴
  const dayDeleteMatch = message.match(/(월|화|수|목|금|토|일|월요일|화요일|수요일|목요일|금요일|토요일|일요일)\s+([가-힣a-zA-Z0-9\s]+?)\s*(과목\s*)?(삭제|빼|없애|제거)/);
  if (dayDeleteMatch) {
    return handleDayDeletePattern(dayDeleteMatch, currentSchedule);
  }

  // 5. "금요일 6시 공연반 삭제" 패턴
  const dayTimeDeleteMatch = message.match(/(월|화|수|목|금|토|일|월요일|화요일|수요일|목요일|금요일|토요일|일요일)\s+(\d{1,2})시\s*(?:에\s*)?(?:있는\s*)?([가-힣a-zA-Z0-9\s]+?)\s*(과목\s*)?(삭제|빼|없애|제거)/);
  if (dayTimeDeleteMatch) {
    return handleDayTimeDeletePattern(dayTimeDeleteMatch, currentSchedule);
  }

  // 6. "KPOP 삭제" 패턴
  const keywordDeleteMatch = message.match(/([가-힣a-zA-Z0-9]+)\s*(삭제|빼|없애|제거)/);
  if (keywordDeleteMatch && !message.includes('만')) {
    return handleKeywordDeletePattern(keywordDeleteMatch, currentSchedule);
  }

  // 7. "6시 겹치는 삭제" 패턴
  const timeDeleteMatch = message.match(/(\d{1,2})시\s*(겹치는|겹치|중복)\s*(삭제|빼|없애|제거)/);
  if (timeDeleteMatch) {
    return handleTimeDeletePattern(timeDeleteMatch, currentSchedule);
  }

  return { filtered: false };
}

/**
 * "까지만" 패턴 처리
 */
function handleUntilPattern(match, currentSchedule) {
  const dayCode = parseDayName(match[1]);
  const untilTitle = match[2].trim();

  const daySchedules = currentSchedule
    .filter(item => item.days?.includes(dayCode))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const untilIndex = daySchedules.findIndex(item =>
    item.title?.toLowerCase().includes(untilTitle.toLowerCase())
  );

  if (untilIndex === -1) {
    return { filtered: false };
  }

  const untilTime = daySchedules[untilIndex].endTime;

  const filtered = currentSchedule.filter(item => {
    const isTargetDay = item.days?.includes(dayCode);
    if (!isTargetDay) return true;
    return item.startTime <= untilTime;
  });

  return {
    filtered: true,
    schedule: filtered,
    understood: `${match[1]} ${untilTitle}까지만 하고 나머지 삭제`,
    explanation: `${match[1]} ${untilTitle}까지만 남기고 ${currentSchedule.length - filtered.length}개를 삭제했어요! 😊`
  };
}

/**
 * "시간까지만" 패턴 처리
 */
function handleTimeUntilPattern(match, currentSchedule) {
  const dayCode = parseDayName(match[1]);
  const untilHour = parseInt(match[2]);

  const filtered = currentSchedule.filter(item => {
    const isTargetDay = item.days?.includes(dayCode);
    if (!isTargetDay) return true;

    const startHour = parseInt(item.startTime.split(':')[0]);
    return startHour < untilHour;
  });

  return {
    filtered: true,
    schedule: filtered,
    understood: `${match[1]} ${untilHour}시까지만 하고 나머지 삭제`,
    explanation: `${match[1]} ${untilHour}시 이후 수업 ${currentSchedule.length - filtered.length}개를 삭제했어요! 😊`
  };
}

/**
 * "만 남기기" 패턴 처리
 */
function handleKeepOnlyPattern(match, currentSchedule) {
  const dayCode = parseDayName(match[1]);
  const keepTitle = match[2].trim();

  const filtered = currentSchedule.filter(item => {
    const matchesDay = item.days?.includes(dayCode);
    const matchesTitle = item.title?.toLowerCase().includes(keepTitle.toLowerCase());
    return matchesDay && matchesTitle;
  });

  return {
    filtered: true,
    schedule: filtered,
    understood: `${match[1]} ${keepTitle}만 남기기`,
    explanation: `${match[1]} ${keepTitle}만 남기고 ${currentSchedule.length - filtered.length}개를 삭제했어요! 😊`
  };
}

/**
 * "요일 키워드 삭제" 패턴 처리
 */
function handleDayDeletePattern(match, currentSchedule) {
  const dayCode = parseDayName(match[1]);
  const keyword = match[2].trim();

  const filtered = currentSchedule.filter(item => {
    const matchesDay = item.days?.includes(dayCode);
    const matchesTitle = item.title?.toLowerCase().includes(keyword.toLowerCase());
    return !(matchesDay && matchesTitle);
  });

  if (filtered.length === currentSchedule.length) {
    return {
      filtered: true,
      schedule: currentSchedule,
      understood: `${match[1]} ${keyword} 삭제 시도`,
      explanation: `${match[1]}에 "${keyword}" 수업을 찾을 수 없어요. 😊\n\n현재 ${dayCode} 수업:\n${currentSchedule.filter(s => s.days?.includes(dayCode)).map(s => `- ${s.title}`).join('\n')}`
    };
  }

  return {
    filtered: true,
    schedule: filtered,
    understood: `${match[1]} ${keyword} 삭제`,
    explanation: `${match[1]} ${keyword} 수업 ${currentSchedule.length - filtered.length}개를 삭제했어요! 😊`
  };
}

/**
 * "요일 시간 키워드 삭제" 패턴 처리
 */
function handleDayTimeDeletePattern(match, currentSchedule) {
  const dayCode = parseDayName(match[1]);
  const targetHour = parseInt(match[2]);
  const keyword = match[3].trim();

  const filtered = currentSchedule.filter(item => {
    const matchesDay = item.days?.includes(dayCode);
    const startHour = parseInt(item.startTime?.split(':')[0] || '0');
    const matchesTime = startHour === targetHour;
    const matchesTitle = item.title?.toLowerCase().includes(keyword.toLowerCase());
    return !(matchesDay && matchesTime && matchesTitle);
  });

  if (filtered.length === currentSchedule.length) {
    return {
      filtered: true,
      schedule: currentSchedule,
      understood: `${match[1]} ${targetHour}시 ${keyword} 삭제 시도`,
      explanation: `${match[1]} ${targetHour}시에 "${keyword}" 수업을 찾을 수 없어요. 😊`
    };
  }

  return {
    filtered: true,
    schedule: filtered,
    understood: `${match[1]} ${targetHour}시 ${keyword} 삭제`,
    explanation: `${match[1]} ${targetHour}시 ${keyword} 수업을 삭제했어요! 😊`
  };
}

/**
 * "키워드 삭제" 패턴 처리
 */
function handleKeywordDeletePattern(match, currentSchedule) {
  const keyword = match[1];

  const filtered = currentSchedule.filter(item => {
    return !item.title?.toLowerCase().includes(keyword.toLowerCase());
  });

  return {
    filtered: true,
    schedule: filtered,
    understood: `${keyword} 삭제`,
    explanation: `${keyword} 관련 수업을 모두 삭제했어요! 😊`
  };
}

/**
 * "시간 겹치는 삭제" 패턴 처리
 */
function handleTimeDeletePattern(match, currentSchedule) {
  const targetHour = parseInt(match[1]);

  const filtered = currentSchedule.filter(item => {
    const startHour = parseInt(item.startTime?.split(':')[0] || '0');
    const endHour = parseInt(item.endTime?.split(':')[0] || '0');
    const overlaps = startHour <= targetHour && targetHour < endHour;
    return !overlaps;
  });

  return {
    filtered: true,
    schedule: filtered,
    understood: `${targetHour}시 겹치는 수업 삭제`,
    explanation: `${targetHour}시에 겹치는 수업들을 삭제했어요! 😊`
  };
}

module.exports = {
  filterScheduleByCode
};
