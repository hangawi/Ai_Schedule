const sharp = require('sharp');
const imghash = require('imghash');

/**
 * 이미지의 Perceptual Hash 계산
 * @param {Buffer} imageBuffer - 이미지 버퍼
 * @returns {Promise<string>} - 이미지 해시값
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
    console.error('❌ 이미지 해시 계산 실패:', error);
    throw error;
  }
}

/**
 * 두 이미지 해시 간 유사도 계산 (Hamming Distance)
 * @param {string} hash1 - 첫 번째 해시
 * @param {string} hash2 - 두 번째 해시
 * @returns {number} - 유사도 퍼센트 (0~100)
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
 * 중복 이미지 감지
 * @param {Buffer} newImageBuffer - 새로 업로드된 이미지 버퍼
 * @param {string} newImageFilename - 새 이미지 파일명
 * @param {Array<{buffer: Buffer, hash: string, filename: string}>} existingImages - 기존 이미지들
 * @param {number} threshold - 중복 판단 임계값 (기본 95%)
 * @returns {Promise<{isDuplicate: boolean, duplicateWith: string|null, similarity: number}>}
 */
async function detectDuplicate(newImageBuffer, newImageFilename, existingImages, threshold = 95) {
  try {
    // 새 이미지의 해시 계산
    const newHash = await calculateImageHash(newImageBuffer);

    // 기존 이미지들과 비교
    for (const existing of existingImages) {
      // ⚠️ 같은 파일명이면 건너뛰기 (자기 자신과 비교 방지)
      if (existing.filename === newImageFilename) {
        console.log(`⏭️ 스킵: ${existing.filename} (자기 자신)`);
        continue;
      }

      const existingHash = existing.hash || await calculateImageHash(existing.buffer);
      const similarity = calculateSimilarity(newHash, existingHash);

      console.log(`🔍 비교: ${existing.filename} - 유사도 ${similarity}%`);

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
    console.error('❌ 중복 감지 실패:', error);
    throw error;
  }
}

module.exports = {
  calculateImageHash,
  calculateSimilarity,
  detectDuplicate
};
