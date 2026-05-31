import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Routine } from '../types'

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const PRESET_DAYS = {
  매일: [0, 1, 2, 3, 4, 5, 6],
  평일: [1, 2, 3, 4, 5],
  주말: [0, 6],
}

function DaysSelector({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const sorted = [...value].sort((a, b) => a - b)

  const setPreset = (preset: number[]) => onChange(preset)

  const toggle = (d: number) => {
    onChange(sorted.includes(d) ? sorted.filter(x => x !== d) : [...sorted, d].sort((a, b) => a - b))
  }

  const isPreset = (preset: number[]) =>
    JSON.stringify(sorted) === JSON.stringify([...preset].sort((a, b) => a - b))

  return (
    <div className="flex flex-col gap-2">
      {/* 빠른 선택 */}
      <div className="flex gap-1.5">
        {(Object.entries(PRESET_DAYS) as [string, number[]][]).map(([label, preset]) => (
          <button
            key={label}
            type="button"
            onClick={() => setPreset(preset)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              isPreset(preset)
                ? 'bg-violet-600 text-white'
                : 'bg-[#252535] text-gray-400 hover:text-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {/* 개별 요일 */}
      <div className="flex gap-1">
        {DAY_LABELS.map((day, i) => (
          <button
            key={i}
            type="button"
            onClick={() => toggle(i)}
            className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
              sorted.includes(i)
                ? 'bg-violet-600 text-white'
                : 'bg-[#252535] text-gray-500 hover:text-gray-300'
            }`}
          >
            {day}
          </button>
        ))}
      </div>
    </div>
  )
}

function SortableItem({
  routine, onEdit, onDelete,
}: {
  routine: Routine
  onEdit: (r: Routine) => void
  onDelete: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: routine.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const activeDays = DAY_LABELS.filter((_, i) => routine.days.includes(i)).join(' ')

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 bg-[#1c1c27] border border-[#2e2e42] rounded-xl px-3 py-3"
    >
      {/* 드래그 핸들 */}
      <button
        {...attributes}
        {...listeners}
        className="text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none shrink-0"
      >
        ⠿
      </button>
      {/* 내용 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200 font-medium">{routine.title}</p>
        <p className="text-[10px] text-gray-600 mt-0.5">{activeDays || '요일 없음'}</p>
      </div>
      {/* 버튼 */}
      <button
        onClick={() => onEdit(routine)}
        className="p-1.5 text-gray-600 hover:text-violet-400 transition-colors text-xs"
      >
        ✏️
      </button>
      <button
        onClick={() => onDelete(routine.id)}
        className="p-1.5 text-gray-600 hover:text-red-400 transition-colors text-xs"
      >
        🗑️
      </button>
    </div>
  )
}

export default function RoutinesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [routines, setRoutines] = useState<Routine[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Routine | null>(null)
  const [title, setTitle] = useState('')
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  useEffect(() => {
    if (!user) return
    fetchRoutines()
  }, [user])

  const fetchRoutines = async () => {
    if (!user) return
    const { data } = await supabase
      .from('routines').select('*').eq('user_id', user.id).order('sort_order')
    setRoutines(data ?? [])
  }

  const openAdd = () => {
    setEditTarget(null)
    setTitle('')
    setDays([1, 2, 3, 4, 5])
    setShowForm(true)
  }

  const openEdit = (r: Routine) => {
    setEditTarget(r)
    setTitle(r.title)
    setDays(r.days)
    setShowForm(true)
  }

  const closeForm = () => { setShowForm(false); setEditTarget(null) }

  const save = async () => {
    if (!user || !title.trim() || days.length === 0) return
    setSaving(true)
    if (editTarget) {
      const { data } = await supabase.from('routines')
        .update({ title: title.trim(), days })
        .eq('id', editTarget.id)
        .select().single()
      if (data) setRoutines(prev => prev.map(r => r.id === data.id ? data : r))
    } else {
      const maxOrder = routines.length > 0 ? Math.max(...routines.map(r => r.sort_order)) + 1 : 0
      const { data } = await supabase.from('routines')
        .insert({ user_id: user.id, title: title.trim(), days, sort_order: maxOrder })
        .select().single()
      if (data) setRoutines(prev => [...prev, data])
    }
    setSaving(false)
    closeForm()
  }

  const remove = async (id: string) => {
    if (!confirm('루틴을 삭제할까요?')) return
    await supabase.from('routines').delete().eq('id', id)
    setRoutines(prev => prev.filter(r => r.id !== id))
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = routines.findIndex(r => r.id === active.id)
    const newIndex = routines.findIndex(r => r.id === over.id)
    const newOrder = arrayMove(routines, oldIndex, newIndex)

    setRoutines(newOrder)

    // DB 순서 업데이트
    await Promise.all(
      newOrder.map((r, i) =>
        supabase.from('routines').update({ sort_order: i }).eq('id', r.id)
      )
    )
  }

  return (
    <div className="flex flex-col min-h-svh bg-[#111118]">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-[#2e2e42] sticky top-0 bg-[#111118] z-10">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-300 transition-colors">←</button>
        <h1 className="flex-1 font-semibold text-gray-100">Daily Routines</h1>
        <button
          onClick={openAdd}
          className="text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors"
        >
          + 추가
        </button>
      </header>

      <main className="flex-1 px-4 pt-4 pb-8 flex flex-col gap-2">

        {/* 추가/수정 폼 */}
        {showForm && (
          <div className="bg-[#1c1c27] border border-violet-500/30 rounded-xl px-4 py-4 flex flex-col gap-3 mb-2">
            <p className="text-sm font-semibold text-gray-200">
              {editTarget ? '루틴 수정' : '새 루틴 추가'}
            </p>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="루틴 이름 입력"
              autoFocus
              className="w-full px-3 py-2 bg-[#111118] border border-[#2e2e42] rounded-lg text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-gray-500">반복 요일</span>
              <DaysSelector value={days} onChange={setDays} />
            </div>
            {days.length === 0 && (
              <p className="text-xs text-red-400">요일을 하나 이상 선택해주세요</p>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={closeForm} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300">
                취소
              </button>
              <button
                onClick={save}
                disabled={saving || !title.trim() || days.length === 0}
                className="px-4 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-lg hover:bg-violet-700 disabled:opacity-40 transition-colors"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        )}

        {/* 루틴 목록 (드래그 정렬) */}
        {routines.length === 0 && !showForm ? (
          <div className="flex flex-col items-center justify-center pt-24 gap-3">
            <p className="text-gray-600 text-sm">아직 루틴이 없습니다</p>
            <button
              onClick={openAdd}
              className="text-violet-400 text-sm hover:text-violet-300 transition-colors"
            >
              + 첫 루틴 추가하기
            </button>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={routines.map(r => r.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2">
                {routines.map(r => (
                  <SortableItem key={r.id} routine={r} onEdit={openEdit} onDelete={remove} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </main>
    </div>
  )
}
