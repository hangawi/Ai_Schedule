import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { io } from 'socket.io-client';
import { Send, Paperclip, Download, FileText, Calendar, Clock } from 'lucide-react';
import { auth } from '../../config/firebaseConfig';
import SuggestionModal from './SuggestionModal';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const GroupChat = ({ roomId, user, isMobile, typoCorrection = false }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isUploading, setIsUploading] = useState(false); // 파일 업로드 중
  const [toast, setToast] = useState(null); // 토스트 알림 { message, type }
  const [isUserScrolling, setIsUserScrolling] = useState(false); // 사용자가 스크롤 중인지
  const [showSuggestionModal, setShowSuggestionModal] = useState(false); // 일정관리 모달 표시
  const [isCorrecting, setIsCorrecting] = useState(false); // AI 오타 교정 중
  const [deleteTarget, setDeleteTarget] = useState(null); // 삭제 대상 메시지
  const [conflictModal, setConflictModal] = useState(null); // 🆕 충돌 확인 모달
  
  // 🆕 디버그: conflictModal 상태 변경 추적
  useEffect(() => {
    console.log('🔴 [GroupChat] conflictModal 상태 변경:', conflictModal);
  }, [conflictModal]);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const socketRef = useRef(null);
  const fileInputRef = useRef(null);
  const readTimerRef = useRef(null); // 🆕 읽음 처리 디바운스 타이머

  // 1. 초기 로드 및 소켓 연결
  useEffect(() => {
    // 채팅 내역 불러오기
    fetchMessages();
    
    // 읽음 처리 알림
    markMessagesAsRead();

    // 소켓 연결
    socketRef.current = io(API_BASE_URL, { transports: ['websocket', 'polling'] });
    
    // 연결 완료 후 room join
    socketRef.current.on('connect', () => {
      socketRef.current.emit('join-room', roomId);
    });

    // 메시지 수신
    socketRef.current.on('chat-message', (newMessage) => {
      setMessages((prev) => [...prev, newMessage]);
      scrollToBottom();
      // 🆕 메시지 수신 시 디바운스 읽음 처리 (3초 후, 연속 메시지는 한 번만)
      if (readTimerRef.current) clearTimeout(readTimerRef.current);
      readTimerRef.current = setTimeout(() => markMessagesAsRead(), 3000);
    });

    // 메시지 삭제 수신
    socketRef.current.on('message-deleted', ({ messageId }) => {
      setMessages((prev) => prev.filter(msg => msg._id !== messageId));
    });

    // 🆕 충돌 확인 필요 이벤트
    socketRef.current.on('conflict-confirmation-needed', (data) => {
      console.log('⚠️ [GroupChat] Conflict confirmation needed:', data);
      console.log('⚠️ [GroupChat] user:', user);
      console.log('⚠️ [GroupChat] user._id:', user?._id, 'user.id:', user?.id);
      console.log('⚠️ [GroupChat] targetUserId:', data.targetUserId);
      // 현재 사용자에게만 모달 표시 (user._id 또는 user.id 둘 다 체크)
      const currentUserId = user?._id || user?.id;
      if (currentUserId && data.targetUserId === currentUserId) {
        console.log('⚠️ [GroupChat] 모달 표시!');
        setConflictModal(data);
      } else {
        console.log('⚠️ [GroupChat] ID 불일치 - 모달 표시 안함');
      }
    });

    return () => {
      // 🆕 방 나갈 때 읽음 처리 (실시간 수신 메시지도 읽음 반영)
      if (readTimerRef.current) clearTimeout(readTimerRef.current);
      markMessagesAsRead();
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [roomId]);

  // 외부 이벤트(일정 생성/삭제 등)로 채팅 메시지 갱신
  useEffect(() => {
    const handleSuggestionUpdate = () => {
      fetchMessages();
    };
    window.addEventListener('suggestionUpdate', handleSuggestionUpdate);
    window.addEventListener('calendarUpdate', handleSuggestionUpdate);
    return () => {
      window.removeEventListener('suggestionUpdate', handleSuggestionUpdate);
      window.removeEventListener('calendarUpdate', handleSuggestionUpdate);
    };
  }, []);

  // 🆕 강제 참석 (충돌 무시)
  const handleForceAccept = async (suggestionId) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/chat/${roomId}/suggestions/${suggestionId}/force-accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        console.log('✅ Force accepted suggestion');
        setConflictModal(null);
        setToast({ message: '일정에 참석했습니다', type: 'success' });
      } else {
        const error = await res.json();
        setToast({ message: error.message || '참석 처리에 실패했습니다.', type: 'error' });
      }
    } catch (error) {
      console.error('Failed to force accept suggestion:', error);
      setToast({ message: '참석 처리 중 오류가 발생했습니다.', type: 'error' });
    }
  };

  const fetchMessages = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/chat/${roomId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setMessages(data);
      scrollToBottom();
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const markMessagesAsRead = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      await fetch(`${API_BASE_URL}/api/chat/${roomId}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      window.dispatchEvent(new Event('badgeUpdate'));
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  };

  const scrollToBottom = (force = false) => {
    if (force || !isUserScrolling) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // 스크롤 위치 감지
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50; // 하단 50px 이내

    setIsUserScrolling(!isAtBottom);
  };

  // 메시지 삭제 핸들러
  const handleDeleteMessage = async (messageId) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/chat/${roomId}/message/${messageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        // 삭제 성공 시 로컬 상태에서 바로 제거
        setMessages(prev => prev.filter(msg => msg._id !== messageId));
      } else {
        const data = await res.json();
        showToast(data.msg || '삭제에 실패했습니다.', 'error');
      }
      setDeleteTarget(null);
    } catch (error) {
      console.error('Delete message error:', error);
      showToast('삭제에 실패했습니다.', 'error');
      setDeleteTarget(null);
    }
  };

  // 파일 업로드 핸들러
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 크기 체크 (10MB 제한)
    if (file.size > 10 * 1024 * 1024) {
      setToast({ message: '파일 크기는 10MB 이하여야 합니다.', type: 'error' });
      return;
    }

    setIsUploading(true);

    try {
      const token = await auth.currentUser?.getIdToken();
      const formData = new FormData();
      formData.append('file', file);
      // 한글 파일명을 명시적으로 UTF-8 문자열로 전송
      formData.append('originalFileName', file.name);

      const res = await fetch(`${API_BASE_URL}/api/chat/${roomId}/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) throw new Error('파일 업로드 실패');

      // 업로드 성공 시 소켓으로 메시지가 전달됨
    } catch (error) {
      console.error('File upload error:', error);
      setToast({ message: '파일 업로드에 실패했습니다.', type: 'error' });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 파일 다운로드 핸들러
  const handleFileDownload = async (fileUrl, fileName) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(fileUrl, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch file');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      setToast({ message: '다운로드에 실패했습니다.', type: 'error' });
    }
  };

  // 메시지 리스트가 업데이트될 때마다 스크롤 하단으로 이동
  useEffect(() => {
    scrollToBottom();
  }, [messages]);


  // 토스트 자동 닫기
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // 토스트 표시 헬퍼 함수
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  // 2. 메시지 전송
  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    let content = input;
    setInput(''); // UI 즉시 반응

    try {
      const token = await auth.currentUser?.getIdToken();

      // AI 오타 교정이 활성화된 경우
      if (typoCorrection) {
        setIsCorrecting(true);
        try {
          const correctionRes = await fetch(`${API_BASE_URL}/api/chat/correct-typo`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ text: content })
          });
          const correctionData = await correctionRes.json();
          if (correctionData.corrected) {
            content = correctionData.corrected;
          }
        } catch (correctionError) {
          console.error('Typo correction error:', correctionError);
          // 오류 시 원본 텍스트 사용
        } finally {
          setIsCorrecting(false);
        }
      }

      await fetch(`${API_BASE_URL}/api/chat/${roomId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content, type: 'text' })
      });
      // 소켓으로 내 메시지도 돌아오므로 여기서 setMessages 안 해도 됨 (중복 방지)
      // 하지만 소켓 반응이 느릴 수 있으므로 전송 직후 스크롤 시도는 유지 (혹은 소켓 수신 시 처리)
    } catch (error) {
      console.error('Send error:', error);
    }
  };

  // 3. AI 제안 메시지 클릭 시 일정관리 모달 열기
  const handleOpenSuggestionModal = () => {
    setShowSuggestionModal(true);
  };

  return (
    <div className="flex flex-col h-full bg-gray-100 relative">
      {/* 메시지 리스트 */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4"
      >
        {messages.map((msg, idx) => {
          // 보낸 사람 식별
          const senderObj = msg.sender;
          const senderEmail = typeof senderObj === 'object' ? senderObj.email : null;
          const senderId = typeof senderObj === 'object' ? (senderObj._id || senderObj.id) : senderObj;
          const myEmail = user?.email;
          const myId = user?._id || user?.id;
          let isMe = false;
          if (senderEmail && myEmail) {
            isMe = senderEmail === myEmail;
          } else {
            isMe = senderId && myId && senderId.toString() === myId.toString();
          }

          // 날짜 구분선 체크
          const currentMsgDate = new Date(msg.createdAt).toLocaleDateString('ko-KR');
          const prevMsg = idx > 0 ? messages[idx - 1] : null;
          const prevMsgDate = prevMsg ? new Date(prevMsg.createdAt).toLocaleDateString('ko-KR') : null;
          const showDateDivider = !prevMsg || currentMsgDate !== prevMsgDate;

          // 날짜 포맷
          const getDateLabel = (dateStr) => {
            const msgDate = new Date(dateStr);
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const msgDateStr = msgDate.toLocaleDateString('ko-KR');
            const todayStr = today.toLocaleDateString('ko-KR');
            const yesterdayStr = yesterday.toLocaleDateString('ko-KR');
            if (msgDateStr === todayStr) return '오늘';
            if (msgDateStr === yesterdayStr) return '어제';
            const year = msgDate.getFullYear();
            const month = msgDate.getMonth() + 1;
            const day = msgDate.getDate();
            const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
            const weekday = weekdays[msgDate.getDay()];
            return `${year}년 ${month}월 ${day}일 ${weekday}요일`;
          };

          const isSystem = msg.type === 'system';
          const isFile = msg.type === 'file';
          const isImage = msg.fileType?.startsWith('image/');
          const fileName = msg.fileName || '파일';

          // 파일 URL 구성 (디버깅 추가)
          let fileUrl = msg.fileUrl;
          if (fileUrl && !fileUrl.startsWith('http')) {
            fileUrl = `${API_BASE_URL}${fileUrl}`;
          }

return (
            <React.Fragment key={idx}>
              {/* 날짜 구분선 */}
              {showDateDivider && (
                <div className="flex items-center justify-center my-6">
                  <div className="flex-1 h-px bg-gray-300"></div>
                  <span className="px-4 text-xs text-gray-500 font-medium bg-gray-100 rounded-full py-1">
                    {getDateLabel(msg.createdAt)}
                  </span>
                  <div className="flex-1 h-px bg-gray-300"></div>
                </div>
              )}

              {/* 시스템 메시지 */}
              {isSystem && (
                <div className="flex justify-center my-2">
                  <span
                    onClick={msg.suggestionId ? handleOpenSuggestionModal : undefined}
                    className={`bg-gray-200 text-gray-600 text-xs py-1 px-3 rounded-full${msg.suggestionId ? ' cursor-pointer hover:bg-gray-300 transition-colors' : ''}`}
                  >
                    {msg.content}
                  </span>
                </div>
              )}

              {/* AI 제안 메시지 (클릭 가능) */}
              {msg.type === 'ai-suggestion' && (
                <div className="flex justify-center my-2">
                  <span
                    onClick={handleOpenSuggestionModal}
                    className="bg-gray-200 text-gray-600 text-xs py-1 px-3 rounded-full cursor-pointer"
                  >
                    {msg.content}
                  </span>
                </div>
              )}

              {/* 파일 메시지 */}
              {isFile && !isSystem && (
                  <div className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} mb-2`}>
                {!isMe && (
                  <div className="flex flex-col items-center mr-2 self-start">
                    <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                      {msg.sender?.profileImage ? (
                        <img src={msg.sender.profileImage} alt="profile" className="w-full h-full object-cover" />
                      ) : (
                        msg.sender?.firstName?.[0] || '?'
                      )}
                    </div>
                  </div>
                )}
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%]`}>
                  {!isMe && <span className="text-xs text-gray-500 mb-1 ml-1">{msg.sender?.firstName}</span>}
                  {isImage ? (
                    <div className={`flex flex-row gap-1 items-end ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        <img
                          src={fileUrl}
                          alt={fileName}
                          className={`object-cover rounded-lg shadow-md cursor-pointer ${isMe ? 'hover:opacity-80' : ''}`}
                          style={{ width: '150px', height: '150px', minWidth: '150px', minHeight: '150px', maxWidth: '150px', maxHeight: '150px' }}
                          onClick={() => isMe ? setDeleteTarget(msg) : window.open(fileUrl, '_blank')}
                          onError={(e) => {
                          console.error('❌ Image load error:', fileUrl);
                        }}
                        />
                      <div className="flex flex-col gap-1 items-center mb-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFileDownload(fileUrl, fileName);
                          }}
                          className="p-1.5 rounded-full bg-gray-200 hover:bg-gray-300 transition-all"
                          title="다운로드"
                        >
                          <Download size={14} className="text-gray-700" />
                        </button>
                        <span className="text-[10px] text-gray-400">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => isMe && setDeleteTarget(msg)}
                      className={`rounded-xl shadow-sm relative overflow-hidden ${
                        isMe
                          ? 'bg-yellow-300 rounded-tr-none cursor-pointer hover:bg-yellow-400 transition-colors'
                          : 'bg-white border border-gray-200 rounded-tl-none'
                      }`}
                    >
                      {/* 문서 파일 */}
                      <div className="px-3 py-2 flex items-center gap-2 min-w-[200px]">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          {msg.fileType?.includes('pdf') ? (
                            <FileText size={24} className="text-red-500" />
                          ) : (
                            <FileText size={24} className="text-gray-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{fileName}</p>
                          <p className="text-xs text-gray-500">{msg.fileSize || ''}</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFileDownload(fileUrl, fileName);
                          }}
                          className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                          title="다운로드"
                        >
                          <Download size={18} className="text-gray-600" />
                        </button>
                      </div>
                    </div>
                  )}
                  {/* 시간 표시 (이미지가 아닐 때만) */}
                  {!isImage && (
                    <span className="text-[10px] text-gray-400 mt-1 px-1">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
              )}

              {/* 일반 텍스트 메시지 */}
              {!isSystem && !isFile && msg.type !== 'ai-suggestion' && (
            <div className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} mb-2`}>
              {!isMe && (
                <div className="flex flex-col items-center mr-2 self-start">
                  <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                    {msg.sender?.profileImage ? (
                      <img src={msg.sender.profileImage} alt="profile" className="w-full h-full object-cover" />
                    ) : (
                      msg.sender?.firstName?.[0] || '?'
                    )}
                  </div>
                </div>
              )}
              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%]`}>
                {!isMe && <span className="text-xs text-gray-500 mb-1 ml-1">{msg.sender?.firstName}</span>}
                <div className={`flex flex-row gap-1 items-end ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div
                    onClick={() => isMe && setDeleteTarget(msg)}
                    className={`px-3 py-2 rounded-xl shadow-sm relative text-sm break-words ${
                      isMe
                        ? 'bg-yellow-300 text-black rounded-tr-none cursor-pointer hover:bg-yellow-400 transition-colors'
                        : 'bg-white text-black border border-gray-200 rounded-tl-none'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-gray-400 mb-0.5">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
              )}
            </React.Fragment>
          );
        })}
        
        <div ref={messagesEndRef} />
      </div>

      {/* 하단으로 스크롤 버튼 */}
      {isUserScrolling && (
        <button
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-24 right-6 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-all z-20 animate-bounce-in"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </button>
      )}


      {/* 토스트 알림 (반응형) */}
      {toast && (
        <div className={`fixed top-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 animate-slide-down ${
          toast.type === 'success' ? 'bg-green-500 text-white' :
          toast.type === 'error' ? 'bg-red-500 text-white' :
          'bg-blue-500 text-white'
        }`}>
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}

      {/* 일정관리 모달 (SuggestionModal) */}
      <SuggestionModal
        isOpen={showSuggestionModal}
        onClose={() => setShowSuggestionModal(false)}
        roomId={roomId}
        socket={socketRef.current}
        isMobile={isMobile}
      />

      {/* 🆕 충돌 확인 모달 - Portal로 body에 렌더링 */}
      {conflictModal && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: '16px',
            isolation: 'isolate'
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" style={{ position: 'relative', zIndex: 1000000 }}>
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">⚠️</span>
              </div>
              <h3 className="text-lg font-bold text-gray-800">기존 일정이 있습니다</h3>
            </div>

            {/* 충돌하는 일정 목록 */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-700 font-medium mb-2">충돌하는 일정:</p>
              {conflictModal.conflicts?.map((conflict, idx) => (
                <div key={idx} className="text-sm text-red-600 flex items-center gap-2 py-1">
                  <Clock size={14} />
                  <span>{conflict.title} ({conflict.time})</span>
                </div>
              ))}
            </div>

            {/* 새 일정 정보 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-700 font-medium mb-2">참석하려는 일정:</p>
              <div className="text-sm text-blue-600">
                <div className="flex items-center gap-2 py-1">
                  <Calendar size={14} />
                  <span>{conflictModal.suggestion?.date}</span>
                </div>
                <div className="flex items-center gap-2 py-1">
                  <Clock size={14} />
                  <span>{conflictModal.suggestion?.startTime} ~ {conflictModal.suggestion?.endTime}</span>
                </div>
                <div className="font-medium mt-1">{conflictModal.suggestion?.summary}</div>
              </div>
            </div>

            <p className="text-sm text-gray-600 text-center mb-4">
              기존 일정과 시간이 겹칩니다.<br />
              그래도 참석하시겠습니까?
            </p>

            {/* 버튼 */}
            <div className="flex gap-3">
              <button
                onClick={() => setConflictModal(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                취소
              </button>
              <button
                onClick={() => handleForceAccept(conflictModal.suggestionId)}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                참석하기
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* 메시지 삭제 확인 모달 */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 mx-4 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-800 mb-2">메시지 삭제</h3>
            <p className="text-sm text-gray-600 mb-4">이 메시지를 삭제하시겠습니까?</p>
            <div className="bg-gray-100 rounded-lg p-3 mb-4">
              {deleteTarget.type === 'file' ? (
                <div className="flex items-center gap-2">
                  <FileText size={20} className="text-gray-500" />
                  <p className="text-sm text-gray-700 truncate">{deleteTarget.fileName || '파일'}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-700 line-clamp-3">{deleteTarget.content}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2 px-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                취소
              </button>
              <button
                onClick={() => handleDeleteMessage(deleteTarget._id)}
                className="flex-1 py-2 px-4 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 입력창 */}
      <form onSubmit={handleSend} className="bg-white p-3 border-t border-gray-200 flex items-center gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || isCorrecting}
          className="text-gray-500 hover:text-blue-600 p-2 rounded-full hover:bg-gray-100 disabled:opacity-50 transition-colors"
          title="파일 첨부"
        >
          {isUploading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
          ) : (
            <Paperclip size={20} />
          )}
        </button>
        <input
          type="text"
          className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
          placeholder={isCorrecting ? "오타 교정 중..." : "메시지를 입력하세요..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isCorrecting}
        />
        <button
          type="submit"
          disabled={!input.trim() || isCorrecting}
          className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
        >
          {isCorrecting ? (
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
          ) : (
            <Send size={20} />
          )}
        </button>
      </form>
    </div>
  );
};

export default GroupChat;
