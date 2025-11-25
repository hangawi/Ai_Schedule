/**
 * ============================================================================
 * useChatState.js - 채팅 상태 관리 커스텀 훅
 * ============================================================================
 */

import { useState, useRef } from 'react';

/**
 * 채팅 상태 관리 훅 (TimetableUploadWithChat용)
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
 * 범용 채팅 상태 관리 훅
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
