import { useAuth } from '../../context/AuthContext';

export default function AlumniDashboard() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-navy-900">Alumni Dashboard</h1>
          <button onClick={logout} className="btn-outline btn btn-sm">Sign Out</button>
        </div>
        {user?.verificationStatus !== 'admin_approved' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 text-sm text-yellow-800">
            ⏳ Your account is pending admin approval. You'll be able to post jobs, offer mentorship, and appear in the directory once approved.
          </div>
        )}
        <div className="card p-6 mb-6">
          <p className="text-gray-500 text-sm mb-1">Logged in as</p>
          <p className="font-semibold text-navy-900">{user?.name}</p>
          <p className="text-gray-600 text-sm">{user?.email}</p>
          <div className="mt-3 flex gap-2">
            <span className="badge-purple">Alumni</span>
            <span className={user?.verificationStatus === 'admin_approved' ? 'badge-green' : 'badge-yellow'}>
              {user?.verificationStatus}
            </span>
          </div>
        </div>
        <div className="bg-accent-50 border border-accent-100 rounded-xl p-6 text-sm text-accent-800">
          Full dashboard with jobs, mentorship requests, and events is implemented in Phase 5.
        </div>
      </div>
    </div>
  );
}
