import { useState, useEffect } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import SideDrawer from '../components/SideDrawer'
import type { Note, Category } from '../types'

interface Stats {
  totalNotes: number
  thisMonthNotes: number
  streak: number
  categoryData: { name: string; emoji: string; color: string; count: number; ratio: number }[]
  weeklyData: { label: string; count: number }[]
  timeData: { name: string; count: number; color: string }[]
  aiCount: number
  manualCount: number
}

function calcStreak(notes: Note[]): number {
  if (!notes.length) return 0
  const days = new Set(notes.map(n => n.created_at.slice(0, 10)))
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    if (days.has(d.toISOString().slice(0, 10))) streak++
    else break
  }
  return streak
}

function calcStats(notes: Note[], categories: Category[]): Stats {
  const now = new Date()
  const thisMonth = notes.filter(n => {
    const d = new Date(n.created_at)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })

  // 카테고리 집계
  const catCount: Record<string, number> = {}
  notes.forEach(n => {
    const key = (n.is_manual ? n.manual_category : n.category) ?? '기타'
    catCount[key] = (catCount[key] ?? 0) + 1
  })
  const total = notes.length || 1
  const categoryData = categories.map(c => ({
    name: c.name,
    emoji: c.emoji ?? '📌',
    color: c.color ?? '#9B72CF',
    count: catCount[c.name] ?? 0,
    ratio: Math.round(((catCount[c.name] ?? 0) / total) * 100),
  })).filter(c => c.count > 0).sort((a, b) => b.count - a.count)

  // 주간 데이터 (최근 4주)
  const weeklyData = Array.from({ length: 4 }, (_, i) => {
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - (3 - i) * 7 - now.getDay())
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 7)
    const count = notes.filter(n => {
      const d = new Date(n.created_at)
      return d >= weekStart && d < weekEnd
    }).length
    return { label: i === 3 ? '이번 주' : `${3 - i}주 전`, count }
  })

  // 시간대 집계
  const timeCount = { morning: 0, afternoon: 0, evening: 0, night: 0 }
  notes.forEach(n => {
    const h = new Date(n.created_at).getHours()
    if (h >= 6 && h < 12) timeCount.morning++
    else if (h >= 12 && h < 18) timeCount.afternoon++
    else if (h >= 18 && h < 22) timeCount.evening++
    else timeCount.night++
  })
  const timeData = [
    { name: '🌅 아침', count: timeCount.morning, color: '#FFB020' },
    { name: '☀️ 낮', count: timeCount.afternoon, color: '#4F8EF7' },
    { name: '🌆 저녁', count: timeCount.evening, color: '#F7705A' },
    { name: '🌙 밤', count: timeCount.night, color: '#9B72CF' },
  ]

  const aiCount = notes.filter(n => !n.is_manual).length
  const manualCount = notes.filter(n => n.is_manual).length

  return {
    totalNotes: notes.length,
    thisMonthNotes: thisMonth.length,
    streak: calcStreak(notes),
    categoryData,
    weeklyData,
    timeData,
    aiCount,
    manualCount,
  }
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1c1c27] border border-[#2e2e42] rounded-lg px-3 py-1.5 text-xs text-gray-200">
      {payload[0].payload.label ?? payload[0].name}: {payload[0].value}개
    </div>
  )
}

