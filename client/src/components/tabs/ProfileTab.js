import React, { useState, useEffect, useCallback } from 'react';
import { userService } from '../../services/userService';
import ScheduleGridSelector from './ScheduleGridSelector';
import ScheduleExceptionEditor from '../schedule/ScheduleExceptionEditor';
import CustomAlertModal from '../modals/CustomAlertModal';
import { Edit, Save, XCircle, Trash2 } from 'lucide-react';

const ProfileTab = () => {
  const [defaultSchedule, setDefaultSchedule] = useState([]);
  const [scheduleExceptions, setScheduleExceptions] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [customAlert, setCustomAlert] = useState({ show: false, message: '', title: '' });

  const showAlert = useCallback((message, title = '알림') => {
    setCustomAlert({ show: true, message, title });
  }, []);

  const closeAlert = useCallback(() => {
    setCustomAlert({ show: false, message: '', title: '' });
  }, []);

  const fetchSchedule = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await userService.getUserSchedule();
      setDefaultSchedule(data.defaultSchedule || []);
      setScheduleExceptions(data.scheduleExceptions || []);
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
    // 서버로 보내기 전에 예외 일정 데이터를 정리합니다.
    const exceptionsToSave = scheduleExceptions.map(
      ({ title, startTime, endTime }) => ({ title, startTime, endTime })
    );

    try {
        await userService.updateUserSchedule({ 
          defaultSchedule, 
          scheduleExceptions: exceptionsToSave
        });
        showAlert('기본 시간표와 예외 일정이 저장되었습니다!', '저장 완료');
        setIsEditing(false); // 저장 후 편집 모드 종료
        fetchSchedule(); // 저장 후 최신 데이터 다시 불러오기
    } catch (err) {
        setError(err.message);
        showAlert('저장에 실패했습니다: ' + err.message, '오류');
    }
  };

  const handleCancel = () => {
    fetchSchedule(); // 원본 데이터 다시 불러오기
    setIsEditing(false);
  };

  const handleRemoveException = (exceptionId) => {
    if (!isEditing) return; // 편집 모드에서만 삭제 가능
    setScheduleExceptions(prev => prev.filter(ex => ex._id !== exceptionId));
  };

  if (isLoading) {
    return <div>로딩 중...</div>;
  }

  if (error) {
    return <div className="text-red-500">오류: {error}</div>;
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">나의 기본 시간표 설정</h2>
        <div className="flex space-x-2">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center"
              >
                <Save size={16} className="mr-2" />
                저장
              </button>
              <button
                onClick={() => {
                  setDefaultSchedule([]);
                  setScheduleExceptions([]);
                  showAlert('모든 일정이 초기화되었습니다.', '초기화 완료');
                }}
                className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 flex items-center"
              >
                <Trash2 size={16} className="mr-2" />
                전체 초기화
              </button>
              <button
                onClick={handleCancel}
                className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 flex items-center"
              >
                <XCircle size={16} className="mr-2" />
                취소
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 flex items-center"
            >
              <Edit size={16} className="mr-2" />
              편집
            </button>
          )}
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h3 className="text-lg font-semibold mb-3">주간 반복 일정</h3>
        <p className="text-sm text-gray-600 mb-4">
          {!isEditing 
            ? "현재 설정된 기본 주간 일정입니다. 편집하려면 우측 상단의 '편집' 버튼을 클릭하세요."
            : "시간표에서 반복적으로 일정이 있는 시간대를 클릭하여 설정하세요. 파란색으로 표시된 시간이 고정 일정입니다."}
        </p>
        <ScheduleGridSelector 
          schedule={defaultSchedule} 
          setSchedule={setDefaultSchedule} 
          readOnly={!isEditing}
          exceptions={scheduleExceptions}
          onRemoveException={handleRemoveException}
        />
      </div>

      <ScheduleExceptionEditor 
        exceptions={scheduleExceptions} 
        setExceptions={setScheduleExceptions} 
        isEditing={isEditing}
      />

      <CustomAlertModal
        isOpen={customAlert.show}
        onClose={closeAlert}
        title={customAlert.title}
        message={customAlert.message}
      />
    </div>
  );
};

export default ProfileTab;

// 예외 일정 에디터 (이 부분은 그대로 유지)
