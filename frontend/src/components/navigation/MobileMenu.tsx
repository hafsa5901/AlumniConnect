import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X, LogOut, ArrowRight, User, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';

export interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  navLinks: Array<{ label: string; href: string }>;
}

export const MobileMenu: React.FC<MobileMenuProps> = ({
  isOpen,
  onClose,
  navLinks,
}) => {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const dashboardRoute =
    user?.role === 'admin'
      ? '/dashboard/admin'
      : user?.role === 'alumni'
      ? '/dashboard/alumni'
      : '/dashboard/student';

  return (
    <div
      className="fixed inset-0 z-50 lg:hidden bg-navy-900/60 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Mobile Navigation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="fixed inset-y-0 right-0 w-full max-w-xs bg-white shadow-2xl flex flex-col justify-between p-6 animate-slide-up">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-5 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-navy-900 text-white flex items-center justify-center font-bold text-sm">
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="6" cy="6" r="3" />
                  <circle cx="18" cy="6" r="3" />
                  <circle cx="12" cy="18" r="3" />
                  <line x1="8.5" y1="7.5" x2="15.5" y2="7.5" />
                  <line x1="7.5" y1="8.5" x2="10.5" y2="15.5" />
                  <line x1="16.5" y1="8.5" x2="13.5" y2="15.5" />
                </svg>
              </div>
              <span className="font-bold text-navy-900 text-base tracking-tight">AlumniConnect</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-navy-900 hover:bg-slate-100 transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User profile snippet if logged in */}
          {isAuthenticated && user && (
            <div className="mt-4 p-3 bg-slate-50 rounded-card border border-slate-200 flex items-center gap-3">
              <Avatar name={user.name} size="md" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-navy-900 truncate">{user.name}</div>
                <div className="text-xs text-slate-500 truncate font-mono">{user.email}</div>
                <div className="mt-1">
                  <Badge variant={user.role === 'admin' ? 'red' : user.role === 'alumni' ? 'blue' : 'green'} size="sm">
                    {user.role}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="mt-6 space-y-1">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.href;
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={onClose}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-btn text-sm font-semibold transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span>{link.label}</span>
                  {isActive && <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                </Link>
              );
            })}

            {isAuthenticated && (
              <Link
                to={dashboardRoute}
                onClick={onClose}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-btn text-sm font-bold text-navy-900 hover:bg-slate-50 transition-colors"
              >
                <Shield className="w-4 h-4 text-blue-600" />
                <span>My Dashboard</span>
              </Link>
            )}
          </nav>
        </div>

        {/* Auth Actions Bottom */}
        <div className="pt-6 border-t border-slate-200">
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => {
                logout();
                onClose();
              }}
              className="w-full btn btn-outline text-red-600 hover:border-red-600 hover:bg-red-50 hover:text-red-600 justify-center"
            >
              <LogOut className="w-4 h-4 mr-1" />
              Sign Out
            </button>
          ) : (
            <div className="space-y-2.5">
              <Link
                to="/login"
                onClick={onClose}
                className="w-full btn btn-outline justify-center"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                onClick={onClose}
                className="w-full btn btn-primary justify-center"
              >
                Get Started
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
