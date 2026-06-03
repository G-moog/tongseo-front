import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Note } from '../types'

interface Props {
  onUpdate?: () => void
}

export default function EmergencyTasksWidget({ onUpdate }: Props) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [notes, setNotes] = useState<Note[]>([])

  useEffect(() => {
    if (!user) return
    fetchEmergency()
  }, [user])

  const fetchEmergency = async () => {
    if (!user) return
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_emergency', true)
      .eq('is_deleted', false)
      .order('emergency_order', { ascending: true })
    setNotes(data ?? [])
  }

  const unmark = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await supabase.from('notes').update({ is_emergency: false }).eq('id', id)
    setNotes(prev => prev.filter(n => n.id !== id))
    onUpdate?.()
  }

  if (notes.length === 0) return null

  return (
    <div className="px-4 pt-1 pb-1">
      <div className="bg-[#1a0000] border-2 border-red-500/60 rounded-xl overflow-hidden">
        {/* 헤더 */}
        <div className="px-3 py-2 border-b border-red-500/30 flex items-center justify-between">
          <span className="text-sm font-bold text-red-400 tracking-wide">Emergency Tasks</span>
          <span className="text-xs font-semibold text-red-500 tabular-nums">
            {notes.length}
          </span>
        </div>
        {/* 목록 */}
        <div>
          {notes.map((note, i) => (
            <button
              key={note.id}
              onClick={() => navigate('/edit', { state: { note } })}
              className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-red-500/5 active:bg-red-500/10 transition-colors text-left ${
                i < notes.length - 1 ? 'border-b border-red-500/20' : ''
              }`}
            >
              {/* 긴급 아이콘 */}
              <span className="text-red-500 text-xs shrink-0">🚨</span>
              {/* 내용 */}
              <p className="flex-1 text-sm text-gray-200 truncate">{note.content}</p>
              {/* 해제 버튼 */}
              <span
                onClick={(e) => unmark(note.id, e)}
                className="shrink-0 text-gray-600 hover:text-red-400 transition-colors text-xs px-1"
              >
                ✕
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
