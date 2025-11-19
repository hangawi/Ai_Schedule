import React, { useState, useEffect } from 'react';
import { Users, Search, Trash2, Shield, ShieldOff, RefreshCw } from 'lucide-react';
import { auth } from '../../config/firebaseConfig';

const AdminUserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });
  const [error, setError] = useState('');

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

  const fetchUsers = async (page = 1) => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const response = await fetch(
        `${API_BASE_URL}/api/admin/users?page=${page}&limit=20&search=${search}`,
        {
          headers: {
            'Authorization': `Bearer ${await currentUser.getIdToken()}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || '회원 목록을 불러올 수 없습니다.');
      }

      setUsers(data.users);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchUsers(1);
  };

  const handleDelete = async (userId, userName) => {
    if (!window.confirm(`정말로 "${userName}" 회원을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    try {
      const currentUser = auth.currentUser;
      const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${await currentUser.getIdToken()}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.msg || '회원 삭제 실패');
      }

      fetchUsers(pagination.current);
    } catch (err) {
      alert(err.message);
    }
  };

  const handlePromote = async (userId, userName) => {
    if (!window.confirm(`"${userName}" 회원을 관리자로 승급하시겠습니까?`)) {
      return;
    }

    try {
      const currentUser = auth.currentUser;
      const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/promote`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${await currentUser.getIdToken()}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.msg || '승급 실패');
      }

      fetchUsers(pagination.current);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDemote = async (userId, userName) => {
    if (!window.confirm(`"${userName}" 관리자를 일반 사용자로 강등하시겠습니까?`)) {
      return;
    }

    try {
      const currentUser = auth.currentUser;
      const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/demote`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${await currentUser.getIdToken()}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.msg || '강등 실패');
      }

      fetchUsers(pagination.current);
    } catch (err) {
      alert(err.message);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Users className="text-purple-600" size={28} />
          <h2 className="text-2xl font-bold text-gray-800">회원 관리</h2>
          <span className="text-sm text-gray-500">({pagination.total}명)</span>
        </div>
        <button
          onClick={() => fetchUsers(pagination.current)}
          className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg"
        >
          <RefreshCw size={20} />
        </button>
      </div>

      {/* 검색 */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름, 이메일로 검색..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </form>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">로딩 중...</p>
        </div>
      ) : (
        <>
          {/* 회원 목록 테이블 */}
          <div className="overflow-x-auto bg-white rounded-xl shadow">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">이름</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">이메일</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">연락처</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">주소</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">역할</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">가입일</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id || user._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {user.firstName} {user.lastName}
                      </div>
                      {user.name && (
                        <div className="text-sm text-gray-500">{user.name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{user.phone || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                      {user.address || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {user.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full w-fit">
                            <Shield size={12} /> 관리자
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full w-fit">
                            일반
                          </span>
                        )}
                        {(user.google?.id || user.firebaseUid) && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs font-medium rounded-full w-fit">
                            구글
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {user.role === 'admin' ? (
                          <button
                            onClick={() => handleDemote(user.id || user._id, `${user.firstName} ${user.lastName}`)}
                            className="p-1.5 text-orange-600 hover:bg-orange-50 rounded"
                            title="일반 사용자로 강등"
                          >
                            <ShieldOff size={16} />
                          </button>
                        ) : (
                          <button
                            onClick={() => handlePromote(user.id || user._id, `${user.firstName} ${user.lastName}`)}
                            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded"
                            title="관리자로 승급"
                          >
                            <Shield size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(user.id || user._id, `${user.firstName} ${user.lastName}`)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          title="삭제"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {pagination.pages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => fetchUsers(page)}
                  className={`px-3 py-1 rounded ${
                    page === pagination.current
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminUserManagement;
