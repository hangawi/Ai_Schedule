import React, { useState, useEffect } from 'react';
import ScheduleGridSelector from '../tabs/ScheduleGridSelector'; // ScheduleGridSelector 재사용
import { userService } from '../../services/userService';
import { X } from 'lucide-react';

const MemberScheduleModal = ({ memberId, onClose }) => {
  const [memberSchedule, setMemberSchedule] = useState([]);
  const [memberExceptions, setMemberExceptions] = useState([]); // State for exceptions
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
        const data = await userService.getUserScheduleById(memberId);
        setMemberSchedule((data.defaultSchedule || []).filter(slot => slot.dayOfWeek >= 1 && slot.dayOfWeek <= 5));
        setMemberExceptions(data.scheduleExceptions || []); // Set exceptions
        setMemberName(`${data.firstName || ''} ${data.lastName || ''}`.trim() || '알 수 없음');
        setTimeout(() => {
          setRenderKey(prev => prev + 1);
        }, 50);
      } catch (err) {
        // Failed to fetch member schedule - silently handle error
        setError('조원 일정을 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMemberSchedule();
  }, [memberId]);

  if (!memberId) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800">{memberName}님의 주간 반복 일정</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
            <X size={24} />
          </button>
        </div>

        {isLoading && <div className="text-center py-4">로딩 중...</div>}
        {error && <div className="text-red-500 text-center py-4">오류: {error}</div>}
        
        {!isLoading && !error && (memberSchedule.length > 0 || memberExceptions.length > 0) && (
          <ScheduleGridSelector 
            key={renderKey}
            schedule={memberSchedule} 
            setSchedule={() => {}} // Read-only
            readOnly={true}
            exceptions={memberExceptions} // Pass exceptions to the grid
          />
        )}

        {!isLoading && !error && memberSchedule.length === 0 && memberExceptions.length === 0 && (
          <div className="text-center py-4 text-gray-500">등록된 주간 반복 일정이 없습니다.</div>
        )}
      </div>
    </div>
  );
};

export default MemberScheduleModal;