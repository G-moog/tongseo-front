import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface AllowedUser {
  id: string
  email: string
  role: string
  memo: string | null
  created_at: string
}

interface AppUser {
  id: string
  email: string
  role: string | null
  created_at: string
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
      role === 'admin'
        ? 'bg-violet-600/30 text-violet-300 border border-violet-500/30'
        : 'bg-[#2e2e42] text-gray-500 border border-[#3a3a50]'
    }`}>
      {role}
    </span>
  )
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export default function AdminPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  // 허용 이메일 목록
  const [allowedUsers, setAllowedUsers] = useState<AllowedUser[]>([])
  const [appUsers, setAppUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)

  // 추가 폼
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState('user')
  const [newMemo, setNewMemo] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const [allowedRes, usersRes] = await Promise.all([
      supabase.from('allowed_users').select('*').order('created_at'),
      supabase.from('users').select('id, email, role, created_at').order('created_at'),
    ])
    setAllowedUsers(allowedRes.data ?? [])
    setAppUsers(usersRes.data ?? [])
    setLoading(false)
  }

  const handleAdd = async () => {
    const email = newEmail.trim().toLowerCase()
    if (!email) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAddError('올바른 이메일 형식이 아닙니다.')
      return
    }
    setAdding(true)
    setAddError('')
    const { error } = await supabase.from('allowed_users').insert({
      email,
      role: newRole,
      memo: newMemo.trim() || null,
    })
    if (error) {
      setAddError(error.message.includes('unique') ? '이미 등록된 이메일입니다.' : '추가 실패. 다시 시도해주세요.')
    } else {
      setNewEmail('')
      setNewRole('user')
      setNewMemo('')
      await fetchData()
    }
    setAdding(false)
  }

  const handleDelete = async (user: AllowedUser) => {
    if (user.email === profile?.email) {
      alert('본인 이메일은 삭제할 수 없습니다.')
      return
    }
    if (!confirm(`${user.email}을 허용 목록에서 제거할까요?`)) return
    await supabase.from('allowed_users').delete().eq('id', user.id)
    setAllowedUsers(prev => prev.filter(u => u.id !== user.id))
  }

  return (
    <div className="flex flex-col min-h-svh bg-[#111118]">
      {/* 헤더 */}
      <header className="flex items-center gap-3 px-4 py-4 border-b border-[#2e2e42] sticky top-0 bg-[#111118] z-10">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-300 transition-colors">←</button>
        <h1 className="flex-1 font-semibold text-white">관리자 페이지</h1>
        <span className="text-xs text-violet-400 font-medium">🔧 admin</span>
      </header>

      <main className="flex-1 px-4 py-5 flex flex-col gap-6 pb-12">

        {/* ── 허용 이메일 관리 */}
        <section className="flex flex-col gap-3">
          <h2 className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider px-1">허용 이메일 관리</h2>

          {/* 추가 폼 */}
          <div className="bg-[#1c1c27] border border-[#2e2e42] rounded-2xl px-4 py-4 flex flex-col gap-3">
            <p className="text-sm font-medium text-gray-200">이메일 추가</p>
            <div className="flex flex-col gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="이메일"
                className="w-full px-3 py-2 bg-[#111118] border border-[#2e2e42] rounded-lg text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <div className="flex gap-2">
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-[11px] text-gray-500">역할</label>
                  <select
                    value={newRole}
                    onChange={e => setNewRole(e.target.value)}
                    className="w-full px-3 py-2 bg-[#111118] border border-[#2e2e42] rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-[11px] text-gray-500">메모 (선택)</label>
                  <input
                    type="text"
                    value={newMemo}
                    onChange={e => setNewMemo(e.target.value)}
                    placeholder="예: 알파테스터 1"
                    className="w-full px-3 py-2 bg-[#111118] border border-[#2e2e42] rounded-lg text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
              </div>
            </div>
            {addError && <p className="text-xs text-red-400">{addError}</p>}
            <button
              onClick={handleAdd}
              disabled={adding || !newEmail.trim()}
              className="w-full py-2.5 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 disabled:opacity-40 transition-colors"
            >
              {adding ? '추가 중...' : '추가하기'}
            </button>
          </div>

          {/* 허용 이메일 목록 */}
          <div className="bg-[#1c1c27] border border-[#2e2e42] rounded-2xl overflow-hidden">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : allowedUsers.length === 0 ? (
              <p className="text-center text-gray-600 text-sm py-8">허용된 이메일이 없습니다</p>
            ) : allowedUsers.map((u, i) => (
              <div
                key={u.id}
                className={`flex items-center gap-3 px-4 py-3 ${i < allowedUsers.length - 1 ? 'border-b border-[#2e2e42]' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{u.email}</p>
                  {u.memo && <p className="text-xs text-gray-600 mt-0.5">{u.memo}</p>}
                </div>
                <RoleBadge role={u.role} />
                <button
                  onClick={() => handleDelete(u)}
                  disabled={u.email === profile?.email}
                  className="text-xs text-gray-600 hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed ml-1"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* ── 가입 현황 */}
        <section className="flex flex-col gap-3">
          <h2 className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider px-1">
            가입 현황 — 전체 {appUsers.length}명
          </h2>
          <div className="bg-[#1c1c27] border border-[#2e2e42] rounded-2xl overflow-hidden">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : appUsers.length === 0 ? (
              <p className="text-center text-gray-600 text-sm py-8">가입자가 없습니다</p>
            ) : appUsers.map((u, i) => (
              <div
                key={u.id}
                className={`flex items-center gap-3 px-4 py-3 ${i < appUsers.length - 1 ? 'border-b border-[#2e2e42]' : ''}`}
              >
                <p className="flex-1 text-sm text-gray-200 truncate">{u.email}</p>
                <RoleBadge role={u.role ?? 'user'} />
                <span className="text-xs text-gray-600 shrink-0">{formatDate(u.created_at)}</span>
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  )
}
