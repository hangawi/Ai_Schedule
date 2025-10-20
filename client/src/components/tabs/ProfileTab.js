import React, { useState, useCallback, useEffect } from 'react';
import { userService } from '../../services/userService';
import { coordinationService } from '../../services/coordinationService';
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

  // 편집 모드일 때 현재 상태를 window에 저장하여 챗봇이 사용할 수 있도록 함
  useEffect(() => {
    if (isEditing) {
      window.__profileEditingState = {
        defaultSchedule,
        scheduleExceptions,
        personalTimes
      };
    } else {
      // 편집 모드 종료 시 삭제
      delete window.__profileEditingState;
    }
  }, [isEditing, defaultSchedule, scheduleExceptions, personalTimes]);
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

  // 방장인 방들의 설정을 업데이트하는 함수
  const updateOwnerRoomsSettings = async (ownerScheduleData) => {
    try {
      console.log('🔍 ProfileTab - 방장 방 설정 업데이트 시작:', {
        hasDefaultSchedule: !!(ownerScheduleData.defaultSchedule),
        defaultScheduleCount: ownerScheduleData.defaultSchedule?.length || 0,
        hasScheduleExceptions: !!(ownerScheduleData.scheduleExceptions),
        scheduleExceptionsCount: ownerScheduleData.scheduleExceptions?.length || 0,
        hasPersonalTimes: !!(ownerScheduleData.personalTimes),
        personalTimesCount: ownerScheduleData.personalTimes?.length || 0,
        personalTimesData: ownerScheduleData.personalTimes
      });

      // 내가 방장인 방 목록 가져오기
      const myRooms = await coordinationService.fetchMyRooms();
      console.log('🔍 ProfileTab - fetchMyRooms 결과:', myRooms);

      // myRooms 구조: {owned: Array, joined: Array}
      const ownedRooms = myRooms?.owned || [];
      const ownerRooms = ownedRooms; // owned 배열이 이미 방장인 방들

      console.log(`🔍 방장인 방 개수: ${ownerRooms.length}`);

      // 요일 매핑 (0: 일, 1: 월, ..., 6: 토)
      const dayOfWeekMap = {
        0: '일요일', 1: '월요일', 2: '화요일', 3: '수요일', 4: '목요일', 5: '금요일', 6: '토요일'
      };

      for (const room of ownerRooms) {
        try {
          // 기존 방 세부정보 가져오기
          const roomData = await coordinationService.fetchRoomDetails(room._id);
          const existingSettings = roomData.settings || { roomExceptions: [] };

          // 기존의 방장 연동 예외들 제거 (isSynced: true인 것들)
          const nonSyncedExceptions = existingSettings.roomExceptions.filter(ex => !ex.isSynced);

          // 새로운 방장 시간표 예외들 생성 (불가능한 시간만 포함)
          const syncedExceptions = [];

          // defaultSchedule(가능한 시간)은 roomExceptions에 추가하지 않음
          // roomExceptions는 금지 시간이므로

          // scheduleExceptions을 날짜/제목별로 그룹화하여 병합 처리
          const exceptionGroups = {};
          (ownerScheduleData.scheduleExceptions || []).forEach(exception => {
            const startDate = new Date(exception.startTime);
            const dateKey = startDate.toLocaleDateString('ko-KR'); // 2025. 9. 30. 형태
            const title = exception.title || '일정';
            const groupKey = `${dateKey}-${title}`;

            if (!exceptionGroups[groupKey]) {
              exceptionGroups[groupKey] = {
                title: title,
                date: dateKey,
                exceptions: []
              };
            }
            exceptionGroups[groupKey].exceptions.push(exception);
          });

          // 각 그룹별로 시간대를 병합하여 roomException 생성
          Object.values(exceptionGroups).forEach(group => {
            // 시간순으로 정렬
            group.exceptions.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

            // 연속된 시간대들을 병합
            const mergedTimeRanges = [];
            let currentRange = null;

            group.exceptions.forEach(exception => {
              const startDate = new Date(exception.startTime);
              const endDate = new Date(exception.endTime);

              if (!currentRange) {
                currentRange = {
                  startTime: startDate,
                  endTime: endDate,
                  originalException: exception
                };
              } else {
                // 현재 범위의 끝과 다음 예외의 시작이 연결되는지 확인
                if (currentRange.endTime.getTime() === startDate.getTime()) {
                  // 연속되므로 끝시간을 확장
                  currentRange.endTime = endDate;
                } else {
                  // 연속되지 않으므로 현재 범위를 저장하고 새로운 범위 시작
                  mergedTimeRanges.push(currentRange);
                  currentRange = {
                    startTime: startDate,
                    endTime: endDate,
                    originalException: exception
                  };
                }
              }
            });

            if (currentRange) {
              mergedTimeRanges.push(currentRange);
            }

            // 병합된 시간대들을 roomException으로 변환
            mergedTimeRanges.forEach(range => {
              const startTimeStr = range.startTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
              const endTimeStr = range.endTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

              syncedExceptions.push({
                type: 'date_specific',
                name: `${group.title} (${group.date} ${startTimeStr}~${endTimeStr}) (방장)`,
                startTime: startTimeStr,
                endTime: endTimeStr,
                startDate: range.startTime.toISOString(),
                endDate: range.endTime.toISOString(),
                isSynced: true
              });
            });
          });

          // personalTimes을 roomExceptions으로 변환
          (ownerScheduleData.personalTimes || []).forEach(personalTime => {
            // 반복 개인시간인 경우에만 처리
            if (personalTime.isRecurring !== false && personalTime.days && personalTime.days.length > 0) {
              personalTime.days.forEach(dayOfWeek => {
                // 데이터베이스 요일 시스템을 JavaScript 요일 시스템으로 변환
                const jsDay = dayOfWeek === 7 ? 0 : dayOfWeek;

                // 시간을 분으로 변환하여 자정 넘나드는지 확인
                const [startHour, startMin] = personalTime.startTime.split(':').map(Number);
                const [endHour, endMin] = personalTime.endTime.split(':').map(Number);
                const startMinutes = startHour * 60 + startMin;
                const endMinutes = endHour * 60 + endMin;

                if (endMinutes <= startMinutes) {
                  // 자정을 넘나드는 시간 (예: 23:00~07:00)
                  console.log(`🔍 ProfileTab - 자정 넘나드는 개인시간 분할: ${personalTime.startTime}~${personalTime.endTime}`);

                  // 밤 부분 (예: 23:00~23:50)
                  syncedExceptions.push({
                    type: 'daily_recurring',
                    name: `${personalTime.title || '개인시간'} (방장)`,
                    dayOfWeek: jsDay,
                    startTime: personalTime.startTime,
                    endTime: '23:50',
                    isPersonalTime: true,
                    isSynced: true
                  });

                  // 아침 부분 (예: 00:00~07:00)
                  syncedExceptions.push({
                    type: 'daily_recurring',
                    name: `${personalTime.title || '개인시간'} (방장)`,
                    dayOfWeek: jsDay,
                    startTime: '00:00',
                    endTime: personalTime.endTime,
                    isPersonalTime: true,
                    isSynced: true
                  });
                } else {
                  // 일반적인 하루 내 시간
                  syncedExceptions.push({
                    type: 'daily_recurring',
                    name: `${personalTime.title || '개인시간'} (방장)`,
                    dayOfWeek: jsDay,
                    startTime: personalTime.startTime,
                    endTime: personalTime.endTime,
                    isPersonalTime: true,
                    isSynced: true
                  });
                }
              });
            }
          });

          // 업데이트된 설정으로 방 업데이트
          const updatedSettings = {
            ...existingSettings,
            roomExceptions: [...nonSyncedExceptions, ...syncedExceptions]
          };

          console.log(`🔍 방 "${room.name}" 업데이트 시도 - syncedExceptions:`, {
            count: syncedExceptions.length,
            exceptions: syncedExceptions.map(ex => ({ name: ex.name, type: ex.type, dayOfWeek: ex.dayOfWeek }))
          });

          await coordinationService.updateRoom(room._id, {
            settings: updatedSettings
          });

          console.log(`✅ 방 "${room.name}" 설정이 업데이트되었습니다. (${syncedExceptions.length}개의 방장 시간표 예외 추가)`);

        } catch (roomErr) {
          console.error(`방 "${room.name}" 업데이트 실패:`, roomErr);
        }
      }

      if (ownerRooms.length > 0) {
        console.log(`총 ${ownerRooms.length}개의 방장 방 설정이 업데이트되었습니다.`);
      }

    } catch (err) {
      console.error('방장 방 설정 업데이트 중 오류:', err);
    }
  };

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
      console.log('📅 [ProfileTab] calendarUpdate 이벤트 수신:', event.detail);

      // 반복 일정 추가인 경우
      if (event.detail && event.detail.isRecurring && event.detail.context === 'profile') {
        console.log('🔁 [ProfileTab] 반복 일정 추가 감지, 전체 새로고침');
        fetchSchedule();
        return;
      }

      // 챗봇에서 추가한 일정인 경우
      if (event.detail && event.detail.type === 'add' && event.detail.chatResponse && event.detail.data) {


        // 편집 모드이고 초기화 상태인 경우, 서버 응답의 기존 데이터를 무시하고
        // 챗봇이 방금 추가한 항목만 추가
        if (isEditing && wasCleared) {

          const { chatResponse } = event.detail;
          
          // 챗봇이 추가한 새 항목은 scheduleExceptions에 추가 (불가능한 시간)
          if (chatResponse.startDateTime && chatResponse.endDateTime) {
            const startDateTime = new Date(chatResponse.startDateTime);
            const endDateTime = new Date(chatResponse.endDateTime);
            
            const koreaDateTime = new Date(startDateTime.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
            const localYear = koreaDateTime.getFullYear();
            const localMonth = String(koreaDateTime.getMonth() + 1).padStart(2, '0');
            const localDay = String(koreaDateTime.getDate()).padStart(2, '0');
            const localDate = `${localYear}-${localMonth}-${localDay}`;
            
            // 챗봇으로 추가한 일정은 personalTimes(개인시간)에 추가
            const newPersonalTime = {
              id: `temp_${Date.now()}`,
              title: chatResponse.title || '챗봇 일정',
              type: 'event',
              startTime: `${String(startDateTime.getHours()).padStart(2, '0')}:${String(startDateTime.getMinutes()).padStart(2, '0')}`,
              endTime: `${String(endDateTime.getHours()).padStart(2, '0')}:${String(endDateTime.getMinutes()).padStart(2, '0')}`,
              days: [],
              isRecurring: false,
              specificDate: localDate,
              color: '#ef4444' // 빨간색
            };
            
            // personalTimes에 새 항목만 추가 (서버 데이터 무시)
            setPersonalTimes(prev => [...prev, newPersonalTime]);
          }
        } else {
          // 일반적인 경우: 서버 응답 데이터로 직접 업데이트
          const { data } = event.detail;
          
          if (data.personalTimes) {
            setPersonalTimes([...data.personalTimes]);
          }
          
          if (data.scheduleExceptions) {
            setScheduleExceptions(data.scheduleExceptions);
          }
          
          if (data.defaultSchedule) {
            setDefaultSchedule(data.defaultSchedule);
          }
        }
      } else if (!isEditing) {
        // 편집 모드가 아니고 일반 이벤트인 경우 전체 새로고침

        fetchSchedule();
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
    // defaultSchedule은 그대로 저장 (specificDate 포함)
    const scheduleToSave = defaultSchedule.map(s => ({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      priority: s.priority || 2,
      specificDate: s.specificDate
    }));

    // scheduleExceptions도 그대로 저장
    const exceptionsToSave = scheduleExceptions.map(
      ({ title, startTime, endTime, isHoliday, isAllDay, _id, specificDate, priority }) =>
      ({ title, startTime, endTime, isHoliday, isAllDay, _id, specificDate, priority })
    );

    const personalTimesToSave = personalTimes.map(
      ({ title, type, startTime, endTime, days, isRecurring, id, specificDate, color }) => {
        return { title, type, startTime, endTime, days, isRecurring, id, specificDate, color };
      }
    );

    try {
        console.log('💾 [저장] defaultSchedule:', scheduleToSave.length, '개 | exceptions:', exceptionsToSave.length, '개');

        await userService.updateUserSchedule({
          defaultSchedule: scheduleToSave,
          scheduleExceptions: exceptionsToSave,
          personalTimes: personalTimesToSave
        });
        showAlert('기본 시간표, 예외 일정 및 개인 시간이 저장되었습니다!', '저장 완료');
        setIsEditing(false);

        // 저장 후 서버에서 최신 데이터 동기화
        const freshData = await userService.getUserSchedule();

        console.log('🔍 [ProfileTab] 서버에서 받은 최신 데이터:', {
          defaultScheduleCount: freshData.defaultSchedule?.length || 0,
          defaultScheduleSample: freshData.defaultSchedule?.slice(0, 3),
          defaultScheduleWithSpecificDate: freshData.defaultSchedule?.filter(s => s.specificDate).slice(0, 3),
          exceptionsCount: freshData.scheduleExceptions?.length || 0,
          personalTimesCount: freshData.personalTimes?.length || 0,
          personalTimesSample: freshData.personalTimes?.slice(0, 2)
        });

        // UI 깜박임 방지: 데이터가 실제로 변경된 경우만 상태 업데이트
        if (JSON.stringify(freshData.defaultSchedule || []) !== JSON.stringify(defaultSchedule)) {
          setDefaultSchedule(freshData.defaultSchedule || []);
        }
        if (JSON.stringify(freshData.scheduleExceptions || []) !== JSON.stringify(scheduleExceptions)) {
          setScheduleExceptions(freshData.scheduleExceptions || []);
        }
        if (JSON.stringify(freshData.personalTimes || []) !== JSON.stringify(personalTimes)) {
          setPersonalTimes(freshData.personalTimes || []);
        }

        // CalendarView 강제 리렌더링
        window.dispatchEvent(new Event('calendarUpdate'));

        // 방장 방 자동 동기화는 제거 - 수동 동기화 버튼으로만 가능
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
        ({ title, type, startTime, endTime, days, isRecurring, id, specificDate, color }) => {
          return { title, type, startTime, endTime, days, isRecurring, id, specificDate, color };
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
      // defaultSchedule은 그대로 저장 (specificDate 포함)
      const scheduleToSave = defaultSchedule.map(s => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        priority: s.priority || 2,
        specificDate: s.specificDate
      }));

      const exceptionsToSave = scheduleExceptions.map(
        ({ title, startTime, endTime, isHoliday, isAllDay, _id, specificDate, priority }) =>
        ({ title, startTime, endTime, isHoliday, isAllDay, _id, specificDate, priority })
      );

      const personalTimesToSave = personalTimes.map(
        ({ title, type, startTime, endTime, days, isRecurring, id, specificDate, color }) => {
          return { title, type, startTime, endTime, days, isRecurring, id, specificDate, color };
        }
      );

      console.log('💾 [자동저장] defaultSchedule:', scheduleToSave.length, '개 | exceptions:', exceptionsToSave.length, '개');

      await userService.updateUserSchedule({
        defaultSchedule: scheduleToSave,
        scheduleExceptions: exceptionsToSave,
        personalTimes: personalTimesToSave
      });

    } catch (err) {
      console.error('🔍 [ProfileTab] autoSave 실패:', err);
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


      {/* 선호시간관리와 개인시간관리를 나란히 배치 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* 선호시간관리 섹션 */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-semibold text-blue-600">선호시간 관리</h3>
              <p className="text-sm text-gray-500 mt-1">
                직접 클릭하여 추가한 가능한 시간들 (자동배정 시 사용됨)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">
                {(() => {
                  // 병합된 시간대 계산
                  const mergedSlots = [];
                  ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'].forEach((_, dayIndex) => {
                    const daySlots = defaultSchedule
                      .filter(slot => slot.dayOfWeek === dayIndex)
                      .sort((a, b) => a.startTime.localeCompare(b.startTime));
                    
                    let currentGroup = null;
                    for (const slot of daySlots) {
                      if (currentGroup && 
                          currentGroup.priority === slot.priority &&
                          currentGroup.endTime === slot.startTime) {
                        currentGroup.endTime = slot.endTime;
                      } else {
                        if (currentGroup) mergedSlots.push(currentGroup);
                        currentGroup = { ...slot };
                      }
                    }
                    if (currentGroup) mergedSlots.push(currentGroup);
                  });
                  return mergedSlots.length;
                })()}개 시간대
              </span>
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
            </div>
          </div>

          {defaultSchedule.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="mb-2">아직 선호시간이 설정되지 않았습니다.</p>
              <p className="text-sm">위 달력에서 날짜를 클릭하여 시간을 추가하세요.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(() => {
                // 날짜별로 그룹화
                const dateGroups = {};
                
                defaultSchedule.forEach(slot => {
                  if (slot.specificDate) {
                    if (!dateGroups[slot.specificDate]) {
                      dateGroups[slot.specificDate] = [];
                    }
                    dateGroups[slot.specificDate].push(slot);
                  }
                });
                
                // 날짜순 정렬
                const sortedDates = Object.keys(dateGroups).sort();
                
                if (sortedDates.length === 0) {
                  return (
                    <div className="text-center py-8 text-gray-500">
                      <p className="mb-2">특정 날짜에 선호시간이 설정되지 않았습니다.</p>
                      <p className="text-sm">달력에서 날짜를 클릭하여 시간을 추가하세요.</p>
                    </div>
                  );
                }
                
                return sortedDates.map(dateStr => {
                  const slots = dateGroups[dateStr].sort((a, b) => a.startTime.localeCompare(b.startTime));
                  
                  // 연속된 시간대 병합
                  const mergedSlots = [];
                  let currentGroup = null;
                  
                  for (const slot of slots) {
                    if (currentGroup && 
                        currentGroup.priority === slot.priority &&
                        currentGroup.endTime === slot.startTime) {
                      // 연속된 슬롯이므로 병합
                      currentGroup.endTime = slot.endTime;
                    } else {
                      // 새로운 그룹 시작
                      if (currentGroup) {
                        mergedSlots.push(currentGroup);
                      }
                      currentGroup = { ...slot };
                    }
                  }
                  if (currentGroup) {
                    mergedSlots.push(currentGroup);
                  }
                  
                  const date = new Date(dateStr);
                  const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
                  const dayName = dayNames[date.getDay()];
                  const formattedDate = `${date.getMonth() + 1}월 ${date.getDate()}일 (${dayName})`;
                  
                  return (
                    <div key={dateStr} className="border-l-4 border-blue-500 bg-blue-50 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <div className="min-w-[140px]">
                          <span className="font-semibold text-blue-700">{formattedDate}</span>
                        </div>
                        <div className="flex-1 space-y-2">
                          {mergedSlots.map((slot, idx) => {
                            const priorityColors = {
                              1: 'bg-blue-200 text-blue-800 border-blue-300',
                              2: 'bg-blue-400 text-white border-blue-500',
                              3: 'bg-blue-600 text-white border-blue-700'
                            };
                            const priorityLabels = {
                              1: '조정 가능',
                              2: '보통',
                              3: '선호'
                            };
                            
                            return (
                              <div
                                key={idx}
                                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 ${priorityColors[slot.priority]} mr-2 mb-2`}
                              >
                                <span className="font-medium">{slot.startTime} - {slot.endTime}</span>
                                <span className="text-xs opacity-90">
                                  ({priorityLabels[slot.priority]})
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>

        {/* 개인시간관리 섹션 */}
        <div>
          <PersonalTimeManager
            personalTimes={personalTimes}
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

// 예외 일정 에디터 (이 부분은 그대로 유지)
