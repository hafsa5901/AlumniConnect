import React, { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Avatar } from '../../components/ui/Avatar';
import { VerifiedBadge } from '../../components/ui/VerifiedBadge';
import { mentorshipService, MentorUser } from '../../services/mentorship';
import { Calendar, MessageSquare, Lightbulb, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

interface MentorshipRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mentor: MentorUser | null;
}

export const MentorshipRequestModal: React.FC<MentorshipRequestModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  mentor,
}) => {
  const [topic, setTopic] = useState('');
  const [message, setMessage] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setTopic('');
    setMessage('');
    setScheduledDate('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mentor) return;
    setError('');

    if (!topic.trim() || topic.trim().length < 2) {
      setError('Please provide a mentorship topic (at least 2 characters).');
      return;
    }

    if (!message.trim() || message.trim().length < 5) {
      setError('Please include a detailed message (at least 5 characters).');
      return;
    }

    setIsSubmitting(true);
    try {
      await mentorshipService.createRequest({
        mentor: mentor.id || mentor._id,
        topic: topic.trim(),
        message: message.trim(),
        scheduledDate: scheduledDate ? new Date(scheduledDate).toISOString() : null,
      });

      toast.success('Mentorship request sent successfully!');
      resetForm();
      onSuccess();
      onClose();
    } catch (err: any) {
      const code = err.response?.data?.error?.code;
      let msg = err.response?.data?.error?.message || 'Failed to send mentorship request.';
      if (code === 'DUPLICATE_MENTORSHIP_REQUEST') {
        msg = 'You already have an active mentorship request with this mentor.';
      } else if (code === 'NOT_MENTOR_ELIGIBLE') {
        msg = 'This alumni is currently not accepting mentorship requests.';
      } else if (code === 'SELF_MENTORSHIP') {
        msg = 'You cannot request mentorship from yourself.';
      }
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mentor) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request 1-on-1 Mentorship"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Selected Mentor Card */}
        <div className="flex items-center gap-3.5 p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
          <Avatar src={mentor.profilePhotoUrl} name={mentor.name} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
              <span className="truncate">{mentor.name}</span>
              <VerifiedBadge role="alumni" verificationStatus={mentor.verificationStatus as any} size="sm" />
            </div>
            <p className="text-xs text-slate-500 truncate">
              {mentor.designation ? `${mentor.designation}` : 'Alumni'}
              {mentor.company ? ` at ${mentor.company}` : ''}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 leading-relaxed">
            {error}
          </div>
        )}

        {/* Topic */}
        <Input
          label="Mentorship Topic *"
          placeholder="e.g. Career Transition, Resume Review, System Design Prep"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          leftIcon={<Lightbulb className="w-4 h-4 text-slate-400" />}
          required
        />

        {/* Message */}
        <Textarea
          label="Introduction & Questions *"
          placeholder="Introduce yourself, describe your background, and share 2-3 specific questions you would like to discuss with the mentor..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          required
        />

        {/* Preferred Date */}
        <Input
          label="Proposed Session Date (Optional)"
          type="date"
          value={scheduledDate}
          onChange={(e) => setScheduledDate(e.target.value)}
          leftIcon={<Calendar className="w-4 h-4 text-slate-400" />}
          helperText="The mentor will confirm or reschedule upon accepting your request"
        />

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Send Request
          </Button>
        </div>
      </form>
    </Modal>
  );
};
