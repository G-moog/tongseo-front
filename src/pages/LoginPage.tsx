import { useAuth } from '../contexts/AuthContext'
import { useSearchParams } from 'react-router-dom'

export default function LoginPage() {
  const { signInWithGoogle } = useAuth()
  const [searchParams] = useSearchParams()
  const isNotAllowed = searchParams.get('error') === 'not_allowed'

  return (
    <div className="flex flex-col items-center justify-center min-h-svh px-6 bg-[#111118]">
      <div className="w-full max-w-[440px] flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3">
          <span className="text-5xl">📝</span>
          <h1 className="text-3xl font-bold text-white tracking-tight">통서(通書)</h1>
          <p className="text-gray-400 text-center text-sm leading-relaxed">
            메모를 입력하면 AI가 자동으로 분류해드립니다
          </p>
        </div>

        <button
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-[#2e2e42] rounded-xl bg-[#1c1c27] hover:bg-[#252535] transition-colors text-gray-200 font-medium"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
          Google로 로그인
        </button>

        {/* 차단 안내 메시지 */}
        {isNotAllowed && (
          <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex flex-col gap-1">
            <p className="text-sm font-medium text-amber-300">현재 초대된 사용자만 이용 가능합니다.</p>
            <p className="text-xs text-amber-400/70">
              알파테스트 참여를 원하시면 개발자에게 문의해주세요.
            </p>
          </div>
        )}

        <p className="text-xs text-gray-600 text-center">
          로그인 시 서비스 이용약관에 동의하는 것으로 간주됩니다
        </p>
      </div>
    </div>
  )
}
