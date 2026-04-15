import { useEffect, useState } from 'react'
import { X, BookOpen, Image as ImageIcon, Video, Link2, Disc3, Paperclip } from 'lucide-react'
import { RichTextEditor } from '@/components/admin/RichTextEditor'
import { sanitizeRichHtml } from '@/utils/sanitizeHtml'

export type LessonVideoAttachMode = 'none' | 'file' | 'url' | 'recording'

export type LessonTopicDraft = {
  title: string
  lessonContent: string
  lessonVideoAttachMode: LessonVideoAttachMode
  lessonVideoUrl: string
  lessonVideoRecordingRef: string | null
  videoHours: string
  videoMinutes: string
  videoSeconds: string
  lessonPreviewEnabled: boolean
  lessonFeaturedImageFile: File | null
  lessonVideoFile: File | null
  lessonExerciseFile: File | null
}

type RecordingOption = { value: string; label: string }

type LessonBuilderModalProps = {
  open: boolean
  moduleTitle: string
  topicLabel: string
  initialTitle: string
  initialLessonContent: string
  initialVideoMode: LessonVideoAttachMode
  initialLessonVideoUrl: string
  initialLessonVideoRecordingRef: string | null
  initialVideoHours: string
  initialVideoMinutes: string
  initialVideoSeconds: string
  initialLessonPreviewEnabled: boolean
  initialLessonFeaturedImageFile: File | null
  initialLessonVideoFile: File | null
  initialLessonExerciseFile: File | null
  recordingOptions: RecordingOption[]
  onClose: () => void
  onSave: (draft: LessonTopicDraft) => void
}

