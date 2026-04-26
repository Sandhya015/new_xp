import { REGISTRATION_UNIVERSITIES_LIST } from '@/constants/registrationUniversities'
import { OTHER_OPTION_VALUE } from '@/constants/registrationLists'

export const CATALOG_FILTER_ALL = ''

export const DURATION_HOURS = [20, 40, 60, 80, 100, 120] as const
export const DURATION_WEEKS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24] as const
export const CATALOG_MODES = ['Online', 'Offline', 'Hybrid', 'Other'] as const

export type CatalogCategoryFilter = typeof CATALOG_FILTER_ALL | 'technical' | 'non-technical' | 'other'
export type CatalogModeFilter = typeof CATALOG_FILTER_ALL | (typeof CATALOG_MODES)[number]

/** Fields required to apply catalog filters (public + student listings). */
export type CatalogFilterableCourse = {
  title: string
  description: string
  category: 'technical' | 'non-technical' | 'other'
  duration: string
  mode: string
  universities: string
  tag: string
  trainingTags: string[]
  courses: string[]
  streams: string[]
  subjects: string[]
}

export type CatalogFilterState = {
  search: string
  category: CatalogCategoryFilter
  university: string
  courseLevel: string
  branchVal: string
  branchOther: string
  durType: '' | 'hours' | 'weeks'
  durVal: string
  mode: CatalogModeFilter
}

export function parseDurationWeeksHours(duration: string): { weeks: number | null; hours: number | null } {
  const w = duration.match(/^(\d+)\s*Weeks?$/i)
  const h = duration.match(/^(\d+)\s*Hours?$/i)
  return {
    weeks: w ? parseInt(w[1], 10) : null,
    hours: h ? parseInt(h[1], 10) : null,
  }
}

export function catalogHaystack(c: CatalogFilterableCourse): string {
  return `${c.title} ${c.description} ${c.tag} ${c.universities} ${c.trainingTags.join(' ')} ${c.courses.join(' ')} ${c.streams.join(' ')} ${c.subjects.join(
    ' ',
  )}`.toLowerCase()
}

function matchesUniversity(c: CatalogFilterableCourse, selected: string): boolean {
  if (!selected) return true
  const h = catalogHaystack(c)
  const row = REGISTRATION_UNIVERSITIES_LIST.find((x) => x.name === selected)
  if (selected === OTHER_OPTION_VALUE) return true
  if (row) {
    if (h.includes(row.shortForm.toLowerCase())) return true
    const nm = row.name.split('(')[0].trim().toLowerCase()
    if (nm.length > 4 && h.includes(nm.slice(0, Math.min(24, nm.length)))) return true
  }
  return h.includes(selected.toLowerCase().slice(0, 18))
}

function matchesCourseLevel(c: CatalogFilterableCourse, level: string): boolean {
  if (!level) return true
  if (level === OTHER_OPTION_VALUE) return true
  const h = catalogHaystack(c)
  if (c.courses.some((x) => x.toLowerCase() === level.toLowerCase())) return true
  const map: Record<string, string[]> = {
    'B.Tech': ['b.tech', 'btech', 'bachelor of technology'],
    Diploma: ['diploma'],
    'B.Sc': ['b.sc', 'bsc'],
    'B.Com': ['b.com', 'bcom'],
    'B.A.': ['b.a', 'b.a.'],
    BBA: ['bba'],
    BCA: ['bca'],
  }
  const keys = map[level] || [level.toLowerCase()]
  return keys.some((k) => h.includes(k))
}

function matchesBranchSubject(c: CatalogFilterableCourse, courseLevel: string, branchVal: string, branchOther: string): boolean {
  if (!courseLevel || courseLevel === CATALOG_FILTER_ALL) return true
  if (!branchVal && !branchOther.trim()) return true
  const spec = branchVal === OTHER_OPTION_VALUE ? branchOther.trim().toLowerCase() : branchVal.toLowerCase()
  if (!spec) return true
  const h = catalogHaystack(c)
  if (h.includes(spec)) return true
  return c.streams.some((s) => s.toLowerCase().includes(spec)) || c.subjects.some((s) => s.toLowerCase().includes(spec))
}

function matchesDuration(c: CatalogFilterableCourse, durType: '' | 'hours' | 'weeks', durVal: string): boolean {
  if (!durType || !durVal) return true
  const { weeks, hours } = parseDurationWeeksHours(c.duration)
  if (durType === 'weeks') {
    const want = parseInt(durVal, 10)
    if (Number.isNaN(want)) return true
    return weeks === want || (weeks === null && hours === null)
  }
  const want = parseInt(durVal, 10)
  if (Number.isNaN(want)) return true
  return hours === want || (weeks === null && hours === null)
}

function matchesMode(c: CatalogFilterableCourse, mode: CatalogModeFilter): boolean {
  if (!mode) return true
  if (mode === 'Other') {
    const m = c.mode.toLowerCase()
    return !['online', 'offline', 'hybrid'].some((x) => m.includes(x))
  }
  return c.mode.toLowerCase().includes(mode.toLowerCase())
}

function matchesCategory(c: CatalogFilterableCourse, cat: CatalogCategoryFilter): boolean {
  if (cat === CATALOG_FILTER_ALL) return true
  if (cat === 'other') return c.category === 'other'
  return c.category === cat
}

export function catalogCourseMatchesFilters(c: CatalogFilterableCourse, f: CatalogFilterState): boolean {
  const q = f.search.trim().toLowerCase()
  const h = catalogHaystack(c)
  const matchSearch = !q || h.includes(q)
  return (
    matchSearch &&
    matchesCategory(c, f.category) &&
    matchesUniversity(c, f.university) &&
    matchesCourseLevel(c, f.courseLevel) &&
    matchesBranchSubject(c, f.courseLevel, f.branchVal, f.branchOther) &&
    matchesDuration(c, f.durType, f.durVal) &&
    matchesMode(c, f.mode)
  )
}
