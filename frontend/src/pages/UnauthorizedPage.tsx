import { Link } from 'react-router-dom';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="text-5xl">🔒</div>
      <h1 className="text-3xl font-bold text-navy-900">Access Denied</h1>
      <p className="text-gray-500">You don't have permission to view this page.</p>
      <Link to="/" className="btn-primary btn">Go Home</Link>
    </div>
  );
}
