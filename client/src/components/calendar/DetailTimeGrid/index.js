/**
 * ===================================================================================================
 * DetailTimeGrid/index.js - 세부 시간표 편집 모달 (내 프로필 탭)
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/calendar/DetailTimeGrid/index.js
 *
 * 🎯 주요 기능:
 *    - 특정 날짜의 10분 단위 시간표를 세밀하게 편집
 *    - 시간 슬롯 클릭으로 우선순위 순환 (선호 3 → 보통 2 → 조정가능 1 → 삭제)
 *    - 드래그 선택으로 여러 시간대를 한번에 선택
 *    - 직접 시간 입력 모드 (시작/종료 시간 직접 지정)
 *    - 복사 옵션 (다음주, 한달 전체, 특정 기간에 동일 시간 복사)
 *    - 병합/분할 뷰 토글 (연속된 같은 우선순위 시간을 합쳐서 보기/나눠서 보기)
 *    - 24시간/기본(9~18시) 뷰 전환
 *    - 휴무일 설정 및 전체 날짜 삭제 기능
 *    - 예외일정 및 개인시간 표시
 *
 * 🔗 연결된 파일:
 *    - ./utils/timeCalculations.js - 시간 계산 유틸 함수들
 *    - ./utils/timeSlotMerger.js - 연속된 시간 슬롯 병합 함수
 *    - ./utils/dateFormatters.js - 날짜 포맷팅 함수들
 *    - ./constants/priorityConfig.js - 우선순위별 색상 및 레이블 설정
 *    - lucide-react - X 아이콘
 *    - ../tabs/ProfileTab/index.js - 부모 컴포넌트에서 호출
 *
 * 💡 UI 위치:
 *    - 탭: 내프로필 (첫 번째 탭)
 *    - 섹션: 선호시간 섹션의 달력에서 특정 날짜 클릭 시 표시되는 모달
 *    - 화면: 전체 화면 오버레이 모달로 표시
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 프로필 탭의 세부 시간표 편집 기능 전체가 변경됨
 *    - 시간 간격 변경: generateTimeSlots 함수 호출 시 간격 파라미터 수정 (현재 10분)
 *    - 우선순위 순환 로직 변경: handleSlotClick 함수의 priority 분기 처리 수정
 *    - 복사 옵션 추가: applyCopyOptionsToSchedule 함수에 새로운 copyType 추가
 *    - 시간 범위 기본값 변경: timeRange 초기 state 수정 (현재 9~18시)
 *    - 색상 변경: priorityConfig.js 파일 수정
 *
 * 📝 참고사항:
 *    - 선호시간(priority 3)은 파란색, 보통(2)은 초록색, 조정가능(1)은 노란색으로 표시
 *    - 드래그 선택 시 시작점과 끝점 사이의 모든 시간이 선택됨
 *    - 복사 옵션은 한번 설정하면 다음 슬롯 추가/수정 시에도 계속 적용됨
 *    - 병합 모드는 보기 전용이며, 분할 모드로 돌아와야 개별 시간 편집 가능
 *    - readOnly 모드에서는 클릭해도 수정되지 않고 정보만 표시됨
 *    - 모든 변경사항은 '저장' 버튼을 눌러야 실제로 저장됨 (onSave 호출)
 *    - 예외일정(exceptions)과 개인시간(personalTimes)은 회색 배경으로 표시
 *
 * ===================================================================================================
 */

import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

// Import utilities
import { generateTimeSlots, getNextTimeSlot, getTimeDifferenceInMinutes, timeToMinutes, calculateEndTime } from './utils/timeCalculations';
import { mergeConsecutiveTimeSlots } from './utils/timeSlotMerger';
import { formatDate, getDateString } from './utils/dateFormatters';

// Import constants
import { priorityConfig } from './constants/priorityConfig';

const DetailTimeGrid = ({
  selectedDate,
  schedule,
  setSchedule,
  readOnly,
  exceptions = [],
  setExceptions,
  personalTimes = [],
  onClose,
  onSave,
  showFullDay = false
}) => {
  const [timeRange, setTimeRange] = useState({ start: 9, end: 18 });
  const [selectionStart, setSelectionStart] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [previewSelection, setPreviewSelection] = useState([]);
  const [showDirectInput, setShowDirectInput] = useState(false);
  const [directInput, setDirectInput] = useState({
    startTime: '09:00',
    endTime: '10:00',
    priority: 2
  });
  const [showCopyOptions, setShowCopyOptions] = useState(false);
  const [copyOptions, setCopyOptions] = useState({
    copyType: 'none', // 기본적으로 복사 안함
    includePrevWeek: false,
    includeNextWeek: false,
    includeWholeMonth: false
  });
  const [showMerged, setShowMerged] = useState(false); // 병합 모드 토글
  const [mergedSchedule, setMergedSchedule] = useState([]);

  // 초기 상태 저장 (저장하지 않고 닫을 때 복원용)
  const [initialExceptions] = useState([...exceptions]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // 복사옵션 외부 클릭 감지를 위한 ref
  const copyOptionsRef = useRef(null);

  // 스케줄이 변경될 때마다 병합된 스케줄 업데이트
  useEffect(() => {
    setMergedSchedule(mergeConsecutiveTimeSlots(schedule));
  }, [schedule]);

  // 외부 클릭 감지하여 복사옵션 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (copyOptionsRef.current && !copyOptionsRef.current.contains(event.target)) {
        setShowCopyOptions(false);
      }
    };

    if (showCopyOptions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCopyOptions]);

  useEffect(() => {
    if (showFullDay) {
      setTimeRange({ start: 0, end: 24 });
    } else {
      setTimeRange({ start: 9, end: 18 });
    }
  }, [showFullDay]);

  const getCurrentTimeSlots = () => {
    return generateTimeSlots(timeRange.start, timeRange.end);
  };

  const calculateEndTime = (startTime) => {
    const [h, m] = startTime.split(':').map(Number);
    const totalMinutes = h * 60 + m + 10;
    const endHour = Math.floor(totalMinutes / 60);
    const endMinute = totalMinutes % 60;
    return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
  };

  /**
   * handleSlotClick - 시간 슬롯 클릭 핸들러
   *
   * @description 시간 슬롯을 클릭할 때마다 우선순위를 순환(3→2→1→삭제)시키거나 새로 추가합니다.
   *              읽기 전용 모드에서는 아무 작업도 수행하지 않습니다.
   *              모든 변경사항은 `schedule` 상태에 반영됩니다.
   *
   * @param {string} startTime - 클릭된 슬롯의 시작 시간 (HH:MM 형식)
   *
   * @note
   * - `readOnly` prop이 true이면 즉시 반환됩니다.
   * - 기존 슬롯이 있으면 우선순위를 3→2→1 순으로 변경하고, 1에서 다시 클릭하면 삭제됩니다.
   * - 새 슬롯은 우선순위 3(선호)으로 생성됩니다.
   * - 복사 옵션이 활성화된 경우, 슬롯 추가 시 복사본도 함께 생성됩니다.
   * - 변경이 발생하면 `hasUnsavedChanges` 상태가 true로 설정됩니다.
   */
  const handleSlotClick = (startTime) => {
    // 모든 모드에서 시간대 정보 확인 가능
    const exception = getExceptionForSlot(startTime);
    const personalTime = getPersonalTimeForSlot(startTime);
    const slotInfo = getSlotInfo(startTime);

    // readOnly 모드에서는 정보만 표시하고 수정하지 않음
    if (readOnly) {
      return;
    }

    // 수동 클릭은 특정 날짜의 defaultSchedule에 추가
    if (!setSchedule) {
      return;
    }

    const dayOfWeek = selectedDate.getDay(); // 0: Sunday, ..., 6: Saturday
    const [hour, minute] = startTime.split(':').map(Number);
    
    // 특정 날짜 문자열 생성
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    // 해당 날짜의 해당 시간대에 이미 스케줄이 있는지 확인
    const existingSlot = schedule.find(slot => 
      slot.specificDate === dateStr &&
      slot.startTime === startTime &&
      slot.endTime === getNextTimeSlot(startTime)
    );

    if (existingSlot) {
      // 기존 슬롯이 있으면 우선순위를 순환시킴: 선호(3) → 보통(2) → 조정 가능(1) → 없어짐(삭제)
      const currentPriority = existingSlot.priority || 3;

      if (currentPriority === 3) {
        // 선호 → 보통
        setSchedule(schedule.map(slot =>
          (slot.specificDate === dateStr && slot.startTime === startTime && slot.endTime === getNextTimeSlot(startTime))
            ? { ...slot, priority: 2 }
            : slot
        ));
      } else if (currentPriority === 2) {
        // 보통 → 조정 가능
        setSchedule(schedule.map(slot =>
          (slot.specificDate === dateStr && slot.startTime === startTime && slot.endTime === getNextTimeSlot(startTime))
            ? { ...slot, priority: 1 }
            : slot
        ));
      } else if (currentPriority === 1) {
        // 조정 가능 → 없어짐 (삭제)
        const idToDelete = existingSlot._id;
        const sourceIdToDelete = existingSlot.sourceId;

        setSchedule(schedule.filter(slot => {
          // 삭제할 슬롯 자체
          if (slot.specificDate === dateStr && slot.startTime === startTime && slot.endTime === getNextTimeSlot(startTime)) {
            return false;
          }
          // 원본이 삭제될 때 복사본도 삭제
          if (idToDelete && slot.sourceId === idToDelete) {
            return false;
          }
          // 복사본이 삭제될 때 원본 및 다른 복사본도 삭제
          if (sourceIdToDelete && (slot._id === sourceIdToDelete || slot.sourceId === sourceIdToDelete)) {
            return false;
          }
          return true;
        }));
      } else {
        // 다른 우선순위는 선호로 초기화
        setSchedule(schedule.map(slot =>
          (slot.specificDate === dateStr && slot.startTime === startTime && slot.endTime === getNextTimeSlot(startTime))
            ? { ...slot, priority: 3 }
            : slot
        ));
      }
    } else {
      // 새로운 슬롯 생성 (선호로 시작, 특정 날짜)
      const endTime = getNextTimeSlot(startTime);

      const newSlot = {
        _id: Date.now().toString() + Math.random(), // Add unique ID
        dayOfWeek: dayOfWeek,
        startTime: startTime,
        endTime: endTime,
        priority: 3, // 선호로 시작
        specificDate: dateStr // 특정 날짜 지정
      };

      setSchedule([...schedule, newSlot]);

      // 복사 옵션이 선택된 경우에만 추가 날짜에 적용
      if (copyOptions.copyType !== 'none') {
        applyCopyOptionsToSchedule([newSlot]);
      }
    }

    setHasUnsavedChanges(true);
  };

  /**
   * getSlotInfo - 특정 시간의 일정 정보 조회
   *
   * @description 주어진 시작 시간에 해당하는 일정(schedule) 정보를 반환합니다.
   *              병합/분할 뷰 모드에 따라 다른 방식으로 정보를 찾습니다.
   *
   * @param {string} startTime - 조회할 시작 시간 (HH:MM 형식)
   * @returns {Object|null} 해당 시간의 일정 객체. 없으면 null.
   *
   * @note
   * - `showMerged` 상태에 따라 `mergedSchedule` 또는 `schedule` 배열에서 검색합니다.
   * - `specificDate`가 있는 일정은 날짜를 비교하고, 없으면 요일을 비교하여 현재 선택된 날짜에 유효한지 확인합니다.
   */
  const getSlotInfo = (startTime) => {
    const dayOfWeek = selectedDate.getDay();
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const currentSchedule = showMerged ? mergedSchedule : schedule;

    if (showMerged) {
      // 병합 모드에서는 해당 시간이 병합된 슬롯에 포함되는지 확인
      for (const slot of currentSchedule) {
        // specificDate가 있으면 날짜도 비교, 없으면 dayOfWeek만 비교
        const dateMatches = slot.specificDate ? slot.specificDate === dateStr : slot.dayOfWeek === dayOfWeek;
        
        if (dateMatches) {
          const slotStartMinutes = timeToMinutes(slot.startTime);
          const slotEndMinutes = timeToMinutes(slot.endTime);
          const currentTimeMinutes = timeToMinutes(startTime);

          if (currentTimeMinutes >= slotStartMinutes && currentTimeMinutes < slotEndMinutes) {
            return slot;
          }
        }
      }
      return null;
    } else {
      // 분할 모드에서도 시간 범위 체크 (병합 모드와 동일한 로직)
      for (const slot of currentSchedule) {
        const dateMatches = slot.specificDate ? slot.specificDate === dateStr : slot.dayOfWeek === dayOfWeek;
        
        if (dateMatches) {
          const slotStartMinutes = timeToMinutes(slot.startTime);
          const slotEndMinutes = timeToMinutes(slot.endTime);
          const currentTimeMinutes = timeToMinutes(startTime);

          if (currentTimeMinutes >= slotStartMinutes && currentTimeMinutes < slotEndMinutes) {
            return slot;
          }
        }
      }
      return null;
    }
  };


