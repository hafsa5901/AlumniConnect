import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  mentorshipService,
  MentorUser,
  MentorshipRequestItem,
  MentorshipStatus,
} from '../../services/mentorship';
import { Navbar, Footer, PageHeader } from '../../components/layout';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Textarea';
import { VerifiedBadge } from '../../components/ui/VerifiedBadge';
import { EmptyState } from '../../components/feedback/EmptyState';
import { CardSkeleton } from '../../components/feedback/Skeleton';
import { MentorshipRequestModal } from './MentorshipRequestModal';
import {
  Users,
  Search,
  MessageSquare,
  Calendar,
  Building2,
  MapPin,
  Sparkles,
  CheckCircle2,
  Clock,
  Check,
  X,
  FileText,
  Lightbulb,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function MentorshipPage() {
  const { user } = useAuth();
  const isStudent = user?.role === 'student';
  const isAlumni = user?.role === 'alumni';

  const [activeTab, setActiveTab] = useState<'find' | 'requests' | 'active'>('find');

  // Find Mentors state
  const [mentors, setMentors] = useState<MentorUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [department, setDepartment] = useState('');
  const [company, setCompany] = useState('');
  const [skills, setSkills] = useState('');
  const [isMentorsLoading, setIsMentorsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMentors, setTotalMentors] = useState(0);

  // My Requests state
  const [requests, setRequests] = useState<MentorshipRequestItem[]>([]);
  const [isRequestsLoading, setIsRequestsLoading] = useState(false);

  // Modals state
  const [selectedMentorForRequest, setSelectedMentorForRequest] = useState<MentorUser | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  // Status update modal for mentor
  const [requestToUpdate, setRequestToUpdate] = useState<MentorshipRequestItem | null>(null);
  const [targetStatus, setTargetStatus] = useState<MentorshipStatus>('accepted');
  const [mentorNotes, setMentorNotes] = useState('');
  const [scheduledDateInput, setScheduledDateInput] = useState('');
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Fetch mentors
  const fetchMentors = useCallback(async () => {
    setIsMentorsLoading(true);
    try {
      const res = await mentorshipService.listMentors({
        search: searchTerm || undefined,
        department: department || undefined,
        company: company || undefined,
        skills: skills || undefined,
        page,
        limit: 12,
      });

      setMentors(res.data.data.mentors || []);
      setTotalMentors(res.data.data.pagination.total);
      setTotalPages(res.data.data.pagination.totalPages);
    } catch (err) {
      console.error('Failed to load mentors:', err);
      toast.error('Failed to load mentors list.');
    } finally {
      setIsMentorsLoading(false);
    }
  }, [searchTerm, department, company, skills, page]);

  // Fetch requests
  const fetchRequests = useCallback(async () => {
    setIsRequestsLoading(true);
    try {
      const res = await mentorshipService.getMyRequests();
      setRequests(res.data.data.requests || []);
    } catch (err) {
      console.error('Failed to load mentorship requests:', err);
      toast.error('Failed to load mentorship requests.');
    } finally {
      setIsRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'find') {
      fetchMentors();
    } else {
      fetchRequests();
    }
  }, [activeTab, fetchMentors, fetchRequests]);

  const handleOpenStatusModal = (
    reqItem: MentorshipRequestItem,
    status: MentorshipStatus
  ) => {
    setRequestToUpdate(reqItem);
    setTargetStatus(status);
    setMentorNotes('');
    setScheduledDateInput(
      reqItem.scheduledDate
        ? new Date(reqItem.scheduledDate).toISOString().split('T')[0]
        : ''
    );
    setIsStatusModalOpen(true);
  };

  const handleUpdateStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestToUpdate) return;
    setIsUpdatingStatus(true);
    try {
      await mentorshipService.updateRequestStatus(requestToUpdate.id, {
        status: targetStatus,
        notes: mentorNotes.trim() || undefined,
        scheduledDate: scheduledDateInput ? new Date(scheduledDateInput).toISOString() : undefined,
      });

      toast.success(
        targetStatus === 'accepted'
          ? 'Mentorship request accepted!'
          : targetStatus === 'rejected'
          ? 'Mentorship request declined.'
          : 'Mentorship marked as completed.'
      );
      setIsStatusModalOpen(false);
      fetchRequests();
      if (activeTab === 'find') fetchMentors();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to update request.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const activeMentorships = requests.filter((r) => r.status === 'accepted');

  const formatStatusBadge = (status: MentorshipStatus) => {
    switch (status) {
      case 'pending':
        return <Badge variant="yellow">Pending Review</Badge>;
      case 'accepted':
        return <Badge variant="green">Active Mentorship</Badge>;
      case 'rejected':
        return <Badge variant="red">Declined</Badge>;
      case 'completed':
        return <Badge variant="navy">Completed</Badge>;
      default:
        return <Badge variant="gray">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <Navbar />

      <PageHeader
        title="Mentorship Network"
        subtitle="Connect with verified alumni leaders for 1-on-1 career guidance, mock interviews, and industry insights."
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200/80 shadow-sm w-fit">
          <button
            onClick={() => setActiveTab('find')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'find'
                ? 'bg-navy-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Find a Mentor
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'requests'
                ? 'bg-navy-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {isAlumni ? 'Mentorship Inquiries' : 'My Requests'}
            {requests.filter((r) => r.status === 'pending').length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-800 rounded-full font-bold">
                {requests.filter((r) => r.status === 'pending').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'active'
                ? 'bg-navy-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Active Connections
            {activeMentorships.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-emerald-100 text-emerald-800 rounded-full font-bold">
                {activeMentorships.length}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: FIND A MENTOR */}
        {activeTab === 'find' && (
          <div className="space-y-6">
            {/* Search & Filter Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Input
                placeholder="Search by mentor name or role..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                leftIcon={<Search className="w-4 h-4 text-slate-400" />}
              />
              <Input
                placeholder="Filter by company (e.g. Google)..."
                value={company}
                onChange={(e) => {
                  setCompany(e.target.value);
                  setPage(1);
                }}
                leftIcon={<Building2 className="w-4 h-4 text-slate-400" />}
              />
              <Input
                placeholder="Filter by skill (e.g. React)..."
                value={skills}
                onChange={(e) => {
                  setSkills(e.target.value);
                  setPage(1);
                }}
                leftIcon={<Sparkles className="w-4 h-4 text-slate-400" />}
              />
              <Select
                value={department}
                onChange={(e) => {
                  setDepartment(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: 'All Departments', value: '' },
                  { label: 'Computer Science', value: 'Computer Science' },
                  { label: 'Information Technology', value: 'Information Technology' },
                  { label: 'Electrical Engineering', value: 'Electrical Engineering' },
                  { label: 'Mechanical Engineering', value: 'Mechanical Engineering' },
                  { label: 'Civil Engineering', value: 'Civil Engineering' },
                  { label: 'Business Administration', value: 'Business Administration' },
                ]}
              />
            </div>

            {/* Mentors Grid */}
            {isMentorsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <CardSkeleton key={i} />
                ))}
              </div>
            ) : mentors.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm">
                <EmptyState
                  icon={Users}
                  title="No Mentors Found"
                  description="There are currently no verified alumni mentors matching your search criteria. Try adjusting your filters."
                  actionLabel="Clear Filters"
                  onAction={() => {
                    setSearchTerm('');
                    setDepartment('');
                    setCompany('');
                    setSkills('');
                    setPage(1);
                  }}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {mentors.map((mentor) => (
                  <div
                    key={mentor.id || mentor._id}
                    className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between p-6 group"
                  >
                    <div className="space-y-4">
                      {/* Avatar & Verification Header */}
                      <div className="flex items-start gap-3.5">
                        <Avatar
                          src={mentor.profilePhotoUrl}
                          name={mentor.name}
                          size="lg"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 font-bold text-slate-900 text-base">
                            <Link
                              to={`/alumni/${mentor.id || mentor._id}`}
                              className="truncate hover:text-navy-900"
                            >
                              {mentor.name}
                            </Link>
                            <VerifiedBadge role="alumni" verificationStatus={mentor.verificationStatus as any} size="sm" />
                          </div>
                          {mentor.designation && (
                            <p className="text-xs text-slate-600 truncate mt-0.5">
                              {mentor.designation}
                              {mentor.company ? ` at ${mentor.company}` : ''}
                            </p>
                          )}
                          <div className="text-[11px] text-slate-400 mt-1 truncate">
                            {mentor.department} {mentor.batch ? `• Batch ${mentor.batch}` : ''}
                          </div>
                        </div>
                      </div>

                      {/* Bio snippet */}
                      {mentor.bio && (
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {mentor.bio}
                        </p>
                      )}

                      {/* Skills */}
                      {mentor.skills && mentor.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {mentor.skills.slice(0, 4).map((skill, i) => (
                            <span
                              key={i}
                              className="text-[10px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md"
                            >
                              {skill}
                            </span>
                          ))}
                          {mentor.skills.length > 4 && (
                            <span className="text-[10px] font-medium bg-slate-50 text-slate-400 px-1.5 py-0.5 rounded-md">
                              +{mentor.skills.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Footer Action */}
                    <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                      <Link
                        to={`/alumni/${mentor.id || mentor._id}`}
                        className="text-xs font-semibold text-slate-600 hover:text-navy-900"
                      >
                        View Profile
                      </Link>

                      {isStudent && (
                        mentor.requestStatus === 'pending' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                            <Clock className="w-3.5 h-3.5" />
                            Request Pending
                          </span>
                        ) : mentor.requestStatus === 'accepted' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Active Mentorship
                          </span>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setSelectedMentorForRequest(mentor);
                              setIsRequestModalOpen(true);
                            }}
                          >
                            <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                            {mentor.requestStatus === 'completed' ? 'Request Again' : 'Request Mentorship'}
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
                <div className="text-xs text-slate-500">
                  Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalMentors} total mentors)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MY REQUESTS */}
        {activeTab === 'requests' && (
          <div className="space-y-4">
            {isRequestsLoading ? (
              <div className="space-y-4">
                <CardSkeleton />
                <CardSkeleton />
              </div>
            ) : requests.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm">
                <EmptyState
                  icon={MessageSquare}
                  title={isStudent ? 'No Sent Requests' : 'No Inquiries Received'}
                  description={
                    isStudent
                      ? 'You have not sent any mentorship requests yet. Browse the "Find a Mentor" tab to connect with alumni.'
                      : 'You do not have any pending mentorship inquiries at this time.'
                  }
                  actionLabel={isStudent ? 'Find a Mentor' : undefined}
                  onAction={isStudent ? () => setActiveTab('find') : undefined}
                />
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((reqItem) => (
                  <div
                    key={reqItem.id}
                    className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={isStudent ? reqItem.mentor.profilePhotoUrl : reqItem.student.profilePhotoUrl}
                          name={isStudent ? reqItem.mentor.name : reqItem.student.name}
                          size="md"
                        />
                        <div>
                          <div className="font-bold text-slate-900 text-sm">
                            {isStudent ? (
                              <span>Mentor: <strong>{reqItem.mentor.name}</strong></span>
                            ) : (
                              <span>Student: <strong>{reqItem.student.name}</strong></span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">
                            {isStudent
                              ? `${reqItem.mentor.designation || 'Alumni'} at ${reqItem.mentor.company || 'Industry'}`
                              : `${reqItem.student.department || 'Student'} • Batch ${reqItem.student.batch || 'Current'}`}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {formatStatusBadge(reqItem.status)}
                        <span className="text-xs text-slate-400">
                          {new Date(reqItem.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Topic & Message */}
                    <div className="space-y-2">
                      <div className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                        <Lightbulb className="w-4 h-4 text-amber-500" />
                        Topic: {reqItem.topic}
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50 p-3 rounded-xl border border-slate-100">
                        {reqItem.message}
                      </p>
                    </div>

                    {/* Scheduled Date & Notes */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                      {reqItem.scheduledDate && (
                        <div className="flex items-center gap-1.5 font-medium text-slate-800">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          Proposed / Confirmed Session:{' '}
                          {new Date(reqItem.scheduledDate).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </div>
                      )}
                      {reqItem.notes && (
                        <div className="flex items-center gap-1.5 text-navy-800 bg-navy-50 px-2.5 py-1 rounded-lg">
                          <FileText className="w-3.5 h-3.5" />
                          Private Note: {reqItem.notes}
                        </div>
                      )}
                    </div>

                    {/* Mentor Actions on Pending Request */}
                    {isAlumni && reqItem.status === 'pending' && (
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenStatusModal(reqItem, 'rejected')}
                        >
                          <X className="w-3.5 h-3.5 mr-1 text-red-600" />
                          Decline
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenStatusModal(reqItem, 'accepted')}
                        >
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Accept Mentorship
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ACTIVE MENTORSHIPS */}
        {activeTab === 'active' && (
          <div className="space-y-4">
            {isRequestsLoading ? (
              <CardSkeleton />
            ) : activeMentorships.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm">
                <EmptyState
                  icon={Sparkles}
                  title="No Active Mentorships"
                  description="You do not have any currently active mentorship connections. Browse mentors to request guidance."
                  actionLabel={isStudent ? 'Find a Mentor' : undefined}
                  onAction={isStudent ? () => setActiveTab('find') : undefined}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {activeMentorships.map((conn) => (
                  <div
                    key={conn.id}
                    className="bg-white rounded-2xl border border-emerald-200/80 p-6 shadow-sm flex flex-col justify-between space-y-4 relative"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="green">Active Connection</Badge>
                        {conn.scheduledDate && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {new Date(conn.scheduledDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <Avatar
                          src={isStudent ? conn.mentor.profilePhotoUrl : conn.student.profilePhotoUrl}
                          name={isStudent ? conn.mentor.name : conn.student.name}
                          size="md"
                        />
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">
                            {isStudent ? conn.mentor.name : conn.student.name}
                          </h4>
                          <p className="text-xs text-slate-500">
                            {isStudent
                              ? `${conn.mentor.designation || 'Mentor'} at ${conn.mentor.company || 'Company'}`
                              : `${conn.student.department} (${conn.student.batch})`}
                          </p>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-700 space-y-1">
                        <div className="font-semibold text-slate-900">Topic: {conn.topic}</div>
                        <p className="line-clamp-2">{conn.message}</p>
                      </div>

                      {conn.notes && (
                        <div className="text-xs text-navy-800 bg-navy-50 p-2.5 rounded-lg">
                          <strong>Mentor Notes:</strong> {conn.notes}
                        </div>
                      )}
                    </div>

                    {isAlumni && (
                      <div className="pt-3 border-t border-slate-100 flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenStatusModal(conn, 'completed')}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-navy-800" />
                          Mark as Completed
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Student Request Modal */}
      <MentorshipRequestModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        onSuccess={() => {
          fetchMentors();
          fetchRequests();
        }}
        mentor={selectedMentorForRequest}
      />

      {/* Mentor Status Transition Modal (Accept / Decline / Complete) */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title={
          targetStatus === 'accepted'
            ? 'Accept Mentorship Request'
            : targetStatus === 'rejected'
            ? 'Decline Mentorship Request'
            : 'Mark Mentorship as Completed'
        }
        size="md"
      >
        <form onSubmit={handleUpdateStatusSubmit} className="space-y-4">
          <p className="text-sm text-slate-600">
            {targetStatus === 'accepted'
              ? `You are accepting the request from ${requestToUpdate?.student.name}. You can optionally propose a meeting date and add notes.`
              : targetStatus === 'rejected'
              ? `You are declining the request from ${requestToUpdate?.student.name}.`
              : `You are marking your mentorship session with ${requestToUpdate?.student.name} as completed.`}
          </p>

          {targetStatus === 'accepted' && (
            <Input
              label="Confirmed Session Date (Optional)"
              type="date"
              value={scheduledDateInput}
              onChange={(e) => setScheduledDateInput(e.target.value)}
              leftIcon={<Calendar className="w-4 h-4 text-slate-400" />}
            />
          )}

          <Textarea
            label="Private Mentor Notes (Optional)"
            placeholder="Private context or notes about the mentee/session..."
            value={mentorNotes}
            onChange={(e) => setMentorNotes(e.target.value)}
            rows={3}
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsStatusModalOpen(false)}
              disabled={isUpdatingStatus}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={targetStatus === 'rejected' ? 'danger' : 'primary'}
              isLoading={isUpdatingStatus}
            >
              {targetStatus === 'accepted'
                ? 'Confirm & Accept'
                : targetStatus === 'rejected'
                ? 'Decline Request'
                : 'Complete Session'}
            </Button>
          </div>
        </form>
      </Modal>

      <Footer />
    </div>
  );
}
