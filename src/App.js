import React, { useState, useEffect } from 'react';
import { database } from './firebase';
import { ref, push, onValue, update, set } from 'firebase/database';
import { Coffee, Activity, Lock, LogOut, Settings } from 'lucide-react';
import './App.css';
import JogPopup from './JogPopup'; // [추가] 조그 팝업 컴포넌트

const BURGERS = [
  { id: 1, name: '클래식 치즈버거', price: 8500, emoji: '🍔' },
  { id: 2, name: '베이컨 디럭스', price: 10500, emoji: '🥓' },
  { id: 3, name: '스파이시 치킨버거', price: 9000, emoji: '🌶️' }
];

// 관리자 비밀번호
const ADMIN_PASSWORD = "1234";

function App() {
  const [view, setView] = useState('customer');
  const [orders, setOrders] = useState([]);
  const [robotStatus, setRobotStatus] = useState('idle');
  const [firebaseConnected, setFirebaseConnected] = useState(false);
  const [ros2Connected, setRos2Connected] = useState(false);
  const [dailyStats, setDailyStats] = useState(null);
  // [추가] 조그 팝업 상태 관리
  const [showJog, setShowJog] = useState(false);
  // 관리자 인증 상태
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // 오늘 날짜 (YYYY-MM-DD 형식)
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  useEffect(() => {
    // Firebase 연결 상태 확인
    const connectedRef = ref(database, '.info/connected');
    onValue(connectedRef, (snapshot) => {
      setFirebaseConnected(snapshot.val() === true);
    });

    // 주문 데이터 구독
    const ordersRef = ref(database, 'orders');
    onValue(ordersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const ordersList = Object.entries(data).map(([id, order]) => ({
          id,
          ...order
        }));
        setOrders(ordersList.sort((a, b) => 
          new Date(b.timestamp) - new Date(a.timestamp)
        ));
      } else {
        setOrders([]);
      }
    });

    // 로봇 상태 구독
    const statusRef = ref(database, 'robot_status');
    onValue(statusRef, (snapshot) => {
      const status = snapshot.val();
      setRobotStatus(status || 'idle');
      setRos2Connected(status !== null);
    });

    // 오늘의 통계 구독
    const todayDate = getTodayDate();
    const statsRef = ref(database, `statistics/daily/${todayDate}`);
    onValue(statsRef, (snapshot) => {
      const stats = snapshot.val();
      setDailyStats(stats || {
        total_orders: 0,
        total_revenue: 0,
        by_menu: {}
      });
    });
  }, []);

  // 관리자 버튼 클릭 핸들러
  const handleAdminClick = () => {
    if (isAdminAuthenticated) {
      setView('admin');
    } else {
      setShowPasswordModal(true);
      setPasswordInput('');
      setPasswordError('');
    }
  };

  // 비밀번호 확인
  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAdminAuthenticated(true);
      setShowPasswordModal(false);
      setView('admin');
      setPasswordInput('');
      setPasswordError('');
    } else {
      setPasswordError('비밀번호가 틀렸습니다!');
      setPasswordInput('');
    }
  };

  // 로그아웃
  const handleLogout = () => {
    setIsAdminAuthenticated(false);
    setView('customer');
  };

  // 긴급 정지
  const handleEmergencyStop = async () => {
    if (robotStatus === 'idle') {
      alert('현재 작동 중인 로봇이 없습니다.');
      return;
    }

    const confirmStop = window.confirm('🚨 로봇을 긴급 정지하시겠습니까?\n\n현재 작업이 즉시 일시 정지됩니다!');
    
    if (confirmStop) {
      try {
        const stopRef = ref(database, 'emergency_stop');
        await set(stopRef, {
          command: 'stop',
          timestamp: new Date().toISOString()
        });
        alert('🛑 긴급 정지 명령이 전송되었습니다!');
      } catch (error) {
        console.error('긴급 정지 실패:', error);
        alert('긴급 정지 명령 전송에 실패했습니다.');
      }
    }
  };

  // [추가됨] 복구 명령 전송 함수 (홈 이동 vs 재개)
  const handleRecovery = async (action) => {
    try {
      const recoveryRef = ref(database, 'recovery_command');
      await set(recoveryRef, {
        command: action, // 'home' 또는 'resume'
        timestamp: new Date().toISOString()
      });
      
      if (action === 'home') alert('🏠 초기화 중... 홈 위치로 이동합니다.');
      if (action === 'resume') alert('▶️ 작업을 다시 시작합니다.');
      
    } catch (error) {
      console.error('복구 명령 전송 실패:', error);
      alert('명령 전송에 실패했습니다.');
    }
  };

  // 모달 닫기
  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordInput('');
    setPasswordError('');
  };

  // 통계 업데이트 함수
  const updateStatistics = async (burger, orderId) => {
    const todayDate = getTodayDate();
    const statsRef = ref(database, `statistics/daily/${todayDate}`);
    
    onValue(statsRef, (snapshot) => {
      const currentStats = snapshot.val() || {
        total_orders: 0,
        total_revenue: 0,
        by_menu: {}
      };

      const menuName = burger.name;
      const menuStats = currentStats.by_menu[menuName] || { count: 0, revenue: 0 };
      
      const updatedStats = {
        total_orders: currentStats.total_orders + 1,
        total_revenue: currentStats.total_revenue + burger.price,
        by_menu: {
          ...currentStats.by_menu,
          [menuName]: {
            count: menuStats.count + 1,
            revenue: menuStats.revenue + burger.price,
            price: burger.price
          }
        }
      };

      set(statsRef, updatedStats);
    }, { onlyOnce: true });
  };

  const placeOrder = async (burger) => {
    try {
      const ordersRef = ref(database, 'orders');
      const now = new Date();
      const orderData = {
        burger: burger,
        status: 'waiting',
        timestamp: now.toISOString(),
        timeDisplay: now.toLocaleTimeString('ko-KR'),
        orderNumber: orders.length + 1
      };

      const newOrderRef = await push(ordersRef, orderData);
      await updateStatistics(burger, newOrderRef.key);
      alert(`${burger.name} 주문이 접수되었습니다! 🍔`);
    } catch (error) {
      console.error('주문 실패:', error);
      alert('주문에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const orderRef = ref(database, `orders/${orderId}`);
      await update(orderRef, { status: newStatus });
    } catch (error) {
      console.error('상태 업데이트 실패:', error);
    }
  };

  // [수정됨] 로봇 상태 표시 (일시 정지 및 정지됨 추가)
  const getRobotStatusDisplay = () => {
    switch(robotStatus) {
      case 'idle': return { text: '유휴 상태', emoji: '💤', color: '#64748b' };
      case 'ready': return { text: '대기 중', emoji: '⚡', color: '#3b82f6' };
      case 'cooking': return { text: '조리 중', emoji: '🤖', color: '#10b981' };
      
      // 새로 추가된 상태들
      case 'paused': return { text: '⚠️ 일시 정지 (복구 대기)', emoji: '⏸️', color: '#f59e0b' }; 
      case 'stopped': return { text: '🚨 정지됨', emoji: '🛑', color: '#ef4444' };
      case 'error_collision': return { text: '💥 충돌 감지됨', emoji: '🚨', color: '#ef4444' };

      // ▼▼▼ [여기 추가해주세요] ▼▼▼
      case 'recovering': return { text: '🏠 홈 위치로 이동 중...', emoji: '🚑', color: '#8b5cf6' };
      case 'processing': return { text: '▶️ 작업 재개 중...', emoji: '🍳', color: '#10b981' };
      default: return { text: '알 수 없음', emoji: '❓', color: '#94a3b8' };
    }
  };

  const statusDisplay = getRobotStatusDisplay();

  const formatCurrency = (amount) => {
    return amount.toLocaleString('ko-KR');
  };

  return (
    <div className="app">
      {/* [추가됨] 조그 팝업 */}
      {showJog && <JogPopup onClose={() => setShowJog(false)} />}
      {/* 비밀번호 모달 */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={closePasswordModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <Lock size={32} />
              <h2>관리자 인증</h2>
            </div>
            
            <form onSubmit={handlePasswordSubmit}>
              <div className="password-input-group">
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  className="password-input"
                  autoFocus
                />
                {passwordError && (
                  <div className="password-error">❌ {passwordError}</div>
                )}
              </div>
              
              <div className="modal-buttons">
                <button type="submit" className="modal-button primary">확인</button>
                <button type="button" className="modal-button secondary" onClick={closePasswordModal}>취소</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* [추가됨] 복구 모드 팝업창 (로봇이 paused 상태일 때 나타남) */}
      {robotStatus === 'paused' && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal-content recovery-modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', maxWidth: '500px' }}>
            <div className="modal-header">
              <span style={{ fontSize: '4rem', display:'block', marginBottom:'10px' }}>⚠️</span>
              <h2 style={{ color: '#f59e0b', margin: 0 }}>로봇이 일시 정지되었습니다!</h2>
              <p style={{ color: '#cbd5e1', marginTop: '10px' }}>작업을 어떻게 처리하시겠습니까?</p>
            </div>
            
            <div className="modal-buttons" style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
              <button 
                className="modal-button" 
                onClick={() => handleRecovery('home')}
                style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '1.5rem', flex: 1, borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}
              >
                🏠 초기화 (홈 이동)
              </button>
              <button 
                className="modal-button" 
                onClick={() => handleRecovery('resume')}
                style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '1.5rem', flex: 1, borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}
              >
                ▶️ 다시 시작 (재개)
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* [비상 정지/충돌 감지 팝업] */}
      {(robotStatus === 'error_collision' || robotStatus === 'recovering') && (
        <div className="error-modal-overlay">
          <div className="error-modal">
            <div className="error-icon">🚨</div>
            <h2>비상 정지 감지!</h2>
            <p>
              로봇이 충돌을 감지하여 정지했습니다.<br/>
              주변 안전을 확인한 후 복귀 버튼을 눌러주세요.
            </p>
            
            {robotStatus === 'error_collision' ? (
              <button 
                className="modal-button primary" 
                // [수정됨] 기존 함수에 'home'을 전달하여 호출
                onClick={() => handleRecovery('home')} 
                style={{ 
                  backgroundColor: '#ef4444', 
                  color: 'white',
                  padding: '1rem 2rem',
                  fontSize: '1.2rem',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  marginTop: '1rem'
                }}
              >
                🔄 안전 확인 및 초기 위치 복귀
              </button>
            ) : (
              // 복구 중일 때 표시
              <div style={{
                padding: '1rem 2rem',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
                borderRadius: '12px',
                fontWeight: 'bold',
                fontSize: '1.2rem',
                display: 'inline-block'
              }}>
                🏠 홈 위치로 복귀 중...
              </div>
            )}
            
            <p className="sub-text" style={{marginTop: '20px', color: '#888'}}>
              로봇 반경에서 물러나 주세요.
            </p>
          </div>
        </div>
      )}
      {/* 헤더 */}
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <Coffee size={32} />
            <h1>ROBO BURGER</h1>
          </div>
          
          <div className="status-indicators">
            <div className={`status-badge ${firebaseConnected ? 'connected' : 'disconnected'}`}>
              <div className="status-dot"></div>
              Firebase {firebaseConnected ? '연결됨' : '연결 안됨'}
            </div>
            <div className={`status-badge ${ros2Connected ? 'connected' : 'disconnected'}`}>
              <Activity size={16} />
              ROS2 브릿지 {ros2Connected ? '대기' : '없음'}
            </div>
            
            {isAdminAuthenticated && (
              <button className="logout-button" onClick={handleLogout}>
                <LogOut size={16} />
                로그아웃
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 뷰 전환 버튼 */}
      <div className="view-selector">
        <button 
          className={view === 'customer' ? 'active' : ''}
          onClick={() => setView('customer')}
        >
          🍔 고객 주문
        </button>
        <button 
          className={view === 'admin' ? 'active' : ''}
          onClick={handleAdminClick}
        >
          {isAdminAuthenticated ? '👨‍💼 관리자' : '🔒 관리자'}
        </button>
      </div>

      {/* 고객 뷰 */}
      {view === 'customer' && (
        <div className="customer-view">
          <h2>메뉴를 선택하세요</h2>
          <div className="burger-grid">
            {BURGERS.map(burger => (
              <div key={burger.id} className="burger-card">
                <div className="burger-emoji">{burger.emoji}</div>
                <h3>{burger.name}</h3>
                <p className="price">₩{burger.price.toLocaleString()}</p>
                <button 
                  className="order-button"
                  onClick={() => placeOrder(burger)}
                >
                  주문하기
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 관리자 뷰 */}
      {view === 'admin' && isAdminAuthenticated && (
        <div className="admin-view">
          {/* 로봇 상태 */}
          <div className="robot-status-card">
            <h3>🤖 로봇 상태 (FIREBASE 실시간 동기화)</h3>
            <div className="robot-status" style={{ backgroundColor: statusDisplay.color }}>
              <span className="robot-emoji">{statusDisplay.emoji}</span>
              <span className="robot-text">{statusDisplay.text}</span>
            </div>
            
            {/* [추가됨] 조그 및 긴급 정지 버튼 컨테이너 */}
            <div className="emergency-stop-container" style={{display:'flex', gap:'1rem', marginTop:'1.5rem'}}>
              
              {/* 조그 버튼 */}
              <button 
                className="emergency-stop-button"
                onClick={() => setShowJog(true)}
                style={{ background: 'linear-gradient(135deg, #4f46e5, #4338ca)', border: '3px solid #6366f1' }}
              >
                <Settings size={24} color="white" />
                <span className="stop-text">수동 조작 (Jog)</span>
              </button>

              {/* 긴급 정지 버튼 */}
              <button 
                className="emergency-stop-button"
                onClick={handleEmergencyStop}
                disabled={robotStatus === 'idle' || robotStatus === 'paused'}
              >
                <span className="stop-icon">🛑</span>
                <span className="stop-text">긴급 정지</span>
              </button>

            </div>
            <p className="emergency-note">
              {robotStatus === 'cooking' ? '⚠️ 로봇 작동 중 - 조작 주의' : '💤 대기 중 또는 정지됨'}
            </p>
          </div>

          {/* 오늘의 통계 */}
          <div className="stats-section">
            <h3>📊 오늘의 매출 통계 ({getTodayDate()})</h3>
            
            {dailyStats && (
              <div className="stats-grid">
                <div className="stat-card total">
                  <div className="stat-label">총 주문</div>
                  <div className="stat-value">{dailyStats.total_orders}개</div>
                </div>

                <div className="stat-card revenue">
                  <div className="stat-label">총 매출</div>
                  <div className="stat-value">₩{formatCurrency(dailyStats.total_revenue)}</div>
                </div>

                {dailyStats.by_menu && Object.entries(dailyStats.by_menu).map(([menuName, stats]) => (
                  <div key={menuName} className="stat-card menu">
                    <div className="stat-label">{menuName}</div>
                    <div className="stat-details">
                      <div>판매: {stats.count}개</div>
                      <div>매출: ₩{formatCurrency(stats.revenue)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!dailyStats || dailyStats.total_orders === 0 && (
              <div className="no-stats">
                아직 오늘 주문이 없습니다 📭
              </div>
            )}
          </div>

          {/* 주문 현황 */}
          <div className="orders-section">
            <h3>📋 주문 현황</h3>
            <div className="orders-columns">
              <div className="order-column">
                <h4>⏳ 대기 중 ({orders.filter(o => o.status === 'waiting').length})</h4>
                {orders.filter(o => o.status === 'waiting').map(order => (
                  <div key={order.id} className="order-card waiting">
                    <div className="order-header">
                      <span>#{order.orderNumber}</span>
                      <span>{order.timeDisplay}</span>
                    </div>
                    <div className="order-burger">{order.burger.emoji} {order.burger.name}</div>
                    <div className="order-price">₩{order.burger.price.toLocaleString()}</div>
                    <button 
                      className="status-button cooking"
                      onClick={() => updateOrderStatus(order.id, 'cooking')}
                    >
                      조리 시작
                    </button>
                  </div>
                ))}
              </div>

              <div className="order-column">
                <h4>🍳 조리 중 ({orders.filter(o => o.status === 'cooking').length})</h4>
                {orders.filter(o => o.status === 'cooking').map(order => (
                  <div key={order.id} className="order-card cooking">
                    <div className="order-header">
                      <span>#{order.orderNumber}</span>
                      <span>{order.timeDisplay}</span>
                    </div>
                    <div className="order-burger">{order.burger.emoji} {order.burger.name}</div>
                    <div className="order-price">₩{order.burger.price.toLocaleString()}</div>
                    <button 
                      className="status-button completed"
                      onClick={() => updateOrderStatus(order.id, 'completed')}
                    >
                      완료
                    </button>
                  </div>
                ))}
              </div>

              <div className="order-column">
                <h4>✅ 완료 ({orders.filter(o => o.status === 'completed').length})</h4>
                {orders.filter(o => o.status === 'completed').slice(0, 5).map(order => (
                  <div key={order.id} className="order-card completed">
                    <div className="order-header">
                      <span>#{order.orderNumber}</span>
                      <span>{order.timeDisplay}</span>
                    </div>
                    <div className="order-burger">{order.burger.emoji} {order.burger.name}</div>
                    <div className="order-price">₩{order.burger.price.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
