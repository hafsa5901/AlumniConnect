import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { eventsService, EventItem, EventCategory } from '../../services/events';
import { Navbar, Footer, PageHeader } from '../../components/layout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { VerifiedBadge } from '../../components/ui/VerifiedBadge';
import { EmptyState } from '../../components/feedback/EmptyState';
import { CardSkeleton } from '../../components/feedback/Skeleton';
import { EventFormModal } from './EventFormModal';
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  Users,
  Search,
  Plus,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function EventsPage() {
  const { user } = useAuth();

  const [timeframe, setTimeframe] = useState<'upcoming' | 'past'>('upcoming');
  const [mineOnly, setMineOnly] = useState(false);
  const [category, setCategory] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [rsvpLoadingId, setRsvpLoadingId] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await eventsService.listEvents({
        timeframe,
        category: category || undefined,
        search: searchTerm || undefined,
        mine: mineOnly || undefined,
        page,
        limit: 12,
      });
      setEvents(res.data.data.events || []);
      setTotal(res.data.data.pagination.total);
      setTotalPages(res.data.data.pagination.totalPages);
    } catch (err) {
      console.error('Failed to load events:', err);
      toast.error('Failed to load events.');
    } finally {
      setIsLoading(false);
    }
  }, [timeframe, category, searchTerm, mineOnly, page]);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchEvents();
    }, 300);
    return () => clearTimeout(handler);
  }, [fetchEvents]);

  const handleRsvp = async (e: React.MouseEvent, eventId: string) => {
    e.preventDefault();
    e.stopPropagation();

    setRsvpLoadingId(eventId);
    try {
      await eventsService.rsvpEvent(eventId);
      toast.success('RSVP confirmed!');
      fetchEvents();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to RSVP.');
    } finally {
      setRsvpLoadingId(null);
    }
  };

  const handleCancelRsvp = async (e: React.MouseEvent, eventId: string) => {
    e.preventDefault();
    e.stopPropagation();

    setRsvpLoadingId(eventId);
    try {
      await eventsService.cancelRsvp(eventId);
      toast.success('RSVP cancelled.');
      fetchEvents();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to cancel RSVP.');
    } finally {
      setRsvpLoadingId(null);
    }
  };

  const canCreateEvent = user?.role === 'admin' || user?.role === 'alumni';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 container-app px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <PageHeader
          title="Campus & Alumni Events"
          subtitle="Join interactive webinars, alumni reunions, technical workshops, and career panels."
          actions={
            canCreateEvent && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCreateModalOpen(true)}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Host an Event
              </Button>
            )
          }
        />

        {/* Timeframe Tabs & Search / Filter Controls */}
        <div className="bg-white p-4 sm:p-6 rounded-card border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Timeframe Tabs */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setTimeframe('upcoming');
                  setMineOnly(false);
                  setPage(1);
                }}
                className={`px-4 py-2 rounded-btn text-xs font-bold transition-colors ${
                  timeframe === 'upcoming' && !mineOnly
                    ? 'bg-navy-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Upcoming Events
              </button>
              <button
                type="button"
                onClick={() => {
                  setTimeframe('past');
                  setMineOnly(false);
                  setPage(1);
                }}
                className={`px-4 py-2 rounded-btn text-xs font-bold transition-colors ${
                  timeframe === 'past' && !mineOnly
                    ? 'bg-navy-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Past Events
              </button>
              {canCreateEvent && (
                <button
                  type="button"
                  onClick={() => {
                    setMineOnly(true);
                    setPage(1);
                  }}
                  className={`px-4 py-2 rounded-btn text-xs font-bold transition-colors ${
                    mineOnly
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  My Hosted Events
                </button>
              )}
            </div>

            {/* Search Input */}
            <div className="w-full sm:w-72">
              <Input
                id="searchEvents"
                placeholder="Search events by title, topic..."
                leftIcon={<Search className="w-4 h-4 text-slate-400" />}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-400 font-semibold mr-1">Category:</span>
            {[
              { label: 'All', value: '' },
              { label: 'Webinars', value: 'webinar' },
              { label: 'Workshops', value: 'workshop' },
              { label: 'Career Panels', value: 'career' },
              { label: 'Networking', value: 'networking' },
              { label: 'Reunions', value: 'reunion' },
            ].map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => {
                  setCategory(cat.value);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  category === cat.value
                    ? 'bg-blue-100 text-blue-800 font-bold'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Events Grid */}
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <CardSkeleton count={6} />
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            type="events"
            title="No events found"
            description={
              mineOnly
                ? "You haven't hosted any events yet. Click 'Host an Event' to organize a session."
                : timeframe === 'upcoming'
                ? 'There are no upcoming events scheduled in this category.'
                : 'No past events found in this category.'
            }
            actionLabel={canCreateEvent ? 'Host an Event' : undefined}
            onAction={canCreateEvent ? () => setIsCreateModalOpen(true) : undefined}
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((evt) => {
              const isEnded = new Date(evt.endDate) < new Date();
              const isAttending = evt.userRsvpStatus === 'attending';
              const isFull = evt.capacity !== null && evt.spotsRemaining === 0;

              return (
                <Card
                  key={evt.id}
                  hoverable
                  className="flex flex-col justify-between border-slate-200 shadow-xs overflow-hidden"
                >
                  <div className="space-y-4 p-5">
                    {/* Header: Category Badge & Location Type */}
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant={
                          evt.category === 'webinar'
                            ? 'blue'
                            : evt.category === 'workshop'
                            ? 'navy'
                            : evt.category === 'career'
                            ? 'green'
                            : 'yellow'
                        }
                        size="sm"
                      >
                        {evt.category}
                      </Badge>

                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                        {evt.locationType === 'virtual' ? (
                          <>
                            <Video className="w-3.5 h-3.5 text-blue-600" />
                            <span>Virtual</span>
                          </>
                        ) : (
                          <>
                            <MapPin className="w-3.5 h-3.5 text-slate-500" />
                            <span>In-Person</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Title & Description */}
                    <div>
                      <Link to={`/events/${evt.id}`}>
                        <h3 className="text-base font-bold text-navy-900 leading-snug hover:text-blue-600 transition-colors">
                          {evt.title}
                        </h3>
                      </Link>
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                        {evt.description}
                      </p>
                    </div>

                    {/* Date & Time */}
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 space-y-1 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold text-navy-900">
                          {new Date(evt.startDate).toLocaleDateString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          {new Date(evt.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                          {new Date(evt.endDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {/* Organizer Card */}
                    <div className="flex items-center gap-2.5 pt-1">
                      <Avatar
                        name={evt.organizer?.name || 'Organizer'}
                        src={evt.organizer?.profilePhotoUrl}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-navy-900 truncate">
                          {evt.organizer?.name}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {evt.organizer?.designation || evt.organizer?.role || 'Host'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions: Attendance & RSVP Button */}
                  <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 text-slate-600">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-semibold">{evt.attendingCount} attending</span>
                      {evt.capacity !== null && (
                        <span className="text-[11px] text-slate-400">
                          ({evt.spotsRemaining} left)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Link to={`/events/${evt.id}`}>
                        <Button variant="ghost" size="sm">
                          Details
                        </Button>
                      </Link>

                      {isEnded ? (
                        <span className="text-[11px] text-slate-400 font-semibold px-2 py-1 bg-slate-200 rounded">
                          Ended
                        </span>
                      ) : isAttending ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:bg-red-50 hover:border-red-300"
                          isLoading={rsvpLoadingId === evt.id}
                          onClick={(e) => handleCancelRsvp(e, evt.id)}
                        >
                          Cancel RSVP
                        </Button>
                      ) : isFull ? (
                        <span className="text-[11px] text-amber-700 font-bold bg-amber-50 px-2 py-1 rounded border border-amber-200">
                          Full
                        </span>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          isLoading={rsvpLoadingId === evt.id}
                          onClick={(e) => handleRsvp(e, evt.id)}
                        >
                          RSVP
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 text-xs text-slate-500">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Host Event Modal */}
        <EventFormModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={fetchEvents}
          userRole={user?.role}
        />
      </main>

      <Footer />
    </div>
  );
}
