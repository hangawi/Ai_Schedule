/**
 * AI 응답에서 JSON 파싱 (여러 형식 지원)
 */
function parseAIJSON(aiResponse) {
  let cleanResponse = aiResponse.trim();

  // 1. ```json ... ``` 형식
  const jsonMatch = cleanResponse.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[1].trim());
  }

  // 2. ``` ... ``` 형식
  const codeMatch = cleanResponse.match(/```\s*([\s\S]*?)\s*```/);
  if (codeMatch) {
    return JSON.parse(codeMatch[1].trim());
  }

  // 3. 시작 부분에 백틱이 있으면 제거
  if (cleanResponse.startsWith('```')) {
    cleanResponse = cleanResponse.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
    return JSON.parse(cleanResponse.trim());
  }

  // 4. 직접 JSON
  return JSON.parse(cleanResponse);
}

/**
 * explanation 필드에서 JSON 제거
 */
function cleanExplanation(explanation) {
  if (!explanation || typeof explanation !== 'string') {
    return explanation;
  }

  let cleaned = explanation;

  // JSON 블록 제거
  cleaned = cleaned.replace(/```json\s*[\s\S]*?\s*```/g, '');
  cleaned = cleaned.replace(/```\s*[\s\S]*?\s*```/g, '');

  // 단독 JSON 객체 제거
  cleaned = cleaned.replace(/\{[\s\S]*?"understood"[\s\S]*?\}/g, '');
  cleaned = cleaned.replace(/\{[\s\S]*?"action"[\s\S]*?\}/g, '');
  cleaned = cleaned.replace(/\{[\s\S]*?"schedule"[\s\S]*?\}/g, '');

  // JSON 필드 라인 제거
  cleaned = cleaned.replace(/"(understood|action|schedule|explanation)":\s*[^\n]*/g, '');

  // 여러 줄 공백 정리
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  // 빈 문자열이 되면 기본 메시지
  if (!cleaned || cleaned.length < 5) {
    return '처리했습니다.';
  }

  return cleaned;
}

module.exports = {
  parseAIJSON,
  cleanExplanation
};
