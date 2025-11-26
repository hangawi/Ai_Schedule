const express = require('express');
const router = express.Router();

// Services
const {
  generateQuestionWithAI,
  generatePersonalizedQuestionWithAI,
  generateAnalysisWithAI,
  generateDailyQuestionsWithAI
} = require('./nview/services/geminiService');

// Helpers
const {
  calculateTypeStats,
  calculateDifficultyStats,
  generateDashboardData,
  calculateDailyTrends
} = require('./nview/helpers/statsCalculator');

const {
  findWeaknesses,
  findWeakestType,
  getRandomType,
  generateFallbackAnalysis,
  getRecentIncorrect
} = require('./nview/helpers/weaknessAnalyzer');

const { calculateRankings } = require('./nview/helpers/rankingCalculator');

// Validators
const {
  validateStudentId,
  validateAnswerParams,
  validateStudentHasQuestion,
  validateDailyAnswerParams,
  validateDailyQuestion
} = require('./nview/validators/requestValidator');

// Constants
const { getFallbackQuestion } = require('./nview/constants/fallbackQuestions');
const { getTypeText } = require('./nview/constants/typeMapping');

// Utils
const { isToday } = require('./nview/utils/dateUtils');

// 메모리 저장소
const sessions = new Map();
const questions = new Map();
const answers = new Map();
const learningHistory = new Map();
const dailyQuestions = new Map();
const dailyAnswers = new Map();

// ============================================================================
// 세션 관리
// ============================================================================

// 세션 등록
router.post('/session/register', (req, res) => {
  const { studentId, name } = req.body;

  sessions.set(studentId, {
    id: studentId,
    name: name || `학생${studentId}`,
    connected: true,
    lastSeen: new Date()
  });

  res.json({ success: true, studentId, name: sessions.get(studentId).name });
});

// 활성 학생 목록 조회
router.get('/session/students', (req, res) => {
  const students = Array.from(sessions.values()).map(s => ({
    id: s.id,
    name: s.name,
    connected: s.connected,
    hasQuestion: questions.has(s.id),
    hasAnswer: answers.has(s.id)
  }));

  res.json({ students });
});

// ============================================================================
// 문제 생성 및 답안 제출
// ============================================================================

// 문제 생성
router.post('/generate-question', async (req, res) => {
  try {
    const { difficulty = 'medium', type = 'addition', game_type = 'bingo', studentId } = req.body;

    // AI로 문제 생성 시도
    const questionData = await generateQuestionWithAI(game_type, difficulty, type);

    const questionWithMetadata = {
      ...questionData,
      difficulty,
      type,
      game_type,
      timestamp: new Date()
    };

    if (studentId) {
      questions.set(studentId, questionWithMetadata);
    }

    res.json(questionWithMetadata);

  } catch (error) {
    // Fallback 문제 반환
    const { game_type = 'bingo', studentId, difficulty = 'medium', type = 'addition' } = req.body;
    const fallbackQuestion = getFallbackQuestion(game_type, difficulty, type);

    const questionWithMetadata = {
      ...fallbackQuestion,
      difficulty,
      type,
      game_type,
      timestamp: new Date()
    };

    if (studentId) {
      questions.set(studentId, questionWithMetadata);
    }

    res.json(questionWithMetadata);
  }
});

// 답안 제출 및 채점
router.post('/submit-answer', (req, res) => {
  const { studentId, answer, timeSpent } = req.body;

  const validation = validateStudentHasQuestion(studentId, questions);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.message });
  }

  const question = questions.get(studentId);
  const correct = String(answer).trim().toLowerCase() === String(question.answer).trim().toLowerCase();

  const result = {
    studentId,
    answer,
    correct,
    correctAnswer: question.answer,
    timestamp: new Date()
  };

  answers.set(studentId, result);

  // 학습 이력 저장
  if (!learningHistory.has(studentId)) {
    learningHistory.set(studentId, []);
  }

  learningHistory.get(studentId).push({
    questionData: question,
    studentAnswer: answer,
    correct,
    timeSpent: timeSpent || 0,
    timestamp: new Date()
  });

  res.json({ success: true, correct, correctAnswer: question.answer });
});

// ============================================================================
// 결과 조회
// ============================================================================

// 학생별 결과 조회
router.get('/results/:studentId', (req, res) => {
  const { studentId } = req.params;

  res.json({
    question: questions.get(studentId) || null,
    answer: answers.get(studentId) || null
  });
});

// 전체 결과 조회
router.get('/results', (req, res) => {
  const results = [];

  for (const [studentId, student] of sessions.entries()) {
    results.push({
      student: student,
      question: questions.get(studentId) || null,
      answer: answers.get(studentId) || null
    });
  }

  res.json({ results });
});

// ============================================================================
// 학습 분석
// ============================================================================

