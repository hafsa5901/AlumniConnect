import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/userService';
import { Navbar, Footer, Sidebar, PageHeader } from '../../components/layout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  FileText,
  Upload,
  Trash2,
  Download,
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Lock,
  FileCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ResumeManagerPage() {
  const { user, refreshUser } = useAuth();
  const [currentUser, setCurrentUser] = useState<any>(user);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProfile = async () => {
    try {
      const res = await userService.getMe();
      setCurrentUser(res.data.data.user);
    } catch (err) {
      console.error('Failed to fetch user resume data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds the 5MB maximum limit.');
      return;
    }

    // Check allowed extensions
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['pdf', 'doc', 'docx'].includes(ext)) {
      toast.error('Invalid file type. Only PDF, DOC, and DOCX formats are supported.');
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file to upload.');
      return;
    }

    setIsUploading(true);
    try {
      await userService.uploadResume(selectedFile);
      toast.success('Resume uploaded successfully!');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (refreshUser) await refreshUser();
      await fetchProfile();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to upload resume.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete your current resume?')) {
      return;
    }

    setIsDeleting(true);
    try {
      await userService.deleteResume();
      toast.success('Resume deleted successfully.');
      if (refreshUser) await refreshUser();
      await fetchProfile();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to delete resume.');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const resume = currentUser?.resume;
  const isStudent = currentUser?.role === 'student';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <div className="flex-1 flex container-app px-4 sm:px-6 lg:px-8 py-8 gap-8">
        <Sidebar className="hidden md:flex rounded-card shadow-xs" />

        <main className="flex-1 space-y-6 min-w-0 max-w-3xl">
          <PageHeader
            title="Resume & Career Documents"
            subtitle="Manage your professional resume for career opportunities, mentorship review, and profile verification."
            actions={
              <Link to="/profile">
                <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                  Back to Profile
                </Button>
              </Link>
            }
          />

          {/* Privacy & Visibility Information Banner */}
          <Card className="p-5 border-blue-200 bg-blue-50/40 shadow-xs space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-navy-900">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Resume Privacy & Access Policy</span>
            </div>
            {isStudent ? (
              <p className="text-slate-600 leading-relaxed">
                As a current student, your resume is strictly <strong>private and access-controlled</strong>. It is only accessible to you, system administrators, and verified alumni mentors with whom you have an <strong>accepted mentorship request</strong>.
              </p>
            ) : (
              <p className="text-slate-600 leading-relaxed">
                As an alumni member, your resume is accessible to verified community members visiting your public alumni profile, enabling career connections and mentorship opportunities.
              </p>
            )}
          </Card>

          {/* Current Resume Status */}
          <Card className="p-6 border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-navy-900" />
                <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
                  Active Resume Document
                </h3>
              </div>
              {resume ? (
                <Badge variant="green" size="sm">
                  Uploaded
                </Badge>
              ) : (
                <Badge variant="yellow" size="sm">
                  Not Attached
                </Badge>
              )}
            </div>

            {resume ? (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-blue-100 text-blue-800 rounded-lg shrink-0 mt-0.5">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-bold text-navy-900 break-all">
                      {resume.originalName}
                    </h4>
                    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                      <span>Size: {formatFileSize(resume.size)}</span>
                      <span>•</span>
                      <span>Uploaded: {formatDate(resume.uploadedAt)}</span>
                      <span>•</span>
                      <span className="uppercase text-[10px] font-mono bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded">
                        {resume.originalName.split('.').pop()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <a
                    href={userService.getResumeDownloadUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn bg-navy-900 hover:bg-navy-800 text-white font-semibold text-xs transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl space-y-2">
                <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs font-semibold text-slate-600">
                  No resume has been uploaded to your profile yet.
                </p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Upload a PDF or Word document below to attach your CV to your verified profile.
                </p>
              </div>
            )}
          </Card>

          {/* Upload / Replace Document Form */}
          <Card className="p-6 border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
              {resume ? 'Replace Resume' : 'Upload New Resume'}
            </h3>

            <div className="space-y-4">
              <div className="p-5 border-2 border-dashed border-blue-200 bg-blue-50/20 rounded-xl text-center space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  id="resumeFileInput"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileChange}
                  className="sr-only"
                />

                <label
                  htmlFor="resumeFileInput"
                  className="btn btn-outline btn-sm cursor-pointer inline-flex items-center gap-2 hover:border-blue-500 hover:text-blue-600"
                >
                  <Upload className="w-4 h-4" />
                  <span>{selectedFile ? 'Choose Different File' : 'Browse Document'}</span>
                </label>

                {selectedFile ? (
                  <div className="p-3 bg-white rounded-lg border border-blue-200 max-w-md mx-auto flex items-center justify-between text-xs text-left">
                    <div className="truncate mr-2">
                      <span className="font-semibold text-navy-900 block truncate">
                        {selectedFile.name}
                      </span>
                      <span className="text-slate-500 text-[11px]">
                        {formatFileSize(selectedFile.size)}
                      </span>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    Click to browse. Supports PDF, DOC, or DOCX up to 5MB.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span>Files are checked for authenticity and stored securely.</span>
                </span>

                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleUpload}
                  disabled={!selectedFile || isUploading}
                  isLoading={isUploading}
                  leftIcon={<Upload className="w-4 h-4" />}
                >
                  {resume ? 'Confirm & Replace' : 'Upload Resume'}
                </Button>
              </div>
            </div>
          </Card>
        </main>
      </div>

      <Footer />
    </div>
  );
}
