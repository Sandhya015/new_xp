/**
 * Universities & boards we serve. Logos are in public/images/universities/ with name-hint filenames.
 * PU = Patna University & Purnea University; MU = Munger University & Magadh University.
 */
export const UNIVERSITIES_LIST = [
  /* S.No. 1  */ { name: 'Bihar Engineering University', shortForm: 'BEU', logo: '/images/universities/bihar university.svg' },
  /* S.No. 2  */ { name: 'State Board of Technical Education, Bihar', shortForm: 'SBTE Bihar', logo: '/images/universities/stateborard of technical edu.svg' },
  /* S.No. 3  */ { name: 'Jharkhand University of Technology', shortForm: 'JUT', logo: '/images/universities/jarkhand.svg' },
  /* S.No. 4  */ { name: 'Dr. A.P.J. Abdul Kalam Technical University', shortForm: 'AKTU', logo: '/images/universities/abdual kalam.svg' },
  /* S.No. 5  */ { name: 'Board of Technical Education, Uttar Pradesh', shortForm: 'BTEUP', logo: '/images/universities/uttar pradesh.svg' },
  /* S.No. 6  */ { name: 'Patna University', shortForm: 'PU', logo: '/images/universities/patna.svg' },
  /* S.No. 7  */ { name: 'Patliputra University', shortForm: 'PPU', logo: '/images/universities/pataliputra.svg' },
  /* S.No. 8  */ { name: 'Purnea University', shortForm: 'PU (Purnea)', logo: '/images/universities/purnea.svg' },
  /* S.No. 9  */ { name: 'Lalit Narayan Mithila University', shortForm: 'LNMU', logo: '/images/universities/lalit narayan.svg' },
  /* S.No. 10 */ { name: 'Bhupendra Narayan Mandal University', shortForm: 'BNMU', logo: '/images/universities/narayan mandal.svg' },
  /* S.No. 11 */ { name: 'Jai Prakash University', shortForm: 'JPU', logo: '/images/universities/jaiprakash.svg' },
  /* S.No. 12 */ { name: 'Munger University', shortForm: 'MU', logo: '/images/universities/munger.svg' },
  /* S.No. 13 */ { name: 'Tilka Manjhi Bhagalpur University', shortForm: 'TMBU', logo: '/images/universities/bhaglapur.svg' },
  /* S.No. 14 */ { name: 'Veer Kunwar Singh University', shortForm: 'VKSU', logo: '/images/universities/veerkunwar.svg' },
  /* S.No. 15 */ { name: 'Magadh University', shortForm: 'MU (Magadh)', logo: '/images/universities/Magadh.svg' },
  /* S.No. 16 */ { name: 'Nalanda Open University', shortForm: 'NOU', logo: '/images/universities/nalanda.svg' },
  /* S.No. 17 */ { name: 'Babasaheb Bhimrao Ambedkar Bihar University', shortForm: 'BRABU', logo: '/images/universities/ambedkar.svg' },
] as const

/** Option value for forms: full university/board name */
export const UNIVERSITY_OPTIONS = UNIVERSITIES_LIST.map((u) => ({
  value: u.name,
  label: `${u.shortForm} — ${u.name}`,
}))
