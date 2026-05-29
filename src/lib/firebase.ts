import { initializeApp, getApps } from 'firebase/app'
import { getMessaging } from 'firebase/messaging'

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
const appId = import.meta.env.VITE_FIREBASE_APP_ID

// 환경변수가 없으면 Firebase 초기화 건너뜀
const isConfigured = apiKey && projectId && appId

const app = isConfigured
  ? (getApps().length === 0
      ? initializeApp({
          apiKey,
          authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
          projectId,
          storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId,
        })
      : getApps()[0])
  : null

export const messaging =
  app && typeof window !== 'undefined' ? getMessaging(app) : null
