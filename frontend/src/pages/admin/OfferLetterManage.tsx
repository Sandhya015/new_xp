import { useParams } from 'react-router-dom'
import { DocInput, DocumentManageShell } from '@/components/admin/DocumentManageShell'
import { documentsService } from '@/services/documentsService'

export function OfferLetterManage() {
  const { variant = 'technical' } = useParams()
  const v = variant === 'non-technical' ? 'non-technical' : 'technical'
  return (
    <DocumentManageShell
      title={`Offer Letter (${v === 'technical' ? 'Technical' : 'Non-Technical'})`}
      docType={v === 'technical' ? 'offer_letter_technical' : 'offer_letter_non_technical'}
      variant={v}
      generateFn={documentsService.generateOfferLetter}
      defaultInputs={{ mode: 'Offline', internshipStartDate: '', durationWeeks: 4, stipend: 'Unpaid' }}
      renderInputs={(inputs, setField) => (
        <>
          <DocInput label="Internship mode" name="mode" value={String(inputs.mode || 'Offline')} onChange={setField} />
          <DocInput
            label="Start date"
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
          <DocInput label="Stipend" name="stipend" value={String(inputs.stipend || 'Unpaid')} onChange={setField} />
        </>
      )}
    />
  )
}
