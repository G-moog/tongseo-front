import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading, hasApiKey } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen />
  if (!session) return <Navigate to="/login" replace />
  if (!hasApiKey && location.pathname !== '/setup-api-key') {
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
