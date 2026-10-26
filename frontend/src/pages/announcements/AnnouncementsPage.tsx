import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { announcementsService } from '../../services/announcements';
import {
  AnnouncementItem,
  ANNOUNCEMENT_CATEGORIES,
  AnnouncementCategory,
} from '../../types';
import { Navbar, Footer, PageHeader } from '../../components/layout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/feedback/EmptyState';
import { CardSkeleton } from '../../components/feedback/Skeleton';
import { getCategoryBadgeVariant } from '../../components/announcements/LatestAnnouncements';
import {
  Megaphone,
  Search,
  Calendar,
  User,
  ArrowRight,
  Shield,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlQ = searchParams.get('q') || '';
  const urlCategory = searchParams.get('category') || '';
  const urlPage = parseInt(searchParams.get('page') || '1', 10) || 1;

  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Local search input state for debouncing
  const [searchInput, setSearchInput] = useState(urlQ);

  // Ref to ignore stale async responses
  const activeRequestId = useRef(0);

  // Fetch announcements callback
  const fetchAnnouncements = useCallback(async (qParam: string, catParam: string, pageParam: number) => {
    const requestId = ++activeRequestId.current;
    setIsLoading(true);
    setHasError(false);

    try {
      const res = await announcementsService.getAnnouncements({
        q: qParam || undefined,
        category: catParam || undefined,
        page: pageParam,
        limit: 9,
      });

      // Ignore if a newer request was dispatched
      if (requestId === activeRequestId.current) {
        setAnnouncements(res.data.data.announcements || []);
        setTotal(res.data.data.total);
        setTotalPages(res.data.data.totalPages);
      }
    } catch (err) {
      if (requestId === activeRequestId.current) {
        console.error('Failed to load announcements:', err);
        setHasError(true);
      }
    } finally {
      if (requestId === activeRequestId.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Debounce search input changes
  useEffect(() => {
    const handler = setTimeout(() => {
      const currentQ = searchParams.get('q') || '';
      if (searchInput !== currentQ) {
        const nextParams: Record<string, string> = {};
        if (searchInput.trim()) nextParams.q = searchInput.trim();
        if (urlCategory) nextParams.category = urlCategory;
        nextParams.page = '1';
        setSearchParams(nextParams);
      }
    }, 350);

    return () => clearTimeout(handler);
  }, [searchInput, urlCategory, searchParams, setSearchParams]);

  // Fetch when URL parameters change
  useEffect(() => {
    fetchAnnouncements(urlQ, urlCategory, urlPage);
  }, [urlQ, urlCategory, urlPage, fetchAnnouncements]);

  const handleCategorySelect = (cat: string) => {
    const nextParams: Record<string, string> = {};
    if (urlQ) nextParams.q = urlQ;
    if (cat && cat !== 'All') nextParams.category = cat;
    nextParams.page = '1';
    setSearchParams(nextParams);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    const nextParams: Record<string, string> = {};
    if (urlQ) nextParams.q = urlQ;
    if (urlCategory) nextParams.category = urlCategory;
    nextParams.page = newPage.toString();
    setSearchParams(nextParams);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />

      <PageHeader
        title="News & Announcements"
        subtitle="Official campus notices, academic updates, placement news, and institutional circulars."
        actions={
          isAdmin && (
            <Link to="/admin/announcements">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Shield className="w-4 h-4" />}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Manage Announcements
              </Button>
            </Link>
          )
        }
      />

      <main className="flex-1 container-app px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Filters & Search Bar */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Input
                placeholder="Search announcements by title, keyword, or summary..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                leftIcon={<Search className="w-4 h-4 text-slate-400" />}
                aria-label="Search announcements"
              />
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 scrollbar-none text-xs">
            <span className="text-slate-400 text-xs font-semibold mr-1 flex items-center gap-1 shrink-0">
              <Filter className="w-3.5 h-3.5" />
              Category:
            </span>
            <button
              type="button"
              onClick={() => handleCategorySelect('')}
              className={`px-3 py-1.5 rounded-full font-semibold transition-colors shrink-0 ${
                !urlCategory
                  ? 'bg-navy-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-navy-900'
              }`}
            >
              All
            </button>
            {ANNOUNCEMENT_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategorySelect(cat)}
                className={`px-3 py-1.5 rounded-full font-semibold transition-colors shrink-0 ${
                  urlCategory === cat
                    ? 'bg-navy-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-navy-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Announcements Grid */}
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <CardSkeleton count={6} />
          </div>
        ) : hasError ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
            <h3 className="text-sm font-bold text-navy-900">Unable to load announcements</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              There was an error retrieving the announcement feed. Please check your network connection and try again.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchAnnouncements(urlQ, urlCategory, urlPage)}
            >
              Retry
            </Button>
          </div>
        ) : announcements.length === 0 ? (
          <EmptyState
            title="No announcements found"
            description={
              urlQ || urlCategory
                ? 'No announcements match your search or category filter. Try clearing filters to see all notices.'
                : 'There are currently no active announcements published for your campus.'
            }
            actionLabel={urlQ || urlCategory ? 'Clear Filters' : undefined}
            onAction={
              urlQ || urlCategory
                ? () => {
                    setSearchInput('');
                    setSearchParams({});
                  }
                : undefined
            }
          />
        ) : (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {announcements.map((item) => (
                <Card
                  key={item.id || item._id}
                  hoverable
                  className="flex flex-col justify-between overflow-hidden border-slate-200/90 shadow-xs group"
                >
                  <div className="space-y-4">
                    {/* Optional Cover Image Box */}
                    {item.coverImage && (
                      <div className="w-full aspect-video bg-slate-100 overflow-hidden relative">
                        <img
                          src={item.coverImage}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            // Hide image box gracefully if failed to load
                            e.currentTarget.parentElement?.classList.add('hidden');
                          }}
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                        />
                      </div>
                    )}

                    <div className="p-5 space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <Badge variant={getCategoryBadgeVariant(item.category)} size="sm">
                          {item.category}
                        </Badge>
                        <div className="flex items-center text-[11px] text-slate-500 font-medium">
                          <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                          <time dateTime={item.publishedAt || item.createdAt}>
                            {new Date(item.publishedAt || item.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </time>
                        </div>
                      </div>

                      <h2 className="text-base font-bold text-navy-900 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug">
                        <Link to={`/announcements/${item.id || item._id}`}>
                          {item.title}
                        </Link>
                      </h2>

                      <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed break-words [overflow-wrap:anywhere]">
                        {item.summary}
                      </p>
                    </div>
                  </div>

                  <div className="px-5 pb-5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium truncate max-w-[150px]">
                      <User className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{item.author?.name || 'Administration'}</span>
                    </span>

                    <Link
                      to={`/announcements/${item.id || item._id}`}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 group/link"
                    >
                      <span>Read Full Notice</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/link:translate-x-0.5" />
                    </Link>
                  </div>
                </Card>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <div className="text-xs text-slate-500 font-medium">
                  Showing Page <span className="font-bold text-navy-900">{urlPage}</span> of{' '}
                  <span className="font-bold text-navy-900">{totalPages}</span> ({total} notices)
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={urlPage <= 1}
                    onClick={() => handlePageChange(urlPage - 1)}
                    leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={urlPage >= totalPages}
                    onClick={() => handlePageChange(urlPage + 1)}
                    rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
