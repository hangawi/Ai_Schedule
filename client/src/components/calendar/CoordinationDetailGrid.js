/**
 * ===================================================================================================
 * CoordinationDetailGrid.js - 일정맞추기 상세 시간표 모달
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/calendar/CoordinationDetailGrid.js
 *
 * 🎯 주요 기능:
 *    - 특정 날짜의 시간표를 10분 단위로 상세하게 표시
 *    - 배정된 슬롯, 방장의 개인/선호시간, 차단된 시간 등을 시각화
 *    - 방장의 일정(선호시간, 개인시간, 예외일정)을 고려하여 배정 가능/불가능 시간 표시
 *    - 연속된 같은 타입의 시간을 병합하여 블록 형태로 표시
 *    - 이동시간 슬롯 구분 표시
 *
 * 🔗 연결된 파일:
 *    - ../../utils/timetableHelpers.js - getBlockedTimeInfo, getRoomExceptionInfo 유틸 함수
 *    - lucide-react - X, Users, MessageSquare, Ban 아이콘
 *
 * 💡 UI 위치:
 *    - 탭: 일정맞추기 (CoordinationTab)
 *    - 섹션: 캘린더 뷰에서 특정 날짜 클릭 시 나타나는 모달
 *    - 화면: 전체 화면 오버레이 모달로 표시됨
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 상세 시간표 모달의 UI 및 데이터 표시 방식이 변경됨
 *    - 시간 슬롯 간격 변경: generateTimeSlots 함수의 m += 10 부분 수정 (현재 10분 단위)
 *    - 방장 일정 검증 로직: getOwnerScheduleInfoForTime 함수 수정
 *    - 블록 색상/스타일 변경: return문의 switch-case 부분 수정
 *    - 시간 범위 기본값 변경: useState({ start: 0, end: 24 }) 수정
 *
 * 📝 참고사항:
 *    - 방장의 선호시간(preferred)은 빈 시간으로 표시되어 배정 가능
 *    - 방장의 개인시간(personal) 및 비선호시간(non_preferred)은 차단됨
 *    - 예외일정(exception)이 있으면 우선적으로 적용됨
 *    - 이동시간(travel) 슬롯은 녹색으로 구분 표시됨
 *    - 배정된 슬롯은 파란색, 차단된 슬롯은 빨간색으로 표시
 *
 * ===================================================================================================
 */

import React, { useState } from 'react';
import { X, Users, MessageSquare, Ban } from 'lucide-react';
import {
  getBlockedTimeInfo,
  getRoomExceptionInfo
} from '../../utils/timetableHelpers';

/**
 * toYYYYMMDD - 날짜 객체를 YYYY-MM-DD 문자열로 변환
 *
 * @param {Date} date - 변환할 날짜 객체
 * @returns {string|null} YYYY-MM-DD 형식 문자열 또는 유효하지 않으면 null
 */
const toYYYYMMDD = (date) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * timeToMinutes - 시간 문자열(HH:MM)을 분 단위로 변환
 *
 * @param {string} timeStr - 시간 문자열 (예: "09:30")
 * @returns {number} 분 단위 시간 (예: 09:30 → 570)
 */
const timeToMinutes = (timeStr) => {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [hour, minute] = timeStr.split(':').map(Number);
  return hour * 60 + minute;
};

/**
 * generateTimeSlots - 시작 시간부터 종료 시간까지 10분 단위 시간 슬롯 배열 생성
 *
 * @param {number} startHour - 시작 시간 (기본값: 0)
 * @param {number} endHour - 종료 시간 (기본값: 24)
 * @returns {Array<string>} 시간 문자열 배열 (예: ["00:00", "00:10", "00:20", ...])
 */
const generateTimeSlots = (startHour = 0, endHour = 24) => {
  const slots = [];
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += 10) {
      const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      slots.push(time);
    }
  }
  return slots;
};

/**
 * CoordinationDetailGrid - 일정맞추기 상세 시간표 모달 컴포넌트
 *
 * @description 특정 날짜의 시간표를 10분 단위로 상세하게 표시하는 모달
 *              방장의 일정(선호시간, 개인시간)과 배정된 슬롯을 시각적으로 보여줌
 *
 * @param {Date} selectedDate - 상세 보기할 날짜
 * @param {Array} timeSlots - 배정된 타임슬롯 배열
 * @param {Array} members - 방 멤버 배열
 * @param {Object} roomData - 방 데이터 (설정 포함)
 * @param {Function} onClose - 모달 닫기 콜백
 * @param {Object} ownerOriginalSchedule - 방장의 원본 일정 정보
 *
 * @returns {JSX.Element} 상세 시간표 모달 UI
 */
