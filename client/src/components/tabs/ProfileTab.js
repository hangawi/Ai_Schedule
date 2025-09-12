import React, { useState, useEffect, useCallback } from 'react';
import { userService } from '../../services/userService';
import ScheduleGridSelector from './ScheduleGridSelector'; // 새로 만든 컴포넌트 import
import { Plus, Trash2 } from 'lucide-react';

const ProfileTab = () => {
  const [defaultSchedule, setDefaultSchedule] = useState([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSchedule = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await userService.getUserSchedule();
      // API 응답이 없을 경우 빈 배열로 초기화
      setDefaultSchedule(data.defaultSchedule || []);
      
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const handleSave = async () => {
    try {
        await userService.updateUserSchedule({ defaultSchedule });
        alert('저장되었습니다!');
    } catch (err) {
        setError(err.message);
        alert('저장에 실패했습니다.');
    }
  };

  if (isLoading) {
    return <div>로딩 중...</div>;
  }

  if (error) {
    return <div className="text-red-500">오류: {error}</div>;
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4"> {/* New div for header */}
        <h2 className="text-2xl font-bold">나의 기본 시간표 설정</h2>
        <div className="flex space-x-2"> {/* New div for buttons */}
          {/* Refresh Button */}
          <button
            onClick={() => setDefaultSchedule([])}
            className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-opacity-50"
          >
            초기화버튼
          </button>
          {/* Save Button */}
          <button
            onClick={handleSave}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
          >
            저장
          </button>
        </div>
      </div>
      
      {/* 기존 Editor를 새로운 Grid Selector로 교체 */}
      <ScheduleGridSelector schedule={defaultSchedule} setSchedule={setDefaultSchedule} />

      

      
    </div>
  );
};

export default ProfileTab;

// 예외 일정 에디터 (이 부분은 그대로 유지)
