/**
 * ===================================================================================================
 * useTimeSlots.js - 시간 슬롯 관리 훅
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/ScheduleGridSelector/hooks
 *
 * 🎯 주요 기능:
 *    - 개인시간과 고정일정 병합 (중복 제거)
 *    - 일정 색상 자동 할당 (OCR 색상 / 이미지 인덱스 색상 / 기본 색상)
 *    - 시간 범위 자동 조정 (일정에 맞춰 확장)
 *    - 시간 슬롯 배열 생성 (모드에 따라 0-24시 또는 9-18시)
 *
 * 🔗 연결된 파일:
 *    - ../utils/timeUtils.js - generateTimeSlots 함수 사용
 *    - ../constants/scheduleConstants.js - DAY_MAP 상수 사용
 *    - ../../../../utils/scheduleAnalysis/assignScheduleColors.js - 색상 팔레트
 *    - ../index.js - 이 훅을 사용하여 시간 슬롯 관리
 *
 * 💡 UI 위치:
 *    - 탭: 프로필 탭
 *    - 섹션: 스케줄 그리드 (모든 뷰)
 *    - 경로: 앱 실행 > 프로필 탭 > 스케줄 그리드
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 일정 병합 및 색상 할당 로직이 변경됨
 *    - 색상 우선순위 변경: allPersonalTimes useMemo의 색상 할당 순서 수정
 *    - 기본 색상 변경: convertColorNameToHex의 기본값 수정
 *    - 시간 범위 조정 로직 변경: useEffect의 maxEndHour 계산 수정
 *
 * 📝 참고사항:
 *    - 색상 우선순위: 1) OCR backgroundColor, 2) sourceImageIndex, 3) 기본 보라색
 *    - 중복 제거: title, startTime, endTime, days가 모두 같으면 중복
 *    - 시간 범위 자동 확장: 일정 종료 시간이 18시 넘으면 자동 확장 (최소 18시)
 *    - 24시간 모드: 0-24시, 기본 모드: timeRange 사용
 *
 * ===================================================================================================
 */

import { useMemo, useEffect } from 'react';
import { generateTimeSlots } from '../utils/timeUtils';
import { DAY_MAP } from '../constants/scheduleConstants';
import { getColorForImageIndex } from '../../../../utils/scheduleAnalysis/assignScheduleColors';

/**
 * convertColorNameToHex - 색상 이름을 hex 코드로 변환
 *
 * @description 색상 이름 문자열을 hex 코드로 변환 (매핑 테이블 사용)
 * @param {string} colorName - 색상 이름 (예: "blue", "red", "green" 등)
 * @returns {string} hex 색상 코드
 *
 * @example
 * convertColorNameToHex('blue'); // '#3b82f6'
 * convertColorNameToHex('red'); // '#ef4444'
 * convertColorNameToHex('#3b82f6'); // '#3b82f6' (이미 hex면 그대로)
 * convertColorNameToHex('unknown'); // '#9333ea' (기본 보라색)
 *
 * @note
 * - 이미 hex 코드면 그대로 반환
 * - 대소문자 구분 없음 (toLowerCase 처리)
 * - 매칭 안 되면 기본 보라색 (#9333ea)
 * - colorMap에 20+ 색상 정의됨
 */
const convertColorNameToHex = (colorName) => {
  if (!colorName) return '#9333ea'; // 기본 보라색

  // 이미 hex 코드인 경우 그대로 반환
  if (colorName.startsWith('#')) return colorName;

  // 색상 이름 매핑 테이블
  const colorMap = {
    'blue': '#3b82f6',
    'skyblue': '#38bdf8',
    'red': '#ef4444',
    'green': '#22c55e',
    'yellow': '#eab308',
    'orange': '#f97316',
    'purple': '#a855f7',
    'pink': '#ec4899',
    'gray': '#6b7280',
    'grey': '#6b7280',
    'brown': '#92400e',
    'black': '#1f2937',
    'white': '#f9fafb',
    'cyan': '#06b6d4',
    'teal': '#14b8a6',
    'indigo': '#6366f1',
    'violet': '#8b5cf6',
    'fuchsia': '#d946ef',
    'rose': '#f43f5e',
    'lime': '#84cc16',
    'emerald': '#10b981',
    'amber': '#f59e0b'
  };

  // 소문자로 변환하여 매핑
  const normalizedColor = colorName.toLowerCase().trim();
  return colorMap[normalizedColor] || '#9333ea'; // 매칭 안 되면 기본 보라색
};

