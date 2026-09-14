import { forwardRef } from 'react'
import { SignatoryBlock } from '@/components/certificate/SignatoryBlock'
import {
  CERTIFICATE_ASSESSMENT_CRITERIA,
  CERTIFICATE_FOOTER_BAND_SRC,
  CERTIFICATE_HEADER_BAND_SRC,
  CERTIFICATE_VERIFY_URL,
  certificateVerifyUrl,
  courseMajorLabel,
  randomizedCertificateAssessmentRows,
  type CertificateDisplayData,
} from '@/lib/certificateFormat'

type Props = {
  data: CertificateDisplayData
  className?: string
  showSignature?: boolean
}

const PAGE = {
  width: '210mm',
  minHeight: '297mm',
  paddingX: '3mm',
} as const

const pageStyle: React.CSSProperties = {
  width: PAGE.width,
  maxWidth: PAGE.width,
  minWidth: PAGE.width,
  minHeight: PAGE.minHeight,
  boxSizing: 'border-box',
  overflow: 'hidden',
}

const BORDER = 'border-[#5AA3E6]'

const DETAIL_CELL: React.CSSProperties = {
  padding: '10px 14px',
  lineHeight: 1.4,
  minHeight: '38px',
  boxSizing: 'border-box',
  fontSize: '13px',
}

const ASSESS_CELL: React.CSSProperties = {
  padding: '8px 10px',
  lineHeight: 1.4,
  minHeight: '34px',
  boxSizing: 'border-box',
  fontSize: '12.5px',
}

const ASSESS_HEAD_CELL: React.CSSProperties = {
  padding: '8px 10px',
  lineHeight: 1.35,
  minHeight: '30px',
  boxSizing: 'border-box',
  fontSize: '13px',
}

function CertificateHeaderBand() {
  return (
    <header className="relative z-20 shrink-0 w-full leading-none">
      <img
        src={CERTIFICATE_HEADER_BAND_SRC}
        alt="XpertIntern"
        className="block w-full h-auto"
        style={{ width: PAGE.width, display: 'block' }}
        crossOrigin="anonymous"
        decoding="sync"
      />
    </header>
  )
}

function CertificationBody({ data }: { data: CertificateDisplayData }) {
  const institution = data.collegeName || data.universityName || '—'
  const regNo = data.registrationNo || data.universityRollNo || '—'
  const majorLabel = courseMajorLabel(data.degree, data.subject)

  return (
    <section className="relative z-20 text-center shrink-0 py-1">
      <h1 className="font-serif font-bold text-[#1565C0] text-[26px] tracking-wide mb-1 leading-tight">
        Certificate of Completion
      </h1>
      <div className="text-[11.5px] leading-[1.45] space-y-0.5 max-w-[98%] mx-auto">
        <p>This is to certify that</p>
        <p className="font-bold text-[13px]">Mr./Ms. {data.studentName || 'Student'},</p>
        <p>
          bearing University Registration/Enrolment No.{' '}
          <span className="font-bold">{regNo}</span>
        </p>
        <p>of</p>
        <p className="font-bold text-[13px]">{institution},</p>
        {data.academicSession || majorLabel ? (
          <p>
            {data.academicSession ? (
              <>
                Session <span className="font-bold">{data.academicSession}</span>
              </>
            ) : null}
            {data.academicSession && majorLabel ? ', ' : null}
            {majorLabel ? (
              <>
                enrolled in <span className="font-bold">{majorLabel}</span>
              </>
            ) : null}
            ,
          </p>
        ) : null}
        <p>has successfully completed his/her internship training with our organisation.</p>
      </div>
    </section>
  )
}

function InternshipDetailsTable({ data }: { data: CertificateDisplayData }) {
  const rows: [string, string][] = [
    ['Internship Program', data.internshipDomain || '—'],
    ['Internship Duration', data.internshipDuration || '—'],
    ['Internship Period', data.internshipPeriod || '—'],
    ['Mode of Internship', data.internshipMode || 'Online'],
    ['Attendance', data.attendancePercent || '—'],
    ['Overall Marks Percentage', data.marksPercent || '—'],
  ]

  return (
    <div className={`relative w-full border ${BORDER} shrink-0 bg-white z-20`}>
      {rows.map(([label, value], i) => (
        <div key={label} className={`flex ${i < rows.length - 1 ? `border-b ${BORDER}` : ''}`}>
          <div
            className={`w-[44%] font-bold border-r ${BORDER} flex items-center justify-center text-center`}
            style={DETAIL_CELL}
          >
            {label}
          </div>
          <div
            className="w-[56%] flex items-center justify-center text-center font-medium px-2 break-words"
            style={DETAIL_CELL}
          >
            {value}
          </div>
        </div>
      ))}
    </div>
  )
}

