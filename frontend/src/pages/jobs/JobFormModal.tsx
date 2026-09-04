import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import {
  jobsService,
  JobItem,
  JobType,
  WorkplaceType,
  ExperienceLevel,
  JobStatus,
  CreateJobPayload,
  UpdateJobPayload,
} from '../../services/jobs';
import { Briefcase, Building2, MapPin, Globe, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface JobFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  jobToEdit?: JobItem | null;
}

export const JobFormModal: React.FC<JobFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  jobToEdit,
}) => {
  const isEditing = Boolean(jobToEdit);

  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [jobType, setJobType] = useState<JobType>('full_time');
  const [workplaceType, setWorkplaceType] = useState<WorkplaceType>('onsite');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('entry');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState<string[]>(['']);
  const [applicationUrl, setApplicationUrl] = useState('');
  const [applicationDeadline, setApplicationDeadline] = useState('');
  const [status, setStatus] = useState<JobStatus>('open');
  const [referralAvailable, setReferralAvailable] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (jobToEdit) {
      setTitle(jobToEdit.title || '');
      setCompany(jobToEdit.company || '');
      setLocation(jobToEdit.location || '');
      setJobType(jobToEdit.jobType || 'full_time');
      setWorkplaceType(jobToEdit.workplaceType || 'onsite');
      setExperienceLevel(jobToEdit.experienceLevel || 'entry');
      setDescription(jobToEdit.description || '');
      setRequirements(jobToEdit.requirements?.length ? jobToEdit.requirements : ['']);
      setApplicationUrl(jobToEdit.applicationUrl || '');
      setApplicationDeadline(
        jobToEdit.applicationDeadline
          ? new Date(jobToEdit.applicationDeadline).toISOString().split('T')[0]
          : ''
      );
      setStatus(jobToEdit.status || 'open');
      setReferralAvailable(Boolean(jobToEdit.referralAvailable));
      setError('');
    } else {
      resetForm();
    }
  }, [jobToEdit, isOpen]);

  const resetForm = () => {
    setTitle('');
    setCompany('');
    setLocation('');
    setJobType('full_time');
    setWorkplaceType('onsite');
    setExperienceLevel('entry');
    setDescription('');
    setRequirements(['']);
    setApplicationUrl('');
    setApplicationDeadline('');
    setStatus('open');
    setReferralAvailable(false);
    setError('');
  };

  const handleAddRequirement = () => {
    setRequirements([...requirements, '']);
  };

  const handleRequirementChange = (index: number, val: string) => {
    const updated = [...requirements];
    updated[index] = val;
    setRequirements(updated);
  };

  const handleRemoveRequirement = (index: number) => {
    if (requirements.length === 1) {
      setRequirements(['']);
      return;
    }
    setRequirements(requirements.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validations
    if (!title.trim() || !company.trim() || !location.trim() || !description.trim() || !applicationUrl.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    const filteredReqs = requirements.map((r) => r.trim()).filter(Boolean);
    if (filteredReqs.length === 0) {
      setError('Please add at least one job requirement.');
      return;
    }

    try {
      const url = new URL(applicationUrl.trim());
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        setError('Application URL must be a valid http:// or https:// web address.');
        return;
      }
    } catch {
      setError('Please enter a valid URL (e.g., https://company.com/careers/apply).');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && jobToEdit) {
        const payload: UpdateJobPayload = {
          title: title.trim(),
          company: company.trim(),
          location: location.trim(),
          jobType,
          workplaceType,
          experienceLevel,
          description: description.trim(),
          requirements: filteredReqs,
          applicationUrl: applicationUrl.trim(),
          applicationDeadline: applicationDeadline ? new Date(applicationDeadline).toISOString() : null,
          status,
          referralAvailable,
        };

        await jobsService.updateJob(jobToEdit.id, payload);
        toast.success('Job listing updated successfully!');
      } else {
        const payload: CreateJobPayload = {
          title: title.trim(),
          company: company.trim(),
          location: location.trim(),
          jobType,
          workplaceType,
          experienceLevel,
          description: description.trim(),
          requirements: filteredReqs,
          applicationUrl: applicationUrl.trim(),
          applicationDeadline: applicationDeadline ? new Date(applicationDeadline).toISOString() : null,
          referralAvailable,
        };

        await jobsService.createJob(payload);
        toast.success('Job listing posted successfully!');
      }

      resetForm();
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to save job listing.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Job Posting' : 'Post a New Job Opportunity'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Title & Company */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Job Title *"
            placeholder="e.g. Senior Frontend Engineer"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            leftIcon={<Briefcase className="w-4 h-4 text-slate-400" />}
            required
          />
          <Input
            label="Company Name *"
            placeholder="e.g. Acme Corp"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            leftIcon={<Building2 className="w-4 h-4 text-slate-400" />}
            required
          />
        </div>

        {/* Location & Workplace Type */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Location *"
            placeholder="e.g. New York, NY or Remote"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            leftIcon={<MapPin className="w-4 h-4 text-slate-400" />}
            required
          />
          <Select
            label="Workplace Type *"
            value={workplaceType}
            onChange={(e) => setWorkplaceType(e.target.value as WorkplaceType)}
            options={[
              { label: 'Onsite', value: 'onsite' },
              { label: 'Hybrid', value: 'hybrid' },
              { label: 'Remote', value: 'remote' },
            ]}
          />
        </div>

        {/* Job Type & Experience Level */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Job Type *"
            value={jobType}
            onChange={(e) => setJobType(e.target.value as JobType)}
            options={[
              { label: 'Full-Time', value: 'full_time' },
              { label: 'Part-Time', value: 'part_time' },
              { label: 'Internship', value: 'internship' },
              { label: 'Contract', value: 'contract' },
            ]}
          />
          <Select
            label="Experience Level *"
            value={experienceLevel}
            onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}
            options={[
              { label: 'Entry Level (0-2 yrs)', value: 'entry' },
              { label: 'Mid Level (3-5 yrs)', value: 'mid' },
              { label: 'Senior Level (5-8 yrs)', value: 'senior' },
              { label: 'Lead / Principal (8+ yrs)', value: 'lead' },
            ]}
          />
        </div>

        {/* Description */}
        <Textarea
          label="Job Description *"
          placeholder="Describe the role, responsibilities, team, and technology stack..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          required
        />

        {/* Requirements List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-slate-700">
              Requirements & Qualifications *
            </label>
            <button
              type="button"
              onClick={handleAddRequirement}
              className="inline-flex items-center text-xs font-semibold text-navy-800 hover:text-navy-950 focus:outline-none"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Requirement
            </button>
          </div>
          <div className="space-y-2">
            {requirements.map((req, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`Requirement #${idx + 1} (e.g. 3+ years experience with React)`}
                  value={req}
                  onChange={(e) => handleRequirementChange(idx, e.target.value)}
                  className="flex-1 text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-800 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveRequirement(idx)}
                  className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  title="Remove requirement"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Application URL & Deadline */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Application Link (External URL) *"
            type="url"
            placeholder="https://company.com/careers/job"
            value={applicationUrl}
            onChange={(e) => setApplicationUrl(e.target.value)}
            leftIcon={<Globe className="w-4 h-4 text-slate-400" />}
            helperText="Applicants will click through to apply on your company website"
            required
          />
          <Input
            label="Application Deadline (Optional)"
            type="date"
            value={applicationDeadline}
            onChange={(e) => setApplicationDeadline(e.target.value)}
          />
        </div>

        {/* Editing: Status Toggle */}
        {isEditing && (
          <Select
            label="Listing Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as JobStatus)}
            options={[
              { label: 'Open (Visible to all students & alumni)', value: 'open' },
              { label: 'Closed (Hidden from public listings)', value: 'closed' },
            ]}
          />
        )}

        {/* Referral Available Checkbox */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={referralAvailable}
              onChange={(e) => setReferralAvailable(e.target.checked)}
              className="mt-1 h-4 w-4 text-navy-800 focus:ring-navy-700 border-slate-300 rounded"
            />
            <div>
              <div className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" />
                Referral Available
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Displays a "Referral Available" badge on the listing to let students and peers know you can provide an internal referral.
              </p>
            </div>
          </label>
        </div>

        {/* Modal Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            {isEditing ? 'Save Changes' : 'Publish Job'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
