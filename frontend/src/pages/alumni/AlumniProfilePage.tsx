import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { alumniService, AlumniDetailItem } from '../../services/alumniService';
import { Navbar, Footer, PageHeader } from '../../components/layout';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { VerifiedBadge } from '../../components/ui/VerifiedBadge';
import { ErrorState } from '../../components/feedback/ErrorState';
import { Skeleton } from '../../components/feedback/Skeleton';
import {
  Building2,
  MapPin,
  Calendar,
  GraduationCap,
  Briefcase,
  ExternalLink,
  UserCheck,
  ArrowLeft,
  Mail,
  Globe,
} from 'lucide-react';

export default function AlumniProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [alumni, setAlumni] = useState<AlumniDetailItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!id) {
      setHasError(true);
      setIsLoading(false);
      return;
    }

    alumniService
      .getAlumniById(id)
      .then((res) => {
        setAlumni(res.data.data.alumni);
      })
      .catch(() => {
        setHasError(true);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="flex-1 container-app px-4 sm:px-6 lg:px-8 py-10 space-y-6 max-w-4xl mx-auto">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48 w-full rounded-card" />
          <Skeleton className="h-64 w-full rounded-card" />
        </main>
        <Footer />
      </div>
    );
  }

  if (hasError || !alumni) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="flex-1 container-app px-4 sm:px-6 lg:px-8 py-16 flex items-center justify-center">
          <ErrorState
            type="generic"
            title="Alumni Profile Not Found"
            message="This alumni profile either does not exist, has not completed institutional verification, or is currently deactivated."
            onRetry={() => window.history.back()}
          />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 container-app px-4 sm:px-6 lg:px-8 py-10 space-y-6 max-w-4xl mx-auto">
        {/* Back Link */}
        <div>
          <Link
            to="/alumni"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-navy-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Alumni Directory</span>
          </Link>
        </div>

        {/* Profile Hero Header Card */}
        <Card className="p-8 border-slate-200 shadow-card space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <Avatar name={alumni.name} src={alumni.profilePhotoUrl} size="xl" />
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">
                    {alumni.name}
                  </h1>
                  <VerifiedBadge role="alumni" verificationStatus="admin_approved" size="md" />
                </div>
                <p className="text-sm font-semibold text-slate-700">
                  {alumni.designation || 'Alumni Member'}
                  {alumni.company && <span> @ {alumni.company}</span>}
                </p>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                  <span className="flex items-center gap-1">
                    <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                    {alumni.department} • Class of {alumni.batch}
                  </span>
                  {alumni.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {alumni.location}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Mentorship Status Badge */}
            <div className="sm:self-center">
              {alumni.mentorshipEnabled ? (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-center space-y-1">
                  <div className="text-xs font-bold text-green-700 flex items-center justify-center gap-1">
                    <UserCheck className="w-4 h-4 text-green-600" />
                    <span>Open to Mentorship</span>
                  </div>
                  <p className="text-[11px] text-green-600 max-w-[160px]">
                    Available for resume feedback & career discussions.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-400">
                  Mentorship inactive
                </div>
              )}
            </div>
          </div>

          {/* Links Row */}
          {alumni.links && Object.keys(alumni.links).length > 0 && (
            <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-3 text-xs">
              {Object.entries(alumni.links).map(([key, url]) => (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn bg-slate-50 hover:bg-slate-100 border border-slate-200 font-semibold text-navy-900 transition-colors"
                >
                  <Globe className="w-3.5 h-3.5 text-slate-500" />
                  <span className="capitalize">{key}</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>
              ))}
            </div>
          )}
        </Card>

        {/* Bio Card */}
        {alumni.bio && (
          <Card className="p-6 border-slate-200 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider">About & Bio</h3>
            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
              {alumni.bio}
            </p>
          </Card>
        )}

        {/* Skills Card */}
        {alumni.skills && alumni.skills.length > 0 && (
          <Card className="p-6 border-slate-200 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
              Core Skills & Expertise
            </h3>
            <div className="flex flex-wrap gap-2">
              {alumni.skills.map((skill, idx) => (
                <Badge key={idx} variant="blue" size="md">
                  {skill}
                </Badge>
              ))}
            </div>
          </Card>
        )}

        {/* Career Experience Timeline */}
        {alumni.experience && alumni.experience.length > 0 && (
          <Card className="p-6 border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-navy-900" />
              <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
                Career History
              </h3>
            </div>

            <div className="divide-y divide-slate-100 space-y-4">
              {alumni.experience.map((exp, idx) => (
                <div key={idx} className="pt-3 first:pt-0 space-y-1">
                  <div className="flex justify-between items-start">
                    <h4 className="text-sm font-bold text-navy-900">{exp.title}</h4>
                    <span className="text-[11px] font-mono text-slate-400">
                      {exp.startDate} – {exp.endDate || 'Present'}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-blue-600">{exp.company}</div>
                  {exp.description && (
                    <p className="text-xs text-slate-500 pt-1 leading-relaxed">
                      {exp.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Education Timeline */}
        {alumni.education && alumni.education.length > 0 && (
          <Card className="p-6 border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-navy-900" />
              <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
                Academic Background
              </h3>
            </div>

            <div className="divide-y divide-slate-100 space-y-4">
              {alumni.education.map((edu, idx) => (
                <div key={idx} className="pt-3 first:pt-0 space-y-1">
                  <div className="flex justify-between items-start">
                    <h4 className="text-sm font-bold text-navy-900">{edu.institution}</h4>
                    <span className="text-[11px] font-mono text-slate-400">
                      {edu.startYear} – {edu.endYear || 'Present'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 font-medium">
                    {edu.degree} in {edu.field}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </main>

      <Footer />
    </div>
  );
}
