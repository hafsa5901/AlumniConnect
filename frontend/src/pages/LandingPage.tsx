import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-navy-900 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">AC</span>
          </div>
          <span className="font-bold text-navy-900 text-lg">AlumniConnect</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="btn-ghost btn">Sign In</Link>
          <Link to="/register" className="btn-primary btn">Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="section container-app text-center py-24">
        <div className="inline-flex items-center gap-2 bg-accent-50 text-accent-700 px-3 py-1 rounded-full text-sm font-medium mb-6">
          ✨ Your alumni network, reimagined
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-navy-900 mb-6 leading-tight">
          Connect. Grow.<br />
          <span className="text-accent-600">Give Back.</span>
        </h1>
        <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
          One secure platform connecting students, alumni, and institutions — for mentorship, careers, and community.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/register" className="btn-primary btn btn-lg">
            Get Started →
          </Link>
          <Link to="/alumni" className="btn-outline btn btn-lg">
            Explore Alumni
          </Link>
        </div>
      </section>

      {/* Features teaser */}
      <section className="section bg-gray-50">
        <div className="container-app">
          <h2 className="text-3xl font-bold text-navy-900 text-center mb-12">Everything your network needs</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: '🎓', title: 'Mentorship', desc: 'Students connect with alumni mentors in their field.' },
              { icon: '💼', title: 'Jobs & Careers', desc: 'Alumni post opportunities; students apply in one click.' },
              { icon: '📅', title: 'Events', desc: 'Institution-run events, networking sessions, and webinars.' },
            ].map((f) => (
              <div key={f.title} className="card p-6">
                <div className="text-4xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-semibold text-navy-900 mb-2">{f.title}</h3>
                <p className="text-gray-600 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} AlumniConnect. All rights reserved.
      </footer>
    </div>
  );
}
