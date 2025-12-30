/**
 * ===================================================================================================
 * AdminDashboard.js - 관리자 대시보드 메인 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/admin/AdminDashboard.js
 *
 * 🎯 주요 기능:
 *    - 전체 통계 표시 (전체 회원, 전체 방, 최근 가입, 관리자 수)
 *    - 최근 활동 내역 표시 (회원가입, 회원탈퇴, 방 생성 등)
 *    - 실시간 데이터 새로고침
 *    - 활동 타입별 카드 형식 표시
 *
 * 🔗 연결된 파일:
 *    - ../../config/firebaseConfig.js - Firebase 인증 (auth)
 *    - /api/admin/stats - 관리자 통계 API
 *    - /api/admin/activities - 최근 활동 API
 *    - lucide-react - 아이콘 라이브러리
 *
 * 💡 UI 위치:
 *    - 화면: 관리자 대시보드 메인 화면
 *    - 접근: 헤더 > 관리자 메뉴 > 대시보드
 *    - 섹션: 통계 카드 (상단), 최근 활동 카드 (하단)
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 관리자 대시보드 전체 레이아웃 및 데이터 표시 변경
 *    - 통계 항목 추가: stats 상태 및 통계 카드 JSX 수정
 *    - 활동 타입 추가: getActivityLabel, getActivityColor 함수에 새 타입 추가
 *    - 새로고침 주기 변경: fetchDashboardData 호출 로직 수정
 *
 * 📝 참고사항:
 *    - 관리자 권한이 있어야 접근 가능
 *    - Firebase 인증 토큰으로 API 호출
 *    - 최근 활동은 최대 20개까지 표시
 *    - 새로고침 버튼으로 실시간 데이터 갱신 가능
 *
 * ===================================================================================================
 */

import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, Building2, Calendar, RefreshCw, TrendingUp } from 'lucide-react';
import { auth } from '../../config/firebaseConfig';

/**
 * AdminDashboard - 관리자 대시보드 메인 컴포넌트
 *
 * @returns {JSX.Element} 관리자 대시보드 UI
 */
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

  /**
   * fetchDashboardData - 대시보드 데이터 가져오기
   *
   * @description API에서 통계 및 최근 활동 데이터 조회
   */
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

  /**
   * formatDateTime - 날짜 문자열 포맷팅
   *
   * @description ISO 형식의 날짜 문자열을 한국어 로케일에 맞는 짧은 형식으로 변환합니다.
   * @param {string} dateString - ISO 형식의 날짜 문자열
   * @returns {string} 포맷팅된 날짜 문자열 (예: "12월 25일, 오후 3:00") 또는 '-'
   *
   * @example
   * formatDateTime('2025-12-25T06:00:00.000Z'); // "12월 25일, 오후 3:00" (한국 시간 기준)
   *
   * @note
   * - `dateString`이 유효하지 않으면 '-'를 반환합니다.
   */
  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /**
   * getActivityIcon - 활동 타입에 따른 아이콘 반환
   *
   * @description 활동 타입 문자열에 따라 해당하는 lucide-react 아이콘 컴포넌트를 반환합니다.
   * @param {string} type - 활동 타입 (예: 'user_signup', 'room_create')
   * @returns {JSX.Element} 활동 타입에 맞는 아이콘
   *
   * @example
   * getActivityIcon('user_signup'); // <Users> 아이콘 반환
   * getActivityIcon('unknown_type'); // <Calendar> 기본 아이콘 반환
   *
   * @note
   * - 정의되지 않은 타입에 대해서는 기본 아이콘(Calendar)을 반환합니다.
   */
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

  /**
   * getActivityLabel - 활동 타입에 따른 레이블 반환
   *
   * @description 활동 타입 문자열에 따라 UI에 표시될 한글 레이블을 반환합니다.
   * @param {string} type - 활동 타입 (예: 'user_signup', 'room_create')
   * @returns {string} 한글로 변환된 활동 레이블
   *
   * @example
   * getActivityLabel('user_signup'); // '회원가입' 반환
   * getActivityLabel('unknown_type'); // 'unknown_type' 그대로 반환
   *
   * @note
   * - `labels` 객체에 정의되지 않은 타입은 원래의 타입 문자열을 그대로 반환합니다.
   */
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

  /**
   * getActivityColor - 활동 타입에 따른 Tailwind CSS 클래스 반환
   *
   * @description 활동 타입 문자열에 따라 카드 스타일에 적용될 Tailwind CSS 색상 클래스를 반환합니다.
   * @param {string} type - 활동 타입 (예: 'user_signup', 'room_create')
   * @returns {string} Tailwind CSS 클래스 문자열
   *
   * @example
   * getActivityColor('user_signup'); // 'bg-green-100 text-green-700' 반환
   * getActivityColor('unknown_type'); // 'bg-gray-100 text-gray-600' 기본값 반환
   *
   * @note
   * - `colors` 객체에 정의되지 않은 타입에 대해서는 기본 회색 계열 클래스를 반환합니다.
   */
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
