import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { referralsService } from '../../services/referralsService';
import { ReferralRequestItem, ReferralStatus } from '../../types';
import { Navbar, Footer, PageHeader } from '../../components/layout';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Textarea';
import { CardSkeleton } from '../../components/feedback/Skeleton';
import { EmptyState } from '../../components/feedback/EmptyState';
import {
  Briefcase,
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Download,
  Send,
  AlertCircle,
  Filter,
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  Ban,
  Check,
  X,
  MessageSquare,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ReferralsManagerPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isAlumni = user?.role === 'alumni';

  const [activeTab, setActiveTab] = useState<'my_requests' | 'received'>(
    isAlumni || isAdmin ? 'received' : 'my_requests'
  );

  const [myRequests, setMyRequests] = useState<ReferralRequestItem[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<ReferralRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal states for Accept / Decline
  const [selectedRequest, setSelectedRequest] = useState<ReferralRequestItem | null>(null);
  const [actionType, setActionType] = useState<'accept' | 'reject' | 'withdraw' | null>(null);
  const [responseNote, setResponseNote] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [downloadingResumeId, setDownloadingResumeId] = useState<string | null>(null);

  const fetchMyRequests = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await referralsService.getMyRequests({
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setMyRequests(res.data.data?.items || []);
    } catch (err: any) {
      toast.error('Failed to load your submitted referral requests.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  const fetchReceivedRequests = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await referralsService.getReceivedRequests({
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setReceivedRequests(res.data.data?.items || []);
    } catch (err: any) {
      toast.error('Failed to load received referral requests.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (activeTab === 'my_requests') {
      fetchMyRequests();
    } else {
      fetchReceivedRequests();
    }
  }, [activeTab, fetchMyRequests, fetchReceivedRequests]);

  const handleDownloadResume = async (referralId: string, applicantName?: string) => {
    try {
      setDownloadingResumeId(referralId);
      const res = await referralsService.downloadReferralResume(referralId);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = (applicantName || 'applicant').replace(/[^a-zA-Z0-9_-]/g, '_');
      link.setAttribute('download', `${safeName}_resume.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error('Could not download candidate resume.');
    } finally {
      setDownloadingResumeId(null);
    }
  };

  const handleConfirmAction = async () => {
    if (!selectedRequest || !actionType) return;
    try {
      setIsSubmittingAction(true);
      if (actionType === 'withdraw') {
        await referralsService.withdrawReferral(selectedRequest._id);
        toast.success('Referral request withdrawn.');
      } else {
        await referralsService.updateStatus(selectedRequest._id, {
          status: actionType === 'accept' ? 'accepted' : 'rejected',
          responseNote: responseNote.trim() || undefined,
        });
        toast.success(
          actionType === 'accept'
            ? 'Referral request accepted! Candidate has been notified.'
            : 'Referral request declined.'
        );
      }
      setSelectedRequest(null);
      setActionType(null);
      setResponseNote('');

      if (activeTab === 'my_requests') {
        fetchMyRequests();
      } else {
        fetchReceivedRequests();
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to update referral request.';
      toast.error(msg);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const renderStatusBadge = (status: ReferralStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            Pending Review
          </span>
        );
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            Referral Accepted
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80">
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
            Declined
          </span>
        );
      case 'withdrawn':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200/80">
            <Ban className="w-3.5 h-3.5 text-slate-400" />
            Withdrawn
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <PageHeader
        title="Job Referrals"
        subtitle="Manage incoming and submitted referral requests for platform job opportunities."
        actions={
          <div className="flex items-center gap-3">
            <Link to="/jobs">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Explore Jobs
              </Button>
            </Link>
          </div>
        }
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Navigation Tabs & Status Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2">
            {(isAlumni || isAdmin) && (
              <button
                type="button"
                onClick={() => setActiveTab('received')}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === 'received'
                    ? 'bg-navy-800 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Received Requests
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('my_requests')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'my_requests'
                  ? 'bg-navy-800 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              My Submitted Requests
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 font-medium text-slate-700 focus:ring-2 focus:ring-navy-500 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Declined</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>
        </div>

        {/* Content List */}
        {isLoading ? (
          <div className="space-y-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : activeTab === 'received' ? (
          /* Received Requests List */
          receivedRequests.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No Received Referral Requests"
              description="When students or alumni request a referral for your posted jobs, they will appear here."
            />
          ) : (
            <div className="space-y-4">
              {receivedRequests.map((req) => (
                <div
                  key={req._id}
                  className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm hover:border-slate-300 transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    {/* Left: Applicant & Job Info */}
                    <div className="flex items-start gap-3.5 min-w-0">
                      <Avatar
                        src={req.applicant?.profilePhotoUrl}
                        name={req.applicant?.name || 'Applicant'}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">
                            {req.applicant?.name}
                          </span>
                          <span className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full capitalize">
                            {req.applicant?.role}
                          </span>
                          {req.applicant?.department && (
                            <span className="text-xs text-slate-500">
                              • {req.applicant.department} {req.applicant.batch ? `(${req.applicant.batch})` : ''}
                            </span>
                          )}
                        </div>

                        {/* Job Reference */}
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            Applied for{' '}
                            <strong>{req.job?.title || 'Job Listing (Deleted)'}</strong>
                            {req.job?.company ? ` at ${req.job.company}` : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Status & Date */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1.5 shrink-0">
                      {renderStatusBadge(req.status)}
                      <span className="text-[11px] text-slate-400">
                        {new Date(req.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Candidate Pitch / Message */}
                  <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 text-xs text-slate-700 leading-relaxed">
                    <div className="font-semibold text-slate-900 mb-1 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                      Candidate Pitch:
                    </div>
                    <p className="whitespace-pre-line">{req.message}</p>
                  </div>

                  {/* Poster's Prior Response Note (if resolved) */}
                  {req.responseNote && (
                    <div className="bg-navy-50/60 border border-navy-100 rounded-xl p-3.5 text-xs text-navy-900 leading-relaxed">
                      <span className="font-semibold block mb-0.5">Your Response Note:</span>
                      <p className="whitespace-pre-line text-navy-800">{req.responseNote}</p>
                    </div>
                  )}

                  {/* Footer Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      {req.resumeIncluded ? (
                        <Button
                          variant="outline"
                          size="sm"
                          isLoading={downloadingResumeId === req._id}
                          onClick={() => handleDownloadResume(req._id, req.applicant?.name)}
                        >
                          <FileText className="w-3.5 h-3.5 mr-1.5 text-navy-600" />
                          Download Resume
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No resume attached</span>
                      )}
                    </div>

                    {req.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedRequest(req);
                            setActionType('reject');
                            setResponseNote('');
                          }}
                        >
                          <X className="w-3.5 h-3.5 mr-1 text-rose-500" />
                          Decline
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setSelectedRequest(req);
                            setActionType('accept');
                            setResponseNote('');
                          }}
                        >
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Accept & Refer
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* My Submitted Requests List */
          myRequests.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No Referral Requests Submitted"
              description="When you request referrals on active job listings, you can track their status and feedback here."
            />
          ) : (
            <div className="space-y-4">
              {myRequests.map((req) => (
                <div
                  key={req._id}
                  className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm hover:border-slate-300 transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    {/* Left: Job & Poster Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-900 text-base">
                          {req.job?.title || 'Job Listing (Unavailable)'}
                        </h3>
                        {req.job?.company && (
                          <span className="text-sm text-slate-600 font-medium">
                            at {req.job.company}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                        <span>Referred by:</span>
                        <Avatar
                          src={req.jobPoster?.profilePhotoUrl}
                          name={req.jobPoster?.name || 'Poster'}
                          size="sm"
                        />
                        <span className="font-medium text-slate-900">{req.jobPoster?.name}</span>
                        {req.jobPoster?.company && (
                          <span className="text-slate-400">• {req.jobPoster.company}</span>
                        )}
                      </div>
                    </div>

                    {/* Right: Status & Date */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1.5 shrink-0">
                      {renderStatusBadge(req.status)}
                      <span className="text-[11px] text-slate-400">
                        Requested on{' '}
                        {new Date(req.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* My Note */}
                  <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3.5 text-xs text-slate-700 leading-relaxed">
                    <span className="font-semibold block mb-0.5 text-slate-900">Your Note:</span>
                    <p className="whitespace-pre-line">{req.message}</p>
                  </div>

                  {/* Poster's Response Note */}
                  {req.responseNote && (
                    <div
                      className={`border rounded-xl p-4 text-xs leading-relaxed ${
                        req.status === 'accepted'
                          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                          : 'bg-rose-50/80 border-rose-200 text-rose-900'
                      }`}
                    >
                      <span className="font-bold block mb-1 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5" />
                        Referrer Feedback / Instructions:
                      </span>
                      <p className="whitespace-pre-line">{req.responseNote}</p>
                    </div>
                  )}

                  {/* Footer Actions */}
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
                    <span className="text-slate-500">
                      Resume shared:{' '}
                      <strong>{req.resumeIncluded ? 'Yes' : 'No'}</strong>
                    </span>

                    {req.status === 'pending' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedRequest(req);
                          setActionType('withdraw');
                        }}
                      >
                        <Ban className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        Withdraw Request
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </main>

      {/* Action Modal (Accept / Decline / Withdraw) */}
      {selectedRequest && actionType && (
        <Modal
          isOpen={Boolean(selectedRequest && actionType)}
          onClose={() => {
            setSelectedRequest(null);
            setActionType(null);
            setResponseNote('');
          }}
          title={
            actionType === 'accept'
              ? 'Accept Referral Request'
              : actionType === 'reject'
              ? 'Decline Referral Request'
              : 'Withdraw Referral Request'
          }
          description={
            actionType === 'accept'
              ? `Provide a referral confirmation, submission link, or instructions for ${selectedRequest.applicant?.name || 'the candidate'}.`
              : actionType === 'reject'
              ? `Provide optional feedback for ${selectedRequest.applicant?.name || 'the candidate'}.`
              : 'Are you sure you want to withdraw this referral request? You can submit another request later if the listing remains open.'
          }
        >
          <div className="space-y-4 pt-2">
            {actionType !== 'withdraw' && (
              <div>
                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                  Response Note / Instructions (Optional)
                </label>
                <Textarea
                  value={responseNote}
                  onChange={(e) => setResponseNote(e.target.value)}
                  placeholder={
                    actionType === 'accept'
                      ? 'e.g. I submitted your profile in our internal portal! You will receive an invitation email from our HR team...'
                      : 'e.g. Thanks for your interest! We are currently prioritizing candidates with specific distributed systems background...'
                  }
                  rows={4}
                  maxLength={2000}
                />
                <div className="text-right text-[11px] text-slate-400 mt-1">
                  {responseNote.length} / 2000
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedRequest(null);
                  setActionType(null);
                  setResponseNote('');
                }}
                disabled={isSubmittingAction}
              >
                Cancel
              </Button>
              <Button
                variant={actionType === 'reject' || actionType === 'withdraw' ? 'danger' : 'primary'}
                isLoading={isSubmittingAction}
                onClick={handleConfirmAction}
              >
                {actionType === 'accept'
                  ? 'Confirm Acceptance'
                  : actionType === 'reject'
                  ? 'Decline Request'
                  : 'Withdraw Request'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <Footer />
    </div>
  );
}
