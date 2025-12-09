/**
 * ===================================================================================================
 * PersonalTimeManager.js - 개인 시간 관리 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/schedule/PersonalTimeManager.js
 *
 * 🎯 주요 기능:
 *    - 개인 시간 추가/수정/삭제 (수면, 식사, 출퇴근, 학습, 휴식, 기타)
 *    - 반복 일정 및 특정 날짜 일정 관리
 *    - 요일별 개인시간 설정
 *    - 시간 범위 유효성 검증 (수면시간은 다음날까지 허용)
 *    - 자동 저장 및 달력 업데이트
 *    - 개인시간 목록 표시 및 정렬 (일회성 먼저, 시간순)
 *
 * 🔗 연결된 파일:
 *    - ../modals/CustomAlertModal.js - 알림 모달
 *    - lucide-react - 아이콘 라이브러리 (Clock, Plus, Edit, Trash2 등)
 *
 * 💡 UI 위치:
 *    - 탭: 내프로필 > 개인시간 섹션
 *    - 섹션: 프로필 탭 하단의 "개인 시간 관리" 카드
 *    - 경로: 앱 실행 > 내프로필 탭 > 스크롤 하단
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 개인시간 관리 UI 및 동작이 변경됨
 *    - 새 개인시간 유형 추가: personalTimeTypes 객체에 type 추가 (line 32-39)
 *    - 시간 검증 로직 변경: validateTimeRange 함수 수정 (line 72-87)
 *    - 자동 저장 동작 변경: handleFormSubmit, handleRemovePersonalTime의 onAutoSave 호출 부분 수정
 *    - 날짜 표시 형식 변경: formatDays 함수 수정 (line 226-248)
 *
 * 📝 참고사항:
 *    - 개인시간은 자동 배정 시 제외되는 시간대
 *    - 수면시간(sleep)은 다음 날까지 이어질 수 있음 (22:00 - 08:00)
 *    - 편집 모드(isEditing)가 true일 때만 추가/수정/삭제 가능
 *    - 편집 모드가 아닐 때 추가/삭제 시 자동 저장됨 (onAutoSave)
 *    - 달력 업데이트를 위해 CustomEvent 'calendarUpdate' 발행
 *    - 일회성 개인시간(specificDate)과 반복 개인시간(days) 구분
 *
 * ===================================================================================================
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Clock, Plus, Trash2, Edit, X, Moon, Utensils, Car, BookOpen, Coffee, Settings } from 'lucide-react';
import CustomAlertModal from '../modals/CustomAlertModal';

/**
 * PersonalTimeManager - 개인 시간 관리 컴포넌트
 *
 * @description 수면, 식사, 출퇴근 등 개인적인 시간을 설정하여 자동 배정에서 제외
 * @param {Array} personalTimes - 개인시간 목록 배열
 * @param {Function} setPersonalTimes - 개인시간 목록 업데이트 함수
 * @param {Boolean} isEditing - 편집 모드 활성화 여부
 * @param {Function} onAutoSave - 자동 저장 콜백 함수
 *
 * @example
 * <PersonalTimeManager
 *   personalTimes={user.personalTimes}
 *   setPersonalTimes={setPersonalTimes}
 *   isEditing={isEditing}
 *   onAutoSave={handleAutoSave}
 * />
 *
 * @note
 * - personalTimes 각 항목 구조: { id, title, type, startTime, endTime, days, isRecurring, specificDate, color }
 * - type: 'sleep', 'meal', 'commute', 'study', 'break', 'custom'
 * - days: 반복 일정의 요일 배열 [1=월, 2=화, ..., 7=일]
 * - isRecurring: true면 반복, false면 일회성
 * - specificDate: 일회성 일정의 날짜 (YYYY-MM-DD)
 */
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
    sleep: { label: '수면시간', color: 'bg-purple-500', defaultStart: '22:00', defaultEnd: '08:00', icon: Moon },
    meal: { label: '식사시간', color: 'bg-orange-500', defaultStart: '12:00', defaultEnd: '13:00', icon: Utensils },
    commute: { label: '출퇴근시간', color: 'bg-green-500', defaultStart: '08:00', defaultEnd: '09:00', icon: Car },
    study: { label: '개인학습', color: 'bg-blue-500', defaultStart: '19:00', defaultEnd: '21:00', icon: BookOpen },
    break: { label: '휴식시간', color: 'bg-yellow-500', defaultStart: '15:00', defaultEnd: '15:30', icon: Coffee },
    custom: { label: '기타', color: 'bg-gray-500', defaultStart: '10:00', defaultEnd: '11:00', icon: Settings }
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

  /**
   * handleTypeChange - 개인시간 유형 변경 핸들러
   *
   * @description 유형 변경 시 해당 유형의 기본 시간 및 제목으로 자동 설정
   * @param {String} type - 'sleep', 'meal', 'commute', 'study', 'break', 'custom' 중 하나
   */
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

  /**
   * validateTimeRange - 시간 범위 유효성 검증
   *
   * @description 종료 시간이 시작 시간보다 늦은지 검증 (수면시간은 다음날 허용)
   * @param {String} startTime - 시작 시간 (HH:mm)
   * @param {String} endTime - 종료 시간 (HH:mm)
   * @returns {Boolean} 유효하면 true, 아니면 false
   *
   * @note 수면시간(type='sleep')의 경우 endTime < startTime 허용 (예: 22:00 - 08:00)
   */
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

  /**
   * handleFormSubmit - 개인시간 추가/수정 폼 제출 핸들러
   *
   * @description 유효성 검증 후 개인시간을 추가하거나 수정하고 자동 저장 및 달력 업데이트
   * @returns {Promise<void>}
   *
   * @note
   * - editingId가 있으면 수정, 없으면 추가
   * - 편집 모드가 아닐 때(isEditing=false) 자동 저장 실행
   * - CustomEvent 'calendarUpdate' 발행하여 달력 새로고침
   * - 수정 완료 시 폼 초기화, 추가 시에는 제목만 비움
   */
  const handleFormSubmit = useCallback(async () => {
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
    // 편집 모드가 아닐 때만 자동 저장 실행
    if (onAutoSave && !isEditing) {
      try {
        await onAutoSave();
      } catch (error) {
        // Personal autosave failed - silently handle error
        showAlert('저장에 실패했습니다: ' + error.message, '오류');
      }
    }

    // 달력 업데이트 및 강제 리렌더링
    window.dispatchEvent(new CustomEvent('calendarUpdate', {
      detail: { type: 'personalTime', action: editingId ? 'update' : 'add', data: personalTimeData }
    }));

    // 컴포넌트 강제 리렌더링을 위한 상태 업데이트
    setTimeout(() => {
      setPersonalTimes(prev => [...updatedPersonalTimes]);
    }, 100);

  }, [newPersonalTime, personalTimes, setPersonalTimes, showAlert, editingId, onAutoSave]);

  /**
   * handleRemovePersonalTime - 개인시간 삭제 핸들러
   *
   * @description 개인시간을 삭제하고 자동 저장 및 달력 업데이트
   * @param {Number} id - 삭제할 개인시간의 ID
   * @returns {Promise<void>}
   *
   * @note
   * - 편집 중인 항목을 삭제하면 편집 상태 초기화
   * - 편집 모드가 아닐 때(isEditing=false) 자동 저장 실행 (100ms 지연)
   * - CustomEvent 'calendarUpdate' 발행하여 달력 새로고침
   */
  const handleRemovePersonalTime = useCallback(async (id) => {

    const updatedPersonalTimes = personalTimes.filter(pt => pt.id !== id);

    // State를 즉시 업데이트 - 이것이 핵심! 하나만 삭제되어야 함
    setPersonalTimes(updatedPersonalTimes);

    // 편집 중인 항목이 삭제된 경우 편집 상태 초기화
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

    // 편집 모드가 아닐 때만 자동 저장
    if (!isEditing && onAutoSave) {
      try {

        // React state 업데이트가 완료될 때까지 대기
        setTimeout(async () => {
          try {
            await onAutoSave();
          } catch (error) {
            // 저장 실패 시 상태 복원하지 않음 (UI 일관성 유지)
            showAlert('저장에 실패했습니다. 다시 시도해주세요.', '오류');
          }
        }, 100);
      } catch (error) {
      }
    }

    // 개인시간 삭제 후 달력 업데이트
    window.dispatchEvent(new CustomEvent('calendarUpdate', {
      detail: { type: 'personalTime', action: 'remove', id: id }
    }));

    showAlert('개인 시간이 삭제되었습니다.', '삭제 완료');
  }, [personalTimes, setPersonalTimes, editingId, onAutoSave, isEditing, showAlert]);

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

  /**
   * formatDays - 개인시간의 요일/날짜 표시 문자열 포맷팅
   *
   * @description 일회성 일정은 날짜 표시, 반복 일정은 요일 표시
   * @param {Object} personalTime - 개인시간 객체
   * @returns {String} 포맷된 날짜/요일 문자열
   *
   * @example
   * // 일회성: "12월 25일 (월)"
   * // 반복 (매일): "매일"
   * // 반복 (평일): "평일"
   * // 반복 (주말): "주말"
   * // 반복 (특정요일): "월, 수, 금"
   *
   * @note YYYY-MM-DD 형식의 날짜를 로컬 시간대로 파싱하여 UTC 문제 해결
   */
  const formatDays = useCallback((personalTime) => {
    // 특정 날짜의 개인시간인 경우
    if (personalTime.isRecurring === false && personalTime.specificDate) {
      // YYYY-MM-DD 형식의 날짜를 정확히 파싱 (UTC 시간대 문제 해결)
      const [year, month, day] = personalTime.specificDate.split('-').map(Number);
      const date = new Date(year, month - 1, day); // 로컬 시간대로 생성

      const dayOfWeek = date.getDay();
      const dayName = dayNames[dayOfWeek === 0 ? 7 : dayOfWeek];
      const dateStr = date.toLocaleDateString('ko-KR', {
        month: 'short',
        day: 'numeric'
      });
      return `${dateStr} (${dayName})`;
    }

    // 반복되는 개인시간인 경우
    const days = personalTime.days || [];
    if (days.length === 7) return '매일';
    if (days.length === 5 && days.every(d => d >= 1 && d <= 5)) return '평일';
    if (days.length === 2 && days.includes(6) && days.includes(7)) return '주말';
    return days.map(d => dayNames[d]).join(', ');
  }, []);

  const renderPersonalTimeIcon = (type) => {
    const config = personalTimeTypes[type] || personalTimeTypes.custom;
    const IconComponent = config.icon;
    return (
      <div className={`w-8 h-8 rounded-full ${config.color} flex items-center justify-center text-white`}>
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
      <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
        {personalTimes
          .slice()
          .sort((a, b) => {
            // specificDate가 있는 항목 (일회성 일정)
            if (a.specificDate && b.specificDate) {
              // 날짜 먼저 비교
              const dateCompare = a.specificDate.localeCompare(b.specificDate);
              if (dateCompare !== 0) return dateCompare;
              // 같은 날짜면 시작 시간 비교
              return a.startTime.localeCompare(b.startTime);
            }
            // 일회성 일정을 먼저 표시
            if (a.specificDate && !b.specificDate) return -1;
            if (!a.specificDate && b.specificDate) return 1;
            // 둘 다 반복 일정이면 시작 시간으로 정렬
            return a.startTime.localeCompare(b.startTime);
          })
          .map((personalTime) => (
          <div key={personalTime.id} className={`flex items-center justify-between p-3 rounded-lg border ${editingId === personalTime.id ? 'bg-blue-50 border-blue-300' : 'bg-gray-50'}`}>
            <div className="flex items-center flex-1">
              {renderPersonalTimeIcon(personalTime.type || 'event')}
              <div className="ml-3">
                <span className="font-medium text-gray-800">{personalTime.title}</span>
                <div className="text-sm text-gray-600">
                  {personalTime.startTime} - {personalTime.endTime} • {formatDays(personalTime)}
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