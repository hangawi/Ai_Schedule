/**
 * ===================================================================================================
 * imageProcessing.js - 이미지 전처리 및 중복 필터링 유틸리티
 * ===================================================================================================
 *
 * 📍 위치: 백엔드 > server/utils > imageProcessing.js
 * 🎯 주요 기능:
 *    - 업로드된 이미지 버퍼를 Gemini AI(Vision)에서 인식 가능한 Base64 인라인 데이터 형식으로 변환.
 *    - 여러 장의 이미지를 일괄 처리할 때, 기존 이미지 및 현재 배치 내의 이미지 간 중복을 자동 제거.
 *    - 중복 이미지 발견 시 사용자에게 알림을 보내거나 자동으로 걸러내는 필터링 로직 제공.
 *    - 이미지 유사도 분석을 통해 불필요한 AI 호출을 줄이고 서버 리소스 사용 최적화.
 *
 * 🔗 연결된 파일:
 *    - server/controllers/ocrController.js - 이미지 업로드 및 분석 요청 시 이 유틸리티들을 사용.
 *    - server/utils/imageHasher.js - 실제 중복 감지를 위한 해시 계산을 수행하기 위해 참조.
 *
 * ✏️ 수정 가이드:
 *    - AI 모델에 전달할 이미지의 해상도나 압축 방식을 변경하려면 convertToImageParts 함수 수정.
 *    - 중복 제거 시의 정밀도(유사도)를 변경하려면 filterDuplicateImages 호출 시의 threshold 값 조정.
 *
 * 📝 참고사항:
 *    - 이 모듈은 특히 시간표 업로드 과정에서 동일한 파일을 여러 번 올리는 실수를 방지하는 데 최적화됨.
 *
 * ===================================================================================================
 */

/**
 * convertToImageParts
 * @description 이미지 버퍼를 Gemini API의 요구 규격인 inlineData 객체 배열로 변환합니다.
 * @param {Buffer} imageBuffer - 원본 이미지 바이너리 데이터.
 * @param {string} mimeType - 이미지의 MIME 타입 (예: image/jpeg).
 * @returns {Array} AI 모델 요청에 주입할 이미지 데이터 배열.
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
 * filterDuplicateImages
 * @description 업로드된 파일 리스트 중 중복된 항목들을 자동으로 제외하고 유니크한 파일들만 선별하여 반환합니다.
 * @param {Array} files - 새로 업로드된 파일 객체 배열.
 * @param {Array} existingImages - 이미 처리된 기존 이미지 데이터 배열.
 * @param {Function} detectDuplicate - 중복 여부를 판별할 함수.
 * @param {number} [threshold=95] - 중복 판단 유사도 기준.
 * @returns {Promise<Object>} 처리 대상 파일 목록 및 제거된 중복 내역.
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

  return {
    filesToProcess,
    removedDuplicates,
    newImages: currentBatchImages
  };
}

/**
 * checkDuplicates
 * @description 이미지 리스트에서 중복을 감지하여 상세 내역을 반환합니다. (사용자 선택 유도용)
 * @returns {Promise<Object|null>} 중복 발견 시 관련 정보 객체, 없을 경우 null.
 */
async function checkDuplicates(files, existingImages, detectDuplicate, threshold = 95) {

  const duplicates = [];
  const currentBatchImages = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    const allImagesToCompare = [...existingImages, ...currentBatchImages];
    const duplicateCheck = await detectDuplicate(file.buffer, file.originalname, allImagesToCompare, threshold);

    if (duplicateCheck.isDuplicate) {
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
    return {
      hasDuplicates: true,
      duplicates: duplicates,
      totalImages: files.length,
      message: '중복된 이미지가 발견되었습니다. 처리 방법을 선택해주세요.'
    };
  }
  return null;
}

module.exports = {
  convertToImageParts,
  filterDuplicateImages,
  checkDuplicates
};
