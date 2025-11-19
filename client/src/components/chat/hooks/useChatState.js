/**
 * ============================================================================
 * useChatState.js - 채팅 상태 관리 커스텀 훅
 * ============================================================================
 */

import { useState, useRef } from 'react';

/**
 * 채팅 상태 관리 훅
 */
export const useChatState = () => {
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
