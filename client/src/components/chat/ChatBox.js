/**
 * ============================================================================
 * ChatBox.js - AI 일정 도우미 채팅 UI
 * ============================================================================
 * 
 * 모든 탭에서 사용되는 메인 채팅 컴포넌트
 * - 오른쪽 하단 고정 버튼으로 표시
 * - 헤더: "AI 일정 도우미"
 * 
 * [탭별 기능]
 * - profile: 내 프로필 일정 관리
 * - events: 나의 일정 관리
 * - googleCalendar: Google 캘린더 관리
 * - coordination: 배정 시간 변경 (실제 로직은 useChat.js에서 처리)
 * 
 * 🔴 일정맞추기 탭 시간 변경 기능:
 *    실제 로직은 client/src/hooks/useChat.js 참고!
 * ============================================================================
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle, Image } from 'lucide-react';
import TimetableUploadWithChat from './TimetableUploadWithChat';
import ScheduleOptimizationModal from '../modals/ScheduleOptimizationModal';
import { userService } from '../../services/userService';

const ChatBox = ({ onSendMessage, speak, currentTab, onEventUpdate }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [showTimetableUpload, setShowTimetableUpload] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [extractedScheduleData, setExtractedScheduleData] = useState(null);
  const messagesEndRef = useRef(null);
  const imageInputRef = useRef(null);

  useEffect(() => {
    const checkMobile = () => {
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

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  // 시간표를 캘린더에 추가하는 함수
  const addSchedulesToCalendar = async (schedules, applyScope = 'month') => {
    try {
      // 기존 스케줄 가져오기
      const userSchedule = await userService.getUserSchedule();
      const existingPersonalTimes = (userSchedule.personalTimes || [])
        .filter(pt => {
          // startTime과 endTime이 제대로 있는지 확인
          const hasValidTimes = pt.startTime && pt.endTime &&
                                typeof pt.startTime === 'string' &&
                                typeof pt.endTime === 'string' &&
                                pt.startTime.trim() !== '' &&
                                pt.endTime.trim() !== '';

          return hasValidTimes;
        })
        .map(pt => {
          // startTime이 ISO 형식인 경우 HH:MM 형식으로 변환
          let startTime = pt.startTime;
          let endTime = pt.endTime;

          if (pt.startTime.includes('T') || pt.startTime.includes(':00+')) {
            const startDate = new Date(pt.startTime);
            startTime = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
          }

          if (pt.endTime.includes('T') || pt.endTime.includes(':00+')) {
            const endDate = new Date(pt.endTime);
            endTime = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
          }

          return {
            id: pt.id || Date.now() + Math.floor(Math.random() * 1000000),
            title: pt.title || '일정',
            type: pt.type || 'event',
            startTime,
            endTime,
            days: pt.days || [],
            isRecurring: pt.isRecurring !== undefined ? pt.isRecurring : true,
            specificDate: pt.specificDate || undefined,
            color: pt.color || '#9333ea'
          };
        });
      // 가장 큰 id 값 찾기
      let maxId = Math.max(0, ...existingPersonalTimes.map(pt => pt.id || 0));

      const newPersonalTimes = [];

      schedules.forEach((schedule, idx) => {

        if (!schedule.days || (Array.isArray(schedule.days) && schedule.days.length === 0)) {
          return; // 요일 정보가 없으면 스킵
        }

        if (!schedule.startTime || !schedule.endTime) {
          return;
        }

        const dayMap = {
          'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4,
          'FRI': 5, 'SAT': 6, 'SUN': 7,
          // 한글 요일 매핑 (고정 일정용)
          '월': 1, '화': 2, '수': 3, '목': 4,
          '금': 5, '토': 6, '일': 7
        };

        // days가 문자열일 수 있으므로 배열로 변환
        const daysArray = Array.isArray(schedule.days) ? schedule.days : [schedule.days];

        const mappedDays = daysArray.map(day => {
          // day가 배열일 수도 있으므로 확인
          if (Array.isArray(day)) {
            return day.map(d => dayMap[d] || d).filter(d => d);
          }
          return dayMap[day] || day;
        }).flat().filter(d => d && typeof d === 'number');

        if (mappedDays.length === 0) {
          return;
        }

        // 이번 주만 옵션일 경우 각 요일별로 이번 주 날짜 계산
        if (applyScope === 'week') {
          const today = new Date();
          const currentDay = today.getDay(); // 0=일, 1=월, ..., 6=토

          // 이번 주 월요일 날짜 계산
          const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay; // 일요일이면 -6, 아니면 월요일까지 차이
          const thisWeekMonday = new Date(today);
          thisWeekMonday.setDate(today.getDate() + mondayOffset);

          mappedDays.forEach(targetDay => {
            // targetDay는 1=월, 2=화, ..., 7=일
            // 이번 주 월요일로부터 며칠 후인지 계산
            const daysFromMonday = targetDay === 7 ? 6 : targetDay - 1; // 월=0, 화=1, ..., 일=6

            const targetDate = new Date(thisWeekMonday);
            targetDate.setDate(thisWeekMonday.getDate() + daysFromMonday);

            // 시간 형식 검증
            if (!schedule.startTime || !schedule.endTime ||
                !schedule.startTime.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/) ||
                !schedule.endTime.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
              return;
            }

            // targetDate 유효성 검사
            if (isNaN(targetDate.getTime())) {
              return;
            }

            maxId++;
            const converted = {
              id: maxId,
              title: schedule.title || '수업',
              type: 'study',
              startTime: schedule.startTime,
              endTime: schedule.endTime,
              days: [targetDay],
              isRecurring: false,
              specificDate: targetDate.toISOString().split('T')[0], // YYYY-MM-DD
              color: '#9333ea'
            };

            newPersonalTimes.push(converted);
          });
        } else {
          // 전체 달 옵션 (반복)

          // 시간 형식 검증
          if (!schedule.startTime || !schedule.endTime ||
              !schedule.startTime.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/) ||
              !schedule.endTime.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
            return;
          }

          maxId++;
          const converted = {
            id: maxId,
            title: schedule.title || '수업',
            type: 'study',
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            days: mappedDays,
            isRecurring: true,
            color: '#9333ea'
          };
          newPersonalTimes.push(converted);
        }
      });
      // 기존 일정과 합치기 (유효한 것만)
      const validExistingTimes = existingPersonalTimes.filter(pt =>
        pt.startTime && pt.endTime &&
        pt.startTime !== 'null' && pt.endTime !== 'null'
      );
      const updatedPersonalTimes = [...validExistingTimes, ...newPersonalTimes];

      // 최종 검증 - 모든 항목이 startTime과 endTime을 가지고 있는지 확인
      const validatedPersonalTimes = updatedPersonalTimes.filter(pt => {
        const isValid = pt.startTime && pt.endTime &&
                       pt.startTime.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/) &&
                       pt.endTime.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/);

        if (!isValid) {
        }

        return isValid;
      });

      // 서버에 저장
      const result = await userService.updateUserSchedule({
        ...userSchedule,
        personalTimes: validatedPersonalTimes
      });
      if (onEventUpdate) {
        onEventUpdate();
      }

      // ProfileTab의 calendarUpdate 이벤트 발생
      window.dispatchEvent(new CustomEvent('calendarUpdate', {
        detail: { type: 'schedule_added', context: 'profile' }
      }));

      return { success: true, count: newPersonalTimes.length };
    } catch (error) {
      return { success: false, error: error.message || '알 수 없는 오류가 발생했습니다' };
    }
  };

  // 시간표 추출 완료 핸들러
  const handleSchedulesExtracted = async (result) => {
    // 나이 필터링으로 0개가 된 경우
    if (result.type === 'age_filtered') {
      const botMessage = {
        id: Date.now(),
        text: `총 ${result.allSchedulesCount}개의 시간표를 찾았지만, 나이(${result.data.age}세)에 맞지 않아 필터링되었습니다.\n\n예상 학년부: ${result.data.gradeLevel === 'elementary' ? '초등부' : result.data.gradeLevel === 'middle' ? '중등부' : '고등부'}\n\n그래도 추가하시겠습니까?`,
        sender: 'bot',
        timestamp: new Date(),
        _nextStep: 'force_add_filtered_schedules',
        _scheduleData: result.data,
        _showButtons: true,
        _buttons: [
          { text: '예, 강제로 추가', value: '강제추가' },
          { text: '아니오', value: '취소' }
        ],
        _isScheduleMessage: true
      };
      setMessages(prev => [...prev, botMessage]);
      setExtractedScheduleData(result.data);
      setShowTimetableUpload(false);
      return;
    }

    // 충돌 여부와 관계없이 항상 모달을 보여줌
    const botMessage = {
      id: Date.now(),
      text: `총 ${result.data.schedules.length}개의 시간표를 찾았습니다.${result.data.conflicts.length > 0 ? ` (${result.data.conflicts.length}개의 충돌 발견)` : ''}\n시간표 예시를 보시겠습니까?`,
      sender: 'bot',
      timestamp: new Date(),
      _nextStep: 'show_schedule_examples',
      _scheduleData: result.data,
      _showButtons: true,
      _buttons: [
        { text: '예', value: '예' },
        { text: '아니오', value: '아니오' }
      ],
      _isScheduleMessage: true
    };
    setMessages(prev => [...prev, botMessage]);
    setExtractedScheduleData(result.data);
    setShowTimetableUpload(false);

    if (result.type === 'schedules_extracted') {
      // 더 이상 사용하지 않음 - 항상 모달 보여줌

    } else if (result.type === 'schedule_selected') {
      // 사용자가 최적 조합 중 하나를 선택함
      const schedules = result.schedules;
      const applyScope = result.applyScope || 'month';

      // 실제로 일정 추가
      const result_add = await addSchedulesToCalendar(schedules, applyScope);

      const botMessage = {
        id: Date.now(),
        text: result_add.success
          ? `선택하신 시간표 ${result_add.count}개를 일정에 추가했습니다! ✅ 프로필 탭에서 확인하세요!`
          : `시간표 추가 중 오류가 발생했습니다: ${result_add.error}`,
        sender: 'bot',
        timestamp: new Date(),
        success: result_add.success
      };
      setMessages(prev => [...prev, botMessage]);
    }
  };

  // Corrected handleConflictChoice
  const handleConflictChoice = async (choice, pendingEvent, conflictingEvent) => {
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
    const token = localStorage.getItem('token');

    try {
      const loadingMessage = { id: Date.now(), text: '처리 중...', sender: 'bot', timestamp: new Date(), isLoading: true };
      setMessages(prev => [...prev, loadingMessage]);

      if (choice === 1) {
        // Logic for "recommend_alternative"
        setMessages(prev => prev.filter(msg => !msg.isLoading));
        const requestedStart = new Date(pendingEvent.startTime);
        const requestedEnd = new Date(pendingEvent.endTime);
        const duration = (requestedEnd - requestedStart) / (60 * 1000); // 분 단위 계산
        const searchOffsets = [-180, -120, -60, 60, 120, 180];
        const recommendations = [];
        const existingEvents = pendingEvent.allExistingEvents || [];

        for (const offset of searchOffsets) {
          const candidateStart = new Date(requestedStart.getTime() + offset * 60 * 1000);
          const candidateEnd = new Date(candidateStart.getTime() + duration * 60 * 1000);

          if (candidateStart.getHours() < 9 || candidateStart.getHours() >= 22) continue;
          if (candidateStart.getDate() !== requestedStart.getDate()) continue;

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

      } else if (choice === 2) { // Logic for "reschedule_existing"
        if (currentTab === 'profile' || currentTab === 'events') {
          // 프로필 탭과 나의 일정 탭은 동일한 로직 사용
          setMessages(prev => prev.filter(msg => !msg.isLoading));

          // Step 1: 기존 일정 삭제
          const deleteLoadingMessage = { id: Date.now(), text: '기존 일정을 삭제하고 있습니다...', sender: 'bot', timestamp: new Date(), isLoading: true };
          setMessages(prev => [...prev, deleteLoadingMessage]);

          const deleteResult = await onSendMessage({
            intent: 'delete_specific_event',
            eventId: conflictingEvent.id || conflictingEvent._id
          });

          setMessages(prev => prev.filter(msg => !msg.isLoading));
          const deleteResultMessage = { id: Date.now() + 1, text: deleteResult.message || '기존 일정을 삭제했습니다.', sender: 'bot', timestamp: new Date(), success: deleteResult.success !== false };
          setMessages(prev => [...prev, deleteResultMessage]);

          if(deleteResult.success === false) {
            return;
          }

          // Step 2: 새 일정을 원래 자리에 추가
          await new Promise(resolve => setTimeout(resolve, 800));
          const newEventLoadingMessage = { id: Date.now() + 2, text: '새 일정을 추가하고 있습니다...', sender: 'bot', timestamp: new Date(), isLoading: true };
          setMessages(prev => [...prev, newEventLoadingMessage]);

          const newPendingStart = new Date(pendingEvent.startTime);
          const newDateStr = `${newPendingStart.getMonth() + 1}월 ${newPendingStart.getDate()}일`;
          const newTimeStr = newPendingStart.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true });
          const newEventMessage = `${newDateStr} ${newTimeStr}에 "${pendingEvent.title}" 일정을 추가해줘`;
          const newEventResult = await onSendMessage(newEventMessage);

          setMessages(prev => prev.filter(msg => !msg.isLoading));
          const newEventResultMessage = { id: Date.now() + 3, text: newEventResult.message || '새 일정을 추가했습니다.', sender: 'bot', timestamp: new Date(), success: newEventResult.success !== false };
          setMessages(prev => [...prev, newEventResultMessage]);

          // Step 3: 기존 일정 옮길 시간 추천
          await new Promise(resolve => setTimeout(resolve, 500));

          // 최신 일정 목록 가져오기
          const token = localStorage.getItem('token');
          const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

          let updatedEvents = [];
          try {
            const scheduleResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
              headers: { 'x-auth-token': token }
            });

            if (scheduleResponse.ok) {
              const scheduleData = await scheduleResponse.json();
              const targetDate = new Date(conflictingEvent.startTime).toISOString().split('T')[0];

              // scheduleExceptions와 personalTimes를 합침
              const exceptions = (scheduleData.scheduleExceptions || [])
                .filter(exc => exc.specificDate === targetDate);
              const personalTimes = (scheduleData.personalTimes || [])
                .filter(pt => pt.specificDate === targetDate)
                .map(pt => ({
                  ...pt,
                  startTime: `${targetDate}T${pt.startTime}:00+09:00`,
                  endTime: `${targetDate}T${pt.endTime}:00+09:00`
                }));

              updatedEvents = [...exceptions, ...personalTimes];
            }
          } catch (error) {
            updatedEvents = pendingEvent.allExistingEvents || [];
          }

          const originalStart = new Date(conflictingEvent.startTime);
          const duration = (new Date(conflictingEvent.endTime) - originalStart) / (60 * 1000);

          const searchOffsets = [-180, -120, -60, 60, 120, 180];
          const recommendations = [];
          const existingEvents = updatedEvents;

          for (const offset of searchOffsets) {
            const candidateStart = new Date(originalStart.getTime() + offset * 60 * 1000);
            const candidateEnd = new Date(candidateStart.getTime() + duration * 60 * 1000);

            if (candidateStart.getHours() < 9 || candidateStart.getHours() >= 22) continue;
            if (candidateStart.getDate() !== originalStart.getDate()) continue;

            const hasConflict = existingEvents.some(event => {
              if (event.id === conflictingEvent.id) return false;
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

          const originalTimeStr = `${originalStart.getHours()}시${originalStart.getMinutes() > 0 ? ` ${originalStart.getMinutes()}분` : ''}`;
          const message = recommendations.length > 0
            ? `"${conflictingEvent.title}" (${originalTimeStr})을 언제로 옮기시겠어요?\n\n${recommendations.map((r, i) => `${i + 1}. ${r.display}`).join('\n')}`
            : '죄송합니다. 해당 날짜에 옮길 만한 시간이 없습니다.';

          const botMessage = {
            id: Date.now() + 4,
            text: message,
            sender: 'bot',
            timestamp: new Date(),
            success: recommendations.length > 0,
            recommendations: recommendations,
            conflictingEvent: conflictingEvent,
            pendingEvent: pendingEvent,
            _nextStep: currentTab === 'profile' ? 'select_reschedule_time_profile' : 'select_reschedule_time_events'
          };
          setMessages(prev => [...prev, botMessage]);
          return;
        }

        // 다른 탭 (내 일정, 구글 캘린더)은 백엔드 API 사용
        try {
          setMessages(prev => prev.filter(msg => !msg.isLoading));

          // Step 1: 기존 일정 삭제
          const deleteLoadingMessage = { id: Date.now(), text: '기존 일정을 삭제하고 있습니다...', sender: 'bot', timestamp: new Date(), isLoading: true };
          setMessages(prev => [...prev, deleteLoadingMessage]);

          const deleteResponse = await fetch(`${API_BASE_URL}/api/conflict/delete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-auth-token': token
            },
            body: JSON.stringify({ conflictingEventId: conflictingEvent.id })
          });

          const deleteData = await deleteResponse.json();
          setMessages(prev => prev.filter(msg => !msg.isLoading));
          const deleteResultMessage = { id: Date.now() + 1, text: deleteData.message || '기존 일정을 삭제했습니다.', sender: 'bot', timestamp: new Date(), success: deleteResponse.ok };
          setMessages(prev => [...prev, deleteResultMessage]);

          if (!deleteResponse.ok) {
            return;
          }

          // Step 2: 새 일정을 원래 자리에 추가
          await new Promise(resolve => setTimeout(resolve, 800));
          const newEventLoadingMessage = { id: Date.now() + 2, text: '새 일정을 추가하고 있습니다...', sender: 'bot', timestamp: new Date(), isLoading: true };
          setMessages(prev => [...prev, newEventLoadingMessage]);

          const addResponse = await fetch(`${API_BASE_URL}/api/conflict/confirm-alternative`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-auth-token': token
            },
            body: JSON.stringify({ pendingEvent })
          });

          const addData = await addResponse.json();
          setMessages(prev => prev.filter(msg => !msg.isLoading));
          const addResultMessage = { id: Date.now() + 3, text: addData.message || '새 일정을 추가했습니다.', sender: 'bot', timestamp: new Date(), success: addResponse.ok };
          setMessages(prev => [...prev, addResultMessage]);

          // Step 3: 기존 일정 옮길 시간 추천
          await new Promise(resolve => setTimeout(resolve, 500));

          const recommendResponse = await fetch(`${API_BASE_URL}/api/conflict/recommend-reschedule`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-auth-token': token
            },
            body: JSON.stringify({ conflictingEventId: conflictingEvent.id })
          });

          const recommendData = await recommendResponse.json();
          const botMessage = {
            id: Date.now() + 4,
            text: recommendData.message,
            sender: 'bot',
            timestamp: new Date(),
            success: recommendResponse.ok,
            recommendations: recommendData.recommendations || [],
            conflictingEvent: conflictingEvent,
            pendingEvent: pendingEvent,
            _nextStep: 'select_reschedule_time'
          };
          setMessages(prev => [...prev, botMessage]);
        } catch (err) {
          setMessages(prev => prev.filter(msg => !msg.isLoading));
          const errorMessage = { id: Date.now() + 1, text: '처리 중 오류가 발생했습니다.', sender: 'bot', timestamp: new Date(), success: false };
          setMessages(prev => [...prev, errorMessage]);
        }
      }
    } catch (error) {
      setMessages(prev => prev.filter(msg => !msg.isLoading));
      const errorMessage = { id: Date.now() + 1, text: '처리 중 오류가 발생했습니다.', sender: 'bot', timestamp: new Date(), success: false };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  // Corrected handleTimeSelection
  const handleTimeSelection = async (selectedTime, pendingEvent, conflictingEvent, action, nextStep) => {

    try {
      const loadingMessage = { id: Date.now(), text: '일정을 확정하고 있습니다...', sender: 'bot', timestamp: new Date(), isLoading: true };
      setMessages(prev => [...prev, loadingMessage]);

      if (currentTab === 'profile' || currentTab === 'events') {
        if (action === 'reschedule' || nextStep === 'select_reschedule_time_profile' || nextStep === 'select_reschedule_time_events') {
          // 기존 일정을 선택한 시간에 추가
          const conflictingEventTitle = conflictingEvent?.title || '기존 일정';

          setMessages(prev => prev.filter(msg => !msg.isLoading));
          const rescheduleLoadingMessage = { id: Date.now(), text: '기존 일정을 옮기고 있습니다...', sender: 'bot', timestamp: new Date(), isLoading: true };
          setMessages(prev => [...prev, rescheduleLoadingMessage]);

          const selectedDate = new Date(selectedTime.startTime);
          const dateStr = `${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일`;
          const timeStr = selectedDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true });
          const rescheduleMessage = `${dateStr} ${timeStr}에 "${conflictingEventTitle}" 일정을 추가해줘`;
          const rescheduleResult = await onSendMessage(rescheduleMessage);

          setMessages(prev => prev.filter(msg => !msg.isLoading));
          const rescheduleResultMessage = { id: Date.now() + 1, text: rescheduleResult.message || '기존 일정을 옮겼습니다.', sender: 'bot', timestamp: new Date(), success: rescheduleResult.success !== false };
          setMessages(prev => [...prev, rescheduleResultMessage]);

          if (onEventUpdate) { onEventUpdate(); }
          window.dispatchEvent(new CustomEvent('calendarUpdate', {
            detail: { type: 'add', context: currentTab }
          }));
          return;
        }

        // Logic for action === 'alternative'
        const selectedDate = new Date(selectedTime.startTime);
        const dateStr = `${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일`;
        const timeStr = selectedDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true });
        const message = `${dateStr} ${timeStr}에 "${pendingEvent.title}" 일정을 추가해줘`;
        const result = await onSendMessage(message);
        setMessages(prev => prev.filter(msg => !msg.isLoading));
        const botMessage = { id: Date.now() + 1, text: result.message || '일정이 추가되었습니다.', sender: 'bot', timestamp: new Date(), success: result.success !== false };
        setMessages(prev => [...prev, botMessage]);
        if (result.success !== false) {
          if (onEventUpdate) { onEventUpdate(); }
          window.dispatchEvent(new Event('calendarUpdate'));
        }
        return;
      }
      // ... other tabs logic
    } catch (error) {
      setMessages(prev => prev.filter(msg => !msg.isLoading));
      const errorMessage = { id: Date.now() + 1, text: '일정 확정 중 오류가 발생했습니다.', sender: 'bot', timestamp: new Date(), success: false };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  // ... (rest of the file is unchanged) ...
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

    // 마지막 봇 메시지 확인 (시간표 예시 보기 처리)
    const lastBotMessage = messages.filter(m => m.sender === 'bot').pop();

    // "다시 짜줘" 명령 처리 (서버로 보내지 않고 여기서 처리)
    const userInputLower = inputText.trim().toLowerCase();
    if ((userInputLower.includes('다시') && (userInputLower.includes('짜') || userInputLower.includes('생성') || userInputLower.includes('조합'))) ||
        userInputLower.includes('재생성') ||
        userInputLower.includes('다른 조합') ||
        userInputLower.includes('다른거')) {

      // 사용자 메시지 먼저 추가
      const userMessage = {
        id: Date.now(),
        text: inputText,
        sender: 'user',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);
      setInputText('');

      if (extractedScheduleData) {
        // 기존 스케줄 데이터로 다른 조합 생성
        const allSchedules = extractedScheduleData.allSchedulesBeforeFilter || extractedScheduleData.schedules || [];

        // 충돌 감지 함수
        const hasConflict = (schedule1, schedule2) => {
          // 같은 요일이 있는지 확인
          const commonDays = schedule1.days?.filter(day => schedule2.days?.includes(day));
          if (!commonDays || commonDays.length === 0) return false;

          // 시간 중복 확인
          const parseTime = (timeStr) => {
            if (!timeStr) return null;
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
          };

          const start1 = parseTime(schedule1.startTime);
          const end1 = parseTime(schedule1.endTime);
          const start2 = parseTime(schedule2.startTime);
          const end2 = parseTime(schedule2.endTime);

          if (!start1 || !end1 || !start2 || !end2) return false;

          // 시간 겹침 체크
          return start1 < end2 && end1 > start2;
        };

        // 충돌 없는 조합 생성
        const generateNonConflictingCombination = (schedules) => {
          const shuffled = [...schedules].sort(() => Math.random() - 0.5);
          const result = [];

          for (const schedule of shuffled) {
            let conflict = false;
            for (const selected of result) {
              if (hasConflict(schedule, selected)) {
                conflict = true;
                break;
              }
            }
            if (!conflict) {
              result.push(schedule);
            }
          }

          return result;
        };

        // 여러 조합 생성 (최대 5개)
        const combinations = [];
        const maxAttempts = 20;
        const maxCombinations = 5;

        for (let i = 0; i < maxAttempts && combinations.length < maxCombinations; i++) {
          const combo = generateNonConflictingCombination(allSchedules);

          // 이미 같은 조합이 있는지 확인
          const isDuplicate = combinations.some(existing => {
            if (existing.length !== combo.length) return false;
            const existingIds = existing.map(s => `${s.title}_${s.startTime}_${s.days?.join('')}`).sort().join('|');
            const comboIds = combo.map(s => `${s.title}_${s.startTime}_${s.days?.join('')}`).sort().join('|');
            return existingIds === comboIds;
          });

          if (!isDuplicate && combo.length > 0) {
            combinations.push(combo);
          }
        }

        // 최소 1개 이상의 조합 보장
        if (combinations.length === 0) {
          combinations.push(allSchedules);
        }

        // 조합들을 스케줄 개수가 많은 순으로 정렬
        combinations.sort((a, b) => b.length - a.length);

        // extractedScheduleData 업데이트
        const updatedData = {
          ...extractedScheduleData,
          optimalCombinations: combinations,
          schedules: combinations[0]
        };

        setExtractedScheduleData(updatedData);
        setShowScheduleModal(true);

        const botMessage = {
          id: Date.now() + 1,
          text: `새로운 조합 ${combinations.length}개를 생성했습니다! 충돌 없는 최적 시간표를 확인해보세요 📅✨`,
          sender: 'bot',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botMessage]);
        return;
      } else {
        const botMessage = {
          id: Date.now() + 1,
          text: '먼저 시간표 이미지를 업로드해주세요! 그래야 다시 생성할 수 있어요 📸',
          sender: 'bot',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botMessage]);
        return;
      }
    }

    if (lastBotMessage?._nextStep === 'show_schedule_examples') {
      const userResponse = inputText.trim().toLowerCase();

      const userMessage = {
        id: Date.now(),
        text: inputText,
        sender: 'user',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);
      setInputText('');

      if (userResponse.includes('예') || userResponse.includes('네') ||
          userResponse.includes('yes') || userResponse.includes('보여') || userResponse.includes('응')) {
        // 모달 표시
        setShowScheduleModal(true);
        const botMessage = {
          id: Date.now() + 1,
          text: '최적 시간표 예시를 보여드립니다. 원하시는 조합을 선택해주세요! 📅',
          sender: 'bot',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botMessage]);
        return;
      } else {
        // 사용자가 거절한 경우
        const botMessage = {
          id: Date.now() + 1,
          text: '알겠습니다. 원본 시간표를 그대로 적용하시겠습니까? (예/아니오)',
          sender: 'bot',
          timestamp: new Date(),
          _nextStep: 'confirm_add_schedules',
          _schedules: lastBotMessage._scheduleData?.schedules
        };
        setMessages(prev => [...prev, botMessage]);
        return;
      }
    }

    // 시간표 추가 확인 처리
    if (lastBotMessage?._nextStep === 'confirm_add_schedules') {
      const userResponse = inputText.trim().toLowerCase();

      const userMessage = {
        id: Date.now(),
        text: inputText,
        sender: 'user',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);
      setInputText('');

      if (userResponse.includes('예') || userResponse.includes('네') ||
          userResponse.includes('yes') || userResponse.includes('응')) {

        // 실제로 일정 추가
        const result = await addSchedulesToCalendar(lastBotMessage._schedules);

        const botMessage = {
          id: Date.now() + 1,
          text: result.success
            ? `시간표 ${result.count}개를 일정에 추가했습니다! ✅ 프로필 탭에서 확인하세요!`
            : `시간표 추가 중 오류가 발생했습니다: ${result.error}`,
          sender: 'bot',
          timestamp: new Date(),
          success: result.success
        };
        setMessages(prev => [...prev, botMessage]);
        return;
      } else {
        const botMessage = {
          id: Date.now() + 1,
          text: '알겠습니다. 시간표 추가를 취소했습니다.',
          sender: 'bot',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botMessage]);
        return;
      }
    }

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
                        : message._isScheduleMessage
                        ? 'bg-blue-100 text-blue-900 rounded-bl-none'
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
                                message.conflictingEvents?.[0]
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
                                message.conflictingEvent, // Pass full object
                                message._nextStep === 'select_alternative_time' ? 'alternative' : 'reschedule',
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

                    {/* 예/아니오 버튼 */}
                    {message._showButtons && message._buttons && (
                      <div className="mt-3 p-2 bg-white bg-opacity-20 rounded border">
                        <div className="space-y-2">
                          {message._buttons.map((button, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                // "예" 버튼이면 바로 모달 열기
                                if (button.value === '예' && message._nextStep === 'show_schedule_examples') {
                                  setShowScheduleModal(true);
                                } else if (button.value === '강제추가' && message._nextStep === 'force_add_filtered_schedules') {
                                  // 필터링 전 전체 스케줄로 모달 열기
                                  const updatedData = {
                                    ...message._scheduleData,
                                    schedules: message._scheduleData.allSchedulesBeforeFilter,
                                    conflicts: [], // 필터링 없이 전체 추가하므로 충돌 재계산 생략
                                    optimalCombinations: [message._scheduleData.allSchedulesBeforeFilter]
                                  };
                                  setExtractedScheduleData(updatedData);
                                  setShowScheduleModal(true);
                                } else if (button.value === '예' && message._nextStep === 'confirm_add_schedules') {
                                  // 시간표 추가
                                  addSchedulesToCalendar(message._schedules).then(result => {
                                    const botMessage = {
                                      id: Date.now() + 1,
                                      text: result.success
                                        ? `시간표 ${result.count}개를 일정에 추가했습니다! ✅ 프로필 탭에서 확인하세요!`
                                        : `시간표 추가 중 오류가 발생했습니다: ${result.error}`,
                                      sender: 'bot',
                                      timestamp: new Date(),
                                      success: result.success
                                    };
                                    setMessages(prev => [...prev, botMessage]);
                                  });
                                } else {
                                  // "아니오"는 기본 처리
                                  setInputText(button.value);
                                  setTimeout(() => handleSend(), 100);
                                }
                              }}
                              className="w-full px-3 py-2 bg-white bg-opacity-40 hover:bg-opacity-60 rounded text-xs text-left transition-all font-medium"
                            >
                              {button.text}
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
              <div className={`flex ${isMobile ? 'space-x-2' : 'space-x-2'}`}>
                {/* 시간표 업로드 버튼 (기존 이미지 버튼 대체) */}
                <button
                  onClick={() => setShowTimetableUpload(true)}
                  className={`${isMobile ? 'p-2 w-12 h-12' : 'p-3'} bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex items-center justify-center flex-shrink-0`}
                  title="시간표 업로드"
                >
                  <Image size={isMobile ? 20 : 18} />
                </button>

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

      {/* 시간표 업로드 모달 (채팅 기능 포함) */}
      {showTimetableUpload && (
        <TimetableUploadWithChat
          onSchedulesExtracted={handleSchedulesExtracted}
          onClose={() => setShowTimetableUpload(false)}
        />
      )}

      {/* 최적 시간표 모달 */}
      {showScheduleModal && extractedScheduleData && (
        <ScheduleOptimizationModal
          combinations={extractedScheduleData.optimalCombinations}
          onSelect={(schedules, applyScope) => {
            handleSchedulesExtracted({
              type: 'schedule_selected',
              schedules: schedules,
              applyScope: applyScope,
              data: extractedScheduleData
            });
            setShowScheduleModal(false);
          }}
          onClose={() => setShowScheduleModal(false)}
          userAge={extractedScheduleData.age}
          gradeLevel={extractedScheduleData.gradeLevel}
        />
      )}
    </>
  );
};

export default ChatBox;
