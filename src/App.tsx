import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { RequireAuth, RequireNoAuth } from './components/AuthGuard'
import { useFCM } from './hooks/useFCM'
import LoginPage from './pages/LoginPage'
import ApiKeyPage from './pages/ApiKeyPage'
import HomePage from './pages/HomePage'
import NotesPage from './pages/NotesPage'
import EditNotePage from './pages/EditNotePage'
import MyPage from './pages/MyPage'
import SettingsPage from './pages/SettingsPage'
import ClassifyReviewPage from './pages/ClassifyReviewPage'
import RoutinesPage from './pages/RoutinesPage'
import EmergencyTasksPage from './pages/EmergencyTasksPage'

function AppInner() {
  useFCM()
  return (
    <div className="max-w-[440px] mx-auto min-h-svh bg-[#111118] relative">
      <Routes>
        <Route path="/login" element={<RequireNoAuth><LoginPage /></RequireNoAuth>} />
        <Route path="/setup-api-key" element={<RequireAuth><ApiKeyPage /></RequireAuth>} />
        <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
        <Route path="/notes" element={<RequireAuth><NotesPage /></RequireAuth>} />
        <Route path="/edit" element={<RequireAuth><EditNotePage /></RequireAuth>} />
        <Route path="/mypage" element={<RequireAuth><MyPage /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
        <Route path="/classify-review" element={<RequireAuth><ClassifyReviewPage /></RequireAuth>} />
        <Route path="/routines" element={<RequireAuth><RoutinesPage /></RequireAuth>} />
        <Route path="/emergency" element={<RequireAuth><EmergencyTasksPage /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </BrowserRouter>
  )
}
