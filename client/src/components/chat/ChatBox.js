import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle, Image, X } from 'lucide-react';

const ChatBox = ({ onSendMessage, speak, currentTab, onEventUpdate }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const messagesEndRef = useRef(null);
  const imageInputRef = useRef(null);

  useEffect(() => {
    const checkMobile = () => {
      // 강력한 모바일 감지: 데스크톱을 확실히 제외하는 방식
      const userAgent = navigator.userAgent;
      const isDesktop = /Windows NT|Macintosh|X11.*Linux/i.test(userAgent) && 
                        !/Mobile|Tablet/i.test(userAgent);
      
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent);
      
      const mobile = !isDesktop && (isMobileUA || window.innerWidth <= 768);
      setIsMobile(mobile);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleImageSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  // 충돌 해결 핸들러
  const handleConflictChoice = async (choice, pendingEvent, conflictingEventId, conflictingEventTitle) => {
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
    const token = localStorage.getItem('token');

    try {
      const loadingMessage = {
        id: Date.now(),
        text: '처리 중...',
        sender: 'bot',
        timestamp: new Date(),
        isLoading: true
      };
      setMessages(prev => [...prev, loadingMessage]);

      if (choice === 1) {
        // 옵션 1: 다른 시간 추천받기

        // 프로필 탭은 프론트에서 직접 처리
        if (currentTab === 'profile') {
          setMessages(prev => prev.filter(msg => !msg.isLoading));

          const requestedStart = new Date(pendingEvent.startTime);
          const duration = pendingEvent.duration || 60;
          const searchOffsets = [-180, -120, -60, 60, 120, 180];
          const recommendations = [];
          const existingEvents = pendingEvent.allExistingEvents || [];

          for (const offset of searchOffsets) {
            const candidateStart = new Date(requestedStart.getTime() + offset * 60 * 1000);
            const candidateEnd = new Date(candidateStart.getTime() + duration * 60 * 1000);

            if (candidateStart.getHours() < 9 || candidateStart.getHours() >= 22) continue;
            if (candidateStart.getDate() !== requestedStart.getDate()) continue;

            // 충돌 체크
            const hasConflict = existingEvents.some(event => {
              const eventStart = new Date(event.startTime || event.start?.dateTime);
              const eventEnd = new Date(event.endTime || event.end?.dateTime);
              return candidateStart < eventEnd && candidateEnd > eventStart;
            });

            if (hasConflict) continue;

            const hourLabel = candidateStart.getHours();
            const minuteLabel = candidateStart.getMinutes();
            const timeLabel = `${hourLabel}시${minuteLabel > 0 ? ` ${minuteLabel}분` : ''}`;

            recommendations.push({
              startTime: candidateStart.toISOString(),
              endTime: candidateEnd.toISOString(),
              display: `${timeLabel} (${candidateStart.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} - ${candidateEnd.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })})`
            });

            if (recommendations.length >= 5) break;
          }

          const message = recommendations.length > 0
            ? `그 시간엔 약속이 있으니, 이 시간은 어떠세요?\n\n${recommendations.map((r, i) => `${i + 1}. ${r.display}`).join('\n')}`
            : '죄송합니다. 해당 날짜에 추천할 만한 시간이 없습니다.';

          const botMessage = {
            id: Date.now() + 1,
            text: message,
            sender: 'bot',
            timestamp: new Date(),
            success: recommendations.length > 0,
            recommendations: recommendations,
            pendingEvent: pendingEvent,
            _nextStep: 'select_alternative_time'
          };
          setMessages(prev => [...prev, botMessage]);
          return;
        }

        // 나의 일정 탭은 백엔드 API 사용
        let response = await fetch(`${API_BASE_URL}/api/conflict/recommend-alternative`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': token
          },
          body: JSON.stringify({ pendingEvent })
        });

        const data = await response.json();
        setMessages(prev => prev.filter(msg => !msg.isLoading));

        const botMessage = {
          id: Date.now() + 1,
          text: data.message,
          sender: 'bot',
          timestamp: new Date(),
          success: data.status === 'success',
          recommendations: data.recommendations,
          pendingEvent: data.pendingEvent,
          _nextStep: 'select_alternative_time'
        };
        setMessages(prev => [...prev, botMessage]);

      } else if (choice === 2) {
        // 옵션 2: 기존 약속 변경하기

        // 프로필 탭은 시간 추천 먼저 표시
        if (currentTab === 'profile') {
          setMessages(prev => prev.filter(msg => !msg.isLoading));

          // 기존 일정의 시간 정보 가져오기
          const originalStart = new Date(pendingEvent.startTime);
          const duration = pendingEvent.duration || 60;

          // 같은 날 내에서 추천 시간 생성 (원래 시간 기준 ±1~3시간)
          const searchOffsets = [-180, -120, -60, 60, 120, 180]; // 분 단위
          const recommendations = [];
          const existingEvents = pendingEvent.allExistingEvents || [];

          for (const offset of searchOffsets) {
            const candidateStart = new Date(originalStart.getTime() + offset * 60 * 1000);
            const candidateEnd = new Date(candidateStart.getTime() + duration * 60 * 1000);

            // 업무 시간대만 (9시 ~ 22시)
            if (candidateStart.getHours() < 9 || candidateStart.getHours() >= 22) continue;
            if (candidateStart.getDate() !== originalStart.getDate()) continue;

            // 기존 일정과 충돌 체크 (겹치지 않는 시간만 추천)
            const hasConflict = existingEvents.some(event => {
              const eventStart = new Date(event.startTime || event.start?.dateTime);
              const eventEnd = new Date(event.endTime || event.end?.dateTime);
              return candidateStart < eventEnd && candidateEnd > eventStart;
            });

            if (hasConflict) continue; // 충돌하면 건너뛰기

            const hourLabel = candidateStart.getHours();
            const minuteLabel = candidateStart.getMinutes();
            const timeLabel = `${hourLabel}시${minuteLabel > 0 ? ` ${minuteLabel}분` : ''}`;

            recommendations.push({
              startTime: candidateStart.toISOString(),
              endTime: candidateEnd.toISOString(),
              display: `${timeLabel} (${candidateStart.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} - ${candidateEnd.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })})`
            });

            if (recommendations.length >= 5) break;
          }

          const originalTimeStr = `${originalStart.getHours()}시${originalStart.getMinutes() > 0 ? ` ${originalStart.getMinutes()}분` : ''}`;
          const message = recommendations.length > 0
            ? `"${conflictingEventTitle}" (${originalTimeStr})을 언제로 옮기시겠어요?\n\n${recommendations.map((r, i) => `${i + 1}. ${r.display}`).join('\n')}`
            : '죄송합니다. 해당 날짜에 옮길 만한 시간이 없습니다.';

          const botMessage = {
            id: Date.now() + 1,
            text: message,
            sender: 'bot',
            timestamp: new Date(),
            success: recommendations.length > 0,
            recommendations: recommendations,
            conflictingEventTitle: conflictingEventTitle,
            pendingEvent: pendingEvent,
            _nextStep: 'select_reschedule_time_profile'
          };
          setMessages(prev => [...prev, botMessage]);

          return;
        }

        // 나의 일정 탭만 옵션 2 지원
        let response;
        try {
          response = await fetch(`${API_BASE_URL}/api/conflict/recommend-reschedule`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-auth-token': token
            },
            body: JSON.stringify({ conflictingEventId })
          });

          const data = await response.json();
          setMessages(prev => prev.filter(msg => !msg.isLoading));

          const botMessage = {
            id: Date.now() + 1,
            text: data.message,
            sender: 'bot',
            timestamp: new Date(),
            success: data.status === 'success',
            recommendations: data.recommendations,
            conflictingEvent: data.conflictingEvent,
            pendingEvent: pendingEvent,
            _nextStep: 'select_reschedule_time'
          };
          setMessages(prev => [...prev, botMessage]);
        } catch (err) {
          setMessages(prev => prev.filter(msg => !msg.isLoading));
          const botMessage = {
            id: Date.now() + 1,
            text: '기존 일정 변경 중 오류가 발생했습니다. 다른 시간 추천받기를 이용해주세요.',
            sender: 'bot',
            timestamp: new Date(),
            success: false
          };
          setMessages(prev => [...prev, botMessage]);
          return;
        }
      }
    } catch (error) {
      setMessages(prev => prev.filter(msg => !msg.isLoading));
      const errorMessage = {
        id: Date.now() + 1,
        text: '처리 중 오류가 발생했습니다.',
        sender: 'bot',
        timestamp: new Date(),
        success: false
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  // 시간 선택 확정 핸들러
  const handleTimeSelection = async (selectedTime, pendingEvent, conflictingEventId, action, conflictingEventTitle, nextStep) => {
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
    const token = localStorage.getItem('token');

    try {
      const loadingMessage = {
        id: Date.now(),
        text: '일정을 확정하고 있습니다...',
        sender: 'bot',
        timestamp: new Date(),
        isLoading: true
      };
      setMessages(prev => [...prev, loadingMessage]);

      let response;
      let data;

      // 프로필 탭은 직접 처리 (백엔드 API가 Event 모델 기반이라 작동 안 함)
      if (currentTab === 'profile') {
        if (action === 'reschedule' || nextStep === 'select_reschedule_time_profile') {
          // 옵션 2: 기존 일정 옮기고 새 일정 추가
          // 1단계: 기존 일정 삭제
          const deleteMessage = `"${conflictingEventTitle}" 삭제해줘`;
          const deleteResult = await onSendMessage(deleteMessage);

          setMessages(prev => prev.filter(msg => !msg.isLoading));

          const deleteResultMessage = {
            id: Date.now() + 1,
            text: deleteResult.message || '기존 일정을 삭제했습니다.',
            sender: 'bot',
            timestamp: new Date(),
            success: deleteResult.success !== false
          };
          setMessages(prev => [...prev, deleteResultMessage]);

          // 2단계: 기존 일정을 선택한 시간에 추가
          await new Promise(resolve => setTimeout(resolve, 800));

          const rescheduleLoadingMessage = {
            id: Date.now() + 2,
            text: '기존 일정을 옮기고 있습니다...',
            sender: 'bot',
            timestamp: new Date(),
            isLoading: true
          };
          setMessages(prev => [...prev, rescheduleLoadingMessage]);

          const selectedDate = new Date(selectedTime.startTime);
          const dateStr = `${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일`;
          const timeStr = selectedDate.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });

          const rescheduleMessage = `${dateStr} ${timeStr}에 "${conflictingEventTitle}" 일정을 추가해줘`;
          const rescheduleResult = await onSendMessage(rescheduleMessage);

          setMessages(prev => prev.filter(msg => !msg.isLoading));

          const rescheduleResultMessage = {
            id: Date.now() + 3,
            text: rescheduleResult.message || '기존 일정을 옮겼습니다.',
            sender: 'bot',
            timestamp: new Date(),
            success: rescheduleResult.success !== false
          };
          setMessages(prev => [...prev, rescheduleResultMessage]);

          // 3단계: 새 일정을 원래 시간에 추가 (충돌 체크 없이)
          await new Promise(resolve => setTimeout(resolve, 1500));

          const newEventLoadingMessage = {
            id: Date.now() + 4,
            text: '새 일정을 추가하고 있습니다...',
            sender: 'bot',
            timestamp: new Date(),
            isLoading: true
          };
          setMessages(prev => [...prev, newEventLoadingMessage]);

          // 직접 API 호출 (충돌 체크 건너뛰기)
          try {
            const currentScheduleResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
              headers: { 'x-auth-token': token }
            });

            if (currentScheduleResponse.ok) {
              const currentSchedule = await currentScheduleResponse.json();
              const pendingStart = new Date(pendingEvent.startTime);
              const pendingEnd = new Date(pendingEvent.endTime);

              const targetDate = pendingStart.toISOString().split('T')[0];
              const startTimeStr = `${String(pendingStart.getHours()).padStart(2, '0')}:${String(pendingStart.getMinutes()).padStart(2, '0')}`;
              const endTimeStr = `${String(pendingEnd.getHours()).padStart(2, '0')}:${String(pendingEnd.getMinutes()).padStart(2, '0')}`;

              // 기존 scheduleExceptions 정리 (Mongoose 메타데이터 제거 및 유효성 검증)
              const cleanedExceptions = (currentSchedule.scheduleExceptions || [])
                .filter(exc => exc.startTime && exc.endTime && exc.specificDate)
                .map(exc => ({
                  specificDate: exc.specificDate,
                  startTime: exc.startTime,
                  endTime: exc.endTime,
                  title: exc.title || '',
                  description: exc.description || ''
                }));

              const updatedExceptions = [
                ...cleanedExceptions,
                {
                  specificDate: targetDate,
                  startTime: startTimeStr,
                  endTime: endTimeStr,
                  title: pendingEvent.title,
                  description: pendingEvent.description || ''
                }
              ];

              const updateResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'x-auth-token': token
                },
                body: JSON.stringify({
                  scheduleExceptions: updatedExceptions
                })
              });

              setMessages(prev => prev.filter(msg => !msg.isLoading));

              if (updateResponse.ok) {
                const finalMessage = {
                  id: Date.now() + 5,
                  text: `✓ "${pendingEvent.title}" 일정이 추가되었습니다.`,
                  sender: 'bot',
                  timestamp: new Date(),
                  success: true
                };
                setMessages(prev => [...prev, finalMessage]);

                if (onEventUpdate) {
                  onEventUpdate();
                }
                window.dispatchEvent(new Event('calendarUpdate'));
              } else {
                throw new Error('일정 추가 실패');
              }
            }
          } catch (err) {
            setMessages(prev => prev.filter(msg => !msg.isLoading));
            const errorMessage = {
              id: Date.now() + 5,
              text: '새 일정 추가 중 오류가 발생했습니다.',
              sender: 'bot',
              timestamp: new Date(),
              success: false
            };
            setMessages(prev => [...prev, errorMessage]);
          }

          return;
        }

        // 옵션 1: 다른 시간 추천 - 선택한 시간에 추가
        const pendingDate = new Date(pendingEvent.startTime);
        const selectedDate = new Date(selectedTime.startTime);

        const dateStr = `${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일`;
        const timeStr = selectedDate.toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });

        const message = `${dateStr} ${timeStr}에 "${pendingEvent.title}" 일정을 추가해줘`;
        const result = await onSendMessage(message);

        setMessages(prev => prev.filter(msg => !msg.isLoading));

        const botMessage = {
          id: Date.now() + 1,
          text: result.message || '일정이 추가되었습니다.',
          sender: 'bot',
          timestamp: new Date(),
          success: result.success !== false
        };
        setMessages(prev => [...prev, botMessage]);

        if (result.success !== false) {
          if (onEventUpdate) {
            onEventUpdate();
          }
          window.dispatchEvent(new Event('calendarUpdate'));
        }
        return;
      }

      // 나의 일정 탭은 백엔드 API 사용
      if (action === 'alternative') {
        // 옵션 1 확정: 새 일정을 선택한 시간에 추가
        response = await fetch(`${API_BASE_URL}/api/conflict/confirm-alternative`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': token
          },
          body: JSON.stringify({ selectedTime, pendingEvent })
        });
      } else if (action === 'reschedule') {
        // 옵션 2 확정: 기존 일정 옮기고 새 일정 추가
        response = await fetch(`${API_BASE_URL}/api/conflict/confirm-reschedule`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': token
          },
          body: JSON.stringify({ conflictingEventId, selectedTime, pendingEvent })
        });
      }

      data = await response.json();
      setMessages(prev => prev.filter(msg => !msg.isLoading));

      const botMessage = {
        id: Date.now() + 1,
        text: data.message,
        sender: 'bot',
        timestamp: new Date(),
        success: data.status === 'success'
      };
      setMessages(prev => [...prev, botMessage]);

      // 캘린더 즉시 새로고침 (프로필, 구글, 이벤트 모든 탭)
      if (data.status === 'success') {
        // 1. 부모 컴포넌트의 eventAddedKey 업데이트 (있으면)
        if (onEventUpdate) {
          onEventUpdate();
        }

        // 2. 커스텀 이벤트 발생
        window.dispatchEvent(new CustomEvent('calendarUpdate', {
          detail: {
            type: 'conflict_resolution',
            timestamp: Date.now(),
            action: action
          }
        }));

        // 3. 일반 이벤트도 발생
        window.dispatchEvent(new Event('calendarUpdate'));

        // 4. 약간의 지연 후 재확인 (탭별 캘린더 컴포넌트 재렌더링 보장)
        setTimeout(() => {
          if (onEventUpdate) {
            onEventUpdate();
          }
          window.dispatchEvent(new Event('calendarUpdate'));
        }, 100);
      }
    } catch (error) {
      setMessages(prev => prev.filter(msg => !msg.isLoading));
      const errorMessage = {
        id: Date.now() + 1,
        text: '일정 확정 중 오류가 발생했습니다.',
        sender: 'bot',
        timestamp: new Date(),
        success: false
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleAddSchedules = async (schedules) => {
    try {
      // 로딩 메시지 추가
      const loadingMessage = {
        id: Date.now(),
        text: '일정을 추가하고 있습니다...',
        sender: 'bot',
        timestamp: new Date(),
        isLoading: true
      };
      setMessages(prev => [...prev, loadingMessage]);

      // 각 스케줄을 개별적으로 추가
      const results = [];
      for (const schedule of schedules) {
        try {
          const result = await onSendMessage(`"${schedule.title}" 일정을 ${schedule.date} ${schedule.time}에 추가해줘${schedule.location ? ` 장소: ${schedule.location}` : ''}`);
          results.push({
            schedule,
            success: result.success,
            message: result.message
          });
        } catch (error) {
          results.push({
            schedule,
            success: false,
            message: '일정 추가 중 오류가 발생했습니다.'
          });
        }
      }

      // 로딩 메시지 제거
      setMessages(prev => prev.filter(msg => !msg.isLoading));

      // 결과 메시지 생성
      const successCount = results.filter(r => r.success).length;
      const totalCount = results.length;

      const resultMessage = {
        id: Date.now() + 1,
        text: `총 ${totalCount}개 일정 중 ${successCount}개를 성공적으로 추가했습니다.`,
        sender: 'bot',
        timestamp: new Date(),
        success: successCount === totalCount
      };

      setMessages(prev => [...prev, resultMessage]);

    } catch (error) {
      // 로딩 메시지 제거
      setMessages(prev => prev.filter(msg => !msg.isLoading));

      const errorMessage = {
        id: Date.now() + 1,
        text: '일정 추가 중 오류가 발생했습니다.',
        sender: 'bot',
        timestamp: new Date(),
        success: false
      };

      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() && !selectedImage) return;

    const userMessage = {
      id: Date.now(),
      text: selectedImage ? (inputText.trim() || '사진에서 일정을 추출해주세요') : inputText,
      sender: 'user',
      timestamp: new Date(),
      image: imagePreview
    };

    setMessages(prev => [...prev, userMessage]);
    const originalMessage = inputText;
    const originalImage = selectedImage;

    setInputText('');
    removeImage();

    // 로딩 메시지 표시
    const loadingMessage = {
      id: Date.now() + 1,
      text: originalImage ? '사진에서 일정을 분석하고 있습니다...' : '일정을 처리하고 있습니다...',
      sender: 'bot',
      timestamp: new Date(),
      isLoading: true
    };

    setMessages(prev => [...prev, loadingMessage]);

    try {
      let result;
      if (originalImage) {
        // 이미지가 있는 경우 이미지 분석 API 호출
        const formData = new FormData();
        formData.append('image', originalImage);
        if (originalMessage.trim()) {
          formData.append('message', originalMessage);
        }

        const token = localStorage.getItem('token');
        const response = await fetch('/api/calendar/analyze-image', {
          method: 'POST',
          headers: {
            'x-auth-token': token
          },
          body: formData
        });

        result = await response.json();
      } else {
        // 텍스트만 있는 경우 기존 API 호출
        result = await onSendMessage(originalMessage);
      }

      // 로딩 메시지 제거하고 실제 응답 추가
      setMessages(prev => prev.filter(msg => !msg.isLoading));

      const botMessage = {
        id: Date.now() + 2,
        text: result.message,
        sender: 'bot',
        timestamp: new Date(),
        success: result.success,
        extractedSchedules: result.extractedSchedules, // 추출된 스케줄 정보
        suggestedTimes: result.suggestedTimes, // 추천 시간대
        hasConflict: result.hasConflict, // 충돌 여부
        conflictingEvents: result.conflictingEvents, // 충돌 일정
        pendingEvent: result.pendingEvent, // 대기 중인 일정
        actions: result.actions, // 사용자 선택 옵션
        _nextStep: result._nextStep // 다음 단계
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      setMessages(prev => prev.filter(msg => !msg.isLoading));

      const errorMessage = {
        id: Date.now() + 2,
        text: '죄송합니다. 오류가 발생했습니다.',
        sender: 'bot',
        timestamp: new Date(),
        success: false
      };

      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* 채팅 버튼 - 모바일에서는 상태창과 겹치지 않게 배치 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-4 right-4 w-14 h-14 rounded-full shadow-lg transition-all duration-300 z-50 flex items-center justify-center ${
          isOpen ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
        } text-white`}
      >
{isOpen ? (
          <span className="font-bold text-lg">AI</span>
        ) : (
          <MessageCircle size={24} />
        )}
      </button>

      {/* 채팅창 */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-30 z-40" 
          onClick={() => setIsOpen(false)}
        >
          <div
            className={`fixed ${isMobile ? 'bottom-20 right-2 left-2' : 'bottom-20 right-4'} ${isMobile ? 'max-h-[70vh] h-[750px]' : 'h-[1125px]'} bg-white rounded-lg shadow-xl border z-50 flex flex-col`}
            onClick={(e) => e.stopPropagation()}
            style={isMobile ? {
              maxHeight: Math.min(750, window.innerHeight * 0.7),
              minHeight: '600px'
            } : {
              width: '750px'
            }}
          >
            {/* 헤더 */}
            <div className="bg-blue-500 text-white p-3 rounded-t-lg">
              <h3 className="font-semibold">AI 일정 도우미</h3>
              <p className="text-xs opacity-90">
                {currentTab === 'profile' && '내 프로필 일정 관리'}
                {currentTab === 'events' && '나의 일정 관리'}
                {currentTab === 'googleCalendar' && 'Google 캘린더 관리'}
                {!['profile', 'events', 'googleCalendar'].includes(currentTab) && '일정 추가, 수정, 삭제를 도와드립니다'}
              </p>
            </div>

            {/* 메시지 영역 */}
            <div
              className="overflow-y-auto p-3 space-y-3 flex-1"
              style={{
                minHeight: isMobile ? '300px' : '525px',
                maxHeight: isMobile ? 'calc(60vh - 140px)' : '525px'
              }}
            >
              {messages.length === 0 && (
                <div className="text-center text-gray-500 text-sm mt-4">
                  <p className="font-semibold">안녕하세요! 일정 관리를 도와드리겠습니다.</p>
                  <div className="mt-3 text-xs space-y-1">
                    <p><span className="font-medium text-blue-600">추가:</span> "내일 오후 3시 회의 추가해줘"</p>
                    <p><span className="font-medium text-red-600">삭제:</span> "내일 회의 일정 삭제해줘"</p>
                    <p><span className="font-medium text-green-600">수정:</span> "회의 시간을 4시로 수정해줘"</p>
                  </div>
                </div>
              )}
              
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-sm p-3 rounded-lg text-sm ${
                      message.sender === 'user'
                        ? 'bg-blue-500 text-white rounded-br-none'
                        : message.isLoading
                        ? 'bg-yellow-100 text-yellow-800 rounded-bl-none'
                        : message.success === false
                        ? 'bg-red-100 text-red-800 rounded-bl-none'
                        : message.success === true
                        ? 'bg-green-100 text-green-800 rounded-bl-none'
                        : 'bg-gray-100 text-gray-800 rounded-bl-none'
                    }`}
                  >
                    {/* 이미지 미리보기 (사용자 메시지만) */}
                    {message.image && (
                      <div className="mb-2">
                        <img
                          src={message.image}
                          alt="업로드된 이미지"
                          className="max-w-full h-auto rounded border"
                          style={{ maxHeight: '150px' }}
                        />
                      </div>
                    )}

                    <div className="flex items-start">
                      {message.isLoading && (
                        <span className="animate-spin mr-2 mt-0.5">⏳</span>
                      )}
                      {message.success === true && (
                        <span className="mr-2 mt-0.5">✅</span>
                      )}
                      {message.success === false && (
                        <span className="mr-2 mt-0.5">❌</span>
                      )}
                      <p className="whitespace-pre-line">{message.text}</p>
                    </div>

                    {/* 충돌 선택 버튼 (1단계: 다른 시간 vs 기존 약속 변경) */}
                    {message.hasConflict && message.actions && (
                      <div className="mt-3 p-2 bg-white bg-opacity-20 rounded border">
                        <p className="text-xs font-semibold mb-2">어떻게 하시겠어요?</p>
                        <div className="space-y-2">
                          {message.actions.map((action) => (
                            <button
                              key={action.id}
                              onClick={() => handleConflictChoice(
                                action.id,
                                message.pendingEvent,
                                message.conflictingEvents?.[0]?.id,
                                message.conflictingEvents?.[0]?.title
                              )}
                              className="w-full px-3 py-2 bg-white bg-opacity-40 hover:bg-opacity-60 rounded text-xs text-left transition-all font-medium"
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 시간 추천 선택 버튼 (2단계: 시간 선택) */}
                    {message.recommendations && message.recommendations.length > 0 && (
                      <div className="mt-3 p-2 bg-white bg-opacity-20 rounded border">
                        <p className="text-xs font-semibold mb-2">시간을 선택하세요:</p>
                        <div className="space-y-1">
                          {message.recommendations.map((rec, index) => (
                            <button
                              key={index}
                              onClick={() => handleTimeSelection(
                                rec,
                                message.pendingEvent,
                                message.conflictingEvent?.id,
                                message._nextStep === 'select_alternative_time' ? 'alternative' : 'reschedule',
                                message.conflictingEventTitle,
                                message._nextStep
                              )}
                              className="w-full px-3 py-2 bg-white bg-opacity-40 hover:bg-opacity-60 rounded text-xs text-left transition-all"
                            >
                              ⏰ {rec.display}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 추천 시간대 선택 버튼 (기존 로직 유지) */}
                    {message.suggestedTimes && message.suggestedTimes.length > 0 && !message.recommendations && (
                      <div className="mt-3 p-2 bg-white bg-opacity-20 rounded border">
                        <p className="text-xs font-semibold mb-2">추천 시간:</p>
                        <div className="space-y-1">
                          {message.suggestedTimes.map((slot, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                const timeMessage = `${slot.date} ${slot.start}부터 ${slot.end}까지 일정 추가해줘`;
                                setInputText(timeMessage);
                              }}
                              className="w-full px-3 py-2 bg-white bg-opacity-40 hover:bg-opacity-60 rounded text-xs text-left transition-all"
                            >
                              📅 {slot.date} {slot.start} - {slot.end}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 추출된 스케줄 정보 표시 */}
                    {message.extractedSchedules && message.extractedSchedules.length > 0 && (
                      <div className="mt-3 p-2 bg-white bg-opacity-20 rounded border">
                        <p className="text-xs font-semibold mb-2">추출된 일정:</p>
                        {message.extractedSchedules.map((schedule, index) => (
                          <div key={index} className="text-xs mb-1 p-1 bg-white bg-opacity-30 rounded">
                            <div><strong>제목:</strong> {schedule.title}</div>
                            <div><strong>날짜:</strong> {schedule.date}</div>
                            <div><strong>시간:</strong> {schedule.time}</div>
                            {schedule.location && <div><strong>장소:</strong> {schedule.location}</div>}
                          </div>
                        ))}
                        <button
                          className="mt-2 px-2 py-1 bg-white bg-opacity-40 hover:bg-opacity-60 rounded text-xs"
                          onClick={() => handleAddSchedules(message.extractedSchedules)}
                        >
                          이 일정들을 추가하시겠습니까?
                        </button>
                      </div>
                    )}

                    <p className={`text-xs mt-1 ${
                      message.sender === 'user'
                        ? 'text-blue-100'
                        : message.success === false
                        ? 'text-red-600'
                        : message.success === true
                        ? 'text-green-600'
                        : 'text-gray-500'
                    }`}>
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* 입력 영역 */}
            <div className="p-3 border-t bg-white rounded-b-lg flex-shrink-0">
              {/* 이미지 미리보기 */}
              {imagePreview && (
                <div className="mb-3 relative">
                  <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded border">
                    <img
                      src={imagePreview}
                      alt="미리보기"
                      className="w-16 h-16 object-cover rounded border"
                    />
                    <div className="flex-1 text-sm text-gray-600">
                      사진이 선택되었습니다
                    </div>
                    <button
                      onClick={removeImage}
                      className="p-1 text-red-500 hover:text-red-700"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )}

              <div className={`flex ${isMobile ? 'space-x-2' : 'space-x-2'}`}>
                {/* 이미지 업로드 버튼 */}
                <button
                  onClick={() => imageInputRef.current?.click()}
                  className={`${isMobile ? 'p-2 w-12 h-12' : 'p-3'} bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex items-center justify-center flex-shrink-0`}
                  title="이미지 업로드"
                >
                  <Image size={isMobile ? 20 : 18} />
                </button>

                {/* 숨겨진 파일 입력 */}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={selectedImage ? "이미지에 대한 추가 설명 (선택사항)" : "일정을 말씀해주세요..."}
                  className={`flex-1 ${isMobile ? 'p-2 text-base' : 'p-3 text-sm'} border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputText.trim() && !selectedImage}
                  className={`${isMobile ? 'p-2 w-12 h-12' : 'p-3'} bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0`}
                >
                  <Send size={isMobile ? 20 : 18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatBox;