import React, { useState } from 'react';
import { ConnectionItem } from '../../types/connection';
import { Button } from '../ui/Button';
import { MessageSquare, UserMinus, Building2, GraduationCap, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Modal } from '../ui/Modal';

interface ConnectionCardProps {
  connection: ConnectionItem;
  onRemove: (id: string) => Promise<void>;
  onMessage: (userId: string) => void;
}

export const ConnectionCard: React.FC<ConnectionCardProps> = ({
  connection,
  onRemove,
  onMessage,
}) => {
  const { connectedUser } = connection;
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const handleConfirmRemove = async () => {
    try {
      setIsRemoving(true);
      await onRemove(connection._id);
      setIsRemoveModalOpen(false);
    } finally {
      setIsRemoving(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 hover:shadow-md transition-all duration-200 flex flex-col justify-between group">
        <div>
          {/* Header & Avatar */}
          <div className="flex items-start gap-3.5 mb-3.5">
            <div className="relative shrink-0">
              {connectedUser.profilePhotoUrl ? (
                <img
                  src={connectedUser.profilePhotoUrl}
                  alt={connectedUser.name}
                  className="w-13 h-13 rounded-xl object-cover border border-slate-100 shadow-sm"
                />
              ) : (
                <div className="w-13 h-13 rounded-xl bg-gradient-to-br from-navy-800 to-navy-950 text-white font-bold text-sm flex items-center justify-center shadow-sm">
                  {getInitials(connectedUser.name || 'User')}
                </div>
              )}
              {connectedUser.verificationStatus === 'admin_approved' && (
                <span
                  title="Verified User"
                  className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-0.5 rounded-full ring-2 ring-white"
                >
                  <ShieldCheck className="w-3 h-3" />
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-semibold text-slate-900 text-sm truncate">{connectedUser.name}</h3>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                    connectedUser.role === 'alumni'
                      ? 'bg-amber-100/80 text-amber-800'
                      : connectedUser.role === 'student'
                      ? 'bg-blue-100/80 text-blue-800'
                      : 'bg-purple-100/80 text-purple-800'
                  }`}
                >
                  {connectedUser.role}
                </span>
              </div>

              {connectedUser.company || connectedUser.designation ? (
                <p className="text-xs text-slate-600 mt-1 flex items-center gap-1.5 truncate">
                  <Building2 className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">
                    {[connectedUser.designation, connectedUser.company].filter(Boolean).join(' at ')}
                  </span>
                </p>
              ) : null}

              {connectedUser.department || connectedUser.batch ? (
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 truncate">
                  <GraduationCap className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">
                    {[connectedUser.department, connectedUser.batch ? `Class of ${connectedUser.batch}` : null]
                      .filter(Boolean)
                      .join(' • ')}
                  </span>
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onMessage(connectedUser._id || connectedUser.id || '')}
            className="flex-1 text-xs font-medium text-navy-900 border-navy-200 hover:bg-navy-50/60"
          >
            <MessageSquare className="w-3.5 h-3.5 mr-1.5 text-navy-700" />
            Message
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsRemoveModalOpen(true)}
            className="text-slate-400 hover:text-red-600 hover:bg-red-50/60 px-2.5"
            title="Remove Connection"
          >
            <UserMinus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Remove Confirmation Modal */}
      <Modal
        isOpen={isRemoveModalOpen}
        onClose={() => setIsRemoveModalOpen(false)}
        title="Remove Connection"
        description="Are you sure you want to remove this connection?"
        size="sm"
      >
        <div className="space-y-4 pt-2">
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Removing <strong>{connectedUser.name}</strong> from your network will disable initiating new conversations,
              though your previous chat history will remain safe.
            </span>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsRemoveModalOpen(false)}
              disabled={isRemoving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleConfirmRemove}
              isLoading={isRemoving}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Remove Connection
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default ConnectionCard;
