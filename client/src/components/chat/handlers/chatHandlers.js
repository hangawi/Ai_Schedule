/**
 * ============================================================================
 * chatHandlers.js - 채팅 관련 이벤트 핸들러 팩토리 함수들
 * ============================================================================
 */

import { auth } from '../../../config/firebaseConfig';
import { API_BASE_URL } from '../constants/apiConfig';

/**
 * 채팅 메시지 전송 핸들러 생성
 */
export const createHandleSendChat = ({
  chatMessage,
  extractedSchedules,
  setChatHistory,
  setChatMessage,
  setIsFilteringChat,
  showOptimizationModal,
  setShowOptimizationModal,
  schedulesByImage,
  fixedSchedules,
  originalSchedule,
  scheduleHistory,
  redoStack,
  setScheduleHistory,
  setRedoStack,
  setExtractedSchedules,
  setFilteredSchedules,
  setFixedSchedules,
  setCustomSchedulesForLegend,
  setSlideDirection,
  chatHistory
}) => {
  return async () => {
    if (!chatMessage.trim() || !extractedSchedules) {
      return;
    }

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      text: chatMessage,
      timestamp: new Date()
    };

    setChatHistory(prev => [...prev, userMessage]);
    const currentMessage = chatMessage;
    setChatMessage('');
    setIsFilteringChat(true);

    // 새로운 필터링 시작 - 모달 닫기
    if (showOptimizationModal) {
      setShowOptimizationModal(false);
    }

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setChatHistory(prev => [...prev, { id: Date.now(), sender: 'bot', text: '로그인이 필요합니다.', timestamp: new Date() }]);
        setIsFilteringChat(false);
        return;
      }
      const idToken = await currentUser.getIdToken();

      // 고정 일정 관련 요청인지 먼저 확인
      const fixedScheduleResponse = await fetch(`${API_BASE_URL}/api/schedule/fixed-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          message: currentMessage,
          currentSchedules: extractedSchedules,
          schedulesByImage: schedulesByImage,
          fixedSchedules: fixedSchedules
        })
      });

      const fixedData = await fixedScheduleResponse.json();

      // 고정 일정 관련 요청이면 처리하고 리턴
      if ((fixedData.intent && fixedData.intent !== 'none') || fixedData.optimizedSchedule || fixedData.action) {
        // 여러 개 발견 시 사용자 선택 요청
        if (fixedData.action === 'move_multiple_found' && fixedData.options) {
          const botMessage = {
            id: Date.now() + 1,
            sender: 'bot',
            text: fixedData.explanation || fixedData.message || '여러 일정이 발견되었습니다.',
            timestamp: new Date()
          };
          setChatHistory(prev => [...prev, botMessage]);
          setIsFilteringChat(false);
          return;
        }

        // 실패한 경우 메시지만 표시하고 종료
        if (!fixedData.success || (!fixedData.action && !fixedData.optimizedSchedule)) {
          const botMessage = {
            id: Date.now() + 1,
            sender: 'bot',
            text: fixedData.message || fixedData.explanation || '고정 일정 처리에 실패했습니다.',
            timestamp: new Date()
          };
          setChatHistory(prev => [...prev, botMessage]);
          setIsFilteringChat(false);
          return;
        }

        // 성공한 경우 기존 로직 실행
        let newFixedSchedules = fixedSchedules;

        if (fixedData.action === 'add') {
          // 중복 체크
          const newSchedules = fixedData.schedules.filter(newSched => {
            return !fixedSchedules.some(existing =>
              existing.title === newSched.title &&
              JSON.stringify(existing.days) === JSON.stringify(newSched.days) &&
              existing.startTime === newSched.startTime &&
              existing.endTime === newSched.endTime
            );
          });

          if (newSchedules.length === 0) {
            setIsFilteringChat(false);
            return;
          }

          newFixedSchedules = [...fixedSchedules, ...newSchedules];
          setFixedSchedules(newFixedSchedules);
        } else if (fixedData.action === 'remove') {
          newFixedSchedules = fixedSchedules.filter(s => !fixedData.scheduleIds.includes(s.id));
          setFixedSchedules(newFixedSchedules);
        }

        // 커스텀 일정 범례 업데이트
        if (fixedData.customSchedules && fixedData.customSchedules.length > 0) {
          setCustomSchedulesForLegend(prev => {
            const existingIndices = new Set(prev.map(c => c.sourceImageIndex));
            const newCustoms = fixedData.customSchedules.filter(c => !existingIndices.has(c.sourceImageIndex));
            return [...prev, ...newCustoms];
          });
        }

        // 삭제된 일정의 범례 제거
        if (fixedData.titlesToRemoveFromLegend && fixedData.titlesToRemoveFromLegend.length > 0) {
          setCustomSchedulesForLegend(prev =>
            prev.filter(c => !fixedData.titlesToRemoveFromLegend.includes(c.title))
          );
        }

        // 봇 응답 추가
        const botMessage = {
          id: Date.now() + 1,
          sender: 'bot',
          text: fixedData.message,
          timestamp: new Date()
        };
        setChatHistory(prev => [...prev, botMessage]);

        // 일정 이동 처리
        if (fixedData.optimizedSchedule) {
          setFilteredSchedules(fixedData.optimizedSchedule);

          if (fixedData.fixedSchedules) {
            setFixedSchedules(fixedData.fixedSchedules);
          }

          setSlideDirection('left');
          setTimeout(() => {
            setShowOptimizationModal(true);
          }, 50);

          setIsFilteringChat(false);
          return;
        }

        // 고정 일정 추가/삭제 시 즉시 재최적화 실행
        if (fixedData.action === 'add' || fixedData.action === 'remove') {
          const currentOptimizedSchedules = extractedSchedules;

          const reoptimizeResponse = await fetch(`${API_BASE_URL}/api/schedule/optimize`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              schedules: currentOptimizedSchedules,
              schedulesByImage: schedulesByImage,
              fixedSchedules: newFixedSchedules
            })
          });

          const reoptimizeData = await reoptimizeResponse.json();

          if (reoptimizeData.success && Array.isArray(reoptimizeData.optimizedSchedules)) {
            setFilteredSchedules(reoptimizeData.optimizedSchedules);

            // 커스텀 일정 범례 업데이트
            if (reoptimizeData.customSchedules && reoptimizeData.customSchedules.length > 0) {
              setCustomSchedulesForLegend(prev => {
                const existingIndices = new Set(prev.map(c => c.sourceImageIndex));
                const newCustoms = reoptimizeData.customSchedules.filter(c => !existingIndices.has(c.sourceImageIndex));
                if (newCustoms.length > 0) {
                  return [...prev, ...newCustoms];
                }
                return prev;
              });
            }

            // 모달 띄우기
            setSlideDirection('left');
            setTimeout(() => {
              setShowOptimizationModal(true);
            }, 50);

            // 추가 메시지
            const optimizeMessage = {
              id: Date.now() + 2,
              sender: 'bot',
              text: '✨ 고정 일정을 반영해서 시간표를 다시 최적화했어요!',
              timestamp: new Date()
            };
            setChatHistory(prev => [...prev, optimizeMessage]);
          }
        }

        setIsFilteringChat(false);
        return;
      }

      // 직전 봇 응답 찾기
      const lastBotMessage = chatHistory
        .slice()
        .reverse()
        .find(msg => msg.sender === 'bot' && !msg.text.includes('💭'));
      const lastAiResponse = lastBotMessage ? lastBotMessage.text : null;

      // 통합 API 호출
      const response = await fetch(`${API_BASE_URL}/api/schedule/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          message: currentMessage,
          currentSchedule: extractedSchedules,
          originalSchedule: originalSchedule || extractedSchedules,
          scheduleHistory: scheduleHistory,
          lastAiResponse: lastAiResponse,
          redoStack: redoStack,
          fixedSchedules: fixedSchedules,
          schedulesByImage: schedulesByImage
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '처리 실패');
      }

      // 시간표 업데이트
      if (data.action === 'delete' || data.action === 'add') {
        setScheduleHistory(prev => [...prev, extractedSchedules]);
        setRedoStack([]);
        setExtractedSchedules(data.schedule);
        setFilteredSchedules(data.schedule);
      } else if (data.action === 'redo') {
        setExtractedSchedules(data.schedule);
        setFilteredSchedules(data.schedule);
        setRedoStack(prev => prev.slice(0, -1));
        setScheduleHistory(prev => [...prev, extractedSchedules]);
      } else if (data.action === 'step_back') {
        setExtractedSchedules(data.schedule);
        setFilteredSchedules(data.schedule);
        setRedoStack(prev => [...prev, extractedSchedules]);
        setScheduleHistory(prev => prev.slice(0, -1));
      } else if (data.action === 'undo') {
        setExtractedSchedules(data.schedule);
        setFilteredSchedules(data.schedule);
        setScheduleHistory([]);
        setFixedSchedules([]);
        setCustomSchedulesForLegend([]);
      } else if (data.action === 'question') {
        // 질문 처리
      }

      // 필터링 응답 처리
      else {
        const botMessage = {
          id: Date.now() + 1,
          sender: 'bot',
          text: data.explanation,
          timestamp: new Date()
        };
        setChatHistory(prev => [...prev, botMessage]);

        if (data.action === 'filter' && data.filteredSchedules && data.filteredSchedules.length > 0) {
          setFilteredSchedules(data.filteredSchedules);

          // 모달 띄우기
          setSlideDirection('left');
          setTimeout(() => {
            setShowOptimizationModal(true);
          }, 50);
        } else if (data.action === 'filter' && (!data.filteredSchedules || data.filteredSchedules.length === 0)) {
          const warningMessage = {
            id: Date.now() + 2,
            sender: 'bot',
            text: '필터링된 수업이 없습니다. 다른 조건으로 다시 시도해주세요.',
            timestamp: new Date()
          };
          setChatHistory(prev => [...prev, warningMessage]);
        }
      }

    } catch (err) {
      const errorMessage = {
        id: Date.now() + 1,
        sender: 'bot',
        text: '채팅 처리 중 오류가 발생했습니다. 다시 시도해주세요.',
        timestamp: new Date()
      };

      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsFilteringChat(false);
    }
  };
};
