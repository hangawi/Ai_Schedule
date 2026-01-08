/**
 * ===================================================================================================
 * RoomCreationModal.js - 새로운 조율방을 생성하기 위한 복합 모달 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/RoomCreationModal.js
 *
 * 🎯 주요 기능:
 *    - 조율방의 기본 정보(이름, 설명, 최대 멤버 수)를 입력받는 폼 제공.
 *    - 조율방의 시간표 운영 시간(시작/종료 시간) 설정.
 *    - 조율방 전체에 적용될 '금지 시간대'를 수동으로 추가/삭제하는 기능.
 *    - '방장 개인시간 연동' 기능: 방장의 개인 스케줄(개인시간, 예외시간)을 자동으로 불러와
 *      조율방의 '배정 불가 시간'으로 설정하는 핵심 기능.
 *
 * 🔗 연결된 파일:
 *    - ./CoordinationTab.js (추정) - '새 조율방 생성' 버튼 클릭 시 이 모달을 호출.
 *    - ../../services/userService.js - 방장의 개인 스케줄을 가져오기 위해 API를 호출.
 *
 * 💡 UI 위치:
 *    - '일정 맞추기' 탭에서 '새 조율방 생성' 버튼을 클릭했을 때 나타나는 팝업 모달.
 *
 * ✏️ 수정 가이드:
 *    - '방장 개인시간 연동' 로직을 수정하려면 `syncOwnerSchedule` 상태를 다루는 `useEffect` 훅을 수정해야 합니다.
 *      이곳에는 개인시간, 예외시간을 `roomExceptions` 형태로 변환하는 복잡한 로직이 포함되어 있습니다.
 *    - 방 생성 시 서버로 전달되는 데이터 구조를 변경하려면 `handleSubmit` 함수 내 `roomData` 객체를 수정합니다.
 *
 * 📝 참고사항:
 *    - 이 모달은 `useEffect`를 통해 마운트 시 방장의 최신 스케줄 정보를 비동기적으로 가져옵니다.
 *    - '개인시간 연동' 기능은 방장의 선호시간(`defaultSchedule`)은 제외하고, 개인적인 약속(`scheduleExceptions`)과
 *      고정적인 개인시간(`personalTimes`)만을 '배정 불가 시간'으로 변환하여 연동합니다.
 *    - 자정이 넘어가는 개인시간(예: 수면)은 두 개의 예외 시간으로 분리하여 처리하는 로직이 포함되어 있습니다.
 *
 * ===================================================================================================
 */
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import CustomAlertModal from './CustomAlertModal';
import { userService } from '../../services/userService';

/**
 * RoomCreationModal
 * @description 새로운 조율방을 생성하기 위한 상세 설정 UI를 제공하는 모달 컴포넌트.
 * @param {object} props - 컴포넌트 props
 * @param {function} props.onClose - 모달을 닫는 함수.
 * @param {function} props.onCreateRoom - '생성' 버튼 클릭 시 호출되는 콜백. 최종적인 방 설정 데이터를 인자로 받음.
 * @param {object} props.ownerProfileSchedule - 초기에 전달받는 방장의 스케줄 데이터.
 * @returns {JSX.Element}
 */
