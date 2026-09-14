export interface AnalyticsOverviewData {
  users: {
    total: number;
    verifiedAlumni: number;
    verifiedStudents: number;
    pendingVerifications: number;
    suspendedUsers: number;
    deactivatedUsers: number;
    byRole: {
      student: number;
      alumni: number;
      admin: number;
    };
  };
  modules: {
    mentorship: {
      total: number;
      accepted: number;
      completed: number;
      pending: number;
      rejected: number;
    };
    referrals: {
      total: number;
      accepted: number;
      pending: number;
      rejected: number;
      withdrawn: number;
    };
    connections: {
      accepted: number;
      pending: number;
    };
    jobs: {
      total: number;
      open: number;
      closed: number;
    };
    events: {
      total: number;
      totalRsvps: number;
    };
    messaging: {
      conversations: number;
      messages: number;
    };
  };
  distributions: {
    departments: Array<{ name: string; count: number }>;
    companies: Array<{ name: string; count: number }>;
  };
}

export interface DailyActivityItem {
  date: string;
  newUsers: number;
  newConnections: number;
  messagesSent: number;
}

export interface ActivityAnalyticsData {
  days: number;
  timeline: DailyActivityItem[];
}

export type BulkActionType = 'approve' | 'reject' | 'suspend' | 'reactivate';

export interface BulkUserActionPayload {
  action: BulkActionType;
  userIds: string[];
  reason?: string;
}

export interface BulkUserActionResult {
  processed: number;
  succeeded: string[];
  failed: Array<{ id: string; reason: string }>;
}
