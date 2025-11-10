require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Gemini API 초기화
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

// N-view를 위한 메모리 저장소
const sessions = new Map(); // 학생 세션 저장
const questions = new Map(); // 학생별 문제 저장
const answers = new Map(); // 학생별 답안 저장
const learningHistory = new Map(); // 학생별 학습 이력 저장 (전체 기록)

// 세션 생성 또는 갱신
app.post('/api/session/register', (req, res) => {
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
app.get('/api/session/students', (req, res) => {
  const students = Array.from(sessions.values()).map(s => ({
    id: s.id,
    name: s.name,
    connected: s.connected,
    hasQuestion: questions.has(s.id),
    hasAnswer: answers.has(s.id)
  }));
  
  res.json({ students });
});

// 학생별 문제 생성 및 저장
app.post('/api/generate-question', async (req, res) => {
  try {
    const { difficulty = 'medium', type = 'addition', game_type = 'bingo', studentId } = req.body;

    let prompt = '';

    // 게임 타입별로 다른 프롬프트 생성
    if (game_type === 'bingo') {
      const diffText = difficulty === 'easy' ? '쉬운' : difficulty === 'hard' ? '어려운' : '중간';
      const typeText = type === 'addition' ? '덧셈' : type === 'subtraction' ? '뺄셈' : type === 'multiplication' ? '곱셈' : '나눗셈';

      prompt = `당신은 초등학교 수학 교사입니다.
${diffText} 난이도의 ${typeText} 문제를 1개 생성해주세요.

반드시 다음 JSON 형식으로만 답변하세요:
{"question": "문제내용", "answer": "정답"}

예시: {"question": "5 + 3 = ?", "answer": "8"}`;

    } else if (game_type === 'voca') {
      const gradeText = difficulty === 'easy' ? '초등 1~2학년' : difficulty === 'hard' ? '초등 5~6학년' : '초등 3~4학년';

      if (type === 'korean_word') {
        prompt = `당신은 초등학교 국어 교사입니다.
${gradeText} 수준의 국어 단어 뜻을 묻는 문제를 1개 생성해주세요.

반드시 다음 JSON 형식으로만 답변하세요:
{"question": "다음 단어의 뜻은? '단어'", "answer": "뜻 설명"}

예시: {"question": "다음 단어의 뜻은? '기쁘다'", "answer": "즐겁고 흐뭇한 느낌이다"}`;
      } else if (type === 'english_word') {
        prompt = `당신은 초등학교 영어 교사입니다.
${gradeText} 수준의 영어 단어 뜻을 묻는 문제를 1개 생성해주세요.

반드시 다음 JSON 형식으로만 답변하세요:
{"question": "What does 'word' mean?", "answer": "한글 뜻"}

예시: {"question": "What does 'happy' mean?", "answer": "기쁜, 행복한"}`;
      } else if (type === 'synonym') {
        prompt = `당신은 초등학교 국어 교사입니다.
${gradeText} 수준의 유의어 찾기 문제를 1개 생성해주세요.

반드시 다음 JSON 형식으로만 답변하세요:
{"question": "'단어'의 유의어는?", "answer": "유의어"}

예시: {"question": "'즐겁다'의 유의어는?", "answer": "기쁘다"}`;
      } else if (type === 'antonym') {
        prompt = `당신은 초등학교 국어 교사입니다.
${gradeText} 수준의 반의어 찾기 문제를 1개 생성해주세요.

반드시 다음 JSON 형식으로만 답변하세요:
{"question": "'단어'의 반의어는?", "answer": "반의어"}

예시: {"question": "'크다'의 반의어는?", "answer": "작다"}`;
      }

    } else if (game_type === 'whoami') {
      const diffText = difficulty === 'easy' ? '쉬운' : difficulty === 'hard' ? '어려운' : '중간';

      if (type === 'person') {
        prompt = `당신은 초등학교 교사입니다.
${diffText} 난이도의 인물 추리 문제를 1개 생성해주세요.

반드시 다음 JSON 형식으로만 답변하세요:
{"question": "나는 누구일까요? 힌트: (인물 특징)", "answer": "인물 이름"}

예시: {"question": "나는 누구일까요? 힌트: 한국의 위대한 과학자, 거북선을 만들었어요", "answer": "이순신"}`;
      } else if (type === 'animal') {
        prompt = `당신은 초등학교 교사입니다.
${diffText} 난이도의 동물 추리 문제를 1개 생성해주세요.

반드시 다음 JSON 형식으로만 답변하세요:
{"question": "나는 누구일까요? 힌트: (동물 특징)", "answer": "동물 이름"}

예시: {"question": "나는 누구일까요? 힌트: 목이 길고 점무늬가 있어요", "answer": "기린"}`;
      } else if (type === 'object') {
        prompt = `당신은 초등학교 교사입니다.
${diffText} 난이도의 사물 추리 문제를 1개 생성해주세요.

반드시 다음 JSON 형식으로만 답변하세요:
{"question": "나는 무엇일까요? 힌트: (사물 특징)", "answer": "사물 이름"}

예시: {"question": "나는 무엇일까요? 힌트: 시간을 알려주고, 손목에 차요", "answer": "시계"}`;
      }
    }

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    let questionData;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        questionData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('JSON 형식을 찾을 수 없습니다');
      }
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError);
      throw new Error('AI 응답을 파싱할 수 없습니다');
    }

    // 학생별로 문제 저장 (메타데이터 포함)
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
    console.error('Error generating question:', error);

    // Fallback 문제
    const { game_type = 'bingo', studentId, difficulty = 'medium', type = 'addition' } = req.body;
    let fallbackQuestion;

    if (game_type === 'voca') {
      const vocaFallback = [
        { question: "다음 단어의 뜻은? '기쁘다'", answer: "즐겁고 흐뭇한 느낌이다" },
        { question: "What does 'happy' mean?", answer: "기쁜, 행복한" }
      ];
      fallbackQuestion = vocaFallback[Math.floor(Math.random() * vocaFallback.length)];

    } else if (game_type === 'whoami') {
      const whoamiFallback = [
        { question: "나는 누구일까요? 힌트: 목이 길고 점무늬가 있어요", answer: "기린" },
        { question: "나는 누구일까요? 힌트: 한국의 위대한 과학자, 거북선을 만들었어요", answer: "이순신" }
      ];
      fallbackQuestion = whoamiFallback[Math.floor(Math.random() * whoamiFallback.length)];

    } else {
      // 난이도별, 유형별 문제
      const bingoFallbackByLevel = {
        easy: {
          addition: [
            { question: "1 + 2 = ?", answer: "3" },
            { question: "2 + 3 = ?", answer: "5" },
            { question: "3 + 4 = ?", answer: "7" }
          ],
          subtraction: [
            { question: "5 - 2 = ?", answer: "3" },
            { question: "7 - 3 = ?", answer: "4" },
            { question: "9 - 4 = ?", answer: "5" }
          ],
          multiplication: [
            { question: "2 × 3 = ?", answer: "6" },
            { question: "3 × 3 = ?", answer: "9" },
            { question: "2 × 4 = ?", answer: "8" }
          ],
          division: [
            { question: "6 ÷ 2 = ?", answer: "3" },
            { question: "8 ÷ 2 = ?", answer: "4" },
            { question: "9 ÷ 3 = ?", answer: "3" }
          ]
        },
        medium: {
          addition: [
            { question: "12 + 15 = ?", answer: "27" },
            { question: "23 + 18 = ?", answer: "41" },
            { question: "34 + 27 = ?", answer: "61" }
          ],
          subtraction: [
            { question: "25 - 13 = ?", answer: "12" },
            { question: "42 - 18 = ?", answer: "24" },
            { question: "56 - 27 = ?", answer: "29" }
          ],
          multiplication: [
            { question: "7 × 8 = ?", answer: "56" },
            { question: "6 × 9 = ?", answer: "54" },
            { question: "8 × 7 = ?", answer: "56" }
          ],
          division: [
            { question: "36 ÷ 6 = ?", answer: "6" },
            { question: "48 ÷ 8 = ?", answer: "6" },
            { question: "54 ÷ 9 = ?", answer: "6" }
          ]
        },
        hard: {
          addition: [
            { question: "127 + 385 = ?", answer: "512" },
            { question: "256 + 478 = ?", answer: "734" },
            { question: "345 + 567 = ?", answer: "912" }
          ],
          subtraction: [
            { question: "523 - 278 = ?", answer: "245" },
            { question: "634 - 387 = ?", answer: "247" },
            { question: "825 - 467 = ?", answer: "358" }
          ],
          multiplication: [
            { question: "15 × 12 = ?", answer: "180" },
            { question: "23 × 14 = ?", answer: "322" },
            { question: "18 × 16 = ?", answer: "288" }
          ],
          division: [
            { question: "144 ÷ 12 = ?", answer: "12" },
            { question: "156 ÷ 13 = ?", answer: "12" },
            { question: "168 ÷ 14 = ?", answer: "12" }
          ]
        }
      };

      const difficultyLevel = bingoFallbackByLevel[difficulty] || bingoFallbackByLevel.medium;
      const typeQuestions = difficultyLevel[type] || difficultyLevel.addition;
      fallbackQuestion = typeQuestions[Math.floor(Math.random() * typeQuestions.length)];
    }

    // 난이도와 유형 정보 추가
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

// 학생 답안 제출 및 채점
app.post('/api/submit-answer', (req, res) => {
  const { studentId, answer, timeSpent } = req.body;

  if (!studentId || !questions.has(studentId)) {
    return res.status(400).json({ success: false, message: '문제가 없습니다' });
  }

  const question = questions.get(studentId);
  const correct = String(answer).trim().toLowerCase() === String(question.answer).trim().toLowerCase();

  console.log(`📝 ${studentId} 답안 제출:`, {
    question: question.question,
    type: question.type,
    difficulty: question.difficulty,
    game_type: question.game_type,
    correct
  });

  const result = {
    studentId,
    answer,
    correct,
    correctAnswer: question.answer,
    timestamp: new Date()
  };

  answers.set(studentId, result);

  // 학습 데이터 자동 저장
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

  console.log(`✅ ${studentId} 학습 이력 저장 완료. 총 ${learningHistory.get(studentId).length}개 문제`);

  res.json({ success: true, correct, correctAnswer: question.answer });
});

// 학생별 결과 조회
app.get('/api/results/:studentId', (req, res) => {
  const { studentId } = req.params;
  
  const result = {
    question: questions.get(studentId) || null,
    answer: answers.get(studentId) || null
  };
  
  res.json(result);
});

// 전체 결과 조회
app.get('/api/results', (req, res) => {
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

// 학습 데이터 저장 (답안 제출 시 자동 저장)
app.post('/api/save-learning-data', (req, res) => {
  const { studentId, questionData, studentAnswer, correct, timeSpent } = req.body;

  if (!studentId) {
    return res.status(400).json({ success: false, message: '학생 ID가 필요합니다' });
  }

  // 학생별 학습 이력 배열 초기화
  if (!learningHistory.has(studentId)) {
    learningHistory.set(studentId, []);
  }

  // 학습 데이터 저장
  const learningData = {
    questionData,
    studentAnswer,
    correct,
    timeSpent: timeSpent || 0,
    timestamp: new Date()
  };

  learningHistory.get(studentId).push(learningData);

  res.json({ success: true, totalRecords: learningHistory.get(studentId).length });
});

// 학생 약점 분석
app.get('/api/analyze-student/:studentId', async (req, res) => {
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

  // 기본 통계 계산
  const totalQuestions = history.length;
  const correctAnswers = history.filter(h => h.correct).length;
  const incorrectAnswers = totalQuestions - correctAnswers;
  const accuracy = totalQuestions > 0 ? ((correctAnswers / totalQuestions) * 100).toFixed(1) : 0;

  // 유형별 분석
  const typeStats = {};
  const difficultyStats = {};

  history.forEach(record => {
    const type = record.questionData.type;
    const difficulty = record.questionData.difficulty;

    // 유형별 통계
    if (!typeStats[type]) {
      typeStats[type] = { total: 0, correct: 0, incorrect: 0 };
    }
    typeStats[type].total++;
    if (record.correct) {
      typeStats[type].correct++;
    } else {
      typeStats[type].incorrect++;
    }

    // 난이도별 통계
    if (!difficultyStats[difficulty]) {
      difficultyStats[difficulty] = { total: 0, correct: 0, incorrect: 0 };
    }
    difficultyStats[difficulty].total++;
    if (record.correct) {
      difficultyStats[difficulty].correct++;
    } else {
      difficultyStats[difficulty].incorrect++;
    }
  });

  // 약점 파악 (정답률 60% 미만인 유형)
  const weaknesses = [];
  Object.keys(typeStats).forEach(type => {
    const stat = typeStats[type];
    const typeAccuracy = (stat.correct / stat.total) * 100;
    if (typeAccuracy < 60) {
      weaknesses.push({
        type,
        accuracy: typeAccuracy.toFixed(1),
        total: stat.total,
        correct: stat.correct,
        incorrect: stat.incorrect
      });
    }
  });

  // 틀린 문제들 추출
  const incorrectQuestions = history.filter(h => !h.correct).slice(-5); // 최근 5개

  // AI 분석 리포트 생성
  let aiAnalysis = '';
  try {
    const analysisPrompt = `당신은 초등학교 수학 교육 전문가입니다.
다음 학생의 학습 데이터를 분석하고, 약점과 개선 방향을 제시해주세요.

**학습 통계:**
- 총 문제 수: ${totalQuestions}개
- 정답: ${correctAnswers}개
- 오답: ${incorrectAnswers}개
- 정답률: ${accuracy}%

**유형별 통계:**
${Object.keys(typeStats).map(type => {
  const stat = typeStats[type];
  const typeAcc = ((stat.correct / stat.total) * 100).toFixed(1);
  return `- ${type}: ${stat.total}문제 (정답률 ${typeAcc}%)`;
}).join('\n')}

**최근 틀린 문제들:**
${incorrectQuestions.map((q, i) => `${i+1}. ${q.questionData.question} (정답: ${q.questionData.answer}, 학생 답: ${q.studentAnswer})`).join('\n')}

다음 형식으로 분석해주세요:
1. 전체적인 학습 수준 평가
2. 주요 약점 (어떤 유형의 문제를 어려워하는지)
3. 틀린 문제들의 공통 패턴
4. 구체적인 개선 방향 및 학습 전략
5. 다음에 집중해야 할 문제 유형

간결하고 구체적으로 작성해주세요.`;

    const result = await model.generateContent(analysisPrompt);
    aiAnalysis = result.response.text();
  } catch (error) {
    console.error('AI 분석 오류:', error);

    // Fallback 분석 메시지 생성
    let analysisText = '📊 학습 분석 (데모 모드)\n\n';

    analysisText += `1️⃣ 전체 학습 수준: `;
    if (accuracy >= 80) {
      analysisText += '매우 우수합니다! 꾸준히 학습하고 있습니다.\n\n';
    } else if (accuracy >= 60) {
      analysisText += '잘 하고 있습니다. 조금 더 연습하면 더 좋아질 거예요!\n\n';
    } else {
      analysisText += '기초부터 차근차근 다시 학습해봅시다.\n\n';
    }

    analysisText += '2️⃣ 주요 약점: ';
    if (weaknesses.length > 0) {
      const weakTypeNames = {
        addition: '덧셈',
        subtraction: '뺄셈',
        multiplication: '곱셈',
        division: '나눗셈'
      };
      const weakTypes = weaknesses.map(w => weakTypeNames[w.type] || w.type).join(', ');
      analysisText += `${weakTypes} 문제에서 어려움을 겪고 있습니다.\n\n`;
    } else {
      analysisText += '모든 유형을 고르게 잘 풀고 있습니다.\n\n';
    }

    analysisText += '3️⃣ 개선 방향:\n';
    if (weaknesses.length > 0) {
      analysisText += `- ${weaknesses[0].type} 유형의 기본 문제부터 다시 연습해보세요\n`;
      analysisText += '- 천천히 정확하게 푸는 연습이 필요합니다\n';
    } else {
      analysisText += '- 현재 수준을 유지하면서 조금 더 어려운 문제에 도전해보세요\n';
      analysisText += '- 다양한 유형의 문제를 골고루 풀어보세요\n';
    }

    analysisText += '\n4️⃣ 학습 전략:\n';
    analysisText += '- 매일 10-15분씩 꾸준히 연습하세요\n';
    analysisText += '- 틀린 문제는 다시 한 번 풀어보세요\n';
    analysisText += '- 자신감을 가지고 문제를 풀어보세요!\n';

    aiAnalysis = analysisText;
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

// 맞춤형 문제 생성 (약점 기반)
app.post('/api/generate-personalized-question', async (req, res) => {
  try {
    const { studentId, difficulty = 'medium', game_type = 'bingo' } = req.body;

    // 학습 이력 확인
    let weakType = null;
    if (learningHistory.has(studentId)) {
      const history = learningHistory.get(studentId);

      // 유형별 정답률 계산
      const typeStats = {};
      history.forEach(record => {
        const type = record.questionData.type;
        if (!typeStats[type]) {
          typeStats[type] = { total: 0, correct: 0 };
        }
        typeStats[type].total++;
        if (record.correct) typeStats[type].correct++;
      });

      // 가장 약한 유형 찾기 (정답률이 가장 낮은 유형)
      let lowestAccuracy = 100;
      Object.keys(typeStats).forEach(type => {
        const stat = typeStats[type];
        const accuracy = (stat.correct / stat.total) * 100;
        if (accuracy < lowestAccuracy && stat.total >= 2) { // 최소 2문제 이상
          lowestAccuracy = accuracy;
          weakType = type;
        }
      });
    }

    // 약점 유형이 없으면 랜덤 선택
    if (!weakType) {
      const types = ['addition', 'subtraction', 'multiplication', 'division'];
      weakType = types[Math.floor(Math.random() * types.length)];
    }

    // 약점 유형으로 문제 생성
    const diffText = difficulty === 'easy' ? '쉬운' : difficulty === 'hard' ? '어려운' : '중간';
    const typeText = weakType === 'addition' ? '덧셈' : weakType === 'subtraction' ? '뺄셈' :
                     weakType === 'multiplication' ? '곱셈' : '나눗셈';

    const prompt = `당신은 초등학교 수학 교사입니다.
이 학생은 ${typeText} 문제에 약점이 있습니다.
${diffText} 난이도의 ${typeText} 문제를 1개 생성해주세요.

학생의 약점을 보완할 수 있도록 명확하고 이해하기 쉬운 문제를 만들어주세요.

반드시 다음 JSON 형식으로만 답변하세요:
{"question": "문제내용", "answer": "정답"}

예시: {"question": "5 + 3 = ?", "answer": "8"}`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    let questionData;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        questionData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('JSON 형식을 찾을 수 없습니다');
      }
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError);
      throw new Error('AI 응답을 파싱할 수 없습니다');
    }

    // 학생별로 문제 저장
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
      message: `${typeText} 약점 보완 문제`,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Error generating personalized question:', error);

    // Fallback 처리
    const { studentId, difficulty = 'medium', game_type = 'bingo' } = req.body;

    // 학습 이력에서 약점 유형 찾기
    let weakType = null;
    if (learningHistory.has(studentId)) {
      const history = learningHistory.get(studentId);
      const typeStats = {};
      history.forEach(record => {
        const type = record.questionData.type;
        if (!typeStats[type]) {
          typeStats[type] = { total: 0, correct: 0 };
        }
        typeStats[type].total++;
        if (record.correct) typeStats[type].correct++;
      });

      let lowestAccuracy = 100;
      Object.keys(typeStats).forEach(type => {
        const stat = typeStats[type];
        const accuracy = (stat.correct / stat.total) * 100;
        if (accuracy < lowestAccuracy && stat.total >= 2) {
          lowestAccuracy = accuracy;
          weakType = type;
        }
      });
    }

    if (!weakType) {
      const types = ['addition', 'subtraction', 'multiplication', 'division'];
      weakType = types[Math.floor(Math.random() * types.length)];
    }

    // 폴백 문제 (난이도별)
    const fallbackQuestions = {
      easy: {
        addition: [
          { question: "1 + 2 = ?", answer: "3" },
          { question: "3 + 4 = ?", answer: "7" },
          { question: "5 + 3 = ?", answer: "8" }
        ],
        subtraction: [
          { question: "5 - 2 = ?", answer: "3" },
          { question: "7 - 3 = ?", answer: "4" },
          { question: "9 - 4 = ?", answer: "5" }
        ],
        multiplication: [
          { question: "2 × 3 = ?", answer: "6" },
          { question: "3 × 3 = ?", answer: "9" },
          { question: "2 × 4 = ?", answer: "8" }
        ],
        division: [
          { question: "6 ÷ 2 = ?", answer: "3" },
          { question: "8 ÷ 2 = ?", answer: "4" },
          { question: "9 ÷ 3 = ?", answer: "3" }
        ]
      },
      medium: {
        addition: [
          { question: "12 + 15 = ?", answer: "27" },
          { question: "23 + 18 = ?", answer: "41" },
          { question: "28 + 35 = ?", answer: "63" }
        ],
        subtraction: [
          { question: "25 - 13 = ?", answer: "12" },
          { question: "42 - 18 = ?", answer: "24" },
          { question: "56 - 27 = ?", answer: "29" }
        ],
        multiplication: [
          { question: "7 × 8 = ?", answer: "56" },
          { question: "6 × 9 = ?", answer: "54" },
          { question: "8 × 7 = ?", answer: "56" }
        ],
        division: [
          { question: "36 ÷ 6 = ?", answer: "6" },
          { question: "48 ÷ 8 = ?", answer: "6" },
          { question: "54 ÷ 9 = ?", answer: "6" }
        ]
      },
      hard: {
        addition: [
          { question: "127 + 385 = ?", answer: "512" },
          { question: "256 + 478 = ?", answer: "734" },
          { question: "345 + 567 = ?", answer: "912" }
        ],
        subtraction: [
          { question: "523 - 278 = ?", answer: "245" },
          { question: "634 - 387 = ?", answer: "247" },
          { question: "825 - 467 = ?", answer: "358" }
        ],
        multiplication: [
          { question: "15 × 12 = ?", answer: "180" },
          { question: "23 × 14 = ?", answer: "322" },
          { question: "18 × 16 = ?", answer: "288" }
        ],
        division: [
          { question: "144 ÷ 12 = ?", answer: "12" },
          { question: "156 ÷ 13 = ?", answer: "12" },
          { question: "168 ÷ 14 = ?", answer: "12" }
        ]
      }
    };

    const difficultyLevel = fallbackQuestions[difficulty] || fallbackQuestions.medium;
    const typeQuestions = difficultyLevel[weakType] || difficultyLevel.addition;
    const fallbackQuestion = typeQuestions[Math.floor(Math.random() * typeQuestions.length)];

    const typeText = weakType === 'addition' ? '덧셈' : weakType === 'subtraction' ? '뺄셈' :
                     weakType === 'multiplication' ? '곱셈' : '나눗셈';

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
      message: `${typeText} 약점 보완 문제 (데모모드)`,
      timestamp: new Date()
    });
  }
});

// 학습 이력 조회
app.get('/api/learning-history/:studentId', (req, res) => {
  const { studentId } = req.params;
  const { limit } = req.query;

  if (!learningHistory.has(studentId)) {
    return res.json({ studentId, history: [] });
  }

  let history = learningHistory.get(studentId);

  // 최신순으로 정렬
  history = [...history].reverse();

  // limit 적용
  if (limit) {
    history = history.slice(0, parseInt(limit));
  }

  res.json({ studentId, history, total: learningHistory.get(studentId).length });
});

// 대시보드 전체 데이터 조회
app.get('/api/dashboard/:studentId', (req, res) => {
  const { studentId } = req.params;
  const { period = 'week' } = req.query; // day, week, month

  if (!learningHistory.has(studentId)) {
    return res.json({
      studentId,
      hasData: false,
      message: '학습 데이터가 없습니다.'
    });
  }

  const history = learningHistory.get(studentId);
  const now = new Date();

  // 기간별 필터링
  let filteredHistory = history;
  if (period === 'day') {
    filteredHistory = history.filter(r => isToday(new Date(r.timestamp)));
  } else if (period === 'week') {
    filteredHistory = history.filter(r => isThisWeek(new Date(r.timestamp)));
  } else if (period === 'month') {
    filteredHistory = history.filter(r => isThisMonth(new Date(r.timestamp)));
  }

  // KPI 계산
  const totalQuestions = filteredHistory.length;
  const correctAnswers = filteredHistory.filter(h => h.correct).length;
  const accuracy = totalQuestions > 0 ? ((correctAnswers / totalQuestions) * 100).toFixed(1) : 0;
  const totalTime = filteredHistory.reduce((sum, h) => sum + (h.timeSpent || 0), 0);
  const avgTime = totalQuestions > 0 ? Math.round(totalTime / totalQuestions) : 0;

  // 유형별 통계
  const typeStats = {};
  ['addition', 'subtraction', 'multiplication', 'division'].forEach(type => {
    const typeRecords = filteredHistory.filter(r => r.questionData.type === type);
    const typeCorrect = typeRecords.filter(r => r.correct).length;
    typeStats[type] = {
      total: typeRecords.length,
      correct: typeCorrect,
      incorrect: typeRecords.length - typeCorrect,
      accuracy: typeRecords.length > 0 ? ((typeCorrect / typeRecords.length) * 100).toFixed(1) : 0,
      avgTime: typeRecords.length > 0 ? Math.round(typeRecords.reduce((sum, r) => sum + (r.timeSpent || 0), 0) / typeRecords.length) : 0
    };
  });

  // 최근 오답 (최근 10개)
  const recentWrong = filteredHistory
    .filter(h => !h.correct)
    .reverse()
    .slice(0, 10)
    .map(h => ({
      question: h.questionData.question,
      answer: h.questionData.answer,
      studentAnswer: h.studentAnswer,
      type: h.questionData.type,
      difficulty: h.questionData.difficulty,
      timeSpent: h.timeSpent,
      timestamp: h.timestamp
    }));

  // 학습 연속일 계산
  const streak = calculateStreak(history);

  console.log(`📊 ${studentId} 대시보드 조회:`, {
    전체기록: history.length,
    기간필터: filteredHistory.length,
    총문제수: totalQuestions,
    정답수: correctAnswers,
    정답률: accuracy,
    총학습시간: totalTime
  });

  res.json({
    studentId,
    hasData: true,
    period,
    kpi: {
      totalQuestions,
      correctAnswers,
      incorrectAnswers: totalQuestions - correctAnswers,
      accuracy: parseFloat(accuracy),
      totalTime,
      avgTime,
      streak
    },
    typeStats,
    recentWrong,
    lastUpdated: new Date()
  });
});

// 일별 학습 추이 데이터
app.get('/api/dashboard/trends/:studentId', (req, res) => {
  const { studentId } = req.params;
  const { type = 'daily', days = 7 } = req.query;

  if (!learningHistory.has(studentId)) {
    return res.json({ studentId, trends: [] });
  }

  const history = learningHistory.get(studentId);
  const trends = [];

  if (type === 'daily') {
    for (let i = parseInt(days) - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const dayRecords = history.filter(r => {
        const recordDate = new Date(r.timestamp);
        return recordDate.toDateString() === date.toDateString();
      });

      const correct = dayRecords.filter(r => r.correct).length;
      trends.push({
        date: date.toISOString().split('T')[0],
        label: ['일', '월', '화', '수', '목', '금', '토'][date.getDay()],
        total: dayRecords.length,
        correct,
        incorrect: dayRecords.length - correct,
        accuracy: dayRecords.length > 0 ? ((correct / dayRecords.length) * 100).toFixed(1) : 0,
        avgTime: dayRecords.length > 0 ? Math.round(dayRecords.reduce((sum, r) => sum + (r.timeSpent || 0), 0) / dayRecords.length) : 0
      });
    }
  }

  res.json({ studentId, type, trends });
});

// 학생 랭킹
app.get('/api/dashboard/ranking', (req, res) => {
  const { period = 'all' } = req.query;

  console.log(`🏆 랭킹 조회 요청 (period: ${period})`);
  console.log(`📊 학습 이력 보유 학생 수: ${learningHistory.size}`);

  const rankings = [];

  // 모든 학생의 데이터 수집
  for (const [studentId, history] of learningHistory.entries()) {
    console.log(`  - ${studentId}: ${history.length}개 문제`);
    if (history.length === 0) continue;

    // 기간별 필터링
    let filteredHistory = history;
    if (period === 'week') {
      filteredHistory = history.filter(r => isThisWeek(new Date(r.timestamp)));
    } else if (period === 'month') {
      filteredHistory = history.filter(r => isThisMonth(new Date(r.timestamp)));
    }

    if (filteredHistory.length === 0) continue;

    const totalQuestions = filteredHistory.length;
    const correctAnswers = filteredHistory.filter(h => h.correct).length;
    const accuracy = (correctAnswers / totalQuestions) * 100;
    const totalTime = filteredHistory.reduce((sum, h) => sum + (h.timeSpent || 0), 0);
    const avgTime = totalTime / totalQuestions;
    const streak = calculateStreak(history);

    // 종합 점수 계산 (정답률 70% + 문제수 20% + 연속일 10%)
    const score = (accuracy * 0.7) + (Math.min(totalQuestions / 100, 1) * 100 * 0.2) + (Math.min(streak / 30, 1) * 100 * 0.1);

    rankings.push({
      studentId,
      studentName: studentId.replace('student', '학생 '),
      totalQuestions,
      correctAnswers,
      accuracy: accuracy.toFixed(1),
      avgTime: Math.round(avgTime),
      streak,
      score: Math.round(score)
    });
  }

  // 종합 점수로 정렬
  rankings.sort((a, b) => b.score - a.score);

  // 랭킹 번호 추가
  rankings.forEach((rank, index) => {
    rank.rank = index + 1;
  });

  console.log(`✅ 랭킹 ${rankings.length}개 생성 완료:`, rankings.map(r => `${r.studentName}(${r.score}점)`).join(', '));

  res.json({
    period,
    rankings,
    total: rankings.length
  });
});

// 헬스 체크
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'N-View Server is running',
    students: sessions.size,
    learningRecords: Array.from(learningHistory.values()).reduce((sum, h) => sum + h.length, 0)
  });
});

