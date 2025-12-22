/**
 * ===================================================================================================
 * scheduleProcessing.js - 추출된 일정 데이터 정제 및 병합 유틸리티
 * ===================================================================================================
 *
 * 📍 위치: 백엔드 > server/utils > scheduleProcessing.js
 * 🎯 주요 기능:
 *    - OCR 분석 직후 파편화된 시간 조각들(예: 10분 단위로 나뉜 동일 수업)을 하나의 연속된 일정으로 병합.
 *    - 요일별로 흩어진 동일 수업 정보들을 통합하여 관리 효율성 증대.
 *    - 일정 제목, 강사명, 장소(층) 정보가 일치하고 시간이 빈틈없이 이어지는 경우에만 지능적으로 병합 수행.
 *    - 병합된 결과에 대해 총 소요 시간(Duration)을 자동으로 재계산하여 데이터 일관성 유지.
 *
 * 🔗 연결된 파일:
 *    - server/controllers/ocrController.js - OCR 결과의 최종 정제 단계에서 이 유틸리티 사용.
 *
 * ✏️ 수정 가이드:
 *    - 병합 판단 조건(예: 특정 과목은 병합 제외 등)을 추가하려면 mergeConsecutiveSchedules 루프 내의 if 조건문 수정.
 *    - 요일 통합 시의 정렬 순서를 변경하려면 byDay 순회 로직 수정.
 *
 * 📝 참고사항:
 *    - 이 모듈은 원시 OCR 데이터를 사용자가 이해하기 쉬운 '완전한 수업' 단위로 바꾸는 핵심 정제 도구임.
 *
 * ===================================================================================================
 */

/**
 * mergeConsecutiveSchedules
 * @description 시간이 이어지고 속성이 동일한 파편화된 일정들을 하나의 큰 시간 블록으로 통합합니다.
 * @param {Array} schedules - 정제 전의 원본 일정 배열.
 * @returns {Array} 병합 및 요일 통합이 완료된 최종 일정 배열.
 */
function mergeConsecutiveSchedules(schedules) {
  if (!schedules || schedules.length === 0) return schedules;

  const merged = [];
  const processed = new Set();

  // 각 스케줄을 요일별로 전개
  const expandedSchedules = [];
  schedules.forEach(schedule => {
    const days = Array.isArray(schedule.days) ? schedule.days : [schedule.days];
    days.forEach(day => {
      expandedSchedules.push({ ...schedule, days: [day], originalDaysCount: days.length });
    });
  });

  // 요일별로 그룹화 및 시간순 정렬
  const byDay = {};
  expandedSchedules.forEach(schedule => {
    const day = schedule.days[0];
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(schedule);
  });

  Object.keys(byDay).forEach(day => {
    const daySchedules = byDay[day].sort((a, b) => a.startTime.localeCompare(b.startTime));

    for (let i = 0; i < daySchedules.length; i++) {
      const current = daySchedules[i];
      const currentId = `${day}_${current.title}_${current.startTime}_${current.endTime}`;

      if (processed.has(currentId)) continue;

      // 연속된 같은 제목의 스케줄 찾기
      let endTime = current.endTime;
      const toMerge = [current];

      for (let j = i + 1; j < daySchedules.length; j++) {
        const next = daySchedules[j];

        if (next.title === current.title &&
            next.instructor === current.instructor &&
            next.floor === current.floor &&  // ⭐ 층도 같아야 병합
            next.startTime === endTime) {
          toMerge.push(next);
          endTime = next.endTime;

          const nextId = `${day}_${next.title}_${next.startTime}_${next.endTime}`;
          processed.add(nextId);
        } else {
          break;
        }
      }

      const mergedSchedule = { ...current };
      mergedSchedule.endTime = endTime;
      mergedSchedule.days = [day];

      // duration 재계산
      const [startH, startM] = current.startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      mergedSchedule.duration = (endH * 60 + endM) - (startH * 60 + startM);

      merged.push(mergedSchedule);
      processed.add(currentId);
    }
  });

  // 같은 title + startTime + endTime + instructor를 가진 스케줄을 다시 묶기
  const finalMerged = [];
  const scheduleMap = new Map();

  merged.forEach(schedule => {
    const key = `${schedule.title}_${schedule.startTime}_${schedule.endTime}_${schedule.instructor || ''}_${schedule.floor || ''}`;  // ⭐ 층도 키에 포함

    if (scheduleMap.has(key)) {
      // 기존 스케줄에 요일 추가
      const existing = scheduleMap.get(key);
      existing.days.push(schedule.days[0]);
    } else {
      // 새로운 스케줄 추가
      scheduleMap.set(key, {
        ...schedule,
        days: [schedule.days[0]]
      });
    }
  });

  // Map에서 배열로 변환
  scheduleMap.forEach(schedule => finalMerged.push(schedule));
  return finalMerged;
}

module.exports = {
  mergeConsecutiveSchedules
};
