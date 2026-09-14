import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { connectionsService } from '../../services/connectionsService';
import { messagingService } from '../../services/messaging';
import { ConnectionItem, ConnectionRequestItem } from '../../types/connection';
import { Navbar, Footer, PageHeader } from '../../components/layout';
import { ConnectionCard } from '../../components/network/ConnectionCard';
import { PendingInvitationsList } from '../../components/network/PendingInvitationsList';
import { Button } from '../../components/ui/Button';
import { CardSkeleton } from '../../components/feedback/Skeleton';
import { EmptyState } from '../../components/feedback/EmptyState';
import {
  Users,
  Inbox,
  UserPlus,
  Search,
  ArrowRight,
  ShieldCheck,
  Building2,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function MyNetworkPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'connections' | 'invitations'>('connections');
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [pendingReceived, setPendingReceived] = useState<ConnectionRequestItem[]>([]);
  const [pendingSent, setPendingSent] = useState<ConnectionRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalConnections, setTotalConnections] = useState(0);

  // Fetch accepted connections
  const fetchConnections = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await connectionsService.getAcceptedConnections({ page, limit: 20 });
      if (res.data?.data) {
        setConnections(res.data.data.items);
        setTotalConnections(res.data.data.total);
        setTotalPages(res.data.data.totalPages);
      }
    } catch (err: any) {
      toast.error('Failed to load connections.');
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  // Fetch pending invitations
  const fetchPendingInvitations = useCallback(async () => {
    try {
      const res = await connectionsService.getPendingRequests();
      if (res.data?.data) {
        setPendingReceived(res.data.data.received);
        setPendingSent(res.data.data.sent);
      }
    } catch {
      // Non-blocking
    }
  }, []);

  useEffect(() => {
    fetchConnections();
    fetchPendingInvitations();
  }, [fetchConnections, fetchPendingInvitations]);

  // Handle Remove Connection
  const handleRemoveConnection = async (id: string) => {
    try {
      await connectionsService.removeConnection(id);
      toast.success('Connection removed.');
      setConnections((prev) => prev.filter((c) => c._id !== id));
      setTotalConnections((prev) => Math.max(0, prev - 1));
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to remove connection.';
      toast.error(msg);
    }
  };

  // Handle Message Shortcut
  const handleMessageUser = async (targetUserId: string) => {
    try {
      const res = await messagingService.createConversation(targetUserId);
      const conv = res.data?.data?.conversation;
      const convId = conv?._id || conv?.id;
      if (convId) {
        navigate(`/messages?conversationId=${convId}`);
      } else {
        navigate('/messages');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Could not initiate conversation.';
      toast.error(msg);
    }
  };

  // Handle Accept Invitation
  const handleAcceptInvitation = async (id: string) => {
    try {
      await connectionsService.updateStatus(id, { status: 'accepted' });
      toast.success('Connection request accepted!');
      setPendingReceived((prev) => prev.filter((req) => req._id !== id));
      fetchConnections();
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to accept invitation.';
      toast.error(msg);
    }
  };

  // Handle Decline Invitation
  const handleDeclineInvitation = async (id: string) => {
    try {
      await connectionsService.updateStatus(id, { status: 'rejected' });
      toast.success('Connection request declined.');
      setPendingReceived((prev) => prev.filter((req) => req._id !== id));
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to decline invitation.';
      toast.error(msg);
    }
  };

  // Handle Withdraw Invitation
  const handleWithdrawInvitation = async (id: string) => {
    try {
      await connectionsService.withdrawRequest(id);
      toast.success('Connection request withdrawn.');
      setPendingSent((prev) => prev.filter((req) => req._id !== id));
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to withdraw invitation.';
      toast.error(msg);
    }
  };

  // Filter connections by client search
  const filteredConnections = connections.filter((conn) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const u = conn.connectedUser;
    return (
      u.name?.toLowerCase().includes(q) ||
      u.company?.toLowerCase().includes(q) ||
      u.designation?.toLowerCase().includes(q) ||
      u.department?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <span className="p-2 rounded-xl bg-navy-900 text-white shadow-sm">
                <Users className="w-5 h-5" />
              </span>
              My Professional Network
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Build and nurture relationships with fellow students and verified alumni.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/alumni">
              <Button variant="outline" size="sm" className="border-navy-200 text-navy-900 hover:bg-navy-50">
                <UserPlus className="w-4 h-4 mr-1.5 text-navy-700" />
                Find Alumni & Peers
              </Button>
            </Link>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 mb-6 gap-2">
          <button
            onClick={() => setActiveTab('connections')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'connections'
                ? 'border-navy-900 text-navy-900'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Connections</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === 'connections' ? 'bg-navy-100 text-navy-900' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {totalConnections}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('invitations')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'invitations'
                ? 'border-navy-900 text-navy-900'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span>Pending Invitations</span>
            {pendingReceived.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500 text-white font-bold">
                {pendingReceived.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'connections' ? (
          <div className="space-y-6">
            {/* Search Bar */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center gap-3">
              <Search className="w-5 h-5 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search connections by name, company, title, or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-sm bg-transparent border-none focus:outline-none text-slate-900 placeholder-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Connections Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <CardSkeleton key={i} />
                ))}
              </div>
            ) : filteredConnections.length === 0 ? (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-900">
                  {searchQuery ? 'No matching connections found' : 'No connections yet'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  {searchQuery
                    ? `No connections matched "${searchQuery}". Try refining your search query.`
                    : 'Connect with verified alumni and fellow students to exchange messages, request referrals, and collaborate.'}
                </p>
                {!searchQuery && (
                  <div className="mt-5">
                    <Link to="/alumni">
                      <Button variant="primary" size="sm" className="bg-navy-900 hover:bg-navy-800 text-white">
                        <UserPlus className="w-4 h-4 mr-1.5" />
                        Explore Alumni Directory
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredConnections.map((conn) => (
                  <ConnectionCard
                    key={conn._id}
                    connection={conn}
                    onRemove={handleRemoveConnection}
                    onMessage={handleMessageUser}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <PendingInvitationsList
            received={pendingReceived}
            sent={pendingSent}
            onAccept={handleAcceptInvitation}
            onDecline={handleDeclineInvitation}
            onWithdraw={handleWithdrawInvitation}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}
