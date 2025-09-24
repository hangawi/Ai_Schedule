import React, { useState, useEffect } from 'react';
import ScheduleGridSelector from '../tabs/ScheduleGridSelector'; // ScheduleGridSelector 재사용
import { userService } from '../../services/userService';
import { X } from 'lucide-react';

const MemberScheduleModal = ({ memberId, onClose }) => {
  const [memberSchedule, setMemberSchedule] = useState([]);
  const [memberExceptions, setMemberExceptions] = useState([]); // State for exceptions
  const [memberPersonalTimes, setMemberPersonalTimes] = useState([]); // State for personal times
  const [memberName, setMemberName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [renderKey, setRenderKey] = useState(0); // New state for forcing re-render

  useEffect(() => {
    const fetchMemberSchedule = async () => {
      if (!memberId) return;
      setIsLoading(true);
      setError(null);
      try {
        console.log('Fetching schedule for member:', memberId);
        const data = await userService.getUserScheduleById(memberId);
        console.log('Received raw data:', JSON.stringify(data, null, 2));
        // Process defaultSchedule (recurring weekly schedule) - filter for weekdays only
        // User schema uses 0-6 (Sun-Sat), we want Mon-Fri which is 1-5
        const weekdaySchedule = (data.defaultSchedule || []).filter(slot => slot.dayOfWeek >= 1 && slot.dayOfWeek <= 5);

        // Process scheduleExceptions (date-specific schedule overrides)
        const exceptions = data.scheduleExceptions || [];

        // Process personalTimes (personal blocked times)
        const personalTimes = data.personalTimes || [];

        // Combine all schedule data for display
        setMemberSchedule([...weekdaySchedule, ...exceptions]);
        setMemberExceptions(exceptions);
        setMemberPersonalTimes(personalTimes);

        console.log('Processed schedule data:', {
          weekdaySchedule: weekdaySchedule.length,
          exceptions: exceptions.length,
          personalTimes: personalTimes.length,
          totalScheduleSlots: weekdaySchedule.length + exceptions.length
        });
        console.log('weekdaySchedule details:', JSON.stringify(weekdaySchedule.slice(0, 3), null, 2));
        console.log('exceptions details:', JSON.stringify(exceptions.slice(0, 3), null, 2));
        console.log('personalTimes details:', JSON.stringify(personalTimes.slice(0, 3), null, 2));
        setMemberName(`${data.firstName || ''} ${data.lastName || ''}`.trim() || data.name || '알 수 없음');
        setTimeout(() => {
          setRenderKey(prev => prev + 1);
        }, 50);
      } catch (err) {
        console.error('Failed to fetch member schedule:', err);
        setError(`조원 일정을 불러오는데 실패했습니다: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMemberSchedule();
  }, [memberId]);

  if (!memberId) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800">{memberName}님의 주간 반복 일정 (ID: {memberId})</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
            <X size={24} />
          </button>
        </div>

        {isLoading && <div className="text-center py-4">로딩 중...</div>}
        {error && <div className="text-red-500 text-center py-4">오류: {error}</div>}
        
        {!isLoading && !error && (
          <div>
            <div className="text-sm text-gray-600 mb-4 bg-gray-50 p-3 rounded">
              <div><strong>데이터 요약:</strong></div>
              <div>• 총 일정: {memberSchedule.length}개</div>
              <div>• 주간 반복 일정: {memberSchedule.length - memberExceptions.length}개</div>
              <div>• 예외 일정: {memberExceptions.length}개</div>
              <div>• 개인 시간: {memberPersonalTimes.length}개</div>
              <div className="text-xs mt-2 text-gray-500">
                콘솔에서 상세 데이터를 확인하세요.
              </div>
            </div>
            {(memberSchedule.length > 0 || memberExceptions.length > 0 || memberPersonalTimes.length > 0) ? (
              <ScheduleGridSelector
                key={renderKey}
                schedule={memberSchedule}
                setSchedule={() => {}} // Read-only
                readOnly={true}
                exceptions={memberExceptions} // Pass exceptions to the grid
                personalTimes={memberPersonalTimes} // Pass personal times to the grid
              />
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