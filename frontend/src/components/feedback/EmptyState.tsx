import React from 'react';
import { Users, Calendar, Briefcase, MessageSquare, Bell, Search, LucideIcon } from 'lucide-react';
import { Button } from '../ui/Button';

export type EmptyStateType =
  | 'alumni'
  | 'events'
  | 'jobs'
  | 'mentorship'
  | 'notifications'
  | 'search'
  | 'generic';

export interface EmptyStateProps {
  type?: EmptyStateType;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: LucideIcon;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'generic',
  title,
  description,
  actionLabel,
  onAction,
  icon: CustomIcon,
  className = '',
}) => {
  const defaults = {
    alumni: {
      icon: Users,
      title: 'No alumni profiles found',
      description: 'There are currently no verified alumni profiles matching your filter criteria.',
    },
    events: {
      icon: Calendar,
      title: 'No upcoming events scheduled',
      description: 'Campus networking sessions, webinars, and reunions will be listed here once announced.',
    },
    jobs: {
      icon: Briefcase,
      title: 'No active job opportunities',
      description: 'Alumni referral opportunities and campus hiring postings will appear here.',
    },
    mentorship: {
      icon: MessageSquare,
      title: 'No active mentorship connections',
      description: 'Connect with alumni mentors in your field to seek career advice and resume guidance.',
    },
    notifications: {
      icon: Bell,
      title: 'All caught up',
      description: 'You have no unread notifications or pending application updates.',
    },
    search: {
      icon: Search,
      title: 'No search results found',
      description: 'Try adjusting your search terms, department filters, or graduation year.',
    },
    generic: {
      icon: Users,
      title: 'No records available',
      description: 'There is no data to display for this view yet.',
    },
  }[type];

  const IconComponent = CustomIcon || defaults.icon;
  const displayTitle = title || defaults.title;
  const displayDescription = description || defaults.description;

  return (
    <div
      className={`card p-12 text-center flex flex-col items-center justify-center max-w-lg mx-auto border-dashed border-slate-200 ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
        <IconComponent className="w-6 h-6" />
      </div>
      <h3 className="text-base font-bold text-navy-900 mb-1">{displayTitle}</h3>
      <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
        {displayDescription}
      </p>
      {actionLabel && onAction && (
        <Button variant="outline" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
