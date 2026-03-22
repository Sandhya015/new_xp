import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  TrendingUp,
  Briefcase,
  Award,
  Monitor,
  IndianRupee,
  UserPlus,
  Search,
  BookOpen,
  Laptop,
  Users,
  Layers,
  Check,
  GraduationCap,
  ScrollText,
  Send,
  Lightbulb,
  Globe,
  FileText,
  HeartHandshake,
  Code2,
  Star,
  Sparkles,
} from 'lucide-react'
import { CourseCard } from '@/components/CourseCard'
import { useCountUp } from '@/hooks/useCountUp'
import { UNIVERSITIES_LIST } from '@/constants/universities'

function useInView(once = true) {
  const ref = useRef<HTMLElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true)
        else if (!once) setInView(false)
      },
      { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [once])
  return { ref, inView }
}

const stats = [
  { end: 50000, suffix: '+', label: 'Students Trained' },
  { end: 200, suffix: '+', label: 'Partner Companies' },
  { end: 100, suffix: '+', label: 'Courses' },
  { end: 30, suffix: '+', label: 'Universities' },
]

function StatCounter({ end, suffix, label }: { end: number; suffix: string; label: string }) {
  const { value } = useCountUp(end, 2000, { startOnMount: true })
  const display = end >= 1000 ? value.toLocaleString() + suffix : value + suffix
  return (
    <div className="flex min-h-[4.5rem] sm:min-h-[5rem] flex-col items-center justify-start text-center">
      <p className="text-lg font-bold tabular-nums text-white sm:text-xl md:text-2xl leading-tight">{display}</p>
      <p className="mt-2 text-xs text-gray-400 sm:text-sm leading-snug">{label}</p>
    </div>
  )
}

/** Top 20 trending domains (Ezyintern-style shortlist) — marquee below hero */
const stripMarqueeItems = [
  'Artificial Intelligence & Machine Learning',
  'Data Analytics & Data Science',
  'Cloud Computing & DevOps',
  'Cyber Security & Ethical Hacking',
  'Python Programming & Automation',
  'Full Stack Development',
  'Data Science with Python',
  'Internet of Things (IoT)',
  'Embedded Systems',
  'Electric Vehicle Systems & Design',
  'Battery Management System (BMS)',
  'Industrial Automation (PLC + SCADA)',
  'AutoCAD',
  'Revit Architecture',
  'Ansys (Simulation & Analysis)',
  'Renewable Energy & Green Technology',
  'Digital Marketing & Social Media Management',
  'Financial Analysis & MIS Reporting',
  'Customer Relationship Management (CRM)',
  'Human Resource (HR) & Talent Acquisition',
]

const whyUsCards = [
  { title: 'University-Based Curriculum', desc: 'Training aligned with your university syllabus and exam requirements.', Icon: Building2, color: 'text-brand-accent' },
  { title: 'Industry-Oriented Training', desc: 'Learn skills demanded by today\'s industries with real project exposure.', Icon: TrendingUp, color: 'text-success-green' },
  { title: 'Internship Opportunity', desc: 'Get internship offers from top partner companies after training completion.', Icon: Briefcase, color: 'text-violet-500' },
  { title: 'Verified Certificate', desc: 'QR code verified certificates recognized by universities and companies.', Icon: Award, color: 'text-warning-orange' },
  { title: 'All Training Modes', desc: 'Online, Offline & Hybrid modes to suit your schedule and location.', Icon: Monitor, color: 'text-teal-600' },
  { title: 'Affordable Fees', desc: 'High-quality training at student-friendly pricing with flexible options.', Icon: IndianRupee, color: 'text-error-red' },
]

const universities = UNIVERSITIES_LIST

const whyInternshipCards = [
  { title: 'Practical Knowledge', desc: 'Apply theoretical concepts in real-world scenarios. Industry projects make learning stick and skills market-ready.', Icon: Lightbulb, iconBg: 'bg-amber-400/20 text-amber-500' },
  { title: 'Real Project Experience', desc: 'Work on live company projects under mentorship. Build a portfolio that speaks louder than any degree.', Icon: Code2, iconBg: 'bg-orange-400/20 text-orange-500' },
  { title: 'Industry Exposure', desc: 'Understand how companies operate, professional culture, and the dynamics of a real workplace environment.', Icon: Globe, iconBg: 'bg-blue-400/20 text-blue-400' },
  { title: 'Resume Building', desc: 'Add verified experience to your CV. Recruiters prioritize candidates with proven internship backgrounds.', Icon: FileText, iconBg: 'bg-white/20 text-white' },
  { title: 'Professional Networking', desc: 'Connect with industry professionals, mentors, and peers. Your network becomes your net worth.', Icon: HeartHandshake, iconBg: 'bg-amber-400/20 text-amber-400' },
  { title: 'Better Job Opportunities', desc: 'Internship-experienced candidates get hired faster and at better packages than freshers without experience.', Icon: Briefcase, iconBg: 'bg-amber-700/30 text-amber-200' },
]

