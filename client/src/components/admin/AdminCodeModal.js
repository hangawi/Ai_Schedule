/**
 * ===================================================================================================
 * AdminCodeModal.js - 관리자 인증 코드 입력 모달
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/admin/AdminCodeModal.js
 *
 * 🎯 주요 기능:
 *    - 관리자 인증 코드 입력 폼 제공
 *    - 코드 검증 및 관리자 권한 부여
 *    - 인증 성공 시 페이지 새로고침하여 관리자 UI 활성화
 *    - 에러 메시지 표시
 *
 * 🔗 연결된 파일:
 *    - ../../contexts/AdminContext.js - 관리자 컨텍스트 (verifyAdminCode 함수)
 *    - lucide-react - 아이콘 라이브러리 (Shield, Key, X)
 *
 * 💡 UI 위치:
 *    - 모달: 관리자 코드 입력 모달 (중앙 팝업)
 *    - 트리거: AdminDashboard에서 호출 (관리자 메뉴 접근 시)
 *    - 경로: 헤더 > 관리자 메뉴 클릭 → 이 모달 표시
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 관리자 인증 UI 및 동작 방식 변경
 *    - 코드 검증 로직 변경: AdminContext의 verifyAdminCode 함수 수정
 *    - 모달 디자인 변경: return 문 내 JSX 및 Tailwind 클래스 수정
 *    - 인증 후 동작 변경: handleSubmit 함수의 성공 처리 로직 수정
 *
 * 📝 참고사항:
 *    - 인증 성공 시 window.location.reload()로 페이지 새로고침
 *    - 관리자 코드는 비밀번호 형식으로 입력됨 (type="password")
 *    - 코드가 비어있으면 인증 버튼 비활성화
 *    - 인증 실패 시 에러 메시지 표시
 *
 * ===================================================================================================
 */

import React, { useState } from 'react';
import { X, Shield, Key } from 'lucide-react';
import { useAdmin } from '../../contexts/AdminContext';

/**
 * AdminCodeModal - 관리자 인증 코드 입력 모달 컴포넌트
 *
 * @param {Object} props - 컴포넌트 props
 * @param {boolean} props.isOpen - 모달 표시 여부
 * @param {Function} props.onClose - 모달 닫기 핸들러
 *
 * @returns {JSX.Element|null} 모달 UI (isOpen이 false면 null 반환)
 *
 * @example
 * <AdminCodeModal
 *   isOpen={showAdminModal}
 *   onClose={() => setShowAdminModal(false)}
 * />
 */
const AdminCodeModal = ({ isOpen, onClose }) => {
  // 상태 관리
  const [code, setCode] = useState('');  // 입력된 관리자 코드
  const [error, setError] = useState('');  // 에러 메시지
  const [loading, setLoading] = useState(false);  // 로딩 상태
  const { verifyAdminCode } = useAdmin();

  /**
   * handleSubmit - 관리자 코드 검증 처리
   *
   * @description 입력된 코드를 검증하고, 성공 시 페이지 새로고침
   * @param {Event} e - 폼 제출 이벤트
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await verifyAdminCode(code);

    if (result.success) {
      setCode('');
      onClose();
      // 페이지 새로고침으로 관리자 UI 적용
      window.location.reload();
    } else {
      setError(result.message);
    }

    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b bg-gradient-to-r from-purple-600 to-indigo-600">
          <div className="flex items-center gap-3">
            <Shield className="text-white" size={24} />
            <h2 className="text-xl font-bold text-white">관리자 인증</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/20"
          >
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              관리자 코드 입력
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="관리자 코드를 입력하세요"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                autoFocus
              />
            </div>
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading || !code}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '확인 중...' : '인증'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminCodeModal;
