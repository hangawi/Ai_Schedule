/**
 * ===================================================================================================
 * [TimetableUploadBox.js] - 시간표 이미지 업로드 및 OCR 처리 모달 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > client/src/components/chat/TimetableUploadBox.js
 *
 * 🎯 주요 기능:
 *    - 사용자가 시간표 이미지를 선택하고 업로드하는 UI 제공 (최대 10개)
 *    - 선택된 이미지 미리보기 및 삭제 기능
 *    - 이미지 처리 중 진행 상태(Progress bar) 및 메시지 표시
 *    - OCR 처리(extractSchedulesFromImages)를 호출하고, 처리 시간 초과(Timeout) 관리
 *    - 처리 완료 후 결과 요약 표시 또는 최적화 결과 모달(ScheduleOptimizationModal) 트리거
 *
 * 🔗 연결된 파일:
 *    - ../../utils/ocrUtils.js: `extractSchedulesFromImages` 함수를 사용하여 실제 OCR 및 스케줄 추출 로직 수행
 *    - ../../services/userService.js: 사용자 프로필(생년월일) 정보를 가져오기 위해 사용
 *    - ../modals/ScheduleOptimizationModal.js: 추출 및 최적화된 스케줄 조합을 사용자에게 보여주기 위해 호출
 *    - ./TimetableUploadWithChat.js: 이 컴포넌트를 감싸고 채팅과 통합하는 상위 컴포넌트
 *
 * 💡 UI 위치:
 *    - 채팅창 내에서 '시간표 업로드' 버튼 클릭 시 전체 화면을 덮는 모달 형태로 표시됨
 *
 * ✏️ 수정 가이드:
 *    - 이미지 최대 업로드 개수를 변경하려면: `handleImageSelect` 함수의 '10'을 수정합니다.
 *    - OCR 처리 로직을 수정하려면: `../../utils/ocrUtils.js`의 `extractSchedulesFromImages` 함수를 확인해야 합니다.
 *    - 처리 시간 초과(timeout)를 조절하려면: `handleProcessImages` 내의 `timeoutPromise` 값을 변경합니다.
 *    - 진행률 표시 메시지를 수정하려면: `handleProcessImages` 내의 `progressInterval` 로직을 수정합니다.
 *
 * 📝 참고사항:
 *    - 스케줄 추출을 위해 사용자 프로필에 생년월일 정보가 반드시 필요합니다.
 *    - 이미지 처리 시간은 이미지의 복잡성과 개수에 따라 달라질 수 있으며, 부드러운 진행률 표시를 위해 예상 시간을 기반으로 한 애니메이션 로직이 포함되어 있습니다.
 *
 * ===================================================================================================
 */
import React, { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, FileText, AlertCircle } from 'lucide-react';
import { extractSchedulesFromImages } from '../../utils/ocrUtils';
import { userService } from '../../services/userService';
import ScheduleOptimizationModal from '../modals/ScheduleOptimizationModal';

/**
 * TimetableUploadBox
 *
 * @description 사용자가 시간표 이미지를 업로드하고, OCR 처리를 통해 스케줄을 추출하는 과정을 관리하는 모달 컴포넌트.
 * @param {object} props - 컴포넌트 props
 * @param {function} props.onSchedulesExtracted - 스케줄 추출 과정에서 발생하는 이벤트를 처리하는 콜백 함수. (예: 결과 표시, 모달 트리거)
 * @param {function} props.onClose - 모달을 닫을 때 호출되는 함수.
 * @returns {JSX.Element}
 */
