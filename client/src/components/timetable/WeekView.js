/**
 * ===================================================================================================
 * WeekView.js - 타임테이블 주간 뷰 본문 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/timetable
 *
 * 🎯 주요 기능:
 *    - 시간대별, 요일별 타임 슬롯 그리드를 렌더링
 *    - '병합 모드'와 '일반 모드' 두 가지 뷰를 지원
 *    - 방장의 원본 시간표(개인시간, 예외, 선호시간)를 그리드에 시각적으로 통합
 *    - 이동 시간 슬롯(travelSlots)을 별도 레이어로 표시
 *    - 각 슬롯의 상태(배정됨, 차단됨, 선택됨, 빈 시간)를 계산하고 시각화
 *
 * 🔗 연결된 파일:
 *    - ./TimeSlot.js - 개별 시간 슬롯을 렌더링하는 데 사용
 *    - ./TimetableGrid.js - 이 컴포넌트를 사용하여 주간 그리드를 표시
 *    - ../../utils/dateUtils.js, ../../utils/timetableHelpers.js - 다양한 헬퍼 함수 사용
 *
 * 💡 UI 위치:
 *    - 탭: 조율 탭 (CoordinationTab)
 *    - 섹션: 타임테이블 그리드의 본문 (시간 행들)
 *
 * ✏️ 수정 가이드:
 *    - 슬롯 상태 결정 로직 변경: getMergedTimeBlocks 함수의 slotType 결정 로직 수정
 *    - 방장 원본 시간표 표시 방식 변경: getOwnerOriginalScheduleInfo 함수 수정
 *    - 병합 뷰 렌더링 방식 변경: renderMergedView 함수 내부의 JSX 및 스타일 수정
 *    - 일반 뷰 렌더링 방식 변경: renderNormalView 함수 내부의 JSX 및 TimeSlot props 수정
 *
 * 📝 참고사항:
 *    - showMerged prop에 따라 '병합 뷰' 또는 '일반 뷰'가 렌더링됩니다.
 *    - 병합 뷰는 연속된 동일 상태의 슬롯을 하나의 블록으로 묶어 시각적 편의성을 높입니다.
 *    - 방장이 아닌 사용자는 다른 멤버의 슬롯 내용을 볼 수 없으며 '배정됨'으로만 표시됩니다. (Visibility Control)
 *
 * ===================================================================================================
 */
import React, { useEffect } from 'react';
import TimeSlot from './TimeSlot';

const dayNamesKorean = ['월', '화', '수', '목', '금'];

// ScheduleGridSelector의 로직을 참고한 시간 변환 함수들
const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/**
 * WeekView - 타임테이블의 주간 그리드 본문을 렌더링하는 컴포넌트
 *
 * @description 시간과 요일에 따른 그리드를 생성하고, 각 슬롯의 상태(배정, 차단, 선택 등)를
 *              계산하여 TimeSlot 컴포넌트 또는 병합된 블록으로 시각화합니다.
 *
 * @component
 *
 * @param {Object} props - 컴포넌트 props
 * @param {Array<string>} props.filteredTimeSlotsInDay - 하루에 표시될 시간 슬롯 배열 (예: ["09:00", "09:10", ...])
 * @param {Array<Object>} props.weekDates - 표시할 주의 날짜 정보 배열 (월~금)
 * @param {Array<string>} props.days - 요일 이름 배열 (fallback용)
 * @param {Function} props.getSlotOwner - 특정 날짜와 시간의 슬롯 소유자 정보를 가져오는 함수
 * @param {Function} props.isSlotSelected - 특정 슬롯이 현재 사용자에 의해 선택되었는지 확인하는 함수
 * @param {Function} props.getBlockedTimeInfo - 차단된 시간 정보를 가져오는 함수
 * @param {Function} props.getRoomExceptionInfo - 방 전체 예외 정보를 가져오는 함수
 * @param {boolean} props.isRoomOwner - 현재 사용자가 방장인지 여부
 * @param {Object} props.currentUser - 현재 로그인한 사용자 정보
 * @param {Function} props.handleSlotClick - 슬롯 클릭 이벤트를 처리하는 핸들러 함수
 * @param {boolean} [props.showMerged=true] - 병합 모드 활성화 여부
 * @param {Object} props.ownerOriginalSchedule - 방장의 원본 시간표 데이터
 * @param {string} [props.travelMode='normal'] - 이동 모드 ('normal', 'travel' 등)
 * @param {Array} [props.travelSlots=[]] - 이동 시간 슬롯 데이터 배열
 * @param {number} [props.myTravelDuration=0] - 나의 이동 소요 시간 (분)
 *
 * @returns {JSX.Element} 주간 타임테이블 그리드 UI
 */
