import { forwardRef } from 'react'
import { Globe, Mail, MapPin, Phone } from 'lucide-react'
import {
  CERTIFICATE_ASSESSMENT_CRITERIA,
  CERTIFICATE_COMPANY,
  CERTIFICATE_SIGNATURE_SRC,
  CERTIFICATE_SIGNATORY,
  CERTIFICATE_SIGNATORY_TITLE,
  CERTIFICATE_VERIFY_URL,
  certificateVerifyUrl,
  courseMajorLabel,
  randomizedCertificateAssessmentRows,
  type CertificateDisplayData,
} from '@/lib/certificateFormat'
import {
  CERTIFICATE_FOOTER_LEFT_LOGOS,
  CERTIFICATE_FOOTER_RIGHT_LOGOS,
} from '@/lib/documentLogos'

type Props = {
  data: CertificateDisplayData
  className?: string
  showSignature?: boolean
}

const PAGE = {
  width: '210mm',
  height: '297mm',
  padding: '6mm 8mm 5mm',
} as const

const pageStyle: React.CSSProperties = {
  width: PAGE.width,
  maxWidth: PAGE.width,
  minWidth: PAGE.width,
  height: PAGE.height,
  minHeight: PAGE.height,
  maxHeight: PAGE.height,
  boxSizing: 'border-box',
}

const BORDER = 'border-[#5AA3E6]'

const DETAIL_CELL: React.CSSProperties = {
  padding: '9px 12px',
  lineHeight: 1.45,
  minHeight: '38px',
  boxSizing: 'border-box',
}

const ASSESS_CELL: React.CSSProperties = {
  padding: '8px 12px',
  lineHeight: 1.45,
  minHeight: '34px',
  boxSizing: 'border-box',
}

const ASSESS_HEAD_CELL: React.CSSProperties = {
  padding: '8px 12px',
  lineHeight: 1.4,
  minHeight: '30px',
  boxSizing: 'border-box',
}

function TopLeftAccent() {
  return (
    <div className="absolute top-0 left-0 z-20 pointer-events-none">
      <div
        className="h-[14px] w-[90px] bg-[#2563EB]"
        style={{ clipPath: 'polygon(0 0, 100% 0, 78% 100%, 0% 100%)' }}
      />
      <div
        className="h-[14px] w-[28px] bg-[#BFDBFE] absolute top-0 left-[72px]"
        style={{ clipPath: 'polygon(30% 0, 100% 0, 70% 100%, 0% 100%)' }}
      />
    </div>
  )
}

function BottomRightAccent() {
  return (
    <div className="absolute bottom-0 right-0 z-20 pointer-events-none">
      <div
        className="h-[14px] w-[90px] bg-[#2563EB]"
        style={{ clipPath: 'polygon(22% 0, 100% 0, 100% 100%, 0% 100%)' }}
      />
      <div
        className="h-[14px] w-[28px] bg-[#BFDBFE] absolute bottom-0 right-[72px]"
        style={{ clipPath: 'polygon(0 0, 70% 0, 100% 100%, 30% 100%)' }}
      />
    </div>
  )
}

function CertificateHeader() {
  return (
    <header className="relative z-10 shrink-0">
      <div className="flex justify-between items-start gap-3 pt-0.5">
        <div className="flex items-center shrink-0 pl-0.5">
          <img
            src="/logo.png"
            alt="XpertIntern"
            className="block shrink-0"
            style={{ height: '14mm', width: 'auto', objectFit: 'contain' }}
            crossOrigin="anonymous"
            decoding="sync"
          />
        </div>

        <div className="flex flex-col items-end gap-0.5 text-[9px] font-medium text-slate-800 leading-normal max-w-[54%] shrink pb-1">
          <div className="flex items-center gap-1 text-right">
            <span>Arfabad Colony, East Nahar Road, Bajrangpuri, Patna - 800007</span>
            <span className="bg-[#2563EB] text-white rounded-full p-[2px] shrink-0 inline-flex">
              <MapPin className="size-[8px]" strokeWidth={3} />
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span>7004762654</span>
            <span className="bg-[#2563EB] text-white rounded-full p-[2px] inline-flex">
              <Phone className="size-[8px]" strokeWidth={3} />
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span>contact@xpertintern.com</span>
            <span className="bg-[#2563EB] text-white rounded-full p-[2px] inline-flex">
              <Mail className="size-[8px]" strokeWidth={3} />
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span>www.xpertintern.com</span>
            <span className="bg-[#2563EB] text-white rounded-full p-[2px] inline-flex">
              <Globe className="size-[8px]" strokeWidth={3} />
            </span>
          </div>
        </div>
      </div>
      <div className="border-b-[2px] border-[#1E3A8A] mt-1" />
    </header>
  )
}

