import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Users,
  Briefcase,
  Calendar,
  MessageSquare,
  Lock,
  Database,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  GraduationCap,
  Building2,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import { Navbar, Footer, SectionHeader } from '../components/layout';
import { Button, Card, Badge, Avatar } from '../components/ui';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* ── 1. Hero Section ───────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-white border-b border-slate-200 py-16 sm:py-24 lg:py-28">
          <div className="container-app px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              {/* Left Column: Copy & CTAs */}
              <div className="lg:col-span-7 space-y-6 text-left">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200 animate-fade-in">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Verified Campus Network Infrastructure</span>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-navy-900 tracking-tight leading-[1.1] animate-slide-up">
                  Connect. Grow. <br />
                  <span className="text-blue-600">Give Back.</span>
                </h1>

                <p className="text-base sm:text-lg text-slate-500 max-w-xl leading-relaxed">
                  One secure platform connecting students, alumni, and institutions — for mentorship, career referrals, campus events, and enduring institutional community.
                </p>

                <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
                  <Link to="/register">
                    <Button variant="primary" size="lg" className="w-full sm:w-auto" rightIcon={<ArrowRight className="w-4 h-4" />}>
                      Get Started
                    </Button>
                  </Link>
                  <Link to="/alumni">
                    <Button variant="outline" size="lg" className="w-full sm:w-auto">
                      Explore Alumni Directory
                    </Button>
                  </Link>
                </div>

                {/* Sub-text security assurance */}
                <div className="pt-4 flex items-center gap-6 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span>Zero fabricated profiles</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span>Strict domain & registrar checks</span>
                  </div>
                </div>
              </div>

              {/* Right Column: In-App SVG Network Visualization */}
              <div className="lg:col-span-5 flex justify-center">
                <div className="relative w-full max-w-md p-6 bg-slate-50 rounded-card border border-slate-200 shadow-card">
                  {/* Background network lines */}
                  <svg
                    className="absolute inset-0 w-full h-full text-slate-200 pointer-events-none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <line x1="50%" y1="20%" x2="25%" y2="70%" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" />
                    <line x1="50%" y1="20%" x2="75%" y2="70%" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" />
                    <line x1="25%" y1="70%" x2="75%" y2="70%" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" />
                  </svg>

                  <div className="relative space-y-4">
                    {/* Node 1: Institution Lead */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-navy-900 text-white flex items-center justify-center">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-navy-900">Institution Portal</div>
                          <div className="text-[11px] text-slate-500">Official Campus Registrar</div>
                        </div>
                      </div>
                      <Badge variant="navy" size="sm">Admin</Badge>
                    </div>

                    {/* Node 2 & 3: Student & Alumni in Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Student Card */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <Avatar name="Sarah Chen" size="sm" />
                          <Badge variant="blue" size="sm">Student</Badge>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-navy-900">Sarah Chen</div>
                          <div className="text-[10px] text-slate-500">CS • Batch 2026</div>
                        </div>
                        <div className="text-[10px] text-blue-600 bg-blue-50 px-2 py-1 rounded font-semibold flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Mentorship seeker
                        </div>
                      </div>

                      {/* Alumni Card */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <Avatar name="David Miller" size="sm" />
                          <Badge variant="green" size="sm">Verified</Badge>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-navy-900">David Miller</div>
                          <div className="text-[10px] text-slate-500">Staff SWE • Class '19</div>
                        </div>
                        <div className="text-[10px] text-green-600 bg-green-50 px-2 py-1 rounded font-semibold flex items-center gap-1">
                          <UserCheck className="w-3 h-3" /> Active Mentor
                        </div>
                      </div>
                    </div>

                    {/* Verified Connection Pill */}
                    <div className="bg-navy-900 text-white p-3 rounded-xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-medium">
                        <ShieldCheck className="w-4 h-4 text-green-400" />
                        <span>Authenticated Institution Bridge</span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-300">100% Verified</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. Trust Strip ────────────────────────────────────────────── */}
        <section className="bg-slate-50 border-b border-slate-200 py-6">
          <div className="container-app px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-xs sm:text-sm font-semibold text-slate-500 max-w-3xl mx-auto">
              AlumniConnect is an enterprise campus network infrastructure engineered for verified identity, authentic career mentorship, and institutional alumni relations.
            </p>
          </div>
        </section>

        {/* ── 3. Features Grid ─────────────────────────────────────────── */}
        <section className="section bg-white border-b border-slate-200">
          <div className="container-app px-4 sm:px-6 lg:px-8 space-y-12">
            <SectionHeader
              centered
              badge="Platform Capabilities"
              title="Everything your university network requires"
              description="Built to eliminate unverified accounts, broken mentorship pipelines, and scattered alumni communication."
            />

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  icon: Users,
                  title: 'Verified Alumni Network',
                  desc: 'Search graduates authenticated via registrar records and institutional email verification.',
                },
                {
                  icon: MessageSquare,
                  title: '1-on-1 Mentorship',
                  desc: 'Direct career guidance and portfolio reviews matched between students and industry alumni.',
                },
                {
                  icon: Briefcase,
                  title: 'Career & Referral Opportunities',
                  desc: 'Alumni post internal referral leads and job openings directly to current students.',
                },
                {
                  icon: Calendar,
                  title: 'Institutional Campus Events',
                  desc: 'Organize reunions, keynote webinars, and career networking sessions with RSVP management.',
                },
                {
                  icon: Lock,
                  title: 'Security & Access Control',
                  desc: 'Role-based access control, cryptographic token rotation, and zero public administrator access.',
                },
                {
                  icon: Database,
                  title: 'Centralized Institutional Records',
                  desc: 'Moderation queue and audit logging for administrators to manage campus membership.',
                },
              ].map((feat, i) => {
                const Icon = feat.icon;
                return (
                  <Card key={i} hoverable className="p-6 space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-bold text-navy-900">{feat.title}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">{feat.desc}</p>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── 4. How It Works Timeline ─────────────────────────────────── */}
        <section className="section bg-slate-50 border-b border-slate-200">
          <div className="container-app px-4 sm:px-6 lg:px-8 space-y-12">
            <SectionHeader
              centered
              badge="Workflow"
              title="How AlumniConnect Works"
              description="Three disciplined steps from initial enrollment to active engagement."
            />

            <div className="grid md:grid-cols-3 gap-8 relative">
              {[
                {
                  step: '01',
                  title: 'Create Your Account',
                  desc: 'Register as a Student or Alumni with your academic department, batch year, and campus credentials.',
                },
                {
                  step: '02',
                  title: 'Institutional Verification',
                  desc: 'Institutional emails verify automatically; non-institutional alumni undergo human administrator verification.',
                },
                {
                  step: '03',
                  title: 'Connect & Engage',
                  desc: 'Access the verified directory, request mentorship sessions, apply for referral jobs, and attend events.',
                },
              ].map((step, idx) => (
                <div key={idx} className="card p-6 relative space-y-3 bg-white">
                  <span className="font-mono text-2xl font-black text-blue-600">{step.step}</span>
                  <h3 className="text-base font-bold text-navy-900">{step.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 5. Role Benefits ─────────────────────────────────────────── */}
        <section className="section bg-white border-b border-slate-200">
          <div className="container-app px-4 sm:px-6 lg:px-8 space-y-12">
            <SectionHeader
              centered
              badge="Tailored Portals"
              title="Value tailored to every campus stakeholder"
              description="Dedicated tools built specifically for students, alumni graduates, and institution leads."
            />

            <div className="grid lg:grid-cols-3 gap-8">
              {/* Card 1: Students */}
              <Card className="p-8 flex flex-col justify-between space-y-6 border-slate-200">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-navy-900">For Current Students</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Gain direct access to industry veterans who walked your campus halls.
                  </p>
                  <ul className="space-y-2.5 text-xs text-slate-900">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      <span>Request 1-on-1 resume & career mentorship</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      <span>Discover exclusive referral-based job postings</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      <span>RSVP for campus workshops and alumni panels</span>
                    </li>
                  </ul>
                </div>
                <Link to="/register">
                  <Button variant="outline" size="md" className="w-full justify-center">
                    Join as Student
                  </Button>
                </Link>
              </Card>

              {/* Card 2: Alumni */}
              <Card className="p-8 flex flex-col justify-between space-y-6 border-blue-200 bg-blue-50/20">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-navy-900 text-white flex items-center justify-center">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-navy-900">For Alumni Graduates</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Re-establish ties with fellow alumni, hire junior talent, and mentor the next generation.
                  </p>
                  <ul className="space-y-2.5 text-xs text-slate-900">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      <span>Post career opportunities & hiring referrals</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      <span>Set custom mentorship availability topics</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      <span>Connect with classmates across batches and cities</span>
                    </li>
                  </ul>
                </div>
                <Link to="/register">
                  <Button variant="primary" size="md" className="w-full justify-center">
                    Join as Alumni
                  </Button>
                </Link>
              </Card>

              {/* Card 3: Institutions */}
              <Card className="p-8 flex flex-col justify-between space-y-6 border-slate-200">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 text-navy-900 flex items-center justify-center">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-navy-900">For Institution Admins</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Centrally govern campus relations with audit trails, moderation, and event management.
                  </p>
                  <ul className="space-y-2.5 text-xs text-slate-900">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      <span>Review & authenticate applicant records</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      <span>Maintain comprehensive administrative audit logs</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      <span>Publish official institution-wide announcements</span>
                    </li>
                  </ul>
                </div>
                <Link to="/login">
                  <Button variant="outline" size="md" className="w-full justify-center">
                    Admin Portal Sign In
                  </Button>
                </Link>
              </Card>
            </div>
          </div>
        </section>

        {/* ── 6. Platform Preview Mockup ───────────────────────────────── */}
        <section className="section bg-slate-50 border-b border-slate-200">
          <div className="container-app px-4 sm:px-6 lg:px-8 space-y-12">
            <SectionHeader
              centered
              badge="Interface Preview"
              title="Designed for clarity and institutional trust"
              description="A preview of the unified dashboard experience built with our component design system."
            />

            <div className="max-w-4xl mx-auto card overflow-hidden shadow-modal border border-slate-200">
              {/* Mockup Window Bar */}
              <div className="bg-navy-900 px-4 py-3 flex items-center justify-between text-white text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  <span className="ml-2 font-mono text-[11px] text-slate-300">alumniconnect.edu/dashboard</span>
                </div>
                <Badge variant="navy" size="sm">Verified Session</Badge>
              </div>

              {/* Mockup Interior */}
              <div className="p-6 bg-slate-50 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
                  <div>
                    <h4 className="text-lg font-bold text-navy-900">Alumni Directory & Mentorship</h4>
                    <p className="text-xs text-slate-500">Showing active members from Computer Science & Engineering</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="blue">Batch 2018–2024</Badge>
                    <Badge variant="green">Mentors Available</Badge>
                  </div>
                </div>

                {/* Simulated Directory Items */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar name="Priya Sharma" size="md" />
                        <div>
                          <div className="text-xs font-bold text-navy-900">Priya Sharma</div>
                          <div className="text-[11px] text-slate-500">Staff AI Engineer @ DeepTech</div>
                        </div>
                      </div>
                      <Badge variant="green" size="sm">Verified</Badge>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2">
                      Alumni Class of 2020. Open to resume reviews for distributed systems and machine learning roles.
                    </p>
                    <div className="pt-1 flex items-center justify-between text-xs">
                      <span className="text-[11px] font-semibold text-blue-600">3 slots available</span>
                      <Button variant="outline" size="sm">Request Mentorship</Button>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar name="Marcus Vance" size="md" />
                        <div>
                          <div className="text-xs font-bold text-navy-900">Marcus Vance</div>
                          <div className="text-[11px] text-slate-500">Engineering Manager @ CloudScale</div>
                        </div>
                      </div>
                      <Badge variant="green" size="sm">Verified</Badge>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2">
                      Class of 2018. Actively referring graduating students for entry-level backend and DevOps positions.
                    </p>
                    <div className="pt-1 flex items-center justify-between text-xs">
                      <span className="text-[11px] font-semibold text-blue-600">Referral Open</span>
                      <Button variant="outline" size="sm">View Posting</Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 7. Final Call-to-Action ──────────────────────────────────── */}
        <section className="bg-navy-900 text-white py-16 sm:py-20">
          <div className="container-app px-4 sm:px-6 lg:px-8 text-center space-y-6 max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Your alumni network starts here.
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Join thousands of students and verified graduates building authentic professional connections within an institutional ecosystem.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <Link to="/register">
                <Button variant="accent" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Create Free Account
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" size="lg" className="border-slate-400 text-white hover:bg-navy-800 hover:text-white">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── 8. Footer ─────────────────────────────────────────────────── */}
      <Footer />
    </div>
  );
}
