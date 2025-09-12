import React, { useState, useEffect } from 'react';
import ScheduleGridSelector from '../tabs/ScheduleGridSelector'; // ScheduleGridSelector 재사용
import { userService } from '../../services/userService';
import { X } from 'lucide-react';

const MemberScheduleModal = ({ memberId, onClose }) => {
  const [memberSchedule, setMemberSchedule] = useState([]);
  const [memberName, setMemberName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMemberSchedule = async () => {
      if (!memberId) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await userService.getUserScheduleById(memberId);
        setMemberSchedule(data.defaultSchedule || []);
        setMemberName(`${data.firstName || ''} ${data.lastName || ''}`.trim() || '알 수 없음');
      } catch (err) {
        console.error('Failed to fetch member schedule:', err); // Existing error log
        setError('조원 일정을 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMemberSchedule();
  }, [memberId]);

  if (!memberId) return null; // memberId가 없으면 렌더링하지 않음


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
        {!isLoading && !error && (
          <ScheduleGridSelector 
            schedule={memberSchedule} 
            setSchedule={() => {}} // 읽기 전용이므로 빈 함수 전달
          />
        )}
      </div>
    </div>
  );
};

export default MemberScheduleModal;
