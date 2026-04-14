/**
 * Universities shown on the student registration form (client v2.1).
 * Marketing / training filters continue to use `universities.ts`.
 */
import { OTHER_OPTION_VALUE } from '@/constants/registrationLists'

export type RegistrationUniversity = { name: string; shortForm: string }

export const REGISTRATION_UNIVERSITIES_LIST: RegistrationUniversity[] = [
  { name: 'Bihar Engineering University', shortForm: 'BEU' },
  { name: 'State Board of Technical Education, Bihar', shortForm: 'SBTE' },
  { name: 'Jharkhand University of Technology', shortForm: 'JUT' },
  { name: 'Abdul Kalam Technical University, UP', shortForm: 'AKTU' },
  { name: 'Patna University', shortForm: 'Patna University' },
  { name: 'Patliputra University', shortForm: 'Patliputra University' },
  { name: 'Munger University', shortForm: 'Munger University' },
  { name: 'Lalit Narayan Mithila University', shortForm: 'LNMU' },
  { name: 'Veer Kunwar Singh University', shortForm: 'VKSU' },
  { name: 'Tilka Manjhi Bhagalpur University', shortForm: 'TMBU' },
  { name: 'Bhupendra Narayan Mandal University', shortForm: 'BNMU' },
  { name: 'Jai Prakash University', shortForm: 'JPU' },
  { name: 'Magadh University', shortForm: 'Magadh University' },
  { name: 'Purnea University', shortForm: 'Purnea University' },
  { name: 'Nalanda Open University', shortForm: 'NOU' },
  { name: 'Babasaheb Bhimrao Ambedkar Bihar University', shortForm: 'BRABU' },
  { name: OTHER_OPTION_VALUE, shortForm: 'Other (Please specify)' },
]
