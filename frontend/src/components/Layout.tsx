import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import DataModal from './DataModal'
import ModelsModal from './ModelsModal'

const link = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
    isActive ? 'bg-blue-700 text-white shadow-sm' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-800'
  }`

export default function Layout() {
  const { pathname } = useLocation()
  const [showModels, setShowModels] = useState(false)
  const [showData, setShowData] = useState(false)
  const findPatientsActive = pathname.startsWith('/patients') && pathname !== '/patients/match'
  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur">
        <nav aria-label="Main" className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
          <NavLink to="/" end className="mr-4 flex items-center gap-2 text-lg font-bold tracking-tight">
            <svg viewBox="0 0 28 28" className="h-7 w-7" aria-hidden>
              <circle cx="11" cy="14" r="9" fill="#3a3a9c" />
              <circle cx="18" cy="14" r="9" fill="#f4a6bf" fillOpacity="0.85" />
            </svg>
            Veritome
          </NavLink>
          {/* /patients/match is its own tab, so "Find patients" must not stay highlighted there. */}
          <Link to="/patients" aria-current={findPatientsActive ? 'page' : undefined} className={link({ isActive: findPatientsActive })}>
            Find patients
          </Link>
          <NavLink to="/patients/match" className={link}>
            Find trials
          </NavLink>
          <NavLink to="/slides" end className={link}>
            Explore slides
          </NavLink>
          <NavLink to="/slides/map" className={link}>
            Slide map
          </NavLink>
          <button
            type="button"
            onClick={() => setShowModels(true)}
            className="rounded px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:ml-auto"
          >
            About the models
          </button>
          <button
            type="button"
            onClick={() => setShowData(true)}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            About the data
          </button>
        </nav>
      </header>
      {showModels && <ModelsModal onClose={() => setShowModels(false)} />}
      {showData && <DataModal onClose={() => setShowData(false)} />}
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6">
        <div key={pathname} className="page-enter">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
