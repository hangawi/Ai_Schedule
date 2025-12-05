/**
 * ===================================================================================================
 * ocrHandlers.js - OCR 처리 관련 이벤트 핸들러 팩토리 함수들
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/chat/handlers
 *
 * 🎯 주요 기능:
 *    - 사용자가 업로드한 이미지로부터 OCR을 통해 시간표 데이터를 추출
 *    - 이미지 유효성 검사 및 중복 이미지 감지 처리
 *    - 추출된 시간표 데이터를 상태로 관리 및 채팅 이력에 결과 메시지 추가
 *    - OCR 처리 과정의 진행 상태 (로딩, 에러, 진행률) 업데이트
 *
 * 🔗 연결된 파일:
 *    - ../../../utils/ocrUtils - OCR 유틸리티 함수 (extractSchedulesFromImages)
 *    - ../../hooks/useOcrProcessing - 이 핸들러를 사용하는 훅
 *    - ../../components/chat/TimetableUploadWithChat - 이 훅이 사용되는 컴포넌트
 *
 * 💡 UI 위치:
 *    - 챗봇 화면 > 이미지 업로드 후 OCR 분석 진행 과정, 중복 이미지 모달
 *
 * ✏️ 수정 가이드:
 *    - OCR 처리 로직 변경: `extractSchedulesFromImages` 함수 내부 수정
 *    - 중복 이미지 처리 방식 변경: `if (result.hasDuplicates)` 블록 수정
 *    - 추출된 시간표 데이터를 가공하는 로직 변경: `setExtractedSchedules` 호출 전 로직 수정
 *    - OCR 분석 완료 후 챗봇 메시지 내용 변경: `botMessage.text` 수정
 *
 * 📝 참고사항:
 *    - `skipDuplicateCheck` 파라미터를 통해 중복 검사 건너뛰기 가능
 *    - `originalSchedule`, `baseSchedules`, `overallTitle` 등 다양한 일정 관련 상태를 관리
 *    - 사용자에게 친화적인 진행률 및 메시지를 제공하여 OCR 처리 과정을 명확히 전달
 *
 * ===================================================================================================
 */

import { extractSchedulesFromImages } from '../../../utils/ocrUtils';

/**
 * createHandleProcessImages
 *
 * @description OCR을 통해 선택된 이미지에서 시간표를 추출하고, 추출 결과를 처리하는 비동기 핸들러를 생성합니다.
 *              이미지 유효성 검사, OCR 진행 상태 업데이트, 중복 이미지 처리, 추출된 시간표 상태 관리를 포함합니다.
 * @param {Object} params - 핸들러 생성에 필요한 파라미터 객체
 * @param {Array<File>} params.selectedImages - 현재 선택된 이미지 파일 목록 상태
 * @param {Function} params.setError - 에러 메시지 상태 셋터 함수
 * @param {Function} params.setIsProcessing - OCR 처리 진행 중 여부 상태 셋터 함수
 * @param {Function} params.setProgress - OCR 진행률 상태 셋터 함수 ({ current, total, message } 형식)
 * @param {Function} params.setExtractedSchedules - 추출된 시간표 목록 상태 셋터 함수
 * @param {Function} params.setSchedulesByImage - 이미지별로 정리된 시간표 목록 상태 셋터 함수
 * @param {Object | null} params.originalSchedule - 원본 전체 시간표 (수정 전) 상태
 * @param {Function} params.setOriginalSchedule - 원본 전체 시간표 상태 셋터 함수
 * @param {Function} params.setBaseSchedules - 기본 베이스 스케줄 목록 상태 셋터 함수
 * @param {Function} params.setOverallTitle - 전체 시간표의 제목 상태 셋터 함수
 * @param {Function} params.setFilteredSchedules - 필터링된 시간표 목록 상태 셋터 함수
 * @param {Function} params.setChatHistory - 채팅 이력 상태 셋터 함수
 * @param {Function} params.setDuplicateInfo - 중복 이미지 정보 상태 셋터 함수
 * @param {Function} params.setShowDuplicateModal - 중복 이미지 모달 표시 여부 상태 셋터 함수
 * @param {Function} params.setSelectedImages - 선택된 이미지 파일 목록 상태 셋터 함수 (중복 처리 시 사용)
 * @param {Function} params.setImagePreviews - 이미지 미리보기 목록 상태 셋터 함수 (중복 처리 시 사용)
 * @param {Array<string>} params.imagePreviews - 이미지 미리보기 URL/Base64 목록 상태
 * @returns {Function} 이미지 OCR 처리 함수 (skipDuplicateCheck 불리언 인자를 받음)
 *
 * @example
 * // useOcrProcessing 훅 내에서 사용 예시
 * const handleProcessImages = createHandleProcessImages({
 *   selectedImages, setError, setIsProcessing, setProgress, ...
 * });
 * <Button onClick={() => handleProcessImages(false)}>OCR 시작</Button>
 *
 * @note
 * - `selectedImages`가 비어있으면 에러를 설정하고 즉시 종료합니다.
 * - `extractSchedulesFromImages` 함수를 호출하여 실제 OCR 작업을 수행합니다.
 * - 중복 이미지가 감지되면 `setDuplicateInfo`와 `setShowDuplicateModal`을 통해 사용자에게 중복 모달을 띄웁니다.
 * - 추출된 시간표 데이터는 `sourceImageIndex`를 재할당하여 일관성을 유지합니다.
 * - OCR 분석이 완료되면 챗봇 메시지를 생성하여 채팅 이력에 추가하고, 추출된 시간표에 대한 사용자의 추가 입력을 유도합니다.
 */
