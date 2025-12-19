import React, { useState, useEffect } from 'react';
import * as ROSLIB from 'roslib'; //

const JogPopup = ({ onClose }) => {
  const [ros, setRos] = useState(null);
  const [connected, setConnected] = useState(false);
  
  // 이동 단위 설정
  const [jointStep, setJointStep] = useState(10.0);
  const [linearStep, setLinearStep] = useState(10.0);

  useEffect(() => {
    // 1. ROSBridge 연결 (로봇 PC IP가 다르면 localhost 대신 IP 입력)
    const rosConnection = new ROSLIB.Ros({
      url: 'ws://localhost:9090' 
    });

    rosConnection.on('connection', () => {
      console.log('✅ 로봇과 연결되었습니다!');
      setConnected(true);
    });

    rosConnection.on('error', (error) => {
      console.log('❌ 연결 에러:', error);
      setConnected(false);
    });

    rosConnection.on('close', () => {
      setConnected(false);
    });

    setRos(rosConnection);

    return () => {
      if (rosConnection) rosConnection.close();
    };
  }, []);

  // 2. 명령 전송 함수
  const sendJogCommand = (data) => {
    if (!ros || !connected) {
      alert("로봇과 연결되지 않았습니다! (Rosbridge 확인 필요)");
      return;
    }

    const jogTopic = new ROSLIB.Topic({
      ros: ros,
      name: '/burger_jog',
      messageType: 'std_msgs/String'
    });

    const msg = {
      data: JSON.stringify(data)
    };

    jogTopic.publish(msg);
  };

  // 스타일 (App.css 테마에 맞춤)
  const styles = {
    overlay: {
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 3000,
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    },
    popup: {
      backgroundColor: '#1e293b', border: '2px solid #10b981',
      padding: '2rem', borderRadius: '16px', width: '600px',
      color: 'white', boxShadow: '0 0 30px rgba(16, 185, 129, 0.2)'
    },
    section: { marginBottom: '1.5rem', background: 'rgba(15, 23, 42, 0.5)', padding: '1rem', borderRadius: '8px' },
    title: { color: '#10b981', marginBottom: '10px', fontSize: '1.2rem', borderBottom: '1px solid #334155', paddingBottom: '5px' },
    row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
    btn: {
      padding: '5px 15px', margin: '0 5px', cursor: 'pointer',
      background: '#334155', color: 'white', border: '1px solid #475569', borderRadius: '4px'
    },
    input: { width: '60px', background: '#0f172a', border: '1px solid #334155', color: 'white', padding: '5px', textAlign: 'center' },
    closeBtn: { 
      width: '100%', padding: '15px', background: '#ef4444', color: 'white', 
      border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px'
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.popup}>
        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
            <h2>🛠️ 로봇 수동 제어 (JOG)</h2>
            <span style={{color: connected ? '#10b981' : '#ef4444'}}>
                {connected ? '● 연결됨' : '○ 연결 끊김'}
            </span>
        </div>

        {/* 그리퍼 제어 */}
        <div style={styles.section}>
            <h3 style={styles.title}>🤲 그리퍼</h3>
            <div style={{display:'flex', gap:'10px'}}>
                <button style={{...styles.btn, background:'#10b981', flex:1, padding:'10px'}} 
                    onClick={() => sendJogCommand({ type: 'grip', cmd: 'catch' })}>✊ 잡기 (Catch)</button>
                <button style={{...styles.btn, background:'#f59e0b', flex:1, padding:'10px'}} 
                    onClick={() => sendJogCommand({ type: 'grip', cmd: 'release' })}>✋ 놓기 (Release)</button>
            </div>
        </div>

        {/* 관절 이동 */}
        <div style={styles.section}>
            <div style={styles.row}>
                <h3 style={styles.title}>🦾 관절 (Joint)</h3>
                <div>단위: <input type="number" value={jointStep} onChange={(e)=>setJointStep(Number(e.target.value))} style={styles.input} /> 도</div>
            </div>
            {['J1', 'J2', 'J3', 'J4', 'J5', 'J6'].map((axis, idx) => (
                <div key={axis} style={styles.row}>
                    <span>{axis}</span>
                    <div>
                        <button style={styles.btn} onClick={() => sendJogCommand({ type: 'joint', index: idx, value: -jointStep, mode: 'rel' })}>◀ -</button>
                        <button style={styles.btn} onClick={() => sendJogCommand({ type: 'joint', index: idx, value: jointStep, mode: 'rel' })}>+ ▶</button>
                    </div>
                </div>
            ))}
        </div>

        {/* 좌표 이동 */}
        <div style={styles.section}>
            <div style={styles.row}>
                <h3 style={styles.title}>📍 좌표 (Linear)</h3>
                <div>단위: <input type="number" value={linearStep} onChange={(e)=>setLinearStep(Number(e.target.value))} style={styles.input} /> mm</div>
            </div>
            {['X', 'Y', 'Z', 'Rx', 'Ry', 'Rz'].map((axis, idx) => (
                <div key={axis} style={styles.row}>
                    <span>{axis}</span>
                    <div>
                        <button style={styles.btn} onClick={() => sendJogCommand({ type: 'task', index: idx, value: -linearStep, mode: 'rel' })}>◀ -</button>
                        <button style={styles.btn} onClick={() => sendJogCommand({ type: 'task', index: idx, value: linearStep, mode: 'rel' })}>+ ▶</button>
                    </div>
                </div>
            ))}
        </div>

        <button style={{...styles.btn, width:'100%', marginBottom:'10px', background:'#6366f1'}} 
                onClick={() => sendJogCommand({ type: 'align' })}>📐 Z축 수직 정렬</button>

        <button style={styles.closeBtn} onClick={onClose}>창 닫기</button>
      </div>
    </div>
  );
};

export default JogPopup;
