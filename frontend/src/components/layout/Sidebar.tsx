import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Briefcase,
  MessageSquare,
  ShieldCheck,
  Settings,
  ShieldAlert,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { getNavigation } from '../../config/navigation';

export interface SidebarProps {
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ className = '' }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const role = user?.role || 'student';
  const navItems = getNavigation(role);

  return (
    <aside
      className={`w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 min-h-[calc(100vh-4rem)] p-4 ${className}`}
      aria-label="Dashboard Sidebar"
    >
      <div className="space-y-6">
        {/* User Card */}
        {user && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-card flex items-center gap-3">
            <Avatar name={user.name} size="md" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-navy-900 truncate">{user.name}</div>
              <div className="text-[11px] text-slate-500 truncate font-mono">{user.email}</div>
              <div className="mt-1">
                <Badge
                  variant={role === 'admin' ? 'red' : role === 'alumni' ? 'blue' : 'green'}
                  size="sm"
                >
                  {role}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;

            if (item.disabled) {
              return (
                <div
                  key={item.label}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-btn text-xs font-semibold text-slate-400 cursor-not-allowed select-none opacity-60"
                  title="Coming soon in a future release"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-slate-400" />
                    <span>{item.label}</span>
                  </div>
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">Soon</span>
                </div>
              );
            }

            return (
              <Link
                key={item.label}
                to={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-btn text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-slate-500 hover:text-navy-900 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer / Logout */}
      <div className="pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-btn text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
