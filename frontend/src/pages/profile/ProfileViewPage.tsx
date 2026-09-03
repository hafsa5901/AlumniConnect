import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/userService';
import { Navbar, Footer, Sidebar, PageHeader } from '../../components/layout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { VerifiedBadge } from '../../components/ui/VerifiedBadge';
import {
  Edit3,
  Building2,
  MapPin,
  Sparkles,
  GraduationCap,
  Briefcase,
  Globe,
  UserCheck,
  ShieldCheck,
  Lock,
} from 'lucide-react';

export default function ProfileViewPage() {
  const { user, refreshUser } = useAuth();
  const [profileCompletion, setProfileCompletion] = useState<number>(0);
  const [freshUser, setFreshUser] = useState<any>(user);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    userService
      .getMe()
      .then((res) => {
        setFreshUser(res.data.data.user);
        setProfileCompletion(res.data.data.profileCompletion);
      })
      .catch((err) => {
        console.error('Failed to load user profile:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const currentUser = freshUser || user;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <div className="flex-1 flex container-app px-4 sm:px-6 lg:px-8 py-8 gap-8">
        {/* Sidebar Shell */}
        <Sidebar className="hidden md:flex rounded-card shadow-xs" />

        {/* Main Content Area */}
        <main className="flex-1 space-y-6 min-w-0">
          <PageHeader
            title="My Profile"
            subtitle="View your public profile details, academic records, and career timeline."
            actions={
              <Link to="/profile/edit">
                <Button variant="primary" size="sm" leftIcon={<Edit3 className="w-4 h-4" />}>
                  Edit Profile
                </Button>
              </Link>
            }
          />

          {/* Profile Strength Meter */}
          <Card className="p-5 border-blue-200 bg-blue-50/30 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-navy-900">
                  Profile Completion: {profileCompletion}%
                </h3>
              </div>
              <div className="w-full max-w-sm bg-slate-200 h-2 rounded-full overflow-hidden mt-1.5">
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
          </Card>

          {/* Main User Card */}
          <Card className="p-6 border-slate-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar name={currentUser?.name || ''} src={currentUser?.profilePhotoUrl} size="lg" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-navy-900">{currentUser?.name}</h2>
                    <VerifiedBadge role={currentUser?.role} verificationStatus={currentUser?.verificationStatus} size="sm" />
                  </div>
                  <div className="text-xs text-slate-600 font-medium">
                    {currentUser?.designation || (currentUser?.role === 'alumni' ? 'Alumni Graduate' : 'Current Student')}
                    {currentUser?.company && <span> @ {currentUser.company}</span>}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">{currentUser?.email}</div>
                </div>
              </div>

              <div className="flex gap-2">
                <Badge variant={currentUser?.role === 'alumni' ? 'blue' : 'green'} size="md">
                  {currentUser?.role}
                </Badge>
              </div>
            </div>

            {/* Read-Only Institutional Record Banner */}
            <div className="p-4 bg-slate-50 rounded-card border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-navy-900">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>Verified Academic Credentials (Immutable)</span>
              </div>
              <div className="grid sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <span className="text-slate-400 block text-[11px]">Department</span>
                  <span className="font-semibold text-navy-900">{currentUser?.department || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Batch / Class</span>
                  <span className="font-semibold text-navy-900">Class of {currentUser?.batch || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Campus ID</span>
                  <span className="font-mono text-navy-900">{currentUser?.studentId || currentUser?.alumniId || 'Recorded'}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 pt-1 italic">
                Institutional records are verified by the university registrar. Contact your institution admin to correct these details.
              </p>
            </div>

            {/* Bio */}
            {currentUser?.bio && (
              <div className="space-y-1 text-xs">
                <h4 className="font-bold text-navy-900 uppercase tracking-wider">Bio</h4>
                <p className="text-slate-600 leading-relaxed whitespace-pre-line">{currentUser.bio}</p>
              </div>
            )}

            {/* Skills */}
            {currentUser?.skills && currentUser.skills.length > 0 && (
              <div className="space-y-2 text-xs">
                <h4 className="font-bold text-navy-900 uppercase tracking-wider">Skills</h4>
                <div className="flex flex-wrap gap-1.5">
                  {currentUser.skills.map((s: string, i: number) => (
                    <Badge key={i} variant="blue" size="sm">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Links */}
            {currentUser?.links && Object.keys(currentUser.links).length > 0 && (
              <div className="space-y-2 text-xs">
                <h4 className="font-bold text-navy-900 uppercase tracking-wider">Profile Links</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(currentUser.links).map(([k, v]) => (
                    <a
                      key={k}
                      href={v as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-slate-50 border border-slate-200 text-navy-900 font-semibold text-xs hover:bg-slate-100"
                    >
                      <Globe className="w-3 h-3 text-slate-500" />
                      <span className="capitalize">{k}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </main>
      </div>

      <Footer />
    </div>
  );
}
