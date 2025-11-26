const { GoogleGenerativeAI } = require('@google/generative-ai');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const { detectDuplicate, calculateImageHash } = require('../utils/imageHasher');
const { optimizeSchedules } = require('../utils/scheduleAutoOptimizer');
const { getOcrPrompt } = require('../prompts/ocrPrompts');
const { convertToImageParts, filterDuplicateImages, checkDuplicates } = require('../utils/imageProcessing');
const { mergeConsecutiveSchedules } = require('../utils/scheduleProcessing');

// Gemini AI 초기화
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 업로드된 이미지 해시 저장소 (세션별 관리)
const imageHashStore = new Map();

// Multer 설정 (메모리 저장)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB 제한
  },
  fileFilter: (req, file, cb) => {
    // 이미지 파일만 허용
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'));
    }
  }
}).array('images', 10); // 최대 10개 이미지

/**
 * 이미지에서 OCR 텍스트 추출
 */
exports.extractTextFromImage = async (req, res) => {
  try {
    // 파일이 없는 경우
    if (!req.file) {
      return res.status(400).json({ error: '이미지 파일이 필요합니다.' });
    }

    const imageBuffer = req.file.buffer;
    const mimeType = req.file.mimetype;

    // Gemini Vision API로 OCR 수행
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const imageParts = [
      {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: mimeType,
        },
      },
    ];

    const prompt = `
이 이미지에서 모든 텍스트를 추출해주세요.
특히 다음 정보에 주의해서 추출해주세요:
- 학원/학습 시간표
- 과목명
- 요일 정보 (예: 월, 화, 수, 목, 금, 토, 일 또는 "주3회(월,수,금)" 형식)
- 시간 정보 (시작 시간 - 종료 시간)
- 학년부 정보 (초등부, 중등부, 고등부)
- 강사명 또는 반 이름

추출한 텍스트를 그대로 반환해주세요.
`;

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();

    res.json({
      success: true,
      text: text,
      fileName: req.file.originalname,
    });

  } catch (error) {
    res.status(500).json({
      error: 'OCR 처리 중 오류가 발생했습니다.',
      details: error.message,
    });
  }
};

/**
 * 여러 이미지에서 OCR 텍스트 추출
 */
exports.extractTextFromImages = async (req, res) => {
  try {
    // 파일이 없는 경우
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: '최소 1개 이상의 이미지 파일이 필요합니다.' });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const results = [];

    // 각 이미지에서 OCR 수행
    for (const file of req.files) {
      try {
        const imageBuffer = file.buffer;
        const mimeType = file.mimetype;

        const imageParts = [
          {
            inlineData: {
              data: imageBuffer.toString('base64'),
              mimeType: mimeType,
            },
          },
        ];

        const prompt = `
이 이미지에서 모든 텍스트를 추출해주세요.
특히 다음 정보에 주의해서 추출해주세요:
- 학원/학습 시간표
- 과목명
- 요일 정보 (예: 월, 화, 수, 목, 금, 토, 일 또는 "주3회(월,수,금)" 형식)
- 시간 정보 (시작 시간 - 종료 시간)
- 학년부 정보 (초등부, 중등부, 고등부)
- 강사명 또는 반 이름

추출한 텍스트를 그대로 반환해주세요.
`;

        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;
        const text = response.text();

        results.push({
          success: true,
          text: text,
          fileName: file.originalname,
        });

      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          fileName: file.originalname,
        });
      }
    }

    res.json({
      success: true,
      results: results,
      totalProcessed: req.files.length,
      successCount: results.filter(r => r.success).length,
    });

  } catch (error) {
    res.status(500).json({
      error: 'OCR 처리 중 오류가 발생했습니다.',
      details: error.message,
    });
  }
};

/**
 * 시간표 이미지 분석 및 구조화된 데이터 반환
 */
