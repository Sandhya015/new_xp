/**
 * Universities shown on the student registration form (client v2.1).
 * Marketing / training filters continue to use `universities.ts`.
 */
import { OTHER_OPTION_VALUE } from '@/constants/registrationLists'

export type RegistrationUniversity = { name: string; shortForm: string }

export const REGISTRATION_UNIVERSITIES_LIST: RegistrationUniversity[] = [
  // v3.1 final list (alphabetical) — display names include campus city per handover doc.
  { name: 'Babasaheb Bhimrao Ambedkar Bihar University (BRABU), Muzaffarpur', shortForm: 'BRABU' },
  { name: 'Bhupendra Narayan Mandal University (BNMU), Madhepura', shortForm: 'BNMU' },
  { name: 'Bihar Engineering University (BEU), Patna', shortForm: 'BEU' },
  { name: 'Board of Technical Education Uttar Pradesh (BTEUP), Lucknow', shortForm: 'BTEUP' },
  { name: 'Dr. A. P. J. Abdul Kalam Technical University (AKTU), Lucknow', shortForm: 'AKTU' },
  { name: 'Jai Prakash University (JPU), Chapra', shortForm: 'JPU' },
  { name: 'Jharkhand University of Technology (JUT), Ranchi', shortForm: 'JUT' },
  { name: 'Lalit Narayan Mithila University (LNMU), Darbhanga', shortForm: 'LNMU' },
  { name: 'Magadh University (MU), Bodh Gaya', shortForm: 'MU (Magadh)' },
  { name: 'Munger University (MU), Munger', shortForm: 'MU (Munger)' },
  { name: 'Nalanda Open University (NOU), Nalanda', shortForm: 'NOU' },
  { name: 'Patliputra University (PPU), Patna', shortForm: 'PPU' },
  { name: 'Patna University (PU), Patna', shortForm: 'PU (Patna)' },
  { name: 'Purnea University (PU), Purnea', shortForm: 'PU (Purnea)' },
  { name: 'State Board of Technical Education (SBTE), Bihar', shortForm: 'SBTE' },
  { name: 'Tilka Manjhi Bhagalpur University (TMBU), Bhagalpur', shortForm: 'TMBU' },
  { name: 'Veer Kunwar Singh University (VKSU), Ara', shortForm: 'VKSU' },
  { name: OTHER_OPTION_VALUE, shortForm: 'Other (Please specify)' },
]
