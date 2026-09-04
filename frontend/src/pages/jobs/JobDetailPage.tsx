import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { jobsService, JobItem } from '../../services/jobs';
import { Navbar, Footer, PageHeader } from '../../components/layout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { Modal } from '../../components/ui/Modal';
import { JobFormModal } from './JobFormModal';
import { ErrorState } from '../../components/feedback/ErrorState';
import { Skeleton } from '../../components/feedback/Skeleton';
import {
  Briefcase,
  Building2,
  MapPin,
  Clock,
  ExternalLink,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Trash2,
  PowerOff,
  Power,
  ShieldCheck,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [job, setJob] = useState<JobItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [is404, setIs404] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isStatusToggling, setIsStatusToggling] = useState(false);

  const fetchJob = async () => {
    if (!id) {
      setIs404(true);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const res = await jobsService.getJobById(id);
      setJob(res.data.data.job);
      setIs404(false);
    } catch (err: any) {
      setIs404(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJob();
  }, [id]);

  const isOwner = Boolean(
    user?._id && job?.postedBy?._id && user._id.toString() === job.postedBy._id.toString()
  );
  const isAdmin = user?.role === 'admin';
  const canManage = isOwner || isAdmin;

  const handleToggleStatus = async () => {
    if (!job) return;
    const newStatus = job.status === 'open' ? 'closed' : 'open';
    setIsStatusToggling(true);
    try {
      await jobsService.updateJob(job.id, { status: newStatus });
      toast.success(
        newStatus === 'closed'
          ? 'Job listing has been marked as closed.'
          : 'Job listing has been reopened.'
      );
      fetchJob();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to update status.');
    } finally {
      setIsStatusToggling(false);
    }
  };

  const handleDeleteJob = async () => {
    if (!job) return;
    setIsDeleting(true);
    try {
      await jobsService.deleteJob(job.id);
      toast.success('Job posting deleted successfully.');
      navigate('/jobs');
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to delete job.');
      setIsDeleting(false);
    }
  };

  const formatJobType = (type?: string) => {
    switch (type) {
      case 'full_time':
        return 'Full-Time';
      case 'part_time':
        return 'Part-Time';
      case 'internship':
        return 'Internship';
      case 'contract':
        return 'Contract';
      default:
        return type || 'Job';
    }
  };

  const formatWorkplace = (type?: string) => {
    switch (type) {
      case 'remote':
        return 'Remote';
      case 'hybrid':
        return 'Hybrid';
      case 'onsite':
        return 'Onsite';
      default:
        return type || 'Workplace';
    }
  };

  const formatExperience = (exp?: string) => {
    switch (exp) {
      case 'entry':
        return 'Entry Level (0-2 yrs)';
      case 'mid':
        return 'Mid Level (3-5 yrs)';
      case 'senior':
        return 'Senior Level (5-8 yrs)';
      case 'lead':
        return 'Lead / Principal (8+ yrs)';
      default:
        return exp || 'Experience';
    }
  };

  // Safe external URL verification
  const isValidExternalUrl = (url?: string) => {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Link */}
        <Link
          to="/jobs"
          className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-navy-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Jobs & Referrals
        </Link>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-48 w-full rounded-2xl" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Skeleton className="h-96 md:col-span-2 rounded-2xl" />
              <Skeleton className="h-64 rounded-2xl" />
            </div>
          </div>
        ) : is404 || !job ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-12 max-w-lg mx-auto shadow-sm">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-navy-900 mb-2">Job Listing Not Found</h3>
            <p className="text-sm text-slate-500 mb-6">
              The job posting you are looking for does not exist, has expired, or is currently closed to the public.
            </p>
            <Button variant="primary" onClick={() => navigate('/jobs')}>
              View Open Opportunities
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Header Card */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={job.jobType === 'internship' ? 'yellow' : 'blue'}>
                      {formatJobType(job.jobType)}
                    </Badge>
                    <Badge variant="gray">
                      {formatWorkplace(job.workplaceType)}
                    </Badge>
                    <Badge variant="navy">
                      {formatExperience(job.experienceLevel)}
                    </Badge>
                    {job.referralAvailable && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Referral Available
                      </span>
                    )}
                    {job.status === 'closed' && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        Closed Listing
                      </span>
                    )}
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                    {job.title}
                  </h1>

                  <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-sm text-slate-600">
                    <div className="flex items-center gap-1.5 font-medium text-slate-800">
                      <Building2 className="w-4 h-4 text-slate-500" />
                      {job.company}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      {job.location}
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Clock className="w-4 h-4 text-slate-400" />
                      Posted on {new Date(job.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                </div>

                {/* Primary CTA & Management */}
                <div className="flex flex-col sm:flex-row md:flex-col gap-3 min-w-[200px]">
                  {isValidExternalUrl(job.applicationUrl) ? (
                    <a
                      href={job.applicationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center justify-center font-medium rounded-xl transition-all shadow-sm focus:outline-none px-6 py-3 text-base ${
                        job.status === 'closed'
                          ? 'bg-slate-100 text-slate-400 border border-slate-200 pointer-events-none cursor-not-allowed'
                          : 'bg-navy-900 hover:bg-navy-800 text-white shadow-navy-900/10'
                      }`}
                    >
                      <span>Apply on Company Site</span>
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </a>
                  ) : (
                    <Button variant="outline" disabled>
                      Invalid Application Link
                    </Button>
                  )}

                  {job.status === 'closed' && (
                    <p className="text-xs text-amber-700 text-center font-medium">
                      This listing is currently closed.
                    </p>
                  )}
                </div>
              </div>

              {/* Owner / Admin Manage Bar */}
              {canManage && (
                <div className="mt-6 pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50/70 -mx-6 sm:-mx-8 -mb-6 sm:-mb-8 px-6 sm:px-8 py-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <ShieldCheck className="w-4 h-4 text-navy-800" />
                    {isAdmin && !isOwner ? 'Admin Moderation' : 'Poster Controls'}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditModalOpen(true)}
                    >
                      <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                      Edit Listing
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleToggleStatus}
                      isLoading={isStatusToggling}
                    >
                      {job.status === 'open' ? (
                        <>
                          <PowerOff className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                          Close Listing
                        </>
                      ) : (
                        <>
                          <Power className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                          Reopen Listing
                        </>
                      )}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setIsDeleteModalOpen(true)}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Grid Layout: Job Description & Poster Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Left Column: Details & Requirements */}
              <div className="md:col-span-2 space-y-8">
                {/* Description */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                    About the Role
                  </h2>
                  <div className="text-slate-700 leading-relaxed text-sm whitespace-pre-line">
                    {job.description}
                  </div>
                </div>

                {/* Requirements */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                    Key Requirements & Qualifications
                  </h2>
                  <ul className="space-y-3">
                    {job.requirements?.map((req, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                        <div className="w-5 h-5 rounded-full bg-navy-50 text-navy-800 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3 h-3 stroke-[2.5]" />
                        </div>
                        <span className="leading-snug">{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Right Column: Metadata & Poster Info */}
              <div className="space-y-6">
                {/* Job Overview Card */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Listing Summary
                  </h3>
                  <div className="space-y-3.5 text-sm">
                    <div>
                      <div className="text-xs text-slate-500 mb-0.5">Application Deadline</div>
                      <div className="font-medium text-slate-800 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        {job.applicationDeadline
                          ? new Date(job.applicationDeadline).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : 'Open until filled'}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500 mb-0.5">Workplace & Location</div>
                      <div className="font-medium text-slate-800 flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        {formatWorkplace(job.workplaceType)} • {job.location}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500 mb-0.5">Experience Level</div>
                      <div className="font-medium text-slate-800 flex items-center gap-1.5">
                        <Briefcase className="w-4 h-4 text-slate-400" />
                        {formatExperience(job.experienceLevel)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Poster Information Card */}
                {job.postedBy && (
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Posted By
                    </h3>
                    <div className="flex items-center gap-3.5">
                      <Avatar
                        src={job.postedBy.profilePhotoUrl}
                        name={job.postedBy.name}
                        size="lg"
                      />
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/alumni/${job.postedBy._id}`}
                          className="font-bold text-slate-900 hover:text-navy-800 text-base truncate block"
                        >
                          {job.postedBy.name}
                        </Link>
                        {job.postedBy.designation && (
                          <p className="text-xs text-slate-600 truncate">
                            {job.postedBy.designation}
                            {job.postedBy.company ? ` at ${job.postedBy.company}` : ''}
                          </p>
                        )}
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="text-[11px] font-medium text-navy-800 bg-navy-50 px-2 py-0.5 rounded-full capitalize">
                            {job.postedBy.role}
                          </span>
                          {job.postedBy.department && (
                            <span className="text-[11px] text-slate-500 truncate">
                              • {job.postedBy.department}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {job.referralAvailable && (
                      <div className="p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-xl text-xs text-emerald-800 leading-relaxed flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>
                          <strong>Internal Referral:</strong> The poster indicated they may be open to providing a referral. You can view their alumni profile to learn more.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Edit Job Modal */}
      {job && (
        <JobFormModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={fetchJob}
          jobToEdit={job}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Job Posting"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to permanently delete <strong>{job?.title}</strong>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteJob}
              isLoading={isDeleting}
            >
              Delete Job
            </Button>
          </div>
        </div>
      </Modal>

      <Footer />
    </div>
  );
}
