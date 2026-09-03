import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-6xl font-bold text-navy-900">404</h1>
      <p className="text-gray-500 text-lg">Page not found.</p>
      <Link to="/" className="btn-primary btn">Go Home</Link>
    </div>
  );
}
