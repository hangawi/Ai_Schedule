import React, { useState, useCallback, useEffect } from 'react';
import { Clock, Plus, Trash2, Edit, X, Coffee, Moon, Utensils, Car, BookOpen } from 'lucide-react';
import CustomAlertModal from '../modals/CustomAlertModal';

const PersonalTimeManager = ({ personalTimes = [], setPersonalTimes, isEditing, onAutoSave }) => {
  const [newPersonalTime, setNewPersonalTime] = useState({
    title: '',
    type: 'sleep',
    startTime: '22:00',
    endTime: '08:00',
    days: [1, 2, 3, 4, 5], // 월-금 기본값
    isRecurring: true
  });
  const [editingId, setEditingId] = useState(null);
  const [customAlert, setCustomAlert] = useState({ show: false, message: '', title: '' });

  useEffect(() => {
    if (!isEditing) {
      setEditingId(null);
      // 편집 모드가 아닐 때는 폼을 초기화하지 않고 유지
      // setNewPersonalTime({
      //   title: '',
      //   type: 'sleep',
      //   startTime: '22:00',
      //   endTime: '08:00',
      //   days: [1, 2, 3, 4, 5],
      //   isRecurring: true
      // });
    }
  }, [isEditing]);

  const personalTimeTypes = {
    sleep: { label: '수면시간', icon: Moon, color: 'bg-purple-500', defaultStart: '22:00', defaultEnd: '08:00' },
    meal: { label: '식사시간', icon: Utensils, color: 'bg-orange-500', defaultStart: '12:00', defaultEnd: '13:00' },
    commute: { label: '출퇴근시간', icon: Car, color: 'bg-green-500', defaultStart: '08:00', defaultEnd: '09:00' },
    study: { label: '개인학습', icon: BookOpen, color: 'bg-blue-500', defaultStart: '19:00', defaultEnd: '21:00' },
    break: { label: '휴식시간', icon: Coffee, color: 'bg-yellow-500', defaultStart: '15:00', defaultEnd: '15:30' },
    custom: { label: '기타', icon: Clock, color: 'bg-gray-500', defaultStart: '10:00', defaultEnd: '11:00' }
  };

  const dayNames = {
    1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토', 7: '일'
  };

  const showAlert = useCallback((message, title = '알림') => {
    setCustomAlert({ show: true, message, title });
  }, []);

  const closeAlert = useCallback(() => {
    setCustomAlert({ show: false, message: '', title: '' });
  }, []);

  const handleTypeChange = (type) => {
    const typeConfig = personalTimeTypes[type];
    setNewPersonalTime({
      ...newPersonalTime,
      type,
      startTime: typeConfig.defaultStart,
      endTime: typeConfig.defaultEnd,
      title: typeConfig.label // 항상 새로운 타입의 기본 라벨로 변경
    });
  };

  const handleDayToggle = (day) => {
    const newDays = newPersonalTime.days.includes(day)
      ? newPersonalTime.days.filter(d => d !== day)
      : [...newPersonalTime.days, day].sort((a, b) => a - b);

    setNewPersonalTime({ ...newPersonalTime, days: newDays });
  };

  const validateTimeRange = (startTime, endTime) => {
    if (!startTime || !endTime) return false;

    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // 수면시간의 경우 다음 날까지 이어질 수 있음
    if (newPersonalTime.type === 'sleep' && endMinutes < startMinutes) {
      return true; // 22:00 - 08:00 같은 경우
    }

    return endMinutes > startMinutes;
  };

  const handleFormSubmit = useCallback(() => {
    if (!newPersonalTime.title.trim()) {
      showAlert('제목을 입력해주세요.');
      return;
    }

    if (newPersonalTime.days.length === 0) {
      showAlert('최소 하나의 요일을 선택해주세요.');
      return;
    }

    if (!validateTimeRange(newPersonalTime.startTime, newPersonalTime.endTime)) {
      showAlert('종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }

    const personalTimeData = {
      ...newPersonalTime,
      id: editingId || Date.now()
    };

    let updatedPersonalTimes;
    if (editingId) {
      updatedPersonalTimes = personalTimes.map(pt => pt.id === editingId ? personalTimeData : pt);
      setPersonalTimes(updatedPersonalTimes);
      setEditingId(null);
      showAlert('개인 시간이 수정되었습니다.', '수정 완료');
    } else {
      updatedPersonalTimes = [...personalTimes, personalTimeData];
      setPersonalTimes(updatedPersonalTimes);
      showAlert('개인 시간이 추가되었습니다.', '추가 완료');
    }

    // 수정 완료 시에만 폼 초기화, 새로 추가할 때는 폼 유지
    if (editingId) {
      setNewPersonalTime({
        title: '',
        type: 'sleep',
        startTime: '22:00',
        endTime: '08:00',
        days: [1, 2, 3, 4, 5],
        isRecurring: true
      });
    }
    // 새로 추가할 때는 폼을 유지하지만 제목만 비워서 다음 입력을 위해 준비
    else {
      setNewPersonalTime(prev => ({
        ...prev,
        title: ''
      }));
    }

    // 개인시간 추가/수정 후 자동 저장 및 달력 업데이트
    console.log('개인시간 저장 시도:', personalTimeData);
    console.log('onAutoSave 함수 존재:', !!onAutoSave);

    // 자동 저장 대신 즉시 달력 업데이트만 수행
    // (저장은 사용자가 프로필 탭에서 '저장' 버튼을 클릭할 때 수행)
    window.dispatchEvent(new CustomEvent('calendarUpdate', {
      detail: { type: 'personalTime', action: editingId ? 'update' : 'add', data: personalTimeData }
    }));

    console.log('개인시간 추가/수정 완료. 저장하려면 프로필 탭의 "저장" 버튼을 클릭하세요.');
  }, [newPersonalTime, personalTimes, setPersonalTimes, showAlert, editingId, onAutoSave]);

  const handleRemovePersonalTime = useCallback((id) => {
    const updatedPersonalTimes = personalTimes.filter(pt => pt.id !== id);
    console.log('Removing personal time with id:', id);
    console.log('Updated personal times after removal:', updatedPersonalTimes);

    setPersonalTimes(updatedPersonalTimes);

    // 개인시간 삭제 후 달력 업데이트 (자동 저장 제거)
    window.dispatchEvent(new CustomEvent('calendarUpdate', {
      detail: { type: 'personalTime', action: 'remove', id: id }
    }));

    console.log('개인시간 삭제 완료. 저장하려면 프로필 탭의 "저장" 버튼을 클릭하세요.');
    if (id === editingId) {
      setEditingId(null);
      setNewPersonalTime({
        title: '',
        type: 'sleep',
        startTime: '22:00',
        endTime: '08:00',
        days: [1, 2, 3, 4, 5],
        isRecurring: true
      });
    }
  }, [personalTimes, setPersonalTimes, editingId, onAutoSave]);

  const handleEditClick = (personalTime) => {
    setEditingId(personalTime.id);
    setNewPersonalTime({ ...personalTime });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setNewPersonalTime({
      title: '',
      type: 'sleep',
      startTime: '22:00',
      endTime: '08:00',
      days: [1, 2, 3, 4, 5],
      isRecurring: true
    });
  };

  const formatDays = (days) => {
    if (days.length === 7) return '매일';
    if (days.length === 5 && days.every(d => d >= 1 && d <= 5)) return '평일';
    if (days.length === 2 && days.includes(6) && days.includes(7)) return '주말';
    return days.map(d => dayNames[d]).join(', ');
  };

  const renderPersonalTimeIcon = (type) => {
    const IconComponent = personalTimeTypes[type]?.icon || Clock;
    const color = personalTimeTypes[type]?.color || 'bg-gray-500';
    return (
      <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-white`}>
        <IconComponent size={16} />
      </div>
    );
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold flex items-center">
          <Clock className="mr-2" size={20} />
          개인 시간 관리
        </h3>
        {isEditing && (
          <span className="text-sm text-gray-500">{personalTimes.length}개</span>
        )}
      </div>

      {!isEditing && personalTimes.length === 0 && (
        <p className="text-sm text-gray-500 mb-4">등록된 개인 시간이 없습니다. 편집 모드에서 추가할 수 있습니다.</p>
      )}
      {!isEditing && personalTimes.length > 0 && (
        <p className="text-sm text-gray-600 mb-4">
          자동 스케줄링 시 이 시간들은 제외됩니다. 편집하려면 '편집' 버튼을 클릭하세요.
        </p>
      )}
      {isEditing && (
        <p className="text-sm text-gray-600 mb-4">
          수면, 식사, 출퇴근 등 개인적인 시간을 설정하여 자동 배정에서 제외할 수 있습니다.
        </p>
      )}

      {/* Personal Times List */}
      <div className="space-y-2 mb-4">
        {personalTimes.map((personalTime) => (
          <div key={personalTime.id} className={`flex items-center justify-between p-3 rounded-lg border ${editingId === personalTime.id ? 'bg-blue-50 border-blue-300' : 'bg-gray-50'}`}>
            <div className="flex items-center flex-1">
              {renderPersonalTimeIcon(personalTime.type)}
              <div className="ml-3">
                <span className="font-medium text-gray-800">{personalTime.title}</span>
                <div className="text-sm text-gray-600">
                  {personalTime.startTime} - {personalTime.endTime} • {formatDays(personalTime.days)}
                </div>
              </div>
            </div>
            {isEditing && (
              <div className="flex items-center space-x-2">
                <button onClick={() => handleEditClick(personalTime)} className="text-blue-500 hover:text-blue-700">
                  <Edit size={16} />
                </button>
                <button onClick={() => handleRemovePersonalTime(personalTime.id)} className="text-red-500 hover:text-red-700">
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add/Edit Personal Time Form */}
      {isEditing && (
        <div className="border-t pt-4">
          <h4 className="text-md font-semibold text-gray-800 mb-3">{editingId ? '개인 시간 수정' : '새 개인 시간 추가'}</h4>

          {/* Type Selection */}
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">유형</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(personalTimeTypes).map(([type, config]) => (
                <button
                  key={type}
                  onClick={() => handleTypeChange(type)}
                  className={`p-2 rounded-lg border text-sm flex items-center justify-center space-x-2 transition-colors ${
                    newPersonalTime.type === type
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <config.icon size={16} />
                  <span>{config.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">제목</label>
            <input
              type="text"
              placeholder="예: 아침식사, 헬스장 등"
              value={newPersonalTime.title}
              onChange={(e) => setNewPersonalTime({ ...newPersonalTime, title: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Time Range */}
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">시간</label>
            <div className="flex gap-2 items-center">
              <input
                type="time"
                value={newPersonalTime.startTime}
                onChange={(e) => setNewPersonalTime({ ...newPersonalTime, startTime: e.target.value })}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-500">~</span>
              <input
                type="time"
                value={newPersonalTime.endTime}
                onChange={(e) => setNewPersonalTime({ ...newPersonalTime, endTime: e.target.value })}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {newPersonalTime.type === 'sleep' && (
              <p className="text-xs text-gray-500 mt-1">수면시간은 다음 날까지 이어질 수 있습니다 (예: 22:00 - 08:00)</p>
            )}
          </div>

          {/* Days Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">요일</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(dayNames).map(([day, name]) => (
                <button
                  key={day}
                  onClick={() => handleDayToggle(parseInt(day))}
                  className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                    newPersonalTime.days.includes(parseInt(day))
                      ? 'border-blue-500 bg-blue-500 text-white'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Submit/Cancel Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleFormSubmit}
              className="flex-1 px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center justify-center"
            >
              {editingId ? <><Edit size={16} className="mr-1" /> 수정 완료</> : <><Plus size={16} className="mr-1" /> 추가</>}
            </button>
            {!editingId && (
              <button
                onClick={() => {
                  setNewPersonalTime({
                    title: '',
                    type: 'sleep',
                    startTime: '22:00',
                    endTime: '08:00',
                    days: [1, 2, 3, 4, 5],
                    isRecurring: true
                  });
                }}
                className="px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                초기화
              </button>
            )}
            {editingId && (
              <button onClick={handleCancelEdit} className="px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">
                <X size={16}/>
              </button>
            )}
          </div>
        </div>
      )}

      <CustomAlertModal
        isOpen={customAlert.show}
        onClose={closeAlert}
        title={customAlert.title}
        message={customAlert.message}
      />
    </div>
  );
};

export default PersonalTimeManager;