const RoomCreationModal = ({ onClose, onCreateRoom, ownerProfileSchedule: initialOwnerSchedule }) => {
  const [ownerProfileSchedule, setOwnerProfileSchedule] = useState(initialOwnerSchedule);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [maxMembers, setMaxMembers] = useState(100);
  const [mode, setMode] = useState('standard'); // 'standard' or 'conversational'
  const [settings, setSettings] = useState({
    startHour: 9,
    endHour: 18,
    blockedTimes: [], // 금지 시간대 배열
    roomExceptions: [], // 새로운 roomExceptions 배열
  });
  
  const [newBlockedTime, setNewBlockedTime] = useState({
    name: '',
    startTime: '12:00',
    endTime: '13:00'
  });

  const [syncOwnerSchedule] = useState(true); // 방장 시간표 자동 연동 (항상 활성화)

  // CustomAlert 상태
  const [customAlert, setCustomAlert] = useState({ show: false, message: '' });
  const showAlert = (message) => setCustomAlert({ show: true, message });
  const closeAlert = () => setCustomAlert({ show: false, message: '' });

  // 컴포넌트 마운트 시 최신 사용자 일정 데이터 로드
  useEffect(() => {
    const loadOwnerSchedule = async () => {
      try {
        const scheduleData = await userService.getUserSchedule();
        setOwnerProfileSchedule(scheduleData);
      } catch (err) {
      }
    };

    loadOwnerSchedule();
  }, []);

  // 요일 매핑 (0: 일, 1: 월, ..., 6: 토)
  const dayOfWeekMap = {
    0: '일요일', 1: '월요일', 2: '화요일', 3: '수요일', 4: '목요일', 5: '금요일', 6: '토요일'
  };

useEffect(() => {
    if (syncOwnerSchedule && ownerProfileSchedule) {
      const syncedExceptions = [];

      // ❌ defaultSchedule (선호시간)은 금지시간으로 추가하지 않음
      // 선호시간은 자동배정 시 조원들이 사용할 수 있는 시간이므로 제외

      // scheduleExceptions을 날짜/제목별로 그룹화하여 병합 처리
      const exceptionGroups = {};
      (ownerProfileSchedule.scheduleExceptions || []).forEach(exception => {

        const startDate = new Date(exception.startTime);
        const endDate = new Date(exception.endTime);
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

          // 시간 변환 시 올바른 형식으로 변환 (HH:MM)
          const startTimeStr = `${String(range.startTime.getHours()).padStart(2, '0')}:${String(range.startTime.getMinutes()).padStart(2, '0')}`;
          const endTimeStr = `${String(range.endTime.getHours()).padStart(2, '0')}:${String(range.endTime.getMinutes()).padStart(2, '0')}`;

          const roomException = {
            type: 'date_specific',
            name: `${group.title} (${group.date} ${startTimeStr}~${endTimeStr}) (방장)`,
            startTime: startTimeStr,
            endTime: endTimeStr,
            startDate: range.startTime.toISOString(),
            endDate: range.endTime.toISOString(),
            isSynced: true
          };

          syncedExceptions.push(roomException);
        });
      });

      (ownerProfileSchedule.personalTimes || []).forEach((personalTime, index) => {

        // 반복 개인시간인 경우에만 처리
        if (personalTime.isRecurring !== false && personalTime.days && personalTime.days.length > 0) {
          personalTime.days.forEach(dayOfWeek => {
            // 데이터베이스 요일 시스템 (1=월요일, 2=화요일, ..., 7=일요일)을
            // JavaScript 요일 시스템 (0=일요일, 1=월요일, 2=화요일, ...)으로 변환
            const jsDay = dayOfWeek === 7 ? 0 : dayOfWeek;

            // 시간을 분으로 변환하여 자정 넘나드는지 확인
            const [startHour, startMin] = personalTime.startTime.split(':').map(Number);
            const [endHour, endMin] = personalTime.endTime.split(':').map(Number);
            const startMinutes = startHour * 60 + startMin;
            const endMinutes = endHour * 60 + endMin;

            if (endMinutes <= startMinutes) {
              // 밤 부분 (예: 23:00~23:50)
              const nightException = {
                type: 'daily_recurring',
                name: `${personalTime.title || '개인시간'} (방장)`,
                dayOfWeek: jsDay,
                startTime: personalTime.startTime,
                endTime: '23:50',
                isPersonalTime: true,
                isSynced: true
              };

              // 아침 부분 (예: 00:00~07:00)
              const morningException = {
                type: 'daily_recurring',
                name: `${personalTime.title || '개인시간'} (방장)`,
                dayOfWeek: jsDay,
                startTime: '00:00',
                endTime: personalTime.endTime,
                isPersonalTime: true,
                isSynced: true
              };
              syncedExceptions.push(nightException);
              syncedExceptions.push(morningException);
            } else {
              // 일반적인 하루 내 시간
              const personalException = {
                type: 'daily_recurring',
                name: `${personalTime.title || '개인시간'} (방장)`,
                dayOfWeek: jsDay,
                startTime: personalTime.startTime,
                endTime: personalTime.endTime,
                isPersonalTime: true,
                isSynced: true
              };
              syncedExceptions.push(personalException);
            }
          });
        } else {
        }
      });
      // 14:40 관련 예외 확인
      const suspicious = syncedExceptions.filter(ex =>
        ex.startTime?.includes('14:4') ||
        ex.endTime?.includes('15:0') ||
        ex.name?.includes('14:4')
      );
      setSettings(prevSettings => {
        const existingNonSynced = prevSettings.roomExceptions.filter(ex => !ex.isSynced);

        // 14:40 관련 기존 예외 확인
        const suspiciousExisting = existingNonSynced.filter(ex =>
          ex.startTime?.includes('14:4') ||
          ex.endTime?.includes('15:0') ||
          ex.name?.includes('14:4')
        );

        const finalExceptions = [...existingNonSynced, ...syncedExceptions];

        return {
          ...prevSettings,
          roomExceptions: finalExceptions
        };
      });
    }
  }, [syncOwnerSchedule, ownerProfileSchedule]); // ownerProfileSchedule이 변경될 때도 재실행

  const handleSubmit = () => {
    if (name.trim() === '') {
      showAlert('방 이름을 입력해주세요.');
      return;
    }
    const roomData = {
      name: name.trim(),
      description: description.trim(),
      maxMembers,
      mode, // 'standard' 또는 'conversational'
      settings: {
        ...settings,
        // 빈 roomExceptions 배열은 보내지 않도록 필터링
        roomExceptions: settings.roomExceptions.length > 0 ? settings.roomExceptions : undefined
      }
    };

    onCreateRoom(roomData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-11/12 max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">새 조율방 생성</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              방 이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 큐브 스터디 그룹"
              maxLength={100}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">방 설명</label>
            <textarea
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="이 방에 대한 간단한 설명을 입력해주세요 (선택사항)"
              rows={3}
              maxLength={500}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">조율 모드</label>
            <div className="grid grid-cols-2 gap-3">
              <div 
                className={`border rounded-lg p-3 cursor-pointer transition-all ${mode === 'standard' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
                onClick={() => setMode('standard')}
              >
                <div className="flex items-center mb-1">
                  <input type="radio" checked={mode === 'standard'} readOnly className="mr-2" />
                  <span className="text-sm font-bold text-gray-800">표준 모드</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">기존의 수동 배정 및 자동 알고리즘 방식</p>
              </div>
              <div 
                className={`border rounded-lg p-3 cursor-pointer transition-all ${mode === 'conversational' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
                onClick={() => setMode('conversational')}
              >
                <div className="flex items-center mb-1">
                  <input type="radio" checked={mode === 'conversational'} readOnly className="mr-2" />
                  <span className="text-sm font-bold text-gray-800">대화형 모드</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">AI가 채팅 대화를 분석해 자동으로 일정 생성</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">최대 멤버 수</label>
            <input
              type="number"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={maxMembers}
              onChange={(e) => setMaxMembers(Math.max(2, Math.min(300, Number(e.target.value))))}
              min="2"
              max="300"
            />
            <p className="text-xs text-gray-500 mt-1">2명~300명까지 설정할 수 있습니다</p>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">시간표 설정</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">시작 시간</label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={settings.startHour}
                  onChange={(e) => setSettings({...settings, startHour: Number(e.target.value)})}
                >
                  {Array.from({length: 24}, (_, i) => (
                    <option key={i} value={i}>{i}:00</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-xs text-gray-600 mb-1">종료 시간</label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={settings.endHour}
                  onChange={(e) => setSettings({...settings, endHour: Number(e.target.value)})}
                >
                  {Array.from({length: 24}, (_, i) => (
                    <option key={i+1} value={i+1}>{i+1}:00</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-medium text-gray-700">금지 시간대 설정</h4>
                <span className="text-xs text-gray-500">({settings.blockedTimes.length}개)</span>
              </div>
              
              {/* 기존 금지 시간대 목록 */}
              {settings.blockedTimes.length > 0 && (
                <div className="mb-3 space-y-2">
                  {settings.blockedTimes.map((blockedTime, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-red-50 rounded border border-red-200">
                      <div className="flex-1">
                        <span className="text-sm font-medium text-red-700">{blockedTime.name}</span>
                        <span className="text-xs text-red-600 ml-2">{blockedTime.startTime} ~ {blockedTime.endTime}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const updatedBlockedTimes = settings.blockedTimes.filter((_, i) => i !== index);
                          setSettings({...settings, blockedTimes: updatedBlockedTimes});
                        }}
                        className="text-red-500 hover:text-red-700 text-sm px-2"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* 새 금지 시간대 추가 */}
              <div className="border border-gray-200 rounded p-3">
                <div className="mb-2">
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={newBlockedTime.name}
                    onChange={(e) => setNewBlockedTime({...newBlockedTime, name: e.target.value})}
                    placeholder="금지 시간 이름 (예: 점심시간, 회의시간)"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">시작 시간</label>
                    <input
                      type="time"
                      className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={newBlockedTime.startTime}
                      onChange={(e) => setNewBlockedTime({...newBlockedTime, startTime: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">종료 시간</label>
                    <input
                      type="time"
                      className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={newBlockedTime.endTime}
                      onChange={(e) => setNewBlockedTime({...newBlockedTime, endTime: e.target.value})}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (newBlockedTime.name.trim() && newBlockedTime.startTime && newBlockedTime.endTime) {
                      if (newBlockedTime.startTime >= newBlockedTime.endTime) {
                        showAlert('종료 시간은 시작 시간보다 늦어야 합니다.');
                        return;
                      }
                      setSettings({
                        ...settings,
                        blockedTimes: [...settings.blockedTimes, {...newBlockedTime}]
                      });
                      setNewBlockedTime({ name: '', startTime: '12:00', endTime: '13:00' });
                    } else {
                      showAlert('모든 필드를 입력해주세요.');
                    }
                  }}
                  className="w-full px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                  disabled={!newBlockedTime.name.trim() || !newBlockedTime.startTime || !newBlockedTime.endTime}
                >
                  금지 시간 추가
                </button>
              </div>
            </div>
            

          </div>
        </div>
        
        <div className="mt-6 flex justify-end space-x-3">
          <button 
            onClick={onClose} 
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          <button 
            onClick={handleSubmit} 
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
            disabled={!name.trim()}
          >
            생성
          </button>
        </div>

        {/* CustomAlert Modal */}
        <CustomAlertModal
          show={customAlert.show}
          onClose={closeAlert}
          message={customAlert.message}
        />
      </div>
    </div>
  );
};

export default RoomCreationModal;
