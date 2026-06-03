import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { uploadImages } from '../lib/uploadImages'
import { useAuth } from '../contexts/AuthContext'
import type { Category, Note } from '../types'

interface ClassifyResult {
  category: string
  remind_at: string | null
}

type Step = 'write' | 'confirm_remind' | 'pick_remind'

export default function EditNotePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const note: Note = location.state?.note
  const from: string = location.state?.from ?? '/notes'

  const { user, profile } = useAuth()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const categoryPickerRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const [categories, setCategories] = useState<Category[]>([])
  const [content, setContent] = useState(note?.content ?? '')
  const [isManual, setIsManual] = useState(note?.is_manual ?? false)
  const [selectedCategory, setSelectedCategory] = useState(
    note?.manual_category ?? note?.category ?? profile?.default_manual_category ?? ''
  )
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [remindEnabled, setRemindEnabled] = useState(false)
  // 기존 이미지 URL (수정 시 유지)
  const [existingUrls, setExistingUrls] = useState<string[]>(note?.image_urls ?? [])
  // 새로 추가한 이미지
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])

  const [step, setStep] = useState<Step>('write')
  const [classifyResult, setClassifyResult] = useState<ClassifyResult | null>(null)
  const [manualRemind, setManualRemind] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // note 없이 접근 시 홈으로
  useEffect(() => {
    if (!note) navigate('/', { replace: true })
  }, [])

  useEffect(() => {
    if (!user) return
    supabase.from('categories').select('*').eq('user_id', user.id).order('created_at')
      .then(({ data }) => {
        setCategories(data ?? [])
        if (!selectedCategory && data?.[0]) setSelectedCategory(data[0].name)
      })
  }, [user])

  // 카테고리 피커 외부 클릭 닫기
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (categoryPickerRef.current && !categoryPickerRef.current.contains(e.target as Node)) {
      setShowCategoryPicker(false)
    }
  }, [])

  useEffect(() => {
    if (showCategoryPicker) document.addEventListener('mousedown', handleOutsideClick)
    else document.removeEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [showCategoryPicker, handleOutsideClick])

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setImageFiles(prev => [...prev, ...files])
    setImagePreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))])
    e.target.value = ''
  }

  const removeExisting = (idx: number) => {
    setExistingUrls(prev => prev.filter((_, i) => i !== idx))
  }

  const removeNew = (idx: number) => {
    URL.revokeObjectURL(imagePreviews[idx])
    setImageFiles(prev => prev.filter((_, i) => i !== idx))
    setImagePreviews(prev => prev.filter((_, i) => i !== idx))
  }

  const saveNote = async (result: ClassifyResult | null, remindAt: string | null) => {
    if (!user || !note) return
    setLoading(true)
    setError('')
    try {
      const newUrls = imageFiles.length > 0
        ? await uploadImages(user.id, imageFiles)
        : []
      const image_urls = [...existingUrls, ...newUrls]

      const payload = isManual
        ? { content, is_manual: true, manual_category: selectedCategory, category: selectedCategory, title: null, summary: null, image_urls }
        : { content, is_manual: false, category: result?.category ?? null, remind_at: remindAt, image_urls }

      const { error } = await supabase.from('notes')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', note.id)
      if (error) throw error
      navigate(from, { replace: true })
    } catch {
      setError('저장에 실패했습니다. 다시 시도해주세요.')
      setLoading(false)
    }
  }

  const handleSend = async () => {
    const hasContent = content.trim().length > 0
    const hasImages = existingUrls.length > 0 || imagePreviews.length > 0
    if ((!hasContent && !hasImages) || loading) return
    setError('')

    if (isManual || !hasContent) { await saveNote(null, null); return }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('classify-note', {
        body: { content: content.trim() },
      })
      if (error) throw error
      const result: ClassifyResult = data
      setClassifyResult(result)
      if (result.remind_at && remindEnabled) setStep('confirm_remind')
      else await saveNote(result, null)
    } catch {
      setError('AI 분류 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleSend() }
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
          <input type="datetime-local" value={manualRemind} onChange={e => setManualRemind(e.target.value)}
            className="w-full px-4 py-3 border border-[#2e2e42] rounded-xl text-sm bg-[#1c1c27] text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500 [color-scheme:dark]" />
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

  // ── 메인 수정 화면
  return (
    <div className="flex flex-col min-h-svh bg-[#111118]">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#2e2e42]">
        <button onClick={() => navigate(from)}
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
          ← 취소
        </button>
        <span className="text-sm font-semibold text-gray-300">메모 수정</span>
        <button onClick={handleSend} disabled={loading || (!content.trim() && existingUrls.length === 0 && imagePreviews.length === 0)}
          className="text-sm font-semibold text-violet-400 disabled:text-gray-700 transition-colors">
          {loading ? '처리 중...' : '저장'}
        </button>
      </header>

      <main className="flex-1 flex flex-col px-4 pb-4 pt-4">
        <div className="flex-1 flex flex-col justify-end gap-3">

          {/* 알림 토글 */}
          <div className="flex justify-end">
            <button onClick={() => setRemindEnabled(v => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                remindEnabled
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-transparent border-[#2e2e42] text-gray-600 hover:text-gray-400'
              }`}>
              <span>{remindEnabled ? '🔔' : '🔕'}</span>
              <span>{remindEnabled ? '알림 ON' : '알림 OFF'}</span>
            </button>
          </div>

          {/* 이미지 input (숨김) */}
          <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />

          {/* 입력 박스 */}
          <div ref={categoryPickerRef} className="bg-[#1c1c27] border border-[#2e2e42] rounded-2xl overflow-hidden focus-within:border-[#4a4a60] transition-colors">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              onKeyDown={handleKeyDown}
              rows={6}
              autoFocus
              className="w-full px-4 pt-4 pb-2 bg-transparent text-gray-100 text-base leading-relaxed placeholder-gray-600 focus:outline-none resize-none"
            />

            {/* 이미지 미리보기 (기존 + 신규) */}
            {(existingUrls.length > 0 || imagePreviews.length > 0) && (
              <div className="flex gap-2 px-3 pb-2 overflow-x-auto">
                {existingUrls.map((url, i) => (
                  <div key={`ex-${i}`} className="relative shrink-0">
                    <img src={url} className="w-16 h-16 object-cover rounded-lg border border-[#3a3a50]" />
                    <button onClick={() => removeExisting(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#111118] border border-[#3a3a50] rounded-full text-gray-400 hover:text-red-400 flex items-center justify-center text-[10px]">
                      ✕
                    </button>
                  </div>
                ))}
                {imagePreviews.map((src, i) => (
                  <div key={`new-${i}`} className="relative shrink-0">
                    <img src={src} className="w-16 h-16 object-cover rounded-lg border border-violet-500/40" />
                    <button onClick={() => removeNew(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#111118] border border-[#3a3a50] rounded-full text-gray-400 hover:text-red-400 flex items-center justify-center text-[10px]">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error && <p className="px-4 pb-2 text-sm text-red-400">{error}</p>}

            {/* 옵션 행 */}
            <div className="flex items-center justify-between px-3 pb-3 pt-1 gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                {/* 이미지 첨부 버튼 */}
                <button onClick={() => imageInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#252535] border border-[#3a3a50] text-gray-400 text-xs font-medium hover:text-gray-200 hover:bg-[#2e2e42] transition-colors">
                  <span>🖼️</span>
                  {(existingUrls.length + imagePreviews.length) > 0 && (
                    <span className="text-violet-400">{existingUrls.length + imagePreviews.length}</span>
                  )}
                </button>
                {!isManual ? (
                  <button onClick={() => setIsManual(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-300 text-xs font-medium hover:bg-violet-600/30 transition-colors">
                    <span>✨</span><span>자동분류</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setShowCategoryPicker(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#252535] border border-[#3a3a50] text-gray-200 text-xs font-medium hover:bg-[#2e2e42] transition-colors">
                      <span>{selectedCat?.emoji ?? '📌'}</span>
                      <span>{selectedCategory || '카테고리'}</span>
                      <span className="text-gray-500">▾</span>
                    </button>
                    <button onClick={() => { setIsManual(false); setShowCategoryPicker(false) }}
                      className="px-2 py-1.5 rounded-lg text-gray-600 hover:text-gray-400 text-xs transition-colors">✕</button>
                  </div>
                )}
              </div>

              <button onClick={handleSend} disabled={loading || (!content.trim() && existingUrls.length === 0 && imagePreviews.length === 0)}
                className="w-8 h-8 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center flex-shrink-0">
                {loading
                  ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <span className="text-white text-sm">↑</span>
                }
              </button>
            </div>

            {/* 카테고리 피커 */}
            {showCategoryPicker && (
              <div className="border-t border-[#2e2e42] px-3 pb-3 pt-2 flex flex-wrap gap-2">
                {categories.map(cat => (
                  <button key={cat.id}
                    onClick={() => { setSelectedCategory(cat.name); setShowCategoryPicker(false) }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                      selectedCategory === cat.name
                        ? 'text-white border-transparent'
                        : 'text-gray-400 border-[#2e2e42] hover:text-gray-200 hover:border-[#4a4a60]'
                    }`}
                    style={selectedCategory === cat.name ? { backgroundColor: cat.color ?? '#7c3aed' } : undefined}>
                    {cat.emoji} {cat.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="text-center text-[11px] text-gray-700">
            {isManual ? '선택한 카테고리로 저장됩니다' : 'AI가 다시 분류합니다 · Ctrl+Enter로 저장'}
          </p>
        </div>
      </main>
    </div>
  )
}
