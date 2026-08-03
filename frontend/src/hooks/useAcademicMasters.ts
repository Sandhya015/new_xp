/**
 * Academic masters shared with student registration (Rev 2).
 * Same frontend constants as the student registration form.
 */
import { useMemo } from 'react'
import { REGISTRATION_UNIVERSITIES_LIST } from '@/constants/registrationUniversities'
import {
  REGISTRATION_COLLEGES_BY_UNIVERSITY,
  collegeOptionsFromList,
  isOtherCollege,
} from '@/constants/registrationColleges'
import {
  OTHER_OPTION_VALUE,
  STUDENT_COURSES,
  BRANCHES_66,
  BRANCH_OTHERS_LABEL,
  subjectOptionsForCourse,
} from '@/constants/registrationLists'
import { INDIAN_STATES_UTS } from '@/constants/indianRegions'
import { adminService } from '@/services/adminService'

export { OTHER_OPTION_VALUE, BRANCH_OTHERS_LABEL }

export type UniOption = { value: string; label: string; shortCode: string }

export function universityOptions(): UniOption[] {
  return REGISTRATION_UNIVERSITIES_LIST.filter((u) => u.name !== OTHER_OPTION_VALUE).map((u) => ({
    value: u.name,
    shortCode: u.shortForm,
    label: `${u.shortForm} — ${u.name}`,
  }))
}

export function courseOptions(): string[] {
  return [...STUDENT_COURSES]
}

export function isBranchCourse(course: string): boolean {
  return ['B.Tech', 'Diploma', 'M.Tech', 'BCA', 'MCA'].includes(course)
}

export function maxSemesterForCourse(course: string): number {
  if (course === 'Diploma') return 6
  if (course === 'B.Tech' || course === 'M.Tech') return 8
  if (['B.Sc', 'B.Com', 'B.A.', 'BBA', 'BCA', 'MBA', 'MCA', 'M.Sc'].includes(course)) return 6
  return 8
}

export function semesterLabelsForCourse(course: string): string[] {
  const n = maxSemesterForCourse(course || '')
  return Array.from({ length: n }, (_, i) => {
    const k = i + 1
    if (k === 1) return '1st'
    if (k === 2) return '2nd'
    if (k === 3) return '3rd'
    return `${k}th`
  })
}

export function branchSubjectOptions(course: string): { value: string; label: string }[] {
  if (isBranchCourse(course)) {
    return BRANCHES_66.map((b) => ({ value: b, label: b }))
  }
  return subjectOptionsForCourse(course)
}

export function collegeOptionsForUniversities(universities: string[]): string[] {
  const set = new Set<string>()
  const unis = universities.length ? universities : Object.keys(REGISTRATION_COLLEGES_BY_UNIVERSITY)
  for (const u of unis) {
    const list = REGISTRATION_COLLEGES_BY_UNIVERSITY[u]
    if (Array.isArray(list)) {
      for (const c of collegeOptionsFromList(list)) {
        const value = typeof c === 'string' ? c : c?.value
        if (value && !isOtherCollege(value)) set.add(value)
      }
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

export function useAcademicMasters() {
  const universities = useMemo(() => universityOptions(), [])
  const courses = useMemo(() => courseOptions(), [])
  const states = useMemo(() => [...INDIAN_STATES_UTS], [])
  return { universities, courses, states }
}

/** Training list for payment filters */
export async function fetchAdminCoursesForFilter(): Promise<Array<{ id: string; title: string }>> {
  try {
    // Prefer active trainings; if empty, fall back to full list so filters still work
    let data = await adminService.getCourses({ status: 'active' })
    let items = (data.items || []) as Array<{ id: string; title: string }>
    if (!items.length) {
      data = await adminService.getCourses()
      items = (data.items || []) as Array<{ id: string; title: string }>
    }
    return items.map((c) => ({
      id: c.id,
      title: c.title || c.id,
    }))
  } catch {
    return []
  }
}
