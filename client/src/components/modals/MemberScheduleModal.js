import React, { useState, useEffect } from 'react';
import ScheduleGridSelector from '../tabs/ScheduleGridSelector'; // ScheduleGridSelector 재사용
import { userService } from '../../services/userService';
import { X, Grid, Calendar, Clock, Merge, Split, ChevronLeft, ChevronRight } from 'lucide-react';

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

        // Separate schedule data for display
        setMemberSchedule(weekdaySchedule);
        setMemberExceptions(exceptions);
        setMemberPersonalTimes(personalTimes);

        setMemberName(`${data.firstName || ''} ${data.lastName || ''}`.trim() || data.name || '알 수 없음');
        
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
      <div className="bg-white p-4 rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
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
              <div className="overflow-auto max-h-[55vh]">
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