/**
 * 이미지 처리 유틸리티
 * 이미지 버퍼를 Gemini API에 전달할 수 있는 형식으로 변환
 */

/**
 * 이미지 버퍼를 Gemini API용 imageParts 형식으로 변환
 * @param {Buffer} imageBuffer - 이미지 버퍼
 * @param {string} mimeType - MIME 타입
 * @returns {Array} Gemini API용 imageParts 배열
 */
function convertToImageParts(imageBuffer, mimeType) {
  return [
    {
      inlineData: {
        data: imageBuffer.toString('base64'),
        mimeType: mimeType,
      },
    },
  ];
}

/**
 * 여러 이미지에서 중복을 자동 제거하고 처리할 파일 목록 반환
 * @param {Array} files - 파일 배열
 * @param {Array} existingImages - 기존 이미지 저장소
 * @param {Function} detectDuplicate - 중복 감지 함수
 * @param {number} threshold - 유사도 임계값
 * @returns {Object} { filesToProcess, removedDuplicates, newImages }
 */
async function filterDuplicateImages(files, existingImages, detectDuplicate, threshold = 95) {
  const currentBatchImages = [];
  const indicesToRemove = [];
  const removedDuplicates = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    // 기존 저장소 + 현재 배치와 비교
    const allImagesToCompare = [...existingImages, ...currentBatchImages];
    const duplicateCheck = await detectDuplicate(file.buffer, file.originalname, allImagesToCompare, threshold);

    if (duplicateCheck.isDuplicate) {
      console.log(`🗑️ 중복 제거: ${file.originalname} ≈ ${duplicateCheck.duplicateWith} (${duplicateCheck.similarity}%)`);
      indicesToRemove.push(i);
      removedDuplicates.push({
        filename: file.originalname,
        duplicateWith: duplicateCheck.duplicateWith,
        similarity: duplicateCheck.similarity
      });
    } else {
      // 중복이 아니면 현재 배치에 추가
      currentBatchImages.push({
        buffer: file.buffer,
        hash: duplicateCheck.newHash,
        filename: file.originalname
      });
    }
  }

  // 중복되지 않은 파일만 처리 목록에 포함
  const filesToProcess = files.filter((_, index) => !indicesToRemove.includes(index));
  console.log(`✅ ${files.length}개 → ${filesToProcess.length}개로 감소 (${removedDuplicates.length}개 제거)`);

  return {
    filesToProcess,
    removedDuplicates,
    newImages: currentBatchImages
  };
}

/**
 * 이미지에서 중복을 감지하고 사용자에게 알림
 * @param {Array} files - 파일 배열
 * @param {Array} existingImages - 기존 이미지 저장소
 * @param {Function} detectDuplicate - 중복 감지 함수
 * @param {number} threshold - 유사도 임계값
 * @returns {Object|null} 중복이 있으면 { hasDuplicates, duplicates, totalImages }, 없으면 null
 */
async function checkDuplicates(files, existingImages, detectDuplicate, threshold = 95) {
  console.log('🔍 중복 이미지 감지 중...');
  console.log(`📦 기존 이미지 저장소: ${existingImages.length}개`);

  const duplicates = [];
  const currentBatchImages = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`🔍 [${i + 1}/${files.length}] ${file.originalname} 중복 체크...`);

    const allImagesToCompare = [...existingImages, ...currentBatchImages];
    const duplicateCheck = await detectDuplicate(file.buffer, file.originalname, allImagesToCompare, threshold);
    console.log(`   → 유사도: ${duplicateCheck.similarity || 0}%, 중복: ${duplicateCheck.isDuplicate ? 'YES' : 'NO'}`);

    if (duplicateCheck.isDuplicate) {
      console.log(`⚠️ 중복 발견: ${file.originalname} ≈ ${duplicateCheck.duplicateWith} (${duplicateCheck.similarity}%)`);
      duplicates.push({
        filename: file.originalname,
        duplicateWith: duplicateCheck.duplicateWith,
        similarity: duplicateCheck.similarity,
        index: i
      });
    } else {
      currentBatchImages.push({
        buffer: file.buffer,
        hash: duplicateCheck.newHash,
        filename: file.originalname
      });
    }
  }

  if (duplicates.length > 0) {
    console.log(`⚠️ ${duplicates.length}개 중복 발견 - 사용자 확인 대기`);
    return {
      hasDuplicates: true,
      duplicates: duplicates,
      totalImages: files.length,
      message: '중복된 이미지가 발견되었습니다. 처리 방법을 선택해주세요.'
    };
  }

  console.log('✅ 중복 없음');
  return null;
}

module.exports = {
  convertToImageParts,
  filterDuplicateImages,
  checkDuplicates
};
