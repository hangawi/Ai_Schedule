import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Send, Calendar, Check, X, Bot } from 'lucide-react';
import { auth } from '../../config/firebaseConfig';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const GroupChat = ({ roomId, user, isMobile }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [suggestion, setSuggestion] = useState(null); // AI 제안 상태
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  // 1. 초기 로드 및 소켓 연결
  useEffect(() => {
    // 채팅 내역 불러오기
    fetchMessages();
    
    // 읽음 처리 알림
    markMessagesAsRead();

    // 소켓 연결
    socketRef.current = io(API_BASE_URL, { transports: ['websocket', 'polling'] });
    socketRef.current.emit('join-room', roomId);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 메시지 리스트가 업데이트될 때마다 스크롤 하단으로 이동
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  // 3. 일정 확정 핸들러
  const handleConfirmSchedule = async () => {
    if (!suggestion) return;

    try {
      const token = await auth.currentUser?.getIdToken();
      await fetch(`${API_BASE_URL}/api/chat/${roomId}/confirm`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(suggestion) // { date, startTime, endTime, summary }
      });
      setSuggestion(null); // 카드 닫기
    } catch (error) {
      console.error('Confirm error:', error);
      alert('일정 확정에 실패했습니다.');
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-100">
      {/* 메시지 리스트 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => {
          // 1. 보낸 사람 식별자 추출 (이메일 우선, 없으면 ID)
          const senderObj = msg.sender;
          const senderEmail = typeof senderObj === 'object' ? senderObj.email : null;
          const senderId = typeof senderObj === 'object' ? (senderObj._id || senderObj.id) : senderObj;
          
          // 2. 내 식별자 추출
          const myEmail = user?.email;
          const myId = user?._id || user?.id;

          // 3. 비교 (이메일이 있으면 이메일로, 없으면 ID로)
          let isMe = false;
          if (senderEmail && myEmail) {
            isMe = senderEmail === myEmail;
          } else {
            isMe = senderId && myId && senderId.toString() === myId.toString();
          }
          
          // console.log(`Msg ${idx}: Me=${myEmail}/${myId}, Sender=${senderEmail}/${senderId}, Match=${isMe}`);

          const isSystem = msg.type === 'system';

          if (isSystem) {
            return (
              <div key={idx} className="flex justify-center my-2">
                <span className="bg-gray-200 text-gray-600 text-xs py-1 px-3 rounded-full">
                  {msg.content}
                </span>
              </div>
            );
          }

          return (
            <div key={idx} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} mb-3`}>
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
                <div className={`px-3 py-2 rounded-xl shadow-sm relative text-sm break-words ${
                  isMe 
                    ? 'bg-yellow-300 text-black rounded-tr-none' 
                    : 'bg-white text-black border border-gray-200 rounded-tl-none'
                }`}>
                  {msg.content}
                </div>
                <span className="text-[10px] text-gray-400 mt-1 px-1">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
        
        {/* AI Suggestion Card (채팅창 하단에 고정되지 않고 흐름 속에 삽입되거나, 오버레이로 뜸) 
            여기서는 채팅 흐름 하단에 고정된 오버레이로 처리 */}
        <div ref={messagesEndRef} />
      </div>

      {/* AI 일정 제안 팝업 */}
      {suggestion && (
        <div className="mx-4 mb-4 bg-white border border-blue-200 rounded-xl shadow-lg p-4 animate-slide-up relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center text-blue-600 font-bold">
              <Bot size={18} className="mr-2" />
              AI 일정 제안
            </div>
            <button onClick={() => setSuggestion(null)} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
          <div className="mb-4">
            <h3 className="text-lg font-bold text-gray-800">{suggestion.summary || '새로운 일정'}</h3>
            <div className="flex items-center text-gray-600 mt-1">
              <Calendar size={16} className="mr-2" />
              <span>{suggestion.date} {suggestion.startTime} ~ {suggestion.endTime}</span>
            </div>
            {suggestion.location && <p className="text-sm text-gray-500 mt-1 ml-6">📍 {suggestion.location}</p>}
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleConfirmSchedule}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-blue-700 flex items-center justify-center transition-colors"
            >
              <Check size={16} className="mr-1" /> 확정하기
            </button>
            <button 
              onClick={() => setSuggestion(null)}
              className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors"
            >
              거절
            </button>
          </div>
        </div>
      )}

      {/* 입력창 */}
      <form onSubmit={handleSend} className="bg-white p-3 border-t border-gray-200 flex items-center gap-2">
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
