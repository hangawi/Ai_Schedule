/**
 * ===================================================================================================
 * imageHasher.js - 이미지 해싱 및 중복 감지 유틸리티
 * ===================================================================================================
 *
 * 📍 위치: 백엔드 > server/utils > imageHasher.js
 * 🎯 주요 기능:
 *    - Perceptual Hashing (pHash) 알고리즘을 사용하여 이미지의 고유한 시각적 지문을 생성.
 *    - Sharp 라이브러리를 통해 이미지를 표준 규격(256x256, 그레이스케일)으로 전처리하여 분석 정확도 향상.
 *    - 해밍 거리(Hamming Distance)를 기반으로 두 이미지 간의 시각적 유사도를 퍼센트 단위로 산출.
 *    - 새로 업로드된 이미지가 기존에 처리된 이미지와 중복되는지 여부를 임계값(Threshold)에 따라 판별.
 *
 * 🔗 연결된 파일:
 *    - server/controllers/ocrController.js - 이미지 분석 전 중복 업로드를 방지하기 위해 호출.
 *    - server/utils/imageProcessing.js - 일괄 이미지 처리 및 필터링 과정에서 활용.
 *
 * ✏️ 수정 가이드:
 *    - 중복 판단의 엄격도를 조절하려면 detectDuplicate 함수의 threshold 기본값(현재 98) 수정.
 *    - 해싱 속도나 정밀도를 조정하려면 calculateImageHash 내의 리사이즈 크기 수정.
 *
 * 📝 참고사항:
 *    - 파일명이나 메타데이터가 달라도 시각적으로 유사하면 중복으로 감지하도록 설계됨.
 *
 * ===================================================================================================
 */

const sharp = require('sharp');
const imghash = require('imghash');

/**
 * calculateImageHash
 * @description 이미지 버퍼를 표준화한 뒤 Perceptual Hash 값을 추출합니다.
 * @param {Buffer} imageBuffer - 입력 이미지의 바이너리 버퍼.
 * @returns {Promise<string>} 생성된 이미지 해시값 문자열.
 */
async function calculateImageHash(imageBuffer) {
  try {
    // sharp로 이미지를 표준화 (리사이즈, 포맷 통일)
    const processedBuffer = await sharp(imageBuffer)
      .resize(256, 256, { fit: 'inside' })
      .grayscale()
      .toBuffer();

    // perceptual hash 계산
    const hash = await imghash.hash(processedBuffer);
    return hash;
  } catch (error) {
    throw error;
  }
}

/**
 * calculateSimilarity
 * @description 두 개의 해시 문자열을 비교하여 해밍 거리를 구하고, 이를 유사도(%)로 환산합니다.
 * @param {string} hash1 - 첫 번째 이미지 해시.
 * @param {string} hash2 - 두 번째 이미지 해시.
 * @returns {number} 0~100 사이의 유사도 수치.
 */
function calculateSimilarity(hash1, hash2) {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) {
    return 0;
  }

  let hammingDistance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      hammingDistance++;
    }
  }

  // 유사도 = (1 - 해밍거리 / 총길이) * 100
  const similarity = ((1 - hammingDistance / hash1.length) * 100).toFixed(2);
  return parseFloat(similarity);
}

/**
 * detectDuplicate
 * @description 새로운 이미지가 기존 이미지 목록 중에 중복된 것이 있는지 검사합니다.
 * @param {Buffer} newImageBuffer - 새 이미지 버퍼.
 * @param {string} newImageFilename - 새 이미지 파일명.
 * @param {Array} existingImages - 기존 이미지 객체({buffer, hash, filename}) 배열.
 * @param {number} [threshold=98] - 중복으로 간주할 최소 유사도 기준.
 * @returns {Promise<Object>} 중복 여부 및 상세 정보를 담은 결과 객체.
 */
async function detectDuplicate(newImageBuffer, newImageFilename, existingImages, threshold = 98) {
  try {
    // 새 이미지의 해시 계산
    const newHash = await calculateImageHash(newImageBuffer);

    // 기존 이미지들과 비교
    for (const existing of existingImages) {
      // ⚠️ 같은 파일명이면 건너뛰기 (자기 자신과 비교 방지)
      if (existing.filename === newImageFilename) {
        continue;
      }

      const existingHash = existing.hash || await calculateImageHash(existing.buffer);
      const similarity = calculateSimilarity(newHash, existingHash);

      if (similarity >= threshold) {
        return {
          isDuplicate: true,
          duplicateWith: existing.filename,
          similarity: similarity,
          newHash: newHash
        };
      }
    }

    return {
      isDuplicate: false,
      duplicateWith: null,
      similarity: 0,
      newHash: newHash
    };
  } catch (error) {
    throw error;
  }
}

module.exports = {
  calculateImageHash,
  calculateSimilarity,
  detectDuplicate
};
