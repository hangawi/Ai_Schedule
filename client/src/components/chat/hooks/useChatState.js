/**
 * ===================================================================================================
 * useChatState.js - 채팅 상태 관리 커스텀 훅
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/chat/hooks
 *
 * 🎯 주요 기능:
 *    - `useChatState`: `TimetableUploadWithChat` 컴포넌트에 특화된 채팅 상태 관리 (채팅 메시지, 기록 등)
 *    - `useGeneralChatState`: 범용적인 채팅 UI에 필요한 상태 관리 (메시지 목록, 입력 텍스트, 이미지 등)
 *
 * 🔗 연결된 파일:
 *    - ../TimetableUploadWithChat.js - `useChatState` 훅을 사용
 *    - 다양한 채팅 UI 컴포넌트에서 `useGeneralChatState` 훅을 사용 가능
 *
 * 💡 UI 위치:
 *    - 챗봇 화면, 일정 최적화 모달 등 채팅 기능이 포함된 모든 UI
 *
 * ✏️ 수정 가이드:
 *    - `TimetableUploadWithChat`에 새로운 상태가 필요한 경우: `useChatState`에 `useState` 추가
 *    - 범용 채팅 UI에 새로운 상태가 필요한 경우: `useGeneralChatState`에 `useState` 추가
 *    - `removeImage` 로직 변경: `useGeneralChatState`의 `removeImage` 함수 수정
 *
 * 📝 참고사항:
 *    - 특정 컴포넌트에 종속적인 상태와 범용적인 상태를 분리하여 관리하기 위해 두 개의 훅으로 나뉘어 있습니다.
 *    - `useChatState`는 `TimetableUploadWithChat`의 복잡한 상태 로직을 캡슐화합니다.
 *    - `useGeneralChatState`는 더 단순하고 재사용 가능한 채팅 UI를 구축하는 데 사용될 수 있습니다.
 *
 * ===================================================================================================
 */

import { useState, useRef } from 'react';

/**
 * useChatState
 *
 * @description `TimetableUploadWithChat` 컴포넌트에 특화된 채팅 관련 상태들을 관리하는 커스텀 훅입니다.
 * @returns {Object} 채팅 관련 상태 및 셋터 함수, ref 객체들을 포함하는 객체
 *
 * @property {string} chatMessage - 현재 입력 중인 채팅 메시지
 * @property {Function} setChatMessage - `chatMessage` 상태를 업데이트하는 함수
 * @property {Array<Object>} chatHistory - 채팅 메시지 기록 배열
 * @property {Function} setChatHistory - `chatHistory` 상태를 업데이트하는 함수
 * @property {boolean} isFilteringChat - 채팅 필터링 중인지 여부
 * @property {Function} setIsFilteringChat - `isFilteringChat` 상태를 업데이트하는 함수
 * @property {Object} userProfile - 사용자 프로필 정보
 * @property {Function} setUserProfile - `userProfile` 상태를 업데이트하는 함수
 * @property {Array<Object>} conversationHistory - 대화 기록 (API 전송용)
 * @property {Function} setConversationHistory - `conversationHistory` 상태를 업데이트하는 함수
 * @property {React.MutableRefObject<HTMLDivElement>} chatEndRef - 채팅창의 맨 아래를 가리키는 ref
 *
 * @example
 * // TimetableUploadWithChat 컴포넌트 내에서 사용
 * const { chatMessage, setChatMessage, chatHistory, setChatHistory } = useChatState();
 */
export const useChatState = () => {
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isFilteringChat, setIsFilteringChat] = useState(false);
  const [userProfile, setUserProfile] = useState({});
  const [conversationHistory, setConversationHistory] = useState([]);
  const chatEndRef = useRef(null);

  return {
    chatMessage,
    setChatMessage,
    chatHistory,
    setChatHistory,
    isFilteringChat,
    setIsFilteringChat,
    userProfile,
    setUserProfile,
    conversationHistory,
    setConversationHistory,
    chatEndRef
  };
};

/**
 * useGeneralChatState
 *
 * @description 범용적인 채팅 UI 구현에 필요한 상태와 메서드를 관리하는 커스텀 훅입니다.
 * @returns {Object} 채팅 UI 관련 상태, 셋터 함수, ref 객체, 유틸리티 함수를 포함하는 객체
 *
 * @property {Array<Object>} messages - 채팅 메시지 목록
 * @property {Function} setMessages - `messages` 상태를 업데이트하는 함수
 * @property {string} inputText - 현재 입력 필드의 텍스트
 * @property {Function} setInputText - `inputText` 상태를 업데이트하는 함수
 * @property {boolean} isOpen - 채팅창의 열림/닫힘 상태
 * @property {Function} setIsOpen - `isOpen` 상태를 업데이트하는 함수
 * @property {File | null} selectedImage - 현재 선택된 이미지 파일
 * @property {Function} setSelectedImage - `selectedImage` 상태를 업데이트하는 함수
 * @property {string | null} imagePreview - 선택된 이미지의 미리보기 URL
 * @property {Function} setImagePreview - `imagePreview` 상태를 업데이트하는 함수
 * @property {boolean} showTimetableUpload - 시간표 업로드 컴포넌트 표시 여부
 * @property {Function} setShowTimetableUpload - `showTimetableUpload` 상태를 업데이트하는 함수
 * @property {boolean} showScheduleModal - 시간표 모달 표시 여부
 * @property {Function} setShowScheduleModal - `showScheduleModal` 상태를 업데이트하는 함수
 * @property {Object | null} extractedScheduleData - OCR을 통해 추출된 시간표 데이터
 * @property {Function} setExtractedScheduleData - `extractedScheduleData` 상태를 업데이트하는 함수
 * @property {React.MutableRefObject<HTMLDivElement>} messagesEndRef - 메시지 목록의 끝을 가리키는 ref
 * @property {React.MutableRefObject<HTMLInputElement>} imageInputRef - 이미지 파일 입력 필드의 ref
 * @property {Function} removeImage - 선택된 이미지를 제거하는 함수
 *
 * @example
 * // 범용 채팅 컴포넌트에서 사용
 * const { messages, setMessages, inputText, setInputText, removeImage } = useGeneralChatState();
 */
export const useGeneralChatState = () => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [showTimetableUpload, setShowTimetableUpload] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [extractedScheduleData, setExtractedScheduleData] = useState(null);

  const messagesEndRef = useRef(null);
  const imageInputRef = useRef(null);

  /**
   * 이미지 제거
   */
  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  return {
    // States
    messages,
    setMessages,
    inputText,
    setInputText,
    isOpen,
    setIsOpen,
    selectedImage,
    setSelectedImage,
    imagePreview,
    setImagePreview,
    showTimetableUpload,
    setShowTimetableUpload,
    showScheduleModal,
    setShowScheduleModal,
    extractedScheduleData,
    setExtractedScheduleData,

    // Refs
    messagesEndRef,
    imageInputRef,

    // Methods
    removeImage,
  };
};
