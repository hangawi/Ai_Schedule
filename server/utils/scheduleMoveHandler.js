/**
 * 일정 이동 처리 핸들러
 * "금요일 구몬을 토요일 2시로 옮겨" 같은 요청 처리
 */

/**
 * 일정 이동 요청 감지 및 처리
 * @param {string} message - 사용자 입력 메시지
 * @param {Array} currentSchedule - 현재 스케줄 배열
 * @param {Array} fixedSchedules - 고정 일정 배열
 * @returns {Object} - { isMoveRequest, result }
 */
function handleScheduleMoveRequest(message, currentSchedule, fixedSchedules) {
  console.log('\n🔍 일정 이동 요청 감지 중...');

  // "옮겨", "이동", "바꿔", "수정" 키워드 감지
  const moveKeywords = ['옮겨', '이동', '바꿔', '변경', '수정'];
  const hasMoveKeyword = moveKeywords.some(keyword => message.includes(keyword));

  if (!hasMoveKeyword) {
    console.log('❌ 이동 키워드 없음');
    return { isMoveRequest: false };
  }

  console.log('✅ 이동 키워드 감지:', message);

  // 요일 매핑
  const dayMap = {
    '월요일': 'MON', '월': 'MON',
    '화요일': 'TUE', '화': 'TUE',
    '수요일': 'WED', '수': 'WED',
    '목요일': 'THU', '목': 'THU',
    '금요일': 'FRI', '금': 'FRI',
    '토요일': 'SAT', '토': 'SAT',
    '일요일': 'SUN', '일': 'SUN'
  };

  // 패턴 1: "금요일 구몬을 토요일 2시로 옮겨"
  // (원본 요일) (제목) (목표 요일) (목표 시간)
  // "에 있는", "에있는", "있는" 등을 제목에서 제외
  const pattern1 = /([월화수목금토일]요?일?)\s*(?:에?\s*있?는?\s*)?([가-힣a-zA-Z0-9]+)\s*을?\s*([월화수목금토일]요?일?)\s*(?:오전|오후)?\s*(\d{1,2})시/;
  const match1 = message.match(pattern1);

  // 패턴 2: "금요일 구몬을 토요일로 옮겨" (시간 없음 - 원본 시간 유지)
  const pattern2 = /([월화수목금토일]요?일?)\s*(?:에?\s*있?는?\s*)?([가-힣a-zA-Z0-9]+)\s*을?\s*([월화수목금토일]요?일?)\s*(?:로|으로)?\s*(?:이동|옮겨|수정|변경|바꿔)/;
  const match2 = !match1 ? message.match(pattern2) : null;

  // 제목 정규화 함수 (generic term → 실제 검색용)
  const normalizeTitle = (title) => {
    const genericToSearch = {
      '일정': ['기타', '일정', '약속'],
      '기타': ['기타', '일정'],
      '약속': ['약속', '일정', '기타']
    };
    return genericToSearch[title] || [title];
  };

  if (match1) {
    const sourceDayKor = match1[1];
    let title = match1[2].trim();
    const targetDayKor = match1[3];
    const targetHour = parseInt(match1[4]);

    // 제목에서 불필요한 단어 제거 ("에", "있는", "잇는" 등)
    title = title.replace(/^(에|있는|잇는)\s*/g, '').trim();

    const sourceDay = Object.entries(dayMap).find(([k]) => sourceDayKor.includes(k))?.[1];
    const targetDay = Object.entries(dayMap).find(([k]) => targetDayKor.includes(k))?.[1];

    console.log(`📋 패턴 매칭:`);
    console.log(`  - 원본: ${sourceDayKor} (${sourceDay})`);
    console.log(`  - 제목: ${title}`);
    console.log(`  - 목표: ${targetDayKor} (${targetDay}) ${targetHour}시`);

    // 시간 정규화 (오후 처리)
    let normalizedHour = targetHour;
    if (message.includes('오후') && targetHour < 12) {
      normalizedHour = targetHour + 12;
    }
    const targetTime = `${normalizedHour.toString().padStart(2, '0')}:00`;

    // 원본 일정 찾기 (고정 일정 포함)
    console.log('\n🔍 원본 일정 찾기...');
    console.log(`  - 조건: 제목="${title}", 요일=${sourceDay}`);

    // 요일 코드 변환 (영어 <-> 한글)
    const dayKoreanMap = { 'MON': '월', 'TUE': '화', 'WED': '수', 'THU': '목', 'FRI': '금', 'SAT': '토', 'SUN': '일' };
    const sourceDayKorean = dayKoreanMap[sourceDay] || sourceDay;

    console.log(`  - 검색 요일: ${sourceDay} (한글: ${sourceDayKorean})`);

    // 제목 정규화 (generic terms 처리)
    const titleVariations = normalizeTitle(title);
    console.log(`  - 제목 검색 변형: [${titleVariations.join(', ')}]`);

    // 1. 현재 스케줄에서 찾기
    console.log(`\n  📋 현재 스케줄 검색 (${currentSchedule.length}개):`);
    let foundSchedule = currentSchedule.find(s => {
      const titleMatch = titleVariations.some(variation => s.title?.includes(variation));
      const daysArray = Array.isArray(s.days) ? s.days : [s.days];
      const dayMatch = daysArray.includes(sourceDay) || daysArray.includes(sourceDayKorean);

      console.log(`    - ${s.title} (${daysArray.join(',')}): title=${titleMatch}, day=${dayMatch}`);
      return titleMatch && dayMatch;
    });

    // 2. 고정 일정에서 찾기
    let foundFixed = null;
    if (!foundSchedule && fixedSchedules) {
      console.log(`\n  📌 고정 일정 검색 (${fixedSchedules.length}개):`);
      foundFixed = fixedSchedules.find(f => {
        const titleMatch = titleVariations.some(variation => f.title?.includes(variation));
        const daysArray = Array.isArray(f.days) ? f.days : [f.days];
        const dayMatch = daysArray.includes(sourceDay) || daysArray.includes(sourceDayKorean);

        console.log(`    - ${f.title} (${daysArray.join(',')}): title=${titleMatch}, day=${dayMatch}`);
        return titleMatch && dayMatch;
      });

      if (foundFixed) {
        console.log('✅ 고정 일정에서 발견:', foundFixed.title);
        foundSchedule = foundFixed.originalSchedule || foundFixed;
      }
    }

    if (!foundSchedule) {
      console.log(`❌ "${title}" 일정을 ${sourceDayKor}에서 찾을 수 없음`);
      return {
        isMoveRequest: true,
        result: {
          success: false,
          understood: `${sourceDayKor} ${title}을 ${targetDayKor} ${targetHour}시로 이동 시도`,
          action: 'move_failed',
          schedule: currentSchedule,
          explanation: `${sourceDayKor}에 "${title}" 일정을 찾을 수 없어요. 😅\n\n현재 ${sourceDayKor} 일정:\n${getCurrentDaySchedules(currentSchedule, sourceDay, fixedSchedules)}`
        }
      };
    }

    console.log('✅ 원본 일정 발견:', foundSchedule.title, foundSchedule.startTime);

    // 삭제 + 추가 처리
    console.log('\n🔄 일정 이동 처리 중...');

    // 1단계: 원본 삭제
    let updatedSchedule = currentSchedule.filter(s => {
      const titleMatch = s.title === foundSchedule.title;
      const timeMatch = s.startTime === foundSchedule.startTime;
      const daysArray = Array.isArray(s.days) ? s.days : [s.days];
      const dayMatch = daysArray.includes(sourceDay) || daysArray.includes(sourceDayKorean);

      const shouldDelete = titleMatch && timeMatch && dayMatch;

      if (shouldDelete) {
        console.log(`  ✂️ 삭제: ${s.title} (${daysArray.join(',')} ${s.startTime})`);
      }
      return !shouldDelete;
    });

    // 2단계: 고정 일정이면 고정 일정도 업데이트
    let updatedFixedSchedules = fixedSchedules;
    let wasFixed = false;
    if (foundFixed) {
      wasFixed = true;
      updatedFixedSchedules = fixedSchedules.filter(f =>
        !(f.id === foundFixed.id)
      );
      console.log(`  🔓 고정 일정 해제: ${foundFixed.title}`);
    }

    // 3단계: 새 일정 추가 (종료 시간은 원본과 동일한 duration 유지)
    const duration = foundSchedule.endTime
      ? calculateDuration(foundSchedule.startTime, foundSchedule.endTime)
      : 60; // 기본 1시간

    const newEndTime = addMinutesToTime(targetTime, duration);

    // 목표 요일을 한글로 변환 (고정 일정은 한글로 저장됨)
    const targetDayKorean = dayKoreanMap[targetDay] || targetDay;

    const newSchedule = {
      ...foundSchedule,
      days: [targetDayKorean], // 한글 요일 사용
      startTime: targetTime,
      endTime: newEndTime,
      type: wasFixed ? 'custom' : foundSchedule.type,
      sourceImageIndex: foundSchedule.sourceImageIndex
    };

    console.log(`  ➕ 추가: ${newSchedule.title} (${targetDayKorean} ${newSchedule.startTime}-${newSchedule.endTime})`);

    updatedSchedule.push(newSchedule);

    // 4단계: 새로 추가한 일정을 고정 일정으로 등록 (원래 고정이었다면)
    if (wasFixed) {
      const newFixed = {
        ...foundFixed,
        days: [targetDayKorean], // 한글 요일 사용
        startTime: targetTime,
        endTime: newEndTime,
        id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };
      updatedFixedSchedules.push(newFixed);
      console.log(`  🔒 새 고정 일정 등록: ${newFixed.title} (${targetDayKorean} ${targetTime})`);
    }

    return {
      isMoveRequest: true,
      result: {
        success: true,
        understood: `${sourceDayKor} ${title}을 ${targetDayKor} ${targetHour}시로 이동`,
        action: 'move',
        schedule: updatedSchedule,
        fixedSchedules: updatedFixedSchedules,
        explanation: `✅ ${title}을 ${sourceDayKor}에서 ${targetDayKorean}요일 ${targetTime}로 이동했어요! 😊`,
        movedSchedule: newSchedule
      }
    };
  }

  // 패턴 2: 시간 없이 이동 (원본 시간 유지)
  if (match2) {
    const sourceDayKor = match2[1];
    let title = match2[2].trim();
    const targetDayKor = match2[3];

    // 제목에서 불필요한 단어 제거
    title = title.replace(/^(에|있는|잇는)\s*/g, '').trim();

    const sourceDay = Object.entries(dayMap).find(([k]) => sourceDayKor.includes(k))?.[1];
    const targetDay = Object.entries(dayMap).find(([k]) => targetDayKor.includes(k))?.[1];

    console.log(`📋 패턴2 매칭 (시간 유지):`);
    console.log(`  - 원본: ${sourceDayKor} (${sourceDay})`);
    console.log(`  - 제목: ${title}`);
    console.log(`  - 목표: ${targetDayKor} (${targetDay})`);

    // 요일 코드 변환 (영어 <-> 한글)
    const dayKoreanMap = { 'MON': '월', 'TUE': '화', 'WED': '수', 'THU': '목', 'FRI': '금', 'SAT': '토', 'SUN': '일' };
    const sourceDayKorean = dayKoreanMap[sourceDay] || sourceDay;

    // 원본 일정 찾기 (고정 일정 포함)
    console.log('\n🔍 원본 일정 찾기...');
    console.log(`  - 조건: 제목="${title}", 요일=${sourceDay}`);
    console.log(`  - 검색 요일: ${sourceDay} (한글: ${sourceDayKorean})`);

    // 제목 정규화 (generic terms 처리)
    const titleVariations = normalizeTitle(title);
    console.log(`  - 제목 검색 변형: [${titleVariations.join(', ')}]`);

    // 1. 현재 스케줄에서 찾기
    console.log(`\n  📋 현재 스케줄 검색 (${currentSchedule.length}개):`);
    let foundSchedule = currentSchedule.find(s => {
      const titleMatch = titleVariations.some(variation => s.title?.includes(variation));
      const daysArray = Array.isArray(s.days) ? s.days : [s.days];
      const dayMatch = daysArray.includes(sourceDay) || daysArray.includes(sourceDayKorean);

      console.log(`    - ${s.title} (${daysArray.join(',')}): title=${titleMatch}, day=${dayMatch}`);
      return titleMatch && dayMatch;
    });

    // 2. 고정 일정에서 찾기
    let foundFixed = null;
    if (!foundSchedule && fixedSchedules) {
      console.log(`\n  📌 고정 일정 검색 (${fixedSchedules.length}개):`);
      foundFixed = fixedSchedules.find(f => {
        const titleMatch = titleVariations.some(variation => f.title?.includes(variation));
        const daysArray = Array.isArray(f.days) ? f.days : [f.days];
        const dayMatch = daysArray.includes(sourceDay) || daysArray.includes(sourceDayKorean);

        console.log(`    - ${f.title} (${daysArray.join(',')}): title=${titleMatch}, day=${dayMatch}`);
        return titleMatch && dayMatch;
      });

      if (foundFixed) {
        console.log('✅ 고정 일정에서 발견:', foundFixed.title);
        foundSchedule = foundFixed.originalSchedule || foundFixed;
      }
    }

    if (!foundSchedule) {
      console.log(`❌ "${title}" 일정을 ${sourceDayKor}에서 찾을 수 없음`);
      return {
        isMoveRequest: true,
        result: {
          success: false,
          understood: `${sourceDayKor} ${title}을 ${targetDayKor}로 이동 시도`,
          action: 'move_failed',
          schedule: currentSchedule,
          explanation: `${sourceDayKor}에 "${title}" 일정을 찾을 수 없어요. 😅\n\n현재 ${sourceDayKor} 일정:\n${getCurrentDaySchedules(currentSchedule, sourceDay, fixedSchedules)}`
        }
      };
    }

    console.log('✅ 원본 일정 발견:', foundSchedule.title, foundSchedule.startTime);

    // 원본 시간 유지
    const targetTime = foundSchedule.startTime;
    const duration = foundSchedule.endTime
      ? calculateDuration(foundSchedule.startTime, foundSchedule.endTime)
      : 60;

    const newEndTime = addMinutesToTime(targetTime, duration);

    console.log(`  - 원본 시간 유지: ${targetTime}-${newEndTime}`);

    // 삭제 + 추가 처리
    console.log('\n🔄 일정 이동 처리 중...');

    // 1단계: 원본 삭제
    let updatedSchedule = currentSchedule.filter(s => {
      const titleMatch = s.title === foundSchedule.title;
      const timeMatch = s.startTime === foundSchedule.startTime;
      const daysArray = Array.isArray(s.days) ? s.days : [s.days];
      const dayMatch = daysArray.includes(sourceDay) || daysArray.includes(sourceDayKorean);

      const shouldDelete = titleMatch && timeMatch && dayMatch;

      if (shouldDelete) {
        console.log(`  ✂️ 삭제: ${s.title} (${daysArray.join(',')} ${s.startTime})`);
      }
      return !shouldDelete;
    });

    // 2단계: 고정 일정이면 고정 일정도 업데이트
    let updatedFixedSchedules = fixedSchedules;
    let wasFixed = false;
    if (foundFixed) {
      wasFixed = true;
      updatedFixedSchedules = fixedSchedules.filter(f =>
        !(f.id === foundFixed.id)
      );
      console.log(`  🔓 고정 일정 해제: ${foundFixed.title}`);
    }

    // 3단계: 새 일정 추가 (원본 시간 유지)
    const targetDayKorean = dayKoreanMap[targetDay] || targetDay;

    const newSchedule = {
      ...foundSchedule,
      days: [targetDayKorean],
      startTime: targetTime,
      endTime: newEndTime,
      type: wasFixed ? 'custom' : foundSchedule.type,
      sourceImageIndex: foundSchedule.sourceImageIndex
    };

    console.log(`  ➕ 추가: ${newSchedule.title} (${targetDayKorean} ${newSchedule.startTime}-${newSchedule.endTime})`);

    updatedSchedule.push(newSchedule);

    // 4단계: 새로 추가한 일정을 고정 일정으로 등록 (원래 고정이었다면)
    if (wasFixed) {
      const newFixed = {
        ...foundFixed,
        days: [targetDayKorean],
        startTime: targetTime,
        endTime: newEndTime,
        id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };
      updatedFixedSchedules.push(newFixed);
      console.log(`  🔒 새 고정 일정 등록: ${newFixed.title} (${targetDayKorean} ${targetTime})`);
    }

    return {
      isMoveRequest: true,
      result: {
        success: true,
        understood: `${sourceDayKor} ${title}을 ${targetDayKor}로 이동 (시간 유지)`,
        action: 'move',
        schedule: updatedSchedule,
        fixedSchedules: updatedFixedSchedules,
        explanation: `✅ ${title}을 ${sourceDayKor}에서 ${targetDayKorean}요일 ${targetTime}로 이동했어요! 😊`,
        movedSchedule: newSchedule
      }
    };
  }

  console.log('❌ 이동 패턴 매칭 실패');
  return { isMoveRequest: false };
}

