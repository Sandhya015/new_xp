import { DocInput, DocumentManageShell } from '@/components/admin/DocumentManageShell'
import { documentsService } from '@/services/documentsService'

export function AttendanceLogGenerate() {
  return (
    <DocumentManageShell
      title="Internship Attendance Log"
      docType="attendance_log"
      generateFn={(p) =>
        documentsService.generateAttendanceLog({
          courseId: p.courseId,
          studentIds: p.studentIds,
          inputs: p.inputs,
        })
      }
      defaultInputs={{ mode: 'Offline', internshipStartDate: '', durationWeeks: 4 }}
      renderInputs={(inputs, setField) => (
        <>
          <DocInput label="Mode" name="mode" value={String(inputs.mode || 'Offline')} onChange={setField} />
          <DocInput
            label="Internship start"
            name="internshipStartDate"
            type="date"
            value={String(inputs.internshipStartDate || '')}
            onChange={setField}
          />
          <DocInput
            label="Duration (weeks)"
            name="durationWeeks"
            type="number"
            value={Number(inputs.durationWeeks || 4)}
            onChange={setField}
          />
        </>
      )}
    />
  )
}
