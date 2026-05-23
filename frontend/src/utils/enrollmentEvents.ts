/**
 * Cross-component signal when enrollments changed (e.g. after paid checkout verify)
 * so catalog/dashboard lists refetch without a full navigation.
 */
export const ENROLLMENTS_CHANGED_EVENT = 'xpert-enrollments-changed'

export function notifyEnrollmentsChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(ENROLLMENTS_CHANGED_EVENT))
}