// 학생 약점 분석
router.get('/analyze-student/:studentId', async (req, res) => {
  const { studentId } = req.params;

  if (!learningHistory.has(studentId)) {
    return res.json({
      studentId,
      totalQuestions: 0,
      analysis: '아직 학습 데이터가 없습니다.',
      weaknesses: []
    });
  }

  const history = learningHistory.get(studentId);
  const totalQuestions = history.length;
  const correctAnswers = history.filter(h => h.correct).length;
  const incorrectAnswers = totalQuestions - correctAnswers;
  const accuracy = totalQuestions > 0 ? ((correctAnswers / totalQuestions) * 100).toFixed(1) : 0;

  const typeStats = calculateTypeStats(history);
  const difficultyStats = calculateDifficultyStats(history);
  const weaknesses = findWeaknesses(typeStats);
  const incorrectQuestions = getRecentIncorrect(history);

  // AI 분석 시도
  let aiAnalysis = '';
  try {
    aiAnalysis = await generateAnalysisWithAI({
      totalQuestions,
      correctAnswers,
      incorrectAnswers,
      accuracy,
      typeStats,
      incorrectQuestions
    });
  } catch (error) {
    aiAnalysis = generateFallbackAnalysis(parseFloat(accuracy), weaknesses);
  }

  res.json({
    studentId,
    totalQuestions,
    correctAnswers,
    incorrectAnswers,
    accuracy: parseFloat(accuracy),
    typeStats,
    difficultyStats,
    weaknesses,
    recentIncorrect: incorrectQuestions,
    aiAnalysis
  });
});

// ============================================================================
// 맞춤형 문제 생성
// ============================================================================

// 맞춤형 문제 생성 (약점 기반)
router.post('/generate-personalized-question', async (req, res) => {
  try {
    const { studentId, difficulty = 'medium', game_type = 'bingo' } = req.body;

    // 약점 유형 찾기
    let weakType = null;
    if (learningHistory.has(studentId)) {
      weakType = findWeakestType(learningHistory.get(studentId));
    }

    if (!weakType) {
      weakType = getRandomType();
    }

    // AI로 맞춤형 문제 생성
    const questionData = await generatePersonalizedQuestionWithAI(difficulty, weakType);

    const questionWithMetadata = {
      ...questionData,
      difficulty,
      type: weakType,
      game_type,
      personalized: true,
      timestamp: new Date()
    };

    questions.set(studentId, questionWithMetadata);

    res.json({
      ...questionData,
      type: weakType,
      difficulty,
      game_type,
      personalized: true,
      targetWeakness: weakType,
      message: `${getTypeText(weakType)} 약점 보완 문제`,
      timestamp: new Date()
    });

  } catch (error) {
    // Fallback 처리
    const { studentId, difficulty = 'medium', game_type = 'bingo' } = req.body;

    let weakType = null;
    if (learningHistory.has(studentId)) {
      weakType = findWeakestType(learningHistory.get(studentId));
    }

    if (!weakType) {
      weakType = getRandomType();
    }

    const fallbackQuestion = getFallbackQuestion(game_type, difficulty, weakType);

    const questionWithMetadata = {
      ...fallbackQuestion,
      difficulty,
      type: weakType,
      game_type,
      personalized: true,
      timestamp: new Date()
    };

    questions.set(studentId, questionWithMetadata);

    res.json({
      ...fallbackQuestion,
      type: weakType,
      difficulty,
      game_type,
      personalized: true,
      targetWeakness: weakType,
      message: `${getTypeText(weakType)} 약점 보완 문제 (데모모드)`,
      timestamp: new Date()
    });
  }
});

// ============================================================================
// 학습 데이터 저장 및 조회
// ============================================================================

// 학습 데이터 저장
router.post('/save-learning-data', (req, res) => {
  const { studentId, questionData, studentAnswer, correct, timeSpent } = req.body;

  const validation = validateStudentId(studentId);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.message });
  }

  if (!learningHistory.has(studentId)) {
    learningHistory.set(studentId, []);
  }

  learningHistory.get(studentId).push({
    questionData,
    studentAnswer,
    correct,
    timeSpent: timeSpent || 0,
    timestamp: new Date()
  });

  res.json({ success: true, totalRecords: learningHistory.get(studentId).length });
});

// 학습 이력 조회
router.get('/learning-history/:studentId', (req, res) => {
  const { studentId } = req.params;
  const { limit } = req.query;

  if (!learningHistory.has(studentId)) {
    return res.json({ studentId, history: [] });
  }

  let history = [...learningHistory.get(studentId)].reverse();

  if (limit) {
    history = history.slice(0, parseInt(limit));
  }

  res.json({ studentId, history, total: learningHistory.get(studentId).length });
});

// ============================================================================
// 대시보드
// ============================================================================

// 대시보드 데이터 조회
router.get('/dashboard/:studentId', (req, res) => {
  const { studentId } = req.params;
  const { period = 'week' } = req.query;

  if (!learningHistory.has(studentId)) {
    return res.json({
      studentId,
      hasData: false,
      message: '학습 데이터가 없습니다.'
    });
  }

  const dashboardData = generateDashboardData(studentId, learningHistory.get(studentId), period);
  res.json(dashboardData);
});