/**
 * useTimeSlots - 시간 슬롯 관리 훅
 *
 * @description 개인시간과 고정일정을 병합하고 색상을 할당하며 시간 슬롯을 생성하는 커스텀 훅
 * @param {Array} personalTimes - 개인 시간 배열
 * @param {Array} fixedSchedules - 고정 일정 배열
 * @param {boolean} showFullDay - 24시간 모드 여부
 * @param {Object} timeRange - 시간 범위 객체 ({ start, end })
 * @param {Function} setTimeRange - 시간 범위 설정 함수
 * @returns {Object} 시간 슬롯 관련 데이터
 * @returns {Array} return.allPersonalTimes - 병합된 전체 개인시간 배열
 * @returns {Function} return.getCurrentTimeSlots - 현재 시간 슬롯 배열 반환 함수
 *
 * @example
 * const {
 *   allPersonalTimes,
 *   getCurrentTimeSlots
 * } = useTimeSlots(personalTimes, fixedSchedules, showFullDay, timeRange, setTimeRange);
 *
 * @note
 * - 색상 우선순위: 1) backgroundColor (OCR), 2) sourceImageIndex, 3) 기본 보라색
 * - 중복 제거: title, startTime, endTime, days 모두 같으면 제외
 * - 시간 범위 자동 확장: 일정 종료 시간이 timeRange.end 넘으면 확장
 * - useMemo로 allPersonalTimes 최적화
 * - useEffect로 timeRange 자동 조정
 */
