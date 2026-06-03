import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const ONBOARDING_SKIPPED_KEY = 'onboarding_skipped'

export default function ApiKeyPage() {
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { user, refreshProfile } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const key = apiKey.trim()
    if (!key) return

    if (!key.startsWith('sk-ant-')) {
      setError('Claude API 키는 sk-ant- 로 시작해야 합니다.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { error } = await supabase.functions.invoke('update-api-key', {
        body: { api_key: key },
      })
      if (error) throw error
      // API 키 등록 시 ai_classify_enabled = true
      await supabase.from('users').update({ ai_classify_enabled: true }).eq('id', user!.id)
      localStorage.setItem(ONBOARDING_SKIPPED_KEY, 'true')
      await refreshProfile()
      navigate('/', { replace: true })
    } catch {
      setError('API 키 등록에 실패했습니다. 키를 다시 확인해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = async () => {
    if (!user) return
    setSkipping(true)
    // AI 분류 OFF로 설정
    await supabase.from('users').update({ ai_classify_enabled: false }).eq('id', user.id)
    localStorage.setItem(ONBOARDING_SKIPPED_KEY, 'true')
    await refreshProfile()
    navigate('/', { replace: true })
    setSkipping(false)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-svh px-6 bg-[#111118]">
      <div className="w-full max-w-[440px] flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-white">Claude API 키를 등록해주세요</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            AI 자동 분류 기능을 사용하려면 Anthropic API 키가 필요해요.
            키가 없어도 앱은 사용할 수 있어요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-300">API 키</label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full px-4 py-3 border border-[#2e2e42] rounded-xl text-sm bg-[#1c1c27] text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              autoComplete="off"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-violet-400 hover:text-violet-300 hover:underline transition-colors"
          >
            Anthropic Console에서 키 발급받기 →
          </a>

          <button
            type="submit"
            disabled={loading || !apiKey.trim()}
            className="w-full py-3 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '등록 중...' : '등록하기'}
          </button>
        </form>

        {/* 다음에 입력 버튼 */}
        <button
          onClick={handleSkip}
          disabled={skipping}
          className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-40"
        >
          {skipping ? '처리 중...' : '다음에 입력 (AI 분류 OFF)'}
        </button>
      </div>
    </div>
  )
}
