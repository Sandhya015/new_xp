import { useParams } from 'react-router-dom'
import { DocumentManageShell } from '@/components/admin/DocumentManageShell'
import { documentsService } from '@/services/documentsService'

export function IdCardManage() {
  const { variant = 'technical' } = useParams()
  return (
    <DocumentManageShell
      title="Student ID Card"
      docType="id_card"
      variant={variant || 'technical'}
      generateFn={documentsService.generateIdCard}
    />
  )
}
