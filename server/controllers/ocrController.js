const { GoogleGenerativeAI } = require('@google/generative-ai');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');

// Gemini AI 초기화
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * 연속된 같은 제목의 스케줄을 하나로 병합
 * 예: 수학 13:50-14:00 + 수학 14:00-14:20 + 수학 14:20-14:40 → 수학 13:50-14:40
 */
function mergeConsecutiveSchedules(schedules) {
  if (!schedules || schedules.length === 0) return schedules;

  const merged = [];
  const processed = new Set();

  // 각 스케줄을 요일별로 전개
  const expandedSchedules = [];
  schedules.forEach(schedule => {
    const days = Array.isArray(schedule.days) ? schedule.days : [schedule.days];
    days.forEach(day => {
      expandedSchedules.push({ ...schedule, days: [day], originalDaysCount: days.length });
    });
  });

  // 요일별로 그룹화 및 시간순 정렬
  const byDay = {};
  expandedSchedules.forEach(schedule => {
    const day = schedule.days[0];
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(schedule);
  });

  Object.keys(byDay).forEach(day => {
    const daySchedules = byDay[day].sort((a, b) => a.startTime.localeCompare(b.startTime));

    for (let i = 0; i < daySchedules.length; i++) {
      const current = daySchedules[i];
      const currentId = `${day}_${current.title}_${current.startTime}_${current.endTime}`;

      if (processed.has(currentId)) continue;

      // 연속된 같은 제목의 스케줄 찾기
      let endTime = current.endTime;
      const toMerge = [current];

      for (let j = i + 1; j < daySchedules.length; j++) {
        const next = daySchedules[j];

        if (next.title === current.title &&
            next.instructor === current.instructor &&
            next.startTime === endTime) {
          toMerge.push(next);
          endTime = next.endTime;

          const nextId = `${day}_${next.title}_${next.startTime}_${next.endTime}`;
          processed.add(nextId);
        } else {
          break;
        }
      }

      // 병합 결과 생성
      if (toMerge.length > 1) {
        console.log(`  🔗 병합: ${day} ${current.title} ${current.startTime}-${endTime} (${toMerge.length}개 블록)`);
      }

      const mergedSchedule = { ...current };
      mergedSchedule.endTime = endTime;
      mergedSchedule.days = [day];

      // duration 재계산
      const [startH, startM] = current.startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      mergedSchedule.duration = (endH * 60 + endM) - (startH * 60 + startM);

      merged.push(mergedSchedule);
      processed.add(currentId);
    }
  });

  // 같은 title + startTime + endTime + instructor를 가진 스케줄을 다시 묶기
  const finalMerged = [];
  const scheduleMap = new Map();

  merged.forEach(schedule => {
    const key = `${schedule.title}_${schedule.startTime}_${schedule.endTime}_${schedule.instructor || ''}`;

    if (scheduleMap.has(key)) {
      // 기존 스케줄에 요일 추가
      const existing = scheduleMap.get(key);
      existing.days.push(schedule.days[0]);
    } else {
      scheduleMap.set(key, { ...schedule, days: [...schedule.days] });
    }
  });

  scheduleMap.forEach(schedule => finalMerged.push(schedule));

  return finalMerged;
}

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
    console.error('OCR 처리 에러:', error);
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
        console.error(`이미지 처리 실패 (${file.originalname}):`, error);
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
    console.error('OCR 처리 에러:', error);
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

    const { birthdate } = req.body;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const scheduleResults = [];

    console.log(`📸 총 ${req.files.length}개의 이미지 처리 시작...`);

    // 각 이미지에서 시간표 정보 추출
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      try {
        console.log(`🔄 [${i + 1}/${req.files.length}] ${file.originalname} 처리 중...`);

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
이 이미지의 시간표를 정확히 추출하세요.

**시간 해석 규칙 (매우 중요!)**
왼쪽 시간 열의 **이미지 내 위치**로 오전/오후 판단:
- 이미지 **상단**에 9:30, 10, 11 → **오전** (09:30, 10:00, 11:00)
- 이미지 **하단**에 6, 7, 8, 9 → **오후** (18:00, 19:00, 20:00, 21:00)

학교 시간표 (1,2,3,4,5,6,7):
- 1교시=09:00-09:50, 2교시=10:00-10:50, 3교시=11:00-11:50
- 4교시=12:00-12:50, 5교시=13:50-14:40, 6교시=14:50-15:40

**그리드 읽기**:
첫 행: 월요일, 화요일, 수요일, 목요일, 금요일, 토요일

각 시간 행마다 왼쪽→오른쪽 스캔:
- 월요일 열: 텍스트 있으면 추출, 빈 셀은 스킵
- 화요일 열: 텍스트 있으면 추출, 빈 셀은 스킵
- (모든 요일 반복)

**셀 크기로 시간 결정**:
- 1행 셀 = 30분 (or 50분)
- 2행 병합 = 1시간 (or 1시간40분)

**다음 정보를 JSON 형식으로 추출해주세요:

{
  "imageTitle": "이미지 상단의 제목 (예: 기구필라테스 야샤야 PT 시간표, 학교 시간표, KPOP 댄스 학원 등)",
  "schedules": [
    {
      "title": "과목명 또는 수업명",
      "gradeLevel": "초등부|중등부|고등부 (없으면 null)",
      "days": ["월", "수", "금"] 형식의 요일 배열,
      "startTime": "HH:MM" 형식의 시작 시간,
      "endTime": "HH:MM" 형식의 종료 시간,
      "instructor": "강사명 (있으면)",
      "classroom": "교실/반 이름 (있으면)",
      "floor": "층 정보 (B1, 2F, 3층 등, 없으면 null)",
      "description": "추가 정보"
    }
  ]
}

**⚠️ 층 정보 추출 (매우 중요!)**:
- 시간표에 **"B1", "2F", "3층", "지하 1층", "지상 2층"** 같은 층 정보가 있으면 반드시 추출!
- 왼쪽 열에 층 정보가 표시된 경우:
  - 예: 8시30분 행에 "B1" + "성인반" → floor: "B1"
  - 예: 8시30분 행에 "2F" + "성인반" → floor: "2F"
- **같은 시간대, 같은 반 이름**이지만 **층이 다르면** 별도 스케줄로 추출!
  - 예: 8시30분 성인반 B1, 8시30분 성인반 2F → 2개의 스케줄

**⚠️ 이미지 제목 추출 (매우 중요!)**:
1. **imageTitle 필드**:
   - 이미지 상단/제목에서 시간표 이름을 추출
   - 예: "기구필라테스 야샤야 PT 시간표" → imageTitle: "기구필라테스 야샤야 PT"
   - 예: "○○중학교 1학년 시간표" → imageTitle: "○○중학교 1학년"
   - 예: "KPOP 댄스 학원" → imageTitle: "KPOP 댄스 학원"
   - 예: "[범계 영어학원] 7세반과 초등학생 영어 수강료와 수업시간표" → imageTitle: "범계 영어학원"
   - 제목이 없으면 수업 내용으로 유추 (예: 모두 필라테스 수업 → "필라테스")
2. **주의**: "시간표", "Table", "Schedule" 등은 제외하고 핵심 이름만 추출

**그리드 시간표 인식 방법 (매우 중요!)**:

1. **시간표 구조 분석**:
   - 첫 번째 행: 요일 (월, 화, 수, 목, 금, 토, 일 또는 월요일, 화요일...)
   - 첫 번째 열: 교시 번호(1, 2, 3...) 또는 시간대 (예: 09:00-09:50, 13:00-14:30, 7-7:30, 8-8:30)
   - **중요**:
     * 왼쪽에 시간이 있으면 그 시간을 **정확히** 사용
     * 왼쪽에 "6", "7", "7:30", "8", "8:30", "9" 같이 표시되면 각각이 **독립된 시간 슬롯**입니다
     * 왼쪽에 교시 번호만 있으면 아래 교시-시간 매핑표 사용!

   ⚠️ **절대로 시간을 임의로 쪼개지 마세요!**
   - 왼쪽에 "7-7:30"이라고 적혀있으면: 19:00-19:30 (1개)
   - 왼쪽에 "7:30-8"이라고 적혀있으면: 19:30-20:00 (1개)
   - **절대로** 19:00-19:10, 19:10-19:30 같이 10분 단위로 쪼개지 마세요!

2. **교시 번호 → 시간 변환** (초중고 공통):
   **매우 중요! 학교는 4교시 후 점심시간 1시간이 있습니다!**

   - 1교시: 09:00-09:50
   - 2교시: 10:00-10:50
   - 3교시: 11:00-11:50
   - 4교시: 12:00-12:50
   - **점심시간: 12:50-13:50 (1시간) - 무조건 추출!**
   - 5교시: 13:50-14:40
   - 6교시: 14:50-15:40
   - 7교시: 15:50-16:40

   **학교 시간표 처리 규칙**:
   - 1~4교시를 발견하면, 무조건 4교시 종료 시간부터 1시간 점심시간 추가
   - 5교시 이후는 점심시간 1시간을 고려해서 시간 조정
   - 예: 원본이 "5교시 13:00-13:50"이라고 되어 있어도, 점심시간 1시간 후인 "13:50-14:40"으로 변환

   **예시**:
   - 왼쪽 열에 "1"만 있고 월요일 셀에 "도덕" → {"title": "도덕", "days": ["월"], "startTime": "09:00", "endTime": "09:50"}
   - 왼쪽 열에 "4"만 있고 화요일 셀에 "수학" → {"title": "수학", "days": ["화"], "startTime": "12:00", "endTime": "12:50"}
   - **4교시 다음은 무조건 점심시간** → {"title": "점심시간", "days": ["월", "화", "수", "목", "금"], "startTime": "12:50", "endTime": "13:50"}
   - 왼쪽 열에 "5"만 있고 수요일 셀에 "영어" → {"title": "영어", "days": ["수"], "startTime": "13:50", "endTime": "14:40"}

3. **셀 내용 읽기** (매우 중요!):
   ⚠️ **각 셀마다 강사명이 다를 수 있으니 반드시 확인하세요!**

   - 각 셀에 과목명만 있음: title에 과목명 사용
   - 각 셀에 2줄 이상으로 표시될 수 있음:
     * 첫 줄: 수업명
     * 둘째 줄: 강사명 (예: "○○ 원장", "○○ 강사", "○○선생님")
     * 셋째 줄: 추가 정보 (물리치료사, 석탄치료사 등)

   - 예시: 셀에 "도덕" → title: "도덕"
   - 예시: 셀에 "주니어A\n사랑T" → title: "주니어A", instructor: "사랑T"
   - 예시: 셀에 "이고은 원장\n(선천신우 전담)" → title: "이고은 원장", instructor: "이고은"
   - 예시: 셀에 "이민영 강사\n(석탄치료사)" → title: "이민영 강사", instructor: "이민영"

   ⚠️ **빈도 정보 처리 (주5회, 주3회 등)**:
   **영어학원 같은 시간표에서 왼쪽 열에 "주5회", "주3회 (월,수,금)", "주2회 (화,목)", "주1회 (토요일)" 같은 빈도 정보가 있으면**:
   - **title에 빈도 정보를 반드시 포함시켜주세요!**
   - 예:
     * 왼쪽에 "주5회", 위에 "초등부", 시간 "16:00~17:00" → title: "초등부 주5회", days: ["월","화","수","목","금"]
     * 왼쪽에 "주3회 (월,수,금)", 위에 "초등부", 시간 "14:40~15:40" → title: "초등부 주3회", days: ["월","수","금"]
     * 왼쪽에 "주2회 (화,목)", 위에 "초등부", 시간 "17:10~18:10" → title: "초등부 주2회", days: ["화","목"]
     * 왼쪽에 "주1회 (토요일)", 위에 "초등부", 시간 "10:00~11:30" → title: "초등부 주1회", days: ["토"]
   - **days 배열**: 괄호 안의 요일 또는 주5회→월~금, 주3회→월수금, 주2회→화목, 주1회→토
   - **빈도가 여러 시간대에 있으면 각각 별도 일정으로 추출!**
     * "주3회" 행에 3개 시간대 → 3개의 일정 (모두 title: "초등부 주3회", days: ["월","수","금"])

   ⚠️ **같은 행에서도 각 요일 셀의 강사명이 다를 수 있습니다!**
   - 월요일 7시: "이고은 원장" → instructor: "이고은"
   - 월요일 7:30: "이민영 강사" → instructor: "이민영"
   - 월요일 8시: "박진영 강사" → instructor: "박진영"
   → 3개의 별도 일정으로 추출!

4. **시간대별 일정 추출** (매우 중요!):
   - **각 행의 시간대를 정확히 사용하세요!**
   - **같은 셀이 여러 행에 걸쳐 있어도 각 시간대별로 별도의 일정으로 추출**
   - **같은 강사/수업명이 여러 요일에 있으면 각 요일별로 별도 일정 추출**
   - **절대로 여러 요일을 하나로 합치지 마세요!**
   - **⚠️ 매우 중요: 각 셀을 정확히 보고 빠뜨리지 마세요! 특히 첫 번째 요일(월요일) 셀을 건너뛰지 마세요!**

   예시 1: 가로로 같은 내용
   - "7시" 행에 "이고은 원장"이 월/수/금 3개 셀에 있으면:
     → {"title": "이고은 원장", "days": ["월"], "startTime": "19:00", "endTime": "19:30"}
     → {"title": "이고은 원장", "days": ["수"], "startTime": "19:00", "endTime": "19:30"}
     → {"title": "이고은 원장", "days": ["금"], "startTime": "19:00", "endTime": "19:30"}
     (3개의 별도 일정으로 추출!)

   - "7:30" 행에 "이민영 강사"가 월/화/수/목 4개 셀에 있으면:
     → {"title": "이민영 강사", "days": ["월"], "startTime": "19:30", "endTime": "20:00", "instructor": "이민영"}
     → {"title": "이민영 강사", "days": ["화"], "startTime": "19:30", "endTime": "20:00", "instructor": "이민영"}
     → {"title": "이민영 강사", "days": ["수"], "startTime": "19:30", "endTime": "20:00", "instructor": "이민영"}
     → {"title": "이민영 강사", "days": ["목"], "startTime": "19:30", "endTime": "20:00", "instructor": "이민영"}
     (4개의 별도 일정으로 추출! **월요일을 절대 빠뜨리지 마세요!**)

   예시 2: 세로로 병합된 셀
   - "키즈KPOP" 셀이 16:10-17:00, 17:00-18:00 두 행에 걸쳐 있으면:
     → {"title": "키즈KPOP", "days": ["월"], "startTime": "16:10", "endTime": "17:00", "instructor": "사랑T"}
     → {"title": "키즈KPOP", "days": ["월"], "startTime": "17:00", "endTime": "18:00", "instructor": "사랑T"}
     (두 개의 별도 일정으로 추출!)

   예시 3: 복잡한 경우
   - "9:30" 행에 "이고은 원장"이 월/목/금에 있으면:
     → {"title": "이고은 원장", "days": ["월"], "startTime": "09:30", "endTime": "10:00"}
     → {"title": "이고은 원장", "days": ["목"], "startTime": "09:30", "endTime": "10:00"}
     → {"title": "이고은 원장", "days": ["금"], "startTime": "09:30", "endTime": "10:00"}
     (3개의 별도 일정으로 추출!)

   **⚠️ 빈 셀 처리 (매우 중요!)**:
   - 셀이 **비어있거나 공백이면 일정 추출 안 함!**
   - 예: 7시 행에서 월요일="이고은 원장", 화요일=비어있음, 수요일="이고은 원장"
     → {"title": "이고은 원장", "days": ["월"], "startTime": "19:00", "endTime": "19:30"}
     → 화요일은 건너뜀 (일정 생성 안 함)
     → {"title": "이고은 원장", "days": ["수"], "startTime": "19:00", "endTime": "19:30"}
   - **절대로 빈 셀에 인접 셀의 내용을 복사하지 마세요!**

   **⚠️ 매우 중요: 절대로 시간대를 건너뛰어 병합하지 마세요!**
   - 월요일 7시 "이고은 원장", 8:30 "이고은 원장"이 있어도:
     → 7시-7:30 (19:00-19:30) 1개
     → 8:30-9시 (20:30-21:00) 1개
     → **절대로 19:00-21:00으로 합치지 마세요!**
   - 각 시간 행마다 정확히 해당 시간대로만 추출!

5. **중복/선택 수업 처리**:
   - 같은 시간대, 같은 요일에 여러 셀이 있으면 각각 별도 일정으로 추출
   - **반드시 instructor(강사명)를 포함**해서 구분 가능하게!

6. **시간 처리** (매우 중요!):
   - 왼쪽 열의 시간을 **정확히** 사용 (예: "20:20-21:30" → startTime: "20:20", endTime: "21:30")
   - 모든 시간을 24시간 형식으로 (13:00, 19:10, 20:20, 21:40, 22:10 등)
   - **셀이 병합되어 여러 시간대를 차지하는 경우**: 각 시간대별로 별도 일정 생성!
     예: "키즈KPOP" 셀이 16:10부터 19:00까지 차지하면
     → 16:10-17:00 일정 1개
     → 17:00-18:00 일정 1개
     → 18:00-19:00 일정 1개
     (총 3개의 별도 일정으로 추출!)

**중요**:
- 빈 셀은 무시
- **점심시간은 학교 시간표에서 절대 생략하면 안됨!**
  * 학교 시간표 (1교시~7교시)가 보이면, 4교시 종료 시간부터 5교시 시작 시간까지를 점심시간으로 추출
  * 4교시 끝나는 시간 확인 → 5교시 시작 시간 확인 → 그 사이가 점심시간
  * 예시 1: 4교시가 12:10 끝, 5교시가 13:00 시작 → {"title": "점심시간", "days": ["월", "화", "수", "목", "금"], "startTime": "12:10", "endTime": "13:00"}
  * 예시 2: 4교시가 12:50 끝, 5교시가 13:00 시작 → {"title": "점심시간", "days": ["월", "화", "수", "목", "금"], "startTime": "12:50", "endTime": "13:00"}
  * **무조건 추출!** 학교 시간표에 4교시와 5교시가 있으면 반드시 점심시간도 있음
- 짧은 쉬는시간(10분 이하)은 제외
- 모든 시간을 그리드 왼쪽 열에서 읽어서 사용
- 강사명(instructor)을 반드시 추출해서 같은 수업명도 구분 가능하게!

요일 매핑:
- "월요일" → ["월"]
- "화요일" → ["화"]
- "수요일" → ["수"]
- "목요일" → ["목"]
- "금요일" → ["금"]
- "토요일" → ["토"]
- "일요일" → ["일"]

**시간 변환 규칙 (매우 중요!)**:
- "1시 PM" 또는 "오후 1시" → "13:00"
- "2시 PM" 또는 "오후 2시" → "14:00"
- "3시 PM" 또는 "오후 3시" → "15:00"
- "12시 PM" 또는 "오후 12시" → "12:00" (정오)
- "1시 AM" 또는 "오전 1시" → "01:00"
- "12시 AM" 또는 "오전 12시" → "00:00" (자정)
- **PM이 있으면 반드시 12를 더해야 함** (단, 12시 PM은 12:00 그대로)
- **AM이 있으면 그대로 사용** (단, 12시 AM은 00:00)

**⚠️⚠️⚠️ 30분 단위 시간대 처리 (매우매우 중요!) ⚠️⚠️⚠️**:
**시간표 왼쪽 열을 먼저 확인하세요!**
- "7", "7:30", "8", "8:30" 같이 30분 간격으로 행이 있으면 → **각 행은 30분 단위입니다**
- **절대로 10분, 20분 단위로 쪼개지 마세요!**

**⚠️⚠️ 셀 크기로 시간 길이 결정 (가장 중요!) ⚠️⚠️**
**그리드 경계선을 보고 셀이 몇 개 행을 차지하는지 세세요!**

- **1개 행만 차지** → 30분 (예: "7" 행에만 있는 작은 셀 → 19:00-19:30)
  - ⚠️ **"7" 행 셀이 "7:30" 행까지 안 내려갔으면 무조건 30분!**
  - ⚠️ **셀이 시각적으로 크게 보여도, 다음 행 경계선을 넘지 않았으면 30분!**
- **2개 행 차지** → 1시간 (예: "10"+"11" 행 병합 → 10:00-12:00)
  - ⚠️ **"10" 행 경계선에서 시작해서 "11" 행 경계선을 넘어야 1시간!**
- **3개 행 차지** → 1시간30분 (예: "6"+"7"+"7:30" 행 병합 → 18:00-19:30)

**올바른 예시:**
- 왼쪽 열에 "10", "11" 행이 있고, "10~11" 행에 걸친 큰 셀 "김다희 강사":
  - ✅ 올바름: {"title": "김다희 강사", "startTime": "10:00", "endTime": "12:00"} (2시간!)
  - ❌ 잘못: {"title": "김다희 강사", "startTime": "10:00", "endTime": "10:30"} (30분으로 잘못!)

- "7" 행에만 있는 작은 셀 "이고은 원장":
  - ✅ 올바름: {"title": "이고은 원장", "startTime": "19:00", "endTime": "19:30"} (30분!)
  - ❌ 잘못: {"title": "이고은 원장", "startTime": "19:00", "endTime": "20:00"} (1시간으로 잘못!)
  - ⚠️⚠️ **"7" 행에만 있고 "7:30" 행 경계선을 안 넘었으면 절대 1시간 안 됨!**
- 왼쪽 열: "7-7:30" → 이 행의 모든 일정은 startTime: "19:00", endTime: "19:30" (정확히 30분!)
- 왼쪽 열: "7:30-8" → 이 행의 모든 일정은 startTime: "19:30", endTime: "20:00" (정확히 30분!)
- 왼쪽 열: "8-8:30" → 이 행의 모든 일정은 startTime: "20:00", endTime: "20:30" (정확히 30분!)
- 왼쪽 열: "8:30-9" → 이 행의 모든 일정은 startTime: "20:30", endTime: "21:00" (정확히 30분!)

**구체적인 예시 (필라테스 시간표):**

왼쪽 열 | 월요일         | 수요일
--------|---------------|-------------
7       | 이고은 원장    | 이고은 원장
7:30    | 이민영 강사    | 이민영 강사
8       | 박진영 강사    | 이고은 원장

→ **올바른 추출 (총 6개):**
1. {"title": "이고은 원장", "days": ["월"], "startTime": "19:00", "endTime": "19:30", "instructor": "이고은"}
2. {"title": "이민영 강사", "days": ["월"], "startTime": "19:30", "endTime": "20:00", "instructor": "이민영"}
3. {"title": "박진영 강사", "days": ["월"], "startTime": "20:00", "endTime": "20:30", "instructor": "박진영"}
4. {"title": "이고은 원장", "days": ["수"], "startTime": "19:00", "endTime": "19:30", "instructor": "이고은"}
5. {"title": "이민영 강사", "days": ["수"], "startTime": "19:30", "endTime": "20:00", "instructor": "이민영"}
6. {"title": "이고은 원장", "days": ["수"], "startTime": "20:00", "endTime": "20:30", "instructor": "이고은"}

**잘못된 예시 (절대 금지!):**
- ❌ {"title": "이고은 원장", "days": ["월"], "startTime": "19:00", "endTime": "20:00"} ← 이민영 시간 먹음! **"7" 행만 차지하는데 1시간으로 잘못!**
- ❌ "7-7:30" 행인데 19:00-19:20, 19:20-19:30으로 쪼갬
- ❌ 셀이 크다고 1시간으로 만듦 **← 경계선 확인 안 하고 임의로 시간 늘림!**
- ⚠️⚠️⚠️ **중요: "7" 행 셀이 "7:30" 행 경계선까지 안 내려가면 절대 20:00까지 안 됨! 무조건 19:30까지만!**

**학원/PT 수업 시간대 컨텍스트**:
- 학원이나 PT 수업은 **오후/저녁 시간대**에만 있습니다
- 시간표 제목이나 주변 시간(18:00, 19:00, 20:00 등)을 보고 오후 시간으로 변환
- **절대 학원 수업이 07:00에 있을 수 없습니다!**

예시:
- "1시~2시 PM" → startTime: "13:00", endTime: "14:00"
- "5시~6시30분 PM" → startTime: "17:00", endTime: "18:30"
- "오후 3시~4시30분" → startTime: "15:00", endTime: "16:30"
- "7-7:30" (학원 시간표) → startTime: "19:00", endTime: "19:30"
- "8-8:30" (학원 시간표) → startTime: "20:00", endTime: "20:30"

**절대 오전(00:00~11:59)에 학원/축구 수업이 있을 수 없음**.
PM이나 오후가 보이면 반드시 13:00 이후로 변환!

반드시 유효한 JSON만 반환하고, 다른 설명은 포함하지 마세요.
`;

        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;
        let text = response.text();

        console.log(`✅ [${i + 1}/${req.files.length}] ${file.originalname} OCR 완료`);
        console.log(`📝 Gemini 응답 원본:\n${text.substring(0, 500)}...`);

        // JSON 파싱
        // Gemini가 마크다운 코드 블록으로 감쌀 수 있으므로 제거
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        let parsedSchedules;
        try {
          parsedSchedules = JSON.parse(text);
          console.log(`📊 [${i + 1}/${req.files.length}] ${parsedSchedules.schedules?.length || 0}개의 시간표 발견`);
          if (parsedSchedules.schedules?.length > 0) {
            console.log(`📋 첫 번째 시간표:`, JSON.stringify(parsedSchedules.schedules[0], null, 2));
          }
        } catch (parseError) {
          console.error(`❌ [${i + 1}/${req.files.length}] JSON 파싱 실패:`, parseError.message);
          console.error(`원본 텍스트:`, text);
          parsedSchedules = { schedules: [] };
        }

        // sourceImageIndex 추가 (시간 수정 제거 - OCR이 정확히 인식하도록 프롬프트 개선)
        const schedulesWithIndex = (parsedSchedules.schedules || []).map(schedule => ({
          ...schedule,
          sourceImage: file.originalname,
          sourceImageIndex: i
        }));

        // imageTitle 추출 (AI가 분석한 제목)
        const extractedTitle = parsedSchedules.imageTitle || null;
        console.log(`📌 [${i + 1}/${req.files.length}] 추출된 이미지 제목: "${extractedTitle || '없음'}"`);

        // 이민영 강사 디버깅
        const leeminSchedules = schedulesWithIndex.filter(s =>
          (s.title && s.title.includes('이민영')) ||
          (s.instructor && s.instructor.includes('이민영'))
        );
        if (leeminSchedules.length > 0) {
          console.log(`🔍 [${i + 1}/${req.files.length}] 이민영 강사 ${leeminSchedules.length}개 발견:`);
          leeminSchedules.forEach(s => {
            console.log(`   - ${s.days?.join(',')} ${s.startTime}-${s.endTime} "${s.title}"`);
          });
        }

        scheduleResults.push({
          success: true,
          fileName: file.originalname,
          schedules: schedulesWithIndex,
          imageTitle: extractedTitle // AI가 추출한 제목
        });

      } catch (error) {
        console.error(`이미지 분석 실패 (${file.originalname}):`, error);
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

    console.log('📊 이미지별 추출 결과:');
    scheduleResults.forEach((result, idx) => {
      console.log(`  이미지 ${idx + 1} (${result.fileName}): ${result.schedules?.length || 0}개 추출`);
      if (result.schedules && result.schedules.length > 0) {
        console.log('    샘플:', result.schedules.slice(0, 3).map(s => `${s.title} ${s.startTime}-${s.endTime}`));
      }
    });
    console.log(`📦 총 합계: ${allSchedules.length}개 스케줄`);

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
          console.log('🍱 점심시간 자동 추가:', lunchTime);
        }
      }
    };

    const timeToMinutes = (time) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    addLunchTimeIfMissing(allSchedules);

    console.log(`🎉 모든 이미지 처리 완료! 총 ${allSchedules.length}개의 시간표 추출`);

    // ========== 중복 제거 및 병합 로직 ==========
    console.log('🔧 중복 제거 및 연속 시간 병합 시작...');
    const mergedSchedules = mergeConsecutiveSchedules(allSchedules);
    console.log(`✅ 병합 완료: ${allSchedules.length}개 → ${mergedSchedules.length}개 (${allSchedules.length - mergedSchedules.length}개 병합됨)`);
    allSchedules = mergedSchedules;

    // ========== 새로운 분석 로직 적용 ==========
    const { detectBaseScheduleFromImages, extractBaseSchedules } = require('../utils/scheduleAnalysis/detectBaseSchedule');
    const { generateTitlesForImages } = require('../utils/scheduleAnalysis/generateScheduleTitle');

    // 1. 기본 베이스 감지 (학교 시간표 자동 인식)
    console.log('📋 scheduleResults 구조:', scheduleResults.map(r => ({ fileName: r.fileName, scheduleCount: r.schedules?.length })));
    const baseAnalysis = detectBaseScheduleFromImages(scheduleResults);
    console.log('📊 baseAnalysis 결과:', baseAnalysis.map(r => ({ fileName: r.fileName, isBase: r.isBaseSchedule, scheduleCount: r.schedules?.length })));

    // 2. 이미지별 제목 생성
    const { schedulesByImage: titledImages, overallTitle } = generateTitlesForImages(scheduleResults);

    // 3. 기본 베이스 스케줄 추출
    const baseSchedules = extractBaseSchedules(baseAnalysis);
    console.log('📚 최종 baseSchedules:', baseSchedules.length, '개');

    const responseData = {
      success: true,
      allSchedules: allSchedules,
      totalSchedules: allSchedules.length,
      schedulesByImage: titledImages, // 제목이 포함된 이미지별 정보
      overallTitle: overallTitle, // 전체 제목
      baseSchedules: baseSchedules, // 기본 베이스 스케줄 (학교)
      baseAnalysis: baseAnalysis, // 기본 베이스 분석 결과
    };

    console.log('📤 응답 전송 중... (데이터 크기:', JSON.stringify(responseData).length, 'bytes)');

    res.json(responseData);

    console.log('✅ 응답 전송 완료!');

  } catch (error) {
    console.error('시간표 분석 에러:', error);
    res.status(500).json({
      error: '시간표 분석 중 오류가 발생했습니다.',
      details: error.message,
    });
  }
};

// Multer 미들웨어 export
exports.uploadMiddleware = upload;
