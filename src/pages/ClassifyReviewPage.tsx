import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Note, Category } from '../types'

interface ReviewItem {
  note: Note
  category: string   // AI 제안 or 사용자 수정
  confirmed: boolean
}

export default function ClassifyReviewPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<ReviewItem[]>([])
  const [openPicker, setOpenPicker] = useState<string | null>(null) // note id

  const [phase, setPhase] = useState<'loading' | 'review' | 'saving' | 'done'>('loading')
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    startClassify()
  }, [user])

  const startClassify = async () => {
    if (!user) return
    setPhase('loading')
    setError('')

    const [notesRes, catsRes] = await Promise.all([
      supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .eq('is_manual', false)
        .or('category.eq.미분류,category.is.null'),
      supabase.from('categories').select('*').eq('user_id', user.id).order('created_at'),
    ])

    const unclassified: Note[] = notesRes.data ?? []
    setCategories(catsRes.data ?? [])
    setProgress({ current: 0, total: unclassified.length })

    if (unclassified.length === 0) {
      setPhase('review')
      setItems([])
      return
    }

    const results: ReviewItem[] = []
    for (let i = 0; i < unclassified.length; i++) {
      const note = unclassified[i]
      setProgress({ current: i + 1, total: unclassified.length })
      try {
        if (note.content?.trim()) {
          const { data } = await supabase.functions.invoke('classify-note', {
            body: { content: note.content.trim() },
          })
          results.push({ note, category: data?.category ?? '미분류', confirmed: false })
        } else {
          results.push({ note, category: '미분류', confirmed: false })
        }
      } catch {
        results.push({ note, category: '미분류', confirmed: false })
      }
    }

    setItems(results)
    setPhase('review')
  }

  const handleConfirm = async () => {
    if (!user || saving) return
    setSaving(true)
    setPhase('saving')
    try {
      for (const item of items) {
        await supabase.from('notes')
          .update({ category: item.category, is_manual: true, manual_category: item.category, updated_at: new Date().toISOString() })
          .eq('id', item.note.id)
      }
      setPhase('done')
    } catch {
      setError('저장 중 오류가 발생했습니다.')
      setPhase('review')
    } finally {
      setSaving(false)
    }
  }

  const getCat = (name: string) => categories.find(c => c.name === name)

  // ── 로딩 화면
  if (phase === 'loading') {
    return (
      <div className="flex flex-col min-h-svh bg-[#111118]">
        <header className="flex items-center gap-3 px-4 py-4 border-b border-[#2e2e42]">
          <button onClick={() => navigate('/settings')} className="text-gray-500 hover:text-gray-300 transition-colors">←</button>
          <span className="font-semibold text-gray-100">미분류 메모 AI 분류</span>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6">
          <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          {progress.total > 0 && (
            <>
              <p className="text-gray-300 font-medium text-sm">
                {progress.current} / {progress.total} 분류 중...
              </p>
              <div className="w-full max-w-xs bg-[#2e2e42] rounded-full h-1.5">
                <div
                  className="bg-violet-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── 완료 화면
  if (phase === 'done') {
    return (
      <div className="flex flex-col min-h-svh bg-[#111118]">
        <header className="flex items-center gap-3 px-4 py-4 border-b border-[#2e2e42]">
          <button onClick={() => navigate('/settings')} className="text-gray-500 hover:text-gray-300 transition-colors">←</button>
          <span className="font-semibold text-gray-100">분류 완료</span>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <span className="text-4xl">✅</span>
          <p className="text-gray-200 font-medium">{items.length}개 메모 분류 완료</p>
          <button
            onClick={() => navigate('/notes')}
            className="px-6 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-colors">
            메모 목록 보기
          </button>
        </div>
      </div>
    )
  }

  // ── 검토 화면
  return (
    <div className="flex flex-col min-h-svh bg-[#111118]">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-[#2e2e42] sticky top-0 bg-[#111118] z-10">
        <button onClick={() => navigate('/settings')} className="text-gray-500 hover:text-gray-300 transition-colors">←</button>
        <div className="flex-1">
          <span className="font-semibold text-gray-100">분류 검토</span>
          {items.length > 0 && (
            <span className="ml-2 text-xs text-gray-500">{items.length}개</span>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 pt-4 pb-28 flex flex-col gap-2">
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 pt-24">
            <span className="text-3xl">🎉</span>
            <p className="text-gray-500 text-sm">미분류 메모가 없습니다</p>
            <button onClick={() => navigate('/notes')}
              className="text-violet-400 text-sm hover:text-violet-300 transition-colors">
              메모 목록으로 →
            </button>
          </div>
        ) : items.map(item => {
          const cat = getCat(item.category)
          return (
            <div key={item.note.id} className="bg-[#1c1c27] rounded-xl border border-[#2e2e42] px-3 py-2 flex flex-col gap-1.5">
              {/* 카테고리 선택 + 시간 */}
              <div className="flex items-center justify-between">
                <div className="relative">
                  <button
                    onClick={() => setOpenPicker(openPicker === item.note.id ? null : item.note.id)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-white hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: cat?.color ?? '#4b5563' }}
                  >
                    {cat ? `${cat.emoji} ${cat.name}` : '📥 미분류'}
                    <span className="opacity-60">▾</span>
                  </button>
                  {openPicker === item.note.id && (
                    <div className="absolute top-full left-0 mt-1 z-30 bg-[#1e1e2e] border border-[#3a3a50] rounded-xl p-2 flex flex-wrap gap-1.5 min-w-[180px] shadow-xl">
                      {categories.map(c => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setItems(prev => prev.map(i => i.note.id === item.note.id ? { ...i, category: c.name } : i))
                            setOpenPicker(null)
                          }}
                          className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium text-white hover:opacity-80 ${item.category === c.name ? 'ring-1 ring-white/40' : ''}`}
                          style={{ backgroundColor: c.color ?? '#7c3aed' }}
                        >
                          {c.emoji} {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-gray-600">
                  {new Date(item.note.created_at).getMonth() + 1}/{new Date(item.note.created_at).getDate()}
                </span>
              </div>
              {/* 내용 */}
              <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">{item.note.content}</p>
              {item.note.image_urls && item.note.image_urls.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto">
                  {item.note.image_urls.map((url, i) => (
                    <img key={i} src={url} className="w-12 h-12 object-cover rounded-lg border border-[#2e2e42] shrink-0" />
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {error && <p className="text-sm text-red-400 text-center py-2">{error}</p>}
      </main>

      {/* 하단 분류 확정 버튼 */}
      {items.length > 0 && (
        <div className="fixed bottom-[0.5em] left-1/2 -translate-x-1/2 w-full max-w-[440px] px-4">
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="w-full bg-violet-600 hover:bg-violet-500 active:bg-violet-700 disabled:opacity-40 rounded-xl py-2.5 flex items-center justify-center transition-colors"
          >
            <span className="text-base font-semibold text-white tracking-[0.4em]">
              {saving ? '저장 중...' : '분류 확정'}
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