export function LessonBuilderModal({
  open,
  moduleTitle,
  topicLabel,
  initialTitle,
  initialLessonContent,
  initialVideoMode,
  initialLessonVideoUrl,
  initialLessonVideoRecordingRef,
  initialVideoHours,
  initialVideoMinutes,
  initialVideoSeconds,
  initialLessonPreviewEnabled,
  initialLessonFeaturedImageFile,
  initialLessonVideoFile,
  initialLessonExerciseFile,
  recordingOptions,
  onClose,
  onSave,
}: LessonBuilderModalProps) {
  const [title, setTitle] = useState(initialTitle)
  const [content, setContent] = useState(initialLessonContent)
  const [videoMode, setVideoMode] = useState<LessonVideoAttachMode>(initialVideoMode)
  const [videoUrl, setVideoUrl] = useState(initialLessonVideoUrl)
  const [recordingRef, setRecordingRef] = useState<string | null>(initialLessonVideoRecordingRef)
  const [vh, setVh] = useState(initialVideoHours)
  const [vm, setVm] = useState(initialVideoMinutes)
  const [vs, setVs] = useState(initialVideoSeconds)
  const [previewEnabled, setPreviewEnabled] = useState(initialLessonPreviewEnabled)
  const [featuredFile, setFeaturedFile] = useState<File | null>(initialLessonFeaturedImageFile)
  const [videoFile, setVideoFile] = useState<File | null>(initialLessonVideoFile)
  const [exerciseFile, setExerciseFile] = useState<File | null>(initialLessonExerciseFile)

  useEffect(() => {
    if (!open) return
    setTitle(initialTitle)
    setContent(initialLessonContent)
    setVideoMode(initialVideoMode)
    setVideoUrl(initialLessonVideoUrl)
    setRecordingRef(initialLessonVideoRecordingRef)
    setVh(initialVideoHours)
    setVm(initialVideoMinutes)
    setVs(initialVideoSeconds)
    setPreviewEnabled(initialLessonPreviewEnabled)
    setFeaturedFile(initialLessonFeaturedImageFile)
    setVideoFile(initialLessonVideoFile)
    setExerciseFile(initialLessonExerciseFile)
  }, [
    open,
    initialTitle,
    initialLessonContent,
    initialVideoMode,
    initialLessonVideoUrl,
    initialLessonVideoRecordingRef,
    initialVideoHours,
    initialVideoMinutes,
    initialVideoSeconds,
    initialLessonPreviewEnabled,
    initialLessonFeaturedImageFile,
    initialLessonVideoFile,
    initialLessonExerciseFile,
  ])

  const handleSave = () => {
    onSave({
      title: title.trim(),
      lessonContent: sanitizeRichHtml(content),
      lessonVideoAttachMode: videoMode,
      lessonVideoUrl: videoUrl.trim(),
      lessonVideoRecordingRef: recordingRef,
      videoHours: vh,
      videoMinutes: vm,
      videoSeconds: vs,
      lessonPreviewEnabled: previewEnabled,
      lessonFeaturedImageFile: featuredFile,
      lessonVideoFile: videoFile,
      lessonExerciseFile: exerciseFile,
    })
  }

  if (!open) return null

  const topicLine = topicLabel.trim() || 'Untitled topic'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        aria-label="Close lesson builder"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lesson-builder-title"
        className="relative flex max-h-[min(94vh,920px)] w-full max-w-[min(96vw,1200px)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <BookOpen className="h-5 w-5 shrink-0 text-brand-accent" aria-hidden />
            <div className="min-w-0">
              <h2 id="lesson-builder-title" className="text-base font-semibold text-brand-navy sm:text-lg">
                Lesson
              </h2>
              <p className="truncate text-xs text-gray-500 sm:text-sm">
                Topic: <span className="font-medium text-gray-700">{topicLine}</span>
                <span className="text-gray-400"> · </span>
                <span className="text-gray-500">{moduleTitle || 'Module'}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          {/* Main: name + content (Tutor-style left column) */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col border-gray-200 bg-white lg:border-r">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
              <div>
                <label className="text-sm font-medium text-gray-800">Name</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium text-brand-navy placeholder:text-gray-400 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                  placeholder="Enter Lesson Name"
                  autoFocus
                />
              </div>
              <RichTextEditor
                label="Content"
                hint="Visual editor — headings, lists, links."
                value={content}
                onChange={setContent}
                placeholder="Write your lesson…"
                minHeightClass="min-h-[min(42vh,360px)]"
              />
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-gray-100 bg-gray-50/80 px-4 py-3 sm:px-6">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600"
              >
                Ok
              </button>
            </div>
          </div>

          {/* Sidebar: media & settings (Tutor-style right column) */}
          <aside className="w-full shrink-0 overflow-y-auto border-t border-gray-200 bg-gray-50/90 p-4 sm:p-5 lg:w-[320px] lg:border-l lg:border-t-0">
            <div className="space-y-5">
              <section>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <ImageIcon className="h-4 w-4" aria-hidden />
                  Featured image
                </h3>
                <div className="rounded-lg border-2 border-dashed border-gray-200 bg-white px-3 py-4 text-center">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    id="lesson-featured-input"
                    onChange={(e) => setFeaturedFile(e.target.files?.[0] ?? null)}
                  />
                  <label
                    htmlFor="lesson-featured-input"
                    className="inline-flex cursor-pointer rounded-lg bg-brand-accent px-3 py-2 text-xs font-semibold text-white hover:bg-primary-600"
                  >
                    Upload image
                  </label>
                  <p className="mt-2 text-[11px] leading-snug text-gray-500">JPEG, PNG, GIF, WebP · keep uploads reasonably small for learners.</p>
                  {featuredFile ? (
                    <p className="mt-2 truncate text-xs font-medium text-gray-700" title={featuredFile.name}>
                      {featuredFile.name}
                    </p>
                  ) : null}
                </div>
              </section>

              <section>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <Video className="h-4 w-4" aria-hidden />
                  Video
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setVideoMode('file')
                      setVideoUrl('')
                      setRecordingRef(null)
                    }}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                      videoMode === 'file'
                        ? 'border-brand-accent bg-blue-50 text-brand-navy'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Upload video
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVideoMode('url')
                      setVideoFile(null)
                      setRecordingRef(null)
                    }}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                      videoMode === 'url'
                        ? 'border-brand-accent bg-blue-50 text-brand-navy'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Add from URL
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVideoMode('recording')
                      setVideoFile(null)
                      setVideoUrl('')
                    }}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                      videoMode === 'recording'
                        ? 'border-brand-accent bg-blue-50 text-brand-navy'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Disc3 className="h-3.5 w-3.5" />
                    From recordings
                  </button>
                </div>

                {videoMode === 'file' ? (
                  <div className="mt-3">
                    <input
                      type="file"
                      accept="video/mp4,video/webm,.mp4,.webm"
                      className="text-xs text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-gray-800 file:px-2 file:py-1.5 file:text-xs file:font-medium file:text-white"
                      onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
                    />
                    <p className="mt-1 text-[11px] text-gray-500">MP4, WebM recommended.</p>
                    {videoFile ? <p className="mt-1 truncate text-xs text-gray-700">{videoFile.name}</p> : null}
                  </div>
                ) : null}

                {videoMode === 'url' ? (
                  <div className="mt-3">
                    <label className="text-xs text-gray-600">Video URL</label>
                    <input
                      type="url"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="https://…"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                    />
                  </div>
                ) : null}

                {videoMode === 'recording' ? (
                  <div className="mt-3">
                    <label className="text-xs text-gray-600">Link to a recording</label>
                    <select
                      value={recordingRef ?? ''}
                      onChange={(e) => setRecordingRef(e.target.value || null)}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                    >
                      <option value="">Select recording…</option>
                      {recordingOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    {recordingOptions.length === 0 ? (
                      <p className="mt-2 text-[11px] text-amber-800">
                        Add a module recording or a &quot;Recording&quot; topic with a file first, then pick it here.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-4">
                  <p className="mb-1 text-xs font-medium text-gray-600">Video playback time</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={vh}
                      onChange={(e) => setVh(e.target.value)}
                      className="w-14 rounded border border-gray-300 px-2 py-1 text-sm"
                      aria-label="Hours"
                    />
                    <span className="text-xs text-gray-500">hr</span>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={vm}
                      onChange={(e) => setVm(e.target.value)}
                      className="w-14 rounded border border-gray-300 px-2 py-1 text-sm"
                      aria-label="Minutes"
                    />
                    <span className="text-xs text-gray-500">min</span>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={vs}
                      onChange={(e) => setVs(e.target.value)}
                      className="w-14 rounded border border-gray-300 px-2 py-1 text-sm"
                      aria-label="Seconds"
                    />
                    <span className="text-xs text-gray-500">sec</span>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <Paperclip className="h-4 w-4" aria-hidden />
                  Exercise files
                </h3>
                <input
                  type="file"
                  className="text-xs text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-gray-700 file:px-2 file:py-1.5 file:text-xs file:font-medium file:text-white"
                  onChange={(e) => setExerciseFile(e.target.files?.[0] ?? null)}
                />
                {exerciseFile ? <p className="mt-1 truncate text-xs text-gray-700">{exerciseFile.name}</p> : null}
              </section>

              <section className="rounded-lg border border-amber-200/80 bg-amber-50/40 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-sm font-medium text-gray-900">Lesson preview</span>
                    <span className="ml-2 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">Pro</span>
                    <p className="mt-1 text-[11px] text-gray-600">Let learners preview this lesson before enrolling when your plan supports it.</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={previewEnabled}
                    onClick={() => setPreviewEnabled((p) => !p)}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                      previewEnabled ? 'bg-brand-accent' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                        previewEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </section>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
