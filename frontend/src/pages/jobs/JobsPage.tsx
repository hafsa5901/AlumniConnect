import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { jobsService, JobItem, JobType, WorkplaceType, ExperienceLevel } from '../../services/jobs';
import { Navbar, Footer, PageHeader } from '../../components/layout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState } from '../../components/feedback/EmptyState';
import { CardSkeleton } from '../../components/feedback/Skeleton';
import { JobFormModal } from './JobFormModal';
import {
  Briefcase,
  Building2,
  MapPin,
  Clock,
  Search,
  Plus,
  ArrowRight,
  CheckCircle2,
  Calendar,
  Filter,
  Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function JobsPage() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'all' | 'mine'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [jobType, setJobType] = useState<string>('');
  const [workplaceType, setWorkplaceType] = useState<string>('');
  const [experienceLevel, setExperienceLevel] = useState<string>('');
  const [referralOnly, setReferralOnly] = useState(false);

  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Check permissions: verified alumni or admin can post jobs
  const isVerifiedAlumni =
    user?.role === 'alumni' && user.verificationStatus === 'admin_approved';
  const isAdmin = user?.role === 'admin';
  const canPostJob = isVerifiedAlumni || isAdmin;

  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await jobsService.listJobs({
        search: searchTerm || undefined,
        jobType: jobType || undefined,
        workplaceType: workplaceType || undefined,
        experienceLevel: experienceLevel || undefined,
        referralAvailable: referralOnly ? true : undefined,
        mine: activeTab === 'mine',
        page,
        limit: 12,
      });

      setJobs(res.data.data.jobs || []);
      setTotal(res.data.data.pagination.total);
      setTotalPages(res.data.data.pagination.totalPages);
    } catch (err) {
      console.error('Failed to load jobs:', err);
      toast.error('Failed to load job opportunities.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, searchTerm, jobType, workplaceType, experienceLevel, referralOnly, page]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setJobType('');
    setWorkplaceType('');
    setExperienceLevel('');
    setReferralOnly(false);
    setPage(1);
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
        return 'Entry Level';
      case 'mid':
        return 'Mid Level';
      case 'senior':
        return 'Senior';
      case 'lead':
        return 'Lead';
      default:
        return exp || 'Experience';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <Navbar />

      <PageHeader
        title="Jobs & Career Opportunities"
        subtitle="Explore exclusive job openings and internship opportunities posted directly by verified alumni and institutional partners."
        actions={
          canPostJob ? (
            <Button
              variant="primary"
              onClick={() => setIsCreateModalOpen(true)}
              className="w-full sm:w-auto shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Post a Job
            </Button>
          ) : undefined
        }
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Top Control Bar: Tabs & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          {/* Tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveTab('all');
                setPage(1);
              }}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'all'
                  ? 'bg-navy-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              All Openings
            </button>
            {canPostJob && (
              <button
                onClick={() => {
                  setActiveTab('mine');
                  setPage(1);
                }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === 'mine'
                    ? 'bg-navy-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                My Postings
              </button>
            )}
          </div>

          {/* Search Box */}
          <div className="w-full md:w-80">
            <Input
              placeholder="Search title, company, skills..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Select
              label="Job Type"
              value={jobType}
              onChange={(e) => {
                setJobType(e.target.value);
                setPage(1);
              }}
              options={[
                { label: 'All Job Types', value: '' },
                { label: 'Full-Time', value: 'full_time' },
                { label: 'Part-Time', value: 'part_time' },
                { label: 'Internship', value: 'internship' },
                { label: 'Contract', value: 'contract' },
              ]}
            />
            <Select
              label="Workplace Type"
              value={workplaceType}
              onChange={(e) => {
                setWorkplaceType(e.target.value);
                setPage(1);
              }}
              options={[
                { label: 'All Workplace Types', value: '' },
                { label: 'Remote', value: 'remote' },
                { label: 'Hybrid', value: 'hybrid' },
                { label: 'Onsite', value: 'onsite' },
              ]}
            />
            <Select
              label="Experience Level"
              value={experienceLevel}
              onChange={(e) => {
                setExperienceLevel(e.target.value);
                setPage(1);
              }}
              options={[
                { label: 'All Levels', value: '' },
                { label: 'Entry Level (0-2 yrs)', value: 'entry' },
                { label: 'Mid Level (3-5 yrs)', value: 'mid' },
                { label: 'Senior Level (5-8 yrs)', value: 'senior' },
                { label: 'Lead / Principal (8+ yrs)', value: 'lead' },
              ]}
            />

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100/70 transition-colors">
                <input
                  type="checkbox"
                  checked={referralOnly}
                  onChange={(e) => {
                    setReferralOnly(e.target.checked);
                    setPage(1);
                  }}
                  className="h-4 w-4 text-navy-800 focus:ring-navy-700 border-slate-300 rounded"
                />
                <span className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Referral Available Only
                </span>
              </label>
            </div>
          </div>

          {(searchTerm || jobType || workplaceType || experienceLevel || referralOnly) && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Showing filtered results ({total} found)</span>
              <button
                onClick={handleResetFilters}
                className="font-medium text-navy-800 hover:text-navy-950 underline"
              >
                Reset All Filters
              </button>
            </div>
          )}
        </div>

        {/* Jobs Grid / Feed */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm">
            <EmptyState
              icon={Briefcase}
              title={activeTab === 'mine' ? 'No Job Postings Yet' : 'No Opportunities Found'}
              description={
                activeTab === 'mine'
                  ? 'You have not posted any job listings yet. Use the "Post a Job" button to share opportunities.'
                  : 'There are currently no job postings matching your selected filters. Try broadening your search or resetting filters.'
              }
              actionLabel={canPostJob && activeTab === 'mine' ? 'Post Your First Job' : 'Clear Filters'}
              onAction={canPostJob && activeTab === 'mine' ? () => setIsCreateModalOpen(true) : handleResetFilters}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between p-6 group relative"
              >
                <div className="space-y-4">
                  {/* Top Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={job.jobType === 'internship' ? 'yellow' : 'blue'}>
                        {formatJobType(job.jobType)}
                      </Badge>
                      <Badge variant="gray">
                        {formatWorkplace(job.workplaceType)}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {job.referralAvailable && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
                          title="Poster is open to offering internal referral"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Referral
                        </span>
                      )}
                      {job.status === 'closed' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          Closed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Company */}
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-navy-900 transition-colors line-clamp-1">
                      {job.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mt-1">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <span className="truncate">{job.company}</span>
                    </div>
                  </div>

                  {/* Location & Experience */}
                  <div className="space-y-1.5 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{job.location}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{formatExperience(job.experienceLevel)}</span>
                    </div>
                  </div>

                  {/* Description Snippet */}
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {job.description}
                  </p>
                </div>

                {/* Footer: Poster & Action */}
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar
                      src={job.postedBy?.profilePhotoUrl}
                      name={job.postedBy?.name || 'Poster'}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 truncate">
                        {job.postedBy?.name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {job.postedBy?.designation || job.postedBy?.role}
                      </div>
                    </div>
                  </div>

                  <Link
                    to={`/jobs/${job.id}`}
                    className="inline-flex items-center text-xs font-semibold text-navy-800 hover:text-navy-950 group-hover:translate-x-0.5 transition-all shrink-0"
                  >
                    Details
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="text-xs text-slate-500">
              Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({total} total)
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
      </main>

      {/* Post a Job Modal */}
      <JobFormModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchJobs}
      />

      <Footer />
    </div>
  );
}
