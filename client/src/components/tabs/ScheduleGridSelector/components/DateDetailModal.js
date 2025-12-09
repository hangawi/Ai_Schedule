/**
 * ===================================================================================================
 * DateDetailModal.js - 날짜 상세 모달 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/ScheduleGridSelector/components
 *
 * 🎯 주요 기능:
 *    - 특정 날짜의 세부 시간표를 모달로 표시
 *    - 병합 모드: 연속된 시간 블록으로 표시 (빈 시간/불가능 시간 구분)
 *    - 분할 모드: 10분 단위 세부 시간표
 *    - 예외 일정 > 개인 시간 > 반복 일정 우선순위
 *    - 24시간 모드 토글 (기본 9-18시 / 24시간)
 *    - 병합/분할 모드 토글
 *
 * 🔗 연결된 파일:
 *    - ../index.js - 날짜 클릭 시 이 모달 오픈
 *    - ../components/MonthView.js - 달력에서 날짜 클릭 시 사용
 *    - ../utils/timeUtils.js - timeToMinutes 함수 사용
 *    - ../constants/scheduleConstants.js - PRIORITY_CONFIG 상수 사용
 *
 * 💡 UI 위치:
 *    - 탭: 프로필 탭
 *    - 섹션: 스케줄 그리드 > 날짜 클릭 시 모달
 *    - 경로: 앱 실행 > 프로필 탭 > 스케줄 그리드 > 날짜 클릭
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 날짜 상세 모달의 UI와 병합 로직이 변경됨
 *    - 병합 조건 변경: getBlocksForDay 함수 수정
 *    - 불가능 시간 판단 변경: hasPreferredTime 함수 수정
 *    - 색상 변경: tailwindToHex 매핑 수정
 *
 * 📝 참고사항:
 *    - 병합 모드: 연속된 같은 이벤트를 하나의 블록으로 병합
 *    - 분할 모드: 10분 단위로 각 시간 슬롯 표시
 *    - 불가능 시간: priority < 2인 시간 (빨간색 표시)
 *    - 빈 시간: 이벤트 없고 priority >= 2 (회색 표시)
 *    - 우선순위: exception > personal > schedule
 *
 * ===================================================================================================
 */

import React from 'react';
import { X } from 'lucide-react';
import { timeToMinutes } from '../utils/timeUtils';
import { PRIORITY_CONFIG } from '../constants/scheduleConstants';

/**
 * DateDetailModal - 날짜 상세 모달 컴포넌트
 *
 * @description 특정 날짜의 세부 시간표를 병합/분할 모드로 표시하는 모달
 * @param {Object} props - 컴포넌트 props
 * @param {boolean} props.show - 모달 표시 여부
 * @param {Function} props.onClose - 모달 닫기 핸들러
 * @param {Object} props.selectedDate - 선택된 날짜 데이터
 * @param {Date} props.selectedDate.date - 날짜 객체
 * @param {number} props.selectedDate.dayOfWeek - 요일 (0=일, 1=월, ..., 6=토)
 * @param {Array} props.allPersonalTimes - 개인 시간 배열 (personalTimes + fixedSchedules)
 * @param {Array} props.schedule - 기본 일정 (선호 시간, 반복 일정)
 * @param {Array} props.exceptions - 특정 날짜 예외 일정
 * @param {Function} props.getCurrentTimeSlots - 현재 시간 슬롯 배열 반환 함수
 * @param {boolean} props.showFullDay - 24시간 모드 여부
 * @param {Function} props.setShowFullDay - 24시간 모드 설정 함수
 * @param {boolean} props.showMerged - 병합 모드 여부
 * @param {Function} props.setShowMerged - 병합 모드 설정 함수
 * @param {Object} props.priorityConfig - 우선순위 설정 객체 (색상 및 레이블)
 * @returns {JSX.Element|null} 모달 UI 또는 null
 *
 * @example
 * <DateDetailModal
 *   show={showDateDetail}
 *   onClose={closeDateDetail}
 *   selectedDate={selectedDate}
 *   allPersonalTimes={allPersonalTimes}
 *   schedule={schedule}
 *   exceptions={exceptions}
 *   getCurrentTimeSlots={getCurrentTimeSlots}
 *   showFullDay={showFullDay}
 *   setShowFullDay={setShowFullDay}
 *   showMerged={showMerged}
 *   setShowMerged={setShowMerged}
 *   priorityConfig={PRIORITY_CONFIG}
 * />
 *
 * @note
 * - 병합 모드: 연속된 시간 블록으로 표시 (빈 시간/불가능 시간 포함)
 * - 분할 모드: 10분 단위 세부 시간표
 * - 우선순위: exception > personal > schedule
 * - 불가능 시간: priority < 2 (빨간색)
 * - 빈 시간: 이벤트 없고 priority >= 2 (회색)
 */
