import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import SideDrawer from '../components/SideDrawer'
import type { Category } from '../types'

const PRESET_COLORS = [
  '#4F8EF7', '#2DCE89', '#FFB020', '#F7705A', '#9B72CF',
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
]

const PRESET_EMOJIS = ['📚', '✅', '💡', '📅', '📌', '🎯', '💼', '🏠', '❤️', '⭐', '🔖', '🗒️']

// ── 공통 섹션 래퍼
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider px-1">{title}</h2>
      <div className="bg-[#1c1c27] border border-[#2e2e42] rounded-2xl overflow-hidden">
        {children}
      </div>
    </section>
  )
}

function Row({
  label, sublabel, right, onClick, danger = false, border = true,
}: {
  label: string
  sublabel?: string
  right?: React.ReactNode
  onClick?: () => void
  danger?: boolean
  border?: boolean
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-between px-4 py-3.5 ${border ? 'border-b border-[#2e2e42]' : ''} ${onClick ? 'cursor-pointer hover:bg-[#252535] transition-colors active:bg-[#2a2a3d]' : ''}`}
    >
      <div className="flex flex-col gap-0.5">
        <span className={`text-sm font-medium ${danger ? 'text-red-400' : 'text-gray-200'}`}>{label}</span>
        {sublabel && <span className="text-xs text-gray-600">{sublabel}</span>}
      </div>
      {right}
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-violet-600' : 'bg-[#2e2e42]'}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}

export default function SettingsPage() {
  const { user, profile, signOut, refreshProfile } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // ── 계정
  const [nickname, setNickname] = useState(profile?.nickname ?? '')
  const [editingNickname, setEditingNickname] = useState(false)
  const [nicknameSaving, setNicknameSaving] = useState(false)

  // ── AI 설정
  const [newApiKey, setNewApiKey] = useState('')
  const [apiKeySaving, setApiKeySaving] = useState(false)
  const [apiKeyMsg, setApiKeyMsg] = useState('')
  const [defaultCategory, setDefaultCategory] = useState(profile?.default_manual_category ?? '')

  // ── 알림
  const [notifEnabled, setNotifEnabled] = useState(profile?.notification_enabled ?? true)

  // ── 카테고리
  const [categories, setCategories] = useState<Category[]>([])
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [editingCat, setEditingCat] = useState<Category | null>(null)
  const [catName, setCatName] = useState('')
  const [catEmoji, setCatEmoji] = useState('📌')
  const [catColor, setCatColor] = useState('#9B72CF')
  const [catSaving, setCatSaving] = useState(false)

  // ── 휴지통
  const [trashDays, setTrashDays] = useState(profile?.trash_days ?? 7)
  const [trashCount, setTrashCount] = useState(0)
  const [trashSaving, setTrashSaving] = useState(false)

  // ── 계정 탈퇴
  const [deleteStep, setDeleteStep] = useState(0)

  useEffect(() => {
    if (!user) return
    supabase.from('categories').select('*').eq('user_id', user.id).order('created_at')
      .then(({ data }) => setCategories(data ?? []))
    supabase.from('notes').select('id', { count: 'exact' }).eq('user_id', user.id).eq('is_deleted', true)
      .then(({ count }) => setTrashCount(count ?? 0))
  }, [user])

  // ── 닉네임 저장
  const saveNickname = async () => {
    if (!user || !nickname.trim()) return
    setNicknameSaving(true)
    await supabase.from('users').update({ nickname: nickname.trim() }).eq('id', user.id)
    await refreshProfile()
    setEditingNickname(false)
    setNicknameSaving(false)
  }

  // ── API 키 변경
  const saveApiKey = async () => {
    const key = newApiKey.trim()
    if (!key.startsWith('sk-ant-')) { setApiKeyMsg('sk-ant- 로 시작해야 합니다'); return }
    setApiKeySaving(true)
    setApiKeyMsg('')
    const { error } = await supabase.functions.invoke('update-api-key', { body: { api_key: key } })
    if (error) { setApiKeyMsg('저장 실패. 다시 시도해주세요.'); }
    else { setApiKeyMsg('저장됐습니다 ✓'); setNewApiKey('') }
    setApiKeySaving(false)
  }

  // ── 기본 카테고리 변경
  const saveDefaultCategory = async (val: string) => {
    if (!user) return
    setDefaultCategory(val)
    await supabase.from('users').update({ default_manual_category: val || null }).eq('id', user.id)
    await refreshProfile()
  }

  // ── 알림 토글
  const saveNotif = async (val: boolean) => {
    if (!user) return
    setNotifEnabled(val)
    await supabase.from('users').update({ notification_enabled: val }).eq('id', user.id)
    await refreshProfile()
  }

  // ── 카테고리 저장 (추가 / 수정)
  const saveCat = async () => {
    if (!user || !catName.trim()) return
    setCatSaving(true)
    if (editingCat) {
      const { data } = await supabase.from('categories')
        .update({ name: catName.trim(), emoji: catEmoji, color: catColor })
        .eq('id', editingCat.id).select().single()
      if (data) setCategories(prev => prev.map(c => c.id === data.id ? data : c))
    } else {
      const { data } = await supabase.from('categories')
        .insert({ user_id: user.id, name: catName.trim(), emoji: catEmoji, color: catColor, is_default: false })
        .select().single()
      if (data) setCategories(prev => [...prev, data])
    }
    setCatName(''); setCatEmoji('📌'); setCatColor('#9B72CF')
    setShowAddCategory(false); setEditingCat(null)
    setCatSaving(false)
  }

  const startEditCat = (cat: Category) => {
    setEditingCat(cat); setCatName(cat.name)
    setCatEmoji(cat.emoji ?? '📌'); setCatColor(cat.color ?? '#9B72CF')
    setShowAddCategory(true)
  }

  const deleteCat = async (cat: Category) => {
    if (cat.is_default) return
    if (!confirm(`'${cat.name}' 카테고리를 삭제할까요?\n해당 카테고리의 메모는 분류 없음으로 변경됩니다.`)) return
    await supabase.from('categories').delete().eq('id', cat.id)
    setCategories(prev => prev.filter(c => c.id !== cat.id))
  }

  // ── trash_days 저장
  const saveTrashDays = async (val: number) => {
    if (!user) return
    setTrashDays(val)
    setTrashSaving(true)
    await supabase.from('users').update({ trash_days: val }).eq('id', user.id)
    setTrashSaving(false)
  }

  // ── 휴지통 비우기
  const emptyTrash = async () => {
    if (!user || !confirm('휴지통을 영구적으로 비울까요? 복구할 수 없습니다.')) return
    await supabase.from('notes').delete().eq('user_id', user.id).eq('is_deleted', true)
    setTrashCount(0)
  }

  // ── JSON 내보내기
  const exportNotes = async () => {
    if (!user) return
    const { data } = await supabase.from('notes').select('*').eq('user_id', user.id).eq('is_deleted', false)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `통서_메모_${new Date().toISOString().slice(0, 10)}.json`
    a.click(); URL.revokeObjectURL(url)
  }

  // ── 계정 탈퇴
  const deleteAccount = async () => {
    if (!user) return
    await supabase.from('notes').delete().eq('user_id', user.id)
    await supabase.from('categories').delete().eq('user_id', user.id)
    await supabase.from('users').delete().eq('id', user.id)
    await signOut()
  }

  const HamburgerBtn = () => (
    <button onClick={() => setDrawerOpen(true)}
      className="w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-lg hover:bg-[#1c1c27] transition-colors">
      <span className="w-5 h-0.5 bg-gray-400 rounded-full" />
      <span className="w-5 h-0.5 bg-gray-400 rounded-full" />
      <span className="w-5 h-0.5 bg-gray-400 rounded-full" />
    </button>
  )

  return (
    <div className="flex flex-col min-h-svh bg-[#111118]">
      <SideDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <header className="flex items-center justify-between px-4 py-4 border-b border-[#2e2e42] sticky top-0 bg-[#111118] z-10">
        <HamburgerBtn />
        <h1 className="text-base font-semibold text-white">설정</h1>
        <div className="w-9" />
      </header>

      <main className="flex-1 px-4 py-5 flex flex-col gap-5 pb-12">

        {/* ── 계정 */}
        <Section title="계정">
          <Row label="이메일" sublabel={profile?.email} border />
          <div className="px-4 py-3.5 border-b border-[#2e2e42]">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-gray-200">닉네임</span>
                {!editingNickname && <span className="text-xs text-gray-500">{profile?.nickname ?? '미설정'}</span>}
              </div>
              {!editingNickname
                ? <button onClick={() => setEditingNickname(true)} className="text-xs text-violet-400 hover:text-violet-300">수정</button>
                : <div className="flex gap-2">
                    <button onClick={() => setEditingNickname(false)} className="text-xs text-gray-500">취소</button>
                    <button onClick={saveNickname} disabled={nicknameSaving} className="text-xs text-violet-400 hover:text-violet-300 disabled:opacity-40">저장</button>
                  </div>
              }
            </div>
            {editingNickname && (
              <input value={nickname} onChange={e => setNickname(e.target.value)}
                className="mt-2 w-full px-3 py-2 bg-[#111118] border border-[#2e2e42] rounded-lg text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
                placeholder="닉네임 입력" autoFocus />
            )}
          </div>
          <Row label="로그아웃" danger onClick={signOut} border={false} />
        </Section>

        {/* ── AI 설정 */}
        <Section title="AI 설정">
          <div className="px-4 py-3.5 border-b border-[#2e2e42] flex flex-col gap-2">
            <span className="text-sm font-medium text-gray-200">Claude API 키 변경</span>
            <input type="password" value={newApiKey} onChange={e => setNewApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full px-3 py-2 bg-[#111118] border border-[#2e2e42] rounded-lg text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500" />
            {apiKeyMsg && <p className={`text-xs ${apiKeyMsg.includes('✓') ? 'text-green-400' : 'text-red-400'}`}>{apiKeyMsg}</p>}
            <button onClick={saveApiKey} disabled={apiKeySaving || !newApiKey.trim()}
              className="self-end px-4 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-lg hover:bg-violet-700 disabled:opacity-40 transition-colors">
              {apiKeySaving ? '저장 중...' : '변경하기'}
            </button>
          </div>
          <div className="px-4 py-3.5 border-b border-[#2e2e42] flex flex-col gap-2">
            <span className="text-sm font-medium text-gray-200">메모 작성 기본 분류</span>
            <select value={defaultCategory} onChange={e => saveDefaultCategory(e.target.value)}
              className="w-full px-3 py-2 bg-[#111118] border border-[#2e2e42] rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-500">
              <option value="">✨ 자동분류 (AI)</option>
              {categories.map(c => <option key={c.id} value={c.name}>{c.emoji} {c.name}</option>)}
            </select>
          </div>
        </Section>

        {/* ── 알림 */}
        <Section title="알림">
          <Row label="알림 허용" sublabel="remind_at이 설정된 메모에 푸시 알림 발송"
            right={<Toggle value={notifEnabled} onChange={saveNotif} />} border={false} />
        </Section>

        {/* ── 카테고리 관리 */}
        <Section title="카테고리 관리">
          {categories.map((cat, i) => (
            <div key={cat.id} className={`flex items-center gap-3 px-4 py-3 ${i < categories.length - 1 || showAddCategory ? 'border-b border-[#2e2e42]' : ''}`}>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                style={{ backgroundColor: cat.color ? cat.color + '22' : '#7c3aed22' }}>
                {cat.emoji}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200">{cat.name}</p>
                {cat.is_default && <p className="text-[10px] text-gray-600">기본 카테고리</p>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => startEditCat(cat)} className="text-xs text-gray-500 hover:text-violet-400 transition-colors">수정</button>
                {!cat.is_default && (
                  <button onClick={() => deleteCat(cat)} className="text-xs text-gray-600 hover:text-red-400 transition-colors">삭제</button>
                )}
              </div>
            </div>
          ))}

          {/* 카테고리 추가/수정 폼 */}
          {showAddCategory && (
            <div className="px-4 py-4 border-b border-[#2e2e42] flex flex-col gap-3">
              <p className="text-sm font-medium text-gray-300">{editingCat ? '카테고리 수정' : '카테고리 추가'}</p>
              <input value={catName} onChange={e => setCatName(e.target.value)}
                placeholder="카테고리 이름"
                className="w-full px-3 py-2 bg-[#111118] border border-[#2e2e42] rounded-lg text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500" />
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-gray-500">이모지</span>
                <div className="flex flex-wrap gap-2">
                  {PRESET_EMOJIS.map(e => (
                    <button key={e} onClick={() => setCatEmoji(e)}
                      className={`w-9 h-9 rounded-lg text-lg transition-colors ${catEmoji === e ? 'bg-violet-600/30 border border-violet-500' : 'bg-[#111118] border border-[#2e2e42] hover:border-[#4a4a60]'}`}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-gray-500">색상</span>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map(c => (
                    <button key={c} onClick={() => setCatColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform ${catColor === c ? 'scale-125 ring-2 ring-white/40' : ''}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setShowAddCategory(false); setEditingCat(null); setCatName('') }}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300">취소</button>
                <button onClick={saveCat} disabled={catSaving || !catName.trim()}
                  className="px-4 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-lg hover:bg-violet-700 disabled:opacity-40">
                  {catSaving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          )}

          {!showAddCategory && (
            <button onClick={() => { setShowAddCategory(true); setEditingCat(null); setCatName(''); setCatEmoji('📌'); setCatColor('#9B72CF') }}
              className="w-full px-4 py-3 text-sm text-violet-400 hover:text-violet-300 text-left transition-colors">
              + 카테고리 추가
            </button>
          )}
        </Section>

        {/* ── 휴지통 */}
        <Section title="휴지통">
          <div className="px-4 py-3.5 border-b border-[#2e2e42] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-200">보관 기간</span>
              <span className="text-sm font-semibold text-violet-400">{trashDays}일{trashSaving ? ' 저장 중...' : ''}</span>
            </div>
            <input type="range" min={1} max={15} value={trashDays}
              onChange={e => setTrashDays(Number(e.target.value))}
              onMouseUp={e => saveTrashDays(Number((e.target as HTMLInputElement).value))}
              onTouchEnd={e => saveTrashDays(Number((e.target as HTMLInputElement).value))}
              className="w-full accent-violet-500" />
            <div className="flex justify-between text-[10px] text-gray-600">
              <span>1일</span><span>8일</span><span>15일</span>
            </div>
          </div>
          <Row
            label="휴지통 비우기"
            sublabel={`현재 ${trashCount}개의 메모`}
            danger={trashCount > 0}
            onClick={trashCount > 0 ? emptyTrash : undefined}
            border={false}
            right={<span className="text-xs text-gray-600">영구 삭제 →</span>}
          />
        </Section>

        {/* ── 데이터 관리 */}
        <Section title="데이터 관리">
          <Row label="전체 메모 내보내기" sublabel="JSON 파일로 다운로드" onClick={exportNotes}
            right={<span className="text-xs text-gray-600">↓</span>} />
          <div className="px-4 py-3.5 flex flex-col gap-3 border-b-0">
            {deleteStep === 0 && (
              <button onClick={() => setDeleteStep(1)}
                className="text-sm font-medium text-red-500 hover:text-red-400 text-left transition-colors">
                계정 탈퇴
              </button>
            )}
            {deleteStep === 1 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-red-400">모든 메모와 데이터가 영구 삭제됩니다. 계속할까요?</p>
                <div className="flex gap-2">
                  <button onClick={() => setDeleteStep(0)} className="flex-1 py-2 border border-[#2e2e42] rounded-lg text-xs text-gray-400 hover:bg-[#252535]">취소</button>
                  <button onClick={() => setDeleteStep(2)} className="flex-1 py-2 bg-red-600/20 border border-red-500/30 rounded-lg text-xs text-red-400 hover:bg-red-600/30">계속</button>
                </div>
              </div>
            )}
            {deleteStep === 2 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-red-400 font-medium">정말로 탈퇴하시겠습니까? 복구 불가합니다.</p>
                <div className="flex gap-2">
                  <button onClick={() => setDeleteStep(0)} className="flex-1 py-2 border border-[#2e2e42] rounded-lg text-xs text-gray-400 hover:bg-[#252535]">취소</button>
                  <button onClick={deleteAccount} className="flex-1 py-2 bg-red-600 rounded-lg text-xs text-white font-medium hover:bg-red-700">탈퇴하기</button>
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* ── 앱 정보 */}
        <Section title="앱 정보">
          <Row label="버전" right={<span className="text-xs text-gray-600">0.1.0</span>} border={false} />
        </Section>

      </main>
    </div>
  )
}