const steps = [
  { num: '01', title: 'Register', desc: 'Create your free account on the XpertIntern platform', Icon: UserPlus },
  { num: '02', title: 'Choose Program', desc: 'Browse and select a training or internship program', Icon: Search },
  { num: '03', title: 'Enroll / Apply', desc: 'Enroll in training or apply for an internship', Icon: BookOpen },
  { num: '04', title: 'Complete Program', desc: 'Complete the training or internship over the chosen duration', Icon: Check },
  { num: '05', title: 'Get Certified', desc: 'Receive your certificate upon successful completion', Icon: Award },
  { num: '06', title: 'Verify Certificate', desc: 'Certificate can be verified online via ID or QR Code', Icon: Search },
]

const trainingModes = [
  { title: 'Online Mode', desc: 'Attend from anywhere through live or recorded sessions. Flexible timing for busy students.', Icon: Laptop, features: ['24/7 material access', 'Recorded video access', 'Live interactive sessions'], popular: false },
  { title: 'Offline Mode', desc: 'Attend classroom training in selected locations with hands-on practical sessions.', Icon: Users, features: ['Face-to-face learning', 'Lab access', 'Peer interaction'], popular: true },
  { title: 'Hybrid Mode', desc: 'Combination of online learning and offline sessions for maximum flexibility.', Icon: Layers, features: ['Best of both worlds', 'Flexible schedule', 'Campus + online'], popular: false },
]

const complianceCards = [
  { title: 'AICTE Guidelines', desc: 'All technical programs follow All India Council for Technical Education standards', Icon: GraduationCap },
  { title: 'UGC Guidelines', desc: 'Non-technical courses follow University Grants Commission regulations', Icon: ScrollText },
  { title: 'NEP 2020', desc: 'Structured as per National Education Policy 2020 framework', Icon: Building2 },
]

const technicalBranches = ['Computer Science Engineering (CSE)', 'Civil Engineering', 'Electrical Engineering', 'Electronics & Communication Engineering (ECE)', 'Mechanical Engineering']
const nonTechnicalCourses = ['BA — Bachelor of Arts', 'BSc — Bachelor of Science', 'BCom — Bachelor of Commerce', 'BBA — Bachelor of Business Administration', 'BCA — Bachelor of Computer Applications']
const branchesMoreLabel = 'And Many More'

const programsPreview = [
  { id: '1', title: 'Full Stack Web Development', duration: '4 Weeks', tag: 'MERN Stack' },
  { id: '2', title: 'Artificial Intelligence & ML', duration: '4 Weeks', tag: 'AI/ML' },
  { id: '3', title: 'Data Science', duration: '4 Weeks', tag: 'Python & Analytics' },
]

const INLINE_CONTACT_COURSES = ['B.Tech', 'Diploma', 'BA', 'BSc', 'BCom', 'BBA', 'BCA']
const INLINE_CONTACT_STREAMS = ['CSE', 'Civil', 'Electrical', 'ECE', 'Mechanical', 'IT']
type TestimonialCategory = 'student' | 'educator'

type HomeTestimonial = {
  name: string
  initials: string
  roleType: 'STUDENT' | 'EDUCATOR'
  roleDetail: string
  institution: string
  quote: string
  highlight: string
  category: TestimonialCategory
  avatarClass: string
}

