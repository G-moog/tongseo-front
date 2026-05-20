import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import SideDrawer from '../components/SideDrawer'
import type { Note, Category } from '../types'

type ViewMode = 'folder' | 'all'

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (target.getTime() === today.getTime()) return '오늘'
  if (target.getTime() === yesterday.getTime()) return '어제'
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function NoteCard({
  note,
  categories,
  onEdit,
  onDelete,
}: {
  note: Note
  categories: Category[]
  onEdit: (note: Note) => void
  onDelete: (id: string) => void
}) {
  const cat = categories.find(c => c.name === (note.is_manual ? note.manual_category : note.category))

  return (
    <div className="bg-[#1c1c27] rounded-xl border border-[#2e2e42] px-3 py-2 flex flex-col gap-1">
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
          <span className="text-[10px] text-gray-600">{formatTime(note.created_at)}</span>
        </div>
        <div className="flex items-center gap-0.5">
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
      <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">{note.content}</p>
    </div>
  )
}

export default function NotesPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>(
    searchParams.get('view') === 'folder' ? 'folder' : 'all'
  )
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    if (!user) return
    const [notesRes, catsRes] = await Promise.all([
      supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false }),
      supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at'),
    ])
    setNotes(notesRes.data ?? [])
    setCategories(catsRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [user])

  const handleDelete = async (id: string) => {
    if (!confirm('이 메모를 삭제할까요?')) return
    await supabase
      .from('notes')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('id', id)
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  const handleEdit = (note: Note) => {
    navigate('/edit', { state: { note } })
  }

  const filteredNotes = useMemo(() => {
    if (!search.trim()) return notes
    const q = search.toLowerCase()
    return notes.filter(n =>
      n.content.toLowerCase().includes(q) ||
      n.title?.toLowerCase().includes(q) ||
      n.summary?.toLowerCase().includes(q)
    )
  }, [notes, search])

  const notesInFolder = useMemo(() => {
    if (!selectedFolder) return filteredNotes
    return filteredNotes.filter(n =>
      (n.is_manual ? n.manual_category : n.category) === selectedFolder
    )
  }, [filteredNotes, selectedFolder])

  const groupedByDate = useMemo(() => {
    const groups: Record<string, Note[]> = {}
    filteredNotes.forEach(n => {
      const key = formatDate(n.created_at)
      if (!groups[key]) groups[key] = []
      groups[key].push(n)
    })
    return groups
  }, [filteredNotes])

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    notes.forEach(n => {
      const key = (n.is_manual ? n.manual_category : n.category) ?? '기타'
      counts[key] = (counts[key] ?? 0) + 1
    })
    return counts
  }, [notes])

  return (
    <div className="flex flex-col min-h-svh bg-[#111118]">
      <SideDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <header className="bg-[#111118] sticky top-0 z-10 border-b border-[#2e2e42]">
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-lg hover:bg-[#1c1c27] transition-colors"
            >
              <span className="w-5 h-0.5 bg-gray-400 rounded-full" />
              <span className="w-5 h-0.5 bg-gray-400 rounded-full" />
              <span className="w-5 h-0.5 bg-gray-400 rounded-full" />
            </button>
            <h1 className="text-base font-semibold text-white">메모 목록</h1>
            <div className="w-9" />
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600">🔍</span>
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="메모 검색..."
              className="w-full pl-9 pr-4 py-2.5 bg-[#1c1c27] border border-[#2e2e42] rounded-xl text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors"
            />
          </div>
        </div>
        <div className="flex px-4 gap-1 pb-2">
          {(['folder', 'all'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => { setViewMode(mode); setSelectedFolder(null) }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                viewMode === mode
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-[#1c1c27]'
              }`}
            >
              {mode === 'folder' ? '🗂️ 폴더' : '📋 전체'}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 px-4 pt-4 pb-8">
        {loading ? (
          <div className="flex justify-center pt-16">
            <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : viewMode === 'folder' && !selectedFolder ? (
          <div className="flex flex-col gap-2">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedFolder(cat.name)}
                className="bg-[#1c1c27] rounded-2xl border border-[#2e2e42] px-4 py-4 flex items-center justify-between hover:border-violet-500/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                    style={{ backgroundColor: cat.color ? cat.color + '22' : '#7c3aed22' }}
                  >
                    {cat.emoji}
                  </span>
                  <span className="font-medium text-gray-100">{cat.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">{folderCounts[cat.name] ?? 0}개</span>
                  <span className="text-gray-700">›</span>
                </div>
              </button>
            ))}
            {categories.length === 0 && (
              <p className="text-center text-gray-600 pt-16 text-sm">카테고리가 없습니다</p>
            )}
          </div>
        ) : viewMode === 'folder' && selectedFolder ? (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setSelectedFolder(null)}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-1"
            >
              ← 폴더 목록
            </button>
            {notesInFolder.length === 0 ? (
              <p className="text-center text-gray-600 pt-16 text-sm">메모가 없습니다</p>
            ) : notesInFolder.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                categories={categories}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {Object.keys(groupedByDate).length === 0 ? (
              <p className="text-center text-gray-600 pt-16 text-sm">메모가 없습니다</p>
            ) : Object.entries(groupedByDate).map(([date, dayNotes]) => (
              <div key={date} className="flex flex-col gap-3">
                <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{date}</h2>
                {dayNotes.map(note => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    categories={categories}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </main>

    </div>
  )
}
