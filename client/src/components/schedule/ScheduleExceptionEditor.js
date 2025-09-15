import React, { useState, useCallback, useEffect } from 'react';
import { Calendar, Plus, Trash2, Edit, X } from 'lucide-react';
import CustomAlertModal from '../modals/CustomAlertModal';

const ScheduleExceptionEditor = ({ exceptions = [], setExceptions, isEditing }) => {
  const [newException, setNewException] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '10:00',
    type: 'unavailable'
  });
  const [editingId, setEditingId] = useState(null); // To track which exception is being edited
  const [customAlert, setCustomAlert] = useState({ show: false, message: '', title: '' });

  // Reset form when edit mode is turned off
  useEffect(() => {
    if (!isEditing) {
      setEditingId(null);
      setNewException({
        title: '',
        date: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '10:00',
        type: 'unavailable'
      });
    }
  }, [isEditing]);

  const showAlert = useCallback((message, title = '알림') => {
    setCustomAlert({ show: true, message, title });
  }, []);

  const closeAlert = useCallback(() => {
    setCustomAlert({ show: false, message: '', title: '' });
  }, []);

  const handleFormSubmit = useCallback(() => {
    if (!newException.title.trim() || !newException.date || !newException.startTime || !newException.endTime) {
      showAlert('모든 필드를 입력해주세요.');
      return;
    }
    if (newException.startTime >= newException.endTime) {
      showAlert('종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }

    const exceptionData = {
      title: newException.title,
      startTime: `${newException.date}T${newException.startTime}:00.000Z`,
      endTime: `${newException.date}T${newException.endTime}:00.000Z`,
      type: newException.type, // Not in DB schema, but used for client-side rendering
      description: '' // Not in DB schema
    };

    if (editingId) {
      // Update existing exception
      setExceptions(exceptions.map(ex => ex._id === editingId ? { ...ex, ...exceptionData } : ex));
      setEditingId(null);
    } else {
      // Add new exception
      setExceptions([...exceptions, { ...exceptionData, _id: Date.now() }]);
    }

    setNewException({ title: '', date: new Date().toISOString().split('T')[0], startTime: '09:00', endTime: '10:00', type: 'unavailable' });
  }, [newException, exceptions, setExceptions, showAlert, editingId]);

  const handleRemoveException = useCallback((id) => {
    setExceptions(exceptions.filter(exc => exc._id !== id));
    if (id === editingId) {
        setEditingId(null);
        setNewException({ title: '', date: new Date().toISOString().split('T')[0], startTime: '09:00', endTime: '10:00', type: 'unavailable' });
    }
  }, [exceptions, setExceptions, editingId]);

  const handleEditClick = (exception) => {
    setEditingId(exception._id);
    setNewException({
      title: exception.title,
      date: new Date(exception.startTime).toISOString().split('T')[0],
      startTime: new Date(exception.startTime).toLocaleTimeString('en-CA', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      endTime: new Date(exception.endTime).toLocaleTimeString('en-CA', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      type: exception.type || 'unavailable'
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setNewException({ title: '', date: new Date().toISOString().split('T')[0], startTime: '09:00', endTime: '10:00', type: 'unavailable' });
  }

  const formatDate = (dateTimeString) => new Date(dateTimeString).toLocaleDateString('ko-KR');
  const formatTime = (dateTimeString) => new Date(dateTimeString).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold flex items-center">
          <Calendar className="mr-2" size={20} />
          예외 일정 관리
        </h3>
        {isEditing && (
            <span className="text-sm text-gray-500">{exceptions.length}개</span>
        )}
      </div>

      {!isEditing && exceptions.length === 0 && (
          <p className="text-sm text-gray-500 mb-4">등록된 예외 일정이 없습니다. 편집 모드에서 추가할 수 있습니다.</p>
      )}
      {!isEditing && exceptions.length > 0 && (
        <p className="text-sm text-gray-600 mb-4">
          기본 시간표와 다른 특정 날짜의 일정을 확인합니다. 편집하려면 '편집' 버튼을 클릭하세요.
        </p>
      )}
      {isEditing && (
        <p className="text-sm text-gray-600 mb-4">
          휴가, 시험 등 특정 날짜에만 적용되는 일정을 추가/삭제/수정할 수 있습니다.
        </p>
      )}

      {/* Exceptions List */}
      <div className="space-y-2 mb-4">
        {exceptions.map((exception) => (
          <div key={exception._id} className={`flex items-center justify-between p-3 rounded-lg border ${editingId === exception._id ? 'bg-blue-50 border-blue-300' : 'bg-gray-50'}`}>
            <div className="flex-1">
              <span className="font-medium text-gray-800">{exception.title}</span>
              <span className="text-sm text-gray-600 ml-3">
                {formatDate(exception.startTime)} {formatTime(exception.startTime)} - {formatTime(exception.endTime)}
              </span>
            </div>
            {isEditing && (
              <div className="flex items-center space-x-2">
                <button onClick={() => handleEditClick(exception)} className="text-blue-500 hover:text-blue-700">
                    <Edit size={16} />
                </button>
                <button onClick={() => handleRemoveException(exception._id)} className="text-red-500 hover:text-red-700">
                    <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add/Edit Exception Form (only in editing mode) */}
      {isEditing && (
        <div className="border-t pt-4">
            <h4 className="text-md font-semibold text-gray-800 mb-2">{editingId ? '예외 수정' : '새 예외 추가'}</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                <input
                    type="text"
                    placeholder="예외 이름 (예: 중간고사)"
                    value={newException.title}
                    onChange={(e) => setNewException({ ...newException, title: e.target.value })}
                    className="md:col-span-2 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                />
                <input
                    type="date"
                    value={newException.date}
                    onChange={(e) => setNewException({ ...newException, date: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex gap-2">
                    <input
                        type="time"
                        value={newException.startTime}
                        onChange={(e) => setNewException({ ...newException, startTime: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                        type="time"
                        value={newException.endTime}
                        onChange={(e) => setNewException({ ...newException, endTime: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>
            <div className="flex items-center space-x-2 mt-2">
                <button
                    onClick={handleFormSubmit}
                    className="w-full px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center justify-center"
                >
                    {editingId ? <><Edit size={16} className="mr-1" /> 수정 완료</> : <><Plus size={16} className="mr-1" /> 추가</>}
                </button>
                {editingId && (
                    <button onClick={handleCancelEdit} className="w-auto px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">
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

export default ScheduleExceptionEditor;