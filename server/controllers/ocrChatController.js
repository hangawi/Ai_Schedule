const { GoogleGenerativeAI } = require('@google/generative-ai');
const { generateOcrChatPrompt } = require('../prompts/ocrChatFilter');

// Gemini AI 초기화
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * 필터링 조건 적용 함수
 * @param {Array} schedules - 현재까지 선택된 스케줄 (누적)
 * @param {Object} condition - 적용할 조건
 * @param {Array} allSchedules - 전체 스케줄 (원본)
 */
function applyCondition(schedules, condition, allSchedules) {
  const { type } = condition;

  // 선택 조건들: allSchedules에서 찾아서 schedules에 추가
  const isSelectionCondition = ['imageIndex', 'titleMatch', 'timeRange'].includes(type);

  // 필터링 조건들: schedules를 필터링
  const isFilterCondition = ['dayMatch', 'daySpecificTimeLimit', 'removeOverlaps'].includes(type);

  switch (type) {
    case 'imageIndex':
      // 특정 이미지의 스케줄 선택 (추가)
      if (condition.mode === 'all') {
        const imageSchedules = allSchedules.filter(s => s.sourceImageIndex === condition.value);
        console.log(`  → imageIndex ${condition.value} 전체: ${imageSchedules.length}개`);
        return [...new Set([...schedules, ...imageSchedules])]; // 중복 제거하며 합침
      }
      return schedules;

    case 'titleMatch':
      // 제목 키워드 매칭 (추가)
      const { keywords, matchAll, imageIndex } = condition;

      console.log(`  🔍 titleMatch: [${keywords?.join(', ')}], 검색 대상=${allSchedules.length}개`);

      let filtered = allSchedules.filter(s => {
        // imageIndex 지정된 경우 해당 이미지만
        if (imageIndex !== undefined && s.sourceImageIndex !== imageIndex) {
          return false;
        }

        // 키워드 매칭
        const titleLower = (s.title || '').toLowerCase();
        const instructorLower = (s.instructor || '').toLowerCase();

        let match = false;
        if (matchAll) {
          // 모든 키워드 포함
          match = keywords.every(kw =>
            titleLower.includes(kw.toLowerCase()) ||
            instructorLower.includes(kw.toLowerCase())
          );
        } else {
          // 하나라도 포함
          match = keywords.some(kw =>
            titleLower.includes(kw.toLowerCase()) ||
            instructorLower.includes(kw.toLowerCase())
          );
        }

        if (match) {
          console.log(`    ✓ "${s.title}" (강사: ${s.instructor || '없음'})`);
        }

        return match;
      });

      // 매칭 실패시 샘플 출력
      if (filtered.length === 0 && allSchedules.length > 0) {
        console.log(`  ⚠️ 매칭 없음! 전체 제목 샘플:`);
        const uniqueTitles = [...new Set(allSchedules.map(s => s.title))].slice(0, 15);
        console.log(`    제목들: ${uniqueTitles.join(', ')}`);
      }

      console.log(`  → titleMatch [${keywords?.join(', ')}]: ${filtered.length}개`);
      return [...new Set([...schedules, ...filtered])]; // 중복 제거하며 합침

    case 'timeRange':
      // 시간대 필터링
      // applyTo가 있으면 해당 과목만 필터링, 나머지는 그대로 유지
      if (condition.applyTo) {
        const applyToLower = condition.applyTo.toLowerCase();

        console.log(`  📌 applyTo 모드: "${condition.applyTo}" 키워드 포함된 것만 시간 필터 적용`);

        // 대상과 비대상 분리
        const targetSchedules = schedules.filter(s => {
          const titleLower = (s.title || '').toLowerCase();
          const matches = titleLower.includes(applyToLower);
          if (matches) {
            console.log(`    ✓ 대상: ${s.title} (${s.startTime}-${s.endTime})`);
          }
          return matches;
        });
        const otherSchedules = schedules.filter(s => {
          const titleLower = (s.title || '').toLowerCase();
          return !titleLower.includes(applyToLower);
        });

        console.log(`  📊 대상: ${targetSchedules.length}개, 비대상: ${otherSchedules.length}개`);

        // 대상에만 시간 조건 적용
        const filteredTargets = targetSchedules.filter(s => {
          if (condition.imageIndex !== undefined && s.sourceImageIndex !== condition.imageIndex) {
            console.log(`    ✗ 제외 (imageIndex): ${s.title}`);
            return false;
          }
          if (condition.startAfter && s.startTime < condition.startAfter) {
            console.log(`    ✗ 제외 (시간): ${s.title} ${s.startTime} < ${condition.startAfter}`);
            return false;
          }
          if (condition.endBefore && s.startTime >= condition.endBefore) {
            console.log(`    ✗ 제외 (시간): ${s.title} ${s.startTime} >= ${condition.endBefore}`);
            return false;
          }
          console.log(`    ✓ 통과: ${s.title} (${s.startTime}-${s.endTime})`);
          return true;
        });

        console.log(`  → timeRange [${condition.applyTo}만] (${condition.startAfter || 'start'} ~ ${condition.endBefore || 'end'}): ${filteredTargets.length}개 (원본 ${targetSchedules.length}개)`);
        console.log(`  🎯 최종 반환: ${otherSchedules.length}개(비대상) + ${filteredTargets.length}개(필터된 대상) = ${otherSchedules.length + filteredTargets.length}개`);
        return [...otherSchedules, ...filteredTargets];
      } else {
        // applyTo 없으면 기존 selection 방식
        let timeFiltered = allSchedules.filter(s => {
          if (condition.imageIndex !== undefined && s.sourceImageIndex !== condition.imageIndex) {
            return false;
          }
          if (condition.startAfter && s.startTime < condition.startAfter) return false;
          if (condition.endBefore && s.startTime >= condition.endBefore) return false;
          return true;
        });
        console.log(`  → timeRange (${condition.startAfter || 'start'} ~ ${condition.endBefore || 'end'}): ${timeFiltered.length}개`);
        return [...new Set([...schedules, ...timeFiltered])]; // 중복 제거하며 합침
      }

    case 'dayMatch':
      // 요일 필터링
      return schedules.filter(s => {
        if (!s.days || !Array.isArray(s.days)) return false;
        return s.days.some(day => condition.days.includes(day));
      });

    case 'daySpecificTimeLimit':
      // 특정 요일에만 시간 제한 적용
      const { day, endBefore, imageIndex: imgIdx } = condition;

      return schedules.filter(s => {
        // imageIndex 지정된 경우 해당 이미지만 필터링
        if (imgIdx !== undefined && s.sourceImageIndex !== imgIdx) {
          return true; // 다른 이미지는 그대로 통과
        }

        // 해당 요일이 포함된 수업만 제한
        if (s.days && Array.isArray(s.days) && s.days.includes(day)) {
          // 해당 요일에 포함된 수업: endBefore 시간 전까지만
          return s.startTime < endBefore;
        }

        // 해당 요일이 아닌 수업은 그대로 통과
        return true;
      });

    case 'removeOverlaps':
      // 겹치는 시간대의 수업 완전 삭제
      // 시간이 겹치는 스케줄을 찾아서 하나는 남기고 겹친 것은 전부 삭제
      const keptSchedules = [];
      const deletedTitles = new Set(); // 삭제된 수업 이름 저장

      schedules.forEach((schedule, idx) => {
        if (!schedule.days || !Array.isArray(schedule.days)) {
          keptSchedules.push(schedule);
          return;
        }

        // 이미 삭제 대상으로 표시된 수업은 스킵
        if (deletedTitles.has(schedule.title)) {
          console.log(`  → 이미 삭제 대상: ${schedule.title}`);
          return;
        }

        let hasOverlap = false;

        // 이미 추가된 스케줄들과 겹치는지 확인
        for (const kept of keptSchedules) {
          if (!kept.days || !Array.isArray(kept.days)) continue;

          // 같은 요일이 있는지 확인
          const commonDays = schedule.days.filter(day => kept.days.includes(day));

          if (commonDays.length > 0) {
            // 시간이 겹치는지 확인 (start < other.end && end > other.start)
            const overlaps = schedule.startTime < kept.endTime && schedule.endTime > kept.startTime;

            if (overlaps) {
              hasOverlap = true;
              deletedTitles.add(schedule.title); // 이 수업 이름 전부 삭제 대상
              console.log(`  → 겹침 발견 및 "${schedule.title}" 전체 삭제 대상 등록: ${commonDays.join(',')} ${schedule.startTime}-${schedule.endTime} ⚔️ ${kept.title}`);
              break;
            }
          }
        }

        if (!hasOverlap) {
          keptSchedules.push(schedule);
        }
      });

      // 삭제 대상 title을 가진 스케줄 전부 제거
      const finalSchedules = keptSchedules.filter(s => !deletedTitles.has(s.title));

      console.log(`  → removeOverlaps: ${schedules.length}개 → ${finalSchedules.length}개`);
      console.log(`  → 삭제된 수업: ${Array.from(deletedTitles).join(', ')}`);
      return finalSchedules;

    default:
      console.warn('⚠️ 알 수 없는 조건 타입:', type);
      return schedules;
  }
}