/**
 * 특정 요일의 현재 스케줄 목록 가져오기
 */
function getCurrentDaySchedules(currentSchedule, dayCode, fixedSchedules) {
  const daySchedules = currentSchedule.filter(s =>
    Array.isArray(s.days) ? s.days.includes(dayCode) : s.days === dayCode
  );

  const fixedForDay = fixedSchedules?.filter(f =>
    Array.isArray(f.days) ? f.days.includes(dayCode) : f.days === dayCode
  ) || [];

  const all = [...daySchedules, ...fixedForDay];

  if (all.length === 0) {
    return '(일정 없음)';
  }

  return all
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map(s => `• ${s.title} (${s.startTime}-${s.endTime})`)
    .join('\n');
}

/**
 * 시간 간격 계산 (분 단위)
 */
function calculateDuration(startTime, endTime) {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  return (endHour * 60 + endMin) - (startHour * 60 + startMin);
}

/**
 * 시간에 분 추가
 */
function addMinutesToTime(timeStr, minutes) {
  const [hour, min] = timeStr.split(':').map(Number);
  const totalMinutes = hour * 60 + min + minutes;
  const newHour = Math.floor(totalMinutes / 60) % 24;
  const newMin = totalMinutes % 60;
  return `${newHour.toString().padStart(2, '0')}:${newMin.toString().padStart(2, '0')}`;
}

module.exports = {
  handleScheduleMoveRequest
};
