import { NavLink, Outlet, useLocation } from 'react-router-dom'

const link = ({ isActive }: { isActive: boolean }) =>
  `rounded px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200'
  }`

export default function Layout() {
  const { pathname } = useLocation()
  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="border-b border-slate-200 bg-white">
        <nav aria-label="Main" className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
          <NavLink to="/" end className="mr-4 text-lg font-semibold">
            Biobase
          </NavLink>
          <NavLink to="/patients" className={link}>
            Find patients
          </NavLink>
          <NavLink to="/slides" end className={link}>
            Explore slides
          </NavLink>
          <NavLink to="/slides/map" className={link}>
            Slide map
          </NavLink>
          <NavLink to="/about" className={(s) => `${link(s)} sm:ml-auto`}>
            About the data
          </NavLink>
        </nav>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6">
        <div key={pathname} className="page-enter">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
