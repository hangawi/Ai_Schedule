/**
 * 스케줄 자동 최적화 유틸리티
 *
 * 새로운 로직 (세트 기반):
 * 1. 이미지별로 그룹화
 * 2. 각 이미지 내에서 색상별 세트로 분리 (같은 색 = 한 세트)
 * 3. 모든 세트에 우선순위 부여: 학교(1) > 공부학원(2) > 학습지(3) > 예체능(4)
 * 4. 우선순위 높은 세트부터 하나씩 선택 시도
 * 5. 겹치지 않으면 추가, 겹치면 건너뛰고 다음 세트 시도
 * 6. 결과: 학교 + 영어학원 한 반 + 댄스 여러 반 조합
 */

function categorizeSchedule(schedule, imageTitle) {
  const title = (schedule.title || '').toLowerCase();
  const image = (imageTitle || '').toLowerCase();
  const description = (schedule.description || '').toLowerCase();
  const combined = `${title} ${image} ${description}`;

  // 1순위: 학교 (단, "학원"이 명시적으로 있으면 제외)
  if (
    !combined.includes('학원') &&
    (combined.includes('학교') ||
    combined.includes('초등') ||
    combined.includes('중학') ||
    combined.includes('고등') ||
    (combined.includes('시간표') && (combined.includes('반') || combined.includes('학년'))))
  ) {
    return { category: '학교', priority: 1 };
  }

  // 2순위: 공부 학원
  const studyKeywords = ['학원', '국어', '영어', '수학', '과학', '사회', '논술', '독서', '토론'];
  if (studyKeywords.some(keyword => combined.includes(keyword))) {
    return { category: '공부학원', priority: 2 };
  }

  // 3순위: 학습지
  if (combined.includes('학습지') || combined.includes('눈높이') || combined.includes('구몬')) {
    return { category: '학습지', priority: 3 };
  }

  // 4순위: 예체능
  const artsKeywords = ['피아노', '바이올린', '기타', '드럼', '음악', '미술', '그림', '태권도', '축구', '농구', '수영', '체육', '댄스', '발레', '필라테스', '요가', 'kpop', 'dance', 'pt', 'studio'];
  if (artsKeywords.some(keyword => combined.includes(keyword))) {
    return { category: '예체능', priority: 4 };
  }

  return { category: '기타', priority: 5 };
}

function hasTimeOverlap(schedule1, schedule2) {
  const days1 = schedule1.days || [];
  const days2 = schedule2.days || [];
  const hasCommonDay = days1.some(day => days2.includes(day));

  if (!hasCommonDay) return false;

  const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const start1 = timeToMinutes(schedule1.startTime);
  const end1 = timeToMinutes(schedule1.endTime);
  const start2 = timeToMinutes(schedule2.startTime);
  const end2 = timeToMinutes(schedule2.endTime);

  return (start1 < end2 && end1 > start2);
}

// 이미지 전체가 다른 스케줄들과 겹치는지 확인
function imageHasOverlap(imageSchedules, otherSchedules) {
  for (const schedule1 of imageSchedules) {
    for (const schedule2 of otherSchedules) {
      if (hasTimeOverlap(schedule1, schedule2)) {
        return true;
      }
    }
  }
  return false;
}

// 색상 + Title로 세트 그룹화 (같은 이미지 내에서만)
function groupByColorInImage(imageSchedules) {
  const setGroups = {};

  imageSchedules.forEach(schedule => {
    const color = schedule.backgroundColor || schedule.color || null;
    const title = schedule.title || 'unnamed';

    let setKey;

    // 색이 있으면 "색상_제목"으로 세트 구분
    if (color && color !== 'null' && color !== 'white' && color.trim() !== '') {
      setKey = `${color}_${title}`;
    } else {
      // 색이 없으면 제목만으로 구분 (또는 전체를 하나로)
      // 학교 시간표처럼 색이 없고 모두 같은 세트인 경우
      const hasMultipleTitles = imageSchedules.some(s => s.title !== title);
      if (hasMultipleTitles) {
        // 제목이 여러 개면 제목별로 구분
        setKey = `nocolor_${title}`;
      } else {
        // 제목이 하나면 전체가 하나의 세트
        setKey = 'no_color_all';
      }
    }

    if (!setGroups[setKey]) {
      setGroups[setKey] = [];
    }

    setGroups[setKey].push(schedule);
  });

  return Object.values(setGroups);
}

