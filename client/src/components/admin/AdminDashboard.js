import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, Building2, Calendar, RefreshCw, TrendingUp } from 'lucide-react';
import { auth } from '../../config/firebaseConfig';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalRooms: 0,
    activeUsers: 0,
    adminUsers: 0,
    recentSignups: 0
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const token = await currentUser.getIdToken();

      // 통계 가져오기
      const statsResponse = await fetch(`${API_BASE_URL}/api/admin/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      // 최근 활동 가져오기
      const activitiesResponse = await fetch(`${API_BASE_URL}/api/admin/activities?limit=20`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (activitiesResponse.ok) {
        const activitiesData = await activitiesResponse.json();
        setRecentActivities(activitiesData.activities || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'user_signup':
        return <Users size={14} className="text-green-500" />;
      case 'room_create':
        return <Building2 size={14} className="text-blue-500" />;
      case 'profile_update':
        return <Users size={14} className="text-purple-500" />;
      case 'room_join':
        return <Building2 size={14} className="text-teal-500" />;
      default:
        return <Calendar size={14} className="text-gray-500" />;
    }
  };

  const getActivityLabel = (type) => {
    const labels = {
      user_signup: '회원가입',
      user_withdraw: '회원탈퇴',
      room_create: '방 생성',
      profile_update: '프로필 수정',
      room_join: '방 참가',
      member_join: '방 참가',
      room_leave: '방 퇴장',
      member_leave: '방 퇴장',
      member_kick: '멤버 강퇴',
      schedule_update: '일정 수정',
      admin_login: '관리자 로그인',
      auto_assign: '자동배정',
      slot_request: '자리 요청',
      slot_yield: '자리 양보',
      slot_swap: '자리 교환',
      change_request: '변경 요청',
      change_approve: '변경 승인',
      change_reject: '변경 거절'
    };
    return labels[type] || type;
  };

  const getActivityColor = (type) => {
    const colors = {
      user_signup: 'bg-green-100 text-green-700',
      user_withdraw: 'bg-gray-100 text-gray-700',
      room_create: 'bg-blue-100 text-blue-700',
      profile_update: 'bg-purple-100 text-purple-700',
      room_join: 'bg-teal-100 text-teal-700',
      member_join: 'bg-teal-100 text-teal-700',
      room_leave: 'bg-gray-100 text-gray-700',
      member_leave: 'bg-gray-100 text-gray-700',
      member_kick: 'bg-red-100 text-red-700',
      auto_assign: 'bg-indigo-100 text-indigo-700',
      slot_request: 'bg-yellow-100 text-yellow-700',
      slot_yield: 'bg-emerald-100 text-emerald-700',
      slot_swap: 'bg-pink-100 text-pink-700',
      change_request: 'bg-amber-100 text-amber-700',
      change_approve: 'bg-cyan-100 text-cyan-700',
      change_reject: 'bg-rose-100 text-rose-700'
    };
    return colors[type] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="text-purple-600" size={28} />
          <h2 className="text-2xl font-bold text-gray-800">관리자 대시보드</h2>
        </div>
        <button
          onClick={fetchDashboardData}
          className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg"
        >
          <RefreshCw size={20} />
        </button>
      </div>

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
          {/* 통계 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users size={18} className="text-blue-500" />
                <span className="text-sm text-gray-500">전체 회원</span>
              </div>
              <p className="text-2xl font-bold text-gray-800">{stats.totalUsers}</p>
            </div>
            <div className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center gap-2 mb-2">
                <Building2 size={18} className="text-green-500" />
                <span className="text-sm text-gray-500">전체 방</span>
              </div>
              <p className="text-2xl font-bold text-gray-800">{stats.totalRooms}</p>
            </div>
            <div className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={18} className="text-purple-500" />
                <span className="text-sm text-gray-500">최근 7일 가입</span>
              </div>
              <p className="text-2xl font-bold text-gray-800">{stats.recentSignups}</p>
            </div>
            <div className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users size={18} className="text-orange-500" />
                <span className="text-sm text-gray-500">관리자</span>
              </div>
              <p className="text-2xl font-bold text-gray-800">{stats.adminUsers}</p>
            </div>
          </div>

          {/* 최근 활동 - 타입별 카드 */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">최근 활동</h3>
            {recentActivities.length === 0 ? (
              <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
                활동 기록이 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* 회원가입 */}
                <div className="bg-white rounded-xl shadow p-4 border-l-4 border-green-500">
                  <div className="flex items-center gap-2 mb-3">
                    <Users size={16} className="text-green-500" />
                    <span className="font-medium text-gray-700">회원가입</span>
                  </div>
                  <div className="space-y-2 max-h-[150px] overflow-y-auto">
                    {recentActivities.filter(a => a.type === 'user_signup').length > 0 ? (
                      recentActivities.filter(a => a.type === 'user_signup').slice(0, 5).map((activity, index) => (
                        <div key={index} className="flex justify-between items-center text-sm">
                          <span className="text-gray-800 truncate">{activity.userName}</span>
                          <span className="text-xs text-gray-400 whitespace-nowrap ml-2">{formatDateTime(activity.createdAt)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400">없음</p>
                    )}
                  </div>
                </div>

                {/* 회원탈퇴 */}
                <div className="bg-white rounded-xl shadow p-4 border-l-4 border-gray-500">
                  <div className="flex items-center gap-2 mb-3">
                    <Users size={16} className="text-gray-500" />
                    <span className="font-medium text-gray-700">회원탈퇴</span>
                  </div>
                  <div className="space-y-2 max-h-[150px] overflow-y-auto">
                    {recentActivities.filter(a => a.type === 'user_withdraw').length > 0 ? (
                      recentActivities.filter(a => a.type === 'user_withdraw').slice(0, 5).map((activity, index) => (
                        <div key={index} className="flex justify-between items-center text-sm">
                          <span className="text-gray-800 truncate">{activity.userName}</span>
                          <span className="text-xs text-gray-400 whitespace-nowrap ml-2">{formatDateTime(activity.createdAt)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400">없음</p>
                    )}
                  </div>
                </div>

                {/* 방 생성 */}
                <div className="bg-white rounded-xl shadow p-4 border-l-4 border-blue-500">
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 size={16} className="text-blue-500" />
                    <span className="font-medium text-gray-700">방 생성</span>
                  </div>
                  <div className="space-y-2 max-h-[150px] overflow-y-auto">
                    {recentActivities.filter(a => a.type === 'room_create').length > 0 ? (
                      recentActivities.filter(a => a.type === 'room_create').slice(0, 5).map((activity, index) => (
                        <div key={index} className="flex justify-between items-center text-sm">
                          <span className="text-gray-800 truncate">{activity.details}</span>
                          <span className="text-xs text-gray-400 whitespace-nowrap ml-2">{formatDateTime(activity.createdAt)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400">없음</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