export default function MyPage() {
  const { user } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('notes').select('*').eq('user_id', user.id).eq('is_deleted', false),
      supabase.from('categories').select('*').eq('user_id', user.id).order('created_at'),
    ]).then(([notesRes, catsRes]) => {
      setStats(calcStats(notesRes.data ?? [], catsRes.data ?? []))
      setLoading(false)
    })
  }, [user])

  const HamburgerBtn = () => (
    <button
      onClick={() => setDrawerOpen(true)}
      className="w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-lg hover:bg-[#1c1c27] transition-colors"
    >
      <span className="w-5 h-0.5 bg-gray-400 rounded-full" />
      <span className="w-5 h-0.5 bg-gray-400 rounded-full" />
      <span className="w-5 h-0.5 bg-gray-400 rounded-full" />
    </button>
  )

  return (
    <div className="flex flex-col min-h-svh bg-[#111118]">
      <SideDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <header className="flex items-center justify-between px-4 py-4 border-b border-[#2e2e42]">
        <HamburgerBtn />
        <h1 className="text-base font-semibold text-white">마이페이지</h1>
        <div className="w-9" />
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : stats ? (
        <main className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-5">

          {/* ── 활동 요약 */}
          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">활동 요약</h2>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '전체 메모', value: stats.totalNotes, unit: '개' },
                { label: '이번 달', value: stats.thisMonthNotes, unit: '개' },
                { label: '연속 작성', value: stats.streak, unit: '일' },
              ].map(item => (
                <div key={item.label} className="bg-[#1c1c27] border border-[#2e2e42] rounded-2xl p-3 flex flex-col items-center gap-1">
                  <span className="text-2xl font-bold text-white">{item.value}</span>
                  <span className="text-[10px] text-gray-500">{item.unit}</span>
                  <span className="text-[10px] text-gray-600">{item.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ── 카테고리 분석 */}
          {stats.categoryData.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">카테고리 분석</h2>
              <div className="bg-[#1c1c27] border border-[#2e2e42] rounded-2xl p-4 flex flex-col gap-4">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={stats.categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="count"
                    >
                      {stats.categoryData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>

                <div className="flex flex-col gap-2">
                  {stats.categoryData.map((cat, i) => (
                    <div key={cat.name} className="flex items-center gap-2">
                      {i === 0 && <span className="text-[10px] text-amber-400 font-semibold w-3">★</span>}
                      {i !== 0 && <span className="w-3" />}
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="text-sm text-gray-300 flex-1">{cat.emoji} {cat.name}</span>
                      <span className="text-sm text-gray-400">{cat.count}개</span>
                      <span className="text-xs text-gray-600 w-8 text-right">{cat.ratio}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ── 주간 작성 패턴 */}
          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">주간 작성 패턴</h2>
            <div className="bg-[#1c1c27] border border-[#2e2e42] rounded-2xl p-4">
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={stats.weeklyData} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2e2e42" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff08' }} />
                  <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* ── 시간대 패턴 */}
          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">시간대 패턴</h2>
            <div className="bg-[#1c1c27] border border-[#2e2e42] rounded-2xl p-4 flex flex-col gap-2.5">
              {stats.timeData.map(t => {
                const total = stats.timeData.reduce((s, x) => s + x.count, 0) || 1
                const pct = Math.round((t.count / total) * 100)
                return (
                  <div key={t.name} className="flex items-center gap-3">
                    <span className="text-sm w-16 text-gray-400">{t.name}</span>
                    <div className="flex-1 bg-[#252535] rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: t.color }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
                  </div>
                )
              })}
            </div>
          </section>

          {/* ── AI vs 수동 분류 */}
          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">AI vs 수동 분류</h2>
            <div className="bg-[#1c1c27] border border-[#2e2e42] rounded-2xl p-4 flex flex-col gap-3">
              {(() => {
                const total = (stats.aiCount + stats.manualCount) || 1
                const aiPct = Math.round((stats.aiCount / total) * 100)
                const manPct = 100 - aiPct
                return (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-400 w-16">✨ AI</span>
                      <div className="flex-1 bg-[#252535] rounded-full h-2 overflow-hidden">
                        <div className="h-full rounded-full bg-violet-500 transition-all duration-500" style={{ width: `${aiPct}%` }} />
                      </div>
                      <span className="text-xs text-gray-400">{stats.aiCount}개 ({aiPct}%)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-400 w-16">📌 수동</span>
                      <div className="flex-1 bg-[#252535] rounded-full h-2 overflow-hidden">
                        <div className="h-full rounded-full bg-gray-500 transition-all duration-500" style={{ width: `${manPct}%` }} />
                      </div>
                      <span className="text-xs text-gray-400">{stats.manualCount}개 ({manPct}%)</span>
                    </div>
                  </>
                )
              })()}
            </div>
          </section>

        </main>
      ) : null}
    </div>
  )
}
