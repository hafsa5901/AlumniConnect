import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import { Badge } from '../ui/Badge';
import { BulkActionType, BulkUserActionResult } from '../../types/adminAnalytics';
import { adminAnalyticsService } from '../../services/adminAnalyticsService';
import { CheckCircle2, AlertTriangle, ShieldAlert, XCircle, Users } from 'lucide-react';

interface SelectedUserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  verificationStatus: string;
  accountStatus: string;
}

interface BulkUserActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUsers: SelectedUserItem[];
  onSuccess: () => void;
}

export const BulkUserActionModal: React.FC<BulkUserActionModalProps> = ({
  isOpen,
  onClose,
  selectedUsers,
  onSuccess,
}) => {
  const [action, setAction] = useState<BulkActionType>('approve');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkUserActionResult | null>(null);

  const isReasonRequired = action === 'reject' || action === 'suspend';
  const isOverLimit = selectedUsers.length > 50;

  const handleResetAndClose = () => {
    setError(null);
    setResult(null);
    setReason('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUsers.length === 0) return;
    if (isOverLimit) {
      setError('Cannot perform bulk action on more than 50 users at once.');
      return;
    }
    if (isReasonRequired && !reason.trim()) {
      setError(`A reason is required when performing bulk ${action}.`);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const payload = {
        action,
        userIds: selectedUsers.map((u) => u.id),
        reason: reason.trim() || undefined,
      };

      const res = await adminAnalyticsService.performBulkAction(payload);
      setResult(res);
      onSuccess();
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || 'Failed to execute bulk user action.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const actionLabels: Record<BulkActionType, { title: string; color: string; desc: string }> = {
    approve: {
      title: 'Bulk Approve',
      color: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      desc: 'Verify and grant approved alumni/student platform access.',
    },
    reject: {
      title: 'Bulk Reject',
      color: 'bg-rose-600 hover:bg-rose-700 text-white',
      desc: 'Reject pending verifications with an explanatory note.',
    },
    suspend: {
      title: 'Bulk Suspend',
      color: 'bg-amber-600 hover:bg-amber-700 text-white',
      desc: 'Temporarily restrict account access and sign-in privileges.',
    },
    reactivate: {
      title: 'Bulk Reactivate',
      color: 'bg-blue-600 hover:bg-blue-700 text-white',
      desc: 'Restore active account status for suspended users.',
    },
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleResetAndClose}
      title="Bulk User Governance"
      size="lg"
    >
      {result ? (
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
            <div>
              <h4 className="font-bold text-navy-900 text-sm">Bulk Action Completed</h4>
              <p className="text-xs text-slate-600 mt-0.5">
                Processed {result.processed} user(s):{' '}
                <strong className="text-emerald-700">{result.succeeded.length} succeeded</strong>,{' '}
                <strong className="text-rose-700">{result.failed.length} failed</strong>.
              </p>
            </div>
          </div>

          {result.failed.length > 0 && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg space-y-2">
              <div className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Failures / Skipped Items:
              </div>
              <ul className="text-xs text-rose-700 space-y-1 max-h-36 overflow-y-auto">
                {result.failed.map((f, i) => (
                  <li key={i} className="flex justify-between font-mono">
                    <span>ID: {f.id.slice(-6)}</span>
                    <span className="font-sans text-rose-600 font-medium">{f.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="primary" onClick={handleResetAndClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          {/* Selected Target Summary */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-semibold text-slate-700">Selected Targets:</span>
              <Badge variant={isOverLimit ? 'red' : 'gray'}>
                {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            {isOverLimit && (
              <span className="text-xs text-rose-600 font-semibold">
                Maximum 50 users allowed
              </span>
            )}
          </div>

          {/* Action Selector */}
          <div>
            <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-2">
              Select Governance Action
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['approve', 'reject', 'suspend', 'reactivate'] as BulkActionType[]).map((act) => (
                <button
                  key={act}
                  type="button"
                  onClick={() => setAction(act)}
                  className={`p-2.5 rounded-lg text-xs font-bold border transition-all text-center capitalize ${
                    action === act
                      ? 'border-navy-900 bg-navy-900 text-white shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {act}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">{actionLabels[action].desc}</p>
          </div>

          {/* Selected Users Pill List */}
          <div>
            <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1.5">
              Target Accounts
            </label>
            <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1.5 bg-slate-50/50">
              {selectedUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between text-xs bg-white p-1.5 rounded border border-slate-100 shadow-2xs"
                >
                  <div className="truncate max-w-[65%]">
                    <span className="font-semibold text-navy-900">{u.name}</span>{' '}
                    <span className="text-slate-400">({u.email})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {u.role}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {u.verificationStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reason Input (required for reject / suspend) */}
          {isReasonRequired && (
            <div>
              <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1">
                Reason / Administrative Note <span className="text-rose-500">*</span>
              </label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={`Provide an explicit explanation for bulk ${action}...`}
                rows={3}
                maxLength={500}
                required
              />
              <p className="text-[11px] text-slate-400 text-right mt-1">
                {reason.length} / 500 characters
              </p>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="ghost" onClick={handleResetAndClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={action === 'reject' || action === 'suspend' ? 'danger' : 'primary'}
              isLoading={isSubmitting}
              disabled={isSubmitting || selectedUsers.length === 0 || isOverLimit}
            >
              Confirm {actionLabels[action].title}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
