import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import CustomAlertModal from './CustomAlertModal';

const RoomCreationModal = ({ onClose, onCreateRoom, ownerProfileSchedule }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [maxMembers, setMaxMembers] = useState(10);
  const [settings, setSettings] = useState({
    startHour: 9,
    endHour: 18,
    blockedTimes: [], // 금지 시간대 배열
    roomExceptions: [] // 새로운 roomExceptions 배열
  });
  
  const [newBlockedTime, setNewBlockedTime] = useState({
    name: '',
    startTime: '12:00',
    endTime: '13:00'
  });

  const [syncOwnerSchedule, setSyncOwnerSchedule] = useState(false); // 방장 시간표 연동 상태

  // CustomAlert 상태
  const [customAlert, setCustomAlert] = useState({ show: false, message: '' });
  const showAlert = (message) => setCustomAlert({ show: true, message });
  const closeAlert = () => setCustomAlert({ show: false, message: '' });

  // 요일 매핑 (0: 일, 1: 월, ..., 6: 토)
  const dayOfWeekMap = {
    0: '일요일', 1: '월요일', 2: '화요일', 3: '수요일', 4: '목요일', 5: '금요일', 6: '토요일'
  };

  // 방장 시간표 연동 토글 핸들러
  const handleSyncOwnerSchedule = () => {
    setSyncOwnerSchedule(prev => !prev);
  };

  useEffect(() => {
    if (syncOwnerSchedule && ownerProfileSchedule) {
      const syncedExceptions = [];

      // defaultSchedule을 roomExceptions으로 변환
      ownerProfileSchedule.defaultSchedule.forEach(schedule => {
        syncedExceptions.push({
          type: 'daily_recurring',
          name: `${dayOfWeekMap[schedule.dayOfWeek]} ${schedule.startTime}-${schedule.endTime} (방장 시간표)`,
          dayOfWeek: schedule.dayOfWeek,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          isSynced: true // 연동된 예외임을 표시
        });
      });

      // scheduleExceptions을 roomExceptions으로 변환
      ownerProfileSchedule.scheduleExceptions.forEach(exception => {
        const startDate = new Date(exception.startTime);
        const endDate = new Date(exception.endTime);

        syncedExceptions.push({
          type: 'date_specific',
          name: `${exception.title} (${startDate.toLocaleDateString()}) (방장 시간표)`,
          startTime: startDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), // HH:MM 형식
          endTime: endDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), // HH:MM 형식
          startDate: exception.startTime,
          endDate: exception.endTime,
          isSynced: true // 연동된 예외임을 표시
        });
      });

      setSettings(prevSettings => ({
        ...prevSettings,
        roomExceptions: [...prevSettings.roomExceptions.filter(ex => !ex.isSynced), ...syncedExceptions]
      }));
    } else if (!syncOwnerSchedule) {
      // 연동 해제 시, 연동된 예외만 제거
      setSettings(prevSettings => ({
        ...prevSettings,
        roomExceptions: prevSettings.roomExceptions.filter(ex => !ex.isSynced)
      }));
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
      settings: {
        ...settings,
        // 빈 roomExceptions 배열은 보내지 않도록 필터링
        roomExceptions: settings.roomExceptions.length > 0 ? settings.roomExceptions : undefined
      }
    };

    console.log('RoomCreationModal: Sending room data:', JSON.stringify(roomData, null, 2));
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
            <label className="block text-sm font-medium text-gray-700 mb-1">최대 멤버 수</label>
            <input
              type="number"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={maxMembers}
              onChange={(e) => setMaxMembers(Math.max(2, Math.min(20, Number(e.target.value))))}
              min="2"
              max="20"
            />
            <p className="text-xs text-gray-500 mt-1">2명~20명까지 설정할 수 있습니다</p>
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
            
            {/* 방장 시간표 연동 및 roomExceptions 표시 */}
            {ownerProfileSchedule && (
              <div className="mt-4 border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium text-gray-700">방장 시간표 연동</h4>
                  <button
                    type="button"
                    onClick={handleSyncOwnerSchedule}
                    className={`px-3 py-1 text-xs rounded-md ${
                      syncOwnerSchedule ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
                    } text-white`}
                  >
                    {syncOwnerSchedule ? '연동 해제' : '현재 내 시간표 연동하기'}
                  </button>
                </div>
                {settings.roomExceptions.length > 0 && (
                  <div className="mb-3">
                    <div className="text-sm text-gray-600 mb-2">
                      금지시간 목록 ({settings.roomExceptions.length}개)
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-1 border border-gray-200 rounded p-2 bg-gray-50">
                      {settings.roomExceptions.map((exception, index) => (
                        <div key={index} className="flex items-center justify-between p-1 bg-white rounded text-xs">
                          <div className="flex-1 truncate">
                            <span className="font-medium text-gray-700">
                              {exception.type === 'daily_recurring'
                                ? `${dayOfWeekMap[exception.dayOfWeek]} ${exception.startTime}-${exception.endTime}`
                                : `${new Date(exception.startDate).toLocaleDateString()} ${exception.startTime}-${exception.endTime}`
                              }
                            </span>
                            {exception.isSynced && (
                              <span className="text-blue-500 ml-1">(연동)</span>
                            )}
                          </div>
                          {!exception.isSynced && (
                            <button
                              type="button"
                              onClick={() => {
                                const updatedExceptions = settings.roomExceptions.filter((_, i) => i !== index);
                                setSettings({...settings, roomExceptions: updatedExceptions});
                              }}
                              className="text-red-500 hover:text-red-700 px-1"
                              title="삭제"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
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
