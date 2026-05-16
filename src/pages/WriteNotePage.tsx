import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Category, Note } from '../types'

interface ClassifyResult {
  category: string
  title: string
  summary: string
  remind_at: string | null
}

type Step = 'write' | 'confirm_remind' | 'pick_remind'

export default function WriteNotePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const editNote: Note | undefined = location.state?.note

  const { user, profile } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [content, setContent] = useState(editNote?.content ?? '')
  const [isManual, setIsManual] = useState(editNote?.is_manual ?? false)
  const [selectedCategory, setSelectedCategory] = useState(
    editNote?.manual_category ?? profile?.default_manual_category ?? ''
  )
  const [step, setStep] = useState<Step>('write')
  const [classifyResult, setClassifyResult] = useState<ClassifyResult | null>(null)
  const [manualRemind, setManualRemind] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at')
      .then(({ data }) => {
        setCategories(data ?? [])
        if (!selectedCategory && data?.[0]) {
          setSelectedCategory(data[0].name)
        }
      })
  }, [user])

  const saveNote = async (result: ClassifyResult | null, remindAt: string | null) => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const payload = isManual
        ? {
            user_id: user.id,
            content,
            is_manual: true,
            manual_category: selectedCategory,
            category: selectedCategory,
          }
        : {
            user_id: user.id,
            content,
            is_manual: false,
            category: result?.category ?? null,
            title: result?.title ?? null,
            summary: result?.summary ?? null,
            remind_at: remindAt,
          }

      if (editNote) {
        const { error } = await supabase
          .from('notes')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editNote.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('notes').insert(payload as never)
        if (error) throw error
      }
      navigate('/', { replace: true })
    } catch {
      setError('저장에 실패했습니다. 다시 시도해주세요.')
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!content.trim()) return
    setError('')

    if (isManual) {
      await saveNote(null, null)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('classify-note', {
        body: { content: content.trim() },
      })
      if (error) throw error
      const result: ClassifyResult = data
      setClassifyResult(result)

      if (result.remind_at) {
        setStep('confirm_remind')
      } else {
        await saveNote(result, null)
      }
    } catch {
      setError('AI 분류 중 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'confirm_remind' && classifyResult?.remind_at) {
    const d = new Date(classifyResult.remind_at)
    const label = `${d.getMonth() + 1}월 ${d.getDate()}일 ${d.getHours()}시`
    return (
      <div className="flex flex-col min-h-svh bg-[#111118]">
        <header className="flex items-center gap-3 px-4 py-4 border-b border-[#2e2e42]">
          <button onClick={() => setStep('write')} className="text-gray-500 text-sm hover:text-gray-300 transition-colors">← 뒤로</button>
          <h1 className="font-semibold text-gray-100">알림 설정</h1>
        </header>
        <div className="flex-1 flex flex-col justify-center px-6 gap-6">
          <div className="bg-violet-600/10 border border-violet-500/20 rounded-2xl p-5 flex flex-col gap-2">
            <span className="text-2xl">🔔</span>
            <p className="font-medium text-gray-100">{label}에 알림 드릴까요?</p>
            <p className="text-sm text-gray-500">AI가 메모에서 일정을 감지했습니다</p>
          </div>
          {error && <p className="text-sm text-red-400 text-center">{error}</p>}
          <div className="flex flex-col gap-3">
            <button
              onClick={() => saveNote(classifyResult, classifyResult.remind_at)}
              disabled={loading}
              className="w-full py-3 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-700 disabled:opacity-40 transition-colors"
            >
              {loading ? '저장 중...' : '네, 알림 받을게요'}
            </button>
            <button
              onClick={() => setStep('pick_remind')}
              className="w-full py-3 border border-[#2e2e42] text-gray-300 rounded-xl font-medium hover:bg-[#1c1c27] transition-colors"
            >
              직접 설정할게요
            </button>
            <button
              onClick={() => saveNote(classifyResult, null)}
              disabled={loading}
              className="w-full py-3 text-gray-600 text-sm hover:text-gray-400 transition-colors"
            >
              알림 없이 저장
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'pick_remind') {
    return (
      <div className="flex flex-col min-h-svh bg-[#111118]">
        <header className="flex items-center gap-3 px-4 py-4 border-b border-[#2e2e42]">
          <button
            onClick={() => setStep(classifyResult?.remind_at ? 'confirm_remind' : 'write')}
            className="text-gray-500 text-sm hover:text-gray-300 transition-colors"
          >← 뒤로</button>
          <h1 className="font-semibold text-gray-100">알림 날짜 설정</h1>
        </header>
        <div className="flex-1 flex flex-col justify-center px-6 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-300">알림 날짜/시간</label>
            <input
              type="datetime-local"
              value={manualRemind}
              onChange={e => setManualRemind(e.target.value)}
              className="w-full px-4 py-3 border border-[#2e2e42] rounded-xl text-sm bg-[#1c1c27] text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500 [color-scheme:dark]"
            />
          </div>
          {error && <p className="text-sm text-red-400 text-center">{error}</p>}
          <div className="flex flex-col gap-3">
            <button
              onClick={() => saveNote(classifyResult, manualRemind ? new Date(manualRemind).toISOString() : null)}
              disabled={loading}
              className="w-full py-3 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-700 disabled:opacity-40 transition-colors"
            >
              {loading ? '저장 중...' : '저장하기'}
            </button>
            <button
              onClick={() => saveNote(classifyResult, null)}
              disabled={loading}
              className="w-full py-3 text-gray-600 text-sm hover:text-gray-400 transition-colors"
            >
              알림 없이 저장
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-svh bg-[#111118]">
      <header className="flex items-center justify-between px-4 py-4 border-b border-[#2e2e42]">
        <button onClick={() => navigate(-1)} className="text-gray-500 text-sm hover:text-gray-300 transition-colors">← 취소</button>
        <h1 className="font-semibold text-gray-100">{editNote ? '메모 수정' : '메모 작성'}</h1>
        <button
          onClick={handleSubmit}
          disabled={loading || !content.trim()}
          className="text-sm font-semibold text-violet-400 disabled:text-gray-700 transition-colors"
        >
          {loading ? '처리 중...' : '저장'}
        </button>
      </header>

      <div className="flex-1 flex flex-col px-4 pt-4 gap-4">
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="메모를 입력하세요..."
          autoFocus
          className="flex-1 w-full resize-none text-gray-100 text-base leading-relaxed placeholder-gray-700 focus:outline-none min-h-[200px] bg-transparent"
        />

        <div className="border-t border-[#2e2e42] pt-4 pb-6 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">카테고리 고정</span>
            <button
              onClick={() => setIsManual(v => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors ${isManual ? 'bg-violet-600' : 'bg-[#2e2e42]'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isManual ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {isManual ? (
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-[#2e2e42] rounded-lg text-sm bg-[#1c1c27] text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {categories.map(c => (
                <option key={c.id} value={c.name}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-medium text-white bg-violet-600/80">
                ✨ 자동분류
              </span>
              <span className="text-xs text-gray-600">AI가 카테고리를 자동으로 선택합니다</span>
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  )
}
