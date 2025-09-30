import React from "react";
import { Copy } from "lucide-react";

const RoomInfoTab = ({ 
  room, 
  isEditing, 
  setIsEditing, 
  formData, 
  setFormData, 
  newBlockedTime,
  setNewBlockedTime,
  handleUpdate, 
  handleDelete, 
  copyInviteCode,
  showAlert 
}) => {
  if (isEditing) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              방 이름
            </label>
            <input
              type="text"
              className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              방 설명
            </label>
            <textarea
              className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              최대 멤버 수
            </label>
            <input
              type="number"
              className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
              value={formData.maxMembers}
              onChange={(e) =>
                setFormData({ ...formData, maxMembers: Number(e.target.value) })
              }
              min="2"
              max="20"
            />
          </div>

          {/* TimeTable Settings Block */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">시간표 설정</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">시작 시간</label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={formData.settings.startHour}
                  onChange={(e) => setFormData({...formData, settings: {...formData.settings, startHour: Number(e.target.value)}})}
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
                  value={formData.settings.endHour}
                  onChange={(e) => setFormData({...formData, settings: {...formData.settings, endHour: Number(e.target.value)}})}
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
                <span className="text-xs text-gray-500">({formData.settings.blockedTimes.length}개)</span>
              </div>
              
              {/* 기존 금지 시간대 목록 */}
              {formData.settings.blockedTimes.length > 0 && (
                <div className="mb-3 space-y-2">
                  {formData.settings.blockedTimes.map((blockedTime, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-red-50 rounded border border-red-200">
                      <div className="flex-1">
                        <span className="text-sm font-medium text-red-700">{blockedTime.name}</span>
                        <span className="text-xs text-red-600 ml-2">{blockedTime.startTime} ~ {blockedTime.endTime}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const updatedBlockedTimes = formData.settings.blockedTimes.filter((_, i) => i !== index);
                          setFormData({...formData, settings: {...formData.settings, blockedTimes: updatedBlockedTimes}});
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
                      setFormData({
                        ...formData,
                        settings: {
                          ...formData.settings,
                          blockedTimes: [...formData.settings.blockedTimes, {...newBlockedTime}]
                        }
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

            {/* roomExceptions (방장 동기화된 시간) 표시 */}
            {formData.settings.roomExceptions && formData.settings.roomExceptions.length > 0 && (
              <div className="mt-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-xs font-medium text-gray-700">방장 동기화 금지시간 (불가능시간)</h4>
                  <span className="text-xs text-gray-500">({formData.settings.roomExceptions.length}개)</span>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {formData.settings.roomExceptions.map((exception, index) => (
                    <div key={index} className="p-2 bg-orange-50 rounded border border-orange-200">
                      <div className="flex-1">
                        <span className="text-sm font-medium text-orange-700">{exception.name}</span>
                        {exception.type === 'daily_recurring' && (
                          <span className="text-xs text-orange-600 ml-2">
                            {['일', '월', '화', '수', '목', '금', '토'][exception.dayOfWeek]}요일 {exception.startTime} ~ {exception.endTime}
                          </span>
                        )}
                        {exception.type === 'date_specific' && (
                          <span className="text-xs text-orange-600 ml-2">
                            {new Date(exception.startDate).toLocaleDateString('ko-KR')} {exception.startTime} ~ {exception.endTime}
                          </span>
                        )}
                      </div>
                      {exception.isSynced && (
                        <span className="text-xs text-orange-500 ml-2">(자동 동기화)</span>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  * 이 시간들은 방장의 프로필에서 자동 동기화된 불가능한 시간입니다. 프로필 탭의 '동기화' 버튼을 누르면 업데이트됩니다.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">방 이름</p>
            <p className="font-semibold text-gray-800">{room.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">멤버 수</p>
            <p className="font-semibold text-gray-800">
              {room.members?.length || 0} / {room.maxMembers}명
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">생성일</p>
            <p className="font-semibold text-gray-800">
              {new Date(room.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        {room.description && (
          <div>
            <p className="text-sm text-gray-500">방 설명</p>
            <p className="mt-1 text-gray-800">{room.description}</p>
          </div>
        )}
      </div>
      <div className="border-t pt-4 mt-6">
        <h4 className="font-medium text-gray-800 mb-2">초대 코드</h4>
        <div className="flex items-center p-2 bg-blue-50 rounded-lg">
          <p className="text-sm text-gray-600 flex-1 font-mono font-bold text-blue-700 tracking-wider">
            {room.inviteCode}
          </p>
          <button
            onClick={copyInviteCode}
            className="px-3 py-1 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 shadow-sm"
          >
            <Copy size={14} className="inline mr-1" /> 복사
          </button>
        </div>
      </div>

      {/* 금지 시간대 표시 */}
      {room.settings?.blockedTimes && room.settings.blockedTimes.length > 0 && (
        <div className="border-t pt-4 mt-6">
          <h4 className="font-medium text-gray-800 mb-2">금지 시간대 ({room.settings.blockedTimes.length}개)</h4>
          <div className="space-y-2">
            {room.settings.blockedTimes.map((blockedTime, index) => (
              <div key={index} className="p-2 bg-red-50 rounded border border-red-200">
                <span className="text-sm font-medium text-red-700">{blockedTime.name}</span>
                <span className="text-xs text-red-600 ml-2">{blockedTime.startTime} ~ {blockedTime.endTime}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* roomExceptions (방장 동기화 금지시간) 표시 */}
      {room.settings?.roomExceptions && room.settings.roomExceptions.length > 0 && (
        <div className="border-t pt-4 mt-6">
          <h4 className="font-medium text-gray-800 mb-2">
            방장 동기화 금지시간 (불가능시간) ({room.settings.roomExceptions.length}개)
          </h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {room.settings.roomExceptions.map((exception, index) => (
              <div key={index} className="p-2 bg-orange-50 rounded border border-orange-200">
                <div className="flex-1">
                  <span className="text-sm font-medium text-orange-700">{exception.name}</span>
                  {exception.type === 'daily_recurring' && (
                    <span className="text-xs text-orange-600 ml-2">
                      {['일', '월', '화', '수', '목', '금', '토'][exception.dayOfWeek]}요일 {exception.startTime} ~ {exception.endTime}
                    </span>
                  )}
                  {exception.type === 'date_specific' && (
                    <span className="text-xs text-orange-600 ml-2">
                      {new Date(exception.startDate).toLocaleDateString('ko-KR')} {exception.startTime} ~ {exception.endTime}
                    </span>
                  )}
                </div>
                {exception.isSynced && (
                  <span className="text-xs text-orange-500 ml-2">(자동 동기화)</span>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            * 이 시간들은 방장의 프로필에서 자동 동기화된 불가능한 시간입니다. 프로필 탭의 '동기화' 버튼을 누르면 업데이트됩니다.
          </p>
        </div>
      )}
    </div>
  );
};

export default RoomInfoTab;