/**
 * OCR 결과를 채팅 메시지로 필터링
 * POST /api/ocr-chat/filter
 */
exports.filterSchedulesByChat = async (req, res) => {
  try {
    const { chatMessage, extractedSchedules, schedulesByImage, imageDescription, baseSchedules } = req.body;

    console.log('📩 OCR 채팅 필터링 요청:', chatMessage);
    console.log('📊 추출된 스케줄 개수:', extractedSchedules?.length || 0);
    console.log('📸 이미지별 스케줄:', schedulesByImage?.length || 0, '개 이미지');
    console.log('📚 기본 베이스 스케줄:', baseSchedules?.length || 0, '개');

    // 입력 검증
    if (!chatMessage || !chatMessage.trim()) {
      return res.status(400).json({
        success: false,
        error: '채팅 메시지가 필요합니다.'
      });
    }

    if (!extractedSchedules || !Array.isArray(extractedSchedules) || extractedSchedules.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'OCR 추출 결과가 필요합니다.'
      });
    }

    // 디버깅: 추출된 스케줄의 제목들 확인
    const uniqueTitles = [...new Set(extractedSchedules.map(s => s.title))];
    console.log('📚 추출된 스케줄 제목들:', uniqueTitles.join(', '));

    // 프롬프트 생성
    const prompt = generateOcrChatPrompt(chatMessage, extractedSchedules, schedulesByImage, imageDescription);

    // Gemini AI 호출 (여러 모델 시도)
    const modelNames = [
      'gemini-2.0-flash-exp',
      'gemini-2.0-flash',
      'gemini-1.5-flash-002',
      'gemini-1.5-flash'
    ];

    let aiResponse = null;
    let lastError = null;

    for (const modelName of modelNames) {
      try {
        console.log(`🤖 ${modelName} 모델로 시도 중...`);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0.1
          }
        });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        aiResponse = response.text();
        console.log(`✅ ${modelName} 모델 성공!`);
        break;
      } catch (error) {
        console.log(`❌ ${modelName} 실패: ${error.message}`);
        lastError = error;
        continue;
      }
    }

    if (!aiResponse) {
      throw lastError || new Error('모든 모델 시도 실패');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🤖 RAW AI RESPONSE:');
    console.log(aiResponse);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // JSON 파싱
    let parsed = null;

    try {
      // 1. ```json ... ``` 형식
      const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
      } else {
        // 2. ``` ... ``` 형식
        const codeMatch = aiResponse.match(/```\s*([\s\S]*?)\s*```/);
        if (codeMatch) {
          parsed = JSON.parse(codeMatch[1]);
        } else {
          // 3. 직접 JSON
          parsed = JSON.parse(aiResponse);
        }
      }
    } catch (parseError) {
      console.error('❌ JSON 파싱 실패:', parseError);
      console.log('원본 응답:', aiResponse);

      return res.status(500).json({
        success: false,
        error: 'AI 응답 파싱 실패',
        details: parseError.message
      });
    }

    // explanation에서 JSON 제거 (안전장치)
    if (parsed.explanation && typeof parsed.explanation === 'string') {
      let cleanExplanation = parsed.explanation;
      cleanExplanation = cleanExplanation.replace(/```json\s*[\s\S]*?\s*```/g, '');
      cleanExplanation = cleanExplanation.replace(/```\s*[\s\S]*?\s*```/g, '');
      cleanExplanation = cleanExplanation.replace(/\{[\s\S]*?"understood"[\s\S]*?\}/g, '');
      cleanExplanation = cleanExplanation.replace(/\{[\s\S]*?"action"[\s\S]*?\}/g, '');
      cleanExplanation = cleanExplanation.replace(/\n{3,}/g, '\n\n').trim();

      if (!cleanExplanation || cleanExplanation.length < 5) {
        cleanExplanation = parsed.understood || '처리했습니다.';
      }

      parsed.explanation = cleanExplanation;
    }

    // 조건 기반 필터링 실행
    if (parsed.action === 'filter') {
      if (!parsed.conditions || !Array.isArray(parsed.conditions)) {
        console.error('❌ AI가 조건을 반환하지 않음:', parsed);
        parsed.action = 'question';
        parsed.filteredSchedules = [];
        parsed.explanation = '필터링 조건을 이해하지 못했습니다. 다시 시도해주세요.';
      } else {
        console.log('🔍 AI가 반환한 조건:', JSON.stringify(parsed.conditions, null, 2));

        // 조건에 따라 실제 필터링 수행
        // 선택 조건(imageIndex, titleMatch, timeRange)이 있으면 빈 배열에서 시작
        // 필터링 조건(removeOverlaps, daySpecificTimeLimit)만 있으면 전체에서 시작
        const selectionConditions = ['imageIndex', 'titleMatch', 'timeRange'];
        const hasSelectionCondition = parsed.conditions.some(c => selectionConditions.includes(c.type));

        let filteredSchedules = hasSelectionCondition ? [] : extractedSchedules;
        console.log(`🔄 초기 스케줄: ${filteredSchedules.length}개 (${hasSelectionCondition ? '선택 모드' : '필터링 모드'})`);

        for (const condition of parsed.conditions) {
          console.log(`\n🔄 조건 적용 중: ${condition.type}`, JSON.stringify(condition));
          console.log(`  이전 스케줄: ${filteredSchedules.length}개`);
          filteredSchedules = applyCondition(filteredSchedules, condition, extractedSchedules);
          console.log(`  적용 후: ${filteredSchedules.length}개`);
        }

        console.log(`\n✅ 필터링 완료: ${extractedSchedules.length} → ${filteredSchedules.length}개`);

        // 기본 베이스 스케줄 자동 추가 (학교 시간표 등)
        // 기본적으로 항상 추가 (학교는 기본으로 포함되어야 함)
        const shouldIncludeBase = baseSchedules && Array.isArray(baseSchedules) && baseSchedules.length > 0;

        if (shouldIncludeBase) {
          console.log('📚 baseSchedules 샘플:', baseSchedules.slice(0, 3).map(s => ({
            title: s.title,
            days: s.days,
            sourceImageIndex: s.sourceImageIndex,
            startTime: s.startTime
          })));

          // 한글 요일을 영어 코드로 변환
          const dayMap = {
            '월': 'MON', '화': 'TUE', '수': 'WED', '목': 'THU',
            '금': 'FRI', '토': 'SAT', '일': 'SUN'
          };

          const baseIds = new Set(baseSchedules.map(s => `${s.title}-${s.startTime}-${s.days?.join(',')}`));
          const filteredIds = new Set(filteredSchedules.map(s => `${s.title}-${s.startTime}-${s.days?.join(',')}`));

          // 기본 베이스 중에서 아직 포함되지 않은 것만 추가
          baseSchedules.forEach(baseSchedule => {
            const id = `${baseSchedule.title}-${baseSchedule.startTime}-${baseSchedule.days?.join(',')}`;
            if (!filteredIds.has(id)) {
              // days를 영어 코드로 변환
              const convertedDays = baseSchedule.days?.map(day => dayMap[day] || day) || [];
              filteredSchedules.push({
                ...baseSchedule,
                days: convertedDays
              });
            }
          });

          console.log(`📚 기본 베이스 포함 완료: 총 ${filteredSchedules.length}개 (기본 ${baseSchedules.length}개 포함)`);
          console.log('📚 최종 filteredSchedules 샘플 (변환 후):', filteredSchedules.slice(-3).map(s => ({
            title: s.title,
            days: s.days,
            sourceImageIndex: s.sourceImageIndex
          })));
        }

        parsed.filteredSchedules = filteredSchedules;
      }
    }

    res.json({
      success: true,
      understood: parsed.understood,
      action: parsed.action,
      filteredSchedules: parsed.filteredSchedules || [],
      explanation: parsed.explanation
    });

  } catch (error) {
    console.error('❌ OCR 채팅 필터링 에러:', error);
    res.status(500).json({
      success: false,
      error: 'OCR 채팅 필터링 실패',
      details: error.message
    });
  }
};