export const createHandleProcessImages = ({
  selectedImages,
  setError,
  setIsProcessing,
  setProgress,
  setExtractedSchedules,
  setSchedulesByImage,
  setOriginalSchedule,
  originalSchedule,
  setBaseSchedules,
  setOverallTitle,
  setFilteredSchedules,
  setChatHistory,
  setDuplicateInfo,
  setShowDuplicateModal,
  setSelectedImages,
  setImagePreviews,
  imagePreviews
}) => {
  return async (skipDuplicateCheck = false) => {
    if (selectedImages.length === 0) {
      setError('최소 1개 이상의 이미지를 선택해주세요.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProgress({ current: 0, total: selectedImages.length, message: '준비 중...' });

    try {
      // OCR 처리
      setProgress({ current: 0, total: 100, message: `이미지 ${selectedImages.length}개 분석 중...` });

      const result = await extractSchedulesFromImages(selectedImages, (progressPercent) => {
        setProgress({ current: progressPercent, total: 100, message: `분석 중... ${progressPercent}%` });
      }, null, skipDuplicateCheck);

      // 중복 감지 처리
      if (result.hasDuplicates && result.duplicates && result.duplicates.length > 0) {
        setDuplicateInfo(result);
        setShowDuplicateModal(true);
        setIsProcessing(false);
        return;
      }

      // 최적화된 스케줄 사용
      const schedulesToUse = result.optimizedSchedules || result.schedules;
      setExtractedSchedules(schedulesToUse);

      // schedulesByImage 필터링
      const selectedImageNames = [...new Set(schedulesToUse.map(s => s.sourceImage))];
      let filteredSchedulesByImage = result.schedulesByImage.filter(img =>
        selectedImageNames.includes(img.fileName)
      );

      // 실제로 선택된 스케줄이 있는 이미지만 유지
      const imagesWithSchedules = filteredSchedulesByImage.filter(img =>
        schedulesToUse.some(s => s.sourceImage === img.fileName)
      );

      filteredSchedulesByImage = imagesWithSchedules;

      // sourceImageIndex 재할당
      const reindexedSchedulesByImage = filteredSchedulesByImage.map((img, newIndex) => {
        return {
          ...img,
          schedules: img.schedules.map(schedule => ({
            ...schedule,
            sourceImageIndex: newIndex
          }))
        };
      });

      // schedulesToUse의 sourceImageIndex도 재할당
      const imageNameToNewIndex = {};
      filteredSchedulesByImage.forEach((img, newIndex) => {
        imageNameToNewIndex[img.fileName] = newIndex;
      });

      const reindexedSchedulesToUse = schedulesToUse.map(schedule => ({
        ...schedule,
        sourceImageIndex: imageNameToNewIndex[schedule.sourceImage]
      }));

      setSchedulesByImage(reindexedSchedulesByImage);
      setExtractedSchedules(reindexedSchedulesToUse);

      // 원본 전체 시간표 저장
      if (!originalSchedule && result.allSchedules) {
        setOriginalSchedule(JSON.parse(JSON.stringify(result.allSchedules)));
      }

      // 기본 베이스 스케줄 저장
      if (result.baseSchedules && result.baseSchedules.length > 0) {
        setBaseSchedules(result.baseSchedules);
      }

      // 전체 제목 저장
      if (reindexedSchedulesByImage.length > 0) {
        const titles = reindexedSchedulesByImage.map(img => img.title || img.fileName).filter(Boolean);
        const newOverallTitle = titles.join(' + ') || '업로드된 시간표';
        setOverallTitle(newOverallTitle);
      }

      setFilteredSchedules(reindexedSchedulesToUse);
      setProgress({ current: 100, total: 100, message: 'OCR 분석 완료!' });

      // 필터링된 이미지 정보 추가
      const removedImages = result.schedulesByImage.filter(img =>
        !imagesWithSchedules.some(kept => kept.fileName === img.fileName)
      );

      // 이미지별로 반 목록 구성
      let classListByImage = '';
      if (reindexedSchedulesByImage && reindexedSchedulesByImage.length > 0) {
        classListByImage = reindexedSchedulesByImage.map((imageResult, idx) => {
          const classNames = [...new Set(imageResult.schedules.map(s => s.title))];
          const classList = classNames.map((name, i) => `  ${i + 1}. ${name}`).join('\n');
          const imageTitle = imageResult.title || `이미지 ${idx + 1}`;
          return `📸 ${imageTitle} (${imageResult.fileName}):\n${classList}`;
        }).join('\n\n');

        // 나이 제한으로 제외된 이미지 정보 추가
        if (removedImages.length > 0) {
          const removedList = removedImages.map(img =>
            `  ⚠️ ${img.title || img.fileName} - 학생 나이에 맞지 않아 제외됨`
          ).join('\n');
          classListByImage += `\n\n🚫 **제외된 이미지**:\n${removedList}`;
        }
      } else {
        const classNames = [...new Set(result.schedules.map(s => s.title))];
        classListByImage = classNames.map((name, idx) => `${idx + 1}. ${name}`).join('\n');
      }

      // 동적 예시 생성
      let exampleTexts = [];
      if (reindexedSchedulesByImage && reindexedSchedulesByImage.length > 0) {
        const firstImageClasses = [...new Set(reindexedSchedulesByImage[0].schedules.map(s => s.title))];
        if (firstImageClasses.length >= 1) {
          exampleTexts.push(`"${firstImageClasses[0]}만 할거야"`);
        }
        if (firstImageClasses.length >= 2) {
          exampleTexts.push(`"${firstImageClasses[1]} 반 하고 싶어요"`);
        }
        const hasFrequency = firstImageClasses.some(c => c.includes('주') && (c.includes('회') || c.includes('일')));
        if (hasFrequency) {
          exampleTexts.push(`"주5회만"`);
        } else {
          exampleTexts.push(`"월수금만"`);
        }
      } else {
        exampleTexts = ['"1학년만"', '"오전만"', '"월수금만"'];
      }

      const exampleText = exampleTexts.join(', ');

      // 채팅 히스토리에 봇 메시지 추가
      const botMessage = {
        id: Date.now(),
        sender: 'bot',
        text: `시간표 이미지를 분석했어요! 총 ${result.schedules.length}개의 수업을 찾았고, 그중 ${schedulesToUse.length}개를 선택했습니다.\n\n📋 발견된 반 목록:\n${classListByImage}\n\n어떤 수업을 추가하고 싶으세요?\n예: ${exampleText}`,
        timestamp: new Date()
      };

      setChatHistory([botMessage]);

    } catch (err) {
      setError(err.message || 'OCR 처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };
};

