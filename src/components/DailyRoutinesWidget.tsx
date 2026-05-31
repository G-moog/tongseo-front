import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Routine } from '../types'

function getToday() {
  return new Date().toLocaleDateString('en-CA') // "YYYY-MM-DD"
}

export default function DailyRoutinesWidget() {
  const { user } = useAuth()
  const [routines, setRoutines] = useState<Routine[]>([])
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())

  const todayDay = new Date().getDay() // 0=일 ~ 6=토
  const today = getToday()

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  const loadData = async () => {
    if (!user) return
    const [routinesRes, checksRes] = await Promise.all([
      supabase.from('routines').select('*').eq('user_id', user.id).order('sort_order'),
      supabase.from('routine_checks').select('routine_id')
        .eq('user_id', user.id).eq('checked_date', today),
    ])
    setRoutines(routinesRes.data ?? [])
    setCheckedIds(new Set((checksRes.data ?? []).map((c: { routine_id: string }) => c.routine_id)))
  }

  const toggle = async (routineId: string) => {
    if (!user) return
    if (checkedIds.has(routineId)) {
      await supabase.from('routine_checks')
        .delete()
        .eq('routine_id', routineId)
        .eq('user_id', user.id)
        .eq('checked_date', today)
      setCheckedIds(prev => { const s = new Set(prev); s.delete(routineId); return s })
    } else {
      await supabase.from('routine_checks')
        .insert({ routine_id: routineId, user_id: user.id, checked_date: today })
      setCheckedIds(prev => new Set([...prev, routineId]))
    }
  }

  const todayRoutines = routines.filter(r => r.days.includes(todayDay))
  if (todayRoutines.length === 0) return null

  const doneCount = todayRoutines.filter(r => checkedIds.has(r.id)).length
  const allDone = doneCount === todayRoutines.length

  return (
    <div className="px-4 pt-2 pb-1 shrink-0">
      <div className="bg-[#1c1c27] border border-[#2e2e42] rounded-xl overflow-hidden">
        {/* 헤더 */}
        <div className="px-3 py-2 border-b border-[#2e2e42] flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 tracking-wider">Daily Routines</span>
          <span className={`text-[10px] font-medium ${allDone ? 'text-violet-400' : 'text-gray-600'}`}>
            {doneCount}/{todayRoutines.length} {allDone ? '✓' : ''}
          </span>
        </div>
        {/* 목록 */}
        <div className="max-h-40 overflow-y-auto">
          {todayRoutines.map((routine, i) => {
            const checked = checkedIds.has(routine.id)
            return (
              <button
                key={routine.id}
                onClick={() => toggle(routine.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#252535] active:bg-[#2a2a3d] transition-colors text-left ${
                  i < todayRoutines.length - 1 ? 'border-b border-[#2e2e42]' : ''
                }`}
              >
                {/* 체크박스 */}
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                  checked
                    ? 'bg-violet-600 border-violet-600'
                    : 'border-[#4a4a60] bg-transparent'
                }`}>
                  {checked && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                      <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                {/* 텍스트 */}
                <span className={`text-sm transition-all ${
                  checked ? 'line-through text-gray-600' : 'text-gray-200'
                }`}>
                  {routine.title}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
