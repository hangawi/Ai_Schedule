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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
          const isMe = msg.sender?._id === user?.id || msg.sender === user?.id;
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
            <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              {!isMe && (
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs mr-2 font-bold flex-shrink-0">
                  {msg.sender?.firstName?.[0] || '?'}
                </div>
              )}
              <div className={`max-w-[70%] p-3 rounded-lg shadow-sm ${
                isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none'
              }`}>
                {!isMe && <p className="text-xs text-gray-500 mb-1 font-semibold">{msg.sender?.firstName}</p>}
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <span className={`text-[10px] block mt-1 ${isMe ? 'text-blue-200' : 'text-gray-400'} text-right`}>
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
