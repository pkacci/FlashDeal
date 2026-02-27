// ============================================================
// INÍCIO: src/components/common/BottomNav.tsx
// Versão: 1.2.0 | Data: 2026-02-27
// Fix v1.2: Fixed bottom-0, safe-area, contraste neutral-500,
//           removida dependência de classe CSS externa.
// ============================================================

import { NavLink } from 'react-router-dom';
import {
  Home, Search, Ticket, User,
  LayoutDashboard, Plus, ScanLine
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const NAV_CONSUMIDOR = [
  { to: '/ofertas',         icon: Home,            label: 'Início'  },
  { to: '/ofertas',         icon: Search,          label: 'Ofertas' },
  { to: '/minhas-reservas', icon: Ticket,          label: 'Vouchers'},
  { to: '/perfil',          icon: User,            label: 'Perfil'  },
];

const NAV_PME = [
  { to: '/dashboard',       icon: LayoutDashboard, label: 'Painel'  },
  { to: '/criar-oferta',    icon: Plus,            label: 'Criar'   },
  { to: '/validar-voucher', icon: ScanLine,        label: 'Validar' },
  { to: '/perfil',          icon: User,            label: 'Perfil'  },
];

export default function BottomNav() {
  const { role } = useAuth();
  const items = role === 'pme' ? NAV_PME : NAV_CONSUMIDOR;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-100 z-[100] h-16 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      <div className="flex justify-around items-center h-full max-w-md mx-auto px-2 pb-[env(safe-area-inset-bottom)]">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={`${to}-${label}`}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 h-full transition-all active:scale-95
               ${isActive ? 'text-primary-500' : 'text-neutral-500'}`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`p-1 rounded-xl transition-colors ${isActive ? 'bg-orange-50' : ''}`}>
                  <Icon 
                    size={20} 
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                </div>
                <span className={`text-[10px] font-bold mt-0.5 tracking-tight ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                  {label}
                </span>
                {/* Indicador sutil de item ativo */}
                {isActive && (
                  <div className="absolute bottom-1 w-1 h-1 bg-primary-500 rounded-full" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
// ============================================================
// FIM: src/components/common/BottomNav.tsx
// ============================================================
