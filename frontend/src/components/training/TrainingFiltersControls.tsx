import { REGISTRATION_UNIVERSITIES_LIST } from '@/constants/registrationUniversities'
import { OTHER_OPTION_VALUE, BRANCHES_66, subjectOptionsForCourse, STUDENT_COURSES } from '@/constants/registrationLists'
import { useMemo } from 'react'
import {
  CATALOG_FILTER_ALL as ALL,
  CATALOG_MODES as MODES,
  DURATION_HOURS,
  DURATION_WEEKS,
  type CatalogCategoryFilter,
  type CatalogModeFilter,
} from './trainingCatalogFilters'

export type TrainingFiltersControlsProps = {
  category: CatalogCategoryFilter
  setCategory: (v: CatalogCategoryFilter) => void
  university: string
  setUniversity: (v: string) => void
  courseLevel: string
  setCourseLevel: (v: string) => void
  branchVal: string
  setBranchVal: (v: string) => void
  branchOther: string
  setBranchOther: (v: string) => void
  durType: '' | 'hours' | 'weeks'
  setDurType: (v: '' | 'hours' | 'weeks') => void
  durVal: string
  setDurVal: (v: string) => void
  mode: CatalogModeFilter
  setMode: (v: CatalogModeFilter) => void
}

export function TrainingFiltersControls({
  category,
  setCategory,
  university,
  setUniversity,
  courseLevel,
  setCourseLevel,
  branchVal,
  setBranchVal,
  branchOther,
  setBranchOther,
  durType,
  setDurType,
  durVal,
  setDurVal,
  mode,
  setMode,
}: TrainingFiltersControlsProps) {
  const branchOptions = useMemo(() => {
    if (courseLevel === 'B.Tech' || courseLevel === 'Diploma')
      return [{ value: ALL, label: 'All branches' }, ...BRANCHES_66.map((b) => ({ value: b, label: b }))]
    if (['B.Sc', 'B.Com', 'B.A.', 'BBA', 'BCA'].includes(courseLevel)) {
      const o = subjectOptionsForCourse(courseLevel)
      return [{ value: ALL, label: 'All subjects' }, ...o.map((x) => ({ value: x.value, label: x.label }))]
    }
    return []
  }, [courseLevel])

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <div className="min-w-0">
        <label className="mb-1 block text-xs font-semibold text-gray-600">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as CatalogCategoryFilter)}
          className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm"
        >
          <option value={ALL}>All</option>
          <option value="technical">Technical</option>
          <option value="non-technical">Non-Technical</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className="min-w-0">
        <label className="mb-1 block text-xs font-semibold text-gray-600">University</label>
        <select
          value={university}
          onChange={(e) => setUniversity(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm"
        >
          <option value={ALL}>All Universities</option>
          {REGISTRATION_UNIVERSITIES_LIST.map((u) => (
            <option key={u.name} value={u.name}>
              {u.shortForm} — {u.name}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-0">
        <label className="mb-1 block text-xs font-semibold text-gray-600">Course</label>
        <select
          value={courseLevel}
          onChange={(e) => {
            setCourseLevel(e.target.value)
            setBranchVal(ALL)
            setBranchOther('')
          }}
          className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm"
        >
          <option value={ALL}>All Courses</option>
          {STUDENT_COURSES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          <option value={OTHER_OPTION_VALUE}>Other</option>
        </select>
      </div>
      <div className="min-w-0">
        <label className="mb-1 block text-xs font-semibold text-gray-600">
          {!courseLevel ? 'Branch / Subject' : courseLevel === 'B.Tech' || courseLevel === 'Diploma' ? 'Branch' : 'Subject'}
        </label>
        {courseLevel && branchOptions.length > 0 ? (
          <>
            <select
              value={branchVal}
              onChange={(e) => setBranchVal(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm"
            >
              {branchOptions.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {branchVal === OTHER_OPTION_VALUE ? (
              <input
                value={branchOther}
                onChange={(e) => setBranchOther(e.target.value)}
                placeholder="Specify"
                className="mt-2 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
              />
            ) : null}
          </>
        ) : (
          <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-2 py-2 text-xs text-gray-500">Select course first</p>
        )}
      </div>
      <div className="min-w-0 sm:col-span-2 lg:col-span-1 xl:col-span-1">
        <label className="mb-1 block text-xs font-semibold text-gray-600">Duration</label>
        <div className="flex gap-2">
          <select
            value={durType}
            onChange={(e) => {
              setDurType(e.target.value as '' | 'hours' | 'weeks')
              setDurVal(ALL)
            }}
            className="w-1/2 rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm"
          >
            <option value="">Type</option>
            <option value="hours">Hours</option>
            <option value="weeks">Weeks</option>
          </select>
          <select
            value={durVal}
            onChange={(e) => setDurVal(e.target.value)}
            disabled={!durType}
            className="w-1/2 rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm disabled:opacity-50"
          >
            <option value={ALL}>All</option>
            {durType === 'hours'
              ? DURATION_HOURS.map((n) => (
                  <option key={n} value={String(n)}>
                    {n} hrs
                  </option>
                ))
              : durType === 'weeks'
                ? DURATION_WEEKS.map((n) => (
                    <option key={n} value={String(n)}>
                      {n} wks
                    </option>
                  ))
                : null}
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div className="min-w-0">
        <label className="mb-1 block text-xs font-semibold text-gray-600">Mode</label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as CatalogModeFilter)}
          className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm"
        >
          <option value={ALL}>All Modes</option>
          {MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
