import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { alumniService, AlumniListItem } from '../../services/alumniService';
import { Navbar, Footer, PageHeader } from '../../components/layout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { VerifiedBadge } from '../../components/ui/VerifiedBadge';
import { EmptyState } from '../../components/feedback/EmptyState';
import { CardSkeleton } from '../../components/feedback/Skeleton';
import {
  Search,
  Building2,
  MapPin,
  UserCheck,
  Filter,
  ArrowRight,
  GraduationCap,
  Sparkles,
} from 'lucide-react';

export default function AlumniDirectoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [department, setDepartment] = useState('');
  const [batch, setBatch] = useState('');
  const [alumni, setAlumni] = useState<AlumniListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchAlumni = useCallback(async (searchQuery: string, dept: string, batchYear: string, pageNum: number) => {
    setIsLoading(true);
    try {
      const res = await alumniService.listAlumni({
        search: searchQuery || undefined,
        department: dept || undefined,
        batch: batchYear || undefined,
        page: pageNum,
        limit: 12,
      });
      setAlumni(res.data.data.alumni || []);
      setTotal(res.data.data.pagination.total);
      setTotalPages(res.data.data.pagination.totalPages);
    } catch (err) {
      console.error('Failed to load alumni directory:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search effect (350ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchAlumni(searchTerm, department, batch, page);
    }, 350);

    return () => clearTimeout(handler);
  }, [searchTerm, department, batch, page, fetchAlumni]);

  const handleDepartmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDepartment(e.target.value);
    setPage(1);
  };

  const handleBatchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setBatch(e.target.value);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 container-app px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <PageHeader
          title="Verified Alumni Directory"
          subtitle="Explore authenticated university graduates, connect with industry leaders, and discover career opportunities."
        />

        {/* Filter & Search Bar */}
        <div className="bg-white p-4 sm:p-6 rounded-card border border-slate-200 shadow-xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className="sm:col-span-6">
              <Input
                id="searchAlumni"
                placeholder="Search by name, company, job title, skills..."
                leftIcon={<Search className="w-4 h-4 text-slate-400" />}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {/* Department Filter */}
            <div className="sm:col-span-3">
              <Select
                id="filterDept"
                value={department}
                onChange={handleDepartmentChange}
                options={[
                  { value: '', label: 'All Departments' },
                  { value: 'Computer Science', label: 'Computer Science' },
                  { value: 'Information Technology', label: 'Information Technology' },
                  { value: 'Electrical Engineering', label: 'Electrical Engineering' },
                  { value: 'Mechanical Engineering', label: 'Mechanical Engineering' },
                  { value: 'Business Administration', label: 'Business Administration' },
                  { value: 'Biotechnology', label: 'Biotechnology' },
                ]}
              />
            </div>

            {/* Batch Filter */}
            <div className="sm:col-span-3">
              <Select
                id="filterBatch"
                value={batch}
                onChange={handleBatchChange}
                options={[
                  { value: '', label: 'All Graduation Years' },
                  { value: '2024', label: 'Class of 2024' },
                  { value: '2023', label: 'Class of 2023' },
                  { value: '2022', label: 'Class of 2022' },
                  { value: '2021', label: 'Class of 2021' },
                  { value: '2020', label: 'Class of 2020' },
                  { value: '2019', label: 'Class of 2019' },
                  { value: '2018', label: 'Class of 2018' },
                ]}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
            <span>
              Showing <strong className="text-navy-900">{alumni.length}</strong> of{' '}
              <strong className="text-navy-900">{total}</strong> verified graduates
            </span>
            {(searchTerm || department || batch) && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setDepartment('');
                  setBatch('');
                  setPage(1);
                }}
                className="text-blue-600 hover:underline font-semibold"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* 12-Item Grid */}
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            <CardSkeleton count={8} />
          </div>
        ) : alumni.length === 0 ? (
          <EmptyState
            type="search"
            title="No alumni match your search"
            description="Try broadening your search term or selecting 'All Departments' to see more members."
            actionLabel="Clear Filters"
            onAction={() => {
              setSearchTerm('');
              setDepartment('');
              setBatch('');
              setPage(1);
            }}
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {alumni.map((member) => (
              <Card
                key={member.id}
                hoverable
                className="p-5 flex flex-col justify-between space-y-4 border-slate-200 shadow-xs"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <Avatar name={member.name} src={member.profilePhotoUrl} size="md" />
                    <VerifiedBadge role="alumni" verificationStatus="admin_approved" size="sm" />
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-navy-900 leading-tight">
                      {member.name}
                    </h3>
                    <div className="text-xs text-slate-600 font-medium mt-0.5">
                      {member.designation || 'Alumni Member'}
                    </div>
                    {member.company && (
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{member.company}</span>
                      </div>
                    )}
                    {member.location && (
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{member.location}</span>
                      </div>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500 bg-slate-50 rounded p-1.5 border border-slate-100 flex items-center justify-between">
                    <span className="truncate">{member.department}</span>
                    <span className="font-semibold text-navy-900 shrink-0 ml-1">'{member.batch?.slice(-2)}</span>
                  </div>

                  {member.skills && member.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {member.skills.slice(0, 3).map((skill, idx) => (
                        <Badge key={idx} variant="blue" size="sm">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  {member.mentorshipEnabled ? (
                    <span className="text-[10px] text-green-700 font-bold bg-green-50 px-1.5 py-0.5 rounded border border-green-200">
                      Open to Mentoring
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">Graduate</span>
                  )}
                  <Link to={`/alumni/${member.id}`}>
                    <Button variant="ghost" size="sm">
                      View Profile
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 text-xs text-slate-500">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
