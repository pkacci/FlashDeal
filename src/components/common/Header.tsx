// ==========================================
// [ARQUIVO] Header.tsx v1.1
// [DATA] 2026-02-25
// [REQUER] AuthContext.tsx, react-router-dom
// ==========================================

// #region IMPORTS
import { Link, useNavigate } from 'react-router-dom'
import { User } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
// #endregion IMPORTS

// #region TYPES
interface HeaderProps {
  title?: string       // Título opcional (telas internas)
  showBack?: boolean   // Botão voltar
}
// #endregion TYPES

// #region COMPONENT
export default function Header({ title, showBack = false }: HeaderProps) {
  const { user } = useAuth()
  const navigate = useNavigate()

  return (
    // #region CONTAINER
    // bg-white + sombra sutil — header fixo no topo
    <header className="sticky top-0 z-40 bg-white border-b
                       border-neutral-200 safe-pt">
      <div className="flex items-center justify-between
                      px-4 h-14 max-w-lg mx-auto">

        {/* #region LEFT — Voltar ou Logo */}
        <div className="flex items-center gap-3">
          {showBack ? (
            <button
              onClick={() => navigate(-1)}
              className="text-neutral-700 font-medium
                         flex items-center gap-1 text-sm"
            >
              ← Voltar
            </button>
          ) : (
            <Link to="/" className="flex items-center gap-2">
              {/* Logo FlashDeal — laranja primário */}
              <span className="text-xl font-extrabold text-primary-500">
                ⚡ FlashDeal
              </span>
            </Link>
          )}
        </div>
        {/* #endregion LEFT */}

        {/* #region CENTER — Título opcional */}
        {title && (
          <h1 className="text-base font-semibold text-neutral-900
                         absolute left-1/2 -translate-x-1/2">
            {title}
          </h1>
        )}
        {/* #endregion CENTER */}

        {/* #region RIGHT — Perfil */}
        <Link
          to={user ? '/perfil' : '/login'}
          className="w-8 h-8 rounded-full bg-neutral-100
                     flex items-center justify-center
                     active:scale-95 transition-transform"
        >
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt="perfil"
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <User className="w-4 h-4 text-neutral-500" />
          )}
        </Link>
        {/* #endregion RIGHT */}

      </div>
    </header>
    // #endregion CONTAINER
  )
}
// #endregion COMPONENT
