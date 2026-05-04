import { Link, useNavigate } from 'react-router-dom'
import { Clock, Monitor, Building2, Laptop, Star } from 'lucide-react'
import { courseContentPath, courseMarketingPath } from '@/utils/courseStudyLink'
import { absoluteApiUrl } from '@/config/api'
import { splitInrTaxInclusive, formatInr } from '@/utils/gstPricing'
import { ShareCourseMenu } from '@/components/training/ShareCourseMenu'

export type TrainingProgramCardCourse = {
  id: string
  title: string
  description: string
  category: 'technical' | 'non-technical' | 'other'
  duration: string
  mode: string
  universities: string
  price: number
  originalPrice: number
  featuredImageUrl: string
  reviewAverage?: number
  reviewCount?: number
}

function ModeIcon({ mode }: { mode: string }) {
  const m = mode.toLowerCase()
  if (m.includes('online')) return <Laptop className="h-3.5 w-3.5 shrink-0 text-slate-500" />
  if (m.includes('offline')) return <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-500" />
  return <Monitor className="h-3.5 w-3.5 shrink-0 text-slate-500" />
}

type Props = {
  course: TrainingProgramCardCourse
  isLoggedIn: boolean
  isEnrolled: boolean
  isCompleted: boolean
  onEnroll: () => void
  payBusy?: boolean
}

/**
 * Shared catalog card: public /training and student /dashboard/training.
 */
export function TrainingProgramCard({ course, isLoggedIn, isEnrolled, isCompleted, onEnroll, payBusy }: Props) {
  const navigate = useNavigate()
  const marketingPath = courseMarketingPath(course.id)
  const detailTo = isEnrolled ? courseContentPath(course.id) : marketingPath
  const goDetails = () => {
    if (!isLoggedIn) {
      navigate(`/login?next=${encodeURIComponent(marketingPath)}`)
      return
    }
    navigate(detailTo)
  }
  const goEnroll = () => {
    if (!isLoggedIn) {
      navigate(`/login?next=${encodeURIComponent(`${marketingPath}?enroll=1`)}`)
      return
    }
    onEnroll()
  }
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}${courseMarketingPath(course.id)}` : ''
  const thumb = course.featuredImageUrl ? absoluteApiUrl(course.featuredImageUrl) : ''
  const catLabel =
    course.category === 'technical' ? 'Technical' : course.category === 'non-technical' ? 'Non-Technical' : 'Other'
  const catClass =
    course.category === 'technical'
      ? 'bg-emerald-500/95 text-white'
      : course.category === 'non-technical'
        ? 'bg-orange-500/95 text-white'
        : 'bg-slate-600/95 text-white'
  const listPrice = course.originalPrice > course.price ? course.originalPrice : null
  const gstLine = course.price > 0 ? splitInrTaxInclusive(course.price, 0.18) : null

  return (
    <article className="group flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg">
      <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
        {thumb ? (
          <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">No thumbnail</div>
        )}
        <span className={`absolute right-2 top-2 rounded-full px-2.5 py-0.5 text-xs font-semibold shadow ${catClass}`}>{catLabel}</span>
        <div className="absolute left-2 top-2">
          <ShareCourseMenu
            iconOnly
            url={shareUrl}
            title={course.title}
            description={course.description}
            university={course.universities}
          />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h2 className="text-base font-bold leading-snug text-brand-navy line-clamp-2">
          <button type="button" onClick={goDetails} className="w-full text-left transition hover:text-brand-accent">
            {course.title}
          </button>
        </h2>
        <p className="mt-2 line-clamp-2 text-sm text-slate-gray">{course.description}</p>
        <div className="mt-1.5 flex items-center gap-1.5 text-sm">
          {course.reviewCount && course.reviewCount > 0 ? (
            <>
              <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400" aria-hidden />
              <span className="font-semibold text-gray-900">{Number(course.reviewAverage ?? 0).toFixed(1)}</span>
              <span className="text-gray-500">({course.reviewCount})</span>
            </>
          ) : (
            <span className="text-xs text-gray-400">No ratings yet</span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5 shrink-0" /> {course.universities}
          </span>
          <span className="text-gray-300">·</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 shrink-0" /> {course.duration}
          </span>
          <span className="text-gray-300">·</span>
          <span className="flex items-center gap-1">
            <ModeIcon mode={course.mode} /> {course.mode}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-baseline gap-2">
          {course.price > 0 ? (
            <>
              <span className="text-lg font-bold text-brand-navy">{formatInr(course.price)}</span>
              {listPrice ? <span className="text-sm text-gray-400 line-through">{formatInr(listPrice)}</span> : null}
              {gstLine ? (
                <span className="w-full text-xs text-gray-500">
                  Incl. GST (taxable {formatInr(gstLine.base)} + GST {formatInr(gstLine.gst)})
                </span>
              ) : null}
            </>
          ) : (
            <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-sm font-bold text-emerald-800">Free</span>
          )}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={goDetails}
            className="flex min-h-[44px] w-full items-center justify-center rounded-lg border-2 border-brand-accent px-4 py-2.5 text-sm font-semibold text-brand-accent transition hover:bg-brand-light-bg"
          >
            View Details
          </button>
          {isEnrolled ? (
            <Link
              to={courseContentPath(course.id)}
              className={`flex min-h-[44px] w-full items-center justify-center rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition ${
                isCompleted
                  ? 'border-2 border-violet-500 bg-violet-50 text-violet-900 hover:bg-violet-100'
                  : 'bg-brand-accent text-white hover:bg-primary-600'
              }`}
            >
              {isCompleted ? 'View course' : 'Continue'}
            </Link>
          ) : (
            <button
              type="button"
              onClick={goEnroll}
              disabled={payBusy}
              className="flex min-h-[44px] w-full items-center justify-center rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
            >
              {payBusy ? 'Please wait…' : 'Enroll Now'}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
