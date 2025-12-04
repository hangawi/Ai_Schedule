/**
 * ===================================================================================================
 * ProfileTab/index.js - 사용자 프로필 및 선호시간/개인시간 관리 탭
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/ProfileTab/index.js
 *
 * 🎯 주요 기능:
 *    - 사용자의 주간 기본 스케줄, 예외 스케줄, 개인시간(식사, 수면 등)을 종합적으로 관리.
 *    - '편집 모드'를 통해 스케줄 CRUD(생성, 읽기, 업데이트, 삭제) 기능 제공.
 *    - 캘린더 뷰와 상세 시간 그리드 뷰를 통해 시각적으로 스케줄을 확인하고 수정.
 *    - 선호시간과 개인시간을 별도 섹션에서 관리.
 *    - 개인 정보(이름, 이메일 등) 수정 화면 제공.
 *
 * 🔗 연결된 파일:
 *    - ./hooks/* - 스케줄 데이터 로딩, 편집 상태, 캘린더 업데이트 등 복잡한 로직을 처리하는 커스텀 훅.
 *    - ./handlers/* - 저장, 취소, 자동 저장 등 주요 액션 핸들러 생성 함수.
 *    - ./components/* - 프로필 헤더, 선호시간 섹션 등 UI를 구성하는 하위 컴포넌트.
 *    - ../../calendar/CalendarView.js - 주간 캘린더 UI.
 *    - ../../calendar/DetailTimeGrid.js - 일간 상세 시간표 UI.
 *    - ../../schedule/PersonalTimeManager.js - 개인시간 관리 UI.
 *
 * 💡 UI 위치:
 *    - 앱 좌측 사이드바 > '내 프로필' 탭 클릭 시 표시되는 메인 화면.
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: '내 프로필' 탭의 전체적인 레이아웃과 데이터 흐름에 영향을 줍니다.
 *    - 스케줄 저장/취소 로직 변경: `./handlers/` 폴더의 `createSaveHandler`, `createCancelHandler` 수정.
 *    - 데이터 로딩 및 상태 관리 로직 변경: `./hooks/` 폴더의 `useScheduleData`, `useEditingState` 등 수정.
 *    - 캘린더 뷰의 동작 변경: `../../calendar/CalendarView.js` 컴포넌트 수정.
 *
 * 📝 참고사항:
 *    - `isEditing` 상태에 따라 '읽기 전용 모드'와 '편집 모드'가 전환됩니다.
 *    - 스케줄 데이터는 여러 커스텀 훅에 의해 관리되므로, 데이터 흐름을 이해하려면 훅의 로직을 파악하는 것이 중요합니다.
 *    - `autoSave` 기능은 사용자가 스케줄을 변경할 때 자동으로 임시 저장하는 역할을 합니다.
 *
 * ===================================================================================================
 */

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

/**
 * ProfileTab
 * @description '내 프로필' 탭의 메인 컴포넌트. 사용자의 스케줄과 개인 정보를 관리합니다.
 * @param {object} props - 컴포넌트 props
 * @param {function} props.onEditingChange - 편집 상태 변경 시 상위 컴포넌트로 알리는 콜백 함수
 * @returns {JSX.Element}
 */
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