const testimonials: HomeTestimonial[] = [
  {
    name: 'Amit Patel',
    initials: 'AP',
    roleType: 'STUDENT',
    roleDetail: 'B.Tech Student',
    institution: 'Government Engineering College Sheikhpura, Katihar',
    quote:
      'XpertIntern gave me the skills and confidence I needed to kickstart my career. The Web Development training was practical and taught by real industry experts. I got an AICTE compliant certificate and secured my first internship through the platform within weeks. Highly recommended for every engineering student!',
    highlight: 'Secured first internship within weeks of completing the training!',
    category: 'student',
    avatarClass: 'bg-gradient-to-br from-blue-600 to-indigo-700',
  },
  {
    name: 'Zafar Sadique',
    initials: 'ZS',
    roleType: 'STUDENT',
    roleDetail: 'B.Tech Student',
    institution: 'Katihar Engineering College, Katihar',
    quote:
      'XpertIntern connected me with real companies and real internship opportunities. The application process is simple and I could track my status at every step. The Python and Data Science training gave me skills I could confidently talk about in interviews. A must-have platform for every college student!',
    highlight: 'Got real industry exposure and cracked interviews with confidence!',
    category: 'student',
    avatarClass: 'bg-gradient-to-br from-emerald-600 to-teal-700',
  },
  {
    name: 'Rahul Kumar',
    initials: 'RK',
    roleType: 'STUDENT',
    roleDetail: 'Diploma Student',
    institution: 'Government Polytechnic Supaul, Raghoupur Supaul',
    quote:
      'XpertIntern is the first platform I found that truly supports Diploma students with training programs designed for our level. The certificate I received is AICTE compliant and helped me stand out in campus placement drives. Thank you XpertIntern for believing in Diploma students!',
    highlight: 'First platform that truly supports and empowers Diploma students!',
    category: 'student',
    avatarClass: 'bg-gradient-to-br from-violet-600 to-purple-700',
  },
  {
    name: 'Manish Kumar',
    initials: 'MK',
    roleType: 'STUDENT',
    roleDetail: 'B.Com Student',
    institution: 'Kisan College, Bihar Sharif',
    quote:
      'I thought XpertIntern was only for engineering students, but I was wrong! The Digital Marketing training covered everything from social media to SEO and was taught by real professionals. I got an internship with a marketing firm through the platform — XpertIntern is for every ambitious student!',
    highlight: 'Commerce students can thrive here too — landed a marketing internship!',
    category: 'student',
    avatarClass: 'bg-gradient-to-br from-amber-600 to-orange-700',
  },
  {
    name: 'Prof. Rajnish Kumar',
    initials: 'RJ',
    roleType: 'EDUCATOR',
    roleDetail: 'HOD — Civil Engineering',
    institution: 'Aryabhatta Polytechnic, Gaya',
    quote:
      "XpertIntern's training programs are AICTE and UGC compliant, which aligns perfectly with our curriculum objectives. The QR code certificate verification is impressive and builds real credibility for students. I have seen a clear improvement in the confidence and employability of students who have enrolled here.",
    highlight: 'Verified certificates and industry-aligned programs — highly recommended!',
    category: 'educator',
    avatarClass: 'bg-gradient-to-br from-slate-600 to-slate-800',
  },
  {
    name: 'Prof. Sandeep Kumar',
    initials: 'SK',
    roleType: 'EDUCATOR',
    roleDetail: 'Training & Placement Officer (TPO)',
    institution: 'Government Engineering College Sheikhpura',
    quote:
      'XpertIntern has become one of our most trusted partners for student placement. The programs follow AICTE and UGC guidelines, making it easy to integrate with our TPO activities. The quality of internships and the professional certificates make it a complete career-readiness solution for our students.',
    highlight: 'A complete career-readiness solution — a trusted TPO partner platform!',
    category: 'educator',
    avatarClass: 'bg-gradient-to-br from-cyan-600 to-blue-800',
  },
]