const useTimeSlots = (personalTimes, fixedSchedules, showFullDay, timeRange, setTimeRange) => {

  /**
   * allPersonalTimes - personalTimes와 fixedSchedules 병합 (useMemo)
   *
   * @description 개인시간과 고정일정을 하나의 배열로 병합 (중복 제거 및 색상 할당)
   *
   * @process
   * 1. personalTimes에 기본 색상 추가 (없으면 #8b5cf6)
   * 2. fixedSchedules를 personalTime 형식으로 변환
   * 3. days를 문자열에서 숫자 배열로 변환 (DAY_MAP 사용)
   * 4. 중복 체크 (title, startTime, endTime, days 비교)
   * 5. 색상 할당 (backgroundColor > sourceImageIndex > 기본 보라색)
   * 6. 병합된 배열 반환
   *
   * @returns {Array} 병합된 개인시간 배열 (색상 포함)
   *
   * @note
   * - days는 DAY_MAP으로 숫자 배열로 변환 (1=월, 2=화, ..., 7=일 → 1, 2, ..., 0)
   * - isFixed 플래그로 고정일정 구분
   * - sourceImageIndex 유지 (범례 필터링용)
   * - 디버깅용 console.log 포함 (색상 할당 과정)
   */
  // ⭐ personalTimes와 fixedSchedules 합치기
  const allPersonalTimes = useMemo(() => {
    console.log('🔧 [useTimeSlots] 입력 데이터:', {
      personalTimes,
      personalTimesLength: personalTimes?.length || 0,
      fixedSchedules,
      fixedSchedulesLength: fixedSchedules?.length || 0
    });

    // personalTimes에 색상 추가 (없으면 보라색)
    const combined = (personalTimes || []).map(p => ({
      ...p,
      color: p.color || '#8b5cf6'
    }));

    // 고정 일정을 personalTime 형식으로 변환해서 추가
    if (fixedSchedules && fixedSchedules.length > 0) {
      fixedSchedules.forEach(fixed => {
        // days를 숫자 배열로 먼저 변환
        const daysArray = Array.isArray(fixed.days) ? fixed.days : [fixed.days];
        const mappedDays = daysArray.map(day => DAY_MAP[day] || day).filter(d => d && typeof d === 'number');

        // ⭐ 중복 체크: personalTimes에 이미 있는지 확인 (숫자 배열로 비교)
        const isDuplicate = combined.some(existing =>
          existing.title === fixed.title &&
          existing.startTime === fixed.startTime &&
          existing.endTime === fixed.endTime &&
          JSON.stringify(existing.days?.sort()) === JSON.stringify(mappedDays.sort())
        );

        if (isDuplicate) {
          return;
        }

        // ⭐ 색상 우선순위: 1) OCR backgroundColor, 2) 이미지 인덱스 색상, 3) 기본 보라색
        let scheduleColor = '#9333ea'; // 기본 보라색

        // 🎨 디버깅: 색상 할당 과정 로그
        console.log(`🎨 [useTimeSlots] ${fixed.title} 색상 할당:`, {
          backgroundColor: fixed.backgroundColor,
          sourceImageIndex: fixed.sourceImageIndex
        });

        // 1순위: OCR에서 추출한 backgroundColor 사용
        if (fixed.backgroundColor) {
          scheduleColor = convertColorNameToHex(fixed.backgroundColor);
          console.log(`  ✅ backgroundColor 사용: ${fixed.backgroundColor} → ${scheduleColor}`);
        }
        // 2순위: 이미지 인덱스로 색상 가져오기
        else if (fixed.sourceImageIndex !== undefined) {
          const colorInfo = getColorForImageIndex(fixed.sourceImageIndex);
          scheduleColor = colorInfo.border; // 색상 팔레트에서 border 색상 사용
          console.log(`  📊 sourceImageIndex 사용: ${fixed.sourceImageIndex} → ${scheduleColor}`);
        } else {
          console.log(`  ⚪ 기본 색상 사용: ${scheduleColor}`);
        }

        combined.push({
          ...fixed,
          days: mappedDays, // ⭐ 숫자 배열로 변환
          color: scheduleColor, // ⭐ 원본 이미지 색상으로 할당
          isFixed: true, // 고정 일정 표시용 플래그
          sourceImageIndex: fixed.sourceImageIndex // 범례 필터링용
        });
      });
    }

    console.log('✨ [useTimeSlots] allPersonalTimes 생성 완료:', {
      combined,
      length: combined.length,
      first3: combined.slice(0, 3)
    });

    return combined;
  }, [personalTimes, fixedSchedules]);

  /**
   * useEffect - 일정에 맞춰 timeRange 자동 조정
   *
   * @description 모든 개인시간의 종료 시간을 확인하여 timeRange.end를 자동 확장
   *
   * @process
   * 1. allPersonalTimes의 모든 endTime 확인
   * 2. 최대 종료 시간 계산 (분이 있으면 다음 시간으로 올림)
   * 3. 최소 18시까지는 표시 보장
   * 4. 기본 모드에서 maxEndHour가 timeRange.end보다 크면 확장
   *
   * @example
   * // 일정 종료: 20:30 → maxEndHour: 21 → timeRange.end: 21
   * // 일정 종료: 17:00 → maxEndHour: 17 → timeRange.end: 18 (최소값)
   *
   * @note
   * - 24시간 모드에서는 조정 안 함
   * - 분이 1분이라도 있으면 다음 시간으로 올림 (예: 17:01 → 18)
   * - 최소 18시까지는 표시 (Math.max(18, maxEndHour))
   * - Dependencies: allPersonalTimes, showFullDay, timeRange.end, setTimeRange
   */
  // 일정에 맞춰 timeRange 자동 조정 (올림 처리)
  useEffect(() => {
    if (!allPersonalTimes || allPersonalTimes.length === 0) return;

    let maxEndHour = 18;
    allPersonalTimes.forEach(p => {
      if (p.endTime) {
        const [hour, minute] = p.endTime.split(':').map(Number);
        // 분이 있으면 다음 시간으로 올림
        const endHour = minute > 0 ? hour + 1 : hour;
        if (endHour > maxEndHour) {
          maxEndHour = endHour;
        }
      }
    });

    // 최소 18시까지는 표시
    maxEndHour = Math.max(18, maxEndHour);
    if (!showFullDay && maxEndHour > timeRange.end) {
      setTimeRange(prev => ({ ...prev, end: maxEndHour }));
    }
  }, [allPersonalTimes, showFullDay, timeRange.end, setTimeRange]);

  /**
   * getCurrentTimeSlots - 현재 시간 슬롯 배열 반환
   *
   * @description 현재 모드(24시간/기본)에 따라 시간 슬롯 배열 생성
   * @returns {Array} 시간 슬롯 배열 (\"HH:MM\" 형식, 10분 간격)
   *
   * @example
   * // 24시간 모드
   * getCurrentTimeSlots(); // [\"00:00\", \"00:10\", ..., \"23:50\"]
   *
   * // 기본 모드 (9-18시)
   * getCurrentTimeSlots(); // [\"09:00\", \"09:10\", ..., \"17:50\"]
   *
   * @note
   * - 24시간 모드: 0-24시 (generateTimeSlots(0, 24))
   * - 기본 모드: timeRange.start ~ timeRange.end
   * - 10분 간격 (TIME_SLOT_INTERVAL 상수)
   */
  const getCurrentTimeSlots = () => {
    if (showFullDay) {
      // 24시간 모드: 00:00 ~ 24:00
      return generateTimeSlots(0, 24);
    } else {
      // 기본 모드: timeRange 사용 (9~18시 또는 일정에 맞춰 조정)
      return generateTimeSlots(timeRange.start, timeRange.end);
    }
  };

  return {
    allPersonalTimes,
    getCurrentTimeSlots
  };
};

export default useTimeSlots;
