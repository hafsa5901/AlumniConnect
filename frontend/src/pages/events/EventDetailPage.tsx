import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { eventsService, EventItem, EventAttendee } from '../../services/events';
import { Navbar, Footer, PageHeader } from '../../components/layout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { VerifiedBadge } from '../../components/ui/VerifiedBadge';
import { ErrorState } from '../../components/feedback/ErrorState';
import { Skeleton } from '../../components/feedback/Skeleton';
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  Users,
  ExternalLink,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Building2,
  ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isRsvpLoading, setIsRsvpLoading] = useState(false);

  const fetchEvent = async () => {
    if (!id) {
      setHasError(true);
      setIsLoading(false);
      return;
    }

    try {
      const res = await eventsService.getEventById(id);
      setEvent(res.data.data.event);

      // If viewer is organizer or admin, fetch attendee roster
      const isOrganizer =
        user?._id && res.data.data.event.organizer?._id === user._id;
      const isAdmin = user?.role === 'admin';

      if (isOrganizer || isAdmin) {
        try {
          const attRes = await eventsService.getEventAttendees(id);
          setAttendees(attRes.data.data.attendees || []);
        } catch {
          // Ignored if not authorized
        }
      }
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvent();
  }, [id, user]);

  const handleRsvp = async () => {
    if (!id) return;
    setIsRsvpLoading(true);
    try {
      await eventsService.rsvpEvent(id);
      toast.success('RSVP confirmed!');
      await fetchEvent();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to RSVP.');
    } finally {
      setIsRsvpLoading(false);
    }
  };

  const handleCancelRsvp = async () => {
    if (!id) return;
    setIsRsvpLoading(true);
    try {
      await eventsService.cancelRsvp(id);
      toast.success('RSVP cancelled.');
      await fetchEvent();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to cancel RSVP.');
    } finally {
      setIsRsvpLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="flex-1 container-app px-4 sm:px-6 lg:px-8 py-10 space-y-6 max-w-4xl mx-auto">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full rounded-card" />
          <Skeleton className="h-48 w-full rounded-card" />
        </main>
        <Footer />
      </div>
    );
  }

  if (hasError || !event) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="flex-1 container-app px-4 sm:px-6 lg:px-8 py-16 flex items-center justify-center">
          <ErrorState
            type="generic"
            title="Event Not Found"
            message="This event either does not exist, is awaiting moderation, or has been removed."
            onRetry={() => window.history.back()}
          />
        </main>
        <Footer />
      </div>
    );
  }

  const isEnded = new Date(event.endDate) < new Date();
  const isAttending = event.userRsvpStatus === 'attending';
  const isFull = event.capacity !== null && event.spotsRemaining === 0;
  const isOrganizer = user?._id && event.organizer?._id === user._id;
  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 container-app px-4 sm:px-6 lg:px-8 py-10 space-y-8 max-w-4xl mx-auto">
        {/* Back Link */}
        <div>
          <Link
            to="/events"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-navy-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Events Calendar</span>
          </Link>
        </div>

        {/* Hero Event Card */}
        <Card className="p-6 sm:p-8 border-slate-200 shadow-card space-y-6">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    event.category === 'webinar'
                      ? 'blue'
                      : event.category === 'workshop'
                      ? 'navy'
                      : event.category === 'career'
                      ? 'green'
                      : 'yellow'
                  }
                  size="md"
                >
                  {event.category}
                </Badge>
                {event.approvalStatus === 'pending' && (
                  <Badge variant="yellow" size="md">
                    Pending Admin Review
                  </Badge>
                )}
                {event.approvalStatus === 'rejected' && (
                  <Badge variant="red" size="md">
                    Rejected
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                {event.locationType === 'virtual' ? (
                  <>
                    <Video className="w-4 h-4 text-blue-600" />
                    <span>Virtual Session</span>
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4 text-slate-600" />
                    <span>In-Person Gathering</span>
                  </>
                )}
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight leading-tight">
              {event.title}
            </h1>

            {/* Date, Time & Venue Bar */}
            <div className="grid sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-700 font-semibold">
                  <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    {new Date(event.startDate).toLocaleDateString(undefined, {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-500">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>
                    {new Date(event.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                    {new Date(event.endDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              <div className="space-y-1 sm:border-l sm:border-slate-200 sm:pl-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {event.locationType === 'virtual' ? 'Meeting Link' : 'Location Venue'}
                </span>
                {event.locationType === 'virtual' ? (
                  <a
                    href={event.venueOrLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 font-mono text-blue-600 hover:underline break-all"
                  >
                    <span>{event.venueOrLink}</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                ) : (
                  <p className="font-semibold text-navy-900 leading-snug">{event.venueOrLink}</p>
                )}
              </div>
            </div>
          </div>

          {/* RSVP Status / Actions Bar */}
          <div className="p-4 bg-blue-50/40 rounded-xl border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-navy-900">
                <Users className="w-4 h-4 text-blue-600" />
                <span>{event.attendingCount} Attending</span>
                {event.capacity !== null && (
                  <span className="text-slate-500 font-normal">
                    (Capacity: {event.capacity} • {event.spotsRemaining} spots left)
                  </span>
                )}
              </div>
              {isAttending && (
                <div className="flex items-center gap-1 text-[11px] font-bold text-green-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                  <span>You are confirmed for this event!</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {isEnded ? (
                <span className="text-xs font-bold text-slate-500 bg-slate-200 px-3 py-1.5 rounded-btn">
                  Event Has Ended
                </span>
              ) : isAttending ? (
                <Button
                  variant="outline"
                  size="md"
                  className="text-red-600 hover:bg-red-50 hover:border-red-300"
                  isLoading={isRsvpLoading}
                  onClick={handleCancelRsvp}
                >
                  Cancel RSVP
                </Button>
              ) : isFull ? (
                <Button variant="outline" size="md" disabled>
                  Event Full (Waitlist)
                </Button>
              ) : (
                <Button variant="primary" size="md" isLoading={isRsvpLoading} onClick={handleRsvp}>
                  Confirm RSVP
                </Button>
              )}
            </div>
          </div>

          {/* Event Organizer Card */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <Avatar
                name={event.organizer?.name || 'Organizer'}
                src={event.organizer?.profilePhotoUrl}
                size="md"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-navy-900">{event.organizer?.name}</h4>
                  <VerifiedBadge
                    role={event.organizer?.role as any}
                    verificationStatus="admin_approved"
                    size="sm"
                  />
                </div>
                <div className="text-xs text-slate-500">
                  {event.organizer?.designation || 'Event Host'}
                  {event.organizer?.company && <span> @ {event.organizer.company}</span>}
                </div>
              </div>
            </div>

            {event.organizer?._id && (
              <Link to={`/alumni/${event.organizer._id}`}>
                <Button variant="ghost" size="sm">
                  View Host Profile
                </Button>
              </Link>
            )}
          </div>
        </Card>

        {/* Description / Agenda Card */}
        <Card className="p-6 sm:p-8 border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
            About This Session
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
            {event.description}
          </p>
        </Card>

        {/* Attendee Roster Section (Organizer / Admin only) */}
        {(isOrganizer || isAdmin) && (
          <Card className="p-6 sm:p-8 border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-navy-900" />
                <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
                  Confirmed Attendee Roster ({attendees.length})
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">Organizer & Admin View</span>
            </div>

            {attendees.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                No members have RSVPed yet.
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3 pt-2">
                {attendees.map((att, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3"
                  >
                    <Avatar
                      name={att.user?.name || 'User'}
                      src={att.user?.profilePhotoUrl}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-navy-900 truncate">
                        {att.user?.name}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate capitalize">
                        {att.user?.role} • {att.user?.department || 'Member'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </main>

      <Footer />
    </div>
  );
}
