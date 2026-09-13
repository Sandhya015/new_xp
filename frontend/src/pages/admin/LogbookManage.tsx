import { useParams } from 'react-router-dom'
import { DocInput, DocumentManageShell } from '@/components/admin/DocumentManageShell'
import { documentsService } from '@/services/documentsService'

export function LogbookManage() {
  const { variant = 'technical' } = useParams()
  return (
    <DocumentManageShell
      title="Daily Training Logbook"
      docType="logbook"
      variant={variant || 'technical'}
      generateFn={documentsService.generateLogbook}
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
