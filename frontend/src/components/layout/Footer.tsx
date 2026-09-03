import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-slate-200">
      <div className="container-app px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand Col */}
          <div className="col-span-2 space-y-4">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-navy-900 text-white flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <circle cx="6" cy="6" r="3" />
                  <circle cx="18" cy="6" r="3" />
                  <circle cx="12" cy="18" r="3" />
                  <line x1="8.5" y1="7.5" x2="15.5" y2="7.5" />
                  <line x1="7.5" y1="8.5" x2="10.5" y2="15.5" />
                  <line x1="16.5" y1="8.5" x2="13.5" y2="15.5" />
                </svg>
              </div>
              <span className="font-extrabold text-navy-900 text-lg tracking-tight">
                AlumniConnect
              </span>
            </Link>
            <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
              The verified institutional network bridging students, alumni, and campus administrators for mentorship, career referrals, and enduring community.
            </p>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-2.5 max-w-xs">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Strict Institutional Identity Verification</span>
            </div>
          </div>

          {/* Col 1: Platform */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider">Platform</h4>
            <ul className="space-y-2 text-xs">
              <li><Link to="/alumni" className="text-slate-500 hover:text-navy-900 transition-colors">Alumni Directory</Link></li>
              <li><Link to="/events" className="text-slate-500 hover:text-navy-900 transition-colors">Campus Events</Link></li>
              <li><Link to="/jobs" className="text-slate-500 hover:text-navy-900 transition-colors">Jobs & Referrals</Link></li>
              <li><Link to="/mentorship" className="text-slate-500 hover:text-navy-900 transition-colors">Mentorship Program</Link></li>
            </ul>
          </div>

          {/* Col 2: Institutional */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider">Institution</h4>
            <ul className="space-y-2 text-xs">
              <li><Link to="/register" className="text-slate-500 hover:text-navy-900 transition-colors">Student Registration</Link></li>
              <li><Link to="/register" className="text-slate-500 hover:text-navy-900 transition-colors">Alumni Verification</Link></li>
              <li><Link to="/login" className="text-slate-500 hover:text-navy-900 transition-colors">Admin Portal</Link></li>
              <li><span className="text-slate-400 italic">Campus Registrar Support</span></li>
            </ul>
          </div>

          {/* Col 3: Legal & Governance */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider">Legal & Trust</h4>
            <ul className="space-y-2 text-xs">
              <li><span className="text-slate-500 hover:text-navy-900 cursor-pointer">Privacy Policy</span></li>
              <li><span className="text-slate-500 hover:text-navy-900 cursor-pointer">Terms of Service</span></li>
              <li><span className="text-slate-500 hover:text-navy-900 cursor-pointer">Security Standards</span></li>
              <li><span className="text-slate-400">[Institution Contact Support]</span></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} AlumniConnect Institutional Platform. All rights reserved.</p>
          <p className="font-mono text-[11px] text-slate-400">Enterprise Release • Phase 3</p>
        </div>
      </div>
    </footer>
  );
};
