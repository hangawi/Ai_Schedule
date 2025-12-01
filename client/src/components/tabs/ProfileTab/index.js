import React, { useState, useCallback } from 'react';
import CalendarView from '../../calendar/CalendarView';
import DetailTimeGrid from '../../calendar/DetailTimeGrid';
import PersonalTimeManager from '../../schedule/PersonalTimeManager';
import PersonalInfoEdit from '../../profile/PersonalInfoEdit';
import CustomAlertModal from '../../modals/CustomAlertModal';

// Hooks
import { useScheduleData } from './hooks/useScheduleData';
import { useEditingState } from './hooks/useEditingState';
import { useCalendarUpdate } from './hooks/useCalendarUpdate';
import { useFilteredSchedule } from './hooks/useFilteredSchedule';

// Handlers
import { createSaveHandler } from './handlers/createSaveHandler';
import { createCancelHandler } from './handlers/createCancelHandler';
import { createAutoSaveHandler } from './handlers/createAutoSaveHandler';

// Components
import { LoadingState } from './components/LoadingState';
import { ErrorState } from './components/ErrorState';
import { ProfileHeader } from './components/ProfileHeader';
import { PreferenceTimeSection } from './components/PreferenceTimeSection';

// Messages
import { MESSAGES } from './constants/messages';

const ProfileTab = ({ onEditingChange }) => {
  const [showPersonalInfo, setShowPersonalInfo] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [viewingMonth, setViewingMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [showDetailGrid, setShowDetailGrid] = useState(false);
  const [customAlert, setCustomAlert] = useState({ show: false, message: '', title: '' });

  // 스케줄 데이터 관리
  const {
    defaultSchedule,
    setDefaultSchedule,
    scheduleExceptions,
    setScheduleExceptions,
    personalTimes,
    setPersonalTimes,
    isLoading,
    error,
    setError,
    fetchSchedule
  } = useScheduleData();

  // 편집 상태 관리
  const {
    justCancelled,
    setJustCancelled,
    wasCleared,
    setWasCleared,
    initialState,
    setInitialState
  } = useEditingState(
    isEditing,
    onEditingChange,
    defaultSchedule,
    scheduleExceptions,
    personalTimes
  );

  // 필터링된 스케줄
  const { filteredDefaultSchedule, filteredPersonalTimes, filteredScheduleExceptions } = useFilteredSchedule(
    defaultSchedule,
    personalTimes,
    scheduleExceptions,
    viewingMonth
  );

  // 알림 관련
  const showAlert = useCallback((message, title = '알림') => {
    setCustomAlert({ show: true, message, title });
  }, []);

  const closeAlert = useCallback(() => {
    setCustomAlert({ show: false, message: '', title: '' });
  }, []);

  // calendarUpdate 이벤트 처리
  useCalendarUpdate(
    fetchSchedule,
    isEditing,
    wasCleared,
    setPersonalTimes,
    setScheduleExceptions,
    setDefaultSchedule
  );

  // 핸들러 생성
  const handleSave = createSaveHandler(
    defaultSchedule,
    scheduleExceptions,
    personalTimes,
    setIsEditing,
    setDefaultSchedule,
    setScheduleExceptions,
    setPersonalTimes,
    setError,
    showAlert
  );

  const handleCancel = createCancelHandler(
    initialState,
    setDefaultSchedule,
    setScheduleExceptions,
    setPersonalTimes,
    setIsEditing,
    setWasCleared,
    setJustCancelled
  );

  const autoSave = createAutoSaveHandler(
    isEditing,
    justCancelled,
    defaultSchedule,
    scheduleExceptions,
    personalTimes
  );

  // 기타 핸들러
  const handleRemoveException = (exceptionId) => {
    if (!isEditing) return;
    setScheduleExceptions(prev => prev.filter(ex => ex._id !== exceptionId));
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
    setShowDetailGrid(true);
  };

  const handleCloseDetailGrid = () => {
    setShowDetailGrid(false);
    setSelectedDate(null);
  };

  const handleStartEdit = () => {
    setInitialState({
      defaultSchedule: [...defaultSchedule],
      scheduleExceptions: [...scheduleExceptions],
      personalTimes: [...personalTimes]
    });
    setWasCleared(false);
    setIsEditing(true);
  };

  const handleClearAll = () => {
    setDefaultSchedule([]);
    setScheduleExceptions([]);
    setPersonalTimes([]);
    setWasCleared(true);
  };

  // 로딩/에러 상태
  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  // 개인정보 수정 뷰
  if (showPersonalInfo) {
    return (
      <div className="p-4">
        <ProfileHeader
          isEditing={false}
          showPersonalInfo={showPersonalInfo}
          setShowPersonalInfo={setShowPersonalInfo}
        />
        <PersonalInfoEdit />
      </div>
    );
  }

  // 메인 뷰
  return (
    <div className="p-4">
      <ProfileHeader
        isEditing={isEditing}
        showPersonalInfo={showPersonalInfo}
        setShowPersonalInfo={setShowPersonalInfo}
        onSave={handleSave}
        onCancel={handleCancel}
        onStartEdit={handleStartEdit}
        onClearAll={handleClearAll}
        showAlert={showAlert}
      />

      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">일정 관리</h3>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          {!isEditing ? MESSAGES.VIEW_INFO_READ_ONLY : MESSAGES.VIEW_INFO_EDITING}
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
          onMonthChange={setViewingMonth}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <PreferenceTimeSection
          filteredDefaultSchedule={filteredDefaultSchedule}
          defaultSchedule={defaultSchedule}
          filteredScheduleExceptions={filteredScheduleExceptions}
          scheduleExceptions={scheduleExceptions}
        />

        <div>
          <PersonalTimeManager
            personalTimes={filteredPersonalTimes}
            setPersonalTimes={setPersonalTimes}
            isEditing={isEditing}
            onAutoSave={autoSave}
          />
        </div>
      </div>

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
