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

  // ── Effect 2: 세션이 확정된 뒤 프로필 로딩 + 미분류 카테고리 보장
  useEffect(() => {
    if (session === undefined) return
    if (session === null) return

    const userId = session.user.id
    setProfile(undefined)

    // DB 트리거가 신규 유저 프로필 + 미분류 카테고리를 자동 생성하므로 별도 처리 불필요
    fetchProfileFromDB(userId).then(setProfile)
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

  // OAuth 리다이렉트 후 세션 확인 시 이메일 허용 여부 검사
  useEffect(() => {
    if (!session?.user?.email) return

    const checkAllowed = async () => {
      const { data, error } = await supabase.rpc('is_email_allowed', {
        p_email: session.user.email,
      })
      if (error) return // 함수 오류 시 차단하지 않음 (안전 방향)
      if (data === false) {
        await supabase.auth.signOut()
        window.location.href = '/login?error=not_allowed'
      }
    }

    checkAllowed()
  }, [session?.user?.email])

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
