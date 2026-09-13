import { useParams } from 'react-router-dom'
import { DocInput, DocumentManageShell } from '@/components/admin/DocumentManageShell'
import { documentsService } from '@/services/documentsService'

export function CertificateBatchManage() {
  const { variant = 'technical' } = useParams()
  return (
    <DocumentManageShell
      title="Batch Certificate Generate"
      docType="certificate_generated"
      variant={variant || 'technical'}
      generateFn={documentsService.generateCertificates}
      defaultInputs={{
        mode: 'Offline',
        internshipStartDate: '',
        durationWeeks: 4,
        marksMin: 80,
        marksMax: 90,
        certificationDate: new Date().toISOString().slice(0, 10),
      }}
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
          <DocInput
            label="Marks min %"
            name="marksMin"
            type="number"
            value={Number(inputs.marksMin || 80)}
            onChange={setField}
          />
          <DocInput
            label="Marks max %"
            name="marksMax"
            type="number"
            value={Number(inputs.marksMax || 90)}
            onChange={setField}
          />
          <DocInput
            label="Certification date"
            name="certificationDate"
            type="date"
            value={String(inputs.certificationDate || '')}
            onChange={setField}
          />
        </>
      )}
    />
  )
}
