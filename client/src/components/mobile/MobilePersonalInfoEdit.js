import React, { useState, useEffect } from 'react';
import { GoogleMap, Marker } from '@react-google-maps/api';
import { ArrowLeft, User, Mail, Phone, MapPin, Briefcase, Calendar, Save } from 'lucide-react';
import { userService } from '../../services/userService';
import AddressAutocomplete from '../common/AddressAutocomplete';
import './MobilePersonalInfoEdit.css';

const MobilePersonalInfoEdit = ({ onBack }) => {
  const [userInfo, setUserInfo] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    addressDetail: '',
    addressLat: null,
    addressLng: null,
    addressPlaceId: null,
    occupation: '',
    birthdate: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        setIsLoading(true);
        const data = await userService.getUserProfile();
        setUserInfo({
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: data.email || '',
          phone: data.phone || '',
          address: data.address || '',
          addressDetail: data.addressDetail || '',
          addressLat: data.addressLat || null,
          addressLng: data.addressLng || null,
          addressPlaceId: data.addressPlaceId || null,
          occupation: data.occupation || '',
          birthdate: data.birthdate ? data.birthdate.split('T')[0] : ''
        });
      } catch (error) {
        setMessage({ type: 'error', text: '개인정보를 불러오는데 실패했습니다.' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchUserInfo();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUserInfo(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setMessage({ type: '', text: '' });
      await userService.updateUserProfile(userInfo);
      setMessage({ type: 'success', text: '개인정보가 성공적으로 저장되었습니다!' });
      window.dispatchEvent(new CustomEvent('userProfileUpdated'));
      setTimeout(() => {
        setMessage({ type: '', text: '' });
        onBack();
      }, 1500);
    } catch (error) {
      setMessage({ type: 'error', text: '개인정보 저장에 실패했습니다.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mobile-personal-info-edit">
        <div className="loading-state">개인정보를 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="mobile-personal-info-edit">
      {/* 헤더 */}
      <div className="mobile-edit-header">
        <button className="back-button" onClick={onBack}>
          <ArrowLeft size={24} />
        </button>
        <h1 className="header-title">개인정보 수정</h1>
        <div style={{ width: '40px' }}></div> {/* 레이아웃 균형을 위한 빈 공간 */}
      </div>

      {/* 메시지 */}
      {message.text && (
        <div className={`message-box ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* 폼 */}
      <div className="mobile-edit-content">
        <form onSubmit={handleSubmit} className="edit-form">
          <div className="form-section">
            <div className="form-group">
              <label className="form-label">
                <User size={16} />
                이름
              </label>
              <input
                type="text"
                name="firstName"
                value={userInfo.firstName}
                onChange={handleChange}
                className="form-input"
                placeholder="이름"
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <User size={16} />
                성
              </label>
              <input
                type="text"
                name="lastName"
                value={userInfo.lastName}
                onChange={handleChange}
                className="form-input"
                placeholder="성"
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <Mail size={16} />
                이메일
              </label>
              <input
                type="email"
                name="email"
                value={userInfo.email}
                className="form-input readonly"
                readOnly
              />
              <p className="help-text">이메일은 변경할 수 없습니다.</p>
            </div>

            <div className="form-group">
              <label className="form-label">
                <Phone size={16} />
                전화번호
              </label>
              <input
                type="tel"
                name="phone"
                value={userInfo.phone}
                onChange={handleChange}
                className="form-input"
                placeholder="010-1234-5678"
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <MapPin size={16} />
                주소
              </label>
              <AddressAutocomplete 
                value={userInfo.address} 
                onChange={(data) => {
                  setUserInfo(p => ({
                    ...p, 
                    address: data.address,
                    addressLat: data.lat,
                    addressLng: data.lng,
                    addressPlaceId: data.placeId
                  }));
                }} 
              />
              {userInfo.addressLat && (
                <p className="help-text" style={{ color: '#10b981' }}>
                  ✓ 위치 좌표: {userInfo.addressLat.toFixed(6)}, {userInfo.addressLng.toFixed(6)}
                </p>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">
                <MapPin size={16} />
                세부 주소
              </label>
              <input
                type="text"
                name="addressDetail"
                value={userInfo.addressDetail}
                onChange={handleChange}
                className="form-input"
                placeholder="상세 주소 (예: 101동 1004호)"
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <Briefcase size={16} />
                직업
              </label>
              <input
                type="text"
                name="occupation"
                value={userInfo.occupation}
                onChange={handleChange}
                className="form-input"
                placeholder="직업"
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <Calendar size={16} />
                생년월일
              </label>
              <input
                type="date"
                name="birthdate"
                value={userInfo.birthdate}
                onChange={handleChange}
                className="form-input"
              />
            </div>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              disabled={isSaving}
              className="submit-button"
            >
              {isSaving ? '저장 중...' : '저장하기'}
            </button>
          </div>
        </form>

        {/* 지도 표시 */}
        <div className="map-section">
          <h3 className="map-title">위치 지도</h3>
          {userInfo.addressLat && userInfo.addressLng ? (
            <div className="map-container">
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '300px' }}
                center={{ 
                  lat: parseFloat(userInfo.addressLat), 
                  lng: parseFloat(userInfo.addressLng) 
                }}
                zoom={15}
              >
                <Marker 
                  position={{ 
                    lat: parseFloat(userInfo.addressLat), 
                    lng: parseFloat(userInfo.addressLng) 
                  }} 
                />
              </GoogleMap>
            </div>
          ) : (
            <div className="map-placeholder">
              <MapPin size={48} className="placeholder-icon" />
              <p className="placeholder-text">주소를 입력하면 지도가 표시됩니다</p>
              <p className="placeholder-subtext">
                현재 주소: {userInfo.address || '없음'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobilePersonalInfoEdit;
