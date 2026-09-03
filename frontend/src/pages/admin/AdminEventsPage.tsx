import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { eventsService, EventItem } from '../../services/events';
import { Navbar, Footer, Sidebar, PageHeader } from '../../components/layout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Textarea';
import { EmptyState } from '../../components/feedback/EmptyState';
import { CardSkeleton } from '../../components/feedback/Skeleton';
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  Check,
  X,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rejectingEvent, setRejectingEvent] = useState<EventItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchPendingEvents = async () => {
    setIsLoading(true);
    try {
      const res = await eventsService.listEvents({
        status: 'pending',
        limit: 50,
      });
      setEvents(res.data.data.events || []);
    } catch (err) {
      toast.error('Failed to load pending event approvals.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingEvents();
  }, []);

  const handleApprove = async (eventId: string) => {
    try {
      await eventsService.approveEvent(eventId);
      toast.success('Event approved and published to the campus calendar.');
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to approve event.');
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectingEvent) return;
    setIsProcessing(true);
    try {
      await eventsService.rejectEvent(rejectingEvent.id, rejectReason.trim());
      toast.success('Event submission rejected.');
      setEvents((prev) => prev.filter((e) => e.id !== rejectingEvent.id));
      setRejectingEvent(null);
      setRejectReason('');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to reject event.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <div className="flex-1 flex container-app px-4 sm:px-6 lg:px-8 py-8 gap-8">
        <Sidebar className="hidden md:flex rounded-card shadow-xs" />

        <main className="flex-1 space-y-6 min-w-0">
          <PageHeader
            title="Event Approvals Queue"
            subtitle="Review alumni-submitted webinars, technical workshops, and networking sessions before publication."
          />

          {isLoading ? (
            <div className="grid gap-4">
              <CardSkeleton count={3} />
            </div>
          ) : events.length === 0 ? (
            <Card className="p-12 border-slate-200 shadow-xs">
              <EmptyState
                type="generic"
                title="No Pending Event Approvals"
                description="The event moderation queue is completely clear. All submitted events have been reviewed."
              />
            </Card>
          ) : (
            <div className="space-y-4">
              {events.map((evt) => (
                <Card key={evt.id} className="p-6 border-slate-200 shadow-card space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="blue" size="sm">
                          {evt.category}
                        </Badge>
                        <Badge variant="yellow" size="sm">
                          Pending Approval
                        </Badge>
                      </div>

                      <h3 className="text-lg font-bold text-navy-900">{evt.title}</h3>
                      <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                        {evt.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {new Date(evt.startDate).toLocaleDateString()} (
                          {new Date(evt.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                        </span>
                        <span className="flex items-center gap-1 font-mono">
                          {evt.locationType === 'virtual' ? (
                            <>
                              <Video className="w-3.5 h-3.5 text-blue-600" />
                              <span className="truncate max-w-xs">{evt.venueOrLink}</span>
                            </>
                          ) : (
                            <>
                              <MapPin className="w-3.5 h-3.5 text-slate-500" />
                              <span>{evt.venueOrLink}</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Organizer Card */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 sm:w-64 shrink-0 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Organizer
                      </span>
                      <div className="flex items-center gap-2.5">
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
                            {evt.organizer?.department || evt.organizer?.role}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 hover:border-red-300"
                      leftIcon={<X className="w-4 h-4" />}
                      onClick={() => setRejectingEvent(evt)}
                    >
                      Reject Submission
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<Check className="w-4 h-4" />}
                      onClick={() => handleApprove(evt.id)}
                    >
                      Approve & Publish
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Reject Reason Modal */}
      <Modal
        isOpen={Boolean(rejectingEvent)}
        onClose={() => {
          setRejectingEvent(null);
          setRejectReason('');
        }}
        title={`Reject Event: ${rejectingEvent?.title}`}
        description="Provide a reason explaining why this event cannot be published to the campus calendar."
      >
        <div className="space-y-4">
          <Textarea
            id="eventRejectReason"
            label="Rejection Reason"
            placeholder="e.g. Session topic is duplicate of an official department seminar scheduled for next week..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
          />

          <div className="flex justify-end gap-2.5 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRejectingEvent(null);
                setRejectReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isProcessing}
              onClick={handleRejectSubmit}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>

      <Footer />
    </div>
  );
}
