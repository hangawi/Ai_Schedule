const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { generatePrompt } = require('../prompts/scheduleOptimizer');
const { optimizeSchedules } = require('../utils/scheduleAutoOptimizer');

// Services
const { callGeminiAI, callGeminiChat } = require('./scheduleOptimizer/services/aiService');
const {
  findFixedScheduleOriginals,
  addFixedSchedulesToOptimization,
  createCustomScheduleLegend
} = require('./scheduleOptimizer/services/optimizationService');
const { createCustomSchedulesForNewItems } = require('./scheduleOptimizer/services/customScheduleService');

// Helpers
const { detectConflicts } = require('./scheduleOptimizer/helpers/conflictDetector');
const { generateOptimizationPrompt } = require('./scheduleOptimizer/helpers/promptGenerator');
const { parseAIResponse, extractDeleteTargets, applyDeleteTargets } = require('./scheduleOptimizer/helpers/aiResponseHandler');

// Validators
const { validateSchedule, isScheduleEmpty } = require('./scheduleOptimizer/validators/scheduleValidator');
const {
  validateDeletionRate,
  isExcessiveDeletion,
  findDeletedItems,
  extractMaintainedItems,
  findWronglyDeleted,
  formatDeletionList
} = require('./scheduleOptimizer/validators/deletionValidator');

// Utils
const { parseAIJSON, cleanExplanation } = require('./scheduleOptimizer/utils/jsonParser');

// Constants
const {
  REDO_KEYWORDS,
  UNDO_KEYWORDS,
  STEP_BACK_KEYWORDS,
  FULL_UNDO_KEYWORDS,
  CONFIRMATION_KEYWORDS
} = require('./scheduleOptimizer/constants/keywords');

/**
 * POST /api/schedule/optimize
 * 새로운 자동 최적화 (고정 일정 지원)
 */
