/**
 * ===================================================================================================
 * [chatHandlers.js] - 채팅 메시지 전송 및 관련 로직 핸들러
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > client/src/components/chat/handlers/chatHandlers.js
 *
 * 🎯 주요 기능:
 *    - `createHandleSendChat` 팩토리 함수를 통해 채팅 메시지 전송 핸들러를 생성
 *    - 사용자 메시지의 의도를 파악하고, 적절한 백엔드 API 엔드포인트 호출
 *      - 고정 일정 관련 의도: `/api/schedule/fixed-intent`
 *      - 일반 채팅 및 필터링: `/api/schedule/chat`
 *    - API 응답에 따라 채팅 이력, 스케줄 상태, 모달 상태 등 다양한 상태를 업데이트
 *
 * 🔗 연결된 파일:
 *    - ../TimetableUploadWithChat.js: 이 핸들러를 생성하여 채팅 섹션에 `handleSendChat`으로 전달
 *    - ../../../config/firebaseConfig.js: 사용자 인증 토큰을 가져오기 위해 사용
 *    - ../constants/apiConfig.js: API 기본 URL을 가져오기 위해 사용
 *
 * ✏️ 수정 가이드:
 *    - 채팅 메시지 전송 시 백엔드로 보내는 데이터 페이로드를 변경하려면: 각 `fetch` 요청의 `body` 부분을 수정합니다.
 *    - API 응답에 따른 프론트엔드 상태 업데이트 로직을 변경하려면: `fetch` 후 `.then()` 또는 `try/catch` 블록 내부의 상태 설정 함수 호출 부분을 수정합니다.
 *    - 새로운 채팅 액션(예: 'add_note')을 추가하려면: API 응답(`data.action`)에 따라 새로운 `else if` 분기를 추가합니다.
 *
 * 📝 참고사항:
 *    - 핸들러가 클로저를 통해 생성 시점의 상태 설정 함수들(`setChatHistory`, `setFilteredSchedules` 등)에 대한 참조를 유지합니다.
 *    - 고정 일정 관련 요청을 다른 API로 먼저 처리하여 로직을 분리하고 있습니다.
 *
 * ===================================================================================================
 */
import { auth } from '../../../config/firebaseConfig';
import { API_BASE_URL } from '../constants/apiConfig';

/**
 * createHandleSendChat (팩토리 함수)
 *
 * @description 채팅 메시지 전송 로직을 처리하는 핸들러 함수를 생성합니다.
 *              이 핸들러는 사용자 메시지를 백엔드로 보내고, 응답에 따라 UI 상태를 업데이트합니다.
 * @param {object} deps - 핸들러가 의존하는 상태와 상태 설정 함수들의 모음 (의존성 주입)
 * @returns {function(): Promise<void>} 채팅 메시지 전송을 처리하는 비동기 함수
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