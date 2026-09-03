import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import StudentDashboard from './StudentDashboard';
import AlumniDashboard from './AlumniDashboard';

export default function DashboardRouter() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'admin') {
    return <Navigate to="/dashboard/admin" replace />;
  }

  if (user.role === 'alumni') {
    return <AlumniDashboard />;
  }

  return <StudentDashboard />;
}