const WeekView = ({
  filteredTimeSlotsInDay,
  weekDates,
  days,
  getSlotOwner,
  isSlotSelected,
  getBlockedTimeInfo,
  getRoomExceptionInfo, // New prop
  isRoomOwner,
  currentUser,
  handleSlotClick,
  showMerged = true, // New prop for merged view
  ownerOriginalSchedule, // 방장의 원본 시간표 데이터
  travelMode = 'normal', // Add travelMode to props
  travelSlots = [], // 이동 시간 슬롯
  timeSlots = [], // 🆕 전체 배정된 수업 정보
  myTravelDuration = 0, // 🆕 나의 이동 소요 시간
  isConfirmed = false, // 🆕 확정 여부
  roomData = null // 🆕 룸 데이터 (members, blockedTimes 등)
}) => {

  useEffect(() => {
    // ownerOriginalSchedule 변경 감지
  }, [ownerOriginalSchedule]);

  // 방장의 원본 시간표에서 해당 시간대의 일정을 확인하는 함수
  const getOwnerOriginalScheduleInfo = (date, time) => {
    if (!ownerOriginalSchedule) return null;



    const timeMinutes = timeToMinutes(time);
    const dayOfWeek = date.getDay(); // 0=일요일, 1=월요일, ...
    const dateStr = date.toISOString().split('T')[0];

    // scheduleExceptions 확인 (특정 날짜 일정)
    const exceptionSlot = ownerOriginalSchedule.scheduleExceptions?.find(e => {
      if (e.specificDate !== dateStr) return false;

      const startDate = new Date(e.startTime);
      const endDate = new Date(e.endTime);
      const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
      const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();

      const isMatch = timeMinutes >= startMinutes && timeMinutes < endMinutes;
      return isMatch;
    });

    if (exceptionSlot) {
      return {
        ...exceptionSlot,
        type: 'exception',
        name: `${exceptionSlot.title || '일정'} (방장)`
      };
    }

    // personalTimes 확인 (특정 날짜 우선, 그 다음 반복 일정)
    const personalSlot = ownerOriginalSchedule.personalTimes?.find(p => {
      // 🔧 수정: specificDate가 있는 경우를 먼저 체크 (isRecurring 값과 무관하게)
      if (p.specificDate) {
        const specificDate = new Date(p.specificDate);
        const currentDate = new Date(dateStr);

        const isMatch = specificDate.toDateString() === currentDate.toDateString();
        
        // 날짜가 일치하는지 확인
        if (isMatch) {
          const startMinutes = timeToMinutes(p.startTime);
          const endMinutes = timeToMinutes(p.endTime);

          return timeMinutes >= startMinutes && timeMinutes < endMinutes;
        }
        // 날짜가 일치하지 않으면 이 항목은 무시
        return false;
      }

      // 반복되는 개인시간 처리 (specificDate가 없는 경우만)
      const personalDays = p.days || [];
      if (p.isRecurring !== false && personalDays.length > 0) {
        const convertedDays = personalDays.map(day => day === 7 ? 0 : day);
        if (convertedDays.includes(dayOfWeek)) {
          const startMinutes = timeToMinutes(p.startTime);
          const endMinutes = timeToMinutes(p.endTime);

          // 자정을 넘나드는 시간 처리
          if (endMinutes <= startMinutes) {
            return timeMinutes >= startMinutes || timeMinutes < endMinutes;
          } else {
            return timeMinutes >= startMinutes && timeMinutes < endMinutes;
          }
        }
      }

      return false;
    });

    if (personalSlot) {
      return {
        ...personalSlot,
        type: 'personal',
        name: `${personalSlot.title || '개인시간'} (방장)`
      };
    }

    // 개인시간과 예외일정이 없는 경우에만, 선호시간(priority >= 2) 체크
    // defaultSchedule에서 해당 요일의 선호시간 확인
    const hasPreferredTime = ownerOriginalSchedule.defaultSchedule?.some(sched => {
      if (sched.priority < 2) return false;

      // 🔧 수정: specificDate가 있으면 그 날짜에만 적용
      if (sched.specificDate) {
        if (sched.specificDate !== dateStr) return false;
      } else {
        // specificDate가 없으면 dayOfWeek로 체크 (반복 일정)
        if (sched.dayOfWeek !== dayOfWeek) return false;
      }

      const startMinutes = timeToMinutes(sched.startTime);
      const endMinutes = timeToMinutes(sched.endTime);

      const isInRange = timeMinutes >= startMinutes && timeMinutes < endMinutes;

      return isInRange;
    });

    // scheduleExceptions에서도 선호시간 확인 (priority >= 2)
    const hasPreferredExceptionTime = ownerOriginalSchedule.scheduleExceptions?.some(e => {
      if (e.specificDate !== dateStr || !e.priority || e.priority < 2) return false;

      const startDate = new Date(e.startTime);
      const endDate = new Date(e.endTime);
      const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
      const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();

      return timeMinutes >= startMinutes && timeMinutes < endMinutes;
    });

    // 선호시간도 없고 예외일정도 없고 개인시간도 없는 경우 → 불가능한 시간으로 표시
    if (!hasPreferredTime && !hasPreferredExceptionTime) {
      return {
        type: 'non_preferred',
        name: '다른 일정 (방장)',
        title: '다른 일정'
      };
    }

    // 선호시간이 있으면 null 반환 (빈 시간으로 표시)
    return null;
  };

  // 🆕 조원 본인의 선호시간 체크 함수 (문제 1 해결)
  const getCurrentUserScheduleInfo = (date, time) => {
    if (!currentUser || isRoomOwner) return null; // 방장은 체크하지 않음

    const timeMinutes = timeToMinutes(time);
    const dayOfWeek = date.getDay(); // 0=일요일, 1=월요일, ...
    const dateStr = date.toISOString().split('T')[0];

    // 1. scheduleExceptions 확인 (특정 날짜 일정)
    const exceptionSlot = currentUser.scheduleExceptions?.find(e => {
      if (e.specificDate !== dateStr) return false;

      const startDate = new Date(e.startTime);
      const endDate = new Date(e.endTime);
      const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
      const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();

      return timeMinutes >= startMinutes && timeMinutes < endMinutes;
    });

    if (exceptionSlot) {
      // 예외일정이 있으면 비선호시간으로 간주
      return {
        type: 'user_non_preferred',
        name: '배정 불가',
        title: '본인 다른 일정',
        reason: 'exception'
      };
    }

    // 2. personalTimes 확인 (개인시간 = 비선호시간)
    const personalSlot = currentUser.personalTimes?.find(p => {
      // specificDate가 있는 경우 먼저 체크
      if (p.specificDate) {
        const specificDate = new Date(p.specificDate);
        const currentDate = new Date(dateStr);

        if (specificDate.toDateString() === currentDate.toDateString()) {
          const startMinutes = timeToMinutes(p.startTime);
          const endMinutes = timeToMinutes(p.endTime);
          return timeMinutes >= startMinutes && timeMinutes < endMinutes;
        }
        return false;
      }

      // 반복되는 개인시간 처리
      const personalDays = p.days || [];
      if (p.isRecurring !== false && personalDays.length > 0) {
        const convertedDays = personalDays.map(day => day === 7 ? 0 : day);
        if (convertedDays.includes(dayOfWeek)) {
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

    if (personalSlot) {
      // 개인시간이 있으면 비선호시간으로 간주
      return {
        type: 'user_non_preferred',
        name: '배정 불가',
        title: '본인 개인시간',
        reason: 'personal'
      };
    }

    // 3. defaultSchedule 체크 (priority >= 2는 선호시간)
    const hasPreferredTime = currentUser.defaultSchedule?.some(sched => {
      if (sched.priority < 2) return false; // priority 2 이상만 선호시간

      if (sched.specificDate) {
        if (sched.specificDate !== dateStr) return false;
      } else {
        if (sched.dayOfWeek !== dayOfWeek) return false;
      }

      const startMinutes = timeToMinutes(sched.startTime);
      const endMinutes = timeToMinutes(sched.endTime);

      const isMatch = timeMinutes >= startMinutes && timeMinutes < endMinutes;

      if (isMatch) {
      }

      return isMatch;
    });

    // 선호시간이 없으면 비선호시간으로 간주
    if (!hasPreferredTime) {
      return {
        type: 'user_non_preferred',
        name: '배정 불가',
        title: '본인 비선호시간',
        reason: 'non_preferred'
      };
    }

    // 선호시간이면 null 반환 (가능한 시간)
    return null;
  };

  // 🆕 현재 시간에 현재 사용자의 수업이 있는지 확인하는 함수
  const hasScheduleAtTime = (date, time, timeSlots, currentUser) => {
    if (!date || !time || !currentUser || !timeSlots || timeSlots.length === 0) return false;

    const dateStr = date.toISOString().split('T')[0];
    const currentUserId = currentUser._id || currentUser.id;
    const timeMinutes = timeToMinutes(time);

    return timeSlots.some(slot => {
      const slotDate = slot.date ? new Date(slot.date).toISOString().split('T')[0] : null;
      const slotUserId = slot.user?._id || slot.user?.id || slot.user;
      const startMinutes = timeToMinutes(slot.startTime);
      const endMinutes = timeToMinutes(slot.endTime);

      return slotDate === dateStr &&
             slotUserId === currentUserId &&
             timeMinutes >= startMinutes &&
             timeMinutes < endMinutes;
    });
  };

  // 🆕 동적 이동시간 계산 함수
  const getDynamicTravelDuration = (date, currentTime, timeSlots, currentUser, myTravelDuration) => {
    if (!date || !currentTime || !currentUser || !timeSlots || timeSlots.length === 0 || !myTravelDuration) {
      return myTravelDuration || 0;
    }

    const dateStr = date.toISOString().split('T')[0];
    const currentUserId = currentUser._id || currentUser.id;
    const currentTimeMinutes = timeToMinutes(currentTime);

    // 🔧 같은 날짜의 모든 사용자 수업 필터링 (A, B 등 모두 포함)
    const sameDayClasses = timeSlots.filter(slot => {
      const slotDate = slot.date ? new Date(slot.date).toISOString().split('T')[0] : null;
      // ✅ 모든 사용자의 수업 포함 (이동시간 제외)
      return slotDate === dateStr && !slot.isTravel;
    });

    if (sameDayClasses.length === 0) {
      // 같은 날 수업이 없으면: 방장 → 현재 시간
      return myTravelDuration;
    }

    // 시간순 정렬
    sameDayClasses.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    // 현재 시간 이전의 가장 최근 수업 찾기
    let previousClass = null;
    for (const cls of sameDayClasses) {
      const classEndMinutes = timeToMinutes(cls.endTime);
      if (classEndMinutes <= currentTimeMinutes) {
        previousClass = cls;
      } else {
        break;
      }
    }

    if (previousClass) {
      const prevEndMinutes = timeToMinutes(previousClass.endTime);
      const prevUserId = previousClass.user?._id || previousClass.user?.id || previousClass.user;
      
      // 🔧 이전 수업이 다른 사용자의 것인지 확인
      if (prevUserId !== currentUserId) {
        // ✅ 다른 사용자 → 현재 시간: 최소 이동시간 (10분)
        return 10;
      } else {
        // ✅ 같은 사용자: 바로 연속된 수업인지 확인
        if (prevEndMinutes === currentTimeMinutes) {
          // 연속된 수업이면 이동 필요 없음 (이미 그 장소에 있음)
          return 0;
        } else {
          // 시간 간격이 있으면 방장 → 현재 시간 이동시간 사용
          return myTravelDuration;
        }
      }
    } else {
      // 이전 수업 없으면: 방장 → 현재 시간
      return myTravelDuration;
    }
  };


  // 🆕 [문제 2] 다른 조원 수업 뒤 이동시간 고려한 배정 불가 체크
  const getCannotPlaceAfterOtherMembers = (date, time) => {
    // 조건: 조원이고, 이동모드이고, 확정 전이어야 함
    if (isRoomOwner || travelMode === 'normal' || isConfirmed || !roomData) {
      return null;
    }

    const currentUserId = currentUser?._id || currentUser?.id;
    if (!currentUserId) return null;

    const dateStr = date.toISOString().split('T')[0];
    const currentTimeMinutes = timeToMinutes(time);

    // 1. 같은 날짜의 다른 조원 수업 찾기
    const otherMembersClasses = timeSlots.filter(slot => {
      const slotDate = slot.date ? new Date(slot.date).toISOString().split('T')[0] : null;
      const slotUserId = slot.user?._id || slot.user?.id || slot.user;
      
      return slotDate === dateStr && 
             !slot.isTravel && 
             slotUserId && 
             slotUserId.toString() !== currentUserId.toString();
    });

    if (otherMembersClasses.length === 0) {
      return null; // 다른 조원 수업 없음
    }

    // 2. 현재 시간 이전에 끝나는 수업 중 가장 최근 것 찾기
    let closestPreviousClass = null;
    let closestEndTime = -1;

    for (const cls of otherMembersClasses) {
      const classEndMinutes = timeToMinutes(cls.endTime);
      if (classEndMinutes <= currentTimeMinutes && classEndMinutes > closestEndTime) {
        closestPreviousClass = cls;
        closestEndTime = classEndMinutes;
      }
    }

    if (!closestPreviousClass) {
      return null; // 현재 시간 이전에 끝난 수업 없음
    }

    // 3. 이동시간 계산: 그 조원의 수업 위치 → 현재 사용자 수업 위치
    const otherMemberUserId = closestPreviousClass.user?._id || closestPreviousClass.user?.id || closestPreviousClass.user;
    const members = roomData.members || [];
    
    const otherMember = members.find(m => {
      const memberId = m.user?._id || m.user?.id || m.user;
      return memberId && memberId.toString() === otherMemberUserId.toString();
    });

    const currentMember = members.find(m => {
      const memberId = m.user?._id || m.user?.id || m.user;
      return memberId && memberId.toString() === currentUserId.toString();
    });

    if (!otherMember || !currentMember) {
      return null; // 멤버 정보 없음
    }

    // 이동시간 계산 (간단하게 10분 단위로 가정, 실제로는 더 정교한 계산 필요)
    // TODO: travelScheduleCalculator의 이동시간 계산 로직 재사용
    const travelTimeMinutes = 30; // 기본값 30분 (추후 정교화 필요)

    // 4. 종료시간 + 이동시간 > 현재 시간이면 배정 불가
    const requiredStartTime = closestEndTime + travelTimeMinutes;
    
    if (requiredStartTime > currentTimeMinutes) {
      return {
        type: 'cannot_place_after',
        name: '배정 불가',
        title: `다른 수업 종료 후 이동시간 부족`,
        previousClassEndTime: minutesToTime(closestEndTime),
        requiredStartTime: minutesToTime(requiredStartTime)
      };
    }

    // 5. 추가: 현재 시간에 수업 배치 시 금지시간 침범 체크
    const classDurationMinutes = 60; // 기본 수업 시간 (추후 정교화 필요)
    const classEndMinutes = currentTimeMinutes + classDurationMinutes;

    const blockedTimes = roomData.settings?.blockedTimes || [];
    
    for (const blocked of blockedTimes) {
      const blockedStartMinutes = timeToMinutes(blocked.startTime);
      const blockedEndMinutes = timeToMinutes(blocked.endTime);
      
      // 수업 시간이 금지시간과 겹치는지 확인
      if (currentTimeMinutes < blockedEndMinutes && classEndMinutes > blockedStartMinutes) {
        return {
          type: 'blocked_by_restriction',
          name: '배정 불가',
          title: `이 시간에 배치하면 금지시간(${blocked.startTime}-${blocked.endTime})을 침범합니다`,
          blockedTime: `${blocked.startTime}-${blocked.endTime}`
        };
      }
    }

    return null; // 배정 가능
  };

  // 연속된 시간대를 자동으로 병합하는 함수
  const getMergedTimeBlocks = (dateInfo, dayIndex) => {
    const date = dateInfo.fullDate;
    const blocks = [];
    let currentBlock = null;

    for (const time of filteredTimeSlotsInDay) {
      // 방장의 원본 시간표를 우선적으로 확인
      let ownerOriginalInfo = getOwnerOriginalScheduleInfo(date, time);

      // 🔧 다른 사람의 수업 먼저 확인 (빗금 계산 전에!)
      const ownerInfo = getSlotOwner(date, time);

      // 🆕 조원 본인의 비선호시간 체크 (문제 1 해결)
      // ⭐ 방장의 선호시간(빈 시간)일 때, 조원 본인이 불가능하면 빗금 표시
      // ⭐ 우선순위: 방장 개인시간/예외일정 > 조원 본인 비선호시간
      if (!ownerOriginalInfo || ownerOriginalInfo.type === 'non_preferred') {
        // 🆕 [문제 2] 먼저 다른 조원 수업 뒤 배정 불가 체크
        const cannotPlaceInfo = getCannotPlaceAfterOtherMembers(date, time);
        if (cannotPlaceInfo) {
          ownerOriginalInfo = cannotPlaceInfo;
        } else {
          const userScheduleInfo = getCurrentUserScheduleInfo(date, time);
          if (userScheduleInfo) {
            // 조원 본인이 비선호시간이면 빗금으로 표시
            ownerOriginalInfo = userScheduleInfo;
          }
        }
      }

      // 🆕 이동시간 고려한 유효성 체크 (조원이고 이동모드일 때만)
      // ⭐ 시간별 체크 + 동적 이동시간 계산 (문제 1+3+4 해결)
      // ⭐ 단, 다른 사람의 수업이 있으면 빗금 계산 스킵
      // ⭐ 확정 후에는 빗금 계산 스킵 (문제 2 해결)
      if (!isRoomOwner && travelMode !== 'normal' && myTravelDuration > 0 && !ownerInfo && !isConfirmed) {
        // 현재 시간에 이미 수업이 있는지 확인
        const hasSchedule = hasScheduleAtTime(date, time, timeSlots, currentUser);

        // 현재 시간이 비어있으면 빗금 계산
        if (!hasSchedule) {
          // ⭐ 동적 이동시간 계산
          const dynamicTravelDuration = getDynamicTravelDuration(
            date, time, timeSlots, currentUser, myTravelDuration
          );

          const timeMinutes = timeToMinutes(time);
          const travelStartMinutes = timeMinutes - dynamicTravelDuration;

          let isTravelBlocked = false;

          // 이동 구간을 10분 단위로 역추적하며 금지시간 포함 여부 확인
          for (let m = timeMinutes - 10; m >= travelStartMinutes; m -= 10) {
              if (m < 0) continue;
              const checkTimeStr = minutesToTime(m);

              // 1. 방 설정 금지시간(blockedTimes) 체크
              const blockedInfo = getBlockedTimeInfo(checkTimeStr);
              if (blockedInfo) {
                  isTravelBlocked = true;
                  break;
              }

              // 2. 방장 일정(ownerOriginalInfo) 체크
              const info = getOwnerOriginalScheduleInfo(date, checkTimeStr);
              if (info && (info.type === 'non_preferred' || info.type === 'exception' || info.type === 'personal')) {
                  isTravelBlocked = true;
                  break;
              }
          }

          // 🆕 수업 시간도 금지시간과 겹치는지 체크 (문제 B 해결!)
          if (!isTravelBlocked) {
              // currentRoom에서 classDuration 가져오기
              const classDuration = (timeSlots && timeSlots.length > 0) 
                  ? (timeSlots[0].endMinutes || 60) - (timeSlots[0].startMinutes || 0)
                  : 60; // 기본값 60분
              
              const classEndMinutes = timeMinutes + classDuration;

              // 수업 구간을 10분 단위로 체크
              for (let m = timeMinutes; m < classEndMinutes; m += 10) {
                  const checkTimeStr = minutesToTime(m);
                  
                  const blockedInfo = getBlockedTimeInfo(checkTimeStr);
                  if (blockedInfo) {
                      isTravelBlocked = true;
                      break;
                  }

                  const info = getOwnerOriginalScheduleInfo(date, checkTimeStr);
                  if (info && (info.type === 'non_preferred' || info.type === 'exception' || info.type === 'personal')) {
                      isTravelBlocked = true;
                      break;
                  }
              }
          }

          if (isTravelBlocked) {
              // ⭐ 선호시간 내에서만 빗금 표시
              const currentTimeBlocked = getBlockedTimeInfo(time);
              const isPreferredTime = !currentTimeBlocked && !ownerOriginalInfo;

              if (isPreferredTime) {
                  ownerOriginalInfo = {
                      type: 'travel_restricted',
                      name: '배정 불가',
                      title: '이 시간은 배정할 수 없습니다',
                      isTravelRestricted: true
                  };
              } else {
              }
          }
        } else {
        }
      }

      // ownerInfo는 이미 위에서 가져왔으므로 중복 제거
      // const ownerInfo = getSlotOwner(date, time);
      const isSelected = isSlotSelected(date, time);
      const blockedInfo = getBlockedTimeInfo(time);
      const roomExceptionInfo = getRoomExceptionInfo(date, time);
      const isBlocked = !!(blockedInfo || roomExceptionInfo);

      // 현재 슬롯의 상태 결정 - 우선순위 개선
      let slotType = 'empty';
      let slotData = null;

      // 🆕 멤버 슬롯인지 확인 (방장이 본인 슬롯을 보는 경우 제외)
      const isMemberSlot = ownerInfo && (!isRoomOwner || (ownerInfo.userId !== currentUser?.id && ownerInfo.userId !== currentUser?._id));

      // 🔒 최우선 순위: 조원은 이동시간 슬롯을 절대 보면 안 됨 (본인 것이든 다른 사람 것이든)
      // 이동시간 구간은 무조건 "배정 불가"로 표시
      if (ownerInfo && ownerInfo.isTravel) {
        console.log(`🚗 [${time}] 이동시간 감지! isRoomOwner: ${isRoomOwner}, ownerInfo:`, ownerInfo);
      }
      if (!isRoomOwner && ownerInfo && ownerInfo.isTravel) {
        console.log(`✅ [${time}] 이동시간을 blocked로 설정!`);
        slotType = 'blocked';
        slotData = {
          name: '배정 불가',
          info: { type: 'travel_hidden' },
          isTravelHidden: true,
          ownerScheduleType: 'travel_hidden'
        };
        console.log(`✅ [${time}] slotType 설정 완료: ${slotType}, slotData:`, slotData);
      }
      // ✨✨✨ 차순위: 방장의 개인시간/예외일정 (이동시간 포함, 모두 blocked로 표시)
      // 확정된 일정은 blocked(오렌지색)로 표시되어야 함
      else if (ownerOriginalInfo && (
        ownerOriginalInfo.type === 'exception' ||
        ownerOriginalInfo.type === 'personal' ||
        ownerOriginalInfo.type === 'travel_restricted' ||
        ownerOriginalInfo.type === 'user_non_preferred' ||  // 🆕 조원 본인 비선호시간 (문제 1)
        ownerOriginalInfo.type === 'non_preferred' ||  // 🆕 방장 비선호시간
        ownerOriginalInfo.type === 'cannot_place_after' ||  // 🆕 다른 조원 수업 뒤 배정 불가 (문제 2)
        ownerOriginalInfo.type === 'blocked_by_restriction'  // 🆕 금지시간 침범 (문제 2)
      )) {
        slotType = 'blocked';
        slotData = {
          name: ownerOriginalInfo.name,
          info: ownerOriginalInfo,
          isOwnerOriginalSchedule: true,
          ownerScheduleType: ownerOriginalInfo.type
        };
      }
      // In travel mode, owner info (split travel/activity slots) takes precedence
      // ✅ 단, isTravel 슬롯은 travelSlots 배열로 별도 렌더링되므로 여기서는 제외
      else if (travelMode !== 'normal' && ownerInfo && !ownerInfo.isTravel) {
        slotType = 'owner';
        slotData = ownerInfo;
        
        // 🔒 조원은 다른 사람의 슬롯을 빗금으로 표시
        if (!isRoomOwner && slotData && currentUser) {
          const currentUserId = currentUser.id || currentUser._id;
          const slotUserId = slotData.userId || slotData.actualUserId;

          if (slotUserId && slotUserId.toString() !== currentUserId.toString()) {
            slotType = 'blocked';
            slotData = {
              name: '배정 불가',
              info: { type: 'other_member' },
              isOtherMemberSlot: true,
              ownerScheduleType: 'other_member'
            };
          }
        }
      }
      // 1순위: blocked 또는 room exception
      else if (isBlocked) {
        slotType = 'blocked';
        let displayName = roomExceptionInfo ? roomExceptionInfo.name : blockedInfo?.name;

        // 방장 시간표의 경우 통일된 이름으로 표시
        if (displayName && displayName.includes('방장 시간표')) {
          displayName = '방장 시간표';
        }

        slotData = {
          name: displayName,
          info: roomExceptionInfo || blockedInfo,
          isRoomException: !!roomExceptionInfo,
          isRoomOwnerSchedule: displayName === '방장 시간표'
        };
      }
      // 2순위: owner가 있고 blocked가 아닌 경우 - 단, 방장 개인시간은 blocked로 처리
      else if (ownerInfo) {
        // 방장의 개인시간인지 확인 (방장이고 본인 슬롯인 경우 blocked로 처리)
        const isRoomOwnerPersonalTime = isRoomOwner &&
                                       (ownerInfo.actualUserId === currentUser?.actualUserId ||
                                        ownerInfo.userId === currentUser?.userId ||
                                        ownerInfo.name === currentUser?.name);

        if (isRoomOwnerPersonalTime) {
          slotType = 'blocked';
          slotData = {
            name: `${ownerInfo.name} (개인시간)`,
            info: ownerInfo,
            isRoomOwnerPersonal: true
          };
        } else {
          slotType = 'owner';
          slotData = ownerInfo;

          // 🔒 Phase 1: Visibility Control - 조원은 자기 배정만, 방장은 전체 보기 (병합 모드)
          if (!isRoomOwner && slotData && currentUser) {
            const currentUserId = currentUser.id || currentUser._id;
            const slotUserId = slotData.userId || slotData.actualUserId;

            // 🆕 다른 사람의 슬롯이면 빗금으로 표시 (배치 위치 숨김)
            if (slotUserId && slotUserId.toString() !== currentUserId.toString()) {
              slotType = 'blocked';
              slotData = {
                name: '배정 불가',
                info: { type: 'other_member' },
                isOtherMemberSlot: true,
                ownerScheduleType: 'other_member'
              };
            }
          }
        }
      }
      // 3순위: 선택된 슬롯 (blocked나 owner가 아닌 경우에만)
      else if (isSelected) {
        slotType = 'selected';
        slotData = null;
      }
      // 4순위: 방장의 불가능한 시간 (non_preferred) - 빈 슬롯에만 적용
      else if (ownerOriginalInfo && ownerOriginalInfo.type === 'non_preferred') {
        slotType = 'blocked';
        slotData = {
          name: ownerOriginalInfo.name,
          info: ownerOriginalInfo,
          isOwnerOriginalSchedule: true,
          ownerScheduleType: ownerOriginalInfo.type
        };
      }

      // 슬롯 분석 완료

      // 현재 블록과 같은 타입인지 확인 - 더 정확한 비교
      let isSameType = false;

      if (currentBlock && currentBlock.type === slotType) {
        if (slotType === 'empty') {
          isSameType = true;
        } else if (slotType === 'blocked') {
          // blocked 타입: 이름이 같으면 병합
          const currentName = currentBlock.data?.name || '';
          const newName = slotData?.name || '';

          // 방장 관련 시간 체크
          const currentIsRoomOwnerPersonal = currentBlock.data?.isRoomOwnerPersonal;
          const newIsRoomOwnerPersonal = slotData?.isRoomOwnerPersonal;
          const currentIsRoomOwnerSchedule = currentBlock.data?.isRoomOwnerSchedule;
          const newIsRoomOwnerSchedule = slotData?.isRoomOwnerSchedule;
          const currentIsOwnerOriginalSchedule = currentBlock.data?.isOwnerOriginalSchedule;
          const newIsOwnerOriginalSchedule = slotData?.isOwnerOriginalSchedule;

          if ((currentIsRoomOwnerPersonal && newIsRoomOwnerPersonal) ||
              (currentIsRoomOwnerSchedule && newIsRoomOwnerSchedule) ||
              (currentIsOwnerOriginalSchedule && newIsOwnerOriginalSchedule)) {
            // 둘 다 방장 관련 시간이면 병합 (이름이 같은지도 확인)
            isSameType = currentName === newName;
          } else {
            // 일반 blocked 시간은 이름이 정확히 같아야 병합
            isSameType = currentName === newName;
          }

        } else if (slotType === 'owner') {
          // owner 타입: 사용자 ID, isTravel, subject가 모두 같아야 병합
          const getUserId = (s) => s?.actualUserId || s?.userId;
          const currentUserId = getUserId(currentBlock.data);
          const newUserId = getUserId(slotData);

          const currentIsTravel = currentBlock.data?.isTravel || false;
          const newIsTravel = slotData?.isTravel || false;

          const currentSubject = currentBlock.data?.subject;
          const newSubject = slotData?.subject;

          isSameType = currentUserId && newUserId && currentUserId === newUserId &&
                       currentIsTravel === newIsTravel &&
                       currentSubject === newSubject;

        } else if (slotType === 'selected') {
          isSameType = true;
        }
      }

      if (isSameType) {
        // 기존 블록 확장
        currentBlock.endTime = time;
        currentBlock.duration += 10;
        currentBlock.times.push(time);
      } else {
        // 새로운 블록 시작
        if (currentBlock) {
          blocks.push(currentBlock);
        }
        currentBlock = {
          type: slotType,
          data: slotData,
          startTime: time,
          endTime: time,
          duration: 10,
          times: [time]
        };
      }
    }

    if (currentBlock) {
      blocks.push(currentBlock);
    }

    // 각 블록의 실제 끝시간 계산 (마지막 시간 + 10분)
    blocks.forEach(block => {
      const [hour, minute] = block.endTime.split(':').map(Number);
      const totalMinutes = hour * 60 + minute + 10;
      const endHour = Math.floor(totalMinutes / 60);
      const endMinute = totalMinutes % 60;
      block.actualEndTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
    });

    return blocks;
  };

  // 병합 모드 렌더링 함수 - 각 날짜별 독립적 컬럼 렌더링
  const renderMergedView = () => {

    // 🔍 현재 화면에 표시되는 날짜들 확인
    // 이동 슬롯을 날짜별로 그룹화
    const travelSlotsByDate = {};
    (travelSlots || []).forEach(slot => {
        const dateKey = new Date(slot.date).toISOString().split('T')[0];
        if (!travelSlotsByDate[dateKey]) {
            travelSlotsByDate[dateKey] = [];
        }
        travelSlotsByDate[dateKey].push(slot);
    });

    // 각 날짜별로 병합된 블록 계산
    const dayBlocks = weekDates.map((dateInfo, dayIndex) =>
      getMergedTimeBlocks(dateInfo, dayIndex)
    );

    // 시간 슬롯별 위치 계산을 위한 헬퍼 함수
    const getTimeSlotIndex = (time) => {
      return filteredTimeSlotsInDay.findIndex(slot => slot === time);
    };

    // 그리드 기반으로 렌더링 (헤더와 일치)
    return (
      <div className="grid grid-cols-6 bg-white">
        {/* 시간 컬럼 - 첫 번째 행만 렌더링 */}
        <div className="col-span-1 relative">
          {filteredTimeSlotsInDay.map(time => (
            <div
              key={time}
              className="h-5 px-1 text-center text-xs font-medium text-gray-600 border-b border-gray-200 flex items-center justify-center"
            >
              {time}
            </div>
          ))}
        </div>

        {/* 각 날짜별 컬럼 */}
        {weekDates.slice(0, 5).map((dateInfo, dayIndex) => {
          const dateKey = dateInfo.fullDate.toISOString().split('T')[0];
          const blocks = dayBlocks[dayIndex];
          const totalHeight = filteredTimeSlotsInDay.length * 20; // 전체 컬럼 높이 (h-8 = 20px)

          return (
            <div key={dayIndex} className="col-span-1 border-l border-gray-200 relative" style={{ height: `${totalHeight}px` }}>
              {blocks.map((block, blockIndex) => {
                const date = dateInfo.fullDate;
                const blockHeight = block.duration * 2.0; // 10분 = 2.0px (20px/10)
                const startIndex = getTimeSlotIndex(block.startTime);
                const topPosition = startIndex * 20; // 각 시간 슬롯은 20px (h-8)

                return (
                  <div
                    key={`${date.toISOString().split('T')[0]}-${block.startTime}-${blockIndex}`}
                    className={`absolute left-0 right-0 border-b border-gray-200 flex items-center justify-center text-center px-0.5 z-0
                      ${block.type === 'blocked' ? 'cursor-not-allowed' : ''}
                      ${block.type === 'selected' ? 'bg-blue-200 border-2 border-blue-400' : ''}
                      ${block.type === 'empty' && currentUser ? 'hover:bg-blue-50 cursor-pointer' : ''}
                      ${block.type === 'owner' && currentUser ? 'cursor-pointer hover:opacity-80' : ''}
                      ${block.type === 'empty' && isRoomOwner ? 'cursor-pointer hover:bg-green-50' : ''}
                    `}
                    style={{
                      height: `${blockHeight}px`,
                      top: `${topPosition}px`,
                      ...(block.type === 'owner' && block.data ? (
                        block.data.isTravel ? {
                          // 🆕 이동시간 슬롯: 흰색 배경 + 회색 점선 테두리
                          backgroundColor: '#FFFFFF',
                          borderColor: '#9CA3AF',
                          borderStyle: 'dashed',
                          borderWidth: '2px'
                        } : {
                          // 일반 수업 슬롯: 멤버 색상
                          backgroundColor: `${block.data.color}CC`,
                          borderColor: block.data.color
                        }
                      ) : {}),
                      // 방장의 불가능한 시간 (non_preferred) - 연한 보라/라벤더
                      ...(block.type === 'blocked' && block.data?.ownerScheduleType === 'non_preferred' ? {
                        backgroundColor: '#E9D5FF',
                        borderColor: '#C084FC'
                      } : {}),
                      // 🆕 이동 시간 부족으로 차단된 시간 (travel_restricted) - 빗금 처리
                      ...(block.type === 'blocked' && block.data?.ownerScheduleType === 'travel_restricted' ? {
                        backgroundColor: '#E5E7EB', // gray-200
                        borderColor: '#9CA3AF', // gray-400
                        backgroundImage: 'repeating-linear-gradient(45deg, #D1D5DB 0px, #D1D5DB 5px, #E5E7EB 5px, #E5E7EB 10px)'
                      } : {}),
                      // 🆕 조원 본인 비선호시간 (user_non_preferred) - 빗금 처리 (문제 1)
                      ...(block.type === 'blocked' && block.data?.ownerScheduleType === 'user_non_preferred' ? {
                        backgroundColor: '#E5E7EB', // gray-200
                        borderColor: '#9CA3AF', // gray-400
                        backgroundImage: 'repeating-linear-gradient(45deg, #D1D5DB 0px, #D1D5DB 5px, #E5E7EB 5px, #E5E7EB 10px)'
                      } : {}),
                      // 🆕 다른 조원 배치 시간 (other_member) - 빗금 처리
                      ...(block.type === 'blocked' && block.data?.ownerScheduleType === 'other_member' ? {
                        backgroundColor: '#E5E7EB', // gray-200
                        borderColor: '#9CA3AF', // gray-400
                        backgroundImage: 'repeating-linear-gradient(45deg, #D1D5DB 0px, #D1D5DB 5px, #E5E7EB 5px, #E5E7EB 10px)'
                      } : {}),
                      // 🆕 이동시간 숨김 (travel_hidden) - 빗금 처리 (조원용)
                      ...(block.type === 'blocked' && block.data?.ownerScheduleType === 'travel_hidden' ? {
                        backgroundColor: '#E5E7EB', // gray-200
                        borderColor: '#9CA3AF', // gray-400
                        backgroundImage: 'repeating-linear-gradient(45deg, #D1D5DB 0px, #D1D5DB 5px, #E5E7EB 5px, #E5E7EB 10px)'
                      } : {}),
                      // 방장의 개인시간 (personal) - 연한 주황/피치
                      ...(block.type === 'blocked' && block.data?.ownerScheduleType === 'personal' ? {
                        backgroundColor: '#FED7AA',
                        borderColor: '#FB923C'
                      } : {}),
                      // 방장의 예외일정 (exception) - 연한 노란색
                      ...(block.type === 'blocked' && block.data?.ownerScheduleType === 'exception' ? {
                        backgroundColor: '#FEF3C7',
                        borderColor: '#FBBF24'
                      } : {}),
                      // 그 외 roomException - 연한 청록
                      ...(block.type === 'blocked' && block.data?.isRoomException && !block.data?.ownerScheduleType ? {
                        backgroundColor: '#99F6E4',
                        borderColor: '#2DD4BF'
                      } : {}),
                      // 기타 blocked - 연한 회색 (fallback)
                      ...(block.type === 'blocked' && !block.data?.ownerScheduleType && !block.data?.isRoomException ? {
                        backgroundColor: '#F3F4F6',
                        borderColor: '#D1D5DB'
                      } : {})
                    }}
                    onClick={() => handleSlotClick(date, block.startTime)}
                  >
                    {block.type === 'blocked' ? (
                      <div className="text-xs text-gray-600 font-medium" style={{ fontSize: '25px' }} title={`${block.data?.name} (${block.startTime}~${block.actualEndTime})`}>
                        <div className="text-xs leading-tight" style={{ fontSize: '25px' }}>{block.data?.name.length > 6 ? block.data?.name.substring(0, 4) + '...' : block.data?.name}</div>
                        {blockHeight > 20 && <div className="text-xs leading-tight" style={{ fontSize: '25px' }}>{block.startTime}~{block.actualEndTime}</div>}
                      </div>
                    ) : block.type === 'owner' ? (
                      <div
                        className="text-xs font-medium px-0.5 py-0.5 rounded"
                        style={{
                          color: '#000000',
                          // 🆕 이동시간은 부모 div가 배경색 담당하므로 투명
                          backgroundColor: block.data?.isTravel ? 'transparent' : `${block.data?.color}CC`,
                          fontSize: '25px'
                        }}
                        title={`${block.data?.subject || block.data?.name} (${block.startTime}~${block.actualEndTime})`}
                      >
                        <div className="text-xs leading-tight" style={{ fontSize: '25px' }}>
                          {/* 🆕 이동시간일 경우 텍스트 표시 변경 */}
                          {block.data?.isTravel ? (
                             <>
                               {block.data?.travelInfo?.travelMode === 'transit' ? '🚇' : 
                                block.data?.travelInfo?.travelMode === 'driving' ? '🚗' : 
                                block.data?.travelInfo?.travelMode === 'bicycling' ? '🚴' : 
                                block.data?.travelInfo?.travelMode === 'walking' ? '🚶' : '🚗'} 이동
                               <br/>
                               {block.data?.travelInfo?.durationText}
                             </>
                          ) : (
                             block.data?.name.length > 4 ? block.data?.name.substring(0, 3) + '...' : block.data?.name
                          )}
                        </div>
                        {blockHeight > 20 && !block.data?.isTravel && <div className="text-xs leading-tight" style={{ fontSize: '25px' }}>{block.startTime}~{block.actualEndTime}</div>}
                      </div>
                    ) : block.type === 'selected' ? (
                      <div className="text-xs font-medium text-blue-700 px-0.5 py-0.5 rounded bg-blue-100" style={{ fontSize: '25px' }}>
                        <div className="text-xs leading-tight" style={{ fontSize: '25px' }}>선택됨</div>
                        {blockHeight > 20 && <div className="text-xs leading-tight" style={{ fontSize: '25px' }}>{block.startTime}~{block.actualEndTime}</div>}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400" style={{ fontSize: '25px' }}>
                        <div className="text-xs leading-tight" style={{ fontSize: '25px' }}>빈 시간</div>
                        {blockHeight > 20 && <div className="text-xs leading-tight" style={{ fontSize: '25px' }}>{block.startTime}~{block.actualEndTime}</div>}
                      </div>
                    )}
                  </div>
                );
              })}
              {(() => {
                  const dateKey = dateInfo.fullDate.toISOString().split('T')[0];
                  // 🆕 확정된 일정(개인시간/예외)과 겹치는 이동시간 슬롯 필터링
                  const slots = (travelSlotsByDate[dateKey] || []).filter(travelSlot => {
                      // 🔒 최우선 순위: 조원은 이동시간 슬롯을 절대 보면 안 됨
                      if (!isRoomOwner) {
                          return false;
                      }

                      // 이동시간 슬롯의 중간 지점이나 시작/끝 지점이 개인일정과 겹치는지 확인
                      // 간단하게 시작 시간 기준으로 체크 (필요시 더 정교하게 수정 가능)
                      const info = getOwnerOriginalScheduleInfo(dateInfo.fullDate, travelSlot.startTime);

                      // 개인일정(personal)이나 예외일정(exception)이 있으면 이동시간 숨김
                      if (info && (info.type === 'personal' || info.type === 'exception')) {
                          return false;
                      }
                      return true;
                  });
                  return slots;
              })().map((travelSlot, travelIndex) => {
                  const travelStartMinutes = timeToMinutes(travelSlot.startTime);
                  const travelEndMinutes = timeToMinutes(travelSlot.endTime);
                  const scheduleStartMinutes = timeToMinutes(filteredTimeSlotsInDay[0] || '00:00');

                  const topOffsetMinutes = travelStartMinutes - scheduleStartMinutes;
                  const durationMinutes = travelEndMinutes - travelStartMinutes;

                  const topPosition = (topOffsetMinutes / 10) * 20;
                  const slotHeight = (durationMinutes / 10) * 20;
                  
                  if (slotHeight <= 0) return null;

                  // 🆕 사용자 색상 가져오기 (기본값: 하늘색)
                  const userColor = travelSlot.color || '#87CEEB';
                  // 🆕 이동수단별 이모지
                  const modeIcon = {
                    'transit': '🚇',
                    'driving': '🚗',
                    'bicycling': '🚴',
                    'walking': '🚶'
                  }[travelSlot.travelMode] || '🚗';

                  return (
                      <div
                          key={`travel-${dayIndex}-${travelIndex}`}
                          className="absolute left-0 right-0 border-2 border-solid z-20 p-1 flex flex-col justify-center"
                          style={{
                              top: `${topPosition}px`,
                              height: `${slotHeight}px`,
                              backgroundColor: userColor,  // ✅ 100% 불투명으로 변경 (명확한 표시)
                              borderColor: '#1F2937',  // ✅ 진한 테두리로 구분
                              borderStyle: 'dashed',  // ✅ 점선 테두리로 구분
                              borderWidth: '3px'  // ✅ 두께 증가 (2px → 3px)
                          }}
                          title={`${modeIcon} 이동: ${travelSlot.from || '출발지'} → ${travelSlot.to || '도착지'} (${travelSlot.travelInfo?.durationText || '시간 계산 중'})`}
                      >
                          <div className="text-xs font-bold truncate text-center block" style={{ color: '#FFFFFF', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                            {modeIcon} {travelSlot.from || '출발지'} → {travelSlot.to || '도착지'}
                          </div>
                          {slotHeight > 20 && (
                            <div className="text-xs text-center mt-0.5 block font-semibold" style={{ color: '#FFFFFF', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                                {travelSlot.travelInfo?.durationText || `${durationMinutes}분`} {travelSlot.travelInfo?.distanceText ? `(${travelSlot.travelInfo.distanceText})` : ''}
                            </div>
                          )}
                      </div>
                  );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  // 일반 모드 렌더링 함수
  const renderNormalView = () => {
    // 평일 5개만 확실히 사용
    const weekdays = weekDates.slice(0, 5);


    return (
      <>
        {filteredTimeSlotsInDay.map(time => (
          <div key={time} className="grid grid-cols-6 border-b border-gray-200 last:border-b-0">
            {/* 시간 컬럼 */}
            <div className="col-span-1 px-1 text-center text-xs font-medium text-gray-600 flex items-center justify-center h-8">
              {time}
            </div>

            {/* 평일 5개 컬럼만 */}
            {weekdays.map((dateInfo, dayIndex) => {
              const date = dateInfo.fullDate;

              // 1. 방장의 원본 시간표를 우선적으로 확인
              let ownerOriginalInfo = getOwnerOriginalScheduleInfo(date, time);

              // 2. 기본 정보 가져오기
              const ownerInfo = getSlotOwner(date, time);
              const isSelected = isSlotSelected(date, time);
              const blockedInfo = getBlockedTimeInfo(time, date);
              const roomExceptionInfo = getRoomExceptionInfo(date, time);

              // 3. 멤버 슬롯인지 확인 (방장이 본인 슬롯을 보는 경우 제외)
              const isMemberSlot = ownerInfo && (!isRoomOwner || (ownerInfo.userId !== currentUser?.id && ownerInfo.userId !== currentUser?._id));

              // 3-1. 🆕 조원 본인의 비선호시간 체크 (문제 1 해결)
              // ⭐ 방장의 선호시간(빈 시간)일 때, 조원 본인이 불가능하면 빗금 표시
              // ⭐ 우선순위: 방장 개인시간/예외일정 > 조원 본인 비선호시간
              if (!ownerOriginalInfo || ownerOriginalInfo.type === 'non_preferred') {
                // 🆕 [문제 2] 먼저 다른 조원 수업 뒤 배정 불가 체크
                const cannotPlaceInfo = getCannotPlaceAfterOtherMembers(date, time);
                if (cannotPlaceInfo) {
                  ownerOriginalInfo = cannotPlaceInfo;
                } else {
                  const userScheduleInfo = getCurrentUserScheduleInfo(date, time);
                  if (userScheduleInfo) {
                    // 조원 본인이 비선호시간이면 빗금으로 표시
                    ownerOriginalInfo = userScheduleInfo;
                  }
                }
              }

              // 4. 🆕 이동시간 고려한 유효성 체크 (조원이고 이동모드일 때만)
              // ⭐ 시간별 체크 + 동적 이동시간 계산 (문제 1+3+4 해결)
              // ⭐ 단, ownerOriginalInfo나 ownerInfo가 있으면 빗금 계산 스킵
              // ⭐ 확정 후에는 빗금 계산 스킵 (문제 2 해결)
              if (!isRoomOwner && travelMode !== 'normal' && myTravelDuration > 0 && !ownerOriginalInfo && !ownerInfo && !isConfirmed) {
                // 현재 시간에 이미 수업이 있는지 확인
                const hasSchedule = hasScheduleAtTime(date, time, timeSlots, currentUser);

                // 현재 시간이 비어있으면 빗금 계산
                if (!hasSchedule) {
                  // ⭐ 동적 이동시간 계산
                  const dynamicTravelDuration = getDynamicTravelDuration(
                    date, time, timeSlots, currentUser, myTravelDuration
                  );

                  const timeMinutes = timeToMinutes(time);
                  const travelStartMinutes = timeMinutes - dynamicTravelDuration;

                  let isTravelBlocked = false;

                  for (let m = timeMinutes - 10; m >= travelStartMinutes; m -= 10) {
                      if (m < 0) continue;
                      const checkTimeStr = minutesToTime(m);

                      const checkBlockedInfo = getBlockedTimeInfo(checkTimeStr);
                      if (checkBlockedInfo) {
                          isTravelBlocked = true;
                          break;
                      }

                      const info = getOwnerOriginalScheduleInfo(date, checkTimeStr);
                      if (info && (info.type === 'non_preferred' || info.type === 'exception' || info.type === 'personal')) {
                          isTravelBlocked = true;
                          break;
                      }
                  }

                  if (isTravelBlocked) {
                      // ⭐ 선호시간 내에서만 빗금 표시
                      const currentTimeBlocked = getBlockedTimeInfo(time);
                      const isPreferredTime = !currentTimeBlocked && !ownerOriginalInfo;

                      if (isPreferredTime) {
                          ownerOriginalInfo = {
                              type: 'travel_restricted',
                              name: '배정 불가',
                              title: '이 시간은 배정할 수 없습니다',
                              isTravelRestricted: true
                          };
                      }
                  }
                }
              }

              // 5. 최종 표시 정보 결정
              // 방장의 원본 시간표 정보 처리: exception/personal만 우선, non_preferred는 나중에
              let finalBlockedInfo = blockedInfo;
              let finalRoomExceptionInfo = roomExceptionInfo;
              let finalOwnerInfo = ownerInfo;

              // exception이나 personal은 최우선 (이동시간 포함)
              // 확정된 일정은 blocked(오렌지색)로 표시되어야 함
              if (ownerOriginalInfo && (
                ownerOriginalInfo.type === 'exception' ||
                ownerOriginalInfo.type === 'personal' ||
                ownerOriginalInfo.type === 'travel_restricted' ||
                ownerOriginalInfo.type === 'user_non_preferred' ||  // 🆕 조원 본인 비선호시간 (문제 1)
                ownerOriginalInfo.type === 'non_preferred' ||  // 🆕 방장 비선호시간
                ownerOriginalInfo.type === 'cannot_place_after' ||  // 🆕 다른 조원 수업 뒤 배정 불가 (문제 2)
                ownerOriginalInfo.type === 'blocked_by_restriction'  // 🆕 금지시간 침범 (문제 2)
              )) {
                finalBlockedInfo = { ...ownerOriginalInfo, ownerScheduleType: ownerOriginalInfo.type };
                finalRoomExceptionInfo = null;
                finalOwnerInfo = null;
              }
              // non_preferred는 빈 슬롯에만 적용 (ownerInfo가 없고 blocked도 없을 때)
              else if (ownerOriginalInfo && ownerOriginalInfo.type === 'non_preferred' && !ownerInfo && !blockedInfo && !roomExceptionInfo) {
                finalBlockedInfo = { ...ownerOriginalInfo, ownerScheduleType: ownerOriginalInfo.type };
              }

              // 🔒 Phase 1: Visibility Control - 조원은 자기 배정만, 방장은 전체 보기
              if (!isRoomOwner && finalOwnerInfo && currentUser) {
                const currentUserId = currentUser.id || currentUser._id;
                const slotUserId = finalOwnerInfo.userId || finalOwnerInfo.actualUserId;

                // 🆕 다른 사람의 슬롯이면 빗금으로 표시 (배치 위치 숨김)
                if (slotUserId && slotUserId.toString() !== currentUserId.toString()) {
                  finalBlockedInfo = {
                    name: '배정 불가',
                    ownerScheduleType: 'other_member',
                    isOtherMemberSlot: true
                  };
                  finalOwnerInfo = null;
                }
              }

              const isBlocked = !!(finalBlockedInfo || finalRoomExceptionInfo);

              return (
                <TimeSlot
                  key={`${date.toISOString().split('T')[0]}-${time}`}
                  date={date}
                  day={dayNamesKorean[dayIndex]}
                  time={time}
                  ownerInfo={finalOwnerInfo}
                  isSelected={isSelected}
                  blockedInfo={finalBlockedInfo}
                  roomExceptionInfo={finalRoomExceptionInfo}
                  isBlocked={isBlocked}
                  isRoomOwner={isRoomOwner}
                  currentUser={currentUser}
                  onSlotClick={handleSlotClick}
                  showMerged={showMerged}
                />
              );
            })}
          </div>
        ))}
      </>
    );
  };

  return showMerged ? renderMergedView() : renderNormalView();
};

export default WeekView;
