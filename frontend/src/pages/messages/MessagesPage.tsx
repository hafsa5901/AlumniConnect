import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Navbar, Footer, PageHeader } from '../../components/layout';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { VerifiedBadge } from '../../components/ui/VerifiedBadge';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/feedback/EmptyState';
import { CardSkeleton } from '../../components/feedback/Skeleton';
import {
  messagingService,
  ConversationItem,
  MessageItem,
  ParticipantInfo,
  useMessagingSocket,
} from '../../services/messaging';
import {
  MessageSquare,
  Send,
  Search,
  Plus,
  ArrowLeft,
  Check,
  CheckCheck,
  Clock,
  UserCheck,
  Building2,
  GraduationCap,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function MessagesPage() {
  const { user: currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeParamId = searchParams.get('id');

  // Conversations state
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [activeConversation, setActiveConversation] = useState<ConversationItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Active thread messages state
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  // Message composer state
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);

  // New Conversation Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [eligibleContacts, setEligibleContacts] = useState<ParticipantInfo[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [isAdminContactMode, setIsAdminContactMode] = useState(false);
  const [contactPage, setContactPage] = useState(1);
  const [contactTotalPages, setContactTotalPages] = useState(1);
  const [isStartingConv, setIsStartingConv] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // ── 1. Fetch Conversations ──────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    try {
      const res = await messagingService.getConversations();
      const list = res.data.data.conversations || [];
      setConversations(list);

      // Select active conversation based on URL param or default to first
      if (activeParamId) {
        const found = list.find((c) => (c.id || c._id) === activeParamId);
        if (found) {
          setActiveConversation(found);
        }
      } else if (list.length > 0 && window.innerWidth >= 768) {
        setActiveConversation(list[0]);
        setSearchParams({ id: list[0].id || list[0]._id! }, { replace: true });
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
      toast.error('Failed to load conversations.');
    } finally {
      setIsLoadingConversations(false);
    }
  }, [activeParamId, setSearchParams]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // ── 2. Fetch Messages for Active Conversation ───────────────────────────
  const fetchInitialMessages = useCallback(async (convId: string) => {
    setIsLoadingMessages(true);
    try {
      const res = await messagingService.getMessages(convId, null, 30);
      setMessages(res.data.data.messages || []);
      setHasMoreMessages(res.data.data.hasMore);
      setNextCursor(res.data.data.nextCursor);

      // Mark as read
      await messagingService.markAsRead(convId);

      // Decrement unread count locally
      setConversations((prev) =>
        prev.map((c) =>
          (c.id || c._id) === convId ? { ...c, unreadCount: 0 } : c
        )
      );
    } catch (err) {
      console.error('Failed to load messages:', err);
      toast.error('Failed to load message thread.');
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (activeConversation) {
      const convId = activeConversation.id || activeConversation._id!;
      fetchInitialMessages(convId);
    } else {
      setMessages([]);
    }
  }, [activeConversation, fetchInitialMessages]);

  // Auto-scroll to bottom on messages change
  useEffect(() => {
    if (!isLoadingOlder && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoadingOlder]);

  // ── 3. Load Older Messages (Cursor Pagination) ──────────────────────────
  const handleLoadOlder = async () => {
    if (!activeConversation || !nextCursor || isLoadingOlder) return;

    setIsLoadingOlder(true);
    const convId = activeConversation.id || activeConversation._id!;

    try {
      const res = await messagingService.getMessages(convId, nextCursor, 30);
      const older = res.data.data.messages || [];

      setMessages((prev) => [...older, ...prev]);
      setHasMoreMessages(res.data.data.hasMore);
      setNextCursor(res.data.data.nextCursor);
    } catch (err) {
      toast.error('Failed to load older messages.');
    } finally {
      setIsLoadingOlder(false);
    }
  };

  // ── 4. Socket.IO Real-Time Integration ──────────────────────────────────
  const { sendSocketMessage, markSocketRead } = useMessagingSocket({
    onNewMessage: (data) => {
      const newMsg = data.message;
      const convId = typeof newMsg.conversation === 'string' ? newMsg.conversation : (newMsg.conversation as any).id;
      const currentActiveId = activeConversation ? (activeConversation.id || activeConversation._id) : null;

      if (convId === currentActiveId) {
        setMessages((prev) => {
          // Avoid duplicate appends
          if (prev.some((m) => (m.id || m._id) === (newMsg.id || newMsg._id))) {
            return prev;
          }
          return [...prev, newMsg];
        });

        // Mark as read immediately if user is viewing this thread
        if (newMsg.recipient && (newMsg.recipient.id || newMsg.recipient._id) === currentUser?._id?.toString()) {
          markSocketRead(convId);
        }
      }

      // Update conversations preview in list
      setConversations((prev) =>
        prev.map((c) => {
          const cId = c.id || c._id;
          if (cId === convId) {
            const isViewing = convId === currentActiveId;
            return {
              ...c,
              lastMessage: newMsg.content,
              lastMessageAt: newMsg.createdAt,
              unreadCount: isViewing ? 0 : c.unreadCount + 1,
            };
          }
          return c;
        })
      );
    },

    onConversationUpdated: (data) => {
      setConversations((prev) =>
        prev.map((c) => {
          if ((c.id || c._id) === data.conversationId) {
            return {
              ...c,
              lastMessage: data.lastMessage !== undefined ? data.lastMessage : c.lastMessage,
              lastMessageAt: data.lastMessageAt !== undefined ? data.lastMessageAt : c.lastMessageAt,
              unreadCount: data.unreadCount !== undefined ? data.unreadCount : c.unreadCount,
            };
          }
          return c;
        })
      );
    },

    onMessageRead: (data) => {
      const currentActiveId = activeConversation ? (activeConversation.id || activeConversation._id) : null;
      if (data.conversationId === currentActiveId) {
        setMessages((prev) =>
          prev.map((m) => {
            if (!m.readAt) {
              return { ...m, readAt: data.readAt };
            }
            return m;
          })
        );
      }
    },

    onError: (err) => {
      if (err.code === 'ACCOUNT_SUSPENDED') {
        toast.error('Your account is suspended.');
      } else {
        toast.error(err.message || 'Messaging error occurred.');
      }
    },
  });

  // ── 5. Send Message Handler ─────────────────────────────────────────────
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = messageText.trim();
    if (!trimmed || !activeConversation || isSending) return;

    const convId = activeConversation.id || activeConversation._id!;
    setIsSending(true);

    try {
      // Send via REST endpoint (which persists and broadcasts via socket)
      const res = await messagingService.sendMessage(convId, trimmed);
      const createdMsg = res.data.data.message;

      setMessages((prev) => {
        if (prev.some((m) => (m.id || m._id) === (createdMsg.id || createdMsg._id))) {
          return prev;
        }
        return [...prev, createdMsg];
      });

      setMessageText('');

      // Update active conversation in local list
      setConversations((prev) =>
        prev.map((c) =>
          (c.id || c._id) === convId
            ? { ...c, lastMessage: trimmed, lastMessageAt: createdMsg.createdAt }
            : c
        )
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to send message.');
    } finally {
      setIsSending(false);
    }
  };

  // ── 6. New Conversation Modal & Contacts ────────────────────────────────
  const fetchEligibleContacts = async () => {
    setIsLoadingContacts(true);
    try {
      const res = await messagingService.getEligibleContacts({
        search: contactSearch || undefined,
        page: contactPage,
        limit: 20,
      });

      setEligibleContacts(res.data.data.items || []);
      setIsAdminContactMode(Boolean(res.data.data.isAdmin));
      setContactTotalPages(res.data.data.totalPages || 1);
    } catch (err) {
      console.error('Failed to load contacts:', err);
      toast.error('Failed to load eligible contacts.');
    } finally {
      setIsLoadingContacts(false);
    }
  };

  useEffect(() => {
    if (isModalOpen) {
      fetchEligibleContacts();
    }
  }, [isModalOpen, contactSearch, contactPage]);

  const handleStartConversation = async (recipientId: string) => {
    setIsStartingConv(true);
    try {
      const res = await messagingService.createConversation(recipientId);
      const conv = res.data.data.conversation;

      // Add to conversations list if not already present
      setConversations((prev) => {
        const exists = prev.some((c) => (c.id || c._id) === (conv.id || conv._id));
        if (exists) return prev;
        return [conv, ...prev];
      });

      setActiveConversation(conv);
      setSearchParams({ id: conv.id || conv._id! }, { replace: true });
      setIsModalOpen(false);
      setContactSearch('');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to start conversation.');
    } finally {
      setIsStartingConv(false);
    }
  };

  // Filtered conversation list
  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const name = c.otherParticipant?.name || '';
    const company = c.otherParticipant?.company || '';
    const query = searchQuery.toLowerCase();
    return name.toLowerCase().includes(query) || company.toLowerCase().includes(query);
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <Navbar />

      <PageHeader
        title="Direct Messages"
        subtitle="Real-time communication with your campus mentorship connections and advisors."
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row h-[720px]">
          {/* ── LEFT PANEL: Conversations Sidebar ────────────────────────── */}
          <div
            className={`w-full md:w-80 lg:w-96 border-r border-slate-200 flex flex-col bg-slate-50/50 ${
              activeConversation ? 'hidden md:flex' : 'flex'
            }`}
          >
            {/* Sidebar Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-navy-900" />
                <h2 className="font-bold text-slate-900 text-base">Chats</h2>
                <Badge variant="navy" size="sm">
                  {conversations.length}
                </Badge>
              </div>

              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => {
                  setIsModalOpen(true);
                  setContactPage(1);
                  setContactSearch('');
                }}
              >
                New Chat
              </Button>
            </div>

            {/* Search filter */}
            <div className="p-3 border-b border-slate-200 bg-white">
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4 text-slate-400" />}
                className="text-xs"
              />
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {isLoadingConversations ? (
                <div className="p-4 space-y-3">
                  <CardSkeleton />
                  <CardSkeleton />
                  <CardSkeleton />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 space-y-3">
                  <EmptyState
                    icon={MessageSquare}
                    title="No Conversations"
                    description={
                      searchQuery
                        ? 'No chats match your search query.'
                        : 'You have no active message threads yet.'
                    }
                    actionLabel="Start New Chat"
                    onAction={() => setIsModalOpen(true)}
                  />
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const convId = conv.id || conv._id!;
                  const isActive = (activeConversation?.id || activeConversation?._id) === convId;
                  const partner = conv.otherParticipant || {};

                  return (
                    <button
                      key={convId}
                      type="button"
                      onClick={() => {
                        setActiveConversation(conv);
                        setSearchParams({ id: convId }, { replace: true });
                      }}
                      className={`w-full text-left p-3.5 transition-colors flex items-start gap-3 hover:bg-slate-100/80 ${
                        isActive ? 'bg-navy-50/80 border-l-4 border-navy-900' : 'bg-transparent'
                      }`}
                    >
                      <Avatar
                        src={partner.profilePhotoUrl}
                        name={partner.name || 'User'}
                        size="md"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-bold text-slate-900 text-xs truncate">
                              {partner.name || 'Conversation'}
                            </span>
                            <VerifiedBadge
                              role={partner.role as any}
                              verificationStatus={partner.verificationStatus as any}
                              size="sm"
                            />
                          </div>

                          {conv.lastMessageAt && (
                            <span className="text-[10px] text-slate-400 whitespace-nowrap">
                              {new Date(conv.lastMessageAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-500 truncate mb-1">
                          {partner.company ? `${partner.company}` : partner.department || partner.role}
                        </p>

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-600 truncate max-w-[180px]">
                            {conv.lastMessage || 'Conversation started'}
                          </span>

                          {conv.unreadCount > 0 && (
                            <span className="bg-navy-900 text-white font-bold text-[10px] px-1.5 py-0.5 rounded-full">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ── RIGHT PANEL: Active Chat Thread ──────────────────────────── */}
          <div
            className={`flex-1 flex flex-col bg-white ${
              !activeConversation ? 'hidden md:flex' : 'flex'
            }`}
          >
            {activeConversation ? (
              <>
                {/* Thread Header */}
                <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveConversation(null)}
                      className="md:hidden p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>

                    <Avatar
                      src={activeConversation.otherParticipant?.profilePhotoUrl}
                      name={activeConversation.otherParticipant?.name || 'User'}
                      size="md"
                    />

                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                        <span>{activeConversation.otherParticipant?.name}</span>
                        <VerifiedBadge
                          role={activeConversation.otherParticipant?.role as any}
                          verificationStatus={activeConversation.otherParticipant?.verificationStatus as any}
                          size="sm"
                        />
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span className="capitalize">{activeConversation.otherParticipant?.role}</span>
                        {activeConversation.otherParticipant?.company && (
                          <span>• {activeConversation.otherParticipant?.company}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <Link
                    to={
                      activeConversation.otherParticipant?.role === 'alumni'
                        ? `/alumni/${activeConversation.otherParticipant?.id || activeConversation.otherParticipant?._id}`
                        : '#'
                    }
                    className="text-xs font-semibold text-navy-800 hover:text-navy-950 flex items-center gap-1 hover:underline"
                  >
                    <span>View Profile</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {/* Message Stream */}
                <div
                  ref={messagesContainerRef}
                  className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/40"
                >
                  {hasMoreMessages && (
                    <div className="text-center py-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleLoadOlder}
                        isLoading={isLoadingOlder}
                        leftIcon={<ChevronDown className="w-3.5 h-3.5 rotate-180" />}
                      >
                        Load Older Messages
                      </Button>
                    </div>
                  )}

                  {isLoadingMessages ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      Loading conversation...
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-16 text-xs text-slate-400 space-y-2">
                      <p className="font-semibold text-slate-600">This is the start of your message history.</p>
                      <p>Send a message below to begin chatting.</p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isSelf =
                        (msg.sender?.id || msg.sender?._id || msg.sender)?.toString() ===
                        currentUser?._id?.toString();

                      return (
                        <div
                          key={msg.id || msg._id}
                          className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                        >
                          <div
                            className={`max-w-md px-4 py-2.5 rounded-2xl text-xs leading-relaxed break-words shadow-xs ${
                              isSelf
                                ? 'bg-navy-900 text-white rounded-br-xs'
                                : 'bg-white text-slate-900 border border-slate-200/80 rounded-bl-xs'
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          </div>

                          <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400 px-1">
                            <span>
                              {new Date(msg.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>

                            {isSelf && (
                              <span>
                                {msg.readAt ? (
                                  <span className="text-blue-600 font-medium flex items-center gap-0.5" title={`Read at ${new Date(msg.readAt).toLocaleTimeString()}`}>
                                    <CheckCheck className="w-3 h-3" />
                                    Read
                                  </span>
                                ) : (
                                  <span title="Delivered">
                                    <Check className="w-3 h-3 text-slate-400" />
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Message Composer */}
                <form
                  onSubmit={handleSendMessage}
                  className="p-3.5 border-t border-slate-200 bg-white flex items-center gap-2"
                >
                  <input
                    type="text"
                    placeholder="Type your message..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    className="flex-1 text-xs px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-800 focus:border-transparent bg-slate-50/50"
                  />

                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={!messageText.trim() || isSending}
                    isLoading={isSending}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 bg-slate-50/30">
                <EmptyState
                  icon={MessageSquare}
                  title="Select a Conversation"
                  description="Choose an existing message thread from the left or start a new direct conversation."
                  actionLabel="Start New Chat"
                  onAction={() => setIsModalOpen(true)}
                />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── NEW CONVERSATION MODAL ────────────────────────────────────────── */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setContactSearch('');
        }}
        title="Start a Direct Conversation"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            {isAdminContactMode
              ? 'As an Administrator, you can search and start direct support conversations with registered users.'
              : 'You can start direct messaging with your accepted mentorship connections.'}
          </p>

          <Input
            placeholder="Search eligible contacts..."
            value={contactSearch}
            onChange={(e) => {
              setContactSearch(e.target.value);
              setContactPage(1);
            }}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />

          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
            {isLoadingContacts ? (
              <div className="p-4 space-y-2">
                <CardSkeleton />
                <CardSkeleton />
              </div>
            ) : eligibleContacts.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                {isAdminContactMode ? (
                  'No users found matching your search.'
                ) : (
                  <div>
                    <p className="font-semibold text-slate-700">No Eligible Mentorship Contacts</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Direct messaging unlocks once you have an accepted mentorship request with an alumni or student.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              eligibleContacts.map((contact) => (
                <div
                  key={contact.id || contact._id}
                  className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Avatar src={contact.profilePhotoUrl} name={contact.name} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs truncate">
                        <span>{contact.name}</span>
                        <VerifiedBadge
                          role={contact.role as any}
                          verificationStatus={contact.verificationStatus as any}
                          size="sm"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        {contact.company
                          ? `${contact.designation || 'Staff'} at ${contact.company}`
                          : contact.department || contact.email}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isStartingConv}
                    onClick={() => handleStartConversation(contact.id || contact._id!)}
                  >
                    Chat
                  </Button>
                </div>
              ))
            )}
          </div>

          {isAdminContactMode && contactTotalPages > 1 && (
            <div className="flex items-center justify-between text-xs pt-2">
              <span className="text-slate-500">
                Page {contactPage} of {contactTotalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={contactPage === 1}
                  onClick={() => setContactPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={contactPage >= contactTotalPages}
                  onClick={() => setContactPage((p) => Math.min(contactTotalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsModalOpen(false);
                setContactSearch('');
              }}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>

      <Footer />
    </div>
  );
}
