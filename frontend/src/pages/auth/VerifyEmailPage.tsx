import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import { useAuth } from '../../context/AuthContext';
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  Loader2,
  Mail,
  RefreshCw,
  Clock,
  KeyRound,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, Input } from '../../components/ui';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  // ── Legacy link-based verification state ──────────────────────────────────
  const [legacyLoading, setLegacyLoading] = useState(!!token);
  const [legacySuccess, setLegacySuccess] = useState(false);
  const [legacyError, setLegacyError] = useState('');
  const [legacyVerifiedUser, setLegacyVerifiedUser] = useState<any>(null);

  // ── OTP verification state ────────────────────────────────────────────────
  const initialEmail = (location.state as { email?: string })?.email || '';
  const [email, setEmail] = useState(initialEmail);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpError, setOtpError] = useState<{ code?: string; message: string } | null>(null);

  // ── Resend & cooldown state ───────────────────────────────────────────────
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccessMessage, setResendSuccessMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Handle countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Legacy link verification effect
  useEffect(() => {
    if (!token) return;

    setLegacyLoading(true);
    authService
      .verifyEmail(token)
      .then((res) => {
        setLegacySuccess(true);
        setLegacyVerifiedUser(res.data.data.user);
      })
      .catch((err) => {
        setLegacySuccess(false);
        const msg =
          err?.response?.data?.error?.message ||
          'Verification link is invalid or has expired.';
        setLegacyError(msg);
      })
      .finally(() => {
        setLegacyLoading(false);
      });
  }, [token]);

  // Auto-focus the first empty OTP input on load
  useEffect(() => {
    if (!token && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [token]);

  const handleDigitChange = (index: number, value: string) => {
    // Only accept numeric digit
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned && value !== '') return;

    const char = cleaned.slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = char;
    setOtpDigits(newDigits);
    setOtpError(null);

    // Auto advance focus
    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      } else {
        const newDigits = [...otpDigits];
        newDigits[index] = '';
        setOtpDigits(newDigits);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim().replace(/\D/g, '');
    if (!pastedData) return;

    const chars = pastedData.slice(0, 6).split('');
    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = chars[i] || '';
    }
    setOtpDigits(newDigits);
    setOtpError(null);

    const focusIdx = Math.min(chars.length, 5);
    inputRefs.current[focusIdx]?.focus();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);
    setResendSuccessMessage('');

    const otpCode = otpDigits.join('');
    if (!email || !email.includes('@')) {
      setOtpError({ message: 'Please enter a valid email address.' });
      return;
    }
    if (otpCode.length !== 6) {
      setOtpError({ message: 'Please enter all 6 digits of the verification code.' });
      return;
    }

    setIsVerifying(true);
    try {
      const res = await authService.verifyOtp({
        email: email.trim().toLowerCase(),
        otp: otpCode,
      });

      const { user, accessToken } = res.data.data;
      if (accessToken) {
        localStorage.setItem('accessToken', accessToken);
        await refreshUser().catch(() => {});
      }

      toast.success('Email verified successfully!');
      navigate('/verification-status', { state: { user, newlyVerified: true } });
    } catch (err: any) {
      const errData = err?.response?.data?.error;
      const code = errData?.code || 'VERIFICATION_FAILED';
      const message = errData?.message || 'Verification failed. Please check the code and try again.';
      setOtpError({ code, message });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (!email || !email.includes('@')) {
      setOtpError({ message: 'Please provide a valid email address to resend the code.' });
      return;
    }
    if (cooldown > 0) return;

    setResendLoading(true);
    setOtpError(null);
    setResendSuccessMessage('');

    try {
      await authService.resendOtp(email.trim().toLowerCase());
      setResendSuccessMessage('A new 6-digit code has been dispatched to your email.');
      setCooldown(60);
      setOtpDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      toast.success('New verification code sent!');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || 'Failed to resend code. Please try again later.';
      setOtpError({ message: msg });
    } finally {
      setResendLoading(false);
    }
  };

  // ── Render Legacy Link State ──────────────────────────────────────────────
  if (token) {
    const isExpired =
      legacyError.toLowerCase().includes('expired') ||
      legacyError.toLowerCase().includes('expire');

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
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
          </div>

          <Card className="p-8 shadow-card border border-slate-200 text-center">
            {legacyLoading ? (
              <div className="py-8 space-y-4">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
                <h2 className="text-lg font-bold text-navy-900">Verifying your email...</h2>
                <p className="text-xs text-slate-500">Validating verification token signature.</p>
              </div>
            ) : legacySuccess ? (
              <div className="py-4 space-y-5 animate-fade-in">
                <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto text-green-600">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold text-navy-900">Email Verified</h1>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    {legacyVerifiedUser?.role === 'alumni'
                      ? 'Your institutional email is verified. Your profile is now in the administrator verification queue.'
                      : 'Your institutional student mailbox ownership has been verified.'}
                  </p>
                </div>
                <div className="pt-4">
                  <Link to="/login">
                    <Button variant="primary" size="lg" className="w-full justify-center" rightIcon={<ArrowRight className="w-4 h-4" />}>
                      Sign In to Continue
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="py-4 space-y-5 animate-fade-in">
                <div className={`w-14 h-14 ${isExpired ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'} rounded-full flex items-center justify-center mx-auto`}>
                  {isExpired ? <Clock className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold text-navy-900">
                    {isExpired ? 'Link Expired' : 'Invalid Verification Link'}
                  </h1>
                  <p className="text-xs text-red-600 mt-2 font-medium">{legacyError}</p>
                </div>
                <div className="pt-4 flex gap-3">
                  <Link to="/verify-email" className="flex-1">
                    <Button variant="primary" size="md" className="w-full justify-center">
                      Use OTP Code
                    </Button>
                  </Link>
                  <Link to="/login" className="flex-1">
                    <Button variant="outline" size="md" className="w-full justify-center">
                      Sign In
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  }

  // ── Render OTP Verification Screen (Canonical) ───────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6">
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
        </div>

        <Card className="p-8 shadow-card border border-slate-200">
          <div className="text-center space-y-3 mb-6">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">Verify Your Email</h1>
              <p className="text-xs text-slate-500 mt-1">
                Enter the 6-digit verification code sent to
              </p>
              <div className="mt-1 inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-xs font-semibold text-navy-900">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                <span>{email || 'your registered email'}</span>
              </div>
            </div>
          </div>

          {/* Feedback Messages */}
          {otpError && (
            <div className="mb-5 bg-red-50 border border-red-200 text-red-900 rounded-lg p-3.5 text-xs flex items-start gap-2.5 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">
                  {otpError.code === 'MAX_ATTEMPTS_EXCEEDED'
                    ? 'Too Many Attempts'
                    : otpError.code === 'OTP_EXPIRED'
                    ? 'Code Expired'
                    : 'Verification Error'}
                </strong>
                <span>{otpError.message}</span>
              </div>
            </div>
          )}

          {resendSuccessMessage && (
            <div className="mb-5 bg-green-50 border border-green-200 text-green-900 rounded-lg p-3.5 text-xs flex items-start gap-2.5 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <span>{resendSuccessMessage}</span>
            </div>
          )}

          <form onSubmit={handleVerifyOtp} className="space-y-6">
            {!initialEmail && (
              <div>
                <Input
                  id="email"
                  type="email"
                  label="Registered Email Address"
                  placeholder="name@college.edu"
                  leftIcon={<Mail className="w-4 h-4 text-slate-400" />}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 text-center mb-3">
                6-Digit Verification Code
              </label>
              <div className="flex justify-between gap-2 sm:gap-3 max-w-xs mx-auto">
                {otpDigits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    autoComplete="one-time-code"
                    value={digit}
                    onChange={(e) => handleDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    className={`w-11 h-12 sm:w-12 sm:h-14 text-center text-xl font-bold rounded-xl border-2 transition-all outline-none ${
                      digit
                        ? 'border-navy-900 bg-blue-50/30 text-navy-900'
                        : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300 focus:border-navy-900 focus:ring-4 focus:ring-blue-50'
                    }`}
                    aria-label={`Digit ${index + 1}`}
                  />
                ))}
              </div>
              <p className="text-[11px] text-slate-400 text-center mt-2.5">
                Code expires in 10 minutes. Check your spam folder if not received.
              </p>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full justify-center"
              isLoading={isVerifying}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Verify Code & Continue
            </Button>
          </form>

          {/* Resend Action with Cooldown */}
          <div className="mt-6 pt-5 border-t border-slate-200 text-center space-y-3">
            <div className="text-xs text-slate-500 flex items-center justify-center gap-1">
              <span>Didn't receive the code?</span>
              {cooldown > 0 ? (
                <span className="font-semibold text-slate-700">
                  Resend in <span className="font-mono text-navy-900">{cooldown}s</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendLoading}
                  className="font-bold text-navy-900 hover:text-blue-600 underline inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {resendLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  Resend Code
                </button>
              )}
            </div>

            <div className="text-[11px] text-slate-400">
              <Link to="/login" className="hover:text-slate-600 underline">
                Back to Sign In
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