// 일별 학습 추이 데이터
router.get('/dashboard/trends/:studentId', (req, res) => {
  const { studentId } = req.params;
  const { type = 'daily', days = 7 } = req.query;

  if (!learningHistory.has(studentId)) {
    return res.json({ studentId, trends: [] });
  }

  const trends = calculateDailyTrends(learningHistory.get(studentId), days);
  res.json({ studentId, type, trends });
});

// 학생 랭킹
router.get('/dashboard/ranking', (req, res) => {
  const { period = 'all' } = req.query;
  const rankings = calculateRankings(learningHistory, period);

  res.json({
    period,
    rankings,
    total: rankings.length
  });
});

// ============================================================================
// 오늘의 문제 (Daily Questions)
// ============================================================================

// 오늘의 5문제 자동 생성
router.post('/generate-daily-questions', async (req, res) => {
  try {
    const { studentId, difficulty = 'medium', game_type = 'bingo' } = req.body;

    if (!studentId) {
      return res.status(400).json({ error: '학생 ID가 필요합니다' });
    }

    // 이미 오늘 문제가 생성되었는지 확인
    const existing = dailyQuestions.get(studentId);
    if (existing && isToday(existing.date)) {
      return res.json({
        success: true,
        studentId,
        questions: existing.questions,
        totalQuestions: existing.questions.length,
        alreadyGenerated: true
      });
    }

    // AI로 5문제 생성 시도
    const generatedQuestions = await generateDailyQuestionsWithAI(difficulty);

    dailyQuestions.set(studentId, {
      date: new Date(),
      questions: generatedQuestions
    });
    dailyAnswers.set(studentId, []);

    res.json({
      success: true,
      studentId,
      questions: generatedQuestions,
      totalQuestions: generatedQuestions.length
    });

  } catch (error) {
    // Fallback: 각 유형별로 문제 생성
    const { studentId, difficulty = 'medium' } = req.body;
    const questionTypes = ['addition', 'subtraction', 'multiplication', 'division'];
    const generatedQuestions = [];

    for (let i = 0; i < 5; i++) {
      const type = questionTypes[i % questionTypes.length];
      const fallbackQuestion = getFallbackQuestion('bingo', difficulty, type, i);

      generatedQuestions.push({
        ...fallbackQuestion,
        type,
        difficulty,
        questionIndex: i
      });
    }

    dailyQuestions.set(studentId, {
      date: new Date(),
      questions: generatedQuestions
    });
    dailyAnswers.set(studentId, []);

    res.json({
      success: true,
      studentId,
      questions: generatedQuestions,
      totalQuestions: generatedQuestions.length
    });
  }
});

// 오늘의 문제 조회
router.get('/daily-questions/:studentId', (req, res) => {
  const { studentId } = req.params;

  const dailyData = dailyQuestions.get(studentId);
  const questions = dailyData ? dailyData.questions : [];
  const answers = dailyAnswers.get(studentId) || [];

  res.json({
    studentId,
    questions,
    answers,
    totalQuestions: questions.length,
    answeredCount: answers.length,
    date: dailyData ? dailyData.date : null
  });
});

// 오늘의 문제 답안 제출
router.post('/submit-daily-answer', (req, res) => {
  const { studentId, questionIndex, answer, timeSpent } = req.body;

  const paramsValidation = validateDailyAnswerParams({ studentId, questionIndex, answer });
  if (!paramsValidation.valid) {
    return res.status(400).json({ success: false, message: paramsValidation.message });
  }

  const questionValidation = validateDailyQuestion(studentId, questionIndex, dailyQuestions);
  if (!questionValidation.valid) {
    return res.status(400).json({ success: false, message: questionValidation.message });
  }

  const question = questionValidation.question;
  const correct = String(answer).trim().toLowerCase() === String(question.answer).trim().toLowerCase();

  if (!dailyAnswers.has(studentId)) {
    dailyAnswers.set(studentId, []);
  }

  const answerData = {
    questionIndex,
    answer,
    correct,
    correctAnswer: question.answer,
    timeSpent: timeSpent || 0,
    timestamp: new Date()
  };

  dailyAnswers.get(studentId).push(answerData);

  // 학습 이력에도 저장
  if (!learningHistory.has(studentId)) {
    learningHistory.set(studentId, []);
  }

  learningHistory.get(studentId).push({
    questionData: question,
    studentAnswer: answer,
    correct,
    timeSpent: timeSpent || 0,
    timestamp: new Date()
  });

  const dailyData = dailyQuestions.get(studentId);

  res.json({
    success: true,
    correct,
    correctAnswer: question.answer,
    questionIndex,
    totalAnswered: dailyAnswers.get(studentId).length,
    totalQuestions: dailyData.questions.length
  });
});

// ============================================================================
// 헬스 체크
// ============================================================================

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'N-View Server is running',
    students: sessions.size,
    learningRecords: Array.from(learningHistory.values()).reduce((sum, h) => sum + h.length, 0)
  });
});

module.exports = router;