// 유틸리티 함수들
function isToday(date) {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

function isThisWeek(date) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay()); // 이번 주 일요일
  weekStart.setHours(0, 0, 0, 0);
  return date >= weekStart;
}

function isThisMonth(date) {
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function calculateStreak(history) {
  if (history.length === 0) return 0;

  const dates = [...new Set(history.map(h => new Date(h.timestamp).toDateString()))].sort();
  let streak = 1;
  let currentStreak = 1;

  for (let i = dates.length - 1; i > 0; i--) {
    const current = new Date(dates[i]);
    const previous = new Date(dates[i - 1]);
    const diffDays = Math.floor((current - previous) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      currentStreak++;
      streak = Math.max(streak, currentStreak);
    } else {
      break;
    }
  }

  return currentStreak;
}

// 오늘의 문제 저장소 (학생별 5문제)
const dailyQuestions = new Map(); // studentId -> {date, questions: [...]}
const dailyAnswers = new Map(); // studentId -> [{questionIndex, answer, correct, timestamp}, ...]

// 오늘 날짜 확인 함수
function isToday(date) {
  const today = new Date();
  const checkDate = new Date(date);
  return today.getFullYear() === checkDate.getFullYear() &&
         today.getMonth() === checkDate.getMonth() &&
         today.getDate() === checkDate.getDate();
}

// 오늘의 5문제 자동 생성 및 전송
app.post('/api/generate-daily-questions', async (req, res) => {
  try {
    const { studentId, difficulty = 'medium', game_type = 'bingo' } = req.body;

    if (!studentId) {
      return res.status(400).json({ error: '학생 ID가 필요합니다' });
    }

    // 이미 오늘 문제가 생성되었는지 확인
    const existing = dailyQuestions.get(studentId);
    if (existing && isToday(existing.date)) {
      console.log(`${studentId}: 오늘 이미 문제가 생성됨`);
      return res.json({
        success: true,
        studentId,
        questions: existing.questions,
        totalQuestions: existing.questions.length,
        alreadyGenerated: true
      });
    }

    const questionTypes = ['addition', 'subtraction', 'multiplication', 'division'];
    const generatedQuestions = [];

    // 5문제 생성
    for (let i = 0; i < 5; i++) {
      const type = questionTypes[i % questionTypes.length]; // 순환하며 유형 선택

      try {
        // AI로 문제 생성 시도
        const diffText = difficulty === 'easy' ? '쉬운' : difficulty === 'hard' ? '어려운' : '중간';
        const typeText = type === 'addition' ? '덧셈' : type === 'subtraction' ? '뺄셈' :
                         type === 'multiplication' ? '곱셈' : '나눗셈';

        const prompt = `당신은 초등학교 수학 교사입니다.
${diffText} 난이도의 ${typeText} 문제를 1개 생성해주세요.

반드시 다음 JSON 형식으로만 답변하세요:
{"question": "문제내용", "answer": "정답"}

예시: {"question": "5 + 3 = ?", "answer": "8"}`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const questionData = JSON.parse(jsonMatch[0]);
          generatedQuestions.push({
            ...questionData,
            type,
            difficulty,
            questionIndex: i
          });
        } else {
          throw new Error('JSON 형식을 찾을 수 없습니다');
        }
      } catch (error) {
        // Fallback 문제 (난이도별)
        const fallbackQuestions = {
          easy: {
            addition: [
              { question: "1 + 2 = ?", answer: "3" },
              { question: "2 + 3 = ?", answer: "5" },
              { question: "3 + 4 = ?", answer: "7" },
              { question: "4 + 5 = ?", answer: "9" },
              { question: "5 + 3 = ?", answer: "8" }
            ],
            subtraction: [
              { question: "5 - 2 = ?", answer: "3" },
              { question: "7 - 3 = ?", answer: "4" },
              { question: "9 - 4 = ?", answer: "5" },
              { question: "8 - 3 = ?", answer: "5" },
              { question: "10 - 6 = ?", answer: "4" }
            ],
            multiplication: [
              { question: "2 × 3 = ?", answer: "6" },
              { question: "3 × 3 = ?", answer: "9" },
              { question: "2 × 4 = ?", answer: "8" },
              { question: "2 × 5 = ?", answer: "10" },
              { question: "3 × 4 = ?", answer: "12" }
            ],
            division: [
              { question: "6 ÷ 2 = ?", answer: "3" },
              { question: "8 ÷ 2 = ?", answer: "4" },
              { question: "9 ÷ 3 = ?", answer: "3" },
              { question: "10 ÷ 2 = ?", answer: "5" },
              { question: "12 ÷ 3 = ?", answer: "4" }
            ]
          },
          medium: {
            addition: [
              { question: "12 + 15 = ?", answer: "27" },
              { question: "23 + 18 = ?", answer: "41" },
              { question: "34 + 27 = ?", answer: "61" },
              { question: "45 + 36 = ?", answer: "81" },
              { question: "28 + 35 = ?", answer: "63" }
            ],
            subtraction: [
              { question: "25 - 13 = ?", answer: "12" },
              { question: "42 - 18 = ?", answer: "24" },
              { question: "56 - 27 = ?", answer: "29" },
              { question: "73 - 35 = ?", answer: "38" },
              { question: "64 - 28 = ?", answer: "36" }
            ],
            multiplication: [
              { question: "7 × 8 = ?", answer: "56" },
              { question: "6 × 9 = ?", answer: "54" },
              { question: "8 × 7 = ?", answer: "56" },
              { question: "9 × 6 = ?", answer: "54" },
              { question: "7 × 9 = ?", answer: "63" }
            ],
            division: [
              { question: "36 ÷ 6 = ?", answer: "6" },
              { question: "48 ÷ 8 = ?", answer: "6" },
              { question: "54 ÷ 9 = ?", answer: "6" },
              { question: "42 ÷ 7 = ?", answer: "6" },
              { question: "63 ÷ 9 = ?", answer: "7" }
            ]
          },
          hard: {
            addition: [
              { question: "127 + 385 = ?", answer: "512" },
              { question: "256 + 478 = ?", answer: "734" },
              { question: "345 + 567 = ?", answer: "912" },
              { question: "489 + 623 = ?", answer: "1112" },
              { question: "756 + 384 = ?", answer: "1140" }
            ],
            subtraction: [
              { question: "523 - 278 = ?", answer: "245" },
              { question: "634 - 387 = ?", answer: "247" },
              { question: "825 - 467 = ?", answer: "358" },
              { question: "912 - 576 = ?", answer: "336" },
              { question: "745 - 389 = ?", answer: "356" }
            ],
            multiplication: [
              { question: "15 × 12 = ?", answer: "180" },
              { question: "23 × 14 = ?", answer: "322" },
              { question: "18 × 16 = ?", answer: "288" },
              { question: "25 × 13 = ?", answer: "325" },
              { question: "19 × 17 = ?", answer: "323" }
            ],
            division: [
              { question: "144 ÷ 12 = ?", answer: "12" },
              { question: "156 ÷ 13 = ?", answer: "12" },
              { question: "168 ÷ 14 = ?", answer: "12" },
              { question: "180 ÷ 15 = ?", answer: "12" },
              { question: "192 ÷ 16 = ?", answer: "12" }
            ]
          }
        };

        const difficultyLevel = fallbackQuestions[difficulty] || fallbackQuestions.medium;
        const typeQuestions = difficultyLevel[type] || difficultyLevel.addition;
        const fallbackQuestion = typeQuestions[i % typeQuestions.length];

        generatedQuestions.push({
          ...fallbackQuestion,
          type,
          difficulty,
          questionIndex: i
        });
      }
    }

    // 학생별로 오늘의 문제 저장 (날짜 포함)
    dailyQuestions.set(studentId, {
      date: new Date(),
      questions: generatedQuestions
    });
    dailyAnswers.set(studentId, []); // 답안 초기화

    res.json({
      success: true,
      studentId,
      questions: generatedQuestions,
      totalQuestions: generatedQuestions.length
    });

  } catch (error) {
    console.error('오늘의 문제 생성 오류:', error);
    res.status(500).json({ error: error.message });
  }
});

