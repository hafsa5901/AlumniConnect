import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import AdminVerificationPage from '../admin/AdminVerificationPage';
import { ShieldCheck, LogOut, Users, Settings } from 'lucide-react';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'verification' | 'overview'>('verification');

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Navbar */}
      <nav className="bg-navy-900 text-white border-b border-navy-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white text-navy-900 rounded-xl flex items-center justify-center font-black">
                AC
              </div>
              <div>
                <span className="font-extrabold text-lg tracking-tight">AlumniConnect</span>
                <span className="ml-2 badge-red text-[10px] uppercase font-bold px-1.5 py-0.5">Admin Console</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <div className="font-bold text-sm">{user?.name}</div>
                <div className="text-xs text-navy-300 font-mono">{user?.email}</div>
              </div>
              <button
                onClick={logout}
                className="btn btn-outline border-navy-700 text-white hover:bg-navy-800 text-xs px-3 py-1.5 flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-gray-200 pb-2">
          <button
            onClick={() => setActiveTab('verification')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'verification'
                ? 'bg-navy-900 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            User Verification Queue
          </button>
        </div>

        {activeTab === 'verification' && <AdminVerificationPage />}
      </main>
    </div>
  );
}
