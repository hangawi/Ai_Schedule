/**
 * ===================================================================================================
 * CurrentEventNavigator.js - 실시간 일정 안내 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/coordination
 *
 * 🎯 주요 기능:
 *    - 현재 시간을 기준으로 지금 진행 중인 일정을 실시간으로 찾아 표시
 *    - 1분마다 현재 일정을 갱신
 *    - 진행 중인 일정이 '이동' 시간인지 '활동' 시간인지 구분하여 다른 메시지 표시
 *    - 진행 중인 일정이 없을 경우 "현재 진행 중인 일정이 없습니다" 메시지 표시
 *
 * 🔗 연결된 파일:
 *    - 이 컴포넌트를 사용하는 상위 페이지 (예: 조율 탭 대시보드)
 *    - lucide-react: 아이콘 라이브러리
 *
 * 💡 UI 위치:
 *    - 조율 탭 > 대시보드 내 '실시간 일정 안내' 카드
 *
 * ✏️ 수정 가이드:
 *    - 일정 갱신 주기 변경: `setInterval`의 두 번째 인자(60000ms) 수정
 *    - 현재 일정 판단 로직 변경: `findCurrentEvent` 함수 내부 로직 수정
 *    - '이동' 또는 '활동' 시간의 텍스트 메시지 형식 변경: `setCurrentEvent` 호출 시 `text` 속성 값 수정
 *
 * 📝 참고사항:
 *    - `useEffect`를 사용하여 컴포넌트 마운트 시 1분 간격의 인터벌을 설정하고, 언마운트 시 인터벌을 정리합니다.
 *    - `timeSlots`와 `travelSlots` 두 종류의 슬롯 데이터를 모두 확인하여 현재 일정을 판단합니다.
 *    - 사용자 이름을 표시하기 위해 `timeSlots`의 user ID와 `members` 배열의 정보를 매칭합니다.
 *
 * ===================================================================================================
 */

import React, { useState, useEffect } from 'react';
import { Navigation, Clock } from 'lucide-react';

/**
 * CurrentEventNavigator
 *
 * @description 현재 시간을 기준으로 진행 중인 일정을 찾아 표시하는 실시간 안내 컴포넌트입니다.
 * @param {Object} props - 컴포넌트 프롭스
 * @param {Array<Object>} [props.timeSlots=[]] - 활동(수업 등) 시간 슬롯 목록
 * @param {Array<Object>} [props.travelSlots=[]] - 이동 시간 슬롯 목록
 * @param {Array<Object>} [props.members=[]] - 방 멤버 목록 (사용자 이름 표시용)
 * @returns {JSX.Element} 실시간 일정 안내 컴포넌트
 *
 * @example
 * <CurrentEventNavigator
 *   timeSlots={activitySlots}
 *   travelSlots={travelSlots}
 *   members={roomMembers}
 * />
 */
const CurrentEventNavigator = ({ timeSlots = [], travelSlots = [], members = [] }) => {
  const [currentEvent, setCurrentEvent] = useState(null);

  useEffect(() => {
    const findCurrentEvent = () => {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const today = now.toISOString().split('T')[0];

      const timeToMinutes = (timeStr) => {
        if (!timeStr || !timeStr.includes(':')) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
      };

      const nowMinutes = timeToMinutes(currentTime);

      // Check travel slots first
      const currentTravel = travelSlots.find(slot => {
        const slotDate = new Date(slot.date).toISOString().split('T')[0];
        if (slotDate !== today) return false;
        const startMinutes = timeToMinutes(slot.startTime);
        const endMinutes = timeToMinutes(slot.endTime);
        return nowMinutes >= startMinutes && nowMinutes < endMinutes;
      });

      if (currentTravel) {
        setCurrentEvent({ type: 'travel', text: `이동 중: ${currentTravel.to} (으)로` });
        return;
      }

      // Check activity slots
      const currentActivity = timeSlots.find(slot => {
        if (slot.isTravel) return false;
        const slotDate = new Date(slot.date).toISOString().split('T')[0];
        if (slotDate !== today) return false;
        const startMinutes = timeToMinutes(slot.startTime);
        const endMinutes = timeToMinutes(slot.endTime);
        return nowMinutes >= startMinutes && nowMinutes < endMinutes;
      });

      if (currentActivity) {
        let memberName = '알 수 없는 사용자';
        const userId = currentActivity.user?._id || currentActivity.user;
        const member = members.find(m => (m.user?._id || m.user)?.toString() === userId?.toString());
        if (member && member.user) {
          memberName = `${member.user.firstName || ''} ${member.user.lastName || ''}`.trim() || '알 수 없는 사용자';
        }
        setCurrentEvent({ type: 'activity', text: `지금은 ${memberName}님의 일정입니다.` });
        return;
      }

      setCurrentEvent(null); // No event
    };

    findCurrentEvent(); // Initial check
    const intervalId = setInterval(findCurrentEvent, 60000); // Check every minute

    return () => clearInterval(intervalId);
  }, [timeSlots, travelSlots, members]);

  return (
    <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200 h-full flex flex-col">
      <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center">
        <Navigation size={16} className="mr-2 text-green-600" />
        실시간 일정 안내
      </h3>
      <div className="flex-grow flex items-center justify-center text-center">
        {currentEvent ? (
          <div className="flex flex-col items-center">
            <Clock size={24} className={`mb-2 ${currentEvent.type === 'travel' ? 'text-blue-500' : 'text-green-500'}`} />
            <p className="text-sm font-semibold text-gray-700">{currentEvent.text}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Clock size={24} className="mb-2 text-gray-400" />
            <p className="text-sm font-semibold text-gray-500">현재 진행 중인 일정이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CurrentEventNavigator;