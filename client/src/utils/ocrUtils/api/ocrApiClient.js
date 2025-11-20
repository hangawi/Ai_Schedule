/**
 * OCR API 클라이언트
 */

import { auth } from '../../../config/firebaseConfig';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

/**
 * 이미지에서 OCR 수행 (Vision API 사용)
 * @param {File} imageFile - 이미지 파일
 * @returns {Promise<string>} - 추출된 텍스트
 */
export const performOCR = async (imageFile) => {
  const formData = new FormData();
  formData.append('image', imageFile);

  try {
    const response = await fetch(`${API_BASE_URL}/api/ocr/extract`, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
      }
    });

    if (!response.ok) {
      throw new Error('OCR 처리 실패');
    }

    const data = await response.json();
    return data.text || '';
  } catch (error) {
    throw error;
  }
};

/**
 * 여러 이미지에서 구조화된 시간표 데이터 추출 (백엔드 API 사용)
 * @param {Array<File>} imageFiles - 이미지 파일 배열
 * @param {string} birthdate - 사용자 생년월일
 * @param {Function} progressCallback - 진행률 콜백 (10-50 범위)
 * @param {boolean} skipDuplicateCheck - 중복 체크 건너뛰기
 * @param {boolean} clearSession - 세션 초기화 여부
 * @returns {Promise<Array>} - 구조화된 시간표 배열
 */
export const analyzeScheduleImages = async (imageFiles, birthdate, progressCallback, skipDuplicateCheck = false, clearSession = true) => {
  const formData = new FormData();

  imageFiles.forEach((file) => {
    formData.append('images', file);
  });

  if (birthdate) {
    formData.append('birthdate', birthdate);
  }

  if (skipDuplicateCheck) {
    formData.append('skipDuplicateCheck', 'true');
  }

  // 새로운 업로드 세션 시작 (이전 이미지 기록 초기화)
  if (clearSession) {
    formData.append('clearSession', 'true');
  }

  let progressInterval = null;

  try {
    if (progressCallback) progressCallback(15);

    // 진행률 시뮬레이션 (서버 응답 대기 중)
    let currentProgress = 15;
    progressInterval = setInterval(() => {
      if (currentProgress < 80) {
        currentProgress += 5;
        if (progressCallback) progressCallback(currentProgress);
      }
    }, 2000); // 2초마다 5%씩 증가

    // 타임아웃 설정 (180초 = 3분)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000);

    const response = await fetch(`${API_BASE_URL}/api/ocr/analyze-schedule`, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
      },
      signal: controller.signal
    });

    clearInterval(progressInterval); // 진행률 시뮬레이션 중지
    progressInterval = null;
    clearTimeout(timeoutId);

    if (progressCallback) progressCallback(85);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`시간표 분석 실패: ${response.status}`);
    }

    if (progressCallback) progressCallback(90);

    // JSON 파싱도 타임아웃 추가
    const parseTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('JSON 파싱 타임아웃')), 10000)
    );

    const data = await Promise.race([
      response.json(),
      parseTimeout
    ]);

    if (progressCallback) progressCallback(95);
    return data; // 전체 데이터 반환 (allSchedules, schedulesByImage 포함)
  } catch (error) {
    // 에러 발생 시에도 진행률 시뮬레이션 중지
    if (progressInterval) {
      clearInterval(progressInterval);
    }

    if (error.name === 'AbortError') {
      throw new Error('이미지 분석 시간이 너무 오래 걸립니다 (3분 초과). 이미지 개수를 줄이거나 이미지 크기를 줄여주세요.');
    }
    throw error;
  }
};
