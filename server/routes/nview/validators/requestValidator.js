/**
 * 요청 파라미터 검증 함수
 */

/**
 * 학생 ID 검증
 */
function validateStudentId(studentId) {
  if (!studentId) {
    return { valid: false, message: '학생 ID가 필요합니다' };
  }
  return { valid: true };
}

/**
 * 문제 생성 파라미터 검증
 */
function validateQuestionParams(params) {
  const { difficulty, type, game_type } = params;

  if (!game_type) {
    return { valid: false, message: '게임 타입이 필요합니다' };
  }

  return { valid: true };
}

/**
 * 답안 제출 파라미터 검증
 */
function validateAnswerParams(params) {
  const { studentId, answer } = params;

  if (!studentId) {
    return { valid: false, message: '학생 ID가 필요합니다' };
  }

  if (answer === undefined || answer === null) {
    return { valid: false, message: '답안이 필요합니다' };
  }

  return { valid: true };
}

/**
 * 학생이 문제를 받았는지 확인
 */
function validateStudentHasQuestion(studentId, questionsMap) {
  if (!questionsMap.has(studentId)) {
    return { valid: false, message: '문제가 없습니다' };
  }
  return { valid: true };
}

/**
 * 일일 문제 답안 파라미터 검증
 */
function validateDailyAnswerParams(params) {
  const { studentId, questionIndex, answer } = params;

  if (!studentId || questionIndex === undefined) {
    return { valid: false, message: '필수 정보가 없습니다' };
  }

  return { valid: true };
}

/**
 * 일일 문제 존재 확인
 */
function validateDailyQuestion(studentId, questionIndex, dailyQuestionsMap) {
  const dailyData = dailyQuestionsMap.get(studentId);

  if (!dailyData || !dailyData.questions || !dailyData.questions[questionIndex]) {
    return { valid: false, message: '문제를 찾을 수 없습니다' };
  }

  return { valid: true, question: dailyData.questions[questionIndex] };
}

module.exports = {
  validateStudentId,
  validateQuestionParams,
  validateAnswerParams,
  validateStudentHasQuestion,
  validateDailyAnswerParams,
  validateDailyQuestion
};
