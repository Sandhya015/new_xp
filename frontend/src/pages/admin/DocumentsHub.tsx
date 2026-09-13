import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, CreditCard, BookOpen, ClipboardList, Award, Upload } from 'lucide-react'
import { documentsService } from '@/services/documentsService'

const CARDS = [
  {
    title: 'Offer Letter',
    desc: 'Technical & non-technical offer letters',
    to: '/admin/documents/offer-letter/technical',
    alt: '/admin/documents/offer-letter/non-technical',
    countKey: 'offer_letter_technical',
    icon: FileText,
  },
  {
    title: 'Student ID Card',
    desc: 'Auto-filled from student profile',
    to: '/admin/documents/id-card/technical',
    countKey: 'id_card',
    icon: CreditCard,
  },
  {
    title: 'Daily Logbook',
    desc: 'Training logbook with blank daily rows',
    to: '/admin/documents/logbook/technical',
    countKey: 'logbook',
    icon: BookOpen,
  },
  {
    title: 'Attendance Log PDF',
    desc: 'From unified attendance records',
    to: '/admin/documents/attendance-log',
    countKey: 'attendance_log',
    icon: ClipboardList,
  },
  {
    title: 'Certificate Generate',
    desc: 'Batch generate with marks & ratings',
    to: '/admin/documents/certificates/technical',
    countKey: 'certificate_generated',
    icon: Award,
  },
  {
    title: 'Manual Certificates',
    desc: 'Add / bulk upload (existing flow)',
    to: '/admin/certificates',
    icon: Upload,
  },
]

export function DocumentsHub() {
  const [counts, setCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    documentsService.hubCounts().then(setCounts).catch(() => setCounts({}))
  }, [])

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-brand-navy">Documents Hub</h1>
        <p className="mt-1 text-sm text-slate-gray">Generate and manage student documents for enrolled batches.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => {
          const Icon = c.icon
          const count = c.countKey ? counts[c.countKey] : undefined
          return (
            <Link
              key={c.title}
              to={c.to}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-brand-accent/40 hover:shadow-md"
            >
              <Icon className="h-8 w-8 text-brand-accent" />
              <h2 className="mt-3 font-semibold text-brand-navy">{c.title}</h2>
              <p className="mt-1 text-sm text-slate-gray">{c.desc}</p>
              {count != null ? <p className="mt-2 text-xs font-medium text-emerald-700">{count} issued</p> : null}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
