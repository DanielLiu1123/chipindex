import { Link, useLocation, useNavigate } from 'react-router-dom'
import { logout } from '../lib/auth'

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const navLinks = [
    { to: '/', label: 'LEADERBOARD' },
    { to: '/sessions', label: 'SESSIONS' },
  ]

  return (
    <div className="min-h-screen bg-bg font-mono">
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 h-12 flex items-center justify-between">
          <Link to="/" className="text-accent font-medium tracking-widest text-sm">
            CHIPINDEX
          </Link>
          <nav className="flex items-center gap-6">
            {navLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`text-xs tracking-widest transition-colors ${
                  location.pathname === to
                    ? 'text-white'
                    : 'text-muted hover:text-white'
                }`}
              >
                {label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="text-xs tracking-widest text-muted hover:text-danger transition-colors"
            >
              EXIT
            </button>
          </nav>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
