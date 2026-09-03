import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/userService';
import { Navbar, Footer, Sidebar, PageHeader } from '../../components/layout';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { VerifiedBadge } from '../../components/ui/VerifiedBadge';
import { CardSkeleton } from '../../components/feedback/Skeleton';
import {
  Sparkles,
  Users,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Building2,
  Calendar,
  Briefcase,
} from 'lucide-react';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [profileCompletion, setProfileCompletion] = useState<number>(0);
  const [alumniPreview, setAlumniPreview] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    userService
      .getStudentDashboard()
      .then((res) => {
        setProfileCompletion(res.data.data.profileCompletion || 0);
        setAlumniPreview(res.data.data.alumniPreview || []);
      })
      .catch((err) => {
        console.error('Failed to load student dashboard:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <div className="flex-1 flex container-app px-4 sm:px-6 lg:px-8 py-8 gap-8">
        {/* Left Sidebar Shell */}
        <Sidebar className="hidden md:flex rounded-card shadow-xs" />

        {/* Main Dashboard Area */}
        <main className="flex-1 space-y-8 min-w-0">
          <PageHeader
            title={`Welcome back, ${user?.name?.split(' ')[0] || 'Student'}`}
            subtitle="Explore verified alumni graduates from your department, request mentorship, and discover career paths."
            actions={
              <Link to="/alumni">
                <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Browse Directory
                </Button>
              </Link>
            }
          />

          {/* Profile Completion Card */}
          <Card className="p-6 border-blue-200 bg-blue-50/30 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-navy-900">
                    Profile Strength: {profileCompletion}%
                  </h3>
                </div>
                <p className="text-xs text-slate-500 max-w-xl">
                  {profileCompletion === 100
                    ? 'Your profile is completely filled out! Alumni mentors can easily understand your academic focus.'
                    : 'Complete your bio, skills, and portfolio links to improve mentorship match rates.'}
                </p>
                {/* Progress bar */}
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

          {/* Featured Alumni Mentors Preview */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-navy-900">Verified Alumni Highlights</h3>
                <p className="text-xs text-slate-500">Graduates actively open to campus networking</p>
              </div>
              <Link
                to="/alumni"
                className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {isLoading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <CardSkeleton count={3} />
              </div>
            ) : alumniPreview.length === 0 ? (
              <Card className="p-8 text-center text-slate-500 text-xs">
                No verified alumni in your department preview yet.
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {alumniPreview.map((alumni) => (
                  <Card key={alumni._id || alumni.id} hoverable className="p-5 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <Avatar name={alumni.name} src={alumni.profilePhotoUrl} size="md" />
                        <VerifiedBadge role="alumni" verificationStatus="admin_approved" size="sm" />
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-navy-900 leading-tight">
                          {alumni.name}
                        </h4>
                        <div className="text-xs text-slate-600 font-medium mt-0.5">
                          {alumni.designation || 'Alumni Graduate'}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{alumni.company || alumni.department}</span>
                        </div>
                      </div>

                      {alumni.skills && alumni.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {alumni.skills.slice(0, 3).map((skill: string, idx: number) => (
                            <Badge key={idx} variant="blue" size="sm">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      {alumni.mentorshipEnabled ? (
                        <span className="text-[11px] text-green-700 font-semibold flex items-center gap-1">
                          <UserCheck className="w-3 h-3" /> Mentor
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Alumni Member</span>
                      )}
                      <Link to={`/alumni/${alumni._id || alumni.id}`}>
                        <Button variant="ghost" size="sm">
                          View Profile
                        </Button>
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
