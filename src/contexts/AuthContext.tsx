import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { UserProfile } from '../types'

interface AuthContextType {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  loading: boolean
  hasApiKey: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

type Maybe<T> = T | null | undefined

async function fetchProfileFromDB(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) {
    console.error('[profile] fetch error:', error.message)
    return null
  }
  return data as UserProfile ?? null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Maybe<Session>>(undefined)
  const [profile, setProfile] = useState<Maybe<UserProfile>>(undefined)

  // ── Effect 1: 세션 감지 (onAuthStateChange만 담당)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null)
      if (!newSession) setProfile(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Effect 2: 세션이 확정된 뒤 프로필 로딩 (React 렌더 이후 실행되므로 클라이언트 세션이 커밋된 상태)
  useEffect(() => {
    if (session === undefined) return   // 아직 모름 — 대기
    if (session === null) return        // 로그아웃 — 프로필 불필요

    setProfile(undefined) // 로딩 중 표시
    fetchProfileFromDB(session.user.id).then(setProfile)
  }, [session?.user?.id])

  const loading =
    session === undefined ||
    (session !== null && profile === undefined)

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
  }

  const refreshProfile = async () => {
    if (!session?.user) return
    setProfile(undefined)
    const p = await fetchProfileFromDB(session.user.id)
    setProfile(p)
  }

  return (
    <AuthContext.Provider value={{
      session: session ?? null,
      user: session?.user ?? null,
      profile: profile ?? null,
      loading,
      hasApiKey: !!profile?.api_key,
      signInWithGoogle,
      signOut,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
