import React, { useState } from 'react';
import { X, Shield, Key } from 'lucide-react';
import { useAdmin } from '../../contexts/AdminContext';

const AdminCodeModal = ({ isOpen, onClose }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { verifyAdminCode } = useAdmin();

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
