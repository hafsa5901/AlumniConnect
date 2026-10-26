import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { announcementsService } from '../../services/announcements';
import { AnnouncementItem, AnnouncementCategory } from '../../types';
import { Card } from '../ui/Card';
import { Badge, BadgeProps } from '../ui/Badge';
import { CardSkeleton } from '../feedback/Skeleton';
import { Megaphone, ArrowRight, Calendar, AlertCircle } from 'lucide-react';

export function getCategoryBadgeVariant(category: AnnouncementCategory): BadgeProps['variant'] {
  switch (category) {
    case 'Important':
      return 'red';
    case 'Placements':
      return 'green';
    case 'Internships':
      return 'yellow';
    case 'Events':
    case 'Academic':
      return 'blue';
    case 'Workshops':
      return 'navy';
    default:
      return 'gray';
  }
}

export interface LatestAnnouncementsProps {
  limit?: number;
}

export const LatestAnnouncements: React.FC<LatestAnnouncementsProps> = ({ limit = 4 }) => {
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    announcementsService
      .getAnnouncements({ limit })
      .then((res) => {
        if (isMounted) {
          setItems(res.data.data.announcements || []);
        }
      })
      .catch((err) => {
        console.error('Failed to load latest announcements for widget:', err);
        if (isMounted) {
          setHasError(true);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <Card className="p-6 border-slate-200/90 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Megaphone className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-navy-900 leading-tight">
              Latest Campus Announcements
            </h3>
            <p className="text-[11px] text-slate-500">Official institution updates & notices</p>
          </div>
        </div>
        <Link
          to="/announcements"
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 group"
        >
          <span>View all</span>
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <CardSkeleton count={2} />
        </div>
      ) : hasError ? (
        <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4 text-slate-400" />
          <span>Announcements temporarily unavailable.</span>
        </div>
      ) : items.length === 0 ? (
        <div className="p-6 bg-slate-50/60 rounded-xl text-center text-xs text-slate-500">
          No campus announcements published yet. Check back soon!
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {items.map((item) => (
            <Link
              key={item.id || item._id}
              to={`/announcements/${item.id || item._id}`}
              className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 group hover:bg-slate-50/80 -mx-2 px-2 rounded-lg transition-colors"
            >
              <div className="space-y-1 min-w-0 flex-1 pr-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={getCategoryBadgeVariant(item.category)} size="sm">
                    {item.category}
                  </Badge>
                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 truncate transition-colors">
                    {item.title}
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-1 leading-normal">
                  {item.summary}
                </p>
              </div>

              <div className="shrink-0 flex items-center text-[10px] text-slate-400">
                <Calendar className="w-3 h-3 mr-1" />
                <time dateTime={item.publishedAt || item.createdAt}>
                  {new Date(item.publishedAt || item.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </time>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
};
