/** Full learner experience (curriculum, quizzes, certificate) — requires enrollment. */
export function courseContentPath(courseId: string) {
  return `/dashboard/my-courses/${courseId}`
}

/** Public marketing / outline page. */
export function courseMarketingPath(courseId: string) {
  return `/training/${courseId}`
}
