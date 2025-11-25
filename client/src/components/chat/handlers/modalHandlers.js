/**
 * ============================================================================
 * modalHandlers.js - 모달 관련 이벤트 핸들러 팩토리 함수들
 * ============================================================================
 */

/**
 * 스케줄 적용 핸들러 생성
 */
export const createHandleSchedulesApplied = ({
  setShowOptimizationModal,
  onSchedulesExtracted,
  setChatHistory,
  onClose
}) => {
  return (appliedSchedules, applyScope = 'month') => {
    setShowOptimizationModal(false);

    // 부모 컴포넌트에 전달
    if (onSchedulesExtracted) {
      // 색상 제거
      const schedulesWithoutColor = appliedSchedules.map(s => {
        const { color, sourceImageIndex, sourceImage, ...rest } = s;
        return rest;
      });

      onSchedulesExtracted({
        type: 'schedule_selected',
        schedules: schedulesWithoutColor,
        applyScope: applyScope,
        data: {
          schedules: schedulesWithoutColor,
          conflicts: [],
          age: null,
          gradeLevel: null
        }
      });
    }

    // 완료 메시지
    const finalMessage = {
      id: Date.now(),
      sender: 'bot',
      text: '시간표 입력 완료!',
      timestamp: new Date()
    };

    setChatHistory(prev => [...prev, finalMessage]);

    // 2초 후 닫기
    setTimeout(() => {
      if (onClose) {
        onClose();
      }
    }, 2000);
  };
};

/**
 * 중복 이미지 처리 핸들러 생성
 */
export const createHandleDuplicateRemove = ({
  duplicateInfo,
  selectedImages,
  imagePreviews,
  setSelectedImages,
  setImagePreviews,
  setShowDuplicateModal,
  setDuplicateInfo,
  handleProcessImages
}) => {
  return () => {
    // 중복된 이미지의 인덱스 추출
    const duplicateIndices = duplicateInfo.duplicates.map(dup => dup.index);

    // 중복되지 않은 이미지만 필터링
    const filteredImages = selectedImages.filter((_, index) => !duplicateIndices.includes(index));
    const filteredPreviews = imagePreviews.filter((_, index) => !duplicateIndices.includes(index));

    // 상태 업데이트
    setSelectedImages(filteredImages);
    setImagePreviews(filteredPreviews);

    // 모달 닫기
    setShowDuplicateModal(false);
    setDuplicateInfo(null);

    // 중복 체크 건너뛰고 OCR 처리
    handleProcessImages(true);
  };
};

/**
 * 중복 이미지 무시 핸들러 생성
 */
export const createHandleDuplicateIgnore = ({
  setShowDuplicateModal,
  setDuplicateInfo,
  handleProcessImages
}) => {
  return () => {
    // 모달 닫기
    setShowDuplicateModal(false);
    setDuplicateInfo(null);

    // 중복 체크 건너뛰고 모든 이미지로 OCR 처리
    handleProcessImages(true);
  };
};
