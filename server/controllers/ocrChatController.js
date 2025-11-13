const { GoogleGenerativeAI } = require('@google/generative-ai');
const { generateOcrChatPrompt } = require('../prompts/ocrChatFilter');
const { generateConversationalPrompt, addToHistory, updateUserProfile } = require('../prompts/conversationalScheduleRecommender');

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
        return [...new Set([...schedules, ...imageSchedules])]; // 중복 제거하며 합침
      }
      return schedules;

    case 'titleMatch':
      // 제목 키워드 매칭 (추가)
      const { keywords, matchAll, imageIndex } = condition;

      let matchCount = 0;
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
          match = keywords.some(kw => {
            const kwLower = kw.toLowerCase();
            const titleMatch = titleLower.includes(kwLower);
            const instructorMatch = instructorLower.includes(kwLower);

            return titleMatch || instructorMatch;
          });
        }

        if (match) {
          matchCount++;
        }

        return match;
      });

      // 매칭 실패시 샘플 출력
      if (filtered.length === 0 && allSchedules.length > 0) {
        const uniqueTitles = [...new Set(allSchedules.map(s => s.title))].slice(0, 15);
      }
      return [...new Set([...schedules, ...filtered])]; // 중복 제거하며 합침

    case 'timeRange':
      // 시간대 필터링
      // applyToKeywords가 있으면 해당 키워드 포함된 것만 필터링
      if (condition.applyToKeywords && Array.isArray(condition.applyToKeywords)) {
        // 대상과 비대상 분리
        const targetSchedules = schedules.filter(s => {
          const titleLower = (s.title || '').toLowerCase();
          const instructorLower = (s.instructor || '').toLowerCase();

          const matches = condition.applyToKeywords.some(kw => {
            const kwLower = kw.toLowerCase();
            return titleLower.includes(kwLower) || instructorLower.includes(kwLower);
          });
          return matches;
        });
        const otherSchedules = schedules.filter(s => {
          const titleLower = (s.title || '').toLowerCase();
          const instructorLower = (s.instructor || '').toLowerCase();

          const matches = condition.applyToKeywords.some(kw => {
            const kwLower = kw.toLowerCase();
            return titleLower.includes(kwLower) || instructorLower.includes(kwLower);
          });

          return !matches;
        });

        // 대상에만 시간 조건 적용
        const filteredTargets = targetSchedules.filter(s => {
          if (condition.startAfter && s.startTime < condition.startAfter) {
            return false;
          }
          if (condition.endBefore && s.startTime >= condition.endBefore) {
            return false;
          }
          return true;
        });

        return [...otherSchedules, ...filteredTargets];
      } else if (condition.applyTo) {
        const applyToLower = condition.applyTo.toLowerCase();


        // 대상과 비대상 분리
        const targetSchedules = schedules.filter(s => {
          const titleLower = (s.title || '').toLowerCase();
          const matches = titleLower.includes(applyToLower);
          return matches;
        });
        const otherSchedules = schedules.filter(s => {
          const titleLower = (s.title || '').toLowerCase();
          return !titleLower.includes(applyToLower);
        });

        // 대상에만 시간 조건 적용
        const filteredTargets = targetSchedules.filter(s => {
          if (condition.imageIndex !== undefined && s.sourceImageIndex !== condition.imageIndex) {
            return false;
          }
          if (condition.startAfter && s.startTime < condition.startAfter) {
            return false;
          }
          if (condition.endBefore && s.startTime >= condition.endBefore) {
            return false;
          }
          return true;
        });
        return [...otherSchedules, ...filteredTargets];
      } else if (condition.imageIndex !== undefined) {
        // imageIndex가 있으면 해당 이미지만 필터링 (filter 모드)
        const targetSchedules = schedules.filter(s => s.sourceImageIndex === condition.imageIndex);
        const otherSchedules = schedules.filter(s => s.sourceImageIndex !== condition.imageIndex);

        const filteredTargets = targetSchedules.filter(s => {
          if (condition.startAfter && s.startTime < condition.startAfter) return false;
          if (condition.endBefore && s.startTime >= condition.endBefore) return false;
          return true;
        });
        return [...otherSchedules, ...filteredTargets];
      } else {
        // imageIndex도 applyTo도 없으면 selection 방식
        let timeFiltered = allSchedules.filter(s => {
          if (condition.startAfter && s.startTime < condition.startAfter) return false;
          if (condition.endBefore && s.startTime >= condition.endBefore) return false;
          return true;
        });
        return [...new Set([...schedules, ...timeFiltered])]; // 중복 제거하며 합침
      }

    case 'dayMatch':
    case 'dayFilter':
      // 요일 필터링
      // 영어/한글 요일 매핑
      const dayMap = {
        'MON': '월', 'TUE': '화', 'WED': '수', 'THU': '목', 'FRI': '금', 'SAT': '토', 'SUN': '일',
        '월': 'MON', '화': 'TUE', '수': 'WED', '목': 'THU', '금': 'FRI', '토': 'SAT', '일': 'SUN'
      };

      // 조건의 요일들을 영어/한글 모두 포함하도록 확장
      const expandedDays = new Set();
      condition.days.forEach(day => {
        expandedDays.add(day);
        if (dayMap[day]) expandedDays.add(dayMap[day]);
      });
      const expandedDaysArray = Array.from(expandedDays);

      if (condition.applyToKeywords && Array.isArray(condition.applyToKeywords)) {
        
        // 대상과 비대상 분리
        const targetSchedules = schedules.filter(s => {
          const titleLower = (s.title || '').toLowerCase();
          const instructorLower = (s.instructor || '').toLowerCase();

          const matches = condition.applyToKeywords.some(kw => {
            const kwLower = kw.toLowerCase();
            return titleLower.includes(kwLower) || instructorLower.includes(kwLower);
          });
          return matches;
        });

        const otherSchedules = schedules.filter(s => {
          const titleLower = (s.title || '').toLowerCase();
          const instructorLower = (s.instructor || '').toLowerCase();

          const matches = condition.applyToKeywords.some(kw => {
            const kwLower = kw.toLowerCase();
            return titleLower.includes(kwLower) || instructorLower.includes(kwLower);
          });

          return !matches;
        });

        // 대상에만 요일 필터 적용 (영어/한글 모두 지원)
        const filteredTargets = targetSchedules.filter(s => {
          if (!s.days || !Array.isArray(s.days)) return false;
          const hasMatchingDay = s.days.some(day => expandedDaysArray.includes(day));
          return hasMatchingDay;
        });
        return [...otherSchedules, ...filteredTargets];
      } else {
        // 전체에 요일 필터 적용 (영어/한글 모두 지원)
        return schedules.filter(s => {
          if (!s.days || !Array.isArray(s.days)) return false;
          return s.days.some(day => expandedDaysArray.includes(day));
        });
      }

    case 'floorFilter':
      // 층 필터링
      if (condition.applyToKeywords && Array.isArray(condition.applyToKeywords)) {
        
        // 대상과 비대상 분리
        const targetSchedules = schedules.filter(s => {
          const titleLower = (s.title || '').toLowerCase();
          const instructorLower = (s.instructor || '').toLowerCase();

          const matches = condition.applyToKeywords.some(kw => {
            const kwLower = kw.toLowerCase();
            return titleLower.includes(kwLower) || instructorLower.includes(kwLower);
          });
          return matches;
        });

        const otherSchedules = schedules.filter(s => {
          const titleLower = (s.title || '').toLowerCase();
          const instructorLower = (s.instructor || '').toLowerCase();

          const matches = condition.applyToKeywords.some(kw => {
            const kwLower = kw.toLowerCase();
            return titleLower.includes(kwLower) || instructorLower.includes(kwLower);
          });

          return !matches;
        });

        // 대상에만 층 필터 적용
        const filteredTargets = targetSchedules.filter(s => {
          if (!s.floor) return false;
          const hasMatchingFloor = condition.floors.some(floor => {
            const floorLower = floor.toLowerCase();
            const sFloorLower = (s.floor || '').toLowerCase();
            return sFloorLower.includes(floorLower) || floorLower.includes(sFloorLower);
          });
          return hasMatchingFloor;
        });

        return [...otherSchedules, ...filteredTargets];
      } else {
        // 전체에 층 필터 적용
        return schedules.filter(s => {
          if (!s.floor) return false;
          return condition.floors.some(floor => {
            const floorLower = floor.toLowerCase();
            const sFloorLower = (s.floor || '').toLowerCase();
            return sFloorLower.includes(floorLower) || floorLower.includes(sFloorLower);
          });
        });
      }

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
      return finalSchedules;

    default:
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

    // 프롬프트 생성
    const prompt = generateOcrChatPrompt(chatMessage, extractedSchedules, schedulesByImage, imageDescription);

    // Gemini AI 호출 (여러 모델 시도)
    const modelNames = [
      'gemini-2.0-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash-002',
      'gemini-1.5-flash'
    ];

    let aiResponse = null;
    let lastError = null;

    for (const modelName of modelNames) {
      try {
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
        break;
      } catch (error) {
        lastError = error;
        continue;
      }
    }

    if (!aiResponse) {
      throw lastError || new Error('모든 모델 시도 실패');
    }
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
    if (parsed.action === 'filter' || parsed.action === 'recommend') {
      if (!parsed.conditions || !Array.isArray(parsed.conditions)) {
        parsed.action = 'question';
        parsed.filteredSchedules = [];
        parsed.explanation = '필터링 조건을 이해하지 못했습니다. 다시 시도해주세요.';
      } else {

        // 조건에 따라 실제 필터링 수행
        // 선택 조건(imageIndex, titleMatch, timeRange)이 있으면 빈 배열에서 시작
        // 필터링 조건(removeOverlaps, daySpecificTimeLimit)만 있으면 전체에서 시작
        const selectionConditions = ['imageIndex', 'titleMatch', 'timeRange'];
        const hasSelectionCondition = parsed.conditions.some(c => selectionConditions.includes(c.type));

        let filteredSchedules = hasSelectionCondition ? [] : extractedSchedules;

        for (const condition of parsed.conditions) {
          filteredSchedules = applyCondition(filteredSchedules, condition, extractedSchedules);
        }

        // 기본 베이스 스케줄 자동 추가 (학교 시간표 등)
        // ⚠️ 단, "~만" 키워드가 있으면 baseSchedules 추가 안 함!
        const hasOnlyKeyword = chatMessage.includes('만') || chatMessage.includes('만요') || chatMessage.includes('만할');
        const shouldIncludeBase = !hasOnlyKeyword && baseSchedules && Array.isArray(baseSchedules) && baseSchedules.length > 0;


        if (shouldIncludeBase) {
          // 한글 요일을 영어 코드로 변환
          const dayMap = {
            '월': 'MON', '화': 'TUE', '수': 'WED', '목': 'THU',
            '금': 'FRI', '토': 'SAT', '일': 'SUN'
          };

          // 중복 체크: filteredSchedules의 ID를 영어 요일로 변환해서 생성
          const filteredIds = new Set();
          const filteredLunchExists = new Set(); // 점심시간 특별 체크

          filteredSchedules.forEach(s => {
            // 이미 영어 요일인 경우와 한글 요일인 경우 모두 처리
            const normalizedDays = s.days?.map(day => dayMap[day] || day).sort().join(',') || '';
            const id = `${s.title}-${s.startTime}-${s.endTime}-${normalizedDays}`;
            filteredIds.add(id);

            // 점심시간 체크: 제목 또는 시간대
            const isLunch = (s.title && s.title.includes('점심')) || (s.startTime === '12:50' && s.endTime === '13:50');
            if (isLunch) {
              filteredLunchExists.add(normalizedDays || 'any');
            }
          });

          // 기본 베이스 중에서 아직 포함되지 않은 것만 추가
          let addedCount = 0;
          let skippedLunch = 0;

          baseSchedules.forEach(baseSchedule => {
            // baseSchedule의 한글 요일을 영어로 변환해서 ID 생성
            const normalizedDays = baseSchedule.days?.map(day => dayMap[day] || day).sort().join(',') || '';
            const id = `${baseSchedule.title}-${baseSchedule.startTime}-${baseSchedule.endTime}-${normalizedDays}`;

            // 점심시간 특별 처리
            const isLunch = (baseSchedule.title && baseSchedule.title.includes('점심')) ||
                           (baseSchedule.startTime === '12:50' && baseSchedule.endTime === '13:50');

            if (isLunch && filteredLunchExists.size > 0) {
              // 점심시간이 이미 존재하면 스킵
              skippedLunch++;
              return;
            }

            if (!filteredIds.has(id)) {
              // days를 영어 코드로 변환
              const convertedDays = baseSchedule.days?.map(day => dayMap[day] || day) || [];
              filteredSchedules.push({
                ...baseSchedule,
                days: convertedDays
              });
              addedCount++;
            }
          });
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
    res.status(500).json({
      success: false,
      error: 'OCR 채팅 필터링 실패',
      details: error.message
    });
  }
};

/**
 * 대화형 시간표 추천
 * POST /api/ocr-chat/recommend
 */
exports.conversationalRecommend = async (req, res) => {
  try {
    const {
      chatMessage,
      extractedSchedules,
      schedulesByImage,
      conversationHistory = [],
      userProfile = {}
    } = req.body;

    // 입력 검증
    if (!chatMessage || !chatMessage.trim()) {
      return res.status(400).json({
        success: false,
        error: '메시지가 비어있습니다'
      });
    }

    // 대화형 프롬프트 생성
    const prompt = generateConversationalPrompt(
      chatMessage,
      extractedSchedules,
      conversationHistory,
      userProfile
    );

    // Gemini API 호출
    const modelNames = ['gemini-2.0-flash', 'gemini-1.5-flash'];
    let aiResponse = null;
    let lastError = null;

    for (const modelName of modelNames) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0.3 // 약간 창의적으로
          }
        });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        aiResponse = response.text();
        break;
      } catch (error) {
        lastError = error;
        continue;
      }
    }

    if (!aiResponse) {
      throw lastError || new Error('모든 모델 시도 실패');
    }

    // JSON 파싱
    let parsed = null;

    try {
      const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
      } else {
        const codeMatch = aiResponse.match(/```\s*([\s\S]*?)\s*```/);
        if (codeMatch) {
          parsed = JSON.parse(codeMatch[1]);
        } else {
          parsed = JSON.parse(aiResponse);
        }
      }
    } catch (parseError) {
      return res.json({
        success: false,
        error: 'AI 응답 파싱 실패',
        rawResponse: aiResponse.substring(0, 500)
      });
    }

    // 대화 히스토리 업데이트
    const updatedHistory = addToHistory(
      addToHistory(conversationHistory, 'user', chatMessage),
      'assistant',
      parsed.explanation
    );

    // 사용자 프로필 업데이트
    const updatedProfile = updateUserProfile(userProfile, parsed.extractedInfo || {});

    res.json({
      success: true,
      intent: parsed.intent,
      understood: parsed.understood,
      extractedInfo: parsed.extractedInfo,
      nextQuestion: parsed.nextQuestion,
      recommendedSchedule: parsed.recommendedSchedule || [],
      conflicts: parsed.conflicts || [],
      explanation: parsed.explanation,
      conversationHistory: updatedHistory,
      userProfile: updatedProfile
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: '대화형 추천 실패',
      details: error.message
    });
  }
};
