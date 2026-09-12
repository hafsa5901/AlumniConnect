import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Bell, LogOut, LayoutDashboard, User, Shield, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Dropdown } from '../ui/Dropdown';
import { MobileMenu } from '../navigation/MobileMenu';
import { NotificationsPopover } from './NotificationsPopover';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Home', href: '/' },
    { label: 'Alumni', href: '/alumni' },
    { label: 'Events', href: '/events' },
    { label: 'Jobs', href: '/jobs' },
    { label: 'Mentorship', href: '/mentorship' },
  ];

  const dashboardRoute =
    user?.role === 'admin'
      ? '/dashboard/admin'
      : user?.role === 'alumni'
      ? '/dashboard/alumni'
      : '/dashboard/student';

  const userDropdownItems = [
    {
      label: 'My Dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
      onClick: () => navigate(dashboardRoute),
    },
    {
      label: 'Account Status',
      icon: <Shield className="w-4 h-4" />,
      onClick: () => navigate('/verification-status'),
    },
    {
      label: '',
      divider: true,
    },
    {
      label: 'Sign Out',
      icon: <LogOut className="w-4 h-4" />,
      danger: true,
      onClick: async () => {
        await logout();
        navigate('/login');
      },
    },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="container-app px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-18">
            {/* Left: Brand / Logo */}
            <Link
              to="/"
              className="flex items-center gap-2.5 focus:outline-none rounded-btn py-1 px-1.5 transition-opacity hover:opacity-90"
              aria-label="AlumniConnect Home"
            >
              {/* Connected Nodes Mark */}
              <div className="w-9 h-9 rounded-xl bg-navy-900 text-white flex items-center justify-center shadow-sm">
                <svg
                  className="w-5 h-5 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="6" cy="6" r="3" />
                  <circle cx="18" cy="6" r="3" />
                  <circle cx="12" cy="18" r="3" />
                  <line x1="8.5" y1="7.5" x2="15.5" y2="7.5" />
                  <line x1="7.5" y1="8.5" x2="10.5" y2="15.5" />
                  <line x1="16.5" y1="8.5" x2="13.5" y2="15.5" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-navy-900 text-lg tracking-tight leading-none">
                  AlumniConnect
                </span>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
                  Institutional Network
                </span>
              </div>
            </Link>

            {/* Center: Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-1" aria-label="Main Navigation">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    to={link.href}
                    className={`px-3.5 py-2 rounded-btn text-xs font-semibold transition-colors ${
                      isActive
                        ? 'text-blue-600 bg-blue-50'
                        : 'text-slate-500 hover:text-navy-900 hover:bg-slate-50'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right: Unauthenticated vs Authenticated */}
            <div className="hidden sm:flex items-center gap-3">
              {isAuthenticated && user ? (
                <div className="flex items-center gap-3">
                  <Link
                    to={dashboardRoute}
                    className="btn btn-outline btn-sm font-semibold"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    <span>Dashboard</span>
                  </Link>

                  <NotificationsPopover />

                  <Dropdown
                    align="right"
                    items={userDropdownItems}
                    trigger={
                      <div className="flex items-center gap-2 p-1 pl-1.5 rounded-btn hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-200 transition-colors">
                        <Avatar name={user.name} size="sm" />
                        <div className="text-left hidden lg:block pr-1">
                          <div className="text-xs font-bold text-navy-900 leading-tight truncate max-w-[120px]">
                            {user.name}
                          </div>
                          <div className="text-[10px] text-slate-500 capitalize leading-none">
                            {user.role}
                          </div>
                        </div>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                    }
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2.5">
                  <Link to="/login" className="btn btn-ghost btn-sm">
                    Sign In
                  </Link>
                  <Link to="/register" className="btn btn-primary btn-sm">
                    Get Started
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile Hamburger Button */}
            <div className="flex items-center gap-2 sm:hidden">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="p-2 rounded-btn text-slate-500 hover:text-navy-900 hover:bg-slate-50 transition-colors"
                aria-label="Open mobile navigation menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Navigation */}
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        navLinks={navLinks}
      />
    </>
  );
};
