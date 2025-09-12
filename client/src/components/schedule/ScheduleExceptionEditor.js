import React, { useState, useCallback } from 'react';
import { Calendar, Plus, Trash2, Clock } from 'lucide-react';
import CustomAlertModal from '../modals/CustomAlertModal';

const ScheduleExceptionEditor = ({ exceptions = [], setExceptions }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newException, setNewException] = useState({
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '18:00',
    type: 'busy' // 'busy' 또는 'unavailable'
  });
  const [customAlert, setCustomAlert] = useState({ show: false, message: '', title: '' });

  const showAlert = useCallback((message, title = '알림') => {
    setCustomAlert({ show: true, message, title });
  }, []);

  const closeAlert = useCallback(() => {
    setCustomAlert({ show: false, message: '', title: '' });
  }, []);

  const handleAddException = useCallback(() => {
    // 유효성 검증
    if (!newException.title.trim()) {
      showAlert('예외 일정의 제목을 입력해주세요.');
      return;
    }

    if (newException.startTime >= newException.endTime) {
      showAlert('종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }

    // 새 예외 추가 (서버 모델과 호환)
    const exception = {
      _id: Date.now(), // 임시 ID (클라이언트용)
      title: newException.title,
      description: newException.description,
      startTime: new Date(`${newException.date}T${newException.startTime}:00.000Z`).toISOString(),
      endTime: new Date(`${newException.date}T${newException.endTime}:00.000Z`).toISOString(),
      type: newException.type
    };

    setExceptions([...exceptions, exception]);
    
    // 폼 초기화
    setNewException({
      title: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '18:00',
      type: 'busy'
    });

    setShowAddModal(false);
    showAlert('예외 일정이 추가되었습니다.', '완료');
  }, [newException, exceptions, setExceptions, showAlert]);

  const handleRemoveException = useCallback((id) => {
    setExceptions(exceptions.filter(exc => exc._id !== id));
    showAlert('예외 일정이 삭제되었습니다.', '완료');
  }, [exceptions, setExceptions, showAlert]);

  const formatDate = (dateTimeString) => {
    const date = new Date(dateTimeString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    });
  };

  const formatTime = (dateTimeString) => {
    const date = new Date(dateTimeString);
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold flex items-center">
          <Calendar className="mr-2" size={20} />
          예외 일정 관리
        </h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center"
        >
          <Plus className="mr-1" size={16} />
          예외 추가
        </button>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        기본 시간표와 다른 특정 날짜의 일정을 설정할 수 있습니다.
        (예: 휴가, 회의, 시험 등)
      </p>

      {/* 예외 목록 */}
      <div className="space-y-3">
        {exceptions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Calendar size={48} className="mx-auto mb-2 opacity-50" />
            <p>등록된 예외 일정이 없습니다.</p>
          </div>
        ) : (
          exceptions.map((exception) => (
            <div
              key={exception._id}
              className={`p-4 rounded-lg border-l-4 ${
                exception.type === 'busy' 
                  ? 'border-yellow-500 bg-yellow-50' 
                  : 'border-red-500 bg-red-50'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{exception.title}</h4>
                  {exception.description && (
                    <p className="text-sm text-gray-600 mt-1">{exception.description}</p>
                  )}
                  <div className="flex items-center mt-2 text-sm text-gray-500">
                    <Calendar size={14} className="mr-1" />
                    {formatDate(exception.startTime)}
                    <Clock size={14} className="ml-3 mr-1" />
                    {formatTime(exception.startTime)} - {formatTime(exception.endTime)}
                  </div>
                  <span className={`inline-block mt-2 px-2 py-1 text-xs rounded ${
                    exception.type === 'busy' 
                      ? 'bg-yellow-200 text-yellow-800' 
                      : 'bg-red-200 text-red-800'
                  }`}>
                    {exception.type === 'busy' ? '바쁨' : '불가능'}
                  </span>
                </div>
                <button
                  onClick={() => handleRemoveException(exception._id)}
                  className="text-red-500 hover:text-red-700 p-1"
                  title="삭제"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 예외 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">예외 일정 추가</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    제목 *
                  </label>
                  <input
                    type="text"
                    value={newException.title}
                    onChange={(e) => setNewException(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="예: 중간고사, 휴가, 회의"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    설명 (선택)
                  </label>
                  <textarea
                    value={newException.description}
                    onChange={(e) => setNewException(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="2"
                    placeholder="추가 설명"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    날짜 *
                  </label>
                  <input
                    type="date"
                    value={newException.date}
                    onChange={(e) => setNewException(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      시작 시간 *
                    </label>
                    <input
                      type="time"
                      value={newException.startTime}
                      onChange={(e) => setNewException(prev => ({ ...prev, startTime: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      종료 시간 *
                    </label>
                    <input
                      type="time"
                      value={newException.endTime}
                      onChange={(e) => setNewException(prev => ({ ...prev, endTime: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    유형 *
                  </label>
                  <select
                    value={newException.type}
                    onChange={(e) => setNewException(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="busy">바쁨 (조정 가능)</option>
                    <option value="unavailable">불가능 (절대 불가)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  취소
                </button>
                <button
                  onClick={handleAddException}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  추가
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      <CustomAlertModal
        isOpen={customAlert.show}
        onClose={closeAlert}
        title={customAlert.title}
        message={customAlert.message}
      />
    </div>
  );
};

export default ScheduleExceptionEditor;