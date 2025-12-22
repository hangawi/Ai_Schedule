/**
 * ===================================================================================================
 * scheduleMoveHandler.js - 특정 일정의 시간/요일 이동 요청 처리 헬퍼
 * ===================================================================================================
 *
 * 📍 위치: 백엔드 > server/utils > scheduleMoveHandler.js
 * 🎯 주요 기능:
 *    - 사용자의 자연어 일정 이동 요청(예: "금요일 수업을 토요일로 옮겨")을 감지하고 파싱.
 *    - 정규식을 활용하여 원본 일정의 요일, 시간, 제목 및 목표 시점을 정확히 추출.
 *    - 현재 시간표 및 고정 일정 목록을 검색하여 이동 대상이 되는 원본 일정 객체 식별.
 *    - 원본 일정을 삭제하고 새로운 시점에 일정을 재배치하며, 일정의 지속 시간(Duration) 및 메타데이터 유지.
 *    - 고정 일정(Fixed) 상태의 전파 및 업데이트를 통해 데이터 일관성 관리.
 *    - 이동 실패 시(일정 미발견 등) 현재 스케줄 요약 정보와 함께 사용자 가이드 메시지 제공.
 *
 * 🔗 연결된 파일:
 *    - server/routes/scheduleOptimizer.js - 채팅 요청 중 이동 관련 의도 발견 시 이 헬퍼 호출.
 *    - server/utils/scheduleAutoOptimizer.js - 이동 완료 후 전체 시간표 재최적화를 위해 연동.
 *
 * ✏️ 수정 가이드:
 *    - 자연어 이동 패턴(예: "~로 밀어줘" 등)을 추가하려면 handleScheduleMoveRequest 내의 정규식 패턴 보강.
 *    - 시간 파싱 정확도를 높이려면 extractTimeFromInput(fixedScheduleHandler.js와 유사 로직) 검토.
 *
 * 📝 참고사항:
 *    - "있는" 또는 "잇는"과 같은 흔한 오타에 대해서도 유연하게 대응할 수 있도록 정규식이 설계됨.
 *
 * ===================================================================================================
 */

/**
 * handleScheduleMoveRequest
 * @description 사용자 메시지에서 일정 이동 의도를 추출하고, 가능하다면 실제 데이터 변경을 수행합니다.
 * @param {string} message - 사용자 입력 메시지.
 * @param {Array} currentSchedule - 현재 적용된 전체 일정 배열.
 * @param {Array} fixedSchedules - 현재 등록된 고정 일정 배열.
 * @returns {Object} 이동 수행 여부 및 결과를 담은 객체.
 */
