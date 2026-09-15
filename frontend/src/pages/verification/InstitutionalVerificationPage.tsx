import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  verificationService,
  CollegeItem,
  VerificationRequestItem,
} from '../../services/verification.service';
import { Button, Card } from '../../components/ui';
import {
  Building2,
  CheckCircle2,
  AlertTriangle,
  Upload,
  FileText,
  Clock,
  XCircle,
  ArrowLeft,
  Search,
  ShieldCheck,
  Info,
} from 'lucide-react';

export default function InstitutionalVerificationPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  // Data states
  const [colleges, setColleges] = useState<CollegeItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollege, setSelectedCollege] = useState<CollegeItem | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [note, setNote] = useState('');

  // Page states
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [existingRequest, setExistingRequest] = useState<VerificationRequestItem | null>(null);

  // Fetch initial data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [collegesRes, myReqRes] = await Promise.all([
          verificationService.getColleges('', 1, 100),
          verificationService.getMyVerification().catch(() => ({
            data: { success: false, data: { hasRequest: false, verificationRequest: null, user: null } },
          })),
        ]);

        if (collegesRes.data?.data?.items) {
          setColleges(collegesRes.data.data.items);
        }

        if (myReqRes.data?.data?.hasRequest && myReqRes.data.data.verificationRequest) {
          const req = myReqRes.data.data.verificationRequest;
          setExistingRequest(req);
          if (req.college) {
            setSelectedCollege(req.college);
          }
        }
      } catch (err: any) {
        setError(err.response?.data?.error?.message || 'Failed to load verification status.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Search colleges
  const filteredColleges = colleges.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.domains.some((d) => d.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Check domain match
  const userDomain = user?.email?.split('@')[1]?.toLowerCase().trim() || '';
  const isDomainMatched = selectedCollege
    ? selectedCollege.domains.some((d) => d.toLowerCase().trim() === userDomain)
    : false;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        setError('Document exceeds maximum size limit of 5MB.');
        return;
      }
      setDocumentFile(file);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCollege) {
      setError('Please select your affiliated college or university.');
      return;
    }

    if (!documentFile && !isDomainMatched) {
      setError('A verification proof document (ID card, degree, or letter) is required.');
      return;
    }

    if (user?.role === 'alumni' && !documentFile) {
      setError('Alumni verification requires an official proof document for administrative review.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const formData = new FormData();
      formData.append('collegeId', selectedCollege._id || selectedCollege.id);
      if (documentFile) {
        formData.append('document', documentFile);
      }
      if (note.trim()) {
        formData.append('note', note.trim());
      }

      let res;
      if (existingRequest && existingRequest.status === 'rejected') {
        res = await verificationService.resubmitVerification(formData);
      } else {
        res = await verificationService.submitVerification(formData);
      }

      setSuccessMessage(res.data.data.message || 'Verification submitted successfully.');
      if (refreshUser) await refreshUser();

      // Refresh request
      const updated = await verificationService.getMyVerification();
      if (updated.data?.data?.verificationRequest) {
        setExistingRequest(updated.data.data.verificationRequest);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to submit verification request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <Link
            to="/verification-status"
            className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-navy-900"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to Account Standing
          </Link>
          <span className="text-xs font-semibold px-2.5 py-1 bg-navy-50 text-navy-800 rounded-full border border-navy-200">
            Phase 7C Institutional Trust
          </span>
        </div>

        <Card className="p-8 shadow-card border border-slate-200">
          <div className="border-b border-slate-200 pb-5 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-navy-900 flex items-center justify-center text-white">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-navy-900">
                  Institutional Affiliation Verification
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Link your account to your canonical institution and provide proof for administrative validation.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-sm text-red-700">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
              <div>
                <p className="font-semibold">Submission Error</p>
                <p className="text-xs mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-sm text-emerald-800">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600" />
              <div>
                <p className="font-semibold">Success</p>
                <p className="text-xs mt-0.5">{successMessage}</p>
              </div>
            </div>
          )}

          {/* Existing Request Banner */}
          {existingRequest && existingRequest.status === 'pending' && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-sm">Review in Progress</h3>
              </div>
              <p className="text-xs text-amber-800">
                Your verification request for <strong className="font-semibold">{existingRequest.college?.name}</strong> is currently pending administrative review. You will receive an update once an administrator has evaluated your credentials.
              </p>
              <div className="pt-2 text-xs text-slate-600 flex justify-between border-t border-amber-200">
                <span>Submitted: {new Date(existingRequest.createdAt).toLocaleDateString()}</span>
                <span>Document: {existingRequest.document?.originalName || 'None'}</span>
              </div>
            </div>
          )}

          {existingRequest && existingRequest.status === 'rejected' && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 space-y-2">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-600" />
                <h3 className="font-bold text-sm">Prior Request Declined</h3>
              </div>
              <p className="text-xs text-red-800">
                Reason provided: <span className="font-medium">{existingRequest.rejectionReason || 'Incomplete or unverified documentation.'}</span>
              </p>
              <p className="text-xs text-slate-600">
                You may select a different institution or attach updated documentation and resubmit below.
              </p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: College Selection */}
            <div>
              <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-2">
                1. Select Institution
              </label>
              <div className="relative mb-3">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by college name, abbreviation, or domain..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-navy-900 focus:border-navy-900"
                />
              </div>

              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
                {filteredColleges.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    No matching colleges found. Please check spelling or contact support to request adding your institution.
                  </div>
                ) : (
                  filteredColleges.map((c) => {
                    const isSelected = selectedCollege?._id === c._id || selectedCollege?.id === c.id;
                    return (
                      <div
                        key={c._id || c.id}
                        onClick={() => setSelectedCollege(c)}
                        className={`p-3 text-xs cursor-pointer flex items-center justify-between transition-colors ${
                          isSelected ? 'bg-navy-50 text-navy-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div>
                          <p className="font-bold text-navy-900">{c.name} ({c.code})</p>
                          <p className="text-slate-500 text-[11px] mt-0.5">
                            Domains: {c.domains.join(', ')} • {c.location || 'Campus'}
                          </p>
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-navy-900 flex-shrink-0" />}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Selected College Domain Match Banner */}
            {selectedCollege && (
              <div
                className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
                  isDomainMatched
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                {isDomainMatched ? (
                  <ShieldCheck className="w-5 h-5 flex-shrink-0 text-emerald-600 mt-0.5" />
                ) : (
                  <Info className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
                )}
                <div className="space-y-1">
                  <p className="font-bold">
                    {isDomainMatched
                      ? 'Official Domain Match Confirmed'
                      : 'Personal or Non-Matching Email Address'}
                  </p>
                  <p>
                    Your registered email address (<strong className="font-mono">{user?.email}</strong>) {isDomainMatched ? 'matches' : 'does not match'} the official domain(s) on file for {selectedCollege.name}.
                  </p>
                  {user?.role === 'student' && isDomainMatched && (
                    <p className="font-medium text-emerald-700">
                      Students with an institutional email match can complete verification without proof documents.
                    </p>
                  )}
                  {user?.role === 'alumni' && (
                    <p className="font-medium text-amber-800">
                      Note: Per platform trust guidelines, alumni verification unconditionally requires proof documentation and administrative review.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Upload Proof Document */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider">
                  2. Proof Document {user?.role === 'student' && isDomainMatched ? '(Optional)' : '(Required)'}
                </label>
                <span className="text-[11px] text-slate-500">PDF, PNG, JPG up to 5MB</span>
              </div>

              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-navy-900 transition-colors bg-white">
                <input
                  type="file"
                  id="proof-document-input"
                  onChange={handleFileChange}
                  accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                  className="hidden"
                />
                <label htmlFor="proof-document-input" className="cursor-pointer flex flex-col items-center">
                  <Upload className="w-8 h-8 text-slate-400 mb-2" />
                  <span className="text-xs font-semibold text-navy-900">
                    {documentFile ? documentFile.name : 'Click to select or drag and drop proof file'}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-1">
                    Student ID, Alumni Degree Certificate, Transcripts, or Institutional Letter
                  </span>
                </label>
              </div>
            </div>

            {/* Step 3: Additional Notes */}
            <div>
              <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-2">
                3. Additional Notes (Optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Include any graduation details, student roll number, or departmental context for the reviewer..."
                className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-navy-900 focus:border-navy-900"
              />
            </div>

            {/* Submit CTA */}
            <div className="pt-2 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate('/verification-status')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={submitting}
                disabled={submitting || !selectedCollege}
              >
                {existingRequest && existingRequest.status === 'rejected' ? 'Resubmit Verification' : 'Submit for Verification'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
