import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Send, Calendar, Check, X, Bot, Paperclip, Download, FileText, Image as ImageIcon } from 'lucide-react';
import { auth } from '../../config/firebaseConfig';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const GroupChat = ({ roomId, user, isMobile }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [suggestion, setSuggestion] = useState(null); // AI 제안 상태
  const [isUploading, setIsUploading] = useState(false); // 파일 업로드 중
  const [isConfirming, setIsConfirming] = useState(false); // 일정 확정 중
  const [toast, setToast] = useState(null); // 토스트 알림 { message, type }
  const [isUserScrolling, setIsUserScrolling] = useState(false); // 사용자가 스크롤 중인지
  const [showConfirmModal, setShowConfirmModal] = useState(false); // 확인 모달 표시 여부
  const [conflictInfo, setConflictInfo] = useState(null); // 충돌 정보
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const socketRef = useRef(null);
  const fileInputRef = useRef(null);

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
    });

    // AI 일정 제안 수신
    socketRef.current.on('schedule-suggestion', (data) => {
      console.log('💡 AI Suggestion received:', data);
      setSuggestion(data); // 제안 카드 표시
    });

    // 일정 확정 시 새로고침 신호
    socketRef.current.on('schedule-confirmed-refresh', () => {
      // 필요 시 상위 컴포넌트에 알림 (일정표 갱신 등)
      setSuggestion(null); // 제안 카드 닫기
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [roomId]);

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

  // 파일 업로드 핸들러
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 크기 체크 (10MB 제한)
    if (file.size > 10 * 1024 * 1024) {
      alert('파일 크기는 10MB 이하여야 합니다.');
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
      alert('파일 업로드에 실패했습니다.');
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
      alert('다운로드에 실패했습니다.');
    }
  };

  // 메시지 리스트가 업데이트될 때마다 스크롤 하단으로 이동
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // AI 제안 카드가 표시될 때 스크롤 하단으로 이동
  useEffect(() => {
    if (suggestion) {
      setTimeout(() => scrollToBottom(true), 100); // 애니메이션 후 스크롤
    }
  }, [suggestion]);

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

    const content = input;
    setInput(''); // UI 즉시 반응

    try {
      const token = await auth.currentUser?.getIdToken();
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

  // 3. 일정 확정 핸들러 (1단계: 충돌 체크 후 모달 표시)
  const handleConfirmSchedule = async () => {
    if (!suggestion || isConfirming) return;

    setIsConfirming(true);

    try {
      const token = await auth.currentUser?.getIdToken();

      // 먼저 충돌 체크 API 호출
      const res = await fetch(`${API_BASE_URL}/api/chat/${roomId}/check-conflict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(suggestion)
      });

      if (!res.ok) {
        throw new Error('충돌 체크에 실패했습니다.');
      }

      const conflictData = await res.json();

      // 충돌 정보를 state에 저장하고 모달 표시
      setConflictInfo(conflictData);
      setShowConfirmModal(true);

    } catch (error) {
      console.error('Conflict check error:', error);
      showToast('❌ 충돌 체크에 실패했습니다.', 'error');
    } finally {
      setIsConfirming(false);
    }
  };

  // 4. 실제 일정 확정 핸들러 (2단계: 모달에서 확인 후 실행)
  const handleActualConfirm = async () => {
    if (!suggestion || isConfirming) return;

    setIsConfirming(true);
    setShowConfirmModal(false); // 모달 닫기

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/chat/${roomId}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(suggestion)
      });

      if (!res.ok) {
        throw new Error('일정 확정에 실패했습니다.');
      }

      // 성공
      showToast('✅ 일정이 확정되었습니다!', 'success');
      setSuggestion(null); // 카드 닫기
      setConflictInfo(null); // 충돌 정보 초기화

      // 일정 탭 새로고침을 위한 이벤트 발생 (상위 컴포넌트에서 처리 가능)
      window.dispatchEvent(new CustomEvent('schedule-confirmed'));

    } catch (error) {
      console.error('Confirm error:', error);
      showToast('❌ 일정 확정에 실패했습니다.', 'error');
    } finally {
      setIsConfirming(false);
    }
  };

  // 5. 일정 거절 핸들러
  const handleRejectSchedule = async () => {
    if (!suggestion) return;

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/chat/${roomId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(suggestion)
      });

      if (!res.ok) {
        throw new Error('일정 거절 처리에 실패했습니다.');
      }

      // 성공
      showToast('🚫 일정 제안을 거절했습니다.', 'info');
      setSuggestion(null); // 카드 닫기

    } catch (error) {
      console.error('Reject error:', error);
      showToast('❌ 거절 처리에 실패했습니다.', 'error');
    }
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
                  <span className="bg-gray-200 text-gray-600 text-xs py-1 px-3 rounded-full">
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
                          className="object-cover rounded-lg shadow-md cursor-pointer"
                          style={{ width: '150px', height: '150px', minWidth: '150px', minHeight: '150px', maxWidth: '150px', maxHeight: '150px' }}
                          onClick={() => window.open(fileUrl, '_blank')}
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
                    <div className={`rounded-xl shadow-sm relative overflow-hidden ${
                      isMe
                        ? 'bg-yellow-300 rounded-tr-none'
                        : 'bg-white border border-gray-200 rounded-tl-none'
                    }`}>
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
                          onClick={() => handleFileDownload(fileUrl, fileName)}
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
              {!isSystem && !isFile && (
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
                  <div className={`px-3 py-2 rounded-xl shadow-sm relative text-sm break-words ${
                    isMe
                      ? 'bg-yellow-300 text-black rounded-tr-none'
                      : 'bg-white text-black border border-gray-200 rounded-tl-none'
                  }`}>
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
        
        {/* AI Suggestion Card (채팅창 하단에 고정되지 않고 흐름 속에 삽입되거나, 오버레이로 뜸) 
            여기서는 채팅 흐름 하단에 고정된 오버레이로 처리 */}
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

      {/* AI 일정 제안 팝업 (개선된 UI) */}
      {suggestion && (
        <div className="mx-3 md:mx-4 mb-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-2xl shadow-xl p-4 md:p-5 relative overflow-hidden animate-bounce-in">
          {/* 배경 장식 */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-200 rounded-full blur-3xl opacity-30 -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-200 rounded-full blur-3xl opacity-30 -ml-16 -mb-16"></div>

          {/* 좌측 강조선 */}
          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-blue-500 to-indigo-600"></div>

          <div className="relative z-10">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center space-x-2">
                <div className="bg-blue-600 p-2 rounded-xl">
                  <Bot size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-blue-700 font-bold text-sm">AI가 일정을 분석했어요</p>
                  <p className="text-blue-500 text-xs">아래 일정으로 확정할까요?</p>
                </div>
              </div>
              <button
                onClick={handleRejectSchedule}
                className="text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-full p-1 transition-all"
                disabled={isConfirming}
              >
                <X size={20} />
              </button>
            </div>

            <div className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-blue-100">
              <h3 className="text-xl font-bold text-gray-800 mb-2 flex items-center">
                📅 {suggestion.summary || '새로운 일정'}
              </h3>
              <div className="space-y-2">
                <div className="flex items-center text-gray-700">
                  <Calendar size={16} className="mr-2 text-blue-600" />
                  <span className="font-medium">{suggestion.date}</span>
                </div>
                <div className="flex items-center text-gray-700">
                  <span className="mr-2 text-blue-600">🕐</span>
                  <span>{suggestion.startTime} ~ {suggestion.endTime}</span>
                </div>
                {suggestion.location && (
                  <div className="flex items-center text-gray-600">
                    <span className="mr-2">📍</span>
                    <span>{suggestion.location}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={handleConfirmSchedule}
                disabled={isConfirming}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2.5 sm:py-3 rounded-xl text-sm font-bold hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 flex items-center justify-center transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              >
                {isConfirming ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                    확정 중...
                  </>
                ) : (
                  <>
                    <Check size={16} className="mr-1" /> 일정 확정하기
                  </>
                )}
              </button>
              <button
                onClick={handleRejectSchedule}
                disabled={isConfirming}
                className="flex-1 bg-white text-gray-700 py-2.5 sm:py-3 rounded-xl text-sm font-bold hover:bg-gray-50 disabled:opacity-50 border border-gray-200 transition-all shadow-sm hover:shadow"
              >
                다시 논의하기
              </button>
            </div>
          </div>
        </div>
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

      {/* 확인 모달 (선호시간 충돌 정보 표시) */}
      {showConfirmModal && conflictInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              {/* 헤더 */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">일정 확정 확인</h2>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
                >
                  <X size={24} />
                </button>
              </div>

              {/* 일정 정보 */}
              <div className="bg-blue-50 rounded-xl p-4 mb-4 border border-blue-200">
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  📅 {suggestion?.summary || '새로운 일정'}
                </h3>
                <div className="space-y-1 text-sm text-gray-700">
                  <div className="flex items-center">
                    <Calendar size={16} className="mr-2 text-blue-600" />
                    <span>{suggestion?.date}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="mr-2 text-blue-600">🕐</span>
                    <span>{suggestion?.startTime} ~ {suggestion?.endTime}</span>
                  </div>
                  {suggestion?.location && (
                    <div className="flex items-center">
                      <span className="mr-2">📍</span>
                      <span>{suggestion?.location}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 충돌 정보 */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">멤버 가능 여부</h3>

                {conflictInfo.hasConflict ? (
                  <div className="space-y-3">
                    {/* 경고 메시지 */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="flex items-start">
                        <span className="text-yellow-600 mr-2">⚠️</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-yellow-800 mb-1">
                            {conflictInfo.conflictCount}명의 멤버가 이 시간에 이미 다른 약속이 있습니다
                          </p>
                          <p className="text-xs text-yellow-700">
                            충돌이 있어도 일정을 확정할 수 있지만, 멤버들과 다시 상의하는 것을 권장합니다.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 충돌 상세 정보 */}
                    <div className="space-y-2">
                      {conflictInfo.conflicts.map((conflict, idx) => (
                        <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="text-sm font-medium text-red-800 mb-1">
                            👤 {conflict.userName}
                          </p>
                          <ul className="text-xs text-red-700 space-y-1 ml-4">
                            {conflict.reasons.map((reason, ridx) => (
                              <li key={ridx}>
                                • {reason.type === 'confirmed' && `${reason.title} (${reason.time}) [확정됨]`}
                                {reason.type === 'personal' && `${reason.title} (${reason.time})`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>

                    {/* 가능한 멤버 */}
                    {conflictInfo.availableCount > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-sm font-medium text-green-800">
                          ✅ 가능한 멤버 ({conflictInfo.availableCount}명)
                        </p>
                        <p className="text-xs text-green-700 mt-1">
                          {conflictInfo.availableMembers.map(m => m.userName).join(', ')}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <span className="text-green-600 text-2xl mr-3">✅</span>
                      <div>
                        <p className="text-sm font-medium text-green-800">
                          모든 멤버가 이 시간에 가능합니다!
                        </p>
                        <p className="text-xs text-green-700 mt-1">
                          총 {conflictInfo.totalMembers}명의 멤버 모두 충돌이 없습니다.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 버튼 */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl text-sm font-bold hover:bg-gray-200 transition-all"
                >
                  취소
                </button>
                <button
                  onClick={handleActualConfirm}
                  disabled={isConfirming}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl text-sm font-bold hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 transition-all"
                >
                  {isConfirming ? '확정 중...' : '일정 추가'}
                </button>
              </div>
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
          disabled={isUploading}
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
          placeholder="메시지를 입력하세요..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
};

export default GroupChat;
