import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-6">
        <Compass className="w-8 h-8" />
      </div>
      <span className="font-mono text-xs font-bold uppercase tracking-wider text-blue-600 mb-1">
        404 Error
      </span>
      <h1 className="text-3xl sm:text-4xl font-extrabold text-navy-900 tracking-tight mb-2">
        Page Not Found
      </h1>
      <p className="text-xs sm:text-sm text-slate-500 max-w-sm mb-8 leading-relaxed">
        The resource or endpoint you requested does not exist on the AlumniConnect platform.
      </p>
      <Link to="/">
        <Button variant="primary" size="md" leftIcon={<ArrowLeft className="w-4 h-4" />}>
          Return to Home
        </Button>
      </Link>
    </div>
  );
}