function PerformanceAssessmentTable({ data }: { data: CertificateDisplayData }) {
  const seed =
    data.certificateId ||
    data.registrationNo ||
    data.universityRollNo ||
    data.studentName ||
    'certificate'
  const rows =
    data.assessmentRows?.length === CERTIFICATE_ASSESSMENT_CRITERIA.length
      ? data.assessmentRows
      : randomizedCertificateAssessmentRows(String(seed))

  return (
    <div className="shrink-0 w-full z-20">
      <h2 className="text-[13.5px] font-bold text-[#5AA3E6] leading-normal block mb-1.5">
        Internship Performance Assessment
      </h2>
      <div className={`border ${BORDER} w-full bg-white`}>
        <div className="flex bg-[#5AA3E6] text-white font-bold">
          <div className="w-[68%] border-r border-white/30 text-center" style={ASSESS_HEAD_CELL}>
            Assessment Criteria
          </div>
          <div className="w-[32%] text-center" style={ASSESS_HEAD_CELL}>
            Rating
          </div>
        </div>
        {rows.map((row, i) => (
          <div
            key={row.criteria}
            className={`flex bg-white ${i < rows.length - 1 ? `border-b ${BORDER}` : ''}`}
          >
            <div
              className={`w-[68%] border-r ${BORDER} flex items-center justify-center text-center px-2`}
              style={ASSESS_CELL}
            >
              {row.criteria}
            </div>
            <div
              className="w-[32%] flex items-center justify-center text-center font-bold"
              style={ASSESS_CELL}
            >
              {row.rating}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CertificateFooter({
  certificateId,
  issueDate,
  verifyUrl,
  showSignature = true,
}: {
  certificateId?: string | null
  issueDate?: string | null
  verifyUrl?: string | null
  showSignature?: boolean
}) {
  const verifyLink = verifyUrl || (certificateId ? certificateVerifyUrl(certificateId) : CERTIFICATE_VERIFY_URL)

  return (
    <footer className="relative z-30 shrink-0 w-full mt-auto bg-white">
      {/* Row 1 — QR + cert details (left) | signatory image (right) */}
      <div
        className="flex justify-between items-start gap-4"
        style={{
          paddingLeft: PAGE.paddingX,
          paddingRight: PAGE.paddingX,
          paddingTop: '2mm',
          paddingBottom: '2mm',
        }}
      >
        <div className="flex items-start gap-2.5 min-w-0 flex-1 max-w-[57%]">
          <div
            className="relative shrink-0 border border-slate-300 bg-white p-0.5"
            style={{ width: '19mm', height: '19mm' }}
          >
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&ecc=Q&data=${encodeURIComponent(verifyLink)}`}
              alt="QR Code"
              className="w-full h-full block"
              crossOrigin="anonymous"
            />
          </div>
          <div className="text-[11px] leading-snug space-y-1 min-w-0 pt-0.5">
            <p className="break-words">
              <span className="font-bold text-slate-800">Certificate Number: </span>
              <span className="font-bold text-[#5AA3E6]">{certificateId || '—'}</span>
            </p>
            <p>
              <span className="font-bold text-slate-800">Date of Certification: </span>
              <span className="font-bold text-[#5AA3E6]">{issueDate || '—'}</span>
            </p>
            <p className="text-[10px] font-bold text-[#5AA3E6] leading-snug break-words">
              Online Certificate Verification Available on: {CERTIFICATE_VERIFY_URL}
            </p>
          </div>
        </div>

        <SignatoryBlock showSignature={showSignature} className="shrink-0" />
      </div>

      {/* Row 2 — accreditation logos + blue wave (natural proportions, full width) */}
      <div className="relative w-full leading-none">
        <img
          src={CERTIFICATE_FOOTER_BAND_SRC}
          alt=""
          className="block w-full h-auto"
          style={{ width: PAGE.width, display: 'block' }}
          crossOrigin="anonymous"
          decoding="sync"
        />
      </div>
    </footer>
  )
}

function CertificatePage({
  data,
  showSignature = true,
}: {
  data: CertificateDisplayData
  showSignature?: boolean
}) {
  return (
    <div
      data-certificate-page
      className="bg-white text-slate-900 font-sans leading-snug relative flex flex-col"
      style={pageStyle}
    >
      <CertificateHeaderBand />

      <div
        className="relative z-20 flex flex-col flex-1 min-h-0"
        style={{ padding: `1.5mm ${PAGE.paddingX} 0` }}
      >
        <CertificationBody data={data} />

        <div className="relative flex-1 flex flex-col justify-center w-full mt-2 space-y-3 min-h-0 py-1">
          <InternshipDetailsTable data={data} />
          <PerformanceAssessmentTable data={data} />
        </div>

        <CertificateFooter
          certificateId={data.certificateId}
          issueDate={data.issueDate}
          verifyUrl={data.verifyUrl}
          showSignature={showSignature}
        />
      </div>
    </div>
  )
}

export const CertificateDocument = forwardRef<HTMLDivElement, Props>(function CertificateDocument(
  { data, className = '', showSignature = true },
  ref
) {
  return (
    <div ref={ref} className={className} style={{ width: PAGE.width }}>
      <CertificatePage data={data} showSignature={showSignature} />
    </div>
  )
})

CertificateDocument.displayName = 'CertificateDocument'
