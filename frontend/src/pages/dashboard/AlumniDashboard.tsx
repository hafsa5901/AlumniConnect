import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/userService';
import { Navbar, Footer, Sidebar, PageHeader } from '../../components/layout';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { VerifiedBadge } from '../../components/ui/VerifiedBadge';
import { CardSkeleton } from '../../components/feedback/Skeleton';
import {
  Sparkles,
  Users,
  Briefcase,
  Building2,
  MapPin,
  CheckCircle2,
  ArrowRight,
  UserCheck,
  Edit3,
} from 'lucide-react';

export default function AlumniDashboard() {
  const { user } = useAuth();
  const [profileCompletion, setProfileCompletion] = useState<number>(0);
  const [professionalSummary, setProfessionalSummary] = useState<any>(null);
  const [networkStats, setNetworkStats] = useState<{ departmentAlumniCount: number; batchAlumniCount: number }>({
    departmentAlumniCount: 0,
    batchAlumniCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    userService
      .getAlumniDashboard()
      .then((res) => {
        setProfileCompletion(res.data.data.profileCompletion || 0);
        setProfessionalSummary(res.data.data.professionalSummary || null);
        setNetworkStats(res.data.data.networkStats || { departmentAlumniCount: 0, batchAlumniCount: 0 });
      })
      .catch((err) => {
        console.error('Failed to load alumni dashboard:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <div className="flex-1 flex container-app px-4 sm:px-6 lg:px-8 py-8 gap-8">
        {/* Sidebar Navigation Shell */}
        <Sidebar className="hidden md:flex rounded-card shadow-xs" />

        {/* Main Content Area */}
        <main className="flex-1 space-y-8 min-w-0">
          <PageHeader
            title={`Welcome back, ${user?.name?.split(' ')[0] || 'Alumni'}`}
            subtitle="Manage your professional presence, engage with campus graduates, and mentor aspiring students."
            actions={
              <Link to="/profile/edit">
                <Button variant="primary" size="sm" leftIcon={<Edit3 className="w-4 h-4" />}>
                  Edit Profile
                </Button>
              </Link>
            }
          />

          {/* Profile Strength Meter */}
          <Card className="p-6 border-blue-200 bg-blue-50/30 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-navy-900">
                    Alumni Profile Completeness: {profileCompletion}%
                  </h3>
                </div>
                <p className="text-xs text-slate-500 max-w-xl">
                  {profileCompletion === 100
                    ? 'Your alumni profile is fully detailed! Students and peers can easily connect with your career journey.'
                    : 'Add your current company, designation, skills, and past experience to unlock maximum network visibility.'}
                </p>
                <div className="w-full max-w-md bg-slate-200 h-2 rounded-full overflow-hidden mt-2">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${profileCompletion}%` }}
                  />
                </div>
              </div>

              {profileCompletion < 100 && (
                <Link to="/profile/edit">
                  <Button variant="outline" size="sm">
                    Complete Profile
                  </Button>
                </Link>
              )}
            </div>
          </Card>

          {/* Top Row: Professional Snapshot & Network Stats */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Card 1: Professional Snapshot */}
            <Card className="p-6 border-slate-200 shadow-xs space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={user?.name || 'User'} src={user?.profilePhotoUrl} size="lg" />
                  <div>
                    <h3 className="text-base font-bold text-navy-900">{user?.name}</h3>
                    <div className="text-xs text-slate-600 font-medium">
                      {professionalSummary?.designation || 'No designation set'}
                    </div>
                  </div>
                </div>
                <VerifiedBadge role={user?.role} verificationStatus={user?.verificationStatus} size="sm" />
              </div>

              <div className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{professionalSummary?.company || 'Company not specified'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{professionalSummary?.location || 'Location not specified'}</span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  {professionalSummary?.mentorshipEnabled ? (
                    <Badge variant="green" size="sm">
                      <UserCheck className="w-3 h-3 mr-1" /> Open to Mentoring
                    </Badge>
                  ) : (
                    <Badge variant="gray" size="sm">
                      Mentorship Inactive
                    </Badge>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <Link to="/profile/edit">
                  <Button variant="outline" size="sm" className="w-full justify-center">
                    Update Professional Details
                  </Button>
                </Link>
              </div>
            </Card>

            {/* Card 2: Campus Network Stats */}
            <Card className="p-6 border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <h3 className="text-base font-bold text-navy-900 mb-1">Campus Network Reach</h3>
                <p className="text-xs text-slate-500">
                  Verified alumni connected to your university background.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 py-2">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <span className="font-mono text-3xl font-extrabold text-blue-600">
                    {networkStats.departmentAlumniCount}
                  </span>
                  <div className="text-[11px] font-semibold text-slate-500 mt-1">
                    Department Peers ({user?.department || 'Major'})
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <span className="font-mono text-3xl font-extrabold text-navy-900">
                    {networkStats.batchAlumniCount}
                  </span>
                  <div className="text-[11px] font-semibold text-slate-500 mt-1">
                    Batch Classmates (Class of {user?.batch || '—'})
                  </div>
                </div>
              </div>

              <Link to="/alumni">
                <Button variant="primary" size="sm" className="w-full justify-center" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Explore Full Alumni Directory
                </Button>
              </Link>
            </Card>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
