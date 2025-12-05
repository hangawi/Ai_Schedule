/**
 * ===================================================================================================
 * MemberScheduleModal.js - 다른 조원의 전체 시간표를 상세히 보여주는 모달
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/MemberScheduleModal.js
 *
 * 🎯 주요 기능:
 *    - 특정 조원(memberId)의 전체 스케줄(주간 반복, 특정일 선호, 예외, 개인시간)을 서버에서 가져와 표시.
 *    - `ScheduleGridSelector` 컴포넌트를 재사용하여 일관된 시간표 UI를 제공.
 *    - 가져온 `defaultSchedule` 데이터를 '주간 반복 일정'과 '특정일 선호 시간'으로 분리.
 *    - '특정일 선호 시간'을 '예외(exception)' 데이터 형태로 변환하여 기존 예외 데이터와 병합, `ScheduleGridSelector`에서 함께 표시.
 *    - 로딩 및 에러 상태, 데이터가 없는 경우에 대한 UI를 처리.
 *
 * 🔗 연결된 파일:
 *    - ../tabs/ScheduleGridSelector/index.js - 시간표 UI를 렌더링하는 핵심 재사용 컴포넌트.
 *    - ../../services/userService.js - 특정 멤버의 스케줄 데이터를 ID로 조회하는 API를 호출.
 *    - ./CoordinationTab.js (추정) - 멤버 목록에서 멤버 이름을 클릭했을 때 이 모달을 호출.
 *
 * 💡 UI 위치:
 *    - '일정 맞추기' 탭의 멤버 목록에서 특정 멤버를 클릭했을 때 나타나는 팝업 모달.
 *
 * ✏️ 수정 가이드:
 *    - 멤버의 스케줄 데이터를 처리하고 변환하는 로직을 변경하려면 `fetchMemberSchedule` 함수 내부를 수정해야 합니다.
 *    - 시간표가 표시되는 방식을 변경하려면 재사용되는 `ScheduleGridSelector` 컴포넌트를 수정해야 할 수 있습니다.
 *
 * 📝 참고사항:
 *    - 이 모달은 '읽기 전용'(`readOnly={true}`)으로, 데이터 조회 기능만 수행합니다.
 *    - 데이터 변환 로직(특정일 선호 -> 예외)은 `ScheduleGridSelector` 컴포넌트를 재사용하기 위한 중요한 처리 과정입니다.
 *    - `renderKey`와 `setTimeout`은 복잡한 자식 컴포넌트(`ScheduleGridSelector`)의 완전한 리렌더링을 보장하기 위해 사용된 기법입니다.
 *
 * ===================================================================================================
 */
import React, { useState, useEffect } from 'react';
import ScheduleGridSelector from '../tabs/ScheduleGridSelector'; // ScheduleGridSelector 재사용
import { userService } from '../../services/userService';
import { X } from 'lucide-react';

/**
 * MemberScheduleModal
 * @description 특정 조원의 전체 스케줄(선호시간, 개인시간, 예외 등)을 상세히 보여주는 읽기 전용 모달.
 * @param {object} props - 컴포넌트 props
 * @param {string} props.memberId - 조회할 멤버의 고유 ID.
 * @param {function} props.onClose - 모달을 닫는 함수.
 * @returns {JSX.Element|null} memberId가 없으면 null을 반환.
 */