const TimetableUploadBox = ({ onSchedulesExtracted, onClose }) => {
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
  const [error, setError] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const fileInputRef = useRef(null);

  const handleImageSelect = (event) => {
    const files = Array.from(event.target.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      setError('이미지 파일만 업로드 가능합니다.');
      return;
    }

    if (imageFiles.length > 10) {
      setError('최대 10개의 이미지만 업로드 가능합니다.');
      return;
    }

    setSelectedImages(imageFiles);
    setError(null);

    // 미리보기 생성
    const previews = [];
    imageFiles.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        previews.push({
          id: index,
          url: e.target.result,
          name: file.name
        });

        if (previews.length === imageFiles.length) {
          setImagePreviews(previews);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index) => {
    const newImages = selectedImages.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    setSelectedImages(newImages);
    setImagePreviews(newPreviews);
  };

  const handleProcessImages = async () => {
    if (selectedImages.length === 0) {
      setError('최소 1개 이상의 이미지를 선택해주세요.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProgress({ current: 0, total: selectedImages.length, message: '준비 중...' });

    try {

      // 사용자 프로필에서 생년월일 가져오기
      setProgress({ current: 0, total: selectedImages.length, message: '사용자 정보 확인 중...' });
      const userProfile = await userService.getUserProfile();
      const birthdate = userProfile.birthdate;

      if (!birthdate) {
        setError('생년월일 정보가 필요합니다. 프로필에서 생년월일을 입력해주세요.');
        setIsProcessing(false);
        return;
      }
      const totalImages = selectedImages.length;
      setProgress({ current: 0, total: 100, message: `이미지 ${totalImages}개 분석 시작...` });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('처리 시간이 너무 오래 걸립니다. 이미지 개수를 줄여주세요.')), 300000) // 5분
      );

      // 예상 시간 기반 진행률 (이미지당 약 10-15초 소요)
      const estimatedTotalTime = totalImages * 12000; // 이미지당 평균 12초
      const startTime = Date.now();
      let progressValue = 0;

      const progressInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        // 경과 시간 기반으로 진행률 계산 (최대 95%까지)
        const timeBasedProgress = Math.min((elapsedTime / estimatedTotalTime) * 100, 95);

        // 부드러운 증가를 위해 현재 값과 목표 값의 중간으로 이동
        progressValue = progressValue + (timeBasedProgress - progressValue) * 0.1;

        let message = `이미지 분석 중... (${totalImages}개)`;
        if (progressValue > 30 && progressValue <= 60) {
          message = `시간표 데이터 추출 중... (${Math.floor(progressValue)}%)`;
        } else if (progressValue > 60 && progressValue <= 90) {
          message = `일정 정리 및 병합 중... (${Math.floor(progressValue)}%)`;
        } else if (progressValue > 90) {
          message = `최종 처리 중... (${Math.floor(progressValue)}%)`;
        }

        setProgress({
          current: Math.floor(progressValue),
          total: 100,
          message
        });
      }, 500); // 0.5초마다 업데이트

      const result = await Promise.race([
        extractSchedulesFromImages(selectedImages, birthdate),
        timeoutPromise
      ]);

      clearInterval(progressInterval);
      setProgress({ current: 100, total: 100, message: '✅ 분석 완료!' });
      setExtractedData(result);

      // 나이 필터링으로 0개가 된 경우 처리
      if (result.schedules.length === 0 && result.allSchedulesBeforeFilter && result.allSchedulesBeforeFilter.length > 0) {
        // 필터링 전 스케줄이 있었다면 나이 필터링으로 제외된 것
        if (onSchedulesExtracted) {
          onSchedulesExtracted({
            type: 'age_filtered',
            data: result,
            allSchedulesCount: result.allSchedulesBeforeFilter.length
          });
        }
      } else {
        // 항상 모달 표시
        if (onSchedulesExtracted) {
          onSchedulesExtracted({
            type: 'ask_show_examples',
            data: result
          });
        }
      }

    } catch (err) {
      setError('시간표 처리 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShowExamples = () => {
    setShowModal(true);
  };

  const handleSelectSchedule = (selectedSchedules) => {
    if (onSchedulesExtracted) {
      onSchedulesExtracted({
        type: 'schedule_selected',
        schedules: selectedSchedules,
        data: extractedData
      });
    }
    setShowModal(false);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto">
          {/* 헤더 */}
          <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 rounded-t-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">시간표 이미지 업로드</h2>
                <p className="text-sm text-blue-100 mt-1">
                  학원/학습 시간표 사진을 올려주세요 (최대 10개)
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* 내용 */}
          <div className="p-6">
            {/* 파일 업로드 영역 */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <Upload size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-700 font-medium mb-2">
                클릭하여 이미지 선택
              </p>
              <p className="text-sm text-gray-500">
                JPG, PNG, JPEG 파일 지원 (최대 10개)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>

            {/* 진행률 표시 */}
            {isProcessing && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center mb-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
                  <p className="text-blue-800 font-medium">{progress.message}</p>
                </div>
                {progress.total > 0 && (
                  <div className="w-full bg-blue-200 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    ></div>
                  </div>
                )}
              </div>
            )}

            {/* 에러 메시지 */}
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
                <AlertCircle size={20} className="text-red-600 mr-3 flex-shrink-0 mt-0.5" />
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {/* 이미지 미리보기 */}
            {imagePreviews.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                  <ImageIcon size={20} className="mr-2" />
                  선택된 이미지 ({imagePreviews.length}개)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {imagePreviews.map((preview, index) => (
                    <div
                      key={preview.id}
                      className="relative group border border-gray-200 rounded-lg overflow-hidden"
                    >
                      <img
                        src={preview.url}
                        alt={preview.name}
                        className="w-full h-32 object-cover"
                      />
                      <button
                        onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={16} />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white px-2 py-1 text-xs truncate">
                        {preview.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 추출 결과 요약 */}
            {extractedData && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start">
                  <FileText size={20} className="text-green-600 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-green-900 mb-2">추출 완료!</h4>
                    <div className="text-sm text-green-800 space-y-1">
                      <p>• 나이: {extractedData.age}세</p>
                      <p>• 총 {extractedData.schedules.length}개의 시간표 발견</p>
                      {extractedData.hasConflicts && (
                        <p className="text-yellow-700">
                          • ⚠️ {extractedData.conflicts.length}개의 충돌 발견
                        </p>
                      )}
                      {extractedData.optimalCombinations.length > 1 && (
                        <p className="text-blue-700">
                          • 💡 {extractedData.optimalCombinations.length}개의 최적 조합 생성
                        </p>
                      )}
                    </div>
                    {extractedData.hasConflicts && extractedData.optimalCombinations.length > 1 && (
                      <button
                        onClick={handleShowExamples}
                        className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        최적 시간표 예시 보기
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 액션 버튼 */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-xl">
            <div className="flex space-x-4">
              <button
                onClick={onClose}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                취소
              </button>
              <button
                onClick={handleProcessImages}
                disabled={selectedImages.length === 0 || isProcessing}
                className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
                  selectedImages.length === 0 || isProcessing
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700'
                }`}
              >
                {isProcessing ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    처리 중... ({selectedImages.length}개 이미지)
                  </div>
                ) : '시간표 추출하기'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 최적화 모달 */}
      {showModal && extractedData && (
        <ScheduleOptimizationModal
          combinations={extractedData.optimalCombinations}
          onSelect={handleSelectSchedule}
          onClose={() => setShowModal(false)}
          userAge={extractedData.age}
          gradeLevel={extractedData.gradeLevel}
        />
      )}
    </>
  );
};

export default TimetableUploadBox;