// ==========================================
// [ARQUIVO] BottomNav.tsx v1.1
// [DATA] 2026-02-25
// [REQUER] AuthContext.tsx, react-router-dom, lucide-react
// ==========================================

// #region IMPORTS
import { NavLink } from 'react-router-dom'
import {
  Home, Search, Ticket, User,
  LayoutDashboard, Plus, ScanLine
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
// #endregion IMPORTS

// #region NAV ITEMS — Diferenciado por role
// Consumidor: Início, Ofertas, Vouchers, Perfil
const NAV_CONSUMIDOR = [
  { to: '/ofertas',         icon: Home,            label: 'Início'  },
  { to: '/ofertas',         icon: Search,          label: 'Ofertas' },
  { to: '/minhas-reservas', icon: Ticket,          label: 'Vouchers'},
  { to: '/perfil',          icon: User,            label: 'Perfil'  },
]

// PME: Painel, Criar, Validar, Perfil
const NAV_PME = [
  { to: '/dashboard',       icon: LayoutDashboard, label: 'Painel'  },
  { to: '/criar-oferta',    icon: Plus,            label: 'Criar'   },
  { to: '/validar-voucher', icon: ScanLine,        label: 'Validar' },
  { to: '/perfil',          icon: User,            label: 'Perfil'  },
]
// #endregion NAV ITEMS

// #region COMPONENT
export default function BottomNav() {
  const { role } = useAuth()

  // Seleciona nav correta pelo role
  const items = role === 'pme' ? NAV_PME : NAV_CONSUMIDOR

  return (
    // #region NAV — usa classe bottom-nav do Design System
    <nav className="bottom-nav">
      {items.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={`${to}-${label}`}
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1
             flex-1 py-1 transition-colors
             ${isActive
               ? 'text-primary-500'      // Ativo — laranja primário
               : 'text-neutral-500'      // Inativo — cinza neutro
             }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon
                className="w-5 h-5"
                strokeWidth={isActive ? 2.5 : 1.8}
              />
              <span className="text-[10px] font-medium">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
    // #endregion NAV
  )
}
// #endregion COMPONENT