const CoordinationDetailGrid = ({
  selectedDate,
  timeSlots = [],
  members = [],
  roomData,
  onClose,
  ownerOriginalSchedule,
}) => {
  const [timeRange, setTimeRange] = useState({ start: 0, end: 24 });

  /**
   * getOwnerScheduleInfoForTime - 특정 시간에 방장의 일정 정보 조회
   *
   * @description 방장의 예외일정, 개인시간, 선호시간을 우선순위대로 체크하여 반환
   *              우선순위: 예외일정 > 개인시간 > 선호시간 > 비선호시간
   *
   * @param {Date} date - 조회할 날짜
   * @param {string} time - 조회할 시간 (HH:MM 형식)
   * @returns {Object|null} 일정 정보 객체 또는 null
   *                        - type: 'exception' | 'personal' | 'preferred' | 'non_preferred'
   */
  const getOwnerScheduleInfoForTime = (date, time) => {
    if (!ownerOriginalSchedule) {
      return null;
    }

    const timeMinutes = timeToMinutes(time);
    const dayOfWeek = date.getDay();
    const dateStr = toYYYYMMDD(date);

    // 1. 예외일정 체크 (최우선)
    const exception = ownerOriginalSchedule.scheduleExceptions?.find(e => {
      if (e.specificDate !== dateStr) return false;
      const startMins = timeToMinutes(e.startTime);
      const endMins = timeToMinutes(e.endTime);
      return timeMinutes >= startMins && timeMinutes < endMins;
    });
    if (exception) return { type: 'exception', ...exception };

    // 2. 개인시간 체크 (수면, 식사 등)
    const personal = ownerOriginalSchedule.personalTimes?.find(p => {
      // specificDate가 있으면 날짜로 비교 (일회성 일정)
      if (p.specificDate) {
        if (p.specificDate !== dateStr) return false;
      } else if (p.isRecurring !== false && p.days?.includes(dayOfWeek)) {
        // specificDate가 없고 반복되는 경우만
      } else {
        return false;
      }

      const startMins = timeToMinutes(p.startTime);
      const endMins = timeToMinutes(p.endTime);
      if (endMins <= startMins) return timeMinutes >= startMins || timeMinutes < endMins;
      return timeMinutes >= startMins && timeMinutes < endMins;
    });
    if (personal) return { type: 'personal', ...personal };

    // 3. 선호시간 체크
    const preferred = ownerOriginalSchedule.defaultSchedule?.some(s => {
      // 🔧 수정: specificDate가 있으면 그 날짜에만 적용
      if (s.specificDate) {
        if (s.specificDate !== dateStr) return false;
      } else {
        // specificDate가 없으면 dayOfWeek로 체크 (반복 일정)
        if (s.dayOfWeek !== dayOfWeek) return false;
      }

      return timeMinutes >= timeToMinutes(s.startTime) &&
             timeMinutes < timeToMinutes(s.endTime);
    });

    if (preferred) {
      return { type: 'preferred' };
    }

    // 4. 비선호시간 (선호시간이 아닌 시간)
    return { type: 'non_preferred' };
  };

  /**
   * getBlocksForDay - 하루 전체의 시간 블록 생성
   *
   * @description 10분 단위 시간 슬롯을 생성하고, 각 슬롯의 상태를 판단하여
   *              연속된 같은 타입의 슬롯을 병합하여 블록 배열로 반환
   *
   * @returns {Array<Object>} 시간 블록 배열
   *                          각 블록: { type, name, startTime, duration, users }
   */
  const getBlocksForDay = () => {
    const allPossibleSlots = generateTimeSlots(timeRange.start, timeRange.end);
    const slotMap = new Map();

    // 각 10분 슬롯에 대해 상태 판단
    allPossibleSlots.forEach(time => {
      const blockingInfo = getBlockedTimeInfo(time, roomData.settings) || getRoomExceptionInfo(selectedDate, time, roomData.settings);
      const assignedSlots = timeSlots.filter(slot =>
        toYYYYMMDD(slot.date) === toYYYYMMDD(selectedDate) &&
        time >= slot.startTime && time < slot.endTime
      );
      const travelSlot = assignedSlots.find(slot => slot.isTravel);
      const activitySlots = assignedSlots.filter(slot => !slot.isTravel);

      const ownerInfo = getOwnerScheduleInfoForTime(selectedDate, time);

      let event = null;
      if (blockingInfo) {
        // 방 설정에서 차단된 시간
        event = { type: 'blocked', name: blockingInfo.name };
      } else if (travelSlot) {
        // 이동시간 슬롯
        event = { type: 'travel', name: '이동시간' };
      } else if (activitySlots.length > 0) {
        // 배정된 슬롯이 있는 경우 - 사용자 이름 표시
        const userNames = assignedSlots.map(slot => {
            const member = members.find(m => {
              const memberUserId = m.user?._id?.toString() || m.user?.toString();
              const slotUserId = slot.user?._id?.toString() || slot.user?.toString();
              return memberUserId && slotUserId && memberUserId === slotUserId;
            });

            // slot.user가 populate되어 있으면 직접 사용 (우선순위 1)
            if (slot.user && typeof slot.user === 'object' && slot.user._id) {
              const user = slot.user;
              return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.firstName || '알 수 없음';
            }

            // slot.user가 ObjectId만 있으면 members에서 찾기 (우선순위 2)
            if (member && member.user && typeof member.user === 'object') {
              const user = member.user;
              return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.firstName || '알 수 없음';
            }

            return '알 수 없음';
        }).filter(Boolean).sort();
        const uniqueUserNames = [...new Set(userNames)];
        event = { type: 'assigned', name: uniqueUserNames.join(', '), users: uniqueUserNames };
      } else if (ownerInfo?.type === 'personal') {
        // personalTimes는 방장의 개인 일정이므로 배정 불가능
        event = { type: 'blocked', name: ownerInfo.title || '방장 개인일정' };
      } else if (ownerInfo?.type === 'non_preferred') {
        // 방장의 비선호시간 - 배정 불가능
        event = { type: 'blocked', name: '방장 불가능' };
        // 🔍 디버깅 로그 (샘플링)
      }
      // preferred 타입은 무시 (선호시간이므로 빈 시간으로 유지 = 배정 가능)
      slotMap.set(time, event);
    });

    // 연속된 같은 타입의 슬롯을 병합하여 블록 생성
    const blocks = [];
    let currentBlock = null;

    allPossibleSlots.forEach(time => {
      const event = slotMap.get(time);
      const currentEventType = event ? event.type : 'empty';
      const currentEventName = event ? event.name : 'empty';

      if (currentBlock && currentBlock.type === currentEventType && currentBlock.name === currentEventName) {
        currentBlock.duration += 10;
      } else {
        if (currentBlock) blocks.push(currentBlock);
        currentBlock = { type: currentEventType, name: currentEventName, startTime: time, duration: 10, users: event?.users };
      }
    });

    if (currentBlock) blocks.push(currentBlock);
    return blocks;
  };

  /**
   * formatDate - 날짜를 "YYYY년 M월 D일 (요일)" 형식으로 포맷
   *
   * @param {Date} date - 포맷할 날짜
   * @returns {string} 포맷된 날짜 문자열
   */
  const formatDate = (date) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
  };

  /**
   * getEndTimeForBlock - 블록의 종료 시간 계산
   *
   * @param {Object} block - 시간 블록 객체
   * @param {string} block.startTime - 시작 시간 (HH:MM)
   * @param {number} block.duration - 지속 시간 (분)
   * @returns {string} 종료 시간 (HH:MM 형식)
   */
  const getEndTimeForBlock = (block) => {
    const startMinutes = timeToMinutes(block.startTime);
    const endMinutes = startMinutes + block.duration;
    const hour = Math.floor(endMinutes / 60);
    const min = endMinutes % 60;
    return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  };

  const blocks = getBlocksForDay();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-bold text-gray-800">
            {formatDate(selectedDate)} 세부 시간표
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 80px)' }}>
          <div className="space-y-2">
            {blocks.map((block, index) => {
              let bgColor = 'bg-gray-50';
              let textColor = 'text-gray-600';
              let content = block.name;
              let Icon = null;

              switch (block.type) {
                case 'assigned':
                  bgColor = 'bg-blue-100';
                  textColor = 'text-blue-800';
                  Icon = Users;
                  content = `배정: ${block.users.join(', ')}`;
                  break;
                case 'blocked':
                  bgColor = 'bg-red-100';
                  textColor = 'text-red-800';
                  Icon = Ban;
                  content = block.name.includes('방장') ? block.name : `금지: ${block.name}`;
                  break;
                case 'travel':
                  bgColor = 'bg-green-100';
                  textColor = 'text-green-800';
                  Icon = Users; // Or another icon, maybe a car?
                  content = '이동시간';
                  break;
                default:
                  content = '빈 시간';
                  break;
              }

              return (
                <div key={index} className={`p-3 rounded-lg ${bgColor}`}>
                  <div className="flex justify-between items-center">
                    <span className={`text-sm font-medium ${textColor}`}>
                      {block.startTime} - {getEndTimeForBlock(block)}
                    </span>
                    <span className={`text-xs font-semibold ${textColor}`}>
                      {Math.floor(block.duration / 60) > 0 && `${Math.floor(block.duration / 60)}시간 `}
                      {block.duration % 60 > 0 && `${block.duration % 60}분`}
                    </span>
                  </div>
                  <div className={`text-sm mt-1 ${textColor} flex items-center`}>
                    {Icon && <Icon size={14} className="mr-2" />}
                    {content}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoordinationDetailGrid;
