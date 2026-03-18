import { Link } from 'react-router-dom'

const stats = [
  { value: '50,000+', label: 'Students Trained' },
  { value: '200+', label: 'Partner Companies' },
  { value: '100+', label: 'Courses' },
  { value: '30+', label: 'Universities' },
]

const whyUs = [
  {
    title: 'University-Based Curriculum',
    desc: 'Training aligned with your university syllabus and exam requirements.',
    icon: '📚',
  },
  {
    title: 'Industry-Oriented Training',
    desc: 'Learn skills demanded by today\'s industries with real project exposure.',
    icon: '🏭',
  },
  {
    title: 'Internship Opportunity',
    desc: 'Get internship offers from top partner companies after training completion.',
    icon: '🎯',
  },
  {
    title: 'Verified Certificate',
    desc: 'QR code verified certificates recognized by universities and companies.',
    icon: '✅',
  },
]

const programsPreview = [
  { title: 'Full Stack Web Development', duration: '4 Weeks', tag: 'MERN Stack' },
  { title: 'Artificial Intelligence & ML', duration: '4 Weeks', tag: 'AI/ML' },
  { title: 'Data Science', duration: '4 Weeks', tag: 'Python & Analytics' },
]

const testimonials = [
  { name: 'Rahul Kumar', role: 'B.Tech CSE', quote: 'This training helped me gain real project experience and I got an internship after completing it. XpertIntern changed my career path!' },
  { name: 'Priya Sharma', role: 'BCA, Patna University', quote: 'The certificate I received was accepted by my university for internship credit. The training was structured and industry-focused.' },
  { name: 'Anjali Singh', role: 'BCom, Magadh University', quote: 'As a non-technical student I was worried. XpertIntern had courses tailored for me and I secured a digital marketing internship!' },
]

const steps = [
  { num: '01', title: 'Register', desc: 'Create your free account with your university details' },
  { num: '02', title: 'Choose Training', desc: 'Browse and select the right training for your branch' },
  { num: '03', title: 'Complete Training', desc: 'Attend sessions, complete assignments & quizzes' },
  { num: '04', title: 'Get Certificate', desc: 'Receive verified QR-coded certificate instantly' },
  { num: '05', title: 'Apply Internship', desc: 'Apply to partner companies and launch your career' },
]

export function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-brand-navy via-primary-900 to-primary-950 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.04\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-80" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <p className="text-primary-300 text-sm font-medium uppercase tracking-wider">AICTE & UGC Approved Programs</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            India&apos;s Leading Training
            <br />
            <span className="text-primary-300">& Internship Platform</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-gray-300">
            Skill-based training and industry internships as per AICTE and UGC guidelines. We provide structured programs for technical and non-technical students across India.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              to="/programs"
              className="inline-flex items-center rounded-lg bg-brand-accent px-6 py-3 text-base font-semibold text-white shadow-lg hover:bg-primary-600 transition"
            >
              Explore Trainings
            </Link>
            <Link
              to="/internship"
              className="inline-flex items-center rounded-lg border-2 border-white/40 bg-white/5 px-6 py-3 text-base font-semibold text-white backdrop-blur hover:bg-white/10 transition"
            >
              Apply for Internship
            </Link>
          </div>
          <div className="mt-16 grid grid-cols-2 gap-8 sm:grid-cols-4">
            {stats.map(({ value, label }) => (
              <div key={label}>
                <p className="text-2xl font-bold text-white sm:text-3xl">{value}</p>
                <p className="mt-1 text-sm text-gray-400">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-brand-navy">Why Choose Us</h2>
          <p className="mt-2 text-gray-600">What makes XpertIntern different</p>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {whyUs.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-gray-200 bg-gray-50/50 p-6 transition hover:border-primary-200 hover:shadow-md"
              >
                <span className="text-3xl" role="img" aria-hidden>{item.icon}</span>
                <h3 className="mt-4 text-lg font-semibold text-brand-navy">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-brand-navy">How It Works</h2>
          <p className="mt-2 text-gray-600">Get started in minutes</p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((step) => (
              <div key={step.num} className="relative rounded-xl bg-white p-6 shadow-sm">
                <span className="text-2xl font-bold text-primary-200">{step.num}</span>
                <h3 className="mt-2 text-lg font-semibold text-brand-navy">{step.title}</h3>
                <p className="mt-1 text-sm text-gray-600">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Programs */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-brand-navy">Popular Programs</h2>
          <p className="mt-2 text-gray-600">Transform your career with industry-leading courses</p>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {programsPreview.map((prog) => (
              <div
                key={prog.title}
                className="rounded-xl border border-gray-200 overflow-hidden transition hover:shadow-lg"
              >
                <div className="bg-primary-50 p-6">
                  <span className="rounded bg-brand-accent/10 px-2 py-1 text-xs font-medium text-brand-accent">{prog.tag}</span>
                  <h3 className="mt-3 text-lg font-semibold text-brand-navy">{prog.title}</h3>
                  <p className="mt-1 text-sm text-gray-600">{prog.duration} · Live sessions & projects</p>
                </div>
                <div className="border-t border-gray-100 p-4">
                  <Link to="/programs" className="text-sm font-semibold text-brand-accent hover:underline">
                    View Details →
                  </Link>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link to="/programs" className="inline-flex rounded-lg bg-brand-navy px-6 py-3 text-sm font-semibold text-white hover:bg-primary-800 transition">
              View All Courses
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-brand-navy text-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold">What Our Students Say</h2>
          <p className="mt-2 text-gray-400">Real stories from the community</p>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t) => (
              <blockquote key={t.name} className="rounded-xl bg-white/5 p-6 backdrop-blur">
                <p className="text-gray-200">&ldquo;{t.quote}&rdquo;</p>
                <footer className="mt-4">
                  <p className="font-semibold text-white">{t.name}</p>
                  <p className="text-sm text-gray-400">{t.role}</p>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary-600 py-16">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Ready to transform your career?</h2>
          <p className="mt-2 text-primary-100">Join thousands of students. Get certified. Get placed.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link to="/register" className="rounded-lg bg-white px-6 py-3 text-base font-semibold text-brand-navy hover:bg-gray-100 transition">
              Get Started
            </Link>
            <Link to="/programs" className="rounded-lg border-2 border-white px-6 py-3 text-base font-semibold text-white hover:bg-white/10 transition">
              Explore Programs
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
