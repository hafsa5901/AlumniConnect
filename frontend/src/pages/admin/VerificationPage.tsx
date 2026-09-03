import React from 'react';
import { Navbar, Footer, Sidebar, PageHeader } from '../../components/layout';
import { VerificationQueueView } from '../../components/admin/VerificationQueueView';

export default function VerificationPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <div className="flex-1 flex container-app px-4 sm:px-6 lg:px-8 py-8 gap-8">
        {/* Sidebar */}
        <Sidebar className="hidden md:flex rounded-card shadow-xs" />

        {/* Main Area */}
        <main className="flex-1 space-y-6 min-w-0">
          <PageHeader
            title="Verification Requests Queue"
            subtitle="Authenticate pending student and alumni applicants against official university registrar records."
          />

          <VerificationQueueView />
        </main>
      </div>

      <Footer />
    </div>
  );
}
