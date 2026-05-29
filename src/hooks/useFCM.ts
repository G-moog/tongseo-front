import { useEffect } from 'react'
import { getToken, onMessage } from 'firebase/messaging'
import { messaging } from '../lib/firebase'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useFCM() {
  const { user, profile } = useAuth()

  // 알림 권한 요청 + FCM 토큰 등록
  useEffect(() => {
    if (!user || !profile) return
    if (!profile.notification_enabled) return
    if (!messaging) return
    if (!('Notification' in window)) return
    if (!('serviceWorker' in navigator)) return

    registerToken(user.id)
  }, [user?.id, profile?.notification_enabled])

  // 앱 포그라운드 상태에서 메시지 수신 시 브라우저 알림 표시
  useEffect(() => {
    if (!messaging) return
    const unsubscribe = onMessage(messaging, (payload) => {
      const title = payload.notification?.title ?? '통서(通書)'
      const body = payload.notification?.body ?? ''
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/icon.svg' })
      }
    })
    return unsubscribe
  }, [])
}

async function registerToken(userId: string) {
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    // Firebase 전용 서비스 워커 등록
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/firebase-cloud-messaging-push-scope',
    })

    const token = await getToken(messaging!, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: swReg,
    })
    if (!token) return

    // device_tokens 테이블에 저장 (중복 방지 upsert)
    await supabase.from('device_tokens').upsert(
      {
        user_id: userId,
        token,
        platform: 'web',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,token' }
    )
  } catch (err) {
    console.warn('[FCM] 토큰 등록 실패:', err)
  }
}
