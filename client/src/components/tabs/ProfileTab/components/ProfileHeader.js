// 프로필 탭 헤더 컴포넌트

import React from 'react';
import { Edit, Save, XCircle, Trash2, User, CalendarDays } from 'lucide-react';
import { MESSAGES, TITLES } from '../constants/messages';

export const ProfileHeader = ({
  isEditing,
  showPersonalInfo,
  setShowPersonalInfo,
  onSave,
  onCancel,
  onStartEdit,
  onClearAll,
  showAlert
}) => {
  return (
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-2xl font-bold">
        {showPersonalInfo ? '개인정보 수정' : '나의 기본 시간표 설정'}
      </h2>
      <div className="flex flex-wrap gap-2 items-center">
        {showPersonalInfo ? (
          <button
            onClick={() => setShowPersonalInfo(false)}
            className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 flex items-center"
          >
            <CalendarDays size={16} className="mr-2" />
            시간표 관리로 돌아가기
          </button>
        ) : (
          <>
            <button
              onClick={() => setShowPersonalInfo(true)}
              className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 flex items-center shadow-md transition-all duration-200 mr-2"
            >
              <User size={16} className="mr-2" />
              개인정보 수정
            </button>
            {isEditing ? (
              <>
                <button
                  onClick={onSave}
                  className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 flex items-center shadow-md transition-all duration-200"
                >
                  <Save size={16} className="mr-2" />
                  저장
                </button>
                <button
                  onClick={onCancel}
                  className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 flex items-center shadow-md transition-all duration-200"
                >
                  <XCircle size={16} className="mr-2" />
                  취소
                </button>
                <div className="border-l-2 border-gray-300 h-8 mx-1"></div>
                <button
                  onClick={() => {
                    onClearAll();
                    showAlert(MESSAGES.CLEAR_IN_EDIT_MODE, TITLES.CLEAR);
                  }}
                  className="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 flex items-center shadow-md transition-all duration-200 text-sm"
                >
                  <Trash2 size={14} className="mr-1" />
                  전체 초기화
                </button>
              </>
            ) : (
              <button
                onClick={onStartEdit}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center shadow-md transition-all duration-200"
              >
                <Edit size={16} className="mr-2" />
                편집
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
