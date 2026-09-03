import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  showHome?: boolean;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  showHome = true,
}) => {
  return (
    <nav aria-label="Breadcrumbs" className="flex items-center text-xs text-slate-500 font-medium">
      <ol className="flex items-center space-x-1.5">
        {showHome && (
          <li className="flex items-center">
            <Link
              to="/"
              className="text-slate-500 hover:text-navy-900 transition-colors flex items-center gap-1"
            >
              <Home className="w-3.5 h-3.5" />
              <span className="sr-only">Home</span>
            </Link>
            {items.length > 0 && <ChevronRight className="w-3.5 h-3.5 mx-1 text-slate-400" />}
          </li>
        )}

        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="flex items-center">
              {item.href && !isLast ? (
                <Link
                  to={item.href}
                  className="text-slate-500 hover:text-navy-900 transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className="text-navy-900 font-semibold truncate max-w-xs"
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
              {!isLast && <ChevronRight className="w-3.5 h-3.5 mx-1 text-slate-400" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