// 오늘의 문제 조회
app.get('/api/daily-questions/:studentId', (req, res) => {
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
app.post('/api/submit-daily-answer', (req, res) => {
  const { studentId, questionIndex, answer, timeSpent } = req.body;

  if (!studentId || questionIndex === undefined) {
    return res.status(400).json({ success: false, message: '필수 정보가 없습니다' });
  }

  const dailyData = dailyQuestions.get(studentId);
  if (!dailyData || !dailyData.questions || !dailyData.questions[questionIndex]) {
    return res.status(400).json({ success: false, message: '문제를 찾을 수 없습니다' });
  }

  const question = dailyData.questions[questionIndex];
  const correct = String(answer).trim().toLowerCase() === String(question.answer).trim().toLowerCase();

  // 답안 저장
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

  console.log(`📝 ${studentId} 오늘의 문제 ${questionIndex + 1} 제출:`, {
    question: question.question,
    type: question.type,
    difficulty: question.difficulty,
    correct
  });

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

  res.json({
    success: true,
    correct,
    correctAnswer: question.answer,
    questionIndex,
    totalAnswered: dailyAnswers.get(studentId).length,
    totalQuestions: dailyData.questions.length
  });
});

app.listen(port, () => {
  console.log(`✅ Gemini API 초기화 완료`);
  console.log(`🚀 서버가 http://localhost:${port} 에서 실행 중입니다`);
  console.log(`📚 N-View 지원: 여러 학생 동시 관리 가능`);
  console.log(`🎯 AI 맞춤형 학습 분석 시스템 활성화`);
});
