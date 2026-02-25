// BottomNav.tsx | v1.0.0 | 2025-02-25
// Deps: react-router-dom, tailwindcss, lucide-react

import { NavLink, useLocation } from 'react-router-dom';
import { Home, Tag, BookMarked, User } from 'lucide-react';

// #region nav items
const NAV_ITEMS = [
  { to: '/',          icon: Home,        label: 'Início'    },
  { to: '/ofertas',   icon: Tag,         label: 'Ofertas'   },
  { to: '/reservas',  icon: BookMarked,  label: 'Reservas'  },
  { to: '/perfil',    icon: User,        label: 'Perfil'    },
] as const;
// #endregion

// #region component
const BottomNav = () => {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 safe-area-bottom">
      <ul className="flex h-16 items-stretch">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
          const active = location.pathname === to ||
            (to !== '/' && location.pathname.startsWith(to));

          return (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                className="flex h-full flex-col items-center justify-center gap-0.5 px-2"
                aria-label={label}
              >
                <Icon
                  className={`h-5 w-5 transition-colors ${
                    active ? 'text-orange-500' : 'text-gray-400'
                  }`}
                  strokeWidth={active ? 2.5 : 1.8}
                />
                <span
                  className={`text-[10px] font-medium transition-colors ${
                    active ? 'text-orange-500' : 'text-gray-400'
                  }`}
                >
                  {label}
                </span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
// #endregion

export default BottomNav;