const MemberScheduleModal = ({ memberId, onClose }) => {
  const [memberSchedule, setMemberSchedule] = useState([]);
  const [memberExceptions, setMemberExceptions] = useState([]); // State for exceptions
  const [memberPersonalTimes, setMemberPersonalTimes] = useState([]); // State for personal times
  const [memberName, setMemberName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [renderKey, setRenderKey] = useState(0); // New state for forcing re-render

  // 보기 모드 상태 추가
  const [viewMode, setViewMode] = useState('week'); // 'week', 'month'
  const [showFullDay, setShowFullDay] = useState(false); // 24시간 vs 기본시간 (9-18시)
  const [showMerged, setShowMerged] = useState(false); // 병합 vs 분할 보기

  useEffect(() => {
    const fetchMemberSchedule = async () => {
      if (!memberId) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await userService.getUserScheduleById(memberId);

        // defaultSchedule에서 specificDate가 있는 것과 없는 것을 분리
        const allDefaultSchedule = data.defaultSchedule || [];
        const scheduleWithSpecificDate = allDefaultSchedule.filter(slot => slot.specificDate);
        const scheduleWithoutSpecificDate = allDefaultSchedule.filter(slot => !slot.specificDate);

        // specificDate가 없는 것만 주간 반복 일정으로 사용 (일~토 모두 포함)
        const weekdaySchedule = scheduleWithoutSpecificDate;

        // specificDate가 있는 것은 exceptions로 변환
        const convertedExceptions = scheduleWithSpecificDate.map(s => ({
          title: `선호 시간 (${s.priority === 3 ? '선호' : s.priority === 2 ? '보통' : '조정가능'})`,
          startTime: s.startTime,
          endTime: s.endTime,
          specificDate: s.specificDate,
          priority: s.priority,
          isHoliday: false,
          isAllDay: false
        }));

        // 기존 exceptions와 병합
        const exceptions = [...(data.scheduleExceptions || []), ...convertedExceptions];

        // Process personalTimes (personal blocked times)
        const personalTimes = data.personalTimes || [];

        // 🔍 디버깅 로그
        console.log('============================================');
        console.log('📊 MemberScheduleModal - 받은 데이터:');
        console.log('조원 이름:', `${data.firstName || ''} ${data.lastName || ''}`.trim());
        console.log('defaultSchedule 개수:', allDefaultSchedule.length);
        console.log('scheduleExceptions 개수:', (data.scheduleExceptions || []).length);
        console.log('personalTimes 개수:', personalTimes.length);
        console.log('personalTimes 내용:', JSON.stringify(personalTimes, null, 2));
        console.log('============================================');

        // Separate schedule data for display
        setMemberSchedule(weekdaySchedule);
        setMemberExceptions(exceptions);
        setMemberPersonalTimes(personalTimes);

        setMemberName(`${data.firstName || ''} ${data.lastName || ''}`.trim() || '알 수 없음');
        
        // Force re-render to ensure grid updates
        setTimeout(() => {
          setRenderKey(prev => prev + 1);
        }, 50);

      } catch (err) {
        setError(`조원 일정을 불러오는데 실패했습니다: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMemberSchedule();
  }, [memberId]);

  if (!memberId) return null;


  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800">{memberName}님의 시간표</h3>
        </div>

        {isLoading && <div className="text-center py-4">로딩 중...</div>}
        {error && <div className="text-red-500 text-center py-4">오류: {error}</div>}

        {!isLoading && !error && (
          <div className="flex-1 overflow-hidden">
            <div className="text-sm text-gray-600 mb-4 bg-gray-50 p-3 rounded">
              <div className="flex items-center justify-between">
                <div>
                  <div><strong>데이터 요약:</strong></div>
                  <div>• 총 일정: {memberSchedule.length + memberExceptions.length + memberPersonalTimes.length}개</div>
                  <div>• 주간 반복 일정: {memberSchedule.length}개 • 예외 일정: {memberExceptions.length}개 • 개인 시간: {memberPersonalTimes.length}개</div>
                </div>
                <div className="text-xs text-gray-500">
                  💡 스크롤하여 전체 시간표를 확인하세요
                </div>
              </div>
            </div>

            {(memberSchedule.length > 0 || memberExceptions.length > 0 || memberPersonalTimes.length > 0) ? (
              <div className="overflow-auto" style={{ maxHeight: 'calc(90vh - 10px)' }}>
                <ScheduleGridSelector
                  key={renderKey}
                  schedule={memberSchedule}
                  exceptions={memberExceptions}
                  personalTimes={memberPersonalTimes}
                  readOnly={true}
                  enableMonthView={true}
                  showViewControls={true}
                  defaultShowMerged={true}
                />
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 space-y-2">
                <div className="text-lg">📅</div>
                <div>등록된 일정이 없습니다.</div>
                <div className="text-sm">
                  이 조원은 아직 시간표를 설정하지 않았거나,
                  <br />월-금 범위에 가능한 시간이 없습니다.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberScheduleModal;