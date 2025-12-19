import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Firebase 설정
// 🔥 여기에 본인의 Firebase 설정을 넣으세요!
// Firebase Console에서 복사한 설정 붙여넣기
const firebaseConfig = {

  apiKey: "AIzaSyCLCUaHDjixlrQrRL1j2jE211lwKNf1o0o",

  authDomain: "rokey-buger.firebaseapp.com",

  databaseURL: "https://rokey-buger-default-rtdb.asia-southeast1.firebasedatabase.app",

  projectId: "rokey-buger",

  storageBucket: "rokey-buger.firebasestorage.app",

  messagingSenderId: "703120074922",

  appId: "1:703120074922:web:06ffc3ce9cbd715082c8d3"

};

// Firebase 초기화
const app = initializeApp(firebaseConfig);

// Realtime Database 가져오기
const database = getDatabase(app);

export { database };
