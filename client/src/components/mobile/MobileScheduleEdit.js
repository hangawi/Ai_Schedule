import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Save, Trash2, Calendar } from 'lucide-react';
import { userService } from '../../services/userService';
import CalendarView from '../calendar/CalendarView';
import PersonalTimeManager from '../schedule/PersonalTimeManager';
import CustomAlertModal from '../modals/CustomAlertModal';
import './MobileScheduleEdit.css';

const MobileScheduleEdit = ({ onBack }) => {
  const [defaultSchedule, setDefaultSchedule] = useState([]);
  const [scheduleExceptions, setScheduleExceptions] = useState([]);
  const [personalTimes, setPersonalTimes] = useState([]);
  const [initialState, setInitialState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [customAlert, setCustomAlert] = useState({ show: false, message: '', title: '' });
  const [viewingMonth, setViewingMonth] = useState(new Date());
  const [activeTab, setActiveTab] = useState('schedule'); // 'schedule' or 'personal'

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        setIsLoading(true);
        const data = await userService.getUserSchedule();
        const schedule = data.defaultSchedule || [];
        const exceptions = data.scheduleExceptions || [];
        const personal = data.personalTimes || [];
        
        setDefaultSchedule(schedule);
        setScheduleExceptions(exceptions);
        setPersonalTimes(personal);
        
        // 초기 상태 저장 (취소 시 복원용)
        setInitialState({
          defaultSchedule: [...schedule],
          scheduleExceptions: [...exceptions],
          personalTimes: [...personal]
        });
      } catch (error) {
        setMessage({ type: 'error', text: '일정을 불러오는데 실패했습니다.' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchSchedule();
  }, []);

  const showAlert = useCallback((message, title = '알림') => {
    setCustomAlert({ show: true, message, title });
  }, []);

  const closeAlert = useCallback(() => {
    setCustomAlert({ show: false, message: '', title: '' });
  }, []);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setMessage({ type: '', text: '' });

      await userService.updateUserSchedule({
        defaultSchedule,
        scheduleExceptions,
        personalTimes
      });

      setMessage({ type: 'success', text: '일정이 성공적으로 저장되었습니다!' });
      
      // calendarUpdate 이벤트 발생 (다른 컴포넌트에서 새로고침하도록)
      window.dispatchEvent(new CustomEvent('calendarUpdate'));
      
      setTimeout(() => {
        setMessage({ type: '', text: '' });
        onBack();
      }, 1500);
    } catch (error) {
      setMessage({ type: 'error', text: '일정 저장에 실패했습니다.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // 초기 상태로 복원
    if (initialState) {
      setDefaultSchedule([...initialState.defaultSchedule]);
      setScheduleExceptions([...initialState.scheduleExceptions]);
      setPersonalTimes([...initialState.personalTimes]);
    }
    onBack();
  };

  const handleClearAll = () => {
    if (window.confirm('모든 일정을 삭제하시겠습니까?')) {
      setDefaultSchedule([]);
      setScheduleExceptions([]);
      setPersonalTimes([]);
      showAlert('모든 일정이 삭제되었습니다. 저장 버튼을 눌러 확정하세요.', '알림');
    }
  };

  const handleRemoveException = (exceptionId) => {
    setScheduleExceptions(prev => prev.filter(ex => ex._id !== exceptionId));
  };

  const autoSave = useCallback(() => {
    // 자동 저장은 모바일에서는 생략 (명시적 저장만 지원)
    console.log('Auto-save triggered (mobile)');
  }, []);

  if (isLoading) {
    return (
      <div className="mobile-schedule-edit">
        <div className="loading-state">일정을 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="mobile-schedule-edit">
      {/* 헤더 */}
      <div className="mobile-edit-header">
        <button className="back-button" onClick={handleCancel}>
          <ArrowLeft size={24} />
        </button>
        <h1 className="header-title">일정 편집</h1>
        <div className="header-actions">
          <button className="clear-button" onClick={handleClearAll} title="전체 삭제">
            <Trash2 size={18} />
          </button>
          <button
            className="save-button"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save size={20} />
          </button>
        </div>
      </div>

      {/* 메시지 */}
      {message.text && (
        <div className={`message-box ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* 탭 */}
      <div className="mobile-tabs">
        <button
          className={`tab-button ${activeTab === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          <Calendar size={16} />
          선호시간
        </button>
        <button
          className={`tab-button ${activeTab === 'personal' ? 'active' : ''}`}
          onClick={() => setActiveTab('personal')}
        >
          <Calendar size={16} />
          개인시간
        </button>
      </div>

      {/* 콘텐츠 */}
      <div className="mobile-edit-content">
        {activeTab === 'schedule' ? (
          <div className="schedule-section">
            <div className="section-info">
              <p className="info-text">
                캘린더를 클릭하거나 드래그하여 선호시간을 추가/수정할 수 있습니다.
              </p>
            </div>
            <div className="calendar-wrapper">
              <CalendarView
                schedule={defaultSchedule}
                setSchedule={setDefaultSchedule}
                readOnly={false}
                exceptions={scheduleExceptions}
                personalTimes={personalTimes}
                onRemoveException={handleRemoveException}
                onDateClick={() => {}}
                selectedDate={null}
                onShowAlert={showAlert}
                onAutoSave={autoSave}
                onMonthChange={setViewingMonth}
              />
            </div>
          </div>
        ) : (
          <div className="personal-section">
            <div className="section-info">
              <p className="info-text">
                자동 스케줄링 시 제외할 개인시간(식사, 수면 등)을 관리합니다.
              </p>
            </div>
            <PersonalTimeManager
              personalTimes={personalTimes}
              setPersonalTimes={setPersonalTimes}
              isEditing={true}
              onAutoSave={autoSave}
            />
          </div>
        )}
      </div>

      {/* 알림 모달 */}
      <CustomAlertModal
        isOpen={customAlert.show}
        onClose={closeAlert}
        title={customAlert.title}
        message={customAlert.message}
      />
    </div>
  );
};

export default MobileScheduleEdit;
