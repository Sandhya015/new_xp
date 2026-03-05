import { Link } from 'react-router-dom'

const placeholderPrograms = [
  { id: '1', title: 'Full Stack Web Development', duration: '4 Weeks', tag: 'MERN Stack', desc: 'Build dynamic, responsive, and scalable web applications.' },
  { id: '2', title: 'Artificial Intelligence & Machine Learning', duration: '4 Weeks', tag: 'AI/ML', desc: 'Comprehensive training in AI & ML covering algorithms and practical applications.' },
  { id: '3', title: 'Data Science', duration: '4 Weeks', tag: 'Python & Analytics', desc: 'Master data analysis, visualization, and machine learning with Python.' },
  { id: '4', title: 'Digital Marketing', duration: '4 Weeks', tag: 'Marketing', desc: 'SEO, social media, and campaign management for career-ready skills.' },
  { id: '5', title: 'Cyber Security', duration: '4 Weeks', tag: 'Security', desc: 'Ethical hacking, network security, and compliance fundamentals.' },
  { id: '6', title: 'Cloud & DevOps', duration: '4 Weeks', tag: 'AWS / DevOps', desc: 'Cloud infrastructure and CI/CD for modern software delivery.' },
]

export function ProgramsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-brand-navy">Programs & Courses</h1>
        <p className="mt-2 text-gray-600">Industry-ready training aligned with AICTE and UGC guidelines.</p>
      </div>

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {placeholderPrograms.map((prog) => (
          <article
            key={prog.id}
            className="flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm transition hover:shadow-md"
          >
            <div className="flex-1 p-6">
              <span className="rounded bg-primary-100 px-2 py-1 text-xs font-medium text-brand-accent">{prog.tag}</span>
              <h2 className="mt-3 text-lg font-semibold text-brand-navy">{prog.title}</h2>
              <p className="mt-2 text-sm text-gray-600">{prog.desc}</p>
              <p className="mt-2 text-sm text-gray-500">{prog.duration} · Live sessions · Projects · Certificate</p>
            </div>
            <div className="border-t border-gray-100 p-4 flex gap-3">
              <Link to={`/programs/${prog.id}`} className="text-sm font-semibold text-brand-accent hover:underline">
                View Details
              </Link>
              <Link to="/register" className="text-sm font-semibold text-brand-navy hover:underline">
                Enroll
              </Link>
            </div>
          </article>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-gray-500">
        Course data will be loaded from the API once the backend is connected.
      </p>
    </div>
  )
}
