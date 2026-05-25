import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { isAuthenticated } from './lib/auth'
import Login from './pages/Login'
import Leaderboard from './pages/Leaderboard'
import Sessions from './pages/Sessions'
import SessionDetail from './pages/SessionDetail'
import PlayerDetail from './pages/PlayerDetail'
import NewSession from './pages/NewSession'

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RequireAuth><Leaderboard /></RequireAuth>} />
        <Route path="/sessions" element={<RequireAuth><Sessions /></RequireAuth>} />
        <Route path="/sessions/new" element={<RequireAuth><NewSession /></RequireAuth>} />
        <Route path="/sessions/:id" element={<RequireAuth><SessionDetail /></RequireAuth>} />
        <Route path="/players/:id" element={<RequireAuth><PlayerDetail /></RequireAuth>} />
      </Routes>
    </BrowserRouter>
  )
}
