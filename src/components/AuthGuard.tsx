import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const ONBOARDING_SKIPPED_KEY = 'onboarding_skipped'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading, profile } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen />
  if (!session) return <Navigate to="/login" replace />

  // 최초 로그인 + API 키 없음 + 온보딩 아직 안 본 경우 → 온보딩 화면
  const onboardingSkipped = localStorage.getItem(ONBOARDING_SKIPPED_KEY) === 'true'
  if (
    profile !== null &&
    profile.api_key === null &&
    !onboardingSkipped &&
    location.pathname !== '/setup-api-key'
  ) {
    return <Navigate to="/setup-api-key" replace />
  }

  return <>{children}</>
}

export function RequireNoAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (session) return <Navigate to="/" replace />
  return <>{children}</>
}

export function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-svh bg-[#111118]">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