const DateDetailModal = ({
  show,
  onClose,
  selectedDate,
  allPersonalTimes,
  schedule,
  exceptions,
  getCurrentTimeSlots,
  showFullDay,
  setShowFullDay,
  showMerged,
  setShowMerged,
  priorityConfig
}) => {
  if (!show || !selectedDate) return null;

  const dayData = selectedDate;
  const timeSlots = getCurrentTimeSlots();
  const dateStr = `${dayData.date.getFullYear()}-${String(dayData.date.getMonth() + 1).padStart(2, '0')}-${String(dayData.date.getDate()).padStart(2, '0')}`;

  /**
   * getBlocksForDay - 특정 날짜의 시간 블록 생성 (병합 모드용)
   *
   * @description 시간 슬롯별 이벤트를 할당하고 연속된 블록을 병합
   * @param {Date} date - 날짜 객체
   * @param {number} dayOfWeek - 요일 (0=일, 1=월, ..., 6=토)
   * @returns {Array} 병합된 시간 블록 배열
   *
   * @process
   * 1. 각 시간 슬롯에 이벤트 할당 (exception > personal > schedule 우선순위)
   * 2. 중복 이벤트 제거 (type + title + priority 기준)
   * 3. 연속된 같은 이벤트 세트를 하나의 블록으로 병합
   * 4. 빈 시간도 연속되면 병합
   * 5. 각 블록의 endTime 계산
   *
   * @returns {Array<Object>} 블록 배열
   * @returns {string} block.type - 블록 타입 ('empty' | 'schedule' | 'exception' | 'personal' | 'multiple')
   * @returns {string} block.startTime - 시작 시간 (HH:MM)
   * @returns {string} block.endTime - 종료 시간 (HH:MM)
   * @returns {number} block.duration - 지속 시간 (분)
   * @returns {Array} block.events - 이벤트 배열 (multiple일 경우)
   *
   * @note
   * - slotMap: 각 시간 슬롯에 할당된 이벤트 배열
   * - 중복 제거: `${type}_${title}_${priority}` key 사용
   * - 병합 조건: 같은 이벤트 세트 && 시간 연속
   * - 자정 넘김 처리: 1440 → 0 연속성 확인
   */
  const getBlocksForDay = (date, dayOfWeek) => {
    const allPossibleSlots = timeSlots;
    const slotMap = new Map();

    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    /**
     * 각 시간 슬롯에 이벤트 할당
     *
     * @description 우선순위에 따라 각 시간 슬롯에 이벤트 할당
     *
     * @priority
     * 1. exceptionSlot (예외 일정) - 가장 높은 우선순위
     * 2. personalSlots (개인 시간) - 두 번째 우선순위, 수면시간 필터링
     * 3. scheduleSlot (반복 일정) - 가장 낮은 우선순위
     *
     * @note
     * - exception: specificDate 일치 && 시간 범위 내 (ISO 또는 HH:MM)
     * - personal: days 배열로 요일 확인 또는 specificDate 확인, 자정 넘김 처리
     * - schedule: dayOfWeek 일치 && 시간 범위 내
     * - 수면시간 필터링: title에 '수면' 포함 또는 22:00 이후 시작 (기본 모드만)
     */
    // 각 시간 슬롯에 해당하는 이벤트 할당
    allPossibleSlots.forEach(time => {
      const timeMinutes = timeToMinutes(time);
      let assignedEvents = [];

      // 예외 일정 우선 확인
      const exceptionSlot = exceptions.find(e => {
        if (e.specificDate !== dateStr) return false;

        let startMins, endMins;

        if (e.startTime && e.startTime.includes('T')) {
          const startDate = new Date(e.startTime);
          const endDate = new Date(e.endTime);
          startMins = startDate.getHours() * 60 + startDate.getMinutes();
          endMins = endDate.getHours() * 60 + endDate.getMinutes();
        } else if (e.startTime && e.startTime.includes(':')) {
          startMins = timeToMinutes(e.startTime);
          endMins = timeToMinutes(e.endTime);
        } else {
          return false;
        }

        return timeMinutes >= startMins && timeMinutes < endMins;
      });

      if (exceptionSlot) {
        assignedEvents.push({ ...exceptionSlot, type: 'exception' });
      } else {
        // 개인 시간 확인
        const personalSlots = allPersonalTimes.filter(p => {
          const personalDays = p.days || [];

          if (p.specificDate && p.isRecurring === false) {
            const dateObj = new Date(p.specificDate);
            const dateDay = dateObj.getDay();

            if (dateDay !== dayOfWeek) return false;

            const startMinutes = timeToMinutes(p.startTime);
            const endMinutes = timeToMinutes(p.endTime);

            if (endMinutes <= startMinutes) {
              return timeMinutes >= startMinutes || timeMinutes < endMinutes;
            } else {
              return timeMinutes >= startMinutes && timeMinutes < endMinutes;
            }
          }

          if (p.isRecurring !== false && personalDays.length > 0) {
            const convertedDays = personalDays.map(day => day === 7 ? 0 : day);

            if (convertedDays.includes(dayOfWeek)) {
              const startMinutes = timeToMinutes(p.startTime);
              const endMinutes = timeToMinutes(p.endTime);

              if (endMinutes <= startMinutes) {
                if (timeMinutes >= startMinutes || timeMinutes < endMinutes) {
                  return true;
                }
              } else {
                if (timeMinutes >= startMinutes && timeMinutes < endMinutes) {
                  return true;
                }
              }
            }
          }

          return false;
        });

        // 수면시간 필터링
        const filteredPersonalSlots = personalSlots.filter(p => {
          if (showFullDay) return true;

          const isSleepTime = p.title?.includes('수면') ||
                             p.name?.includes('수면') ||
                             (p.startTime && timeToMinutes(p.startTime) >= 22 * 60);

          return !isSleepTime;
        });

        if (filteredPersonalSlots.length > 0) {
          assignedEvents.push(...filteredPersonalSlots.map(p => ({ ...p, type: 'personal' })));
        } else {
          // 기본 일정 확인
          const scheduleSlot = schedule.find(s => {
            if (s.dayOfWeek !== dayOfWeek) return false;
            const startMinutes = timeToMinutes(s.startTime);
            const endMinutes = timeToMinutes(s.endTime);
            return timeMinutes >= startMinutes && timeMinutes < endMinutes;
          });
          if (scheduleSlot) {
            assignedEvents.push({ ...scheduleSlot, type: 'schedule' });
          }
        }
      }

      slotMap.set(time, assignedEvents);
    });

    /**
     * 연속된 블록 병합
     *
     * @description 같은 이벤트 세트가 연속되면 하나의 블록으로 병합
     *
     * @process
     * 1. 각 시간 슬롯의 이벤트 가져오기
     * 2. 중복 이벤트 제거 (type + title + priority 기준)
     * 3. 빈 시간이면 empty 블록으로 병합
     * 4. 이벤트 있으면 같은 이벤트 세트인지 확인
     * 5. 시간 연속성 확인 (자정 넘김 처리)
     * 6. 같은 이벤트 && 연속되면 duration +10
     * 7. 다르면 새 블록 시작
     *
     * @note
     * - 중복 제거 key: `${type}_${title}_${priority}`
     * - 이벤트 세트 비교: 모든 이벤트의 key를 정렬하여 비교
     * - 시간 연속성: prevEndMins === currentStartMins 또는 1440 → 0
     * - 블록 타입: empty, schedule, exception, personal, multiple (2개 이상)
     */
    // 연속된 블록들 병합
    const blocks = [];
    let currentBlock = null;

    allPossibleSlots.forEach(time => {
      let events = slotMap.get(time) || [];

      // 중복 이벤트 제거
      const uniqueEvents = [];
      const seenKeys = new Set();
      events.forEach(e => {
        const key = `${e.type}_${e.title || e.subjectName || e.academyName || ''}_${e.priority || ''}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          uniqueEvents.push(e);
        }
      });
      events = uniqueEvents;

      if (!events || events.length === 0) {
        // 빈 시간
        if (currentBlock && currentBlock.type === 'empty') {
          currentBlock.duration += 10;
        } else {
          if (currentBlock) blocks.push(currentBlock);
          currentBlock = {
            type: 'empty',
            startTime: time,
            duration: 10
          };
        }
      } else {
        // 이벤트가 있는 시간
        const isSameEventSet = currentBlock && currentBlock.events &&
                              currentBlock.events.length === events.length &&
                              (() => {
                                const getEventKey = (e) => {
                                  const title = e.title || e.subjectName || e.academyName || '';
                                  const type = e.type || 'unknown';
                                  const priority = e.priority || '';
                                  return `${type}_${title}_${priority}`;
                                };
                                const currentKeys = currentBlock.events.map(getEventKey).sort().join('|');
                                const newKeys = events.map(getEventKey).sort().join('|');
                                return currentKeys === newKeys;
                              })();

        // 시간 연속성 확인
        const isTimeConsecutive = (() => {
          if (!currentBlock) return false;

          const prevSlotEndMins = timeToMinutes(currentBlock.startTime) + currentBlock.duration;
          const currentSlotStartMins = timeToMinutes(time);

          if (prevSlotEndMins === currentSlotStartMins) {
            return true;
          }

          // 자정을 넘는 경우
          if (prevSlotEndMins === 1440 && currentSlotStartMins === 0) {
            return true;
          }

          return false;
        })();

        if (isSameEventSet && isTimeConsecutive) {
          currentBlock.duration += 10;
        } else {
          if (currentBlock) {
            blocks.push(currentBlock);
          }

          const baseBlock = {
            type: events.length > 1 ? 'multiple' : events[0].type,
            events: events,
            startTime: time,
            duration: 10
          };

          if (events.length === 1) {
            const evt = events[0];
            if (evt.title) baseBlock.title = evt.title;
            if (evt.subjectName) baseBlock.subjectName = evt.subjectName;
            if (evt.academyName) baseBlock.academyName = evt.academyName;
            if (evt.priority !== undefined) baseBlock.priority = evt.priority;
            if (evt.color) baseBlock.color = evt.color;
            if (evt.dayOfWeek !== undefined) baseBlock.dayOfWeek = evt.dayOfWeek;
          }

          currentBlock = baseBlock;
        }
      }
    });

    if (currentBlock) {
      blocks.push(currentBlock);
    }

    // 각 블록의 endTime 계산
    blocks.forEach(block => {
      const startMinutes = timeToMinutes(block.startTime);
      const endMinutes = startMinutes + block.duration;
      const endHour = Math.floor(endMinutes / 60) % 24;
      const endMin = endMinutes % 60;
      block.endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
    });

    return blocks;
  };

  /**
   * hasPreferredTime - 선호시간 체크 헬퍼 함수
   *
   * @description 특정 시간이 선호시간(priority >= 2)인지 확인
   * @param {number} dayOfWeek - 요일 (0=일, 1=월, ..., 6=토)
   * @param {string} time - 시간 (HH:MM)
   * @param {string} dateStr - 날짜 문자열 (YYYY-MM-DD)
   * @returns {boolean} 선호시간 여부
   *
   * @process
   * 1. exceptions에서 해당 날짜 && priority >= 2 확인
   * 2. 없으면 schedule에서 해당 요일 && priority >= 2 확인
   *
   * @note
   * - priority >= 2: 보통/선호 시간 (빈 시간으로 표시)
   * - priority < 2: 조정 가능 시간 (불가능 시간으로 표시)
   * - exception 우선, 없으면 schedule 확인
   * - ISO 형식 또는 HH:MM 형식 모두 지원
   */
  const hasPreferredTime = (dayOfWeek, time, dateStr) => {
    const timeMinutes = timeToMinutes(time);

    // 예외 일정 확인
    const exceptionSlot = exceptions.find(e => {
      if (e.specificDate !== dateStr) return false;
      if (!e.priority || e.priority < 2) return false;

      let startMins, endMins;
      if (e.startTime && e.startTime.includes('T')) {
        const startDate = new Date(e.startTime);
        const endDate = new Date(e.endTime);
        startMins = startDate.getHours() * 60 + startDate.getMinutes();
        endMins = endDate.getHours() * 60 + endDate.getMinutes();
      } else if (e.startTime && e.startTime.includes(':')) {
        startMins = timeToMinutes(e.startTime);
        endMins = timeToMinutes(e.endTime);
      } else {
        return false;
      }

      return timeMinutes >= startMins && timeMinutes < endMins;
    });

    if (exceptionSlot) return true;

    // 반복 일정에서 선호시간 확인
    const preferredSlot = schedule.find(s => {
      if (s.dayOfWeek !== dayOfWeek) return false;
      if (!s.priority || s.priority < 2) return false;
      const startMinutes = timeToMinutes(s.startTime);
      const endMinutes = timeToMinutes(s.endTime);
      return timeMinutes >= startMinutes && timeMinutes < endMinutes;
    });

    return !!preferredSlot;
  };

  // 병합 모드일 때 실시간으로 blocks 생성
  const dayBlocks = showMerged ? getBlocksForDay(dayData.date, dayData.dayOfWeek) : null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden">
        {/* 헤더 */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-bold text-gray-800">
            {dayData.date.getMonth() + 1}월 {dayData.date.getDate()}일 ({['일', '월', '화', '수', '목', '금', '토'][dayData.date.getDay()]}) 시간표
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFullDay(!showFullDay)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                showFullDay
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {showFullDay ? '24시간' : '기본'}
            </button>
            <button
              onClick={() => setShowMerged(!showMerged)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                showMerged
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {showMerged ? '병합' : '분할'}
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 80px)' }}>
          {showMerged ? (
            /**
             * 병합 모드 렌더링
             *
             * @description 연속된 시간 블록으로 표시
             *
             * @block_types
             * - schedule: priority 색상, 레이블 표시
             * - exception: priority 색상, 제목 표시
             * - personal: 개인 색상 + CC (투명도), 제목 표시
             * - empty: 빈 시간 (회색) 또는 불가능 시간 (빨간색)
             *
             * @note
             * - hasPreferredTime으로 빈 시간 vs 불가능 시간 구분
             * - 수면시간: '수면', '睡眠', 'sleep' 포함 확인
             * - hex 색상: style로 적용, Tailwind 클래스: className으로 적용
             * - duration 표시: 시간 + 분 (예: 1시간 30분)
             */
            // 병합 모드: 블록 형태로 표시
            <div className="space-y-2">
              {!dayBlocks || dayBlocks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  표시할 일정이 없습니다.
                </div>
              ) : dayBlocks.map((block, index) => {
                let bgColor = 'bg-gray-50';
                let textColor = 'text-gray-500';
                let content = '';

                if (block.type === 'schedule') {
                  bgColor = priorityConfig[block.priority]?.color || 'bg-blue-400';
                  textColor = 'text-white';
                  content = `${priorityConfig[block.priority]?.label} (${block.duration}분)`;
                } else if (block.type === 'exception') {
                  bgColor = priorityConfig[block.priority]?.color || 'bg-blue-600';
                  textColor = 'text-white';
                  content = `${block.title} (${block.duration}분)`;
                } else if (block.type === 'personal') {
                  const title = block.title || block.subjectName || block.academyName || '개인일정';
                  const isSleepTime = title.includes('수면') || title.includes('睡眠') || title.toLowerCase().includes('sleep');

                  const tailwindToHex = {
                    'bg-purple-100': '#e9d5ff', 'bg-purple-200': '#ddd6fe', 'bg-purple-300': '#c4b5fd',
                    'bg-purple-400': '#a78bfa', 'bg-purple-500': '#8b5cf6', 'bg-purple-600': '#7c3aed'
                  };
                  let rawColor = block.color || '#8b5cf6';
                  const personalColor = tailwindToHex[rawColor] || rawColor;
                  bgColor = personalColor + 'CC';
                  textColor = 'text-black';
                  content = `${isSleepTime ? '수면시간' : title} (${block.duration}분)`;
                } else {
                  // 빈 시간
                  const isPreferred = hasPreferredTime(dayData.dayOfWeek, block.startTime, dateStr);
                  if (!isPreferred) {
                    bgColor = 'bg-red-200';
                    textColor = 'text-red-900';
                    content = `불가능 시간 (${block.duration}분)`;
                  } else {
                    bgColor = 'bg-gray-50';
                    textColor = 'text-gray-500';
                    content = `빈 시간 (${block.duration}분)`;
                  }
                }

                const isHexColor = typeof bgColor === 'string' && bgColor.startsWith('#');

                return (
                  <div
                    key={index}
                    className={`p-3 rounded-lg ${isHexColor ? '' : bgColor}`}
                    style={isHexColor ? { backgroundColor: bgColor } : {}}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className={`text-sm font-medium ${textColor}`}>
                        {block.startTime}~{block.endTime}
                      </span>
                      <span className={`text-xs ${textColor}`}>
                        {Math.floor(block.duration / 60) > 0 && `${Math.floor(block.duration / 60)}시간 `}
                        {block.duration % 60 > 0 && `${block.duration % 60}분`}
                      </span>
                    </div>
                    <div className={`text-sm mt-1 ${textColor}`}>
                      {content}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /**
             * 분할 모드 렌더링
             *
             * @description 10분 단위 세부 시간표
             *
             * @priority
             * - exceptionSlot: priority 색상, 제목 표시
             * - personalSlots: 개인 색상 + CC, 제목 표시 (여러 개면 나란히 배치)
             * - recurringSlot: priority 색상, 레이블 표시
             * - 빈 시간: hasPreferredTime으로 구분 (불가능/빈 시간)
             *
             * @note
             * - hasMultiple: personalSlots가 2개 이상일 때 true
             * - 여러 개 일정: flex로 나란히 배치
             * - 수면시간: '수면', '睡眠', 'sleep' 포함 확인
             * - hex 색상: style로 적용, Tailwind 클래스: className으로 적용
             */
            // 일반 모드: 10분 단위 세부 시간표
            <div className="space-y-1">
              {timeSlots.map(time => {
                const timeMinutes = timeToMinutes(time);

                const recurringSlot = schedule.find(s => s.dayOfWeek === dayData.dayOfWeek && s.startTime === time);

                const exceptionSlot = exceptions.find(e => {
                  if (e.specificDate !== dateStr) return false;

                  let startMins, endMins;

                  if (e.startTime && e.startTime.includes('T')) {
                    const startDate = new Date(e.startTime);
                    const endDate = new Date(e.endTime);
                    startMins = startDate.getHours() * 60 + startDate.getMinutes();
                    endMins = endDate.getHours() * 60 + endDate.getMinutes();
                  } else if (e.startTime && e.startTime.includes(':')) {
                    startMins = timeToMinutes(e.startTime);
                    endMins = timeToMinutes(e.endTime);
                  } else {
                    return false;
                  }

                  return timeMinutes >= startMins && timeMinutes < endMins;
                });

                const personalSlots = allPersonalTimes.filter(p => {
                  const personalDays = p.days || [];

                  if (p.specificDate && p.isRecurring === false) {
                    const dateObj = new Date(p.specificDate);
                    const dateDay = dateObj.getDay();

                    if (dateDay !== dayData.dayOfWeek) {
                      return false;
                    }

                    const startMinutes = timeToMinutes(p.startTime);
                    const endMinutes = timeToMinutes(p.endTime);

                    if (endMinutes <= startMinutes) {
                      return timeMinutes >= startMinutes || timeMinutes < endMinutes;
                    } else {
                      return timeMinutes >= startMinutes && timeMinutes < endMinutes;
                    }
                  }

                  if (p.isRecurring !== false && personalDays.length > 0) {
                    const convertedDays = personalDays.map(day => {
                      return day === 7 ? 0 : day;
                    });
                    if (convertedDays.includes(dayData.dayOfWeek)) {
                      const startMinutes = timeToMinutes(p.startTime);
                      const endMinutes = timeToMinutes(p.endTime);

                      if (endMinutes <= startMinutes) {
                        return timeMinutes >= startMinutes || timeMinutes < endMinutes;
                      } else {
                        return timeMinutes >= startMinutes && timeMinutes < endMinutes;
                      }
                    }
                  }
                  return false;
                });

                let bgColor = 'bg-white';
                let textColor = 'text-gray-900';
                let content = '빈 시간';
                let hasMultiple = false;

                if (exceptionSlot) {
                  bgColor = priorityConfig[exceptionSlot.priority]?.color || 'bg-blue-600';
                  textColor = 'text-white';
                  content = exceptionSlot.title;
                } else if (personalSlots.length > 0) {
                  const firstSlot = personalSlots[0];
                  const title = firstSlot.title || firstSlot.subjectName || firstSlot.academyName || '개인일정';
                  const isSleepTime = title.includes('수면') || title.includes('睡眠') || title.toLowerCase().includes('sleep');

                  const tailwindToHex = {
                    'bg-purple-100': '#e9d5ff', 'bg-purple-200': '#ddd6fe', 'bg-purple-300': '#c4b5fd',
                    'bg-purple-400': '#a78bfa', 'bg-purple-500': '#8b5cf6', 'bg-purple-600': '#7c3aed'
                  };
                  let rawColor = firstSlot.color || '#8b5cf6';
                  bgColor = (tailwindToHex[rawColor] || rawColor) + 'CC';
                  textColor = 'text-black';
                  content = isSleepTime ? '수면시간' : title;
                } else if (recurringSlot) {
                  bgColor = priorityConfig[recurringSlot.priority]?.color || 'bg-blue-400';
                  textColor = 'text-white';
                  content = priorityConfig[recurringSlot.priority]?.label;
                } else {
                  const isPreferred = hasPreferredTime(dayData.dayOfWeek, time, dateStr);
                  if (!isPreferred) {
                    bgColor = 'bg-red-200';
                    textColor = 'text-red-900';
                    content = '불가능';
                  }
                }

                const isHexColor = typeof bgColor === 'string' && bgColor.startsWith('#');

                return (
                  <div
                    key={time}
                    className={`flex items-center justify-between p-2 rounded ${!hasMultiple && !isHexColor ? bgColor : ''} ${bgColor === 'bg-white' ? 'border border-gray-200' : ''}`}
                    style={!hasMultiple && isHexColor ? { backgroundColor: bgColor } : {}}
                  >
                    <span className={`text-sm font-medium ${!hasMultiple ? textColor : 'text-gray-700'}`}>{time}</span>
                    {hasMultiple ? (
                      <div className="flex gap-1 flex-1 ml-2">
                        {personalSlots.map((p, idx) => {
                          const tailwindToHex = {
                            'bg-gray-100': '#f3f4f6', 'bg-gray-200': '#e5e7eb', 'bg-gray-300': '#d1d5db',
                            'bg-gray-400': '#9ca3af', 'bg-gray-500': '#6b7280', 'bg-gray-600': '#4b5563',
                            'bg-red-100': '#fee2e2', 'bg-red-200': '#fecaca', 'bg-red-300': '#fca5a5',
                            'bg-red-400': '#f87171', 'bg-red-500': '#ef4444', 'bg-red-600': '#dc2626',
                            'bg-orange-100': '#ffedd5', 'bg-orange-500': '#f97316', 'bg-orange-600': '#ea580c',
                            'bg-blue-100': '#dbeafe', 'bg-blue-400': '#60a5fa', 'bg-blue-600': '#2563eb'
                          };
                          let rawColor = p.color || '#8b5cf6';
                          const finalColor = (tailwindToHex[rawColor] || rawColor) + 'CC';

                          return (
                            <div
                              key={idx}
                              className="flex-1 text-xs px-2 py-1 rounded text-center"
                              style={{ backgroundColor: finalColor, color: '#000000' }}
                            >
                              {p.title || p.subjectName || p.academyName || '일정'}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className={`text-sm ${textColor}`}>{content}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DateDetailModal;
