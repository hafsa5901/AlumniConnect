import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { announcementsService } from '../../services/announcements';
import { AnnouncementItem } from '../../types';
import { Navbar, Footer, PageHeader } from '../../components/layout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { CardSkeleton } from '../../components/feedback/Skeleton';
import { getCategoryBadgeVariant } from '../../components/announcements/LatestAnnouncements';
import {
  Calendar,
  User,
  ArrowLeft,
  Clock,
  Edit3,
  ShieldAlert,
  AlertCircle,
} from 'lucide-react';

export default function AnnouncementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [announcement, setAnnouncement] = useState<AnnouncementItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!id) {
      setHasError(true);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    announcementsService
      .getAnnouncementById(id)
      .then((item) => {
        if (isMounted) {
          setAnnouncement(item);
        }
      })
      .catch((err) => {
        console.error('Failed to load announcement detail:', err);
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
  }, [id]);

  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 container-app px-4 sm:px-6 lg:px-8 py-8 space-y-6 max-w-4xl">
        {/* Navigation back bar */}
        <div className="flex items-center justify-between gap-4">
          <Link
            to="/announcements"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-navy-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Announcements</span>
          </Link>

          {isAdmin && announcement && (
            <Link to={`/admin/announcements/${announcement.id || announcement._id}/edit`}>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Edit3 className="w-3.5 h-3.5" />}
              >
                Edit Announcement
              </Button>
            </Link>
          )}
        </div>

        {isLoading ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200/90 shadow-xs space-y-6">
            <CardSkeleton count={3} />
          </div>
        ) : hasError || !announcement ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-navy-900">Announcement Not Found</h1>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              This announcement does not exist, has been removed, or is currently unpublished.
            </p>
            <Link to="/announcements">
              <Button variant="primary" size="sm">
                Browse Active Announcements
              </Button>
            </Link>
          </div>
        ) : (
          <article className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            {/* Optional Cover Image */}
            {announcement.coverImage && (
              <div className="w-full aspect-[21/9] sm:aspect-[2.4/1] bg-slate-100 overflow-hidden relative">
                <img
                  src={announcement.coverImage}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.parentElement?.classList.add('hidden');
                  }}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="p-6 sm:p-8 space-y-6">
              {/* Header metadata */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={getCategoryBadgeVariant(announcement.category)} size="md">
                    {announcement.category}
                  </Badge>

                  {!announcement.published && (
                    <Badge variant="yellow" size="md" icon={<ShieldAlert className="w-3 h-3" />}>
                      Draft (Admin Only)
                    </Badge>
                  )}

                  <div className="flex items-center text-xs text-slate-500 font-medium ml-auto">
                    <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                    <time dateTime={announcement.publishedAt || announcement.createdAt}>
                      {new Date(announcement.publishedAt || announcement.createdAt).toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </time>
                  </div>
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight leading-tight">
                  {announcement.title}
                </h1>

                {/* Author Info Cardlet */}
                <div className="flex items-center gap-3 pt-2 pb-4 border-b border-slate-100 text-xs">
                  <Avatar
                    name={announcement.author?.name || 'Administration'}
                    src={announcement.author?.profilePhotoUrl}
                    size="sm"
                  />
                  <div>
                    <div className="font-bold text-navy-900">
                      {announcement.author?.name || 'AlumniConnect Administration'}
                    </div>
                    <div className="text-[11px] text-slate-500">Official Notice Publisher</div>
                  </div>
                </div>
              </div>

              {/* Summary Callout */}
              <div className="bg-slate-50 p-4 sm:p-5 rounded-xl border border-slate-200/80">
                <h2 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-1">
                  Summary
                </h2>
                <p className="text-sm text-slate-700 leading-relaxed font-medium break-words [overflow-wrap:anywhere]">
                  {announcement.summary}
                </p>
              </div>

              {/* Full Notice Content (Safe plain text rendering) */}
              <div className="space-y-2 pt-2">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Notice Details
                </h2>
                <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-line break-words [overflow-wrap:anywhere] min-w-0">
                  {announcement.content}
                </div>
              </div>
            </div>
          </article>
        )}
      </main>

      <Footer />
    </div>
  );
}
