import React from 'react';

const TestModal = ({ show, onClose, roomName }) => {
  console.log('TestModal 렌더링됨! show:', show, 'roomName:', roomName);
  
  if (!show) {
    console.log('TestModal: show가 false라서 null 반환');
    return null;
  }

  console.log('TestModal: 실제 JSX 반환');
  
  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(255, 0, 255, 0.8)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '10px',
        border: '5px solid purple',
        textAlign: 'center'
      }}>
        <h1>🚀 새 컴포넌트 모달!</h1>
        <p>방 이름: {roomName}</p>
        <button 
          onClick={onClose}
          style={{
            marginTop: '20px', 
            padding: '15px 30px',
            backgroundColor: 'purple',
            color: 'white',
            border: 'none',
            borderRadius: '5px'
          }}
        >
          닫기
        </button>
      </div>
    </div>
  );
};

export default TestModal;