export function Home() {
  const [heroVisible, setHeroVisible] = useState(false)
  const [inlineContact, setInlineContact] = useState({
    fullName: '',
    contactNumber: '',
    university: '',
    collegeName: '',
    semester: '',
    course: '',
    stream: '',
    message: '',
  })
  const [inlineContactSubmitted, setInlineContactSubmitted] = useState(false)
  const [testimonialFilter, setTestimonialFilter] = useState<'all' | 'students' | 'educators'>('all')
  const whoRef = useInView()
  const whyRef = useInView()
  const reachRef = useInView()
  const whyInternshipRef = useInView()
  const howRef = useInView()
  const modesRef = useInView()
  const branchesRef = useInView()
  const programsRef = useInView()
  const complianceRef = useInView()
  const ctaRef = useInView()
  const testimonialsRef = useInView()
  const subscribeRef = useInView()

  useEffect(() => setHeroVisible(true), [])

  const showStream = inlineContact.course === 'B.Tech' || inlineContact.course === 'Diploma'
  const handleInlineContactSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setInlineContactSubmitted(true)
  }

  return (
    <>
      {/* Hero — content left, image right */}
      <section className="relative min-h-[calc(100vh-7rem)] flex flex-col bg-gradient-to-br from-brand-navy via-primary-900 to-primary-950 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.04\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-80" />
        <div className={`relative flex flex-1 flex-col justify-center mx-auto max-w-7xl w-full px-4 py-10 sm:py-16 sm:px-6 lg:px-8 lg:py-24 ${heroVisible ? 'animate-fade-in-up' : 'opacity-0 translate-y-8'}`}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left: headline + CTA + stats */}
            <div className="order-1 flex flex-col justify-center">
              <p className="text-primary-300 text-xs sm:text-sm font-medium uppercase tracking-wider">AICTE & UGC Approved Programs</p>
              <h1 className="mt-3 sm:mt-4 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
                India&apos;s Leading Training
                <br />
                <span className="text-primary-300">& Internship Platform</span>
              </h1>
              <p className="mt-4 sm:mt-6 max-w-2xl text-base sm:text-lg text-gray-300">
                Skill-based training and industry internships as per AICTE and UGC guidelines. We provide structured programs for technical and non-technical students across India.
              </p>
              <div className="mt-8 sm:mt-10 flex flex-wrap gap-3 sm:gap-4">
                <Link to="/training" className="inline-flex items-center justify-center rounded-lg bg-brand-accent px-5 py-2.5 sm:px-6 sm:py-3 text-sm sm:text-base font-semibold text-white shadow-lg hover:bg-primary-600 hover:scale-105 transition min-h-[44px]">Explore Training</Link>
                <Link to="/internship" className="inline-flex items-center justify-center rounded-lg border-2 border-white/40 bg-white/5 px-5 py-2.5 sm:px-6 sm:py-3 text-sm sm:text-base font-semibold text-white backdrop-blur hover:bg-white/10 hover:scale-105 transition min-h-[44px]">Explore Internship</Link>
              </div>
              <div className="mt-10 sm:mt-16 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 sm:gap-x-4 sm:gap-y-6 lg:gap-x-6">
                {stats.map(({ end, suffix, label }) => (
                  <StatCounter key={label} end={end} suffix={suffix} label={label} />
                ))}
              </div>
            </div>
            {/* Right: hero image */}
            <div className="order-2 flex justify-center lg:justify-end">
              <img
                src="/images/hero-xpertintern.png"
                alt="XpertIntern — students with training and internship platform highlights"
                className="w-full max-w-md lg:max-w-lg xl:max-w-xl rounded-xl shadow-2xl object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Strip marquee — course categories, dark blue, bullet list */}
      <section className="bg-gradient-to-b from-primary-900 to-brand-navy py-3 sm:py-4 overflow-hidden border-t border-white/5">
        <div className="flex w-max animate-marquee-strip gap-6 sm:gap-10 whitespace-nowrap">
          {[...stripMarqueeItems, ...stripMarqueeItems].map((item, i) => (
            <span key={`${item}-${i}`} className="flex items-center gap-2 sm:gap-3 text-gray-300 text-xs sm:text-sm font-medium">
              <span className="h-2 w-2 shrink-0 rounded-full bg-primary-300" aria-hidden />
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* About Us — Who We Are: stats card left, content right */}
      <section ref={whoRef.ref as React.RefObject<HTMLElement>} className={`bg-white py-12 sm:py-16 lg:py-24 about-reveal ${whoRef.inView ? 'in-view' : ''}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:gap-12 lg:grid-cols-2 lg:gap-16 items-stretch">
            {/* Left: About Us illustration — same height as text column */}
            <div className="order-2 lg:order-1 min-w-0 h-full min-h-[300px] sm:min-h-[360px] flex items-center justify-center">
              <img
                src="/images/about-us.png"
                alt="About Us — XpertIntern: students, mentor, India map, 50,000+ students trained, 100+ programs, 16+ partner universities"
                className="max-w-full w-full h-full min-h-[280px] object-contain object-center rounded-2xl shadow-lg"
              />
            </div>
            {/* Right: Who We Are content */}
            <div className="order-1 lg:order-2 min-w-0">
              <span className="inline-block rounded-full bg-brand-light-bg border border-primary-200 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium text-brand-accent">Who We Are</span>
              <h2 className="mt-3 sm:mt-4 text-2xl font-bold text-brand-navy sm:text-3xl lg:text-4xl">India&apos;s Leading Training & Internship Platform</h2>
              <p className="mt-4 sm:mt-6 text-sm sm:text-base text-slate-gray leading-relaxed">
                XpertIntern is a platform that provides university-based training and internships. We follow <strong className="text-brand-navy">AICTE, UGC and NEP 2020</strong> guidelines to ensure students receive proper practical exposure.
              </p>
              <p className="mt-3 sm:mt-4 text-sm sm:text-base text-slate-gray leading-relaxed">
                Founded with a mission to bridge the gap between academic learning and industry requirements, XpertIntern serves students from Bihar, Jharkhand, UP, and across India.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  'University-aligned training programs',
                  'AICTE & UGC compliant curriculum',
                  'Verified digital certificates with QR codes',
                  'Internships with 200+ partner companies',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-green">
                      <Check className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
                    </span>
                    <span className="text-slate-gray">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us — 6 cards, 3x2 */}
      <section ref={whyRef.ref as React.RefObject<HTMLElement>} className={`bg-brand-light-bg py-12 sm:py-16 lg:py-20 ${whyRef.inView ? 'home-stagger-inview' : ''}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <span className="inline-block rounded-full bg-white border border-primary-200 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium text-brand-navy shadow-sm">Why Choose Us</span>
          <h2 className="mt-3 sm:mt-4 text-2xl font-bold text-brand-navy sm:text-3xl">What Makes XpertIntern Different</h2>
          <p className="mt-2 text-sm sm:text-base text-slate-gray">We combine industry expertise with academic compliance to deliver the best training experience.</p>
          <div className="mt-8 sm:mt-12 grid gap-4 sm:gap-6 lg:gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {whyUsCards.map(({ title, desc, Icon, color }) => (
              <div key={title} className="home-stagger-card rounded-xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm transition hover:shadow-lg hover:-translate-y-1 text-center min-w-0">
                <div className="mx-auto flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center">
                  <Icon className={`h-8 w-8 sm:h-10 sm:w-10 ${color}`} strokeWidth={1.5} />
                </div>
                <h3 className="mt-3 sm:mt-4 text-base sm:text-lg font-semibold text-brand-navy">{title}</h3>
                <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-slate-gray">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Reach — Universities (marquee) — anchor for footer "Our Partner Universities" */}
      <section id="partner-universities" ref={reachRef.ref as React.RefObject<HTMLElement>} className={`bg-white py-12 sm:py-16 lg:py-20 overflow-hidden about-reveal ${reachRef.inView ? 'in-view' : ''}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 min-w-0">
          <span className="inline-block rounded-full bg-brand-light-bg border border-primary-200 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium text-brand-navy shadow-sm">Our Reach</span>
          <h2 className="mt-3 sm:mt-4 text-2xl font-bold text-brand-navy sm:text-3xl">Top Universities & Boards We Serve</h2>
          <p className="mt-2 text-sm sm:text-base text-slate-gray">Serving students from major universities and technical boards across India.</p>
          <div className="mt-8 sm:mt-10 overflow-hidden">
            <div className="flex w-max animate-marquee gap-3 sm:gap-4">
              {[...universities, ...universities].map((uni, i) => (
                <div key={`${uni.name}-${i}`} className="flex-shrink-0 w-28 sm:w-36 lg:w-40 rounded-xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm flex flex-col items-center justify-center text-center min-w-0">
                  <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-brand-light-bg overflow-hidden shrink-0">
                    <img src={uni.logo} alt="" className="h-full w-full object-contain" />
                  </div>
                  <p className="mt-2 sm:mt-3 text-xs sm:text-sm font-medium text-brand-navy break-words">{uni.name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Why Internship is Important for Students — dark blue, 6 cards */}
      <section ref={whyInternshipRef.ref as React.RefObject<HTMLElement>} className={`bg-brand-navy py-12 sm:py-16 lg:py-20 text-white about-reveal ${whyInternshipRef.inView ? 'in-view' : ''}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold sm:text-3xl lg:text-4xl">Why Internship is Important for Students</h2>
          <p className="mt-3 sm:mt-4 max-w-2xl text-gray-300 text-sm sm:text-base">
            In today&apos;s competitive job market, hands-on experience sets you apart. Here&apos;s how internships shape your career.
          </p>
          <div className="mt-8 sm:mt-12 grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {whyInternshipCards.map(({ title, desc, Icon, iconBg }) => (
              <div key={title} className="rounded-xl bg-white/5 backdrop-blur border border-white/10 p-5 sm:p-6 hover:bg-white/10 transition">
                <div className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg ${iconBg}`}>
                  <Icon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.5} />
                </div>
                <h3 className="mt-3 sm:mt-4 text-base sm:text-lg font-semibold text-white">{title}</h3>
                <p className="mt-1.5 sm:mt-2 text-sm text-gray-300 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works — 6 steps with numbered badges and icons */}
      <section ref={howRef.ref as React.RefObject<HTMLElement>} className={`bg-brand-light-bg py-12 sm:py-16 lg:py-20 ${howRef.inView ? 'home-stagger-inview' : ''}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 min-w-0">
          <span className="inline-block rounded-full bg-white border border-primary-200 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium text-brand-navy shadow-sm">Simple Process</span>
          <h2 className="mt-3 sm:mt-4 text-2xl font-bold text-brand-navy sm:text-3xl">How It Works</h2>
          <p className="mt-2 text-sm sm:text-base text-slate-gray">Get started in minutes and be on your way to a successful career.</p>
          <div className="mt-8 sm:mt-12 grid grid-cols-2 sm:flex sm:flex-wrap justify-center gap-4 sm:gap-6 lg:gap-4">
            {steps.map((step, i) => {
              const StepIcon = step.Icon
              return (
                <div key={step.num} className="home-stagger-card flex items-start sm:items-center justify-center">
                  <div className="flex flex-col items-center text-center min-w-[120px] sm:min-w-0 sm:w-36 lg:w-40">
                    <div className="relative">
                      <span className="absolute -top-1 -right-1 flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-brand-navy text-[10px] sm:text-xs font-bold text-white">{step.num}</span>
                      <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-brand-navy">
                        <StepIcon className="h-6 w-6 sm:h-8 sm:w-8 text-primary-200" />
                      </div>
                    </div>
                    <h3 className="mt-2 sm:mt-3 text-xs sm:text-sm font-semibold text-brand-navy">{step.title}</h3>
                    <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-slate-gray leading-tight">{step.desc}</p>
                  </div>
                  {i < steps.length - 1 && <span className="hidden lg:inline text-primary-300 mx-1 self-center">›</span>}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Training Modes — 3 cards, center highlighted */}
      <section ref={modesRef.ref as React.RefObject<HTMLElement>} className={`bg-white py-12 sm:py-16 lg:py-20 ${modesRef.inView ? 'home-stagger-inview' : ''}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 min-w-0">
          <span className="inline-block rounded-full bg-brand-light-bg border border-primary-200 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium text-brand-navy shadow-sm">Flexible Learning</span>
          <h2 className="mt-3 sm:mt-4 text-2xl font-bold text-brand-navy sm:text-3xl">Training Modes Available</h2>
          <div className="mt-8 sm:mt-12 grid gap-4 sm:gap-6 md:gap-8 md:grid-cols-3">
            {trainingModes.map((mode) => {
              const ModeIcon = mode.Icon
              return (
              <div
                key={mode.title}
                className={`home-stagger-card relative rounded-xl border p-4 sm:p-6 shadow-sm min-w-0 transition-transform duration-300 hover:scale-[1.02] ${
                  mode.popular ? 'bg-brand-navy border-brand-navy text-white shadow-lg md:scale-105' : 'bg-white border-gray-200'
                }`}
              >
                {mode.popular && (
                  <span className="absolute top-3 right-3 sm:top-4 sm:right-4 rounded-lg bg-warning-orange px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold text-white">Most Popular</span>
                )}
                <div className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg ${mode.popular ? 'bg-white/10' : 'bg-brand-light-bg'}`}>
                  <ModeIcon className={mode.popular ? 'h-5 w-5 sm:h-6 sm:w-6 text-white' : 'h-5 w-5 sm:h-6 sm:w-6 text-brand-navy'} />
                </div>
                <h3 className={`mt-3 sm:mt-4 text-base sm:text-lg font-semibold ${mode.popular ? 'text-white' : 'text-brand-navy'}`}>{mode.title}</h3>
                <p className={`mt-1.5 sm:mt-2 text-xs sm:text-sm ${mode.popular ? 'text-gray-300' : 'text-slate-gray'}`}>{mode.desc}</p>
                <ul className="mt-3 sm:mt-4 space-y-1.5 sm:space-y-2">
                  {mode.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs sm:text-sm">
                      <Check className={`h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 ${mode.popular ? 'text-white' : 'text-success-green'}`} />
                      <span className={mode.popular ? 'text-gray-200' : 'text-slate-gray'}>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
            })}
          </div>
        </div>
      </section>

      {/* Branches & Streams Covered — doc 4.2.8 */}
      <section ref={branchesRef.ref as React.RefObject<HTMLElement>} className={`bg-brand-light-bg py-12 sm:py-16 lg:py-20 ${branchesRef.inView ? 'home-stagger-inview' : ''}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 min-w-0">
          <span className="inline-block rounded-full bg-white border border-primary-200 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium text-brand-navy shadow-sm">Programs</span>
          <h2 className="mt-3 sm:mt-4 text-2xl font-bold text-brand-navy sm:text-3xl">Branches & Streams Covered</h2>
          <p className="mt-2 text-sm sm:text-base text-slate-gray">Technical and non-technical courses for B.Tech, Diploma, and graduation streams.</p>
          <div className="mt-8 sm:mt-12 grid gap-6 sm:grid-cols-2">
            <div className="home-stagger-card rounded-xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm">
              <h3 className="text-base font-semibold text-brand-navy sm:text-lg">Technical (B.Tech / Diploma)</h3>
              <ul className="mt-3 space-y-1.5 text-sm text-slate-gray">
                {technicalBranches.map((b) => (
                  <li key={b} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-success-green flex-shrink-0" /> {b}
                  </li>
                ))}
                <li className="pt-2 text-sm font-semibold text-brand-navy">{branchesMoreLabel}</li>
              </ul>
            </div>
            <div className="home-stagger-card rounded-xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm">
              <h3 className="text-base font-semibold text-brand-navy sm:text-lg">Non-Technical</h3>
              <ul className="mt-3 space-y-1.5 text-sm text-slate-gray">
                {nonTechnicalCourses.map((c) => (
                  <li key={c} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-success-green flex-shrink-0" /> {c}
                  </li>
                ))}
                <li className="pt-2 text-sm font-semibold text-brand-navy">{branchesMoreLabel}</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Programs */}
      <section ref={programsRef.ref as React.RefObject<HTMLElement>} className={`bg-brand-light-bg py-12 sm:py-16 lg:py-20 ${programsRef.inView ? 'home-stagger-inview' : ''}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 min-w-0">
          <h2 className="text-2xl font-bold text-brand-navy sm:text-3xl">Popular Programs</h2>
          <p className="mt-2 text-sm sm:text-base text-slate-gray">Transform your career with industry-leading courses</p>
          <div className="mt-8 sm:mt-12 grid gap-4 sm:gap-6 lg:gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {programsPreview.map((prog) => (
              <div key={prog.id} className="home-stagger-card">
                <CourseCard id={prog.id} title={prog.title} duration={prog.duration} tag={prog.tag} />
              </div>
            ))}
          </div>
          <div className="mt-8 sm:mt-10 text-center">
            <Link to="/training" className="inline-flex items-center justify-center rounded-lg bg-brand-navy px-5 py-2.5 sm:px-6 sm:py-3 text-sm font-semibold text-white hover:bg-primary-800 transition min-h-[44px]">View All Courses</Link>
          </div>
        </div>
      </section>

      {/* Approved & Compliant Programs */}
      <section ref={complianceRef.ref as React.RefObject<HTMLElement>} className={`bg-white py-12 sm:py-16 lg:py-20 ${complianceRef.inView ? 'home-stagger-inview' : ''}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 min-w-0">
          <span className="inline-block rounded-full bg-brand-light-bg border border-primary-200 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium text-brand-navy shadow-sm">Compliance</span>
          <h2 className="mt-3 sm:mt-4 text-2xl font-bold text-brand-navy sm:text-3xl">Compliant Programs</h2>
          <div className="mt-8 sm:mt-12 grid gap-4 sm:gap-6 lg:gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {complianceCards.map(({ title, desc, Icon: ComplianceIcon }) => (
              <div key={title} className="home-stagger-card rounded-xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm min-w-0 transition-transform duration-300 hover:scale-[1.02]">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-brand-light-bg">
                  <ComplianceIcon className="h-5 w-5 sm:h-6 sm:w-6 text-brand-navy" />
                </div>
                <h3 className="mt-3 sm:mt-4 text-base sm:text-lg font-semibold text-brand-navy">{title}</h3>
                <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-slate-gray">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Request a Free Call Back */}
      <section ref={ctaRef.ref as React.RefObject<HTMLElement>} className={`bg-gray-50 py-12 sm:py-16 lg:py-20 about-reveal ${ctaRef.inView ? 'in-view' : ''}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 min-w-0">
          <div className="grid gap-8 sm:gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="min-w-0">
              <span className="inline-block rounded-lg bg-brand-light-bg border border-primary-200 px-3 py-1.5 text-xs sm:text-sm font-medium text-brand-navy">Get In Touch</span>
              <h2 className="mt-3 sm:mt-4 text-2xl font-bold text-brand-navy sm:text-3xl">Request a Free Call Back</h2>
              <p className="mt-2 text-slate-gray">Our counselors will guide you to choose the right training program for your career goals.</p>
              <ul className="mt-6 space-y-3">
                {['Free career counseling', 'University-specific guidance', 'Scholarship information'].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-success-green flex-shrink-0" />
                    <span className="text-slate-gray">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm min-w-0 transition-shadow hover:shadow-md">
              {inlineContactSubmitted ? (
                <p className="rounded-lg border border-success-green bg-green-50 p-4 text-sm text-brand-navy">
                  Thank you! Your query has been received. Our team will contact you within 24–48 hours.
                </p>
              ) : (
                <form className="space-y-3 sm:space-y-4" onSubmit={handleInlineContactSubmit}>
                  <input type="text" required placeholder="Full Name *" value={inlineContact.fullName} onChange={(e) => setInlineContact((c) => ({ ...c, fullName: e.target.value }))} className="block w-full min-w-0 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent" />
                  <input type="tel" required placeholder="Contact Number (10-digit) *" maxLength={10} value={inlineContact.contactNumber} onChange={(e) => setInlineContact((c) => ({ ...c, contactNumber: e.target.value.replace(/\D/g, '').slice(0, 10) }))} className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent" />
                  <select required value={inlineContact.university} onChange={(e) => setInlineContact((c) => ({ ...c, university: e.target.value }))} className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-slate-gray focus:border-brand-accent focus:ring-1 focus:ring-brand-accent">
                    <option value="">University *</option>
                    {universities.map((u) => <option key={u.name} value={u.name}>{u.shortForm} — {u.name}</option>)}
                  </select>
                  <input type="text" required placeholder="College Name *" value={inlineContact.collegeName} onChange={(e) => setInlineContact((c) => ({ ...c, collegeName: e.target.value }))} className="block w-full min-w-0 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent" />
                  <select required value={inlineContact.semester} onChange={(e) => setInlineContact((c) => ({ ...c, semester: e.target.value }))} className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-slate-gray focus:border-brand-accent focus:ring-1 focus:ring-brand-accent">
                    <option value="">Semester *</option>
                    {['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select required value={inlineContact.course} onChange={(e) => setInlineContact((c) => ({ ...c, course: e.target.value, stream: '' }))} className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-slate-gray focus:border-brand-accent focus:ring-1 focus:ring-brand-accent">
                    <option value="">Course *</option>
                    {INLINE_CONTACT_COURSES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {showStream && (
                    <select required value={inlineContact.stream} onChange={(e) => setInlineContact((c) => ({ ...c, stream: e.target.value }))} className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-slate-gray focus:border-brand-accent focus:ring-1 focus:ring-brand-accent">
                      <option value="">Stream *</option>
                      {INLINE_CONTACT_STREAMS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                  <textarea required placeholder="Message / Query *" rows={3} value={inlineContact.message} onChange={(e) => setInlineContact((c) => ({ ...c, message: e.target.value }))} className="block w-full min-w-0 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent" />
                  <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-navy py-2.5 text-sm font-semibold text-white hover:bg-primary-800 transition">
                    <Send className="h-4 w-4" /> Submit
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* What Our Students & Educators Say — professional cards + avatars */}
      <section ref={testimonialsRef.ref as React.RefObject<HTMLElement>} className={`bg-sky-100/95 py-12 sm:py-16 lg:py-20 ${testimonialsRef.inView ? 'home-stagger-inview' : ''}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 min-w-0">
          <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-brand-accent">XpertIntern</p>
          <h2 className="mt-2 text-2xl font-bold text-brand-navy sm:text-3xl lg:text-4xl text-center">
            What Our Students &amp; Educators Say
          </h2>
          <p className="mt-2 text-center text-base font-semibold text-brand-navy sm:text-lg">India&apos;s Trusted Training &amp; Internship Platform</p>
          <p className="mt-1 text-center text-sm text-slate-gray">
            AICTE | UGC | NEP 2020 Compliant — <span className="font-medium text-brand-navy">Real Stories. Real Results. Real Careers.</span>
          </p>

          <div className="mt-8 sm:mt-10 flex justify-center">
            <div className="inline-flex flex-wrap justify-center rounded-full bg-white p-1 shadow-md border border-gray-100" role="tablist" aria-label="Filter testimonials">
              {(['all', 'students', 'educators'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setTestimonialFilter(tab)}
                  className={`px-4 sm:px-5 py-2 rounded-full text-sm font-medium transition ${testimonialFilter === tab ? 'bg-brand-accent text-white shadow-sm' : 'text-gray-600 hover:text-brand-navy'}`}
                >
                  {tab === 'all' ? 'All' : tab === 'students' ? 'Students' : 'Educators & Faculty'}
                </button>
              ))}
            </div>
          </div>

          {(() => {
            const studentT = testimonials.filter((t) => t.category === 'student')
            const educatorT = testimonials.filter((t) => t.category === 'educator')
            const showStudents = testimonialFilter === 'all' || testimonialFilter === 'students'
            const showEducators = testimonialFilter === 'all' || testimonialFilter === 'educators'

            const card = (t: HomeTestimonial) => (
              <article
                key={t.name}
                className="home-stagger-card flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-5 sm:p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className="flex gap-4">
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-base font-bold text-white shadow-inner ring-2 ring-white ${t.avatarClass}`}
                    aria-hidden
                  >
                    {t.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-brand-navy">{t.name}</h3>
                      <span className="rounded-md bg-primary-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-800">
                        {t.roleType}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-gray">{t.roleDetail}</p>
                    <div className="mt-2 flex gap-0.5" aria-label="5 out of 5 stars">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400 shrink-0" strokeWidth={1.5} />
                      ))}
                    </div>
                    <p className="mt-2 text-xs leading-snug text-slate-gray sm:text-sm">{t.institution}</p>
                  </div>
                </div>
                <blockquote className="mt-4 flex-1 border-l-2 border-brand-accent/40 pl-4 text-sm leading-relaxed text-gray-700 sm:text-base">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <p className="mt-4 flex items-start gap-2 rounded-lg bg-brand-light-bg/80 px-3 py-2.5 text-sm font-medium text-brand-navy">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" aria-hidden />
                  {t.highlight}
                </p>
              </article>
            )

            return (
              <div className="mt-10 space-y-12 sm:space-y-14">
                {showStudents && (
                  <div>
                    {testimonialFilter === 'all' && (
                      <h3 className="mb-6 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-brand-navy">
                        <span className="h-2 w-2 rounded-sm bg-brand-accent" aria-hidden />
                        Student testimonials
                      </h3>
                    )}
                    <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
                      {(testimonialFilter === 'all' ? studentT : testimonials.filter((x) => x.category === 'student')).map(card)}
                    </div>
                  </div>
                )}
                {showEducators && (
                  <div>
                    {testimonialFilter === 'all' && (
                      <h3 className="mb-6 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-brand-navy">
                        <span className="h-2 w-2 rounded-sm bg-brand-accent" aria-hidden />
                        Educator &amp; faculty testimonials
                      </h3>
                    )}
                    <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
                      {(testimonialFilter === 'all' ? educatorT : testimonials.filter((x) => x.category === 'educator')).map(card)}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      </section>

      {/* Subscribe for Updates */}
      <section ref={subscribeRef.ref as React.RefObject<HTMLElement>} className={`bg-brand-navy py-8 sm:py-10 border-t border-white/10 about-reveal ${subscribeRef.inView ? 'in-view' : ''}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 sm:gap-6 min-w-0">
          <div className="text-center sm:text-left min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-white">Subscribe for Updates</h2>
            <p className="mt-1 text-xs sm:text-sm text-gray-300">Get latest training programs, internship offers and career tips.</p>
          </div>
          <form className="flex w-full sm:w-auto gap-2 max-w-md min-w-0 sm:min-w-[280px]" onSubmit={(e) => e.preventDefault()}>
            <input type="email" placeholder="Enter your email address" className="flex-1 min-w-0 rounded-lg border border-gray-500 bg-white/5 px-3 sm:px-4 py-2.5 text-sm text-white placeholder-gray-400 focus:border-brand-accent focus:outline-none" />
            <button type="submit" className="flex items-center justify-center gap-2 rounded-lg bg-brand-accent px-4 sm:px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition shrink-0 min-h-[44px]">
              <Send className="h-4 w-4" /> Subscribe
            </button>
          </form>
        </div>
      </section>
    </>
  )
}
