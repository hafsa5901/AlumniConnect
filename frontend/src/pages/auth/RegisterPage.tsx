import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService, RegisterPayload } from '../../services/auth.service';
import { CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, GraduationCap, Briefcase, Lock, User as UserIcon, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

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
    return Object.keys(errors).length === 0;
  };

  const validateStep2 = () => {
    const errors: Record<string, string> = {};
    if (!formData.role) errors.role = 'Please select your role.';
    if (!formData.department.trim()) errors.department = 'Department is required.';
    if (!formData.batch.trim()) errors.batch = 'Batch / Year is required.';

    if (formData.role === 'student' && !isInstitutional) {
      errors.email = `Students must register with an institutional email (${ALLOWED_DOMAINS.join(', ')}).`;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
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
        setSubmitError('Please fix the errors below.');
      } else {
        setSubmitError(errData?.message || 'Registration failed. Please check your details.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="flex justify-center items-center gap-2 mb-4">
          <div className="w-10 h-10 bg-navy-900 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md">
            AC
          </div>
          <span className="text-2xl font-black tracking-tight text-navy-900">AlumniConnect</span>
        </div>
        <h1 className="text-center text-3xl font-extrabold text-navy-900">
          Create your network account
        </h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-accent-600 hover:text-accent-500 underline">
            Sign in
          </Link>
        </p>

        {/* Step Indicator */}
        <div className="mt-8 flex justify-between items-center relative max-w-lg mx-auto mb-8 px-4">
          <div className="absolute top-1/2 left-4 right-4 -translate-y-1/2 h-0.5 bg-gray-200 -z-0" />
          {[
            { num: 1, label: 'Account' },
            { num: 2, label: 'Role & Dept' },
            { num: 3, label: 'Verification' },
            { num: 4, label: 'Review' },
          ].map((item) => (
            <div key={item.num} className="flex flex-col items-center z-10 bg-slate-50 px-2">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step > item.num
                    ? 'bg-emerald-600 text-white'
                    : step === item.num
                    ? 'bg-navy-900 text-white ring-4 ring-navy-100'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step > item.num ? '✓' : item.num}
              </div>
              <span className="text-xs mt-1 font-medium text-gray-600">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="card p-8 shadow-card border border-gray-200">
          {submitError && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" />
              <div>{submitError}</div>
            </div>
          )}

          {/* STEP 1: Basic Information */}
          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              <h2 className="text-lg font-bold text-navy-900 border-b pb-2">Step 1: Basic Information</h2>
              <div>
                <label className="label" htmlFor="name">Full Name</label>
                <div className="relative">
                  <UserIcon className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
                  <input
                    id="name"
                    type="text"
                    className={`input pl-10 ${fieldErrors.name ? 'input-error' : ''}`}
                    placeholder="e.g. Sarah Jenkins"
                    value={formData.name}
                    onChange={(e) => updateField('name', e.target.value)}
                  />
                </div>
                {fieldErrors.name && <p className="error-text">{fieldErrors.name}</p>}
              </div>

              <div>
                <label className="label" htmlFor="email">Email Address</label>
                <div className="relative">
                  <Mail className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
                  <input
                    id="email"
                    type="email"
                    className={`input pl-10 ${fieldErrors.email ? 'input-error' : ''}`}
                    placeholder="sjenkins@college.edu or name@gmail.com"
                    value={formData.email}
                    onChange={(e) => updateField('email', e.target.value)}
                  />
                </div>
                {fieldErrors.email && <p className="error-text">{fieldErrors.email}</p>}
                <p className="helper-text">
                  Institutional emails (@college.edu, @university.edu) receive prioritized verification.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="password">Password</label>
                  <div className="relative">
                    <Lock className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
                    <input
                      id="password"
                      type="password"
                      className={`input pl-10 ${fieldErrors.password ? 'input-error' : ''}`}
                      placeholder="Min 10 chars, letter + number"
                      value={formData.password}
                      onChange={(e) => updateField('password', e.target.value)}
                    />
                  </div>
                  {fieldErrors.password && <p className="error-text">{fieldErrors.password}</p>}
                </div>
                <div>
                  <label className="label" htmlFor="confirmPassword">Confirm Password</label>
                  <div className="relative">
                    <Lock className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
                    <input
                      id="confirmPassword"
                      type="password"
                      className={`input pl-10 ${fieldErrors.confirmPassword ? 'input-error' : ''}`}
                      placeholder="Repeat password"
                      value={formData.confirmPassword}
                      onChange={(e) => updateField('confirmPassword', e.target.value)}
                    />
                  </div>
                  {fieldErrors.confirmPassword && <p className="error-text">{fieldErrors.confirmPassword}</p>}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Role & Academic Information */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-lg font-bold text-navy-900 border-b pb-2">Step 2: Role & Department</h2>

              <div>
                <label className="label mb-2">Select Your Role</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => updateField('role', 'student')}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      formData.role === 'student'
                        ? 'border-navy-900 bg-navy-50/50 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <GraduationCap className={`w-7 h-7 mb-2 ${formData.role === 'student' ? 'text-navy-900' : 'text-gray-500'}`} />
                    <div className="font-bold text-navy-900">Current Student</div>
                    <div className="text-xs text-gray-500 mt-1">Requires institutional email domain</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateField('role', 'alumni')}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      formData.role === 'alumni'
                        ? 'border-navy-900 bg-navy-50/50 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Briefcase className={`w-7 h-7 mb-2 ${formData.role === 'alumni' ? 'text-navy-900' : 'text-gray-500'}`} />
                    <div className="font-bold text-navy-900">Alumni Graduate</div>
                    <div className="text-xs text-gray-500 mt-1">Institutional or personal email + review</div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="department">Department / Major</label>
                  <select
                    id="department"
                    className="input"
                    value={formData.department}
                    onChange={(e) => updateField('department', e.target.value)}
                  >
                    <option value="Computer Science">Computer Science & Engineering</option>
                    <option value="Information Technology">Information Technology</option>
                    <option value="Electrical Engineering">Electrical Engineering</option>
                    <option value="Mechanical Engineering">Mechanical Engineering</option>
                    <option value="Business Administration">Business Administration</option>
                    <option value="Biotechnology">Biotechnology</option>
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="batch">Batch / Year</label>
                  <input
                    id="batch"
                    type="text"
                    className="input"
                    placeholder="e.g. 2025"
                    value={formData.batch}
                    onChange={(e) => updateField('batch', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="idNumber">
                  {formData.role === 'student' ? 'Student Registration / ID Number' : 'Alumni ID (if known)'}
                </label>
                <input
                  id="idNumber"
                  type="text"
                  className="input"
                  placeholder="e.g. STU-94821"
                  value={formData.role === 'student' ? formData.studentId : formData.alumniId}
                  onChange={(e) =>
                    updateField(formData.role === 'student' ? 'studentId' : 'alumniId', e.target.value)
                  }
                />
              </div>
            </div>
          )}

          {/* STEP 3: Verification & Proof Details */}
          {step === 3 && (
            <div className="space-y-5 animate-fade-in">
              <h2 className="text-lg font-bold text-navy-900 border-b pb-2">Step 3: Verification Details</h2>

              {formData.role === 'student' ? (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-blue-900">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-bold text-sm">Institutional Student Verification</h3>
                      <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                        Your email <span className="font-mono font-semibold">{formData.email}</span> matches our institution list.
                        A verification link will be sent to confirm mailbox ownership.
                      </p>
                    </div>
                  </div>
                </div>
              ) : isInstitutional ? (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 text-purple-900">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-bold text-sm">Institutional Alumni Verification</h3>
                      <p className="text-xs text-purple-700 mt-1 leading-relaxed">
                        You registered with an official institutional domain. Your email will be verified first,
                        followed by a standard administrative verification to activate directory and mentorship privileges.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-900">
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      Non-Institutional Email Verification
                    </h3>
                    <p className="text-xs text-amber-700 mt-1">
                      Because you are using a personal email (<span className="font-mono">{formData.email}</span>),
                      please provide your degree details for manual administrator review.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label" htmlFor="graduationYear">Graduation Year</label>
                      <input
                        id="graduationYear"
                        type="text"
                        className="input"
                        placeholder="e.g. 2021"
                        value={formData.graduationYear}
                        onChange={(e) => updateField('graduationYear', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor="degree">Degree Obtained</label>
                      <input
                        id="degree"
                        type="text"
                        className="input"
                        placeholder="e.g. B.Tech Computer Science"
                        value={formData.degree}
                        onChange={(e) => updateField('degree', e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label" htmlFor="proofNote">
                      Additional Notes / Proof Information for Admin
                    </label>
                    <textarea
                      id="proofNote"
                      rows={3}
                      className="input"
                      placeholder="Mention your student registration number, advisor name, or LinkedIn profile link to assist verification..."
                      value={formData.proofNote}
                      onChange={(e) => updateField('proofNote', e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-600">
                🔒 <strong>Security Policy:</strong> Your account must be verified before accessing protected AlumniConnect features.
                Admin accounts cannot be registered publicly.
              </div>
            </div>
          )}

          {/* STEP 4: Review & Submit */}
          {step === 4 && (
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-lg font-bold text-navy-900 border-b pb-2">Step 4: Review & Submit</h2>

              <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 space-y-3 text-sm">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-500">Name</span>
                  <span className="font-semibold text-navy-900">{formData.name}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-500">Email</span>
                  <span className="font-mono text-navy-900">{formData.email}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-500">Role</span>
                  <span className="badge-blue capitalize font-bold">{formData.role}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-500">Department</span>
                  <span className="font-medium text-navy-900">{formData.department}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-500">Batch</span>
                  <span className="font-medium text-navy-900">{formData.batch}</span>
                </div>
                {formData.role === 'alumni' && !isInstitutional && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Review Track</span>
                    <span className="badge-yellow">Manual Admin Review</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-500 text-center">
                By submitting, you agree to our Terms of Service and Code of Conduct.
              </p>
            </div>
          )}

          {/* Step Actions */}
          <div className="mt-8 pt-4 border-t flex justify-between items-center">
            {step > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                className="btn btn-outline"
                disabled={isSubmitting}
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </button>
            ) : <div />}

            {step < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="btn btn-primary"
              >
                Next Step
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                id="submit-register-btn"
                className="btn btn-accent px-6 py-2.5"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Submitting Application...
                  </span>
                ) : (
                  'Complete Registration'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
