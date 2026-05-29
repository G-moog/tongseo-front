import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { uploadImages } from '../lib/uploadImages'
import { useAuth } from '../contexts/AuthContext'
import SideDrawer from '../components/SideDrawer'
import type { Category, Note } from '../types'

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '방금'
  if (diffMin < 60) return `${diffMin}분 전`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}시간 전`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

interface ClassifyResult {
  category: string
  remind_at: string | null
}

type Step = 'write' | 'confirm_remind' | 'pick_remind'

export default function HomePage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const categoryPickerRef = useRef<HTMLDivElement>(null)

  const imageInputRef = useRef<HTMLInputElement>(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [recentNotes, setRecentNotes] = useState<Note[]>([])
  const aiEnabled = profile?.ai_classify_enabled ?? true

  const [content, setContent] = useState('')
  const [isManual, setIsManual] = useState(!aiEnabled)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])

  const [remindEnabled, setRemindEnabled] = useState(false)

  const [step, setStep] = useState<Step>('write')
  const [classifyResult, setClassifyResult] = useState<ClassifyResult | null>(null)
  const [manualRemind, setManualRemind] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchRecent = async () => {
    if (!user) return
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false })
    setRecentNotes(data ?? [])
  }

  useEffect(() => {
    if (!user) return
    supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at')
      .then(({ data }) => {
        setCategories(data ?? [])
        const defaultCat = profile?.default_manual_category ?? '미분류'
        setSelectedCategory(defaultCat)
      })
    fetchRecent()
  }, [user])

  // 카테고리 피커 외부 클릭 시 닫기
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (categoryPickerRef.current && !categoryPickerRef.current.contains(e.target as Node)) {
      setShowCategoryPicker(false)
    }
  }, [])

  useEffect(() => {
    if (showCategoryPicker) {
      document.addEventListener('mousedown', handleOutsideClick)
    } else {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [showCategoryPicker, handleOutsideClick])

  // textarea 자동 높이 조절
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  const showSuccess = (msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 2500)
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setImageFiles(prev => [...prev, ...files])
    const previews = files.map(f => URL.createObjectURL(f))
    setImagePreviews(prev => [...prev, ...previews])
    e.target.value = ''
  }

  const removeImage = (idx: number) => {
    URL.revokeObjectURL(imagePreviews[idx])
    setImageFiles(prev => prev.filter((_, i) => i !== idx))
    setImagePreviews(prev => prev.filter((_, i) => i !== idx))
  }

  const saveNote = async (result: ClassifyResult | null, remindAt: string | null) => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const uploadedUrls = imageFiles.length > 0
        ? await uploadImages(user.id, imageFiles)
        : []

      const fallbackCat = profile?.default_manual_category ?? '미분류'
      const payload = isManual
        ? { user_id: user.id, content, is_manual: true, manual_category: selectedCategory, category: selectedCategory, image_urls: uploadedUrls }
        : result
          ? { user_id: user.id, content, is_manual: false, category: result.category, remind_at: remindAt, image_urls: uploadedUrls }
          : { user_id: user.id, content, is_manual: false, category: fallbackCat, image_urls: uploadedUrls }

      const { error } = await supabase.from('notes').insert(payload as never)
      if (error) throw error

      // 저장 후 초기화
      setContent('')
      setStep('write')
      setClassifyResult(null)
      setManualRemind('')
      imagePreviews.forEach(url => URL.revokeObjectURL(url))
      setImageFiles([])
      setImagePreviews([])
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.focus()
      }
      showSuccess(isManual ? '메모가 저장됐습니다 ✓' : `[${result?.category}] 로 분류됐습니다 ✓`)
      fetchRecent()
    } catch {
      setError('저장에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    const hasContent = content.trim().length > 0
    const hasImages = imageFiles.length > 0
    if ((!hasContent && !hasImages) || loading) return
    setError('')

    // AI OFF이거나, 수동분류이거나, 이미지만 있을 때 바로 저장
    if (!aiEnabled || isManual || !hasContent) {
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

      if (result.remind_at && remindEnabled) {
        setStep('confirm_remind')
      } else {
        await saveNote(result, null)
      }
    } catch {
      setError('AI 분류 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  const selectedCat = categories.find(c => c.name === selectedCategory)

  // ── 알림 확인 화면
  if (step === 'confirm_remind' && classifyResult?.remind_at) {
    const d = new Date(classifyResult.remind_at)
    const label = `${d.getMonth() + 1}월 ${d.getDate()}일 ${d.getHours()}시`
    return (
      <div className="flex flex-col min-h-svh bg-[#111118]">
        <header className="flex items-center gap-3 px-4 py-4 border-b border-[#2e2e42]">
          <button onClick={() => setStep('write')} className="text-gray-500 hover:text-gray-300 transition-colors">←</button>
          <span className="font-semibold text-gray-100">알림 설정</span>
        </header>
        <div className="flex-1 flex flex-col justify-center px-6 gap-6 max-w-[440px] mx-auto w-full">
          <div className="bg-violet-600/10 border border-violet-500/20 rounded-2xl p-5 flex flex-col gap-2">
            <span className="text-2xl">🔔</span>
            <p className="font-medium text-gray-100">{label}에 알림 드릴까요?</p>
            <p className="text-sm text-gray-500">AI가 메모에서 일정을 감지했습니다</p>
          </div>
          {error && <p className="text-sm text-red-400 text-center">{error}</p>}
          <div className="flex flex-col gap-3">
            <button onClick={() => saveNote(classifyResult, classifyResult.remind_at)} disabled={loading}
              className="w-full py-3 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-700 disabled:opacity-40 transition-colors">
              {loading ? '저장 중...' : '네, 알림 받을게요'}
            </button>
            <button onClick={() => setStep('pick_remind')}
              className="w-full py-3 border border-[#2e2e42] text-gray-300 rounded-xl font-medium hover:bg-[#1c1c27] transition-colors">
              직접 설정할게요
            </button>
            <button onClick={() => saveNote(classifyResult, null)} disabled={loading}
              className="w-full py-3 text-gray-600 text-sm hover:text-gray-400 transition-colors">
              알림 없이 저장
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── 날짜 선택 화면
  if (step === 'pick_remind') {
    return (
      <div className="flex flex-col min-h-svh bg-[#111118]">
        <header className="flex items-center gap-3 px-4 py-4 border-b border-[#2e2e42]">
          <button onClick={() => setStep(classifyResult?.remind_at ? 'confirm_remind' : 'write')}
            className="text-gray-500 hover:text-gray-300 transition-colors">←</button>
          <span className="font-semibold text-gray-100">알림 날짜 설정</span>
        </header>
        <div className="flex-1 flex flex-col justify-center px-6 gap-6 max-w-[440px] mx-auto w-full">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-300">알림 날짜/시간</label>
            <input type="datetime-local" value={manualRemind} onChange={e => setManualRemind(e.target.value)}
              className="w-full px-4 py-3 border border-[#2e2e42] rounded-xl text-sm bg-[#1c1c27] text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500 [color-scheme:dark]" />
          </div>
          {error && <p className="text-sm text-red-400 text-center">{error}</p>}
          <div className="flex flex-col gap-3">
            <button onClick={() => saveNote(classifyResult, manualRemind ? new Date(manualRemind).toISOString() : null)}
              disabled={loading}
              className="w-full py-3 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-700 disabled:opacity-40 transition-colors">
              {loading ? '저장 중...' : '저장하기'}
            </button>
            <button onClick={() => saveNote(classifyResult, null)} disabled={loading}
              className="w-full py-3 text-gray-600 text-sm hover:text-gray-400 transition-colors">
              알림 없이 저장
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── 메인 입력 화면
  return (
    <div className="flex flex-col h-svh bg-[#111118]">
      <SideDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* 상단 바 */}
      <header className="flex items-center justify-between px-4 py-3 shrink-0">
        <button
          onClick={() => setDrawerOpen(true)}
          className="w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-lg hover:bg-[#1c1c27] transition-colors"
        >
          <span className="w-5 h-0.5 bg-gray-400 rounded-full" />
          <span className="w-5 h-0.5 bg-gray-400 rounded-full" />
          <span className="w-5 h-0.5 bg-gray-400 rounded-full" />
        </button>
        <span className="text-gray-500 text-sm font-medium">통서(通書)</span>
        <div className="w-9" />
      </header>

      {/* 메모 피드 — 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto px-4 pt-1 pb-2 flex flex-col gap-1.5 min-h-0">
        {recentNotes.length === 0 ? (
          <p className="text-center text-gray-700 text-xs py-6">첫 메모를 작성해보세요</p>
        ) : recentNotes.map(note => {
          const cat = categories.find(c => c.name === (note.is_manual ? note.manual_category : note.category))
          return (
            <div
              key={note.id}
              className="bg-[#1c1c27] rounded-xl border border-[#2e2e42] px-3 py-2 flex flex-col gap-1 shrink-0"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {cat && (
                    <span
                      className="px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white"
                      style={{ backgroundColor: cat.color ?? '#7c3aed' }}
                    >
                      {cat.emoji} {cat.name}
                    </span>
                  )}
                  <span className="text-[10px] text-gray-600">{formatTime(note.updated_at)}</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => navigate('/edit', { state: { note } })}
                    className="p-1 text-gray-600 hover:text-violet-400 transition-colors text-xs"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm('이 메모를 삭제할까요?')) return
                      await supabase.from('notes').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', note.id)
                      fetchRecent()
                    }}
                    className="p-1 text-gray-600 hover:text-red-400 transition-colors text-xs"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">{note.content}</p>
              {note.image_urls && note.image_urls.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto pt-0.5">
                  {note.image_urls.map((url, i) => (
                    <img key={i} src={url} className="w-14 h-14 object-cover rounded-lg border border-[#2e2e42] shrink-0" />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 입력 영역 — 하단 고정 */}
      <main className="shrink-0 px-4 pb-4 pt-2 border-t border-[#1e1e2e]">
        <div className="flex flex-col gap-3">

          {/* 성공 메시지 */}
          {success && (
            <div className="bg-violet-600/10 border border-violet-500/20 rounded-xl px-4 py-3 text-sm text-violet-300 text-center animate-pulse">
              {success}
            </div>
          )}

          {/* 알림 토글 — 입력창 우측 위 */}
          <div className="flex justify-end mb-2">
            <button
              onClick={() => setRemindEnabled(v => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                remindEnabled
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-transparent border-[#2e2e42] text-gray-600 hover:text-gray-400'
              }`}
            >
              <span>{remindEnabled ? '🔔' : '🔕'}</span>
              <span>{remindEnabled ? '알림 ON' : '알림 OFF'}</span>
            </button>
          </div>

          {/* 이미지 input (숨김) */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageSelect}
          />

          {/* 텍스트 입력 박스 */}
          <div ref={categoryPickerRef} className="bg-[#1c1c27] border border-[#2e2e42] rounded-2xl overflow-hidden focus-within:border-[#4a4a60] transition-colors">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              onKeyDown={handleKeyDown}
              placeholder="메모를 입력하세요..."
              rows={4}
              className="w-full px-4 pt-4 pb-2 bg-transparent text-gray-100 text-base leading-relaxed placeholder-gray-600 focus:outline-none resize-none"
            />

            {/* 이미지 미리보기 */}
            {imagePreviews.length > 0 && (
              <div className="flex gap-2 px-3 pb-2 overflow-x-auto">
                {imagePreviews.map((src, idx) => (
                  <div key={idx} className="relative shrink-0">
                    <img src={src} className="w-16 h-16 object-cover rounded-lg border border-[#3a3a50]" />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#111118] border border-[#3a3a50] rounded-full text-gray-400 hover:text-red-400 flex items-center justify-center text-[10px]"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 오류 메시지 */}
            {error && <p className="px-4 pb-2 text-sm text-red-400">{error}</p>}

            {/* 옵션 버튼 행 */}
            <div className="flex items-center justify-between px-3 pb-3 pt-1 gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                {/* 이미지 첨부 버튼 */}
                <button
                  onClick={() => imageInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#252535] border border-[#3a3a50] text-gray-400 text-xs font-medium hover:text-gray-200 hover:bg-[#2e2e42] transition-colors"
                >
                  <span>🖼️</span>
                  {imagePreviews.length > 0 && <span className="text-violet-400">{imagePreviews.length}</span>}
                </button>
                {/* 자동분류 / 수동분류 토글 버튼 */}
                {!isManual && aiEnabled ? (
                  <button
                    onClick={() => setIsManual(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-300 text-xs font-medium hover:bg-violet-600/30 transition-colors"
                  >
                    <span>✨</span>
                    <span>자동분류</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setShowCategoryPicker(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#252535] border border-[#3a3a50] text-gray-200 text-xs font-medium hover:bg-[#2e2e42] transition-colors"
                      style={{ borderColor: selectedCat?.color ? selectedCat.color + '60' : undefined }}
                    >
                      <span>{selectedCat?.emoji ?? '📌'}</span>
                      <span>{selectedCategory || '카테고리'}</span>
                      <span className="text-gray-500">▾</span>
                    </button>
                    {aiEnabled && (
                      <button
                        onClick={() => { setIsManual(false); setShowCategoryPicker(false) }}
                        className="px-2 py-1.5 rounded-lg text-gray-600 hover:text-gray-400 text-xs transition-colors"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 전송 버튼 */}
              <button
                onClick={handleSend}
                disabled={loading || (!content.trim() && imageFiles.length === 0)}
                className="w-8 h-8 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center flex-shrink-0"
              >
                {loading
                  ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <span className="text-white text-sm">↑</span>
                }
              </button>
            </div>

            {/* 카테고리 선택 드롭다운 */}
            {showCategoryPicker && (
              <div className="border-t border-[#2e2e42] px-3 pb-3 pt-2 flex flex-wrap gap-2">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => { setSelectedCategory(cat.name); setShowCategoryPicker(false) }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                      selectedCategory === cat.name
                        ? 'text-white border-transparent'
                        : 'text-gray-400 border-[#2e2e42] hover:text-gray-200 hover:border-[#4a4a60]'
                    }`}
                    style={selectedCategory === cat.name ? { backgroundColor: cat.color ?? '#7c3aed' } : undefined}
                  >
                    {cat.emoji} {cat.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="text-center text-[11px] text-gray-700">
            {isManual ? '선택한 카테고리로 저장됩니다' : 'AI가 자동으로 분류합니다 · Ctrl+Enter로 전송'}
          </p>
        </div>
      </main>
    </div>
  )
}
