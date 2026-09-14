import React from 'react';
import { Card, CardContent } from '../ui/Card';
import {
  Users,
  GraduationCap,
  Briefcase,
  UserCheck,
  UserX,
  MessageSquare,
  Calendar,
  Handshake,
  UserPlus,
  Compass,
} from 'lucide-react';
import { AnalyticsOverviewData } from '../../types/adminAnalytics';

interface AnalyticsOverviewCardsProps {
  overview: AnalyticsOverviewData;
}

export const AnalyticsOverviewCards: React.FC<AnalyticsOverviewCardsProps> = ({ overview }) => {
  const { users, modules } = overview;

  const topStats = [
    {
      title: 'Total Users',
      value: users.total.toLocaleString(),
      subtitle: `${users.byRole.alumni} Alumni · ${users.byRole.student} Students · ${users.byRole.admin} Admins`,
      icon: Users,
      color: 'bg-blue-500/10 text-blue-600',
    },
    {
      title: 'Verified Alumni',
      value: users.verifiedAlumni.toLocaleString(),
      subtitle: `${users.verifiedStudents} Verified Students`,
      icon: GraduationCap,
      color: 'bg-emerald-500/10 text-emerald-600',
    },
    {
      title: 'Pending Approvals',
      value: users.pendingVerifications.toLocaleString(),
      subtitle: `${users.suspendedUsers} Suspended · ${users.deactivatedUsers} Deactivated`,
      icon: UserCheck,
      color: users.pendingVerifications > 0 ? 'bg-amber-500/10 text-amber-600' : 'bg-slate-500/10 text-slate-600',
    },
    {
      title: 'Active Network Connections',
      value: modules.connections.accepted.toLocaleString(),
      subtitle: `${modules.connections.pending} Pending Requests`,
      icon: Handshake,
      color: 'bg-indigo-500/10 text-indigo-600',
    },
  ];

  const moduleStats = [
    {
      title: 'Mentorship Program',
      icon: Compass,
      primary: `${modules.mentorship.accepted + modules.mentorship.completed} Active / Completed`,
      details: [
        { label: 'Total Requests', value: modules.mentorship.total },
        { label: 'Accepted', value: modules.mentorship.accepted },
        { label: 'Completed', value: modules.mentorship.completed },
        { label: 'Pending', value: modules.mentorship.pending },
        { label: 'Rejected', value: modules.mentorship.rejected },
      ],
      color: 'text-purple-600',
    },
    {
      title: 'Job Referrals',
      icon: UserPlus,
      primary: `${modules.referrals.accepted} Accepted Referrals`,
      details: [
        { label: 'Total Requests', value: modules.referrals.total },
        { label: 'Accepted', value: modules.referrals.accepted },
        { label: 'Pending', value: modules.referrals.pending },
        { label: 'Rejected', value: modules.referrals.rejected },
        { label: 'Withdrawn', value: modules.referrals.withdrawn },
      ],
      color: 'text-teal-600',
    },
    {
      title: 'Career & Opportunities',
      icon: Briefcase,
      primary: `${modules.jobs.open} Open Listings`,
      details: [
        { label: 'Total Jobs', value: modules.jobs.total },
        { label: 'Open', value: modules.jobs.open },
        { label: 'Closed', value: modules.jobs.closed },
      ],
      color: 'text-blue-600',
    },
    {
      title: 'Events & Engagement',
      icon: Calendar,
      primary: `${modules.events.totalRsvps} Total RSVPs`,
      details: [
        { label: 'Published Events', value: modules.events.total },
        { label: 'Attendee RSVPs', value: modules.events.totalRsvps },
      ],
      color: 'text-rose-600',
    },
    {
      title: 'Platform Messaging',
      icon: MessageSquare,
      primary: `${modules.messaging.messages.toLocaleString()} Messages`,
      details: [
        { label: 'Conversations', value: modules.messaging.conversations },
        { label: 'Total Messages', value: modules.messaging.messages },
      ],
      color: 'text-sky-600',
    },
    {
      title: 'Account Moderation',
      icon: UserX,
      primary: `${users.suspendedUsers + users.deactivatedUsers} Restricted Accounts`,
      details: [
        { label: 'Suspended Users', value: users.suspendedUsers },
        { label: 'Deactivated Users', value: users.deactivatedUsers },
      ],
      color: 'text-amber-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Level Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {topStats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <Card key={idx} className="border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {stat.title}
                  </span>
                  <div className={`p-2.5 rounded-lg ${stat.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-bold text-navy-900 tracking-tight">{stat.value}</div>
                  <div className="text-xs text-slate-500 mt-1 font-medium">{stat.subtitle}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Module Level Metric Cards */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
          Module Operations & Health
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {moduleStats.map((mod, idx) => {
            const Icon = mod.icon;
            return (
              <Card key={idx} className="border border-slate-200/80 shadow-xs">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2.5 mb-3">
                    <Icon className={`w-5 h-5 ${mod.color}`} />
                    <h4 className="font-bold text-navy-900 text-sm">{mod.title}</h4>
                  </div>
                  <div className="text-lg font-semibold text-navy-900 mb-3 pb-2 border-b border-slate-100">
                    {mod.primary}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {mod.details.map((d, dIdx) => (
                      <div key={dIdx} className="flex justify-between items-center py-0.5">
                        <span className="text-slate-500">{d.label}:</span>
                        <span className="font-semibold text-navy-900">{d.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};
