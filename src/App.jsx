import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Settings } from 'lucide-react';
import Dashboard    from './pages/Dashboard.jsx';
import Clients      from './pages/Clients.jsx';
import ClientDetail from './pages/ClientDetail.jsx';
import SettingsPage from './pages/Settings.jsx';

const NAV = [
  { to: '/',        icon: LayoutDashboard, label: 'Главная',   end: true },
  { to: '/clients', icon: Users,           label: 'Клиенты',  end: false },
  { to: '/settings',icon: Settings,        label: 'Настройки', end: false },
];

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex">
        {/* ── Sidebar ── */}
        <aside className="w-60 bg-white border-r border-rose-100 flex flex-col shadow-sm shrink-0">
          {/* Logo */}
          <div className="px-5 py-6 border-b border-rose-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center shadow">
                <span className="text-xl">🌸</span>
              </div>
              <div className="leading-tight">
                <div className="font-bold text-gray-800 text-sm">Памятные</div>
                <div className="font-bold text-rose-500 text-sm">даты</div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-3 space-y-1">
            {NAV.map(({ to, icon: Icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-rose-50 text-rose-600 shadow-sm'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                  }`
                }
              >
                <Icon className="w-4.5 h-4.5 w-[18px] h-[18px]" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="px-5 py-4 border-t border-rose-100">
            <p className="text-xs text-gray-400 text-center">Цветочный магазин</p>
          </div>
        </aside>

        {/* ── Content ── */}
        <main className="flex-1 overflow-auto min-h-screen">
          <Routes>
            <Route path="/"              element={<Dashboard />} />
            <Route path="/clients"       element={<Clients />} />
            <Route path="/clients/new"   element={<ClientDetail isNew />} />
            <Route path="/clients/:id"   element={<ClientDetail />} />
            <Route path="/settings"      element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
