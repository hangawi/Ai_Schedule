/**
 * ===================================================================================================
 * modalHandlers.js - 모달 관련 이벤트 핸들러 팩토리 함수들
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/chat/handlers
 *
 * 🎯 주요 기능:
 *    - 최적화된 시간표가 적용된 후의 후처리 로직 (모달 닫기, 부모 컴포넌트에 일정 전달, 채팅 이력 추가)
 *    - 중복 이미지 발견 시, 중복 이미지를 제거하고 OCR 처리를 계속하는 핸들러
 *    - 중복 이미지 발견 시, 중복 이미지를 무시하고 모든 이미지로 OCR 처리를 계속하는 핸들러
 *
 * 🔗 연결된 파일:
 *    - ../../modals/ScheduleOptimizationModal - 이 핸들러를 사용하는 모달 컴포넌트
 *    - ../../modals/DuplicateModal - 이 핸들러를 사용하는 중복 이미지 모달 컴포넌트
 *
 * 💡 UI 위치:
 *    - 챗봇 화면 > 일정 최적화 모달, 중복 이미지 감지 모달
 *
 * ✏️ 수정 가이드:
 *    - 시간표 적용 후 추가적인 액션 필요 시: `createHandleSchedulesApplied` 함수 내 로직 추가
 *    - 중복 이미지 처리 방식 변경: `createHandleDuplicateRemove` 또는 `createHandleDuplicateIgnore` 함수 내 로직 수정
 *    - 모달 관련 상태 관리 변경 시: 해당 핸들러들의 파라미터 또는 내부 상태 업데이트 로직 수정
 *
 * 📝 참고사항:
 *    - 핸들러들은 주로 `useState` 셋터 함수들을 인자로 받아 상태를 업데이트합니다.
 *    - `setTimeout`을 사용하여 모달이 닫히기 전 사용자에게 완료 메시지를 보여줄 시간을 제공합니다.
 *    - `applyScope` 파라미터는 적용되는 시간표의 범위를 나타냅니다.
 *
 * ===================================================================================================
 */

/**
 * createHandleSchedulesApplied
 *
 * @description 최적화 모달에서 시간표가 적용된 후의 후처리 로직을 담은 핸들러를 생성합니다.
 *              모달을 닫고, 부모 컴포넌트에 추출된 시간표를 전달하며, 채팅 이력에 완료 메시지를 추가합니다.
 * @param {Object} params - 핸들러 생성에 필요한 파라미터 객체
 * @param {Function} params.setShowOptimizationModal - 최적화 모달 표시 여부 상태 셋터 함수
 * @param {Function} params.onSchedulesExtracted - 추출된 시간표를 부모 컴포넌트로 전달하는 콜백 함수
 * @param {Function} params.setChatHistory - 채팅 이력 상태 셋터 함수
 * @param {Function} params.onClose - 모달을 닫는 콜백 함수
 * @returns {Function} 시간표 적용 핸들러 (적용된 시간표와 적용 범위를 인자로 받음)
 *
 * @example
 * // ScheduleOptimizationModal 컴포넌트 내에서 사용 예시
 * const handleSchedulesApplied = createHandleSchedulesApplied({
 *   setShowOptimizationModal, onSchedulesExtracted, setChatHistory, onClose
 * });
 * <Button onClick={() => handleSchedulesApplied(schedules, 'week')}>적용</Button>
 *
 * @note
 * - 적용된 시간표에서 색상 정보는 제거되어 부모 컴포넌트로 전달됩니다.
 * - `onSchedulesExtracted` 콜백은 시간표의 타입, 내용, 적용 범위 등을 포함하는 객체를 전달받습니다.
 * - 최종 완료 메시지가 채팅 이력에 추가된 후 2초 뒤에 모달이 완전히 닫힙니다.
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
 * createHandleDuplicateRemove
 *
 * @description 중복 이미지 감지 모달에서 '중복 이미지 제거' 버튼 클릭 시 호출될 핸들러를 생성합니다.
 *              감지된 중복 이미지를 `selectedImages` 및 `imagePreviews` 상태에서 필터링하여 제거하고,
 *              모달을 닫은 후 이미지 OCR 처리를 다시 시작합니다.
 * @param {Object} params - 핸들러 생성에 필요한 파라미터 객체
 * @param {Object} params.duplicateInfo - 중복 이미지 정보 객체 (duplicates 배열 포함)
 * @param {Array<File>} params.selectedImages - 현재 선택된 이미지 파일 목록 상태
 * @param {Array<string>} params.imagePreviews - 현재 이미지 미리보기 URL/Base64 목록 상태
 * @param {Function} params.setSelectedImages - 선택된 이미지 파일 목록 상태 셋터 함수
 * @param {Function} params.setImagePreviews - 이미지 미리보기 목록 상태 셋터 함수
 * @param {Function} params.setShowDuplicateModal - 중복 이미지 모달 표시 여부 상태 셋터 함수
 * @param {Function} params.setDuplicateInfo - 중복 이미지 정보 상태 셋터 함수
 * @param {Function} params.handleProcessImages - 이미지 OCR 처리를 시작하는 함수
 * @returns {Function} 중복 이미지 제거 핸들러
 *
 * @example
 * // DuplicateModal 컴포넌트 내에서 사용 예시
 * const handleDuplicateRemove = createHandleDuplicateRemove({
 *   duplicateInfo, selectedImages, imagePreviews, setSelectedImages,
 *   setImagePreviews, setShowDuplicateModal, setDuplicateInfo, handleProcessImages
 * });
 * <Button onClick={handleDuplicateRemove}>중복 제거</Button>
 *
 * @note
 * - `duplicateInfo.duplicates` 배열에는 중복으로 판정된 이미지의 인덱스 정보가 포함되어 있습니다.
 * - 필터링 후 `setShowDuplicateModal(false)`와 `setDuplicateInfo(null)`을 통해 모달 상태를 초기화합니다.
 * - `handleProcessImages(true)`를 호출하여 OCR 처리가 중복 체크를 건너뛰고 진행되도록 합니다.
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
 * createHandleDuplicateIgnore
 *
 * @description 중복 이미지 감지 모달에서 '모두 사용' (또는 '무시') 버튼 클릭 시 호출될 핸들러를 생성합니다.
 *              모달을 닫고, 중복 이미지 확인 단계를 건너뛰고 모든 이미지를 대상으로 OCR 처리를 계속합니다.
 * @param {Object} params - 핸들러 생성에 필요한 파라미터 객체
 * @param {Function} params.setShowDuplicateModal - 중복 이미지 모달 표시 여부 상태 셋터 함수
 * @param {Function} params.setDuplicateInfo - 중복 이미지 정보 상태 셋터 함수
 * @param {Function} params.handleProcessImages - 이미지 OCR 처리를 시작하는 함수
 * @returns {Function} 중복 이미지 무시 핸들러
 *
 * @example
 * // DuplicateModal 컴포넌트 내에서 사용 예시
 * const handleDuplicateIgnore = createHandleDuplicateIgnore({
 *   setShowDuplicateModal, setDuplicateInfo, handleProcessImages
 * });
 * <Button onClick={handleDuplicateIgnore}>모두 사용</Button>
 *
 * @note
 * - `setShowDuplicateModal(false)`와 `setDuplicateInfo(null)`을 통해 모달 상태를 초기화합니다.
 * - `handleProcessImages(true)`를 호출하여 OCR 처리가 중복 체크를 건너뛰고 모든 이미지에 대해 진행되도록 합니다.
 * - 이 핸들러는 중복된 이미지를 제거하지 않고 그대로 유지합니다.
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