router.post('/optimize', auth, async (req, res) => {
  try {
    const { schedules, schedulesByImage, fixedSchedules } = req.body;

    // 고정 일정 원본 찾기 및 추가
    let allSchedulesForOptimization = schedules || [];
    if (fixedSchedules && fixedSchedules.length > 0) {
      const fixedOriginals = findFixedScheduleOriginals(fixedSchedules, schedulesByImage);
      allSchedulesForOptimization = addFixedSchedulesToOptimization(allSchedulesForOptimization, fixedOriginals);
    }

    // 최적화 실행
    const result = await optimizeSchedules(
      allSchedulesForOptimization,
      schedulesByImage || [],
      fixedSchedules || []
    );

    // 커스텀 일정 범례 생성
    const customSchedules = createCustomScheduleLegend(fixedSchedules);

    res.json({
      success: true,
      optimizedSchedules: result.optimizedSchedules || result,
      customSchedules: customSchedules.length > 0 ? customSchedules : undefined
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/schedule/optimize-legacy
 * GPT 기반 스케줄 최적화 (구버전)
 */
router.post('/optimize-legacy', auth, async (req, res) => {
  try {
    const { schedules, conflicts, userPreferences } = req.body;

    // 프롬프트 생성 및 AI 호출
    const prompt = generateOptimizationPrompt(schedules, conflicts, userPreferences);
    const aiResponse = await callGeminiAI(prompt);

    // AI 응답 파싱
    const parsedResult = parseAIResponse(aiResponse, schedules);

    // 검증: 너무 많이 삭제된 경우 경고
    const deletionRate = validateDeletionRate(schedules, parsedResult.schedule);
    if (deletionRate > 0.5) {
      return res.json({
        success: true,
        optimizedSchedule: schedules,
        alternatives: [],
        explanation: '죄송해요, 최적화 중 문제가 발생했습니다. 😊\n\n현재 시간표를 그대로 유지할게요.\n\n수동으로 수정하시겠어요? 예: "금요일 공연반 삭제"',
        conflictsResolved: 0
      });
    }

    res.json({
      success: true,
      optimizedSchedule: parsedResult.schedule,
      alternatives: parsedResult.alternatives,
      explanation: parsedResult.explanation,
      conflictsResolved: parsedResult.conflictsResolved
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: '스케줄 최적화에 실패했습니다',
      details: error.message
    });
  }
});

/**
 * POST /api/schedule/chat
 * 자연어로 스케줄 수정 요청
 */
router.post('/chat', auth, async (req, res) => {
  try {
    const {
      message,
      currentSchedule,
      originalSchedule,
      scheduleHistory,
      lastAiResponse,
      redoStack,
      fixedSchedules,
      schedulesByImage,
      existingCustomSchedules
    } = req.body;

    // 일정 이동 요청 체크
    const { handleScheduleMoveRequest } = require('../utils/scheduleMoveHandler');
    const moveResult = handleScheduleMoveRequest(message, currentSchedule, fixedSchedules || []);
    if (moveResult.isMoveRequest && moveResult.result) {
      if (moveResult.result.success) {
        const aiResult = await optimizeSchedules(
          moveResult.result.schedule,
          schedulesByImage || [],
          moveResult.result.fixedSchedules || fixedSchedules || []
        );

        return res.json({
          success: true,
          understood: moveResult.result.understood,
          action: 'move',
          schedule: aiResult.optimizedSchedules || aiResult,
          explanation: moveResult.result.explanation + '\n\n✨ 고정 일정을 반영해서 시간표를 다시 최적화했어요!',
          fixedSchedules: moveResult.result.fixedSchedules
        });
      } else {
        return res.json(moveResult.result);
      }
    }

    // Redo 요청
    const isRedo = REDO_KEYWORDS.some(keyword => message.includes(keyword));
    if (isRedo && redoStack && redoStack.length > 0) {
      return res.json({
        success: true,
        understood: '되돌리기 취소',
        action: 'redo',
        schedule: redoStack[redoStack.length - 1],
        explanation: '되돌리기를 취소했어요! 이전 작업을 다시 실행했습니다.'
      });
    }

    // Undo 요청
    const isUndo = UNDO_KEYWORDS.some(keyword => message.includes(keyword));
    const isStepBack = STEP_BACK_KEYWORDS.some(keyword => message.includes(keyword));
    const isFullUndo = FULL_UNDO_KEYWORDS.some(keyword => message.includes(keyword));

    if (isUndo || isStepBack || isFullUndo) {
      if (isStepBack && scheduleHistory && scheduleHistory.length > 0) {
        return res.json({
          success: true,
          understood: '한 단계 이전 시간표로 되돌리기',
          action: 'step_back',
          schedule: scheduleHistory[scheduleHistory.length - 1],
          explanation: '네, 방금 전 시간표로 되돌려드렸어요! 😊'
        });
      }

      return res.json({
        success: true,
        understood: '원본 시간표로 되돌리기',
        action: 'undo',
        schedule: originalSchedule,
        explanation: '네, 원래 시간표로 되돌려드렸어요! 😊 AI 최적화 전 상태로 복원됐습니다.'
      });
    }

    // 충돌 감지
    const conflicts = detectConflicts(currentSchedule);

    // 확인 응답 체크
    const isConfirmation = CONFIRMATION_KEYWORDS.some(kw =>
      message.trim().toLowerCase() === kw || message.trim() === kw
    );

    // AI 프롬프트 생성 및 호출
    const contextToUse = isConfirmation ? lastAiResponse : null;
    const prompt = generatePrompt(message, currentSchedule, conflicts, contextToUse);
    const aiResponse = await callGeminiChat(prompt);

    // JSON 파싱
    let parsed = null;
    try {
      parsed = parseAIJSON(aiResponse);
    } catch (parseError) {
      return res.json({
        success: true,
        understood: 'AI 응답 처리 중 오류 발생',
        action: 'none',
        schedule: currentSchedule,
        explanation: '죄송해요, 응답이 너무 길어서 처리하지 못했습니다. 😥\n\n다시 한번 말씀해주시거나, 더 구체적으로 요청해주세요.\n\n예: "금요일 6시 이후 삭제" 대신 "금요일 공연반 삭제"'
      });
    }

    // 인덱스 기반 삭제 처리
    if (parsed.deleteIndices && Array.isArray(parsed.deleteIndices)) {
      parsed.schedule = currentSchedule.filter((_, idx) => !parsed.deleteIndices.includes(idx + 1));
    }

    // explanation 정리
    if (parsed.explanation) {
      parsed.explanation = cleanExplanation(parsed.explanation);
    }

    // 확인 응답 보정 (ㅇㅇ 등)
    if (isConfirmation && lastAiResponse) {
      const deleteTargets = extractDeleteTargets(lastAiResponse);
      if (deleteTargets.length > 0) {
        const correctedSchedule = applyDeleteTargets(currentSchedule, deleteTargets);
        parsed.schedule = correctedSchedule;
      }
    }

    // 스케줄 유효성 검증
    if (!validateSchedule(parsed.schedule)) {
      return res.json({
        success: true,
        understood: parsed.understood,
        action: 'none',
        schedule: currentSchedule,
        explanation: '죄송해요, 처리 중 문제가 발생했습니다. 시간표는 그대로 유지됩니다. 😊'
      });
    }

    // 빈 스케줄 체크
    if (isScheduleEmpty(parsed.schedule, currentSchedule, parsed.action)) {
      return res.json({
        success: true,
        understood: parsed.understood,
        action: 'question',
        schedule: currentSchedule,
        explanation: parsed.explanation || '현재 시간표를 유지했어요. 😊'
      });
    }

    // add 액션 처리: 새 항목 합치기
    if (parsed.action === 'add') {
      const newItems = parsed.schedule;
      parsed.schedule = [...currentSchedule, ...newItems];
    }

    // delete 액션 검증
    if (parsed.action === 'delete') {
      const deletedItems = findDeletedItems(currentSchedule, parsed.schedule);

      // [유지됨] 검증
      if (lastAiResponse && lastAiResponse.includes('[유지됨')) {
        const shouldBeMaintained = extractMaintainedItems(lastAiResponse);
        const wronglyDeleted = findWronglyDeleted(deletedItems, shouldBeMaintained);

        if (wronglyDeleted.length > 0) {
          parsed.schedule = [...parsed.schedule, ...wronglyDeleted];
          const restoredList = formatDeletionList(wronglyDeleted);
          parsed.explanation = `⚠️ AI가 [유지됨] 항목을 잘못 삭제하여 복원했습니다.\n\n복원된 항목:\n${restoredList}\n\n${parsed.explanation}`;
        }
      }

      // 실제 삭제 검증
      if (deletedItems.length > 0) {
        const explanation = parsed.explanation || '';
        const notMentioned = deletedItems.filter(item => !explanation.includes(item.title));

        if (notMentioned.length > 0) {
          const actualDeletionList = formatDeletionList(deletedItems);
          parsed.explanation = `⚠️ 실제 삭제된 ${deletedItems.length}개 항목:\n\n${actualDeletionList}\n\n※ AI 응답에 일부 누락이 있어 실제 삭제 내역을 표시합니다.`;
        }
      }
    }

    // 과도한 삭제 체크
    const deletionRate = validateDeletionRate(currentSchedule, parsed.schedule);
    if (isExcessiveDeletion(deletionRate, parsed.action)) {
      return res.json({
        success: true,
        understood: parsed.understood,
        action: 'question',
        schedule: currentSchedule,
        explanation: parsed.explanation || '현재 시간표를 유지했어요. 😊'
      });
    }

    // 고정 일정 재최적화
    let finalSchedule = parsed.schedule;
    if (fixedSchedules && fixedSchedules.length > 0) {
      const fixedOriginals = findFixedScheduleOriginals(fixedSchedules, schedulesByImage);
      const schedulesForReoptimization = addFixedSchedulesToOptimization(parsed.schedule, fixedOriginals);

      const optimizedResult = await optimizeSchedules(
        schedulesForReoptimization,
        schedulesByImage || [],
        fixedSchedules
      );

      finalSchedule = optimizedResult.optimizedSchedules || optimizedResult;
    }

    // 커스텀 일정 범례 생성 (add 액션일 때만)
    let customSchedules = [];
    if (parsed.action === 'add') {
      const newItems = parsed.schedule.slice(currentSchedule.length);
      customSchedules = createCustomSchedulesForNewItems(newItems, schedulesByImage, existingCustomSchedules);
    }

    res.json({
      success: true,
      understood: parsed.understood,
      action: parsed.action,
      schedule: finalSchedule,
      explanation: parsed.explanation,
      customSchedules: customSchedules.length > 0 ? customSchedules : undefined
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: '채팅 처리 실패',
      details: error.message
    });
  }
});

module.exports = router;
