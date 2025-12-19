#!/usr/bin/env python3
"""
Firebase ↔ ROS2 브릿지 (Polling 방식)
- Firebase를 주기적으로 확인 (1초마다)
- 새 주문을 발견하면 ROS2로 발행
"""

import rclpy
from rclpy.node import Node
from std_msgs.msg import String
import firebase_admin
from firebase_admin import credentials, db
import json
import time

class FirebaseROS2Bridge(Node):
    def __init__(self):
        super().__init__('firebase_ros2_bridge')
        
        self.get_logger().info('🔥🤖 Firebase-ROS2 브릿지 시작! (Polling 방식)')
        
        # Firebase 초기화
        self.init_firebase()
        
        # ROS2 Publisher - 주문을 로봇으로 전송
        self.order_publisher = self.create_publisher(
            String, 
            '/burger_order', 
            10
        )
        
        # ROS2 Publisher - 긴급 정지 명령
        self.stop_publisher = self.create_publisher(
            String,
            '/robot_stop',
            10
        )
        # [추가] 복구 명령 발행 Publisher
        self.recovery_publisher = self.create_publisher(
            String,
            '/robot_recovery',
            10
        )

        # ROS2 Subscriber - 로봇 상태 수신
        self.status_subscriber = self.create_subscription(
            String,
            '/robot_status_update',
            self.robot_status_callback,
            10
        )
        
        # 이미 처리한 주문 ID 추적
        self.processed_orders = set()
        
        # ROS2 타이머 - 1초마다 Firebase 확인
        self.timer = self.create_timer(1.0, self.check_firebase)
        
        self.get_logger().info('✅ 브릿지 초기화 완료!')
        self.get_logger().info('⏰ 1초마다 Firebase 확인 중...')
        
    def init_firebase(self):
        """Firebase 초기화"""
        try:
            # Firebase Admin SDK 인증 파일 경로
            cred = credentials.Certificate('/home/rokey/jhj_important/rokey-buger-firebase-adminsdk-fbsvc-0cfd226e63.json')
            
            firebase_admin.initialize_app(cred, {
                'databaseURL': 'https://rokey-buger-default-rtdb.asia-southeast1.firebasedatabase.app'
            })
            
            
            self.get_logger().info('✅ Firebase 연결 성공!')
        except Exception as e:
            self.get_logger().error(f'❌ Firebase 초기화 실패: {e}')
            self.get_logger().error(f'💡 키 파일 위치: ~/robot-burger-firebase-ros2/ros2_bridge/firebase-service-account-key.json')
            raise  # 프로그램 종료
    
    def check_firebase(self):
        """Firebase에서 새 주문 확인 (1초마다 호출)"""
        try:
            # 주문 확인
            orders_ref = db.reference('orders')
            all_orders = orders_ref.get()
            
            if all_orders and isinstance(all_orders, dict):
                # 새 주문 찾기
                for order_id, order_data in all_orders.items():
                    if not isinstance(order_data, dict):
                        continue
                    
                    if order_id in self.processed_orders:
                        continue
                    
                    if order_data.get('status') == 'waiting':
                        self.get_logger().info(f'🔥 새 주문 감지: {order_id}')
                        self.publish_order_to_ros2(order_id, order_data)
                        self.processed_orders.add(order_id)
            
            # 긴급 정지 확인
            stop_ref = db.reference('emergency_stop')
            stop_data = stop_ref.get()
            
            if stop_data and isinstance(stop_data, dict):
                command = stop_data.get('command')
                timestamp = stop_data.get('timestamp', '')
                
                # 새로운 정지 명령인지 확인 (이전과 다른 timestamp)
                if not hasattr(self, 'last_stop_timestamp'):
                    self.last_stop_timestamp = None
                
                if command == 'stop' and timestamp != self.last_stop_timestamp:
                    self.get_logger().warn(f'🚨 긴급 정지 명령 감지! timestamp: {timestamp}')
                    self.publish_emergency_stop()
                    self.last_stop_timestamp = timestamp

            # [추가] 복구 명령 확인 (recovery_command)
            recovery_ref = db.reference('recovery_command')
            recovery_data = recovery_ref.get()
            
            if recovery_data and isinstance(recovery_data, dict):
                command = recovery_data.get('command')
                timestamp = recovery_data.get('timestamp', '')
                
                # 중복 실행 방지
                if not hasattr(self, 'last_recovery_timestamp'):
                    self.last_recovery_timestamp = None
                
                if timestamp != self.last_recovery_timestamp:
                    self.get_logger().info(f'🔄 복구 명령 감지: {command}')
                    self.publish_recovery_command(command)
                    self.last_recovery_timestamp = timestamp

        except Exception as e:
            self.get_logger().error(f'❌ Firebase 확인 오류: {e}')

    # [추가] 복구 명령 발행 함수
    def publish_recovery_command(self, command):
        msg = String()
        msg.data = command
        self.recovery_publisher.publish(msg)
        self.get_logger().info(f'📤 ROS2로 복구 명령 전송: {command}')

    def publish_emergency_stop(self):
        """긴급 정지 명령을 ROS2로 발행"""
        try:
            msg = String()
            msg.data = 'stop'
            self.stop_publisher.publish(msg)
            
            self.get_logger().warn('🛑 긴급 정지 명령을 ROS2로 발행!')
            
        except Exception as e:
            self.get_logger().error(f'❌ 긴급 정지 발행 실패: {e}')
    
    def publish_order_to_ros2(self, order_id, order_data):
        """주문을 ROS2로 발행"""
        try:
            # ROS2 메시지 생성
            msg = String()
            order_payload = {
                'order_id': order_id,
                'burger': order_data.get('burger'),
                'status': order_data.get('status'),
                'timestamp': order_data.get('timestamp')
            }
            msg.data = json.dumps(order_payload)
            
            # ROS2로 발행
            self.order_publisher.publish(msg)
            
            burger_name = order_data.get('burger', {}).get('name', '알 수 없음')
            self.get_logger().info(f'📤 ROS2로 주문 발행: {burger_name} (ID: {order_id})')
            
        except Exception as e:
            self.get_logger().error(f'❌ 주문 발행 실패: {e}')
    
    def robot_status_callback(self, msg):
        """ROS2에서 로봇 상태 수신"""
        try:
            status_data = json.loads(msg.data)
            
            # Firebase에 로봇 상태 업데이트
            status_ref = db.reference('robot_status')
            status_ref.set(status_data.get('status', 'idle'))
            
            self.get_logger().info(f'📥 로봇 상태 Firebase 업데이트: {status_data.get("status")}')
            
            # 주문 상태 업데이트 (있다면)
            if 'order_id' in status_data:
                order_ref = db.reference(f'orders/{status_data["order_id"]}')
                order_ref.update({'status': status_data['status']})
                
                self.get_logger().info(f'✅ 주문 {status_data["order_id"]} 상태 업데이트: {status_data["status"]}')
                
        except Exception as e:
            self.get_logger().error(f'❌ 상태 처리 실패: {e}')


def main(args=None):
    rclpy.init(args=args)
    
    try:
        bridge = FirebaseROS2Bridge()
        
        print('\n' + '='*60)
        print('🔥🤖 Firebase-ROS2 브릿지 실행 중! (Polling 방식)')
        print('='*60)
        print('✅ 1초마다 Firebase에서 새 주문을 확인합니다')
        print('✅ 웹에서 주문하면 자동으로 ROS2로 발행됩니다')
        print('Ctrl+C로 종료')
        print('='*60 + '\n')
        
        rclpy.spin(bridge)
    except KeyboardInterrupt:
        print('\n👋 브릿지 종료 중...')
    except Exception as e:
        print(f'❌ 브릿지 오류: {e}')
    finally:
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == '__main__':
    main()