/**
 * timeToMinutes - 시간 문자열을 분으로 변환
 *
 * @description "HH:MM" 형식의 시간 문자열을 0시 0분부터의 총 분으로 변환합니다.
 * @param {string} timeString - "HH:MM" 형식의 시간 문자열
 * @returns {number} 분으로 변환된 시간
 *
 * @example
 * timeToMinutes("01:30"); // 90
 * timeToMinutes("14:00"); // 840
 */
  const timeToMinutes = (timeString) => {
    const [hour, minute] = timeString.split(':').map(Number);
    return hour * 60 + minute;
  };

  /**
   * getExceptionForSlot - 특정 시간 슬롯의 예외 일정 조회
   *
   * @description 주어진 시작 시간에 해당하는 예외(exception) 일정이 있는지 확인하고, 있으면 해당 예외 객체를 반환합니다.
   * @param {string} startTime - 조회할 시작 시간 (HH:MM 형식)
   * @returns {Object|null} 해당 시간의 예외 객체. 없으면 null.
   *
   * @note
   * - `exceptions` 상태 배열을 참조합니다.
   * - `specificDate`가 현재 선택된 날짜와 일치하는지 확인합니다.
   * - 예외 객체의 `startTime`과 `endTime`이 ISO 문자열 형식과 "HH:MM" 형식을 모두 처리할 수 있도록 구현되어 있습니다.
   */
  const getExceptionForSlot = (startTime) => {
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const [hour, minute] = startTime.split(':').map(Number);

    for (const ex of exceptions) {
      // 유효하지 않은 데이터 필터링
      if (!ex || !ex.specificDate || !ex.startTime) continue;

      // specificDate 필드를 사용해야 함 (startTime은 "10:00" 형식이므로 날짜가 아님)
      const exDateStr = ex.specificDate;

      if (exDateStr === dateStr) {
        // 현재 슬롯 시간 (분 단위)
        const slotMinutes = hour * 60 + minute;

        // startTime과 endTime이 ISO 형식인 경우와 "HH:MM" 형식인 경우를 모두 처리
        let exStartMinutes, exEndMinutes;

        if (ex.startTime.includes('T')) {
          // ISO 형식 (예: "2025-09-26T10:00:00.000Z")
          const exStartTime = new Date(ex.startTime);
          const exEndTime = new Date(ex.endTime);
          exStartMinutes = exStartTime.getHours() * 60 + exStartTime.getMinutes();
          exEndMinutes = exEndTime.getHours() * 60 + exEndTime.getMinutes();
        } else {
          // "HH:MM" 형식
          const [exStartHour, exStartMinute] = ex.startTime.split(':').map(Number);
          const [exEndHour, exEndMinute] = ex.endTime.split(':').map(Number);
          exStartMinutes = exStartHour * 60 + exStartMinute;
          exEndMinutes = exEndHour * 60 + exEndMinute;
        }

        // 슬롯이 시작~종료 시간 범위 안에 있는지 확인
        if (slotMinutes >= exStartMinutes && slotMinutes < exEndMinutes) {
          return ex;
        }
      }
    }
    return null;
  };

  /**
   * getPersonalTimeForSlot - 특정 시간 슬롯의 개인 시간 정보 조회
   *
   * @description 주어진 시작 시간에 해당하는 개인 시간(personal time)이 있는지 확인하고, 있으면 해당 개인 시간 객체를 반환합니다.
   * @param {string} startTime - 조회할 시작 시간 (HH:MM 형식)
   * @returns {Object|null} 해당 시간의 개인 시간 객체. 없으면 null.
   *
   * @note
   * - `personalTimes` 상태 배열을 참조합니다.
   * - 반복되는 개인 시간(요일 기준)과 특정 날짜의 개인 시간을 모두 고려합니다.
   * - 수면 시간처럼 자정을 넘어가는 시간대도 올바르게 처리합니다.
   */
  const getPersonalTimeForSlot = (startTime) => {
    const dayOfWeek = selectedDate.getDay() === 0 ? 7 : selectedDate.getDay();
    const selectedDateStr = selectedDate.toISOString().split('T')[0];
    const [hour, minute] = startTime.split(':').map(Number);
    const slotMinutes = hour * 60 + minute;

    for (const pt of personalTimes) {
      let shouldInclude = false;

      // specificDate가 있으면 날짜가 일치하는지만 체크
      if (pt.specificDate) {
        // specificDate는 이미 "YYYY-MM-DD" 형식이므로 직접 비교
        // new Date()로 변환하면 UTC 시간대 문제가 발생할 수 있음
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const day = String(selectedDate.getDate()).padStart(2, '0');
        const localDateStr = `${year}-${month}-${day}`;

        if (pt.specificDate === localDateStr) {
          shouldInclude = true;
        }
      }
      // specificDate가 없으면 반복되는 개인시간 체크
      else if (pt.isRecurring !== false && pt.days && pt.days.includes(dayOfWeek)) {
        shouldInclude = true;
      }

      if (!shouldInclude) {
        continue;
      }

      const [startHour, startMin] = pt.startTime.split(':').map(Number);
      const [endHour, endMin] = pt.endTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      let endMinutes = endHour * 60 + endMin;


      // 수면시간과 같은 overnight 시간 처리
      if (endMinutes <= startMinutes) {
        endMinutes += 24 * 60;
        if (slotMinutes >= startMinutes || slotMinutes < (endMinutes - 24 * 60)) {
          return pt;
        }
      } else {
        if (slotMinutes >= startMinutes && slotMinutes < endMinutes) {
          return pt;
        }
      }
    }
    return null;
  };

  const formatDate = (date) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
  };

  // 특정 시간대에 예외가 있는지 확인하는 함수
  const hasExceptionInTimeRange = (startHour, endHour) => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const day = selectedDate.getDate();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 10) {
        const hasException = exceptions.some(ex => {
          // specificDate로 날짜 비교, startTime으로 시간 비교
          if (!ex || ex.specificDate !== dateStr || !ex.startTime) return false;

          const [exHour, exMinute] = ex.startTime.split(':').map(Number);
          return exHour === hour && exMinute === minute && ex.title === '일정';
        });
        if (hasException) return true;
      }
    }
    return false;
  };

  // 특정 시간대의 예외들을 제거하는 함수
  const removeExceptionsInTimeRange = (startHour, endHour) => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const day = selectedDate.getDate();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const filteredExceptions = exceptions.filter(ex => {
      const exStartTime = new Date(ex.startTime);
      const exHour = exStartTime.getHours();
      const exMinute = exStartTime.getMinutes();

      // 해당 시간대이고 해당 날짜이며 '일정' 제목인 것들을 제거
      if (ex.specificDate === dateStr &&
          ex.title === '일정' &&
          exHour >= startHour &&
          exHour < endHour) {
        return false; // 제거
      }
      return true; // 유지
    });

    setExceptions(filteredExceptions);
    setHasUnsavedChanges(true);
  };

  /**
   * addQuickTimeSlot - 빠른 시간 추가 (오전/오후 전체)
   *
   * @description 오전(9-12시) 또는 오후(13-17시) 등 미리 정의된 시간 범위를 한번에 추가하거나 제거(토글)합니다.
   * @param {number} startHour - 시작 시간 (hour)
   * @param {number} endHour - 종료 시간 (hour)
   * @param {number} [priority=3] - 적용할 우선순위
   *
   * @note
   * - `readOnly` 모드에서는 작동하지 않습니다.
   * - 이미 해당 시간대에 슬롯이 있으면 모든 관련 슬롯을 제거하고, 없으면 새로 추가합니다.
   * - 복사 옵션이 활성화된 경우, 슬롯 추가 시 복사본도 함께 생성됩니다.
   * - 변경 사항은 즉시 자동 저장됩니다.
   */
  const addQuickTimeSlot = (startHour, endHour, priority = 3) => {
    if (readOnly || !setSchedule) return;

    const dayOfWeek = selectedDate.getDay(); // 0: Sunday, ..., 6: Saturday
    
    // 특정 날짜 문자열 생성
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // 해당 날짜 및 시간대에 이미 스케줄이 있는지 확인
    const existingSlots = schedule.filter(slot => {
      // 특정 날짜 스케줄만 확인 (specificDate가 있는 것)
      if (!slot.specificDate || slot.specificDate !== dateStr) return false;
      
      const slotStart = slot.startTime.split(':').map(Number);
      const slotEnd = slot.endTime.split(':').map(Number);
      const slotStartMinutes = slotStart[0] * 60 + slotStart[1];
      const slotEndMinutes = slotEnd[0] * 60 + slotEnd[1];
      
      const targetStartMinutes = startHour * 60;
      const targetEndMinutes = endHour * 60;
      
      // 겹치는지 확인
      return (slotStartMinutes < targetEndMinutes && slotEndMinutes > targetStartMinutes);
    });

    if (existingSlots.length > 0) {
      // 이미 있으면 해당 날짜 및 시간대의 모든 10분 슬롯 제거 (토글)
      // + 복사된 슬롯들도 함께 제거
      
      const rootIds = new Set();
      existingSlots.forEach(slot => {
        rootIds.add(slot.sourceId || slot._id);
      });

      const filteredSchedule = schedule.filter(slot => {
        const rootId = slot.sourceId || slot._id;
        if (rootIds.has(rootId)) return false;
        // Also check if the slot itself is a root that is being deleted
        if (rootIds.has(slot._id)) return false;
        return true;
      });
      setSchedule(filteredSchedule);
    } else {
      // 전체 시간 범위를 하나의 슬롯으로 추가 (채팅 방식과 동일)
      const newSlot = {
        _id: Date.now().toString() + Math.random(), // Add unique ID
        dayOfWeek: dayOfWeek,
        startTime: `${String(startHour).padStart(2, '0')}:00`,
        endTime: `${String(endHour).padStart(2, '0')}:00`,
        priority: priority,
        specificDate: dateStr // 특정 날짜 지정
      };
      
      setSchedule([...schedule, newSlot]);

      // 복사 옵션이 선택된 경우에만 추가 날짜에 적용
      if (copyOptions.copyType !== 'none') {
        applyCopyOptionsToSchedule([newSlot]);
      }
    }

    setHasUnsavedChanges(true);

    // 편집 모드가 아닐 때만 자동 저장 실행
    if (onSave && !readOnly) {
      setTimeout(async () => {
        try {
          await onSave();
          setHasUnsavedChanges(false);
        } catch (error) {
        }
      }, 200);
    }

    // 강제 리렌더링
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 10);
  };


  /**
   * applyCopyOptions - 예외 일정에 복사 옵션 적용
   *
   * @description 주어진 예외 일정을 `copyOptions` 상태에 따라 다른 날짜에 복사하여 추가합니다.
   * @param {Object} baseException - 복사의 기준이 되는 원본 예외 객체
   *
   * @note
   * - `setExceptions` 함수를 사용하여 상태를 업데이트합니다.
   * - 복사 유형: 'nextWeek', 'prevWeek', 'thisWholeWeek', 'nextWholeWeek', 'wholeMonth'.
   * - 복사된 예외는 원본의 `_id`를 `sourceId`로 가리켜 원본과의 관계를 유지합니다.
   */
  const applyCopyOptions = (baseException) => {
    // 복사 옵션에 따라 다른 날짜에도 동일한 예외 추가
    if (!setExceptions || copyOptions.copyType === 'none') return;


    const additionalExceptions = [];
    const baseDate = new Date(selectedDate);

    if (copyOptions.copyType === 'nextWeek') {
      // 다음주 같은 요일에 복사
      const nextWeekDate = new Date(baseDate);
      nextWeekDate.setDate(baseDate.getDate() + 7);

      const nextYear = nextWeekDate.getFullYear();
      const nextMonth = nextWeekDate.getMonth();
      const nextDay = nextWeekDate.getDate();
      const nextDateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;

      const baseStartTime = new Date(baseException.startTime);
      const baseEndTime = new Date(baseException.endTime);

      const newStartTime = new Date(nextYear, nextMonth, nextDay, baseStartTime.getHours(), baseStartTime.getMinutes(), 0);
      const newEndTime = new Date(nextYear, nextMonth, nextDay, baseEndTime.getHours(), baseEndTime.getMinutes(), 0);

      const newException = {
        ...baseException,
        _id: Date.now().toString() + Math.random(),
        sourceId: baseException.sourceId || baseException._id,
        startTime: newStartTime.toISOString(),
        endTime: newEndTime.toISOString(),
        specificDate: nextDateStr
      };
      additionalExceptions.push(newException);

    } else if (copyOptions.copyType === 'prevWeek') {
      // 이전주 같은 요일에 복사
      const prevWeekDate = new Date(baseDate);
      prevWeekDate.setDate(baseDate.getDate() - 7);

      const prevYear = prevWeekDate.getFullYear();
      const prevMonth = prevWeekDate.getMonth();
      const prevDay = prevWeekDate.getDate();
      const prevDateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(prevDay).padStart(2, '0')}`;

      const baseStartTime = new Date(baseException.startTime);
      const baseEndTime = new Date(baseException.endTime);

      const newStartTime = new Date(prevYear, prevMonth, prevDay, baseStartTime.getHours(), baseStartTime.getMinutes(), 0);
      const newEndTime = new Date(prevYear, prevMonth, prevDay, baseEndTime.getHours(), baseEndTime.getMinutes(), 0);

      const newException = {
        ...baseException,
        _id: Date.now().toString() + Math.random(),
        sourceId: baseException.sourceId || baseException._id,
        startTime: newStartTime.toISOString(),
        endTime: newEndTime.toISOString(),
        specificDate: prevDateStr
      };
      additionalExceptions.push(newException);

    } else if (copyOptions.copyType === 'thisWholeWeek' || copyOptions.copyType === 'nextWholeWeek') {
      const dayOffset = copyOptions.copyType === 'thisWholeWeek' ? 0 : 7;
      const monday = new Date(baseDate);
      monday.setDate(baseDate.getDate() - (baseDate.getDay() === 0 ? 6 : baseDate.getDay() - 1) + dayOffset);

      for (let i = 0; i < 5; i++) { // Loop for Monday to Friday
        const targetDate = new Date(monday);
        targetDate.setDate(monday.getDate() + i);
        
        if (targetDate.toDateString() === baseDate.toDateString()) continue;

        const targetYear = targetDate.getFullYear();
        const targetMonth = targetDate.getMonth();
        const targetDay = targetDate.getDate();
        const targetDateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;

        const baseStartTime = new Date(baseException.startTime);
        const baseEndTime = new Date(baseException.endTime);

        const newStartTime = new Date(targetYear, targetMonth, targetDay, baseStartTime.getHours(), baseStartTime.getMinutes(), 0);
        const newEndTime = new Date(targetYear, targetMonth, targetDay, baseEndTime.getHours(), baseEndTime.getMinutes(), 0);

        const newException = {
            ...baseException,
            _id: Date.now().toString() + Math.random(),
            sourceId: baseException.sourceId || baseException._id,
            startTime: newStartTime.toISOString(),
            endTime: newEndTime.toISOString(),
            specificDate: targetDateStr
        };
        additionalExceptions.push(newException);
      }
    } else if (copyOptions.copyType === 'wholeMonth') {
      // 이번달 모든 같은 요일에 복사
      const currentMonth = baseDate.getMonth();
      const currentYear = baseDate.getFullYear();
      const dayOfWeek = baseDate.getDay();

      const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
      const firstDayOfWeek = firstDayOfMonth.getDay();

      // 해당 요일의 첫 번째 날짜 계산
      let firstTargetDate = 1 + (dayOfWeek - firstDayOfWeek + 7) % 7;

      while (firstTargetDate <= 31) {
        const targetDate = new Date(currentYear, currentMonth, firstTargetDate);

        // 유효한 날짜이고 이번달이고 현재 날짜가 아닌 경우
        if (targetDate.getMonth() === currentMonth && targetDate.toDateString() !== baseDate.toDateString()) {
          const targetYear = targetDate.getFullYear();
          const targetMonth = targetDate.getMonth();
          const targetDay = targetDate.getDate();
          const targetDateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;

          const baseStartTime = new Date(baseException.startTime);
          const baseEndTime = new Date(baseException.endTime);

          const newStartTime = new Date(targetYear, targetMonth, targetDay, baseStartTime.getHours(), baseStartTime.getMinutes(), 0);
          const newEndTime = new Date(targetYear, targetMonth, targetDay, baseEndTime.getHours(), baseEndTime.getMinutes(), 0);

          const newException = {
            ...baseException,
            _id: Date.now().toString() + Math.random(),
            sourceId: baseException.sourceId || baseException._id,
            startTime: newStartTime.toISOString(),
            endTime: newEndTime.toISOString(),
            specificDate: targetDateStr
          };
          additionalExceptions.push(newException);
        }

        firstTargetDate += 7; // 다음 주 같은 요일
      }
    }

    if (additionalExceptions.length > 0) {
      setTimeout(() => {
        setExceptions(prev => [...prev, ...additionalExceptions]);
      }, 100);
    }
  };
  /**
   * applyCopyOptionsToSchedule - 선호 시간에 복사 옵션 적용
   *
   * @description 주어진 선호 시간 슬롯(들)을 `copyOptions` 상태에 따라 다른 날짜에 복사하여 추가합니다.
   * @param {Array<Object>} baseSlots - 복사의 기준이 되는 원본 슬롯 객체의 배열
   *
   * @note
   * - `setSchedule` 함수를 사용하여 상태를 업데이트합니다.
   * - 복사 유형: 'nextWeek', 'prevWeek', 'thisWholeWeek', 'nextWholeWeek', 'wholeMonth'.
   * - 복사된 슬롯은 원본의 `_id`를 `sourceId`로 가리켜 원본과의 관계를 유지합니다.
   */
  const applyCopyOptionsToSchedule = (baseSlots) => {
    // 선호시간에 대한 복사 옵션 적용
    if (!setSchedule || copyOptions.copyType === 'none' || !baseSlots || baseSlots.length === 0) return;

    const additionalSlots = [];
    const baseDate = new Date(selectedDate);

    if (copyOptions.copyType === 'nextWeek') {
      // 다음주 같은 요일에 복사
      const nextWeekDate = new Date(baseDate);
      nextWeekDate.setDate(baseDate.getDate() + 7);
      const nextDateStr = `${nextWeekDate.getFullYear()}-${String(nextWeekDate.getMonth() + 1).padStart(2, '0')}-${String(nextWeekDate.getDate()).padStart(2, '0')}`;

      baseSlots.forEach(slot => {
        additionalSlots.push({
          ...slot,
          _id: Date.now().toString() + Math.random(),
          sourceId: slot.sourceId || slot._id,
          specificDate: nextDateStr
        });
      });

    } else if (copyOptions.copyType === 'prevWeek') {
      // 이전주 같은 요일에 복사
      const prevWeekDate = new Date(baseDate);
      prevWeekDate.setDate(baseDate.getDate() - 7);
      const prevDateStr = `${prevWeekDate.getFullYear()}-${String(prevWeekDate.getMonth() + 1).padStart(2, '0')}-${String(prevWeekDate.getDate()).padStart(2, '0')}`;

      baseSlots.forEach(slot => {
        additionalSlots.push({
          ...slot,
          _id: Date.now().toString() + Math.random(),
          sourceId: slot.sourceId || slot._id,
          specificDate: prevDateStr
        });
      });

    } else if (copyOptions.copyType === 'thisWholeWeek' || copyOptions.copyType === 'nextWholeWeek') {
      const dayOffset = copyOptions.copyType === 'thisWholeWeek' ? 0 : 7;
      const monday = new Date(baseDate);
      monday.setDate(baseDate.getDate() - (baseDate.getDay() === 0 ? 6 : baseDate.getDay() - 1) + dayOffset);

      for (let i = 0; i < 5; i++) { // Loop for Monday to Friday
        const targetDate = new Date(monday);
        targetDate.setDate(monday.getDate() + i);
        const targetDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
        
        // Don't copy to the source date itself
        if (targetDate.toDateString() === baseDate.toDateString()) continue;

        baseSlots.forEach(slot => {
          additionalSlots.push({
            ...slot,
            _id: Date.now().toString() + Math.random(),
            sourceId: slot.sourceId || slot._id,
            specificDate: targetDateStr,
            dayOfWeek: targetDate.getDay()
          });
        });
      }
    } else if (copyOptions.copyType === 'wholeMonth') {
      // 이번달 모든 같은 요일에 복사
      const currentMonth = baseDate.getMonth();
      const currentYear = baseDate.getFullYear();
      const dayOfWeek = baseDate.getDay();

      const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
      const firstDayOfWeek = firstDayOfMonth.getDay();

      let firstTargetDate = 1 + (dayOfWeek - firstDayOfWeek + 7) % 7;

      while (firstTargetDate <= 31) {
        const targetDate = new Date(currentYear, currentMonth, firstTargetDate);

        if (targetDate.getMonth() === currentMonth && targetDate.toDateString() !== baseDate.toDateString()) {
          const targetDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

          baseSlots.forEach(slot => {
            additionalSlots.push({
              ...slot,
              _id: Date.now().toString() + Math.random(),
              sourceId: slot.sourceId || slot._id,
              specificDate: targetDateStr
            });
          });
        }

        firstTargetDate += 7;
      }
    }

    if (additionalSlots.length > 0) {
      setTimeout(() => {
        setSchedule(prev => [...prev, ...additionalSlots]);
      }, 100);
    }
  };

  /**
   * addHolidayForDay - '휴무일' 설정/해제
   *
   * @description 선택된 날짜 전체를 '휴무일' 예외로 설정하거나, 이미 설정된 경우 해제합니다(토글).
   *
   * @note
   * - `readOnly` 모드에서는 작동하지 않습니다.
   * - 휴무일 설정 시 해당 날짜의 다른 모든 예외를 제거하고, 하루 전체를 덮는 휴무일 예외를 생성합니다.
   * - 휴무일 해제 시 해당 날짜의 휴무일 예외 및 관련 복사본을 모두 제거합니다.
   * - 복사 옵션이 활성화된 경우, 휴무일 설정 시 다른 날짜에도 복사됩니다.
   */
  const addHolidayForDay = () => {
    if (readOnly) return;

    // 휴무일 설정 시 전체 시간 범위로 변경
    setTimeRange({ start: 0, end: 24 });

    // 선택된 날짜를 로컬 날짜로 정확히 처리
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // 해당 날짜의 모든 휴무일 관련 예외 찾기
    const existingHolidayExceptions = exceptions.filter(ex => {
      const exStartTime = new Date(ex.startTime);
      const exYear = exStartTime.getFullYear();
      const exMonth = String(exStartTime.getMonth() + 1).padStart(2, '0');
      const exDay = String(exStartTime.getDate()).padStart(2, '0');
      const exDateStr = `${exYear}-${exMonth}-${exDay}`;
      return exDateStr === dateStr && (ex.title === '휴무일' || ex.isHoliday);
    });

    if (existingHolidayExceptions.length > 0) {
      // 이미 휴무일로 설정된 경우 해당 날짜의 모든 예외와 복사본 제거
      const rootIds = new Set();
      existingHolidayExceptions.forEach(ex => {
        rootIds.add(ex.sourceId || ex._id);
      });

      const filteredExceptions = exceptions.filter(ex => {
        const rootId = ex.sourceId || ex._id;
        if (rootIds.has(rootId)) return false;
        if (rootIds.has(ex._id)) return false;
        return true;
      });
      setExceptions(filteredExceptions);
      setHasUnsavedChanges(true);
    } else {
      // 해당 날짜의 모든 기존 예외를 완전히 제거하고 새로운 휴무일 설정
      const filteredExceptions = exceptions.filter(ex => {
        const exStartTime = new Date(ex.startTime);
        const exYear = exStartTime.getFullYear();
        const exMonth = String(exStartTime.getMonth() + 1).padStart(2, '0');
        const exDay = String(exStartTime.getDate()).padStart(2, '0');
        const exDateStr = `${exYear}-${exMonth}-${exDay}`;
        return exDateStr !== dateStr;
      });

      // 휴무일을 위한 10분 단위 예외들을 생성 (전체 하루를 덮도록)
      const holidayExceptions = [];

      // 00:00부터 23:59까지 10분 단위로 휴무일 예외 생성
      for (let hour = 0; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute += 10) {
          const startDateTime = new Date(year, selectedDate.getMonth(), selectedDate.getDate(), hour, minute, 0);
          const endMinute = minute + 10;
          const endHour = endMinute >= 60 ? hour + 1 : hour;
          const adjustedEndMinute = endMinute >= 60 ? 0 : endMinute;
          const endDateTime = new Date(year, selectedDate.getMonth(), selectedDate.getDate(), endHour, adjustedEndMinute, 0);

          const newException = {
            _id: Date.now().toString() + Math.random() + hour + minute,
            title: '휴무일',
            startTime: startDateTime.toISOString(),
            endTime: endDateTime.toISOString(),
            isHoliday: true,
            isAllDay: true,
            specificDate: dateStr
          };

          holidayExceptions.push(newException);
        }
      }

      setExceptions([...filteredExceptions, ...holidayExceptions]);
      setHasUnsavedChanges(true);

      // 복사 옵션이 선택된 경우에만 추가 날짜에 적용
      if (copyOptions.copyType !== 'none') {
        holidayExceptions.forEach(exc => applyCopyOptions(exc));
      }
    }
  };

  /**
   * blockEntireDay - 하루 전체를 휴무일로 설정/해제 (토글)
   * @description `addHolidayForDay`와 동일한 기능을 수행합니다. 선택된 날짜를 휴무일로 만들거나 기존 휴무일을 해제합니다.
   */
  const blockEntireDay = () => {
    if (readOnly || !setExceptions) return;

    // 휴무일 설정 시 전체 시간 범위로 변경
    setTimeRange({ start: 0, end: 24 });

    // 선택된 날짜를 로컬 날짜로 정확히 처리
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // 해당 날짜의 모든 휴무일 관련 예외 찾기
    const existingHolidayExceptions = exceptions.filter(ex => {
      const exStartTime = new Date(ex.startTime);
      const exYear = exStartTime.getFullYear();
      const exMonth = String(exStartTime.getMonth() + 1).padStart(2, '0');
      const exDay = String(exStartTime.getDate()).padStart(2, '0');
      const exDateStr = `${exYear}-${exMonth}-${exDay}`;
      return exDateStr === dateStr && (ex.title === '휴무일' || ex.isHoliday);
    });

    if (existingHolidayExceptions.length > 0) {
      // 이미 휴무일로 설정된 경우 해당 날짜의 모든 예외 제거
      const filteredExceptions = exceptions.filter(ex => {
        const exStartTime = new Date(ex.startTime);
        const exYear = exStartTime.getFullYear();
        const exMonth = String(exStartTime.getMonth() + 1).padStart(2, '0');
        const exDay = String(exStartTime.getDate()).padStart(2, '0');
        const exDateStr = `${exYear}-${exMonth}-${exDay}`;
        return exDateStr !== dateStr;
      });
      setExceptions(filteredExceptions);
      setHasUnsavedChanges(true);
    } else {
      // 해당 날짜의 모든 기존 예외를 완전히 제거하고 새로운 휴무일 설정
      const filteredExceptions = exceptions.filter(ex => {
        const exStartTime = new Date(ex.startTime);
        const exYear = exStartTime.getFullYear();
        const exMonth = String(exStartTime.getMonth() + 1).padStart(2, '0');
        const exDay = String(exStartTime.getDate()).padStart(2, '0');
        const exDateStr = `${exYear}-${exMonth}-${exDay}`;
        return exDateStr !== dateStr;
      });

      // 휴무일을 위한 10분 단위 예외들을 생성 (전체 하루를 덮도록)
      const holidayExceptions = [];

      // 00:00부터 23:59까지 10분 단위로 휴무일 예외 생성
      for (let hour = 0; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute += 10) {
          const startDateTime = new Date(year, selectedDate.getMonth(), selectedDate.getDate(), hour, minute, 0);
          const endMinute = minute + 10;
          const endHour = endMinute >= 60 ? hour + 1 : hour;
          const adjustedEndMinute = endMinute >= 60 ? 0 : endMinute;
          const endDateTime = new Date(year, selectedDate.getMonth(), selectedDate.getDate(), endHour, adjustedEndMinute, 0);

          const newException = {
            _id: Date.now().toString() + Math.random() + hour + minute,
            title: '휴무일',
            startTime: startDateTime.toISOString(),
            endTime: endDateTime.toISOString(),
            isHoliday: true,
            isAllDay: true,
            specificDate: dateStr
          };

          holidayExceptions.push(newException);
        }
      }

      setExceptions([...filteredExceptions, ...holidayExceptions]);
      setHasUnsavedChanges(true);
    }
  };

  /**
   * deleteEntireDay - 선택된 날짜의 모든 일정/예외 삭제
   * @description 선택된 날짜에 해당하는 모든 선호 시간(schedule)과 예외(exception)를 삭제합니다.
   *              복사된 항목들(sourceId 기준)도 함께 제거하여 일관성을 유지합니다.
   */
  const deleteEntireDay = async () => {
    if (readOnly) return;

    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const day = selectedDate.getDate();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayOfWeek = selectedDate.getDay();

    const idsToDelete = new Set();

    // Collect IDs of exceptions on the selected date
    exceptions.forEach(ex => {
      let exDateStr;
      if (ex.specificDate) {
        exDateStr = ex.specificDate;
      } else if (ex.startTime) {
        const exStartTime = new Date(ex.startTime);
        const exYear = exStartTime.getFullYear();
        const exMonth = String(exStartTime.getMonth() + 1).padStart(2, '0');
        const exDay = String(exStartTime.getDate()).padStart(2, '0');
        exDateStr = `${exYear}-${exMonth}-${exDay}`;
      }

      if (exDateStr === dateStr) {
        if (ex._id) idsToDelete.add(String(ex._id));
        if (ex.sourceId) idsToDelete.add(String(ex.sourceId));
      }
    });

    // Collect IDs of schedule entries on the selected date
    schedule.forEach(s => {
      let sDateStr;
      if (s.specificDate) {
        sDateStr = s.specificDate;
      } else if (s.dayOfWeek !== undefined) {
        // For schedule entries that might only have dayOfWeek, we need to check if it matches selectedDate's dayOfWeek
        // This assumes dayOfWeek is 0-6 (Sunday-Saturday)
        if (s.dayOfWeek === dayOfWeek) {
          // If it's a recurring schedule, we might not want to delete all instances unless explicitly requested.
          // For now, we'll treat dayOfWeek matches as candidates for deletion if no specificDate is present.
          // This part might need further refinement based on exact schedule data structure and user expectation for recurring schedules.
          // For the purpose of deleting copied items, specificDate is more reliable.
          // Let's prioritize specificDate for now.
          return; // Skip if only dayOfWeek and no specificDate for rootId determination
        }
      }

      if (sDateStr === dateStr) {
        if (s._id) idsToDelete.add(String(s._id));
        if (s.sourceId) idsToDelete.add(String(s.sourceId));
      }
    });

    let newExceptions = [...exceptions];
    let newSchedule = [...schedule];

    if (idsToDelete.size > 0) {
      // If we have IDs to delete (meaning an item on selectedDate was found with _id or sourceId)
      newExceptions = exceptions.filter(ex => {
        const exId = ex._id ? String(ex._id) : undefined;
        const exSourceId = ex.sourceId ? String(ex.sourceId) : undefined;
        return !(idsToDelete.has(exId) || idsToDelete.has(exSourceId));
      });

      newSchedule = schedule.filter(s => {
        const sId = s._id ? String(s._id) : undefined;
        const sSourceId = s.sourceId ? String(s.sourceId) : undefined;
        return !(idsToDelete.has(sId) || idsToDelete.has(sSourceId));
      });

    } else {
      // If no specific items with _id/sourceId were found on the selected date,
      // revert to original behavior: delete all exceptions and schedule entries directly on the selectedDate.
      newExceptions = exceptions.filter(ex => {
        let exDateStr;
        if (ex.specificDate) {
          exDateStr = ex.specificDate;
        } else if (ex.startTime) {
          const exStartTime = new Date(ex.startTime);
          const exYear = exStartTime.getFullYear();
          const exMonth = String(exStartTime.getMonth() + 1).padStart(2, '0');
          const exDay = String(exStartTime.getDate()).padStart(2, '0');
          exDateStr = `${exYear}-${exMonth}-${exDay}`;
        }
        return exDateStr !== dateStr; // Keep exceptions NOT on the selected date
      });

      newSchedule = schedule.filter(s => {
        // Original logic for schedule was to delete by dayOfWeek. Let's keep that for the fallback.
        // However, if a schedule item has specificDate, it should be deleted if it matches dateStr.
        const sDateMatches = s.specificDate === dateStr;
        const sDayOfWeekMatches = s.dayOfWeek === dayOfWeek && !s.specificDate; // Only if no specificDate

        return !(sDateMatches || sDayOfWeekMatches);
      });
    }

    // 상태 업데이트
    if (setExceptions) {
      setExceptions(newExceptions);
    }
    if (setSchedule) {
      setSchedule(newSchedule);
    }
    setHasUnsavedChanges(true);

    // 편집 모드가 아닐 때만 자동 저장 실행
    if (onSave && readOnly) {
      setTimeout(async () => {
        try {
          await onSave();
          setHasUnsavedChanges(false);
        } catch (error) {
        }
      }, 200);
    }
  };

  /**
   * handleDirectInput - 직접 입력 시간 추가
   * @description 사용자가 직접 입력한 시작/종료 시간과 우선순위로 예외 일정을 생성합니다.
   *              입력된 시간은 10분 단위 슬롯으로 분할되어 저장됩니다.
   */
  const handleDirectInput = () => {
    if (readOnly) return;

    const startTime = directInput.startTime;
    const endTime = directInput.endTime;
    const priority = directInput.priority;

    // 시간 유효성 검사
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (endMinutes <= startMinutes) {
      alert('종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }

    // 특정 날짜의 예외 일정으로 추가 (기본 스케줄이 아님)
    if (setExceptions) {
      const exceptions_to_add = [];

      // 10분 단위로 슬롯 생성
      for (let minutes = startMinutes; minutes < endMinutes; minutes += 10) {
        const slotHour = Math.floor(minutes / 60);
        const slotMin = minutes % 60;
        const slotStartTime = `${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`;

        const nextMinutes = minutes + 10;
        const nextHour = Math.floor(nextMinutes / 60);
        const nextMin = nextMinutes % 60;
        const slotEndTime = `${String(nextHour).padStart(2, '0')}:${String(nextMin).padStart(2, '0')}`;

        // 로컬 날짜로 정확하게 생성
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const day = selectedDate.getDate();

        const startDateTime = new Date(year, month, day, slotHour, slotMin, 0);
        const endDateTime = new Date(year, month, day, nextHour, nextMin, 0);

        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        const newException = {
          _id: Date.now().toString() + Math.random(),
          title: '일정',
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          priority: priority,
          specificDate: dateStr
        };


        exceptions_to_add.push(newException);
      }

      setExceptions([...exceptions, ...exceptions_to_add]);
      setHasUnsavedChanges(true);

      // 복사 옵션이 선택된 경우에만 추가 날짜에 적용
      if (copyOptions.copyType !== 'none') {
        exceptions_to_add.forEach(exc => applyCopyOptions(exc));
      }

      // 편집 모드가 아닐 때만 자동 저장 실행
      if (onSave && readOnly) {
        setTimeout(async () => {
          try {
            await onSave();
            setHasUnsavedChanges(false);
          } catch (error) {
          }
        }, 200);
      }

      // 강제 리렌더링
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 10);

      setShowDirectInput(false);
      // 시간은 초기화하고 우선순위는 보통(2)으로 재설정
      setDirectInput({
        startTime: '09:00',
        endTime: '10:00',
        priority: 2
      });
    }
  };

  const timeSlots = getCurrentTimeSlots();

  /**
   * renderMergedView - 병합된 시간표 뷰 렌더링
   * @description 연속된 동일한 타입의 시간 슬롯들을 하나의 블록으로 병합하여 시각적으로 깔끔하게 표시합니다.
   *              선호 시간이 아닌 모든 시간대는 '불가능한 시간'으로 표시됩니다.
   * @returns {JSX.Element} 병합된 뷰 UI
   */
  const renderMergedView = () => {
    const dayOfWeek = selectedDate.getDay();
    // 병합된 슬롯들과 개별 슬롯들을 모두 수집
    const displaySlots = [];

    // 병합된 기본 스케줄 추가
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const filteredSchedule = mergedSchedule.filter(slot => {
      // specificDate가 있으면 날짜 비교
      if (slot.specificDate) {
        return slot.specificDate === dateStr;
      }
      // specificDate가 없으면 dayOfWeek 비교
      return slot.dayOfWeek === dayOfWeek;
    });

    filteredSchedule.forEach(slot => {
      displaySlots.push({
        type: 'schedule',
        startTime: slot.startTime,
        endTime: slot.endTime,
        priority: slot.priority,
        isMerged: slot.isMerged,
        data: slot
      });
    });

    // 예외 일정들도 추가 (병합 처리를 위해 10분 단위로 분할)
    const exceptionSlots = [];

    exceptions.forEach(ex => {
      // 유효하지 않은 데이터 필터링
      if (!ex || !ex.specificDate || !ex.startTime || !ex.endTime) {
        return;
      }

      // 날짜 비교 (specificDate 사용)
      if (ex.specificDate === dateStr) {
        // startTime과 endTime을 올바른 형식으로 변환
        let startTime, endTimeStr;

        if (ex.startTime.includes('T')) {
          // ISO 형식인 경우
          const startDate = new Date(ex.startTime);
          const endDate = new Date(ex.endTime);
          startTime = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
          endTimeStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
        } else {
          // 이미 "HH:MM" 형식인 경우
          startTime = ex.startTime;
          endTimeStr = ex.endTime;
        }

        // 예외 일정을 10분 단위로 분할하여 병합 대상으로 만들기
        const startMinutes = timeToMinutes(startTime);
        const endMinutes = timeToMinutes(endTimeStr);

        for (let minutes = startMinutes; minutes < endMinutes; minutes += 10) {
          const hour = Math.floor(minutes / 60);
          const minute = minutes % 60;
          const slotStartTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
          const slotEndTime = getNextTimeSlot(slotStartTime);

          const slotData = {
            startTime: slotStartTime,
            endTime: slotEndTime,
            priority: ex.priority || 3,
            dayOfWeek: selectedDate.getDay(),
            title: ex.title,
            isException: true
          };

          exceptionSlots.push(slotData);
        }
      }
    });

    // 예외 일정도 병합 처리
    const mergedExceptions = mergeConsecutiveTimeSlots(exceptionSlots);

    mergedExceptions.forEach(slot => {
      const displaySlot = {
        type: 'exception',
        startTime: slot.startTime,
        endTime: slot.endTime,
        data: slot,
        isMerged: slot.isMerged
      };
      displaySlots.push(displaySlot);
    });

    // 개인 시간을 먼저 수집 (자정 넘어가는 시간 처리)
    const dayOfWeekPersonal = selectedDate.getDay() === 0 ? 7 : selectedDate.getDay();

    // 선호시간(priority >= 2) + 개인시간이 설정된 시간 범위를 수집
    const preferredTimeRanges = [];
    filteredSchedule.forEach(slot => {
      if (slot.priority >= 2) {
        const startMinutes = timeToMinutes(slot.startTime);
        const endMinutes = timeToMinutes(slot.endTime);
        preferredTimeRanges.push({ start: startMinutes, end: endMinutes });
      }
    });
    mergedExceptions.forEach(slot => {
      if (slot.priority >= 2) {
        const startMinutes = timeToMinutes(slot.startTime);
        const endMinutes = timeToMinutes(slot.endTime);
        preferredTimeRanges.push({ start: startMinutes, end: endMinutes });
      }
    });

    // personalTimes도 선호시간으로 간주 (불가능한 시간으로 덮어씌워지지 않도록)
    personalTimes.forEach(pt => {
      let shouldInclude = false;

      if (pt.specificDate) {
        if (pt.specificDate === dateStr) {
          shouldInclude = true;
        }
      } else if (pt.isRecurring !== false && pt.days && pt.days.includes(dayOfWeekPersonal)) {
        shouldInclude = true;
      }

      if (shouldInclude) {
        const [startHour, startMin] = pt.startTime.split(':').map(Number);
        const [endHour, endMin] = pt.endTime.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        let endMinutes = endHour * 60 + endMin;

        // 자정 넘어가는 시간 처리
        if (endMinutes <= startMinutes) {
          endMinutes += 24 * 60;
          // 밤 부분
          preferredTimeRanges.push({ start: startMinutes, end: 24 * 60 });
          // 아침 부분
          preferredTimeRanges.push({ start: 0, end: endMinutes - 24 * 60 });
        } else {
          preferredTimeRanges.push({ start: startMinutes, end: endMinutes });
        }
      }
    });
    // 선호시간이 없으면(preferredTimeRanges가 비어있으면) 전체를 불가능한 시간으로 표시
    if (preferredTimeRanges.length === 0) {
      const fullDaySlot = {
        type: 'personal',
        startTime: `${String(timeRange.start).padStart(2, '0')}:00`,
        endTime: `${String(timeRange.end).padStart(2, '0')}:00`,
        data: { title: '불가능한 시간' }
      };
      displaySlots.push(fullDaySlot);
    }

    // 선호시간이 아닌 시간대를 개인시간처럼 표시 (00:00~23:50 전체 범위)
    const allDayMinutes = [];
    for (let minutes = timeRange.start * 60; minutes < timeRange.end * 60; minutes += 10) {
      allDayMinutes.push(minutes);
    }

    // 선호시간을 제외한 시간대 찾기
    const nonPreferredRanges = [];
    let currentRangeStart = null;

    for (const minutes of allDayMinutes) {
      const isPreferred = preferredTimeRanges.some(range =>
        minutes >= range.start && minutes < range.end
      );

      if (!isPreferred) {
        if (currentRangeStart === null) {
          currentRangeStart = minutes;
        }
      } else {
        if (currentRangeStart !== null) {
          nonPreferredRanges.push({ start: currentRangeStart, end: minutes });
          currentRangeStart = null;
        }
      }
    }

    // 마지막 범위 처리
    if (currentRangeStart !== null) {
      nonPreferredRanges.push({ start: currentRangeStart, end: 24 * 60 });
    }

    // 선호시간이 아닌 시간대를 개인시간처럼 표시
    nonPreferredRanges.forEach(range => {
      const startHour = Math.floor(range.start / 60);
      const startMin = range.start % 60;
      const endHour = Math.floor(range.end / 60);
      const endMin = range.end % 60;

      const nonPreferredSlot = {
        type: 'personal',
        startTime: `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`,
        endTime: `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`,
        data: { title: '불가능한 시간' }
      };
      displaySlots.push(nonPreferredSlot);
    });

    // 개인 시간도 추가 (자정 넘어가는 시간 처리)
    let personalTimesAdded = 0;
    personalTimes.forEach(pt => {
      let shouldInclude = false;

      // specificDate가 있으면 날짜가 일치하는지만 체크
      if (pt.specificDate) {
        // specificDate는 이미 "YYYY-MM-DD" 형식이므로 직접 비교
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const day = String(selectedDate.getDate()).padStart(2, '0');
        const localDateStr = `${year}-${month}-${day}`;

        if (pt.specificDate === localDateStr) {
          shouldInclude = true;
        }
      }
      // specificDate가 없으면 반복되는 개인시간 체크
      else if (pt.isRecurring !== false && pt.days && pt.days.includes(dayOfWeekPersonal)) {
        shouldInclude = true;
      }

      if (shouldInclude) {
        personalTimesAdded++;
        const [startHour, startMin] = pt.startTime.split(':').map(Number);
        const [endHour, endMin] = pt.endTime.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;

        // 자정을 넘나드는 시간인지 확인 (예: 22:00 - 08:00)
        if (endMinutes <= startMinutes) {
          // 수면시간처럼 자정을 넘나드는 경우
          // 22:00-08:00를 22:00-23:50과 00:00-08:00으로 분할

          // 밤 부분 (예: 22:00-23:50)
          const nightSlot = {
            type: 'personal',
            startTime: pt.startTime,
            endTime: '23:50',
            data: { ...pt, title: pt.title }
          };
          displaySlots.push(nightSlot);

          // 아침 부분 (예: 00:00-08:00)
          const morningSlot = {
            type: 'personal',
            startTime: '00:00',
            endTime: pt.endTime,
            data: { ...pt, title: pt.title }
          };
          displaySlots.push(morningSlot);
        } else {
          // 일반적인 하루 내 시간 (학습시간 등)
          const normalSlot = {
            type: 'personal',
            startTime: pt.startTime,
            endTime: pt.endTime,
            data: pt
          };
          displaySlots.push(normalSlot);
        }
      }
    });
    // 시간순 정렬
    displaySlots.sort((a, b) => a.startTime.localeCompare(b.startTime));

    // 모든 시간 슬롯을 순회하면서 병합된 슬롯이나 빈 슬롯으로 분류
    const allSlots = [];
    const currentTimeSlots = getCurrentTimeSlots();
    const processedTimes = new Set();

    for (const timeSlot of currentTimeSlots) {
      if (processedTimes.has(timeSlot)) continue;

      let foundSlot = null;

      // 현재 시간 슬롯이 어떤 표시 슬롯에 포함되는지 확인
      for (const displaySlot of displaySlots) {
        const startMinutes = timeToMinutes(displaySlot.startTime);
        const endMinutes = timeToMinutes(displaySlot.endTime);
        const currentMinutes = timeToMinutes(timeSlot);

        if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
          foundSlot = displaySlot;
          break;
        }
      }

      if (foundSlot) {

        // 병합된 슬롯 추가
        allSlots.push({
          ...foundSlot,
          displayTime: timeSlot,
          duration: getTimeDifferenceInMinutes(foundSlot.startTime, foundSlot.endTime)
        });

        // 이 슬롯이 차지하는 모든 시간을 processed로 표시
        const startMinutes = timeToMinutes(foundSlot.startTime);
        const endMinutes = timeToMinutes(foundSlot.endTime);
        for (let minutes = startMinutes; minutes < endMinutes; minutes += 10) {
          const hour = Math.floor(minutes / 60);
          const minute = minutes % 60;
          const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
          processedTimes.add(time);
        }
      } else {
        // 빈 슬롯들을 연속으로 병합
        const emptyStartTime = timeSlot;
        let emptyEndTime = getNextTimeSlot(timeSlot);
        let duration = 10;

        // 다음 슬롯들도 빈 슬롯인지 확인하며 병합
        let nextTimeIndex = currentTimeSlots.indexOf(timeSlot) + 1;
        while (nextTimeIndex < currentTimeSlots.length) {
          const nextTime = currentTimeSlots[nextTimeIndex];
          if (processedTimes.has(nextTime)) break;

          // 다음 시간이 어떤 슬롯에 포함되는지 확인
          let nextIsEmpty = true;
          for (const displaySlot of displaySlots) {
            const startMinutes = timeToMinutes(displaySlot.startTime);
            const endMinutes = timeToMinutes(displaySlot.endTime);
            const nextMinutes = timeToMinutes(nextTime);

            if (nextMinutes >= startMinutes && nextMinutes < endMinutes) {
              nextIsEmpty = false;
              break;
            }
          }

          if (nextIsEmpty && emptyEndTime === nextTime) {
            emptyEndTime = getNextTimeSlot(nextTime);
            duration += 10;
            processedTimes.add(nextTime);
            nextTimeIndex++;
          } else {
            break;
          }
        }

        allSlots.push({
          type: 'empty',
          displayTime: emptyStartTime,
          startTime: emptyStartTime,
          endTime: emptyEndTime,
          duration: duration
        });
        processedTimes.add(timeSlot);
      }
    }

    return (
      <div className="grid grid-cols-7 gap-0">
        {/* 시간 컬럼 */}
        <div className="bg-gray-50 border-r border-gray-200">
          <div className="p-3 text-center font-semibold text-gray-700 border-b border-gray-200">
            시간
          </div>
          {allSlots.map((slot, index) => {
            const height = Math.max(20, (slot.duration / 10) * 12); // 10분당 12px (더욱 작게)

            return (
              <div
                key={index}
                className="text-center text-sm font-medium text-gray-600 border-b border-gray-100 flex items-center justify-center"
                style={{ height: `${height}px` }}
              >
                {slot.duration > 10 ? (
                  <div className="text-xs">
                    <div>{slot.startTime || slot.displayTime}</div>
                    <div className="text-gray-400">~</div>
                    <div>{slot.endTime || getNextTimeSlot(slot.displayTime)}</div>
                    {slot.type === 'empty' && (
                      <div className="text-gray-500 text-xs">({slot.duration}분)</div>
                    )}
                  </div>
                ) : (
                  slot.displayTime
                )}
              </div>
            );
          })}
        </div>

        {/* 시간 슬롯 컬럼 */}
        <div className="col-span-6">
          <div className="p-3 text-center font-semibold text-gray-700 border-b border-gray-200">
            {formatDate(selectedDate)}
          </div>
          {allSlots.map((slot, index) => {
            const height = Math.max(20, (slot.duration / 10) * 12); // 10분당 12px (더욱 작게)

            let slotClass = 'bg-gray-50 hover:bg-gray-100';
            let content = '';
            let title = '';

            if (slot.type === 'schedule') {
              const baseColor = priorityConfig[slot.priority]?.color || 'bg-blue-400';
              slotClass = slot.isMerged ? `${baseColor} border-2 border-green-400` : baseColor;
              content = slot.isMerged ?
                `${priorityConfig[slot.priority]?.label} (${slot.duration}분)` :
                priorityConfig[slot.priority]?.label;
              title = `${priorityConfig[slot.priority]?.label} - ${slot.startTime}~${slot.endTime}`;
            } else if (slot.type === 'exception') {
              if (slot.data.title === '휴무일' || slot.data.isHoliday) {
                slotClass = 'bg-gray-300 text-gray-600';
                content = '휴무일';
              } else {
                const exceptionPriority = slot.data.priority !== undefined ? slot.data.priority : 3;
                slotClass = priorityConfig[exceptionPriority]?.color || 'bg-blue-600';
                // priority 레이블 사용 (title 대신)
                content = `${priorityConfig[exceptionPriority]?.label} (${slot.duration}분)`;
              }
              title = slot.data.title;
            } else if (slot.type === 'personal') {
              slotClass = 'bg-red-300';
              content = `${slot.data.title} (${slot.duration}분)`;
              title = `개인시간: ${slot.data.title}`;
            } else if (slot.type === 'empty') {
              slotClass = 'bg-gray-50 hover:bg-gray-100';
              content = slot.duration > 10 ? `빈 시간 (${slot.duration}분)` : '';
              title = `빈 시간 - ${slot.startTime || slot.displayTime}~${slot.endTime || getNextTimeSlot(slot.displayTime)}`;
            }

            return (
              <div
                key={index}
                className={`border-b border-gray-100 flex items-center justify-center transition-colors cursor-pointer ${slotClass}`}
                style={{ height: `${height}px` }}
                onClick={() => {
                  if (slot.type === 'schedule' || slot.type === 'empty') {
                    handleSlotClick(slot.displayTime || slot.startTime);
                  }
                }}
                title={title || '클릭하여 선택'}
              >
                <span className={`font-medium text-sm text-center px-2 ${slot.type === 'empty' ? 'text-gray-700' : 'text-white'}`}>
                  {content}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /**
   * renderDetailedView - 분할된(상세) 시간표 뷰 렌더링
   * @description 모든 시간 슬롯을 10분 단위로 각각 표시합니다. 각 슬롯을 개별적으로 클릭하여 편집할 수 있습니다.
   * @returns {JSX.Element} 상세 뷰 UI
   */
  const renderDetailedView = () => {
    return (
      <div className="grid grid-cols-7 gap-0">
        {/* 시간 컬럼 */}
        <div className="bg-gray-50 border-r border-gray-200">
          <div className="p-3 text-center font-semibold text-gray-700 border-b border-gray-200">
            시간
          </div>
          {timeSlots.map(time => (
            <div
              key={time}
              className="p-2 text-center text-sm font-medium text-gray-600 border-b border-gray-100 h-6 flex items-center justify-center"
            >
              {time}
            </div>
          ))}
        </div>

        {/* 시간 슬롯 컬럼 */}
        <div className="col-span-6">
          <div className="p-3 text-center font-semibold text-gray-700 border-b border-gray-200">
            {formatDate(selectedDate)}
          </div>
          {timeSlots.map(time => {
            const slotInfo = getSlotInfo(time);
            const exception = getExceptionForSlot(time);
            const personalTime = getPersonalTimeForSlot(time);
            const isExceptionSlot = !!exception;
            const isPersonalTimeSlot = !!personalTime;

            let slotClass = 'bg-gray-50 hover:bg-gray-100';
            if (isExceptionSlot) {
              if (exception.title === '휴무일' || exception.isHoliday) {
                slotClass = 'bg-gray-300 text-gray-600';
              } else {
                const exceptionPriority = exception.priority !== undefined ? exception.priority : 3;
                slotClass = priorityConfig[exceptionPriority]?.color || 'bg-blue-600';
              }
            } else if (isPersonalTimeSlot) {
              slotClass = 'bg-red-300';
            } else if (slotInfo) {
              slotClass = priorityConfig[slotInfo.priority]?.color || 'bg-blue-400';
              if (slotInfo.isBlocked) {
                slotClass = 'bg-gray-400 text-gray-600';
              }
            }

            let cursorClass = 'cursor-pointer';
            if (isExceptionSlot && (exception.title === '휴무일' || exception.isHoliday)) {
              cursorClass = 'cursor-not-allowed';
            }

            return (
              <div
                key={time}
                className={`border-b border-gray-100 h-6 flex items-center justify-center transition-colors ${slotClass} ${cursorClass}`}
                onClick={() => {
                  if (isExceptionSlot && (exception.title === '휴무일' || exception.isHoliday)) {
                    return;
                  }
                  handleSlotClick(time);
                }}
                title={
                  isExceptionSlot
                    ? exception.title
                    : isPersonalTimeSlot
                    ? `개인시간: ${personalTime.title}`
                    : (slotInfo ? priorityConfig[slotInfo.priority]?.label : '클릭하여 선택')
                }
              >
                {isExceptionSlot && (exception.title === '휴무일' || exception.isHoliday) && (
                  <div className="flex items-center justify-center w-full h-full">
                    <span className="bg-gray-500 text-white px-2 py-1 rounded-full text-xs font-semibold shadow-sm">
                      휴무일
                    </span>
                  </div>
                )}
                {isExceptionSlot && exception.title !== '휴무일' && !exception.isHoliday && (
                  <span className="text-white font-medium text-xs">
                    {priorityConfig[exception.priority !== undefined ? exception.priority : 3]?.label || '일정'}
                  </span>
                )}
                {!isExceptionSlot && slotInfo && (
                  <span className="text-white font-medium text-xs">
                    {priorityConfig[slotInfo.priority]?.label}
                  </span>
                )}
                {isPersonalTimeSlot && !isExceptionSlot && (
                  <span className="text-white font-medium text-xs">개인</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-11/12 max-w-4xl max-h-[90vh] overflow-hidden">
        {/* 헤더 */}
        <div className="bg-white px-6 py-4 border-b border-gray-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {formatDate(selectedDate)} 세부 시간표
              </h3>
              {/* 뷰 옵션들을 헤더 아래로 이동 */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    if (timeRange.start === 0 && timeRange.end === 24) {
                      setTimeRange({ start: 9, end: 18 });
                    } else {
                      setTimeRange({ start: 0, end: 24 });
                    }
                  }}
                  className="px-3 py-1 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition-colors font-medium"
                >
                  {timeRange.start === 0 && timeRange.end === 24 ? '기본' : '24시간'}
                </button>
                <button
                  onClick={() => setShowMerged(!showMerged)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    showMerged
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-gray-500 text-white hover:bg-gray-600'
                  }`}
                >
                  {showMerged ? '분할' : '병합'}
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                // 편집 모드가 아닐 때만 저장하지 않은 변경사항을 초기 상태로 복원
                if (hasUnsavedChanges && setExceptions && readOnly) {
                  setExceptions([...initialExceptions]);
                }
                onClose();
              }}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {!readOnly && (
            <div className="space-y-4">
              {/* 시간대 추가 버튼들 */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-semibold text-blue-800">빠른 시간 추가</h4>
                  <div className="flex gap-2 relative">
                    <div className="relative" ref={copyOptionsRef}>
                      <button
                        onClick={() => setShowCopyOptions(!showCopyOptions)}
                        className={`px-3 py-1 rounded-lg text-xs transition-all font-medium ${
                          showCopyOptions
                            ? 'bg-purple-600 text-white hover:bg-purple-700'
                            : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        }`}
                      >
                        복사옵션
                      </button>

                      {showCopyOptions && (
                        <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                          {/* 말풍선 화살표 */}
                          <div className="absolute -top-2 right-4 w-4 h-4 bg-white border-l border-t border-gray-200 rotate-45"></div>

                          <div className="p-4">
                            <h4 className="text-sm font-semibold mb-3 text-gray-800">복사 옵션 설정</h4>
                            <div className="space-y-2">
                              <label className="flex items-center">
                                <input
                                  type="radio"
                                  name="copyType"
                                  value="none"
                                  checked={copyOptions.copyType === 'none'}
                                  onChange={(e) => setCopyOptions({...copyOptions, copyType: e.target.value})}
                                  className="mr-2"
                                />
                                <span className="text-sm">복사하지 않음 (현재 날짜만)</span>
                              </label>
                              <label className="flex items-center">
                                <input
                                  type="radio"
                                  name="copyType"
                                  value="nextWeek"
                                  checked={copyOptions.copyType === 'nextWeek'}
                                  onChange={(e) => setCopyOptions({...copyOptions, copyType: e.target.value})}
                                  className="mr-2"
                                />
                                <span className="text-sm">다음주 같은 요일에 복사</span>
                              </label>
                              <label className="flex items-center">
                                <input
                                  type="radio"
                                  name="copyType"
                                  value="prevWeek"
                                  checked={copyOptions.copyType === 'prevWeek'}
                                  onChange={(e) => setCopyOptions({...copyOptions, copyType: e.target.value})}
                                  className="mr-2"
                                />
                                <span className="text-sm">이전주 같은 요일에 복사</span>
                              </label>
                              <label className="flex items-center">
                                <input
                                  type="radio"
                                  name="copyType"
                                  value="wholeMonth"
                                  checked={copyOptions.copyType === 'wholeMonth'}
                                  onChange={(e) => setCopyOptions({...copyOptions, copyType: e.target.value})}
                                  className="mr-2"
                                />
                                <span className="text-sm">이번달 모든 같은 요일에 복사</span>
                              </label>
                              <label className="flex items-center">
                                <input
                                  type="radio"
                                  name="copyType"
                                  value="thisWholeWeek"
                                  checked={copyOptions.copyType === 'thisWholeWeek'}
                                  onChange={(e) => setCopyOptions({...copyOptions, copyType: e.target.value})}
                                  className="mr-2"
                                />
                                <span className="text-sm">이번 주 내내 적용</span>
                              </label>
                              <label className="flex items-center">
                                <input
                                  type="radio"
                                  name="copyType"
                                  value="nextWholeWeek"
                                  checked={copyOptions.copyType === 'nextWholeWeek'}
                                  onChange={(e) => setCopyOptions({...copyOptions, copyType: e.target.value})}
                                  className="mr-2"
                                />
                                <span className="text-sm">다음 주 내내 적용</span>
                              </label>
                            </div>
                            <p className="text-xs text-gray-600 mt-2">
                              선택한 옵션은 시간 추가 시 자동으로 적용됩니다.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={deleteEntireDay}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-xs hover:bg-red-200 transition-all font-medium"
                    >
                      전체삭제
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {/* 선호도 선택 */}
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-blue-700">선호도:</span>
                    <select
                      value={directInput.priority}
                      onChange={(e) => setDirectInput({ ...directInput, priority: Number(e.target.value) })}
                      className="px-2 py-1 border border-blue-300 rounded text-sm bg-white"
                    >
                      <option value={3}>선호</option>
                      <option value={2}>보통</option>
                      <option value={1}>조정 가능</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <button
                      onClick={() => addQuickTimeSlot(9, 12, directInput.priority)}
                      className={`px-4 py-2 rounded-lg text-sm transition-colors shadow-sm ${
                        hasExceptionInTimeRange(9, 12)
                          ? 'bg-red-500 text-white hover:bg-red-600'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      {hasExceptionInTimeRange(9, 12) ? '오전 제거' : '오전 (9-12시)'}
                    </button>
                    <button
                      onClick={() => addQuickTimeSlot(13, 17, directInput.priority)}
                      className={`px-4 py-2 rounded-lg text-sm transition-colors shadow-sm ${
                        hasExceptionInTimeRange(13, 17)
                          ? 'bg-red-500 text-white hover:bg-red-600'
                          : 'bg-green-500 text-white hover:bg-green-600'
                      }`}
                    >
                      {hasExceptionInTimeRange(13, 17) ? '오후 제거' : '오후 (13-17시)'}
                    </button>
                    <button
                      onClick={() => setShowDirectInput(!showDirectInput)}
                      className={`px-4 py-2 rounded-lg text-sm transition-all transform hover:scale-105 font-medium shadow-md ${
                        showDirectInput
                          ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                          : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                      }`}
                    >
                      직접입력
                    </button>
                    <button
                      onClick={() => addHolidayForDay()}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700 transition-all transform hover:scale-105 font-medium shadow-md"
                    >
                      휴무일
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}


          {showDirectInput && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="text-sm font-semibold mb-3 text-blue-800">직접 시간 입력</h4>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">시작 시간</label>
                  <input
                    type="time"
                    value={directInput.startTime}
                    onChange={(e) => setDirectInput({ ...directInput, startTime: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">종료 시간</label>
                  <input
                    type="time"
                    value={directInput.endTime}
                    onChange={(e) => setDirectInput({ ...directInput, endTime: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">선호도</label>
                  <select
                    value={directInput.priority}
                    onChange={(e) => setDirectInput({ ...directInput, priority: Number(e.target.value) })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value={3}>선호</option>
                    <option value={2}>보통</option>
                    <option value={1}>조정 가능</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleDirectInput}
                    className="w-full px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                  >
                    추가
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 범례 */}
        {!readOnly && (
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-center space-x-4 mb-2">
              <span className="text-sm font-semibold text-gray-700">범례:</span>
              {Object.entries(priorityConfig).filter(([priority]) => priority !== '0').sort(([p1], [p2]) => p2 - p1).map(([priority, {label, color}]) => (
                <div key={priority} className="flex items-center">
                  <div className={`w-4 h-4 rounded-full ${color} mr-2`}></div>
                  <span className="text-sm text-gray-600">{label}</span>
                </div>
              ))}
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-gray-300 mr-2"></div>
                <span className="text-sm text-gray-600">휴무일</span>
              </div>
            </div>
            {showMerged && (
              <div className="flex items-center justify-center space-x-4 border-t pt-2">
                <div className="flex items-center">
                  <div className="w-4 h-4 rounded-full bg-blue-400 border-2 border-green-400 mr-2"></div>
                  <span className="text-sm text-gray-600">병합된 시간대</span>
                </div>
                <div className="flex items-center">
                  <span className="text-xs text-white font-bold bg-green-600 px-2 py-1 rounded mr-2">30분</span>
                  <span className="text-sm text-gray-600">병합 지속시간</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 시간표 그리드 */}
        <div className="overflow-auto" style={{ maxHeight: '60vh' }}>
          {showMerged ? renderMergedView() : renderDetailedView()}
        </div>

        {/* 푸터 */}
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-t border-gray-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <p className="text-sm text-gray-600 font-medium">
              {readOnly
? "현재 설정된 시간표를 확인하고 있습니다."
: "시간 슬롯을 클릭하여 우선순위를 설정하세요. (선호 → 보통 → 조정 가능 → 해제)"
              }
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  // 편집 모드가 아닐 때만 저장하지 않은 변경사항을 초기 상태로 복원
                  if (hasUnsavedChanges && setExceptions && readOnly) {
                    setExceptions([...initialExceptions]);
                  }
                  onClose();
                }}
                className="px-5 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-all duration-200 shadow-md hover:shadow-lg font-medium"
              >
닫기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailTimeGrid;