exports.analyzeScheduleImages = async (req, res) => {
  try {
    // 파일이 없는 경우
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: '최소 1개 이상의 이미지 파일이 필요합니다.' });
    }

    const { birthdate, userId, skipDuplicateCheck, clearSession } = req.body;
    const sessionKey = userId || 'default';

    // 세션별 이미지 저장소 초기화
    if (!imageHashStore.has(sessionKey)) {
      imageHashStore.set(sessionKey, []);
    }

    // ⭐ clearSession 플래그가 있으면 기존 저장소 초기화 (모달 열 때마다 새로 시작)
    if (clearSession === 'true' || clearSession === true) {
      imageHashStore.set(sessionKey, []);
    }

    const existingImages = imageHashStore.get(sessionKey);

    // 🔍 1단계: 중복 체크 (skipDuplicateCheck가 false일 때만)
    // 문자열 'true'도 체크 (FormData는 문자열로 전달됨)
    const shouldSkipDuplicateCheck = skipDuplicateCheck === true || skipDuplicateCheck === 'true';

    let filesToProcess = req.files; // 처리할 파일 목록
    let removedDuplicates = []; // 제거된 중복 이미지 목록

    if (!shouldSkipDuplicateCheck) {
      const duplicateResult = await checkDuplicates(req.files, existingImages, detectDuplicate, 95);
      if (duplicateResult) {
        return res.json({
          success: true,
          ...duplicateResult
        });
      }
    } else {
      const filterResult = await filterDuplicateImages(req.files, existingImages, detectDuplicate, 95);
      filesToProcess = filterResult.filesToProcess;
      removedDuplicates = filterResult.removedDuplicates;

      // 중복 제거 후 남은 이미지들을 저장소에 추가 (OCR 전에 미리 추가)
      for (const img of filterResult.newImages) {
        existingImages.push(img);
      }
    }

    // 2단계: OCR 처리
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const scheduleResults = [];

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      try {

        const imageBuffer = file.buffer;
        const mimeType = file.mimetype;

        const imageParts = convertToImageParts(imageBuffer, mimeType);
        const prompt = getOcrPrompt();

        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;
        let text = response.text();

        // JSON 파싱
        // Gemini가 마크다운 코드 블록으로 감쌀 수 있으므로 제거
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        let parsedSchedules;
        try {
          parsedSchedules = JSON.parse(text);
          if (parsedSchedules.schedules?.length > 0) {
            const gradeLevelCounts = {};
            parsedSchedules.schedules.forEach(s => {
              const grade = s.gradeLevel || 'null';
              gradeLevelCounts[grade] = (gradeLevelCounts[grade] || 0) + 1;
            });
            // ⭐ 학년부별 샘플 출력
            const uniqueGrades = [...new Set(parsedSchedules.schedules.map(s => s.gradeLevel).filter(Boolean))];
            if (uniqueGrades.length > 0) {
              console.log(`📝 학년부별 샘플:`);
              uniqueGrades.forEach(grade => {
                const sample = parsedSchedules.schedules.find(s => s.gradeLevel === grade);
                if (sample) {
                  console.log(`   - ${grade}: ${sample.title} (${sample.days?.join(',') || '?'} ${sample.startTime}-${sample.endTime})`);
                }
              });
            }
          }
        } catch (parseError) {
          parsedSchedules = { schedules: [] };
        }

        // sourceImageIndex 추가 (시간 수정 제거 - OCR이 정확히 인식하도록 프롬프트 개선)
        const schedulesWithIndex = (parsedSchedules.schedules || []).map(schedule => {
          // 🎨 디버깅: backgroundColor 확인
          if (schedule.backgroundColor) {
            console.log(`🎨 OCR 색상 추출됨: ${schedule.title} → backgroundColor: ${schedule.backgroundColor}`);
          } else {
            console.log(`⚪ OCR 색상 없음: ${schedule.title} → backgroundColor: ${schedule.backgroundColor || 'undefined'}`);
          }
          
          return {
            ...schedule,
            sourceImage: file.originalname,
            sourceImageIndex: i
          };
        });

        // imageTitle 추출 (AI가 분석한 제목)
        const extractedTitle = parsedSchedules.imageTitle || null;

        // 이민영 강사 디버깅
        const leeminSchedules = schedulesWithIndex.filter(s =>
          (s.title && s.title.includes('이민영')) ||
          (s.instructor && s.instructor.includes('이민영'))
        );

        scheduleResults.push({
          success: true,
          fileName: file.originalname,
          schedules: schedulesWithIndex,
          imageTitle: extractedTitle // AI가 추출한 제목
        });

        // 이미지 해시 계산 및 저장
        const imageHash = await calculateImageHash(file.buffer);
        existingImages.push({
          buffer: file.buffer,
          hash: imageHash,
          filename: file.originalname
        });

      } catch (error) {
        scheduleResults.push({
          success: false,
          error: error.message,
          fileName: file.originalname,
          schedules: [],
        });
      }
    }

    // 모든 시간표를 하나로 합치되, 이미지 출처 정보 추가
    let allSchedules = scheduleResults.flatMap((result, imageIndex) =>
      (result.schedules || []).map(schedule => ({
        ...schedule,
        sourceImage: result.fileName,
        sourceImageIndex: imageIndex
      }))
    );
    scheduleResults.forEach((result, idx) => {
      if (result.schedules && result.schedules.length > 0) {
      }
    });
    const beforeFilterCount = allSchedules.length;
    allSchedules = allSchedules.filter(schedule => {
      const title = (schedule.title || '').trim();
      // O, X, 0, △ 같은 단일 기호는 제거
      if (title === 'O' || title === 'X' || title === '0' || title === '△') {
        return false;
      }
      // 수업준비, 오프닝, 정리정돈 같은 비수업 활동 제거
      if (title.includes('수업준비') || title.includes('오프닝') || title.includes('정리정돈')) {
        return false;
      }
      return true;
    });
    // 점심시간 자동 감지 및 추가
    const addLunchTimeIfMissing = (schedules) => {
      // 4교시와 5교시 찾기
      const period4 = schedules.find(s => s.title && (s.title.includes('4교시') || s.endTime === '12:50' || s.endTime === '12:10'));
      const period5 = schedules.find(s => s.title && (s.title.includes('5교시') || s.startTime === '13:00' || s.startTime === '13:40'));

      // 점심시간이 이미 있는지 확인
      const hasLunch = schedules.some(s => s.title && s.title.includes('점심'));

      // 4교시와 5교시가 있고, 점심시간이 없으며, 둘 사이에 시간 간격이 있으면 점심시간 추가
      if (period4 && period5 && !hasLunch) {
        const period4End = period4.endTime;
        const period5Start = period5.startTime;

        // 시간 차이 계산 (30분 이상이면 점심시간으로 간주)
        const timeDiff = timeToMinutes(period5Start) - timeToMinutes(period4End);

        if (timeDiff >= 30) {
          const lunchTime = {
            title: '점심시간',
            days: period4.days || ['월', '화', '수', '목', '금'],
            startTime: period4End,
            endTime: period5Start
          };
          schedules.push(lunchTime);
        }
      }
    };

    const timeToMinutes = (time) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    addLunchTimeIfMissing(allSchedules);

    const mergedSchedules = mergeConsecutiveSchedules(allSchedules);
    allSchedules = mergedSchedules;

    // ========== 새로운 분석 로직 적용 ==========
    const { detectBaseScheduleFromImages, extractBaseSchedules } = require('../utils/scheduleAnalysis/detectBaseSchedule');
    const { generateTitlesForImages } = require('../utils/scheduleAnalysis/generateScheduleTitle');

    // 1. 기본 베이스 감지 (학교 시간표 자동 인식)
    const baseAnalysis = detectBaseScheduleFromImages(scheduleResults);

    // 2. 이미지별 제목 생성
    const { schedulesByImage: titledImages, overallTitle } = generateTitlesForImages(scheduleResults);

    // 3. 기본 베이스 스케줄 추출
    const baseSchedules = extractBaseSchedules(baseAnalysis);

    // 4. ⭐ 병합 전 원본 스케줄에 academyName, subjectName 추가
    const { categorizeSchedulesBatch } = require('../utils/scheduleAutoOptimizer');

    // titledImages의 각 이미지별로 스케줄 처리
    const processedSchedulesByImage = [];
    for (const img of titledImages) {
      const imageTitle = img.imageTitle || img.fileName;
      const schedulesForImage = allSchedules.filter(s => s.sourceImage === img.fileName);

      // categorizeSchedulesBatch로 academyName, subjectName 추가
      const processedSchedules = await categorizeSchedulesBatch(schedulesForImage, imageTitle);

      processedSchedulesByImage.push({
        ...img,
        schedules: processedSchedules
      });
    }

    // 5. ⭐ 자동 스케줄 최적화 (우선순위 기반 겹침 제거 + 학년부 필터링)
    const optimizationResult = await optimizeSchedules(allSchedules, titledImages);

    const responseData = {
      success: true,
      allSchedules: allSchedules, // 원본 전체 스케줄
      optimizedSchedules: optimizationResult.optimizedSchedules, // ⭐ 자동 최적화된 스케줄
      optimizationAnalysis: optimizationResult.analysis, // 최적화 분석 정보
      totalSchedules: allSchedules.length,
      schedulesByImage: processedSchedulesByImage, // ⭐ academyName, subjectName이 추가된 이미지별 정보
      overallTitle: overallTitle, // 전체 제목
      baseSchedules: baseSchedules, // 기본 베이스 스케줄 (학교)
      baseAnalysis: baseAnalysis, // 기본 베이스 분석 결과
      removedDuplicates: removedDuplicates, // 제거된 중복 이미지 목록 (skipDuplicateCheck=true일 때)
    };

    res.json(responseData);
  } catch (error) {
    res.status(500).json({
      error: '시간표 분석 중 오류가 발생했습니다.',
      details: error.message,
    });
  }
};

// Multer 미들웨어 export
exports.uploadMiddleware = upload;
