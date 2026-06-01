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
import type { Note, Category } from '../types'

function SortableItem({
  note, categories, onRestore, onDelete, onEdit,
}: {
  note: Note
  categories: Category[]
  onRestore: (note: Note) => void
  onDelete: (id: string) => void
  onEdit: (note: Note) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: note.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const cat = categories.find(c => c.name === (note.is_manual ? note.manual_category : note.category))

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-[#1c1c27] border border-[#2e2e42] rounded-xl px-3 py-2.5 flex flex-col gap-1.5"
    >
      <div className="flex items-center gap-2">
        {/* 드래그 핸들 */}
        <button
          {...attributes}
          {...listeners}
          className="text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none shrink-0 text-base"
        >
          ⠿
        </button>

        {/* 내용 */}
        <div className="flex-1 min-w-0">
          {cat && (
            <span
              className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white mb-1"
              style={{ backgroundColor: cat.color ?? '#7c3aed' }}
            >
              {cat.emoji} {cat.name}
            </span>
          )}
          <p className="text-sm text-gray-200 leading-snug line-clamp-2">{note.content || '(내용 없음)'}</p>
        </div>

        {/* 버튼들 */}
        <div className="flex flex-col gap-1 shrink-0">
          <button
            onClick={() => onEdit(note)}
            className="p-1 text-gray-600 hover:text-violet-400 transition-colors text-xs"
          >
            ✏️
          </button>
          <button
            onClick={() => onDelete(note.id)}
            className="p-1 text-gray-600 hover:text-red-400 transition-colors text-xs"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* 복구 버튼 */}
      <button
        onClick={() => onRestore(note)}
        className="flex items-center gap-1.5 self-start px-2.5 py-1 rounded-lg border border-[#2e2e42] text-[11px] text-gray-500 hover:text-gray-300 hover:border-[#4a4a60] transition-colors"
      >
        <span>↩</span>
        <span>
          {cat ? `${cat.emoji} ${cat.name}으로 복구` : '일반 메모로 복구'}
        </span>
      </button>
    </div>
  )
}

export default function EmergencyTasksPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [notes, setNotes] = useState<Note[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [showForm, setShowForm] = useState(false)
  const [newContent, setNewContent] = useState('')
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  useEffect(() => {
    if (!user) return
    fetchData()
  }, [user])

  const fetchData = async () => {
    if (!user) return
    const [notesRes, catsRes] = await Promise.all([
      supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_emergency', true)
        .eq('is_deleted', false)
        .order('emergency_order', { ascending: true }),
      supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at'),
    ])
    setNotes(notesRes.data ?? [])
    setCategories(catsRes.data ?? [])
  }

  const handleRestore = async (note: Note) => {
    await supabase.from('notes').update({ is_emergency: false }).eq('id', note.id)
    setNotes(prev => prev.filter(n => n.id !== note.id))
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 메모를 삭제할까요?')) return
    await supabase.from('notes')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('id', id)
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  const handleEdit = (note: Note) => {
    navigate('/edit', { state: { note } })
  }

  const handleAdd = async () => {
    if (!user || !newContent.trim()) return
    setSaving(true)
    const maxOrder = notes.length > 0
      ? Math.max(...notes.map(n => n.emergency_order ?? 0)) + 1
      : 0
    const { data } = await supabase
      .from('notes')
      .insert({
        user_id: user.id,
        content: newContent.trim(),
        is_emergency: true,
        emergency_order: maxOrder,
        is_manual: true,
        category: '미분류',
        manual_category: '미분류',
      })
      .select()
      .single()
    if (data) setNotes(prev => [...prev, data])
    setNewContent('')
    setShowForm(false)
    setSaving(false)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = notes.findIndex(n => n.id === active.id)
    const newIndex = notes.findIndex(n => n.id === over.id)
    const newOrder = arrayMove(notes, oldIndex, newIndex)
    setNotes(newOrder)

    await Promise.all(
      newOrder.map((n, i) =>
        supabase.from('notes').update({ emergency_order: i }).eq('id', n.id)
      )
    )
  }

  return (
    <div className="flex flex-col min-h-svh bg-[#111118]">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-[#2e2e42] sticky top-0 bg-[#111118] z-10">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-300 transition-colors">←</button>
        <h1 className="flex-1 font-semibold text-red-400">Emergency Tasks</h1>
        <button
          onClick={() => { setShowForm(true); setNewContent('') }}
          className="text-sm font-medium text-red-400 hover:text-red-300 transition-colors"
        >
          + 추가
        </button>
      </header>

      <main className="flex-1 px-4 pt-4 pb-8 flex flex-col gap-2">

        {/* 추가 폼 */}
        {showForm && (
          <div className="bg-[#1c1c27] border border-red-500/30 rounded-xl px-4 py-4 flex flex-col gap-3 mb-2">
            <p className="text-sm font-semibold text-red-400">긴급 메모 추가</p>
            <textarea
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder="긴급 메모 내용 입력..."
              rows={3}
              autoFocus
              className="w-full px-3 py-2 bg-[#111118] border border-[#2e2e42] rounded-lg text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowForm(false)}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300"
              >
                취소
              </button>
              <button
                onClick={handleAdd}
                disabled={saving || !newContent.trim()}
                className="px-4 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-40 transition-colors"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        )}

        {/* 긴급 메모 목록 */}
        {notes.length === 0 && !showForm ? (
          <div className="flex flex-col items-center justify-center pt-24 gap-3">
            <p className="text-gray-600 text-sm">긴급 메모가 없습니다</p>
            <button
              onClick={() => setShowForm(true)}
              className="text-red-400 text-sm hover:text-red-300 transition-colors"
            >
              + 첫 긴급 메모 추가하기
            </button>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={notes.map(n => n.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2">
                {notes.map(note => (
                  <SortableItem
                    key={note.id}
                    note={note}
                    categories={categories}
                    onRestore={handleRestore}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </main>
    </div>
  )
}
