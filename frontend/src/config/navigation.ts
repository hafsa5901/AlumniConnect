import {
  LayoutDashboard,
  Users,
  Calendar,
  Briefcase,
  MessageSquare,
  ShieldAlert,
  User,
  Settings,
  UserCog,
  FileText,
  BarChart3,
  LucideIcon,
} from 'lucide-react';
import { Role } from '../types';

export interface NavItemConfig {
  label: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
}

export const navigationConfig: Record<Role, NavItemConfig[]> = {
  student: [
    { label: 'Overview', href: '/dashboard/student', icon: LayoutDashboard },
    { label: 'Events', href: '/events', icon: Calendar },
    { label: 'Alumni Directory', href: '/alumni', icon: Users },
    { label: 'My Profile', href: '/profile', icon: User },
    { label: 'Settings', href: '/settings', icon: Settings },
    { label: 'Jobs & Referrals', href: '/jobs', icon: Briefcase, disabled: true },
    { label: 'Mentorship', href: '/mentorship', icon: MessageSquare, disabled: true },
  ],
  alumni: [
    { label: 'Overview', href: '/dashboard/alumni', icon: LayoutDashboard },
    { label: 'Events', href: '/events', icon: Calendar },
    { label: 'Alumni Directory', href: '/alumni', icon: Users },
    { label: 'My Profile', href: '/profile', icon: User },
    { label: 'Settings', href: '/settings', icon: Settings },
    { label: 'Jobs & Referrals', href: '/jobs', icon: Briefcase, disabled: true },
    { label: 'Mentorship', href: '/mentorship', icon: MessageSquare, disabled: true },
  ],
  admin: [
    { label: 'Overview', href: '/dashboard/admin', icon: LayoutDashboard },
    { label: 'Verification Queue', href: '/admin/verification', icon: ShieldAlert },
    { label: 'Event Approvals', href: '/admin/events', icon: Calendar },
    { label: 'Events', href: '/events', icon: Calendar },
    { label: 'Alumni Directory', href: '/alumni', icon: Users },
    { label: 'Settings', href: '/settings', icon: Settings },
    { label: 'Manage Users', href: '/admin/users', icon: UserCog, disabled: true },
    { label: 'Audit Logs', href: '/admin/audit', icon: FileText, disabled: true },
    { label: 'Analytics', href: '/admin/analytics', icon: BarChart3, disabled: true },
  ],
};

export function getNavigation(role?: Role): NavItemConfig[] {
  if (!role || !navigationConfig[role]) {
    return navigationConfig.student;
  }
  return navigationConfig[role];
}