function handleScheduleMoveRequest(message, currentSchedule, fixedSchedules) {

  // "옮겨", "이동", "바꿔", "수정" 키워드 감지
  const moveKeywords = ['옮겨', '이동', '바꿔', '변경', '수정'];
  const hasMoveKeyword = moveKeywords.some(keyword => message.includes(keyword));

  if (!hasMoveKeyword) {
    return { isMoveRequest: false };
  }

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

  // 패턴 1: "월요일 오후 3시에 있는 눈높이를 토요일 2시로 옮겨"
  // (원본 요일) (원본 시간) (제목) (목표 요일) (목표 시간)
  // ⭐ 요일 전체 매칭: "월요일", "화요일" 등을 완전히 매칭
  // ⭐ 원본 시간 포함하여 매칭
  // ⭐ "있는" 또는 "잇는" (오타) 모두 매칭
  const pattern1 = /(월요일|화요일|수요일|목요일|금요일|토요일|일요일|월|화|수|목|금|토|일)\s*(?:오전|오후)?\s*(\d{1,2})시\s*에\s*(?:있|잇)는\s*([가-힣a-zA-Z0-9\s]+?)\s*(을|를)?\s*(월요일|화요일|수요일|목요일|금요일|토요일|일요일|월|화|수|목|금|토|일)\s*(?:오전|오후)?\s*(\d{1,2})시/;
  const match1 = message.match(pattern1);

  // 패턴 2: "금요일 구몬을 토요일로 옮겨" (시간 없음 - 원본 시간 유지)
  // ⭐ "있는" 또는 "잇는" (오타) 모두 매칭
  const pattern2 = /(월요일|화요일|수요일|목요일|금요일|토요일|일요일|월|화|수|목|금|토|일)\s*(?:에\s*(?:있|잇)는\s*)?([가-힣a-zA-Z0-9\s]+?)\s*(을|를)?\s*(월요일|화요일|수요일|목요일|금요일|토요일|일요일|월|화|수|목|금|토|일)\s*(?:로|으로)?\s*(?:이동|옮겨|수정|변경|바꿔)/;
  const match2 = !match1 ? message.match(pattern2) : null;

  // 패턴 3: "오후 3시에 있는 구몬을 토요일 11시로 이동" (원본 시간 명시)
  // (원본 시간) (제목) (목표 요일) (목표 시간)
  // ⭐ "있는" 또는 "잇는" (오타) 모두 매칭
  const pattern3 = /(?:오전|오후)?\s*(\d{1,2})시\s*에\s*(?:있|잇)는\s*([가-힣a-zA-Z0-9\s]+?)\s*(을|를)?\s*(월요일|화요일|수요일|목요일|금요일|토요일|일요일|월|화|수|목|금|토|일)\s*(?:오전|오후)?\s*(\d{1,2})시/;
  const match3 = !match1 && !match2 ? message.match(pattern3) : null;

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
    const sourceHour = parseInt(match1[2]);
    let title = match1[3].trim();
    // match1[4]는 "을/를" (optional)
    const targetDayKor = match1[5];
    const targetHour = parseInt(match1[6]);

    // 제목 정리
    title = title.trim();

    const sourceDay = Object.entries(dayMap).find(([k]) => sourceDayKor.includes(k))?.[1];
    const targetDay = Object.entries(dayMap).find(([k]) => targetDayKor.includes(k))?.[1];

    // 원본 시간 정규화 (오전/오후)
    const isSourcePM = message.match(new RegExp(`\$\s*\{\s*sourceDayKor\s*\}\s*\.\*오후\\s*\$\s*\{\s*sourceHour\s*\}\s*시`));
    let normalizedSourceHour = sourceHour;
    if (isSourcePM && sourceHour < 12) {
      normalizedSourceHour = sourceHour + 12;
    }
    const sourceTime = `${normalizedSourceHour.toString().padStart(2, '0')}:00`;

    // 목표 시간 정규화 (오전/오후)
    const isTargetPM = message.match(new RegExp(`\$\s*\{\s*targetDayKor\s*\}\s*\.\*오후\\s*\$\s*\{\s*targetHour\s*\}\s*시`));
    let normalizedTargetHour = targetHour;
    if (isTargetPM && targetHour < 12) {
      normalizedTargetHour = targetHour + 12;
    }
    const targetTime = `${normalizedTargetHour.toString().padStart(2, '0')}:00`;

    // 요일 코드 변환 (영어 <-> 한글)
    const dayKoreanMap = { 'MON': '월', 'TUE': '화', 'WED': '수', 'THU': '목', 'FRI': '금', 'SAT': '토', 'SUN': '일' };
    const sourceDayKorean = dayKoreanMap[sourceDay] || sourceDay;

    // 제목 정규화 (generic terms 처리)
    const titleVariations = normalizeTitle(title);

    // 1. 현재 스케줄에서 찾기 (제목 + 요일 + 시간으로 필터)
    let foundSchedules = currentSchedule.filter(s => {
      const titleMatch = titleVariations.some(variation => s.title?.includes(variation));
      const daysArray = Array.isArray(s.days) ? s.days : [s.days];
      const dayMatch = daysArray.includes(sourceDay) || daysArray.includes(sourceDayKorean);
      const timeMatch = s.startTime === sourceTime;

      return titleMatch && dayMatch && timeMatch;
    });

    // 2. 고정 일정에서도 찾기
    let foundFixedSchedules = [];
    if (foundSchedules.length === 0 && fixedSchedules) {
      foundFixedSchedules = fixedSchedules.filter(f => {
        const titleMatch = titleVariations.some(variation => f.title?.includes(variation));
        const daysArray = Array.isArray(f.days) ? f.days : [f.days];
        const dayMatch = daysArray.includes(sourceDay) || daysArray.includes(sourceDayKorean);
        const timeMatch = f.startTime === sourceTime;

        return titleMatch && dayMatch && timeMatch;
      });

      if (foundFixedSchedules.length > 0) {
        // ⭐ 고정 일정 자체를 사용 (originalSchedule이 없을 수 있음)
        foundSchedules = foundFixedSchedules.map(f => ({
          ...f,
          // originalSchedule이 있으면 그것의 메타데이터 사용, 없으면 고정 일정 자체 사용
          ...(f.originalSchedule || {}),
          // 하지만 시간/요일/제목은 현재 고정 일정 값 사용
          title: f.title,
          days: f.days,
          startTime: f.startTime,
          endTime: f.endTime
        }));
      }
    }

    // ⭐ 매칭된 일정이 없으면 에러
    if (foundSchedules.length === 0) {
      return {
        isMoveRequest: true,
        result: {
          success: false,
          understood: `\$\s*\{\s*sourceDayKor\s*\}\s* \$\s*\{\s*sourceTime\s*\}\s* \$\s*\{\s*title\s*\}\s*을 \$\s*\{\s*targetDayKor\s*\}\s* \$\s*\{\s*targetTime\s*\}\s*로 이동 시도`,
          action: 'move_failed',
          schedule: currentSchedule,
          explanation: `\$\s*\{\s*sourceDayKor\s*\}\s* \$\s*\{\s*sourceTime\s*\}\s*에 "\$\s*\{\s*title\s*\}\s*" 일정을 찾을 수 없어요. 😅\n\n현재 \$\s*\{\s*sourceDayKor\s*\}\s* 일정:\n\$\s*\{\s*getCurrentDaySchedules\s*\(\s*currentSchedule,\s*sourceDay,\s*fixedSchedules\s*\)\s*\}\s*`
        }
      };
    }

    const foundSchedule = foundSchedules[0];
    const foundFixed = foundFixedSchedules.length > 0 ? foundFixedSchedules[0] : null;
    
    // Duration 계산
    const duration = foundSchedule.endTime
      ? calculateDuration(foundSchedule.startTime, foundSchedule.endTime)
      : 60;
    
    const newEndTime = addMinutesToTime(targetTime, duration);
    
    // 1단계: 원본 삭제
    let updatedSchedule = currentSchedule.filter(s => {
      const titleMatch = s.title === foundSchedule.title;
      const timeMatch = s.startTime === foundSchedule.startTime;
      const daysArray = Array.isArray(s.days) ? s.days : [s.days];
      const dayMatch = daysArray.includes(sourceDay) || daysArray.includes(sourceDayKorean);

      const shouldDelete = titleMatch && timeMatch && dayMatch;
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
    }

    // 3단계: 새 일정 추가 (duration은 이미 계산됨)
    // 목표 요일을 한글로 변환 (고정 일정은 한글로 저장됨)
    const targetDayKorean = dayKoreanMap[targetDay] || targetDay;

    const newSchedule = {
      ...foundSchedule,
      days: [targetDayKorean], // 한글 요일 사용
      startTime: targetTime,
      endTime: newEndTime,
      type: wasFixed ? 'custom' : foundSchedule.type,
      sourceImageIndex: foundSchedule.sourceImageIndex,
      // 이동시간 관련 메타데이터 유지
      originalStartTime: foundSchedule.originalStartTime,
      originalEndTime: foundSchedule.originalEndTime,
      adjustedForTravelTime: foundSchedule.adjustedForTravelTime,
      travelTimeBefore: foundSchedule.travelTimeBefore,
      location: foundSchedule.location
    };

    updatedSchedule.push(newSchedule);

    // 4단계: 새로 추가한 일정을 고정 일정으로 등록 (원래 고정이었다면)
    if (wasFixed) {
      const newFixed = {
        ...foundFixed,
        days: [targetDayKorean], // 한글 요일 사용
        startTime: targetTime,
        endTime: newEndTime,
        id: `custom-\$\s*\{\s*Date\.now\s*\(\s*\)\s*\}\s*-\$\s*\{\s*Math\.random\s*\(\s*\)\s*\.toString\s*\(\s*36\s*\)\s*\.substr\s*\(\s*2,\s*9\s*\)\s*\}\s*`
      };
      updatedFixedSchedules.push(newFixed);
    }

    return {
      isMoveRequest: true,
      result: {
        success: true,
        understood: `\$\s*\{\s*sourceDayKor\s*\}\s* \$\s*\{\s*title\s*\}\s*을 \$\s*\{\s*targetDayKor\s*\}\s* \$\s*\{\s*targetHour\s*\}\s*시로 이동`,
        action: 'move',
        schedule: updatedSchedule,
        fixedSchedules: updatedFixedSchedules,
        explanation: `✅ \$\s*\{\s*title\s*\}\s*을 \$\s*\{\s*sourceDayKor\s*\}\s*에서 \$\s*\{\s*targetDayKorean\s*\}\s*요일 \$\s*\{\s*targetTime\s*\}\s*로 이동했어요! 😊`,
        movedSchedule: newSchedule
      }
    };
  }

  // 패턴 2: 시간 없이 이동 (원본 시간 유지)
  if (match2) {
    const sourceDayKor = match2[1];
    let title = match2[2].trim();
    // match2[3]은 "을/를" (optional)
    const targetDayKor = match2[4];

    // 제목 정리
    title = title.trim();

    const sourceDay = Object.entries(dayMap).find(([k]) => sourceDayKor.includes(k))?.[1];
    const targetDay = Object.entries(dayMap).find(([k]) => targetDayKor.includes(k))?.[1];

    // 요일 코드 변환 (영어 <-> 한글)
    const dayKoreanMap = { 'MON': '월', 'TUE': '화', 'WED': '수', 'THU': '목', 'FRI': '금', 'SAT': '토', 'SUN': '일' };
    const sourceDayKorean = dayKoreanMap[sourceDay] || sourceDay;

    // 제목 정규화 (generic terms 처리)
    const titleVariations = normalizeTitle(title);

    // 1. 현재 스케줄에서 찾기 (⭐ find → filter로 변경, 여러 개 찾기)
    let foundSchedules = currentSchedule.filter(s => {
      const titleMatch = titleVariations.some(variation => s.title?.includes(variation));
      const daysArray = Array.isArray(s.days) ? s.days : [s.days];
      const dayMatch = daysArray.includes(sourceDay) || daysArray.includes(sourceDayKorean);
      return titleMatch && dayMatch;
    });

    // 2. 고정 일정에서도 찾기
    let foundFixedSchedules = [];
    if (foundSchedules.length === 0 && fixedSchedules) {
      foundFixedSchedules = fixedSchedules.filter(f => {
        const titleMatch = titleVariations.some(variation => f.title?.includes(variation));
        const daysArray = Array.isArray(f.days) ? f.days : [f.days];
        const dayMatch = daysArray.includes(sourceDay) || daysArray.includes(sourceDayKorean);
        return titleMatch && dayMatch;
      });

      if (foundFixedSchedules.length > 0) {
        // ⭐ 고정 일정 자체를 사용 (originalSchedule이 없을 수 있음)
        foundSchedules = foundFixedSchedules.map(f => ({
          ...f,
          // originalSchedule이 있으면 그것의 메타데이터 사용, 없으면 고정 일정 자체 사용
          ...(f.originalSchedule || {}),
          // 하지만 시간/요일/제목은 현재 고정 일정 값 사용
          title: f.title,
          days: f.days,
          startTime: f.startTime,
          endTime: f.endTime
        }));
      }
    }

    // ⭐ 매칭된 일정이 없으면 에러
    if (foundSchedules.length === 0) {
      return {
        isMoveRequest: true,
        result: {
          success: false,
          understood: `\$\s*\{\s*sourceDayKor\s*\}\s* \$\s*\{\s*title\s*\}\s*을 \$\s*\{\s*targetDayKor\s*\}\s*로 이동 시도`,
          action: 'move_failed',
          schedule: currentSchedule,
          explanation: `\$\s*\{\s*sourceDayKor\s*\}\s*에 "\$\s*\{\s*title\s*\}\s*" 일정을 찾을 수 없어요. 😅\n\n현재 \$\s*\{\s*sourceDayKor\s*\}\s* 일정:\n\$\s*\{\s*getCurrentDaySchedules\s*\(\s*currentSchedule,\s*sourceDay,\s*fixedSchedules\s*\)\s*\}\s*`
        }
      };
    }

    // ⭐ 매칭된 일정이 여러 개면 사용자에게 선택 요청
    if (foundSchedules.length > 1) {

      const optionsList = foundSchedules.map((s, idx) =>
        `\$\s*\{\s*idx\s*\+\s*1\s*\}\s*\. \$\s*\{\s*s\.title\s*\}\s* (\$\s*\{\s*s\.startTime\s*\}\s*-\$\s*\{\s*s\.endTime\s*\}\s*)`
      ).join('\n');

      return {
        isMoveRequest: true,
        result: {
          success: false,
          understood: `\$\s*\{\s*sourceDayKor\s*\}\s* \$\s*\{\s*title\s*\}\s*을 \$\s*\{\s*targetDayKor\s*\}\s*로 이동 시도`,
          action: 'move_multiple_found',
          schedule: currentSchedule,
          options: foundSchedules,
          explanation: `\$\s*\{\s*sourceDayKor\s*\}\s*에 "\$\s*\{\s*title\s*\}\s*" 일정이 여러 개 있어요. 어떤 일정을 이동할까요? 🤔\n\n\$\s*\{\s*optionsList\s*\}\s*\n\n예: "2번 일정을 \$\s*\{\s*targetDayKor\s*\}\s*로 이동"`
        }
      };
    }

    const foundSchedule = foundSchedules[0];
    const foundFixed = foundFixedSchedules.length > 0 ? foundFixedSchedules[0] : null;

    // 원본 시간 유지
    const targetTime = foundSchedule.startTime;
    const duration = foundSchedule.endTime
      ? calculateDuration(foundSchedule.startTime, foundSchedule.endTime)
      : 60;

    const newEndTime = addMinutesToTime(targetTime, duration);

    // 1단계: 원본 삭제
    let updatedSchedule = currentSchedule.filter(s => {
      const titleMatch = s.title === foundSchedule.title;
      const timeMatch = s.startTime === foundSchedule.startTime;
      const daysArray = Array.isArray(s.days) ? s.days : [s.days];
      const dayMatch = daysArray.includes(sourceDay) || daysArray.includes(sourceDayKorean);

      const shouldDelete = titleMatch && timeMatch && dayMatch;

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
    }

    // 3단계: 새 일정 추가 (원본 시간 유지)
    const targetDayKorean = dayKoreanMap[targetDay] || targetDay;

    const newSchedule = {
      ...foundSchedule,
      days: [targetDayKorean],
      startTime: targetTime,
      endTime: newEndTime,
      type: wasFixed ? 'custom' : foundSchedule.type,
      sourceImageIndex: foundSchedule.sourceImageIndex,
      // 이동시간 관련 메타데이터 유지
      originalStartTime: foundSchedule.originalStartTime,
      originalEndTime: foundSchedule.originalEndTime,
      adjustedForTravelTime: foundSchedule.adjustedForTravelTime,
      travelTimeBefore: foundSchedule.travelTimeBefore,
      location: foundSchedule.location
    };
    updatedSchedule.push(newSchedule);

    // 4단계: 새로 추가한 일정을 고정 일정으로 등록 (원래 고정이었다면)
    if (wasFixed) {
      const newFixed = {
        ...foundFixed,
        days: [targetDayKorean],
        startTime: targetTime,
        endTime: newEndTime,
        id: `custom-\$\s*\{\s*Date\.now\s*\(\s*\)\s*\}\s*-\$\s*\{\s*Math\.random\s*\(\s*\)\s*\.toString\s*\(\s*36\s*\)\s*\.substr\s*\(\s*2,\s*9\s*\)\s*\}\s*`
      };
      updatedFixedSchedules.push(newFixed);
    }

    return {
      isMoveRequest: true,
      result: {
        success: true,
        understood: `\$\s*\{\s*sourceDayKor\s*\}\s* \$\s*\{\s*title\s*\}\s*을 \$\s*\{\s*targetDayKor\s*\}\s*로 이동 (시간 유지)`,
        action: 'move',
        schedule: updatedSchedule,
        fixedSchedules: updatedFixedSchedules,
        explanation: `✅ \$\s*\{\s*title\s*\}\s*을 \$\s*\{\s*sourceDayKor\s*\}\s*에서 \$\s*\{\s*targetDayKorean\s*\}\s*요일 \$\s*\{\s*targetTime\s*\}\s*로 이동했어요! 😊`,
        movedSchedule: newSchedule
      }
    };
  }

  // 패턴 3: "오후 3시에 있는 구몬을 토요일 11시로 이동" (원본 시간 명시)
  if (match3) {
    const sourceHour = parseInt(match3[1]);
    let title = match3[2].trim();
    // match3[3]은 "을/를" (optional)
    const targetDayKor = match3[4];
    const targetHour = parseInt(match3[5]);

    // 제목 정리 (이미 "에 있는" 뒤의 텍스트만 추출됨)
    title = title.trim();

    const targetDay = Object.entries(dayMap).find(([k]) => targetDayKor.includes(k))?.[1];

    // 원본 시간 정규화
    const isSourcePM = message.match(/오후\s*\d+시\.\*있는/);
    let normalizedSourceHour = sourceHour;
    if (isSourcePM && sourceHour < 12) {
      normalizedSourceHour = sourceHour + 12;
    }
    const sourceTime = `${normalizedSourceHour.toString().padStart(2, '0')}:00`;

    // 목표 시간 정규화 (오전/오후)
    const isTargetPM = message.match(new RegExp(`\$\s*\{\s*targetDayKor\s*\}\s*\.\*오후\\s*\$\s*\{\s*targetHour\s*\}\s*시`));
    let normalizedTargetHour = targetHour;
    if (isTargetPM && targetHour < 12) {
      normalizedTargetHour = targetHour + 12;
    }
    const targetTime = `${normalizedTargetHour.toString().padStart(2, '0')}:00`;

    // 제목 정규화 (generic terms 처리)
    const titleVariations = normalizeTitle(title);

    let foundSchedules = currentSchedule.filter(s => {
      const titleMatch = titleVariations.some(variation => s.title?.includes(variation));
      const timeMatch = s.startTime === sourceTime;
      return titleMatch && timeMatch;
    });

    // 2. 고정 일정에서 찾기
    let foundFixedSchedules = [];
    if (foundSchedules.length === 0 && fixedSchedules) {
      foundFixedSchedules = fixedSchedules.filter(f => {
        const titleMatch = titleVariations.some(variation => f.title?.includes(variation));
        const timeMatch = f.startTime === sourceTime;
        return titleMatch && timeMatch;
      });

      if (foundFixedSchedules.length > 0) {
        // ⭐ 고정 일정 자체를 사용 (originalSchedule이 없을 수 있음)
        foundSchedules = foundFixedSchedules.map(f => ({
          ...f,
          // originalSchedule이 있으면 그것의 메타데이터 사용, 없으면 고정 일정 자체 사용
          ...(f.originalSchedule || {}),
          // 하지만 시간/요일/제목은 현재 고정 일정 값 사용
          title: f.title,
          days: f.days,
          startTime: f.startTime,
          endTime: f.endTime
        }));
      }
    }

    if (foundSchedules.length === 0) {
      return {
        isMoveRequest: true,
        result: {
          success: false,
          understood: `\$\s*\{\s*sourceTime\s*\}\s* \$\s*\{\s*title\s*\}\s*을 \$\s*\{\s*targetDayKor\s*\}\s* \$\s*\{\s*targetTime\s*\}\s*로 이동 시도`,
          action: 'move_failed',
          schedule: currentSchedule,
          explanation: `\$\s*\{\s*sourceTime\s*\}\s*에 "\$\s*\{\s*title\s*\}\s*" 일정을 찾을 수 없어요. 😅`
        }
      };
    }

    const foundSchedule = foundSchedules[0];
    const foundFixed = foundFixedSchedules.length > 0 ? foundFixedSchedules[0] : null;

    // 요일 코드 변환
    const dayKoreanMap = { 'MON': '월', 'TUE': '화', 'WED': '수', 'THU': '목', 'FRI': '금', 'SAT': '토', 'SUN': '일' };
    const targetDayKorean = dayKoreanMap[targetDay] || targetDay;

    // 1단계: 원본 삭제
    let updatedSchedule = currentSchedule.filter(s => {
      const titleMatch = s.title === foundSchedule.title;
      const timeMatch = s.startTime === foundSchedule.startTime;
      const shouldDelete = titleMatch && timeMatch;
      return !shouldDelete;
    });

    // 2단계: 고정 일정이면 고정 일정도 업데이트
    let updatedFixedSchedules = fixedSchedules;
    let wasFixed = false;
    if (foundFixed) {
      wasFixed = true;
      updatedFixedSchedules = fixedSchedules.filter(f => !(f.id === foundFixed.id));
    }

    // 3단계: 새 일정 추가
    const duration = foundSchedule.endTime
      ? calculateDuration(foundSchedule.startTime, foundSchedule.endTime)
      : 60;
    const newEndTime = addMinutesToTime(targetTime, duration);

    const newSchedule = {
      ...foundSchedule,
      days: [targetDayKorean],
      startTime: targetTime,
      endTime: newEndTime,
      type: wasFixed ? 'custom' : foundSchedule.type,
      sourceImageIndex: foundSchedule.sourceImageIndex,
      // 이동시간 관련 메타데이터 유지
      originalStartTime: foundSchedule.originalStartTime,
      originalEndTime: foundSchedule.originalEndTime,
      adjustedForTravelTime: foundSchedule.adjustedForTravelTime,
      travelTimeBefore: foundSchedule.travelTimeBefore,
      location: foundSchedule.location
    };

    updatedSchedule.push(newSchedule);

    // 4단계: 새로 추가한 일정을 고정 일정으로 등록 (원래 고정이었다면)
    if (wasFixed) {
      const newFixed = {
        ...foundFixed,
        days: [targetDayKorean],
        startTime: targetTime,
        endTime: newEndTime,
        id: `custom-\$\s*\{\s*Date\.now\s*\(\s*\)\s*\}\s*-\$\s*\{\s*Math\.random\s*\(\s*\)\s*\.toString\s*\(\s*36\s*\)\s*\.substr\s*\(\s*2,\s*9\s*\)\s*\}\s*`
      };
      updatedFixedSchedules.push(newFixed);
    }

    return {
      isMoveRequest: true,
      result: {
        success: true,
        understood: `\$\s*\{\s*sourceTime\s*\}\s* \$\s*\{\s*title\s*\}\s*을 \$\s*\{\s*targetDayKor\s*\}\s* \$\s*\{\s*targetTime\s*\}\s*로 이동`,
        action: 'move',
        schedule: updatedSchedule,
        fixedSchedules: updatedFixedSchedules,
        explanation: `✅ \$\s*\{\s*title\s*\}\s* (\$\s*\{\s*sourceTime\s*\}\s*)을 \$\s*\{\s*targetDayKorean\s*\}\s*요일 \$\s*\{\s*targetTime\s*\}\s*로 이동했어요! 😊`,
        movedSchedule: newSchedule
      }
    };
  }

  return { isMoveRequest: false };
}

/**
 * getCurrentDaySchedules
 * @description 특정 요일의 현재 적용된 전체 일정(일반 + 고정) 목록을 포맷팅된 문자열로 반환합니다.
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
    .map(s => `• \$\s*\{\s*s\.title\s*\}\s* (\$\s*\{\s*s\.startTime\s*\}\s*-\$\s*\{\s*s\.endTime\s*\}\s*)`)
    .join('\n');
}

/**
 * calculateDuration
 * @description 두 시간 사이의 간격을 분 단위 수치로 계산합니다.
 */
function calculateDuration(startTime, endTime) {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  return (endHour * 60 + endMin) - (startHour * 60 + startMin);
}

/**
 * addMinutesToTime
 * @description 특정 시간에 지정된 분을 더한 결과를 HH:MM 형식으로 반환합니다.
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

