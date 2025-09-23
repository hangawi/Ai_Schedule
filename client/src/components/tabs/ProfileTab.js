import React, { useState, useEffect, useCallback } from 'react';
import { userService } from '../../services/userService';
import CalendarView from '../calendar/CalendarView';
import DetailTimeGrid from '../calendar/DetailTimeGrid';
import PersonalTimeManager from '../schedule/PersonalTimeManager';
import CustomAlertModal from '../modals/CustomAlertModal';
import { Edit, Save, XCircle, Trash2, Calendar, Grid } from 'lucide-react';

const ProfileTab = () => {
  const [defaultSchedule, setDefaultSchedule] = useState([]);
  const [scheduleExceptions, setScheduleExceptions] = useState([]);
  const [personalTimes, setPersonalTimes] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [viewMode, setViewMode] = useState('month'); // 'month' or 'week'
  const [selectedDate, setSelectedDate] = useState(null);
  const [showDetailGrid, setShowDetailGrid] = useState(false);
  
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
      setPersonalTimes(data.personalTimes || []);
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

  // 개인시간 상태 변화 추적
  useEffect(() => {
    console.log('Personal times state changed:', personalTimes);
  }, [personalTimes]);

  // 편집 모드 진입 추적
  const [editingStarted, setEditingStarted] = useState(false);

  useEffect(() => {
    if (isEditing && !editingStarted) {
      setEditingStarted(true);
    } else if (!isEditing) {
      setEditingStarted(false);
    }
  }, [isEditing]);

  useEffect(() => {
    if (isEditing && !editingStarted) {
      setEditingStarted(true);
    } else if (!isEditing) {
      setEditingStarted(false);
    }
  }, [isEditing]);

  const handleSave = async () => {
    // 서버로 보낼 데이터를 현재 최신 상태(state) 기준으로 정리합니다.
    const exceptionsToSave = scheduleExceptions.map(
      ({ title, startTime, endTime, isHoliday, isAllDay, _id, specificDate, priority }) =>
      ({ title, startTime, endTime, isHoliday, isAllDay, _id, specificDate, priority })
    );
    const personalTimesToSave = personalTimes.map(
      ({ title, type, startTime, endTime, days, isRecurring, id }) => {
        return { title, type, startTime, endTime, days, isRecurring, id };
      }
    );

    try {
        await userService.updateUserSchedule({
          defaultSchedule,
          scheduleExceptions: exceptionsToSave,
          personalTimes: personalTimesToSave
        });
        showAlert('기본 시간표, 예외 일정 및 개인 시간이 저장되었습니다!', '저장 완료');
        setIsEditing(false);

        // 저장 후 서버에서 최신 데이터 동기화 (선택적으로 처리)
        const freshData = await userService.getUserSchedule();

        // 서버에서 받은 데이터가 현재 상태보다 많은 경우만 업데이트
        if (freshData.defaultSchedule && freshData.defaultSchedule.length >= defaultSchedule.length) {
          setDefaultSchedule(freshData.defaultSchedule);
        }
        if (freshData.scheduleExceptions && freshData.scheduleExceptions.length >= scheduleExceptions.length) {
          setScheduleExceptions(freshData.scheduleExceptions);
        }
        if (freshData.personalTimes && freshData.personalTimes.length >= personalTimes.length) {
          setPersonalTimes(freshData.personalTimes);
        }

        // CalendarView 강제 리렌더링
        window.dispatchEvent(new Event('calendarUpdate'));
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
    if (!isEditing) return;
    setScheduleExceptions(prev => prev.filter(ex => ex._id !== exceptionId));
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
    setShowDetailGrid(true);
  };

  const autoSave = async () => {

    try {
      const exceptionsToSave = scheduleExceptions.map(
        ({ title, startTime, endTime, isHoliday, isAllDay, _id, specificDate, priority }) =>
        ({ title, startTime, endTime, isHoliday, isAllDay, _id, specificDate, priority })
      );
      const personalTimesToSave = personalTimes.map(
        ({ title, type, startTime, endTime, days, isRecurring, id }) => {
          return { title, type, startTime, endTime, days, isRecurring, id };
        }
      );


      await userService.updateUserSchedule({
        defaultSchedule,
        scheduleExceptions: exceptionsToSave,
        personalTimes: personalTimesToSave
      });


      // 저장 후 서버에서 최신 데이터 동기화 (주석처리해서 덮어쓰기 방지)
      // const freshData = await userService.getUserSchedule();
      // console.log('서버에서 받은 최신 데이터:', freshData);

      // setDefaultSchedule(freshData.defaultSchedule || []);
      // setScheduleExceptions(freshData.scheduleExceptions || []);
      // setPersonalTimes(freshData.personalTimes || []);


    } catch (err) {
    }
  };

  const handleCloseDetailGrid = () => {
    setShowDetailGrid(false);
    setSelectedDate(null);
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
        <div className="flex flex-wrap gap-2 items-center">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 flex items-center shadow-md transition-all duration-200"
              >
                <Save size={16} className="mr-2" />
                저장
              </button>
              <button
                onClick={handleCancel}
                className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 flex items-center shadow-md transition-all duration-200"
              >
                <XCircle size={16} className="mr-2" />
                취소
              </button>
              <div className="border-l-2 border-gray-300 h-8 mx-1"></div>
              <button
                onClick={async () => {
                  try {
                    // UI 상태를 먼저 초기화
                    setDefaultSchedule([]);
                    setScheduleExceptions([]);
                    setPersonalTimes([]);

                    // 서버에 초기화 요청
                    await userService.updateUserSchedule({
                      defaultSchedule: [],
                      scheduleExceptions: [],
                      personalTimes: []
                    });

                    showAlert('모든 일정이 초기화되었습니다.', '초기화 완료');
                  } catch (err) {
                    showAlert('초기화에 실패했습니다: ' + err.message, '오류');
                    // 실패 시 원본 데이터 복구
                    fetchSchedule();
                  }
                }}
                className="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 flex items-center shadow-md transition-all duration-200 text-sm"
              >
                <Trash2 size={14} className="mr-1" />
                전체 초기화
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center shadow-md transition-all duration-200"
            >
              <Edit size={16} className="mr-2" />
              편집
            </button>
          )}
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">일정 관리</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'month'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <Calendar size={16} className="mr-1 inline" />
              월간
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'week'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <Grid size={16} className="mr-1 inline" />
              주간
            </button>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          {!isEditing
            ? "현재 설정된 기본 일정을 확인할 수 있습니다. 날짜를 클릭하면 세부 시간표를 볼 수 있습니다."
            : "날짜를 클릭하여 세부 시간표를 설정하세요. 파란색은 기본 일정, 회색은 예외 일정, 빨간색은 개인 시간입니다."}
        </p>

        <CalendarView
          schedule={defaultSchedule}
          setSchedule={setDefaultSchedule}
          readOnly={!isEditing}
          exceptions={scheduleExceptions}
          personalTimes={personalTimes}
          onRemoveException={handleRemoveException}
          onDateClick={handleDateClick}
          selectedDate={selectedDate}
          viewMode={viewMode}
          onShowAlert={showAlert}
          onAutoSave={autoSave}
        />
      </div>


      <PersonalTimeManager
        personalTimes={personalTimes}
        setPersonalTimes={setPersonalTimes}
        isEditing={isEditing}
        onAutoSave={autoSave}
      />

      <CustomAlertModal
        isOpen={customAlert.show}
        onClose={closeAlert}
        title={customAlert.title}
        message={customAlert.message}
      />

      {showDetailGrid && selectedDate && (
        <DetailTimeGrid
          selectedDate={selectedDate}
          schedule={defaultSchedule}
          setSchedule={setDefaultSchedule}
          readOnly={!isEditing}
          exceptions={scheduleExceptions}
          setExceptions={setScheduleExceptions}
          personalTimes={personalTimes}
          onClose={handleCloseDetailGrid}
          onSave={autoSave}
          showFullDay={false}
          viewMode={viewMode}
        />
      )}
    </div>
  );
};

export default ProfileTab;

// 예외 일정 에디터 (이 부분은 그대로 유지)
