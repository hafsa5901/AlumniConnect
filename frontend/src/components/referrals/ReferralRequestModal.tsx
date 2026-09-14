import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import { referralsService } from '../../services/referralsService';
import { useAuth } from '../../context/AuthContext';
import { FileText, Building2, Send, AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface ReferralRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: {
    id: string;
    title: string;
    company: string;
    postedBy?: {
      name?: string;
    };
  };
  onSuccess: () => void;
}

export const ReferralRequestModal: React.FC<ReferralRequestModalProps> = ({
  isOpen,
  onClose,
  job,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [resumeIncluded, setResumeIncluded] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasResume = Boolean(user?.resume || (user as any)?.hasResume);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError('Please write a brief note introducing yourself and your qualifications.');
      return;
    }
    if (message.trim().length < 5) {
      setError('Message must be at least 5 characters.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await referralsService.createReferralRequest({
        jobId: job.id,
        message: message.trim(),
        resumeIncluded: resumeIncluded && hasResume,
      });

      toast.success('Referral request sent successfully!');
      setMessage('');
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to submit referral request.';
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
      title="Request Employee Referral"
      description={`Submit a referral request to ${job.postedBy?.name || 'the job poster'} for ${job.title}.`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6 pt-2">
        {/* Job Summary Banner */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-navy-100 text-navy-800 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-slate-900 text-sm truncate">{job.title}</h4>
            <p className="text-xs text-slate-600 truncate">{job.company}</p>
          </div>
        </div>

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Pitch Message */}
        <div>
          <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
            Personal Note / Pitch <span className="text-red-500">*</span>
          </label>
          <Textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Briefly explain why you are a great fit for this role, key projects or technologies, and why you're interested in the team..."
            rows={4}
            maxLength={2000}
            required
            className="text-sm"
          />
          <div className="flex justify-between items-center text-[11px] text-slate-500 mt-1.5">
            <span>Keep it concise, professional, and relevant to the job requirements.</span>
            <span>{message.length} / 2000</span>
          </div>
        </div>

        {/* Resume Consent Section */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2.5">
          <div className="flex items-start gap-3">
            <input
              id="resume-consent-checkbox"
              type="checkbox"
              checked={resumeIncluded && hasResume}
              disabled={!hasResume}
              onChange={(e) => setResumeIncluded(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-navy-600 focus:ring-navy-500 cursor-pointer disabled:cursor-not-allowed"
            />
            <div className="text-xs">
              <label htmlFor="resume-consent-checkbox" className="font-semibold text-slate-900 cursor-pointer">
                Share my uploaded resume with {job.postedBy?.name || 'the referrer'}
              </label>
              <p className="text-slate-600 mt-0.5 leading-relaxed">
                Allows the job poster to securely review your private resume to evaluate your referral candidacy.
              </p>
            </div>
          </div>

          {!hasResume ? (
            <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200/60 rounded-lg p-2.5 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
              <span>You don't have a resume uploaded to your profile. You can upload one in your profile settings.</span>
            </div>
          ) : (
            <div className="text-[11px] text-emerald-700 bg-emerald-50/80 border border-emerald-200/60 rounded-lg p-2 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Resume available on profile ({user?.resume?.originalName || 'Active Resume'})</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            disabled={isSubmitting || !message.trim()}
          >
            <Send className="w-4 h-4 mr-2" />
            Send Referral Request
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default ReferralRequestModal;
