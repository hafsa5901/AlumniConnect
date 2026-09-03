import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService, RegisterPayload } from '../../services/auth.service';
import {
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  GraduationCap,
  Briefcase,
  Lock,
  User as UserIcon,
  Mail,
  ShieldCheck,
  Building2,
  Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input, Select, Textarea, Card, Badge } from '../../components/ui';

const ALLOWED_DOMAINS = ['college.edu', 'university.edu'];

export default function RegisterPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<RegisterPayload>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'student',
    department: 'Computer Science',
    batch: '2025',
    studentId: '',
    alumniId: '',
    graduationYear: '2022',
    degree: 'Bachelor of Technology',
    proofNote: '',
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const emailDomain = formData.email.split('@')[1]?.toLowerCase() || '';
  const isInstitutional = ALLOWED_DOMAINS.includes(emailDomain);

  const updateField = (field: keyof RegisterPayload, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validateStep1 = () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Full name is required.';
    if (!formData.email.trim()) errors.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = 'Invalid email address.';

    if (!formData.password) errors.password = 'Password is required.';
    else if (formData.password.length < 10) errors.password = 'Password must be at least 10 characters.';
    else if (!/[a-zA-Z]/.test(formData.password) || !/[0-9]/.test(formData.password)) {
      errors.password = 'Password must include both letters and numbers.';
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      const firstError = Object.values(errors)[0];
      toast.error(firstError);
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    const errors: Record<string, string> = {};
    if (!formData.role) errors.role = 'Please select your role.';
    if (!formData.department.trim()) errors.department = 'Department is required.';
    if (!formData.batch.trim()) errors.batch = 'Batch / Year is required.';

    if (formData.role === 'student' && !isInstitutional) {
      errors.email = `Students must register with an institutional email (${ALLOWED_DOMAINS.join(', ')}). Your current email is ${formData.email}.`;
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      const firstError = Object.values(errors)[0];
      toast.error(firstError);
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
    else if (step === 3) setStep(4);
  };

  const handleBack = () => {
    setStep((prev) => Math.max(1, prev - 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setIsSubmitting(true);

    try {
      const res = await authService.register(formData);
      const user = res.data.data.user;
      localStorage.setItem('accessToken', res.data.data.accessToken);
      toast.success('Registration submitted successfully!');
      navigate('/verification-status', { state: { user, newlyRegistered: true } });
    } catch (err: any) {
      const errData = err?.response?.data?.error;
      if (errData?.fields) {
        setFieldErrors(errData.fields);
        setSubmitError('Please correct the highlighted fields.');
      } else {
        setSubmitError(errData?.message || 'Registration failed. Please review your details.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <div className="w-10 h-10 bg-navy-900 rounded-xl flex items-center justify-center text-white font-bold shadow-sm">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="6" cy="6" r="3" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="12" cy="18" r="3" />
                <line x1="8.5" y1="7.5" x2="15.5" y2="7.5" />
                <line x1="7.5" y1="8.5" x2="10.5" y2="15.5" />
                <line x1="16.5" y1="8.5" x2="13.5" y2="15.5" />
              </svg>
            </div>
            <span className="text-2xl font-extrabold tracking-tight text-navy-900">AlumniConnect</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">
            Create your network account
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Already registered?{' '}
            <Link to="/login" className="font-semibold text-blue-600 hover:underline">
              Sign in to your account
            </Link>
          </p>
        </div>

        {/* Persistent Institutional Policy Banner */}
        <div className="bg-blue-50/70 border border-blue-200 rounded-card p-3.5 text-xs text-slate-700 flex items-center gap-3">
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            <strong>Institutional Policy:</strong> Your institutional identity must be verified before you can access AlumniConnect features.
          </span>
        </div>

        {/* Step Indicator */}
        <div className="flex justify-between items-center relative max-w-lg mx-auto px-4">
          <div className="absolute top-1/2 left-4 right-4 -translate-y-1/2 h-0.5 bg-slate-200 -z-0" />
          {[
            { num: 1, label: 'Account' },
            { num: 2, label: 'Role & Dept' },
            { num: 3, label: 'Verification' },
            { num: 4, label: 'Review' },
          ].map((item) => (
            <div key={item.num} className="flex flex-col items-center z-10 bg-slate-50 px-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step > item.num
                    ? 'bg-green-600 text-white'
                    : step === item.num
                    ? 'bg-navy-900 text-white ring-4 ring-blue-50'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {step > item.num ? '✓' : item.num}
              </div>
              <span className="text-[11px] mt-1 font-semibold text-slate-500">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Main Form Card */}
        <Card className="p-8 shadow-card border border-slate-200">
          {submitError && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-900 rounded-lg p-3.5 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {/* STEP 1: Basic Information */}
          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div className="border-b border-slate-200 pb-3">
                <h2 className="text-base font-bold text-navy-900">Step 1: Account Information</h2>
                <p className="text-xs text-slate-500">Provide your personal identification and secure credentials.</p>
              </div>

              <div>
                <Input
                  id="name"
                  type="text"
                  label="Full Name"
                  placeholder="e.g. Sarah Jenkins"
                  leftIcon={<UserIcon className="w-4 h-4" />}
                  value={formData.name}
                  error={fieldErrors.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  required
                />
              </div>

              <div>
                <Input
                  id="email"
                  type="email"
                  label="Email Address"
                  placeholder="sjenkins@college.edu or personal@gmail.com"
                  leftIcon={<Mail className="w-4 h-4" />}
                  value={formData.email}
                  error={fieldErrors.email}
                  helperText="Institutional emails (@college.edu, @university.edu) receive instant domain verification."
                  onChange={(e) => updateField('email', e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  id="password"
                  type="password"
                  label="Password"
                  placeholder="Min 10 chars (letters + numbers)"
                  leftIcon={<Lock className="w-4 h-4" />}
                  value={formData.password}
                  error={fieldErrors.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  required
                />
                <Input
                  id="confirmPassword"
                  type="password"
                  label="Confirm Password"
                  placeholder="Repeat password"
                  leftIcon={<Lock className="w-4 h-4" />}
                  value={formData.confirmPassword}
                  error={fieldErrors.confirmPassword}
                  onChange={(e) => updateField('confirmPassword', e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          {/* STEP 2: Role & Academic Information */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-slate-200 pb-3">
                <h2 className="text-base font-bold text-navy-900">Step 2: Role & Academic Information</h2>
                <p className="text-xs text-slate-500">Select your status and campus department details.</p>
              </div>

              <div>
                <label className="label mb-2">Select Your Role <span className="text-red-600">*</span></label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => updateField('role', 'student')}
                    className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      formData.role === 'student'
                        ? 'border-navy-900 bg-blue-50/40 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <GraduationCap className={`w-6 h-6 mb-2 ${formData.role === 'student' ? 'text-navy-900' : 'text-slate-400'}`} />
                    <div className="font-bold text-xs text-navy-900">Current Student</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Requires institutional email domain</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateField('role', 'alumni')}
                    className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      formData.role === 'alumni'
                        ? 'border-navy-900 bg-blue-50/40 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <Briefcase className={`w-6 h-6 mb-2 ${formData.role === 'alumni' ? 'text-navy-900' : 'text-slate-400'}`} />
                    <div className="font-bold text-xs text-navy-900">Alumni Graduate</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Institutional or personal email + review</div>
                  </button>
                </div>

                {formData.role === 'student' && !isInstitutional && (
                  <div className="mt-3 p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Institutional Email Required for Students:</span>
                      <p className="mt-0.5 text-[11px] text-amber-800">
                        Student accounts must use an institutional email ending in <code className="font-mono font-bold bg-amber-100 px-1 py-0.5 rounded">@college.edu</code> or <code className="font-mono font-bold bg-amber-100 px-1 py-0.5 rounded">@university.edu</code>.
                        You entered <span className="font-mono font-semibold">{formData.email || 'a non-institutional email'}</span>.
                      </p>
                      <div className="mt-2 flex gap-3">
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="font-bold text-navy-900 underline hover:text-blue-600 text-[11px]"
                        >
                          ← Change Email on Step 1
                        </button>
                        <span className="text-amber-400">|</span>
                        <button
                          type="button"
                          onClick={() => updateField('role', 'alumni')}
                          className="font-bold text-navy-900 underline hover:text-blue-600 text-[11px]"
                        >
                          Register as Alumni Graduate instead
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  id="department"
                  label="Department / Major"
                  value={formData.department}
                  onChange={(e) => updateField('department', e.target.value)}
                  options={[
                    { value: 'Computer Science', label: 'Computer Science & Engineering' },
                    { value: 'Information Technology', label: 'Information Technology' },
                    { value: 'Electrical Engineering', label: 'Electrical Engineering' },
                    { value: 'Mechanical Engineering', label: 'Mechanical Engineering' },
                    { value: 'Business Administration', label: 'Business Administration' },
                    { value: 'Biotechnology', label: 'Biotechnology' },
                  ]}
                  required
                />

                <Input
                  id="batch"
                  type="text"
                  label="Batch / Year"
                  placeholder="e.g. 2025"
                  value={formData.batch}
                  error={fieldErrors.batch}
                  onChange={(e) => updateField('batch', e.target.value)}
                  required
                />
              </div>

              <div>
                <Input
                  id="idNumber"
                  type="text"
                  label={formData.role === 'student' ? 'Student Registration / ID Number' : 'Alumni ID (if known)'}
                  placeholder="e.g. STU-94821"
                  value={formData.role === 'student' ? formData.studentId : formData.alumniId}
                  onChange={(e) =>
                    updateField(formData.role === 'student' ? 'studentId' : 'alumniId', e.target.value)
                  }
                />
              </div>
            </div>
          )}

          {/* STEP 3: Verification & Institution Details */}
          {step === 3 && (
            <div className="space-y-5 animate-fade-in">
              <div className="border-b border-slate-200 pb-3">
                <h2 className="text-base font-bold text-navy-900">Step 3: Verification Details</h2>
                <p className="text-xs text-slate-500">Validation feedback based on your submitted domain.</p>
              </div>

              {formData.role === 'student' ? (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-slate-900 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-600">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Institutional Domain Confirmed: {emailDomain}</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    A confirmation link will be sent to <span className="font-mono text-navy-900 font-semibold">{formData.email}</span> to activate your student network access.
                  </p>
                </div>
              ) : isInstitutional ? (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-slate-900 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-600">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Institutional Email Confirmed: {emailDomain}</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Your email ownership will be confirmed first, followed by administrative approval to unlock alumni mentoring and job posting privileges.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-slate-900 space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-700">
                      <Clock className="w-4 h-4" />
                      <span>Application Received — Pending Institution Review</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Because you registered with a personal email (<span className="font-mono text-navy-900 font-semibold">{formData.email}</span>), please provide your graduation degree details for administrator verification.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      id="graduationYear"
                      type="text"
                      label="Graduation Year"
                      placeholder="e.g. 2021"
                      value={formData.graduationYear}
                      onChange={(e) => updateField('graduationYear', e.target.value)}
                    />
                    <Input
                      id="degree"
                      type="text"
                      label="Degree Conferred"
                      placeholder="e.g. B.Tech Computer Science"
                      value={formData.degree}
                      onChange={(e) => updateField('degree', e.target.value)}
                    />
                  </div>

                  <div>
                    <Textarea
                      id="proofNote"
                      label="Additional Proof Notes for Registrar"
                      placeholder="Include your advisor name, roll number, or LinkedIn profile URL to expedite verification..."
                      value={formData.proofNote}
                      onChange={(e) => updateField('proofNote', e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Review & Submit */}
          {step === 4 && (
            <div className="space-y-5 animate-fade-in">
              <div className="border-b border-slate-200 pb-3">
                <h2 className="text-base font-bold text-navy-900">Step 4: Review & Submit</h2>
                <p className="text-xs text-slate-500">Confirm your application details before submitting.</p>
              </div>

              <div className="bg-slate-50 rounded-card p-4 border border-slate-200 space-y-2.5 text-xs">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Full Name</span>
                  <span className="font-semibold text-navy-900">{formData.name}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Email</span>
                  <span className="font-mono text-navy-900 font-medium">{formData.email}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Requested Role</span>
                  <Badge variant={formData.role === 'alumni' ? 'blue' : 'green'} size="sm">
                    {formData.role}
                  </Badge>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Department</span>
                  <span className="font-medium text-navy-900">{formData.department}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Batch Year</span>
                  <span className="font-medium text-navy-900">{formData.batch}</span>
                </div>
                {formData.role === 'alumni' && !isInstitutional && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Verification Track</span>
                    <Badge variant="yellow" size="sm">Manual Registrar Review</Badge>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-slate-500 text-center">
                By completing registration, you confirm the accuracy of your academic credentials.
              </p>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="mt-8 pt-4 border-t border-slate-200 flex justify-between items-center">
            {step > 1 ? (
              <Button
                variant="outline"
                size="md"
                onClick={handleBack}
                disabled={isSubmitting}
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Back
              </Button>
            ) : <div />}

            {step < 4 ? (
              <Button
                variant="primary"
                size="md"
                onClick={handleNext}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Next Step
              </Button>
            ) : (
              <Button
                type="button"
                variant="accent"
                size="md"
                onClick={handleSubmit}
                isLoading={isSubmitting}
              >
                Complete Registration
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