function optimizeSchedules(allSchedules, schedulesByImage) {
  console.log('\n🔍 ========== 세트 기반 자동 최적화 시작 ==========');
  console.log(`📊 총 ${allSchedules.length}개 스케줄 입력`);

  // 1. 이미지별로 그룹화
  const imageGroups = {};
  allSchedules.forEach(schedule => {
    const imageFileName = schedule.sourceImage;
    if (!imageGroups[imageFileName]) {
      imageGroups[imageFileName] = [];
    }
    imageGroups[imageFileName].push(schedule);
  });

  console.log(`📸 ${Object.keys(imageGroups).length}개 이미지 발견`);

  // 2. 모든 세트 추출 (이미지별 → 색상별 세트)
  const allSets = [];
  let setIdCounter = 1;

  Object.entries(imageGroups).forEach(([fileName, schedules]) => {
    const imageInfo = schedulesByImage.find(img => img.fileName === fileName);
    const imageTitle = imageInfo?.imageTitle || fileName;

    // 색상별로 세트 분리
    const colorSets = groupByColorInImage(schedules);

    colorSets.forEach(setSchedules => {
      // 각 스케줄에 카테고리 부여
      const schedulesWithCategory = setSchedules.map(schedule => {
        const { category, priority } = categorizeSchedule(schedule, imageTitle);
        return { ...schedule, category, priority, imageTitle };
      });

      // 세트의 우선순위 = 세트 내 가장 높은 우선순위
      const setPriority = Math.min(...schedulesWithCategory.map(s => s.priority));
      const setCategory = schedulesWithCategory.find(s => s.priority === setPriority)?.category || '기타';

      // 세트 이름 추출 (첫 번째 스케줄의 title 사용)
      const setName = setSchedules[0]?.title || `세트${setIdCounter}`;
      const setColor = setSchedules[0]?.backgroundColor || setSchedules[0]?.color || 'none';

      allSets.push({
        id: setIdCounter++,
        name: setName,
        color: setColor,
        imageTitle,
        fileName,
        category: setCategory,
        priority: setPriority,
        schedules: schedulesWithCategory,
        count: schedulesWithCategory.length
      });
    });
  });

  // 3. 세트를 우선순위로 정렬
  allSets.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.count - a.count; // 같은 우선순위면 수업 개수 많은 것 우선
  });

  console.log(`\n🎨 총 ${allSets.length}개 세트 발견:`);
  allSets.forEach(set => {
    console.log(`  [세트${set.id}] ${set.priority}순위 (${set.category}) - ${set.imageTitle} - ${set.name} (${set.count}개 수업)`);
  });

  // 4. 세트별로 선택 시도 (겹치지 않으면 추가)
  const selectedSchedules = [];
  const selectedSets = [];
  const rejectedSets = [];

  console.log('\n🎯 세트별 최적화 진행:');

  for (const set of allSets) {
    const hasConflict = imageHasOverlap(set.schedules, selectedSchedules);

    if (hasConflict) {
      console.log(`❌ [세트${set.id}] ${set.category} - ${set.name} (${set.count}개) - 시간 겹침`);
      rejectedSets.push(set);
    } else {
      console.log(`✅ [세트${set.id}] ${set.category} - ${set.name} (${set.count}개)`);

      // 시간대 출력
      const timeSlots = set.schedules.map(s =>
        `${s.days?.join(',') || '?'} ${s.startTime}-${s.endTime}`
      ).join(', ');
      console.log(`   ⏰ ${timeSlots}`);

      selectedSchedules.push(...set.schedules);
      selectedSets.push(set);
    }
  }

  // 최종 중복 제거
  const uniqueSchedules = [];
  const seenKeys = new Set();

  selectedSchedules.forEach(schedule => {
    const key = `${schedule.days?.join(',')}_${schedule.startTime}_${schedule.endTime}_${schedule.title}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueSchedules.push(schedule);
    }
  });

  console.log('\n✨ ========== 최적화 완료 ==========');
  console.log(`✅ 선택된 세트: ${selectedSets.length}개`);
  console.log(`✅ 선택된 수업: ${uniqueSchedules.length}개`);
  console.log(`❌ 제외된 세트: ${rejectedSets.length}개`);
  console.log(`❌ 제외된 수업: ${rejectedSets.reduce((sum, s) => sum + s.count, 0)}개`);
  console.log('=====================================\n');

  return {
    optimizedSchedules: uniqueSchedules,
    removedSchedules: rejectedSets.flatMap(s => s.schedules),
    selectedSets: selectedSets, // ⭐ 선택된 세트 정보 추가
    rejectedSets: rejectedSets, // ⭐ 제외된 세트 정보 추가
    analysis: {
      totalInput: allSchedules.length,
      totalSelected: uniqueSchedules.length,
      totalRemoved: rejectedSets.reduce((sum, s) => sum + s.count, 0),
      totalSets: allSets.length,
      selectedSetsCount: selectedSets.length,
      rejectedSetsCount: rejectedSets.length
    }
  };
}

module.exports = { optimizeSchedules };
