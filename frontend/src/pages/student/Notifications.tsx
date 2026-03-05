import { Notification } from '@/components/Notification'

export function Notifications() {
  return (
    <div className="max-w-6xl space-y-6">
      <p className="text-sm text-slate-gray">Meet links, new materials, quizzes. Data from API when connected.</p>
      <div className="space-y-4">
        <Notification title="Welcome" message="Your notifications will appear here after enrollment." type="info" />
      </div>
    </div>
  )
}
