import React, { useState } from 'react';
import { ConnectionRequestItem } from '../../types/connection';
import { Button } from '../ui/Button';
import {
  Check,
  X,
  RotateCcw,
  Building2,
  GraduationCap,
  MessageSquareQuote,
  ShieldCheck,
  Inbox,
  Send,
} from 'lucide-react';

interface PendingInvitationsListProps {
  received: ConnectionRequestItem[];
  sent: ConnectionRequestItem[];
  onAccept: (id: string) => Promise<void>;
  onDecline: (id: string) => Promise<void>;
  onWithdraw: (id: string) => Promise<void>;
}

export const PendingInvitationsList: React.FC<PendingInvitationsListProps> = ({
  received,
  sent,
  onAccept,
  onDecline,
  onWithdraw,
}) => {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleAction = async (id: string, actionFn: (id: string) => Promise<void>) => {
    try {
      setLoadingId(id);
      await actionFn(id);
    } finally {
      setLoadingId(null);
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
    <div className="space-y-8">
      {/* 1. Received Invitations */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-navy-100 text-navy-800">
              <Inbox className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Received Invitations</h2>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-navy-50 text-navy-800 border border-navy-200">
            {received.length} pending
          </span>
        </div>

        {received.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center">
            <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
            <h4 className="text-sm font-semibold text-slate-800">No pending received invitations</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              When other students or alumni send you a connection request, it will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {received.map((req) => {
              const sender = req.requester;
              const isLoading = loadingId === req._id;

              return (
                <div
                  key={req._id}
                  className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between hover:shadow-sm transition-all"
                >
                  <div>
                    {/* User Header */}
                    <div className="flex items-start gap-3">
                      <div className="relative shrink-0">
                        {sender.profilePhotoUrl ? (
                          <img
                            src={sender.profilePhotoUrl}
                            alt={sender.name}
                            className="w-12 h-12 rounded-xl object-cover border border-slate-100 shadow-sm"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-navy-800 to-navy-950 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                            {getInitials(sender.name || 'User')}
                          </div>
                        )}
                        {sender.verificationStatus === 'admin_approved' && (
                          <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-0.5 rounded-full ring-2 ring-white">
                            <ShieldCheck className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-semibold text-slate-900 text-sm truncate">{sender.name}</h4>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                              sender.role === 'alumni'
                                ? 'bg-amber-100/80 text-amber-800'
                                : 'bg-blue-100/80 text-blue-800'
                            }`}
                          >
                            {sender.role}
                          </span>
                        </div>

                        {(sender.company || sender.designation) && (
                          <p className="text-xs text-slate-600 truncate mt-0.5 flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{[sender.designation, sender.company].filter(Boolean).join(' at ')}</span>
                          </p>
                        )}

                        {(sender.department || sender.batch) && (
                          <p className="text-xs text-slate-500 truncate mt-0.5 flex items-center gap-1">
                            <GraduationCap className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>
                              {[sender.department, sender.batch ? `Class of ${sender.batch}` : null]
                                .filter(Boolean)
                                .join(' • ')}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Attached Note */}
                    {req.message && (
                      <div className="mt-3 p-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs text-slate-700 flex items-start gap-2">
                        <MessageSquareQuote className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <span className="italic leading-relaxed">{req.message}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAction(req._id, onDecline)}
                      disabled={isLoading}
                      className="text-xs text-slate-600 hover:text-red-600 hover:bg-red-50"
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      Decline
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => handleAction(req._id, onAccept)}
                      isLoading={isLoading}
                      disabled={isLoading}
                      className="text-xs bg-navy-900 hover:bg-navy-800 text-white"
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Accept
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 2. Sent Invitations */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
              <Send className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Sent Invitations</h2>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {sent.length} sent
          </span>
        </div>

        {sent.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center">
            <Send className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
            <h4 className="text-sm font-semibold text-slate-800">No pending sent invitations</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Invitations you send to other verified members that are awaiting response will show up here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sent.map((req) => {
              const recipient = req.recipient;
              const isLoading = loadingId === req._id;

              return (
                <div
                  key={req._id}
                  className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between hover:shadow-sm transition-all"
                >
                  <div>
                    {/* User Header */}
                    <div className="flex items-start gap-3">
                      <div className="relative shrink-0">
                        {recipient.profilePhotoUrl ? (
                          <img
                            src={recipient.profilePhotoUrl}
                            alt={recipient.name}
                            className="w-12 h-12 rounded-xl object-cover border border-slate-100 shadow-sm"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                            {getInitials(recipient.name || 'User')}
                          </div>
                        )}
                        {recipient.verificationStatus === 'admin_approved' && (
                          <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-0.5 rounded-full ring-2 ring-white">
                            <ShieldCheck className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-semibold text-slate-900 text-sm truncate">{recipient.name}</h4>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                              recipient.role === 'alumni'
                                ? 'bg-amber-100/80 text-amber-800'
                                : 'bg-blue-100/80 text-blue-800'
                            }`}
                          >
                            {recipient.role}
                          </span>
                        </div>

                        {(recipient.company || recipient.designation) && (
                          <p className="text-xs text-slate-600 truncate mt-0.5 flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{[recipient.designation, recipient.company].filter(Boolean).join(' at ')}</span>
                          </p>
                        )}

                        {(recipient.department || recipient.batch) && (
                          <p className="text-xs text-slate-500 truncate mt-0.5 flex items-center gap-1">
                            <GraduationCap className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>
                              {[recipient.department, recipient.batch ? `Class of ${recipient.batch}` : null]
                                .filter(Boolean)
                                .join(' • ')}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Attached Note sent */}
                    {req.message && (
                      <div className="mt-3 p-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs text-slate-600 flex items-start gap-2">
                        <MessageSquareQuote className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <span className="italic leading-relaxed">{req.message}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-medium">Pending response</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAction(req._id, onWithdraw)}
                      isLoading={isLoading}
                      disabled={isLoading}
                      className="text-xs text-slate-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Withdraw
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default PendingInvitationsList;
