import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface Props {
  open: boolean
  onClose: () => void
}

export default function SideDrawer({ open, onClose }: Props) {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  // ESC키로 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const go = (path: string) => { navigate(path); onClose() }

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* 드로어 패널 */}
      <div
        className={`fixed top-0 left-0 h-full w-72 z-50 bg-[#1c1c27] border-r border-[#2e2e42] flex flex-col transition-transform duration-300 ease-out ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* 헤더 */}
        <div className="px-5 pt-12 pb-6 border-b border-[#2e2e42]">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📝</span>
            <div>
              <p className="font-bold text-white text-lg">통서(通書)</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          <button
            onClick={() => go('/')}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-300 hover:bg-violet-600/30 transition-colors text-sm font-medium"
          >
            <span className="text-base">✏️</span>
            작성하기
          </button>

          <div className="my-2 border-t border-[#2e2e42]" />

          <p className="text-[11px] text-gray-600 font-semibold uppercase tracking-wider px-3 mb-1 mt-1">메모</p>

          <button
            onClick={() => go('/notes')}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-300 hover:bg-[#252535] hover:text-white transition-colors text-sm"
          >
            <span className="text-base">📋</span>
            전체 보기
          </button>

          <button
            onClick={() => go('/notes?view=folder')}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-300 hover:bg-[#252535] hover:text-white transition-colors text-sm"
          >
            <span className="text-base">🗂️</span>
            폴더 보기
          </button>

          <div className="my-2 border-t border-[#2e2e42]" />

          <button
            onClick={() => go('/mypage')}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-300 hover:bg-[#252535] hover:text-white transition-colors text-sm"
          >
            <span className="text-base">👤</span>
            마이페이지
          </button>

          <button
            onClick={() => go('/settings')}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-300 hover:bg-[#252535] hover:text-white transition-colors text-sm"
          >
            <span className="text-base">⚙️</span>
            설정
          </button>
        </nav>

        {/* 로그아웃 */}
        <div className="px-3 pb-8 border-t border-[#2e2e42] pt-3">
          <button
            onClick={async () => { await signOut(); onClose() }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-500 hover:bg-[#252535] hover:text-red-400 transition-colors text-sm w-full"
          >
            <span className="text-base">🚪</span>
            로그아웃
          </button>
        </div>
      </div>
    </>
  )
}
