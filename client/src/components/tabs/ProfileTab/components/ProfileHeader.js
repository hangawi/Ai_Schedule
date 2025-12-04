/**
 * ===================================================================================================
 * ProfileHeader.js - '내 프로필' 탭의 헤더 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/ProfileTab/components/ProfileHeader.js
 *
 * 🎯 주요 기능:
 *    - '내 프로필' 탭의 제목을 표시. (현재 뷰 상태에 따라 '개인정보 수정' 또는 '나의 기본 시간표 설정')
 *    - 편집 모드(isEditing)와 개인정보 보기(showPersonalInfo) 상태에 따라 동적으로 버튼들을 렌더링.
 *    - 버튼 종류: 저장, 취소, 편집, 전체 초기화, 개인정보 수정, 시간표 관리로 돌아가기.
 *    - 부모 컴포넌트로부터 전달받은 핸들러 함수들을 각 버튼의 onClick 이벤트에 연결.
 *
 * 🔗 연결된 파일:
 *    - ../index.js (ProfileTab) - 이 컴포넌트를 사용하는 부모 컴포넌트.
 *    - ../constants/messages.js - 컴포넌트 내에서 사용하는 메시지 및 제목 상수.
 *
 * 💡 UI 위치:
 *    - '내 프로필' 탭의 최상단에 위치한 헤더 영역.
 *
 * ✏️ 수정 가이드:
 *    - 헤더의 버튼 구성을 변경하려면 이 파일을 직접 수정합니다.
 *    - 버튼에 연결된 기능(저장, 취소 등)의 실제 로직을 수정하려면 부모 컴포넌트인 `ProfileTab/index.js`와 그곳에서 사용하는 핸들러(`createSaveHandler` 등)를 확인해야 합니다.
 *
 * 📝 참고사항:
 *    - 이 컴포넌트는 상태를 직접 관리하지 않고, props를 통해 상태와 핸들러를 전달받는 순수 프레젠테이셔널 컴포넌트입니다.
 *
 * ===================================================================================================
 */

import React from 'react';
import { Edit, Save, XCircle, Trash2, User, CalendarDays } from 'lucide-react';
import { MESSAGES, TITLES } from '../constants/messages';

/**
 * ProfileHeader
 * @description '내 프로필' 탭의 헤더 영역을 렌더링하며, 현재 상태에 따라 동적인 버튼들을 표시합니다.
 * @param {object} props - 컴포넌트 props
 * @param {boolean} props.isEditing - 현재 스케줄 편집 모드인지 여부.
 * @param {boolean} props.showPersonalInfo - 개인정보 수정 화면을 보여주고 있는지 여부.
 * @param {function} props.setShowPersonalInfo - 개인정보 수정 화면 표시 상태를 변경하는 함수.
 * @param {function} props.onSave - '저장' 버튼 클릭 시 호출될 함수.
 * @param {function} props.onCancel - '취소' 버튼 클릭 시 호출될 함수.
 * @param {function} props.onStartEdit - '편집' 버튼 클릭 시 호출될 함수.
 * @param {function} props.onClearAll - '전체 초기화' 버튼 클릭 시 호출될 함수.
 * @param {function} props.showAlert - 알림 모달을 표시하는 함수.
 * @returns {JSX.Element}
 */
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