function CertificationBody({ data }: { data: CertificateDisplayData }) {
  const institution = data.collegeName || data.universityName || '—'
  const regNo = data.registrationNo || data.universityRollNo || '—'
  const majorLabel = courseMajorLabel(data.degree, data.subject)

  return (
    <section className="relative z-10 text-center shrink-0 py-2">
      <h1 className="font-serif font-bold text-[#1565C0] text-[32px] tracking-wide mb-2 leading-tight">
        Certificate of Completion
      </h1>
      <div className="text-[13px] leading-[1.55] space-y-0.5 max-w-[95%] mx-auto">
        <p>This is to certify that</p>
        <p className="font-bold text-[15px]">Mr./Ms. {data.studentName || 'Student'},</p>
        <p>
          bearing University Registration/Enrolment No.{' '}
          <span className="font-bold">{regNo}</span>
        </p>
        <p>of</p>
        <p className="font-bold text-[15px]">{institution},</p>
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
    <div className={`relative w-full border ${BORDER} text-[13px] overflow-hidden shrink-0 bg-white`}>
      {rows.map(([label, value], i) => (
        <div key={label} className={`flex ${i < rows.length - 1 ? `border-b ${BORDER}` : ''}`}>
          <div
            className={`w-[44%] font-bold border-r ${BORDER} flex items-center justify-center text-center text-[12.5px]`}
            style={DETAIL_CELL}
          >
            {label}
          </div>
          <div
            className="w-[56%] flex items-center justify-center text-center font-medium px-2"
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
    <div className="shrink-0 w-full">
      <h2 className="text-[14px] font-bold text-[#5AA3E6] leading-normal block mb-1.5">
        Internship Performance Assessment
      </h2>
      <div className={`border ${BORDER} text-[12.5px] w-full`}>
        <div className="flex bg-[#5AA3E6] text-white font-bold text-[13px]">
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
    <footer className="relative z-10 shrink-0 pt-3 mt-auto">
      <div className="flex justify-between items-start gap-3 mb-2">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="relative size-[20mm] shrink-0 border border-slate-300 bg-white p-0.5">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=320x320&ecc=Q&data=${encodeURIComponent(verifyLink)}`}
              alt="QR Code"
              className="w-full h-full"
              crossOrigin="anonymous"
            />
          </div>
          <div className="text-[11.5px] leading-tight space-y-1 pt-0.5">
            <p>
              <span className="font-bold text-slate-800">Certificate Number: </span>
              <span className="font-bold text-[#5AA3E6] break-all">{certificateId || '—'}</span>
            </p>
            <p>
              <span className="font-bold text-slate-800">Date of Certification: </span>
              <span className="font-bold text-[#5AA3E6]">{issueDate || '—'}</span>
            </p>
            <p className="text-[10.5px] font-bold text-[#5AA3E6] leading-snug max-w-[75mm]">
              Online Certificate Verification Available on: {CERTIFICATE_VERIFY_URL}
            </p>
          </div>
        </div>

        <div className="text-right shrink-0 w-[44%]">
          {showSignature ? (
            <div className="relative flex justify-end items-end min-h-[20mm]">
              <img
                src={CERTIFICATE_SIGNATURE_SRC}
                alt={`Signature of ${CERTIFICATE_SIGNATORY}`}
                className="h-[20mm] w-auto max-w-[55mm] object-contain object-bottom"
                crossOrigin="anonymous"
              />
            </div>
          ) : (
            <div className="min-h-[20mm]" aria-hidden />
          )}
          <p className="text-[13px] font-bold text-slate-900 leading-tight mt-0.5">{CERTIFICATE_SIGNATORY}</p>
          <p className="text-[11px] font-semibold text-slate-700 leading-tight">{CERTIFICATE_SIGNATORY_TITLE}</p>
          <p className="text-[10.5px] font-bold text-[#5AA3E6] uppercase tracking-wide leading-tight">
            {CERTIFICATE_COMPANY}
          </p>
        </div>
      </div>

      <div className="flex justify-between items-end gap-3 border-t border-slate-200 pt-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-end gap-3">
            {CERTIFICATE_FOOTER_LEFT_LOGOS.map(({ src, alt, height }) => (
              <img
                key={src}
                src={src}
                alt={alt}
                className="w-auto object-contain shrink-0"
                style={{ height }}
                crossOrigin="anonymous"
              />
            ))}
          </div>
          <p className="text-[7.5px] font-semibold text-slate-600 leading-tight">
            AICTE &amp; UGC aligned training and internship platform
          </p>
        </div>

        <div className="flex items-end justify-end gap-2 shrink-0">
          {CERTIFICATE_FOOTER_RIGHT_LOGOS.map(({ src, alt, height }) => (
            <img
              key={src}
              src={src}
              alt={alt}
              className="w-auto object-contain shrink-0"
              style={{ height }}
              crossOrigin="anonymous"
            />
          ))}
        </div>
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
      className="bg-white shadow-none text-slate-900 font-sans leading-snug relative flex flex-col overflow-hidden"
      style={{ ...pageStyle, padding: PAGE.padding }}
    >
      <TopLeftAccent />
      <BottomRightAccent />
      <CertificateHeader />
      <CertificationBody data={data} />
      <div className="relative shrink-0 w-full mt-2 space-y-4">
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
