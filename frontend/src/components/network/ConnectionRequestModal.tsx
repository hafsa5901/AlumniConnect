import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import { connectionsService } from '../../services/connectionsService';
import { Send, UserPlus, AlertCircle, Building2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface ConnectionRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: {
    id: string;
    name: string;
    role?: string;
    designation?: string;
    company?: string;
    profilePhotoUrl?: string;
  };
  onSuccess: () => void;
}

export const ConnectionRequestModal: React.FC<ConnectionRequestModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  onSuccess,
}) => {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.length > 500) {
      setError('Note cannot exceed 500 characters.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await connectionsService.sendConnectionRequest({
        recipientId: targetUser.id,
        message: message.trim() || undefined,
      });

      toast.success(`Connection request sent to ${targetUser.name}!`);
      setMessage('');
      onSuccess();
      onClose();
    } catch (err: any) {
      const errData = err.response?.data?.error;
      const msg = errData?.message || 'Failed to send connection request.';
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
      title="Connect with Professional"
      description={`Send a personalized invitation to ${targetUser.name}.`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5 pt-2">
        {/* Target User Summary Card */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-navy-100 text-navy-800 flex items-center justify-center shrink-0 font-bold text-sm">
            {targetUser.profilePhotoUrl ? (
              <img
                src={targetUser.profilePhotoUrl}
                alt={targetUser.name}
                className="w-full h-full object-cover rounded-xl"
              />
            ) : (
              targetUser.name.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-slate-900 text-sm truncate">{targetUser.name}</h4>
            {(targetUser.designation || targetUser.company) && (
              <p className="text-xs text-slate-600 truncate flex items-center gap-1.5 mt-0.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{[targetUser.designation, targetUser.company].filter(Boolean).join(' at ')}</span>
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Optional Note Field */}
        <div>
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
            Add a personal note <span className="text-slate-400 font-normal lowercase">(optional)</span>
          </label>
          <Textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Introduce yourself, mention shared interests, or describe why you'd like to connect..."
            rows={3}
            maxLength={500}
            className="text-sm"
          />
          <div className="flex justify-between items-center text-[11px] text-slate-500 mt-1.5">
            <span>Invitations with a brief note are more likely to be accepted.</span>
            <span>{message.length} / 500</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            disabled={isSubmitting}
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            Send Invitation
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default ConnectionRequestModal;
