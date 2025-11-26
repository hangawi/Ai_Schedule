/**
 * Fallback 문제 데이터
 * AI 문제 생성 실패 시 사용되는 기본 문제들
 */

// Bingo 게임용 Fallback 문제 (난이도별 × 유형별)
const BINGO_FALLBACK = {
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

// Voca 게임용 Fallback 문제
const VOCA_FALLBACK = [
  { question: "다음 단어의 뜻은? '기쁘다'", answer: "즐겁고 흐뭇한 느낌이다" },
  { question: "What does 'happy' mean?", answer: "기쁜, 행복한" }
];

// WhoAmI 게임용 Fallback 문제
const WHOAMI_FALLBACK = [
  { question: "나는 누구일까요? 힌트: 목이 길고 점무늬가 있어요", answer: "기린" },
  { question: "나는 누구일까요? 힌트: 한국의 위대한 과학자, 거북선을 만들었어요", answer: "이순신" },
  { question: "나는 무엇일까요? 힌트: 시간을 알려주고, 손목에 차요", answer: "시계" }
];

/**
 * 게임 타입과 난이도에 맞는 Fallback 문제 반환
 */
function getFallbackQuestion(game_type, difficulty, type, index = null) {
  if (game_type === 'voca') {
    return VOCA_FALLBACK[Math.floor(Math.random() * VOCA_FALLBACK.length)];
  }

  if (game_type === 'whoami') {
    return WHOAMI_FALLBACK[Math.floor(Math.random() * WHOAMI_FALLBACK.length)];
  }

  // Bingo
  const difficultyLevel = BINGO_FALLBACK[difficulty] || BINGO_FALLBACK.medium;
  const typeQuestions = difficultyLevel[type] || difficultyLevel.addition;

  if (index !== null) {
    return typeQuestions[index % typeQuestions.length];
  }

  return typeQuestions[Math.floor(Math.random() * typeQuestions.length)];
}

module.exports = {
  BINGO_FALLBACK,
  VOCA_FALLBACK,
  WHOAMI_FALLBACK,
  getFallbackQuestion
};
