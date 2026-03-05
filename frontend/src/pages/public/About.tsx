import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Check, Target, Rocket, Trophy, GraduationCap, ScrollText } from 'lucide-react'

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
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [once])
  return { ref, inView }
}

export function About() {
  const whoRef = useInView()
  const missionRef = useInView()
  const complianceRef = useInView()
  const [heroVisible, setHeroVisible] = useState(false)
  useEffect(() => setHeroVisible(true), [])

  return (
    <div className="min-w-0">
      {/* Hero — blue gradient banner */}
      <section className="relative bg-gradient-to-br from-brand-navy via-primary-800 to-primary-900 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.04\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-80" />
        <div className={`relative mx-auto max-w-7xl px-4 py-12 sm:py-16 lg:py-20 sm:px-6 lg:px-8 ${heroVisible ? 'animate-fade-in-up' : 'opacity-0 translate-y-4'}`}>
          <nav className="text-sm text-primary-200" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-white transition">Home</Link>
            <span className="mx-2">/</span>
            <span className="text-white font-medium">About Us</span>
          </nav>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            About XpertIntern
          </h1>
          <p className="mt-3 text-lg text-primary-200 sm:text-xl max-w-2xl">
            India&apos;s leading training and internship platform for students.
          </p>
        </div>
      </section>

      {/* Who We Are — stats card left, content right */}
      <section ref={whoRef.ref} className={`bg-white py-14 sm:py-16 lg:py-24 about-reveal ${whoRef.inView ? 'in-view' : ''}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 sm:gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            <div className="rounded-2xl bg-gradient-to-b from-primary-700 to-brand-navy p-8 sm:p-10 lg:p-12 text-white shadow-2xl order-2 lg:order-1 transition-transform duration-300 hover:scale-[1.02]">
              <div className="flex justify-center mb-8">
                <div className="flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
                  <Building2 className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
                </div>
              </div>
              <div className="flex justify-around gap-6">
                <div className="text-center">
                  <p className="text-4xl sm:text-5xl font-bold">50,000+</p>
                  <p className="mt-1 text-sm sm:text-base text-white/90">Students</p>
                </div>
                <div className="text-center">
                  <p className="text-4xl sm:text-5xl font-bold">20+</p>
                  <p className="mt-1 text-sm sm:text-base text-white/90">Universities</p>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2 min-w-0">
              <span className="inline-block rounded-full bg-brand-light-bg border border-primary-200 px-4 py-2 text-sm font-medium text-brand-accent">
                Who We Are
              </span>
              <h2 className="mt-4 text-2xl font-bold text-brand-navy sm:text-3xl lg:text-4xl">
                India&apos;s Leading Training & Internship Platform
              </h2>
              <p className="mt-5 text-slate-gray leading-relaxed">
                XpertIntern is a platform that provides university-based training and internships. We follow{' '}
                <strong className="text-brand-navy">AICTE, UGC and NEP 2020</strong> guidelines to ensure students receive proper practical exposure.
              </p>
              <p className="mt-4 text-slate-gray leading-relaxed">
                Founded with a mission to bridge the gap between academic learning and industry requirements, XpertIntern serves students from Bihar, Jharkhand, UP, and across India.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  'University-aligned training programs',
                  'AICTE & UGC compliant curriculum',
                  'Verified digital certificates with QR codes',
                  'Internships with 200+ partner companies',
                ].map((item, i) => (
                  <li key={item} className={`flex items-center gap-3 about-reveal ${whoRef.inView ? 'in-view' : ''}`} style={{ transitionDelay: `${0.08 * (i + 1)}s` }}>
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-green">
                      <Check className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
                    </span>
                    <span className="text-slate-gray">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-10">
                <Link
                  to="/training"
                  className="inline-flex items-center rounded-lg bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition"
                >
                  View our programs →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section ref={missionRef.ref} className={`bg-brand-light-bg/60 py-14 sm:py-16 lg:py-24 about-reveal ${missionRef.inView ? 'in-view' : ''}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block rounded-full bg-white border border-primary-200 px-4 py-2 text-sm font-medium text-brand-navy shadow-sm">
            Our Values
          </span>
          <h2 className="mt-4 text-2xl font-bold text-brand-navy sm:text-3xl lg:text-4xl">
            Mission & Vision
          </h2>
          <div className="mt-10 sm:mt-12 grid gap-6 sm:gap-8 md:grid-cols-2 max-w-4xl mx-auto">
            <div className={`rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-left about-reveal ${missionRef.inView ? 'in-view' : ''}`} style={{ transitionDelay: '0.15s' }}>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100">
                <Target className="h-7 w-7 text-red-600" />
              </div>
              <h3 className="mt-5 text-xl font-bold text-brand-navy">Our Mission</h3>
              <p className="mt-3 text-slate-gray leading-relaxed">
                To provide every student in India — technical or non-technical — access to quality skill training and real industry internships that make them job-ready and industry-relevant.
              </p>
            </div>
            <div className={`rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-left about-reveal ${missionRef.inView ? 'in-view' : ''}`} style={{ transitionDelay: '0.25s' }}>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100">
                <Rocket className="h-7 w-7 text-brand-accent" />
              </div>
              <h3 className="mt-5 text-xl font-bold text-brand-navy">Our Vision</h3>
              <p className="mt-3 text-slate-gray leading-relaxed">
                To become India&apos;s most trusted platform for university students to gain practical skills, real experience, and verified credentials that open doors to meaningful careers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Our Achievements & Compliance */}
      <section ref={complianceRef.ref} className={`bg-white py-14 sm:py-16 lg:py-24 about-reveal ${complianceRef.inView ? 'in-view' : ''}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block rounded-full bg-brand-light-bg border border-primary-200 px-4 py-2 text-sm font-medium text-brand-navy shadow-sm">
            Compliance
          </span>
          <h2 className="mt-4 text-2xl font-bold text-brand-navy sm:text-3xl lg:text-4xl">
            Our Achievements & Compliance
          </h2>
          <div className="mt-10 sm:mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className={`rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 about-reveal ${complianceRef.inView ? 'in-view' : ''}`} style={{ transitionDelay: '0.1s' }}>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-accent/10">
                <Trophy className="h-8 w-8 text-brand-accent" />
              </div>
              <h3 className="mt-5 text-lg font-bold text-brand-navy">50,000+ Students</h3>
              <p className="mt-2 text-sm text-slate-gray">Successfully trained students across India</p>
            </div>
            <div className={`rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 about-reveal ${complianceRef.inView ? 'in-view' : ''}`} style={{ transitionDelay: '0.2s' }}>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-accent/10">
                <GraduationCap className="h-8 w-8 text-brand-accent" />
              </div>
              <h3 className="mt-5 text-lg font-bold text-brand-navy">AICTE Compliant</h3>
              <p className="mt-2 text-sm text-slate-gray">All technical programs follow AICTE guidelines</p>
            </div>
            <div className={`rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 about-reveal sm:col-span-2 lg:col-span-1 ${complianceRef.inView ? 'in-view' : ''}`} style={{ transitionDelay: '0.3s' }}>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-accent/10">
                <ScrollText className="h-8 w-8 text-brand-accent" />
              </div>
              <h3 className="mt-5 text-lg font-bold text-brand-navy">UGC & NEP 2020</h3>
              <p className="mt-2 text-sm text-slate-gray">Non-technical courses follow UGC and NEP 2020</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
