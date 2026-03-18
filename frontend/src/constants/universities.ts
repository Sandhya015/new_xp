/**
 * Universities & boards we serve. S.No. 1–17; logos are 1.svg–17.svg in public/images/universities/
 * PU = Patna University & Purnea University; MU = Munger University & Magadh University.
 */
export const UNIVERSITIES_LIST = [
  { name: 'Bihar Engineering University', shortForm: 'BEU', logo: '/images/universities/1.svg' },
  { name: 'State Board of Technical Education, Bihar', shortForm: 'SBTE Bihar', logo: '/images/universities/2.svg' },
  { name: 'Jharkhand University of Technology', shortForm: 'JUT', logo: '/images/universities/3.svg' },
  { name: 'Dr. A.P.J. Abdul Kalam Technical University', shortForm: 'AKTU', logo: '/images/universities/4.svg' },
  { name: 'Board of Technical Education, Uttar Pradesh', shortForm: 'BTEUP', logo: '/images/universities/5.svg' },
  { name: 'Patna University', shortForm: 'PU', logo: '/images/universities/6.svg' },
  { name: 'Patliputra University', shortForm: 'PPU', logo: '/images/universities/7.svg' },
  { name: 'Purnea University', shortForm: 'PU (Purnea)', logo: '/images/universities/8.svg' },
  { name: 'Lalit Narayan Mithila University', shortForm: 'LNMU', logo: '/images/universities/9.svg' },
  { name: 'Bhupendra Narayan Mandal University', shortForm: 'BNMU', logo: '/images/universities/10.svg' },
  { name: 'Jai Prakash University', shortForm: 'JPU', logo: '/images/universities/11.svg' },
  { name: 'Munger University', shortForm: 'MU', logo: '/images/universities/12.svg' },
  { name: 'Tilka Manjhi Bhagalpur University', shortForm: 'TMBU', logo: '/images/universities/13.svg' },
  { name: 'Veer Kunwar Singh University', shortForm: 'VKSU', logo: '/images/universities/14.svg' },
  { name: 'Magadh University', shortForm: 'MU (Magadh)', logo: '/images/universities/15.svg' },
  { name: 'Nalanda Open University', shortForm: 'NOU', logo: '/images/universities/16.svg' },
  { name: 'Babasaheb Bhimrao Ambedkar Bihar University', shortForm: 'BRABU', logo: '/images/universities/17.svg' },
] as const

/** Option value for forms: full university/board name */
export const UNIVERSITY_OPTIONS = UNIVERSITIES_LIST.map((u) => ({
  value: u.name,
  label: `${u.shortForm} — ${u.name}`,
}))
