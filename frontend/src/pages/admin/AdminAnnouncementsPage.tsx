import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/feedback/EmptyState';
import { CardSkeleton } from '../../components/feedback/Skeleton';
import { getCategoryBadgeVariant } from '../../components/announcements/LatestAnnouncements';
import {
  Plus,
  Search,
  Filter,
  Edit3,
  Trash2,
  CheckCircle,
  EyeOff,
  Calendar,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminAnnouncementsPage() {
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published'>('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  // Delete modal state
  const [itemToDelete, setItemToDelete] = useState<AnnouncementItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Status toggle pending state
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchAnnouncements = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await announcementsService.getManageAnnouncements({
        status: statusFilter,
        category: categoryFilter || undefined,
        q: searchQuery.trim() || undefined,
        page,
        limit: 10,
      });

      setAnnouncements(res.data.data.announcements || []);
      setTotal(res.data.data.total);
      setTotalPages(res.data.data.totalPages);
    } catch (err) {
      console.error('Failed to load announcements:', err);
      toast.error('Failed to load announcements.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, categoryFilter, searchQuery, page]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleTogglePublish = async (item: AnnouncementItem) => {
    const id = item.id || item._id;
    if (!id || togglingId) return;

    setTogglingId(id);
    const nextPublished = !item.published;

    try {
      await announcementsService.updateAnnouncement(id, {
        published: nextPublished,
      });

      toast.success(
        nextPublished
          ? 'Announcement published successfully.'
          : 'Announcement unpublished and reverted to draft.'
      );

      setAnnouncements((prev) =>
        prev.map((a) =>
          (a.id || a._id) === id
            ? { ...a, published: nextPublished, publishedAt: nextPublished ? new Date().toISOString() : a.publishedAt }
            : a
        )
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to update publication status.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    const id = itemToDelete.id || itemToDelete._id;
    if (!id) return;

    setIsDeleting(true);
    try {
      await announcementsService.deleteAnnouncement(id);
      toast.success('Announcement deleted successfully.');
      setItemToDelete(null);
      fetchAnnouncements();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to delete announcement.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />

      <PageHeader
        title="Manage Announcements"
        subtitle="Create, edit, publish, or remove official institutional campus notices."
        actions={
          <Link to="/admin/announcements/new">
            <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />}>
              Create Notice
            </Button>
          </Link>
        }
      />

      <main className="flex-1 container-app px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Filters Bar */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Input
                placeholder="Search notices by title, summary, or keyword..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                leftIcon={<Search className="w-4 h-4 text-slate-400" />}
                aria-label="Search notices"
              />
            </div>

            <div>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs font-semibold px-3 py-2.5 border border-slate-300 rounded-xl bg-white text-navy-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                aria-label="Filter by category"
              >
                <option value="">All Categories</option>
                {ANNOUNCEMENT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-2 border-t border-slate-100 pt-3 text-xs">
            <span className="text-slate-400 font-semibold mr-1">Status:</span>
            {(['all', 'published', 'draft'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-full font-semibold transition-colors capitalize ${
                  statusFilter === st
                    ? 'bg-navy-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Notices Management Table / List */}
        {isLoading ? (
          <div className="space-y-3">
            <CardSkeleton count={4} />
          </div>
        ) : announcements.length === 0 ? (
          <EmptyState
            title="No announcements found"
            description="No announcements match your current filter settings."
            actionLabel="Create Notice"
            onAction={() => navigate('/admin/announcements/new')}
          />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4 sm:px-6">Notice</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Published Date</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {announcements.map((item) => {
                    const id = item.id || item._id;
                    const isToggling = togglingId === id;

                    return (
                      <tr key={id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-4 px-4 sm:px-6 max-w-sm">
                          <div className="font-bold text-navy-900 text-sm line-clamp-1">
                            {item.title}
                          </div>
                          <div className="text-slate-500 line-clamp-1 text-[11px] mt-0.5">
                            {item.summary}
                          </div>
                        </td>

                        <td className="py-4 px-4 whitespace-nowrap">
                          <Badge variant={getCategoryBadgeVariant(item.category)} size="sm">
                            {item.category}
                          </Badge>
                        </td>

                        <td className="py-4 px-4 whitespace-nowrap">
                          {item.published ? (
                            <Badge variant="green" size="sm">
                              Published
                            </Badge>
                          ) : (
                            <Badge variant="yellow" size="sm">
                              Draft
                            </Badge>
                          )}
                        </td>

                        <td className="py-4 px-4 whitespace-nowrap text-slate-500">
                          {item.publishedAt ? (
                            <div className="flex items-center gap-1 text-[11px]">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <time dateTime={item.publishedAt}>
                                {new Date(item.publishedAt).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </time>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">Unpublished</span>
                          )}
                        </td>

                        <td className="py-4 px-4 sm:px-6 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View Live */}
                            <Link to={`/announcements/${id}`} target="_blank" rel="noreferrer">
                              <Button
                                variant="ghost"
                                size="sm"
                                title="View details"
                                aria-label={`View announcement ${item.title}`}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                            </Link>

                            {/* Toggle Publish */}
                            <Button
                              variant="outline"
                              size="sm"
                              isLoading={isToggling}
                              onClick={() => handleTogglePublish(item)}
                              title={item.published ? 'Unpublish notice' : 'Publish notice'}
                            >
                              {item.published ? (
                                <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                              ) : (
                                <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                              )}
                            </Button>

                            {/* Edit */}
                            <Link to={`/admin/announcements/${id}/edit`}>
                              <Button
                                variant="outline"
                                size="sm"
                                title="Edit notice"
                                aria-label={`Edit announcement ${item.title}`}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </Button>
                            </Link>

                            {/* Delete */}
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => setItemToDelete(item)}
                              title="Delete notice"
                              aria-label={`Delete announcement ${item.title}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <div>
                  Showing Page <span className="font-bold text-navy-900">{page}</span> of{' '}
                  <span className="font-bold text-navy-900">{totalPages}</span> ({total} notices)
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={Boolean(itemToDelete)}
          onClose={() => !isDeleting && setItemToDelete(null)}
          title="Delete Announcement"
          description="Are you sure you want to permanently delete this campus notice? This action cannot be undone."
          size="sm"
        >
          <div className="space-y-4 pt-2">
            <div className="p-3 bg-red-50 rounded-xl border border-red-200/80 flex items-start gap-2.5 text-xs text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <div>
                <span className="font-bold">Target notice:</span>{' '}
                <span className="font-medium italic">"{itemToDelete?.title}"</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isDeleting}
                onClick={() => setItemToDelete(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={isDeleting}
                onClick={handleDeleteConfirm}
              >
                Delete Notice Permanently
              </Button>
            </div>
          </div>
        </Modal>
      </main>

      <Footer />
    </div>
  );
}
