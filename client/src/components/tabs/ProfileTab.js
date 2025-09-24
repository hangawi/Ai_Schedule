import React, { useState, useEffect, useCallback } from 'react';
import { userService } from '../../services/userService';
import CalendarView from '../calendar/CalendarView';
import DetailTimeGrid from '../calendar/DetailTimeGrid';
import PersonalTimeManager from '../schedule/PersonalTimeManager';
import CustomAlertModal from '../modals/CustomAlertModal';
import { Edit, Save, XCircle, Trash2 } from 'lucide-react';

const ProfileTab = ({ onEditingChange }) => {
  const [defaultSchedule, setDefaultSchedule] = useState([]);
  const [scheduleExceptions, setScheduleExceptions] = useState([]);
  const [personalTimes, setPersonalTimes] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showDetailGrid, setShowDetailGrid] = useState(false);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [customAlert, setCustomAlert] = useState({ show: false, message: '', title: '' });

  // 편집 모드 진입 시 초기 상태 저장 (취소 시 복원용)
  const [initialState, setInitialState] = useState({
    defaultSchedule: [],
    scheduleExceptions: [],
    personalTimes: []
  });

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

  // 편집 상태가 변경될 때 부모 컴포넌트에 알림
  useEffect(() => {
    if (onEditingChange) {
      onEditingChange(isEditing);
    }
  }, [isEditing, onEditingChange]);

  // calendarUpdate 이벤트 수신하여 스케줄 새로고침
  useEffect(() => {
    const handleCalendarUpdate = async (event) => {
      if (!isEditing) {
        // 편집 모드가 아닐 때는 전체 새로고침
        fetchSchedule();
      } else {
        // 편집 모드일 때는 새로 추가된 항목만 처리
        if (event.detail && event.detail.type === 'add' && event.detail.chatResponse) {
          const { chatResponse } = event.detail;

          // 챗봇에서 추가된 일정 정보를 10분 단위로 분할하여 scheduleExceptions에 추가
          if (chatResponse.startDateTime && chatResponse.endDateTime) {
            const startDateTime = new Date(chatResponse.startDateTime);
            const endDateTime = new Date(chatResponse.endDateTime);
            const newExceptions = [];

            // 10분 단위로 분할하여 예외 일정들 생성
            for (let current = new Date(startDateTime); current < endDateTime; current.setMinutes(current.getMinutes() + 10)) {
              const slotEndTime = new Date(current);
              slotEndTime.setMinutes(slotEndTime.getMinutes() + 10);

              // 마지막 슬롯이 종료 시간을 넘지 않도록 조정
              if (slotEndTime > endDateTime) {
                slotEndTime.setTime(endDateTime.getTime());
              }

              const newException = {
                _id: `temp_${Date.now()}_${current.getTime()}`, // 임시 ID (각 슬롯마다 고유)
                title: chatResponse.title || '새 일정',
                startTime: current.toISOString(),
                endTime: slotEndTime.toISOString(),
                specificDate: startDateTime.toISOString().split('T')[0],
                isHoliday: false,
                isAllDay: chatResponse.isAllDay || false,
                priority: chatResponse.priority || 3
              };

              newExceptions.push(newException);
            }

            setScheduleExceptions(prev => [...prev, ...newExceptions]);
          }
        } else {
          // 이벤트 데이터가 없는 경우 기존 방식으로 폴백 (하지만 편집 모드에서는 아무것도 하지 않음)
        }
      }
    };

    window.addEventListener('calendarUpdate', handleCalendarUpdate);
    return () => {
      window.removeEventListener('calendarUpdate', handleCalendarUpdate);
    };
  }, [fetchSchedule, isEditing]);


  // 편집 모드 진입 추적
  const [editingStarted, setEditingStarted] = useState(false);
  const [justCancelled, setJustCancelled] = useState(false);
  const [wasCleared, setWasCleared] = useState(false);

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

        // 저장 후 서버에서 최신 데이터 동기화
        const freshData = await userService.getUserSchedule();

        // 서버 데이터로 무조건 업데이트 (길이 조건 제거)
        setDefaultSchedule(freshData.defaultSchedule || []);
        setScheduleExceptions(freshData.scheduleExceptions || []);
        setPersonalTimes(freshData.personalTimes || []);

        // CalendarView 강제 리렌더링
        window.dispatchEvent(new Event('calendarUpdate'));
    } catch (err) {
        setError(err.message);
        showAlert('저장에 실패했습니다: ' + err.message, '오류');
    }
  };

  const handleCancel = async () => {
    // 편집 모드 진입 시 저장된 초기 상태로 복원
    setDefaultSchedule([...initialState.defaultSchedule]);
    setScheduleExceptions([...initialState.scheduleExceptions]);
    setPersonalTimes([...initialState.personalTimes]);

    try {
      // 서버에도 초기 상태로 복원
      const exceptionsToRestore = initialState.scheduleExceptions.map(
        ({ title, startTime, endTime, isHoliday, isAllDay, _id, specificDate, priority }) =>
        ({ title, startTime, endTime, isHoliday, isAllDay, _id, specificDate, priority })
      );
      const personalTimesToRestore = initialState.personalTimes.map(
        ({ title, type, startTime, endTime, days, isRecurring, id }) => {
          return { title, type, startTime, endTime, days, isRecurring, id };
        }
      );

      await userService.updateUserSchedule({
        defaultSchedule: initialState.defaultSchedule,
        scheduleExceptions: exceptionsToRestore,
        personalTimes: personalTimesToRestore
      });
    } catch (err) {
      // 서버 복원 실패해도 UI는 복원된 상태로 유지
    }

    setIsEditing(false);
    setWasCleared(false); // 초기화 상태도 리셋
    setJustCancelled(true);

    // 일정 시간 후 취소 상태 해제
    setTimeout(() => {
      setJustCancelled(false);
    }, 1000);
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
    // 편집 모드이거나 방금 취소한 상태일 때는 자동 저장하지 않음
    if (isEditing || justCancelled) {
      return;
    }

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

    } catch (err) {
      // 에러 발생 시 무시 (편집 모드가 아닐 때만 호출되므로 사용자에게 알리지 않음)
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
                onClick={() => {
                  // 편집 모드에서는 UI에서만 초기화 (서버에는 저장 안함)
                  setDefaultSchedule([]);
                  setScheduleExceptions([]);
                  setPersonalTimes([]);
                  setWasCleared(true); // 초기화됨을 표시

                  showAlert('편집 모드에서 초기화되었습니다. 저장 버튼을 눌러야 실제로 저장됩니다.', '초기화');
                }}
                className="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 flex items-center shadow-md transition-all duration-200 text-sm"
              >
                <Trash2 size={14} className="mr-1" />
                전체 초기화
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                // 편집 모드 진입 시 현재 상태 저장
                setInitialState({
                  defaultSchedule: [...defaultSchedule],
                  scheduleExceptions: [...scheduleExceptions],
                  personalTimes: [...personalTimes]
                });
                setWasCleared(false); // 편집 시작 시 초기화 상태 리셋
                setIsEditing(true);
              }}
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
        </div>

        <p className="text-sm text-gray-600 mb-4">
          {!isEditing
            ? "현재 설정된 기본 일정을 확인할 수 있습니다. 날짜를 클릭하면 세부 시간표를 볼 수 있습니다."
            : "날짜를 클릭하여 세부 시간표를 설정하세요. 파란색은 기본 일정, 초록색은 예외 일정, 빨간색은 개인 시간입니다."}
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
        />
      )}
    </div>
  );
};

export default ProfileTab;

// 예외 일정 에디터 (이 부분은 그대로 유지)
