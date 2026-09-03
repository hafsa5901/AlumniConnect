import React, { useState, useRef, useEffect } from 'react';

export interface DropdownItem {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  items,
  align = 'right',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className={`relative inline-block text-left ${className}`}>
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        role="button"
        tabIndex={0}
        aria-haspopup="true"
        aria-expanded={isOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen((prev) => !prev);
          }
        }}
      >
        {trigger}
      </div>

      {isOpen && (
        <div
          className={`absolute z-40 mt-2 w-56 rounded-card bg-white shadow-modal border border-slate-200 py-1.5 focus:outline-none animate-slide-up ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          role="menu"
        >
          {items.map((item, idx) => (
            <React.Fragment key={idx}>
              {item.divider ? (
                <div className="my-1 border-t border-slate-200" />
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    item.onClick?.();
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-left transition-colors ${
                    item.danger
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-slate-900 hover:bg-slate-50'
                  } ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {item.icon && <span className="text-slate-500">{item.icon}</span>}
                  <span>{item.label}</span>
                </button>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};
