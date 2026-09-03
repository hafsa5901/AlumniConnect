import React, { useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { EmptyState } from '../feedback/EmptyState';

export const NotificationsPopover: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-btn text-slate-500 hover:text-navy-900 hover:bg-slate-50 transition-colors relative"
        aria-label="View notifications"
        aria-expanded={isOpen}
      >
        <Bell className="w-4 h-4" />
        {/* 0 unread indicator */}
        <span className="sr-only">0 unread notifications</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-card shadow-modal border border-slate-200 py-3 z-50 animate-slide-up">
          <div className="px-4 pb-2.5 border-b border-slate-200 flex items-center justify-between">
            <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider">
              Notifications
            </h4>
            <span className="text-[11px] font-semibold text-slate-400">0 unread</span>
          </div>

          <div className="p-4">
            <EmptyState
              type="notifications"
              title="No notifications yet"
              description="You are all caught up. Campus announcements and application updates will appear here."
            />
          </div>

          <div className="px-4 pt-2 border-t border-slate-200 text-center">
            <span className="text-[11px] text-slate-400">Institutional Alerts Feed</span>
          </div>
        </div>
      )}
    </div>
  );
};
