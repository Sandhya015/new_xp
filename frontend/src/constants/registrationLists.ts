/** Student registration — course / branch / subject lists (client spec v2.1). */

export const OTHER_OPTION_VALUE = '__OTHER__'

export const STUDENT_COURSES = ['B.Tech', 'Diploma', 'B.Sc', 'B.Com', 'B.A.', 'BBA', 'BCA'] as const

export const BRANCHES_66 = [
  '3-D Animation & Graphics',
  'Aeronautical Engineering',
  'Agricultural Engineering',
  'Architectural Assistantship',
  'Artificial Intelligence & Machine Learning',
  'Automobile Engineering',
  'Biomedical Robotic Engineering',
  'Bioinformatics',
  'Ceramics Engineering',
  'Chemical Engineering',
  'Chemical Engineering (Plastic & Polymer)',
  'Chemical Technology (Leather Technology)',
  'Civil Engineering',
  'Civil Engineering (Construction Technology)',
  'Civil Engineering with Computer Application',
  'Civil (Rural) Engineering',
  'Cloud Computing and Big Data',
  'Comp. Aided Cost. Design & Dress Making',
  'Computer Engineering',
  'Computer Engineering and IOT',
  'Computer Engineering & Application',
  'Computer Science & Engineering (CSE)',
  'CSE (Artificial Intelligence)',
  'CSE (Cyber Security)',
  'CSE (Data Science)',
  'CSE (Internet of Things)',
  'CSE (IoT & Cyber Security)',
  'CSE (Networks)',
  'Computer Science and Technology',
  'Cyber System and Information Security',
  'Dairy Technology',
  'Dress Designing & Garment Manufacturing',
  'Electrical Engineering',
  'Electrical & Electronics Engineering',
  'Electronics & Communication Engineering (ECE)',
  'Electronics & Communication Engineering (ACT)',
  'Electronics Engineering',
  'Electronics Engineering (VLSI Design & Technology)',
  'Electronics (Robotics)',
  'Electronics & Instrumentation Engineering',
  'Fashion & Clothing Technology',
  'Fashion Technology',
  'Fire Technology & Safety',
  'Food Processing & Preservation',
  'Food Technology & Management',
  'Garment Technology',
  'Information Technology',
  'Interior Design',
  'Leather Technology',
  'Library & Information Science',
  'Mechanical Engineering',
  'Mechanical Engineering (Automobile)',
  'Mechanical Engineering (CAD/CAM)',
  'Mechanical Engineering Auto Mobile',
  'Mechanical & Smart Manufacturing',
  'Mechatronics Engineering',
  'Metallurgical Engineering',
  'Mining Engineering',
  'Modern Office Practice',
  'Petrochemical Engineering',
  'Printing Technology',
  'Production & Industrial Engineering',
  'Robotics & Automation',
  'Textile Engineering',
  'Textile Technology',
  'Others',
] as const

export const BRANCH_OTHERS_LABEL = 'Others'

export const BSC_SUBJECTS = [
  'B.Sc (Botany)',
  'B.Sc (Chemistry)',
  'B.Sc (Mathematics)',
  'B.Sc (Physics)',
  'B.Sc (Zoology)',
] as const

export const BCOM_SUBJECTS = [
  'B.Com Accounting and Finance',
  'B.Com (HRM)',
  'B.Com (Marketing)',
] as const

export const BA_SUBJECTS = [
  'B.A. (Ancient Indian History - AIH)',
  'B.A. (Anthropology)',
  'B.A. (Arabic)',
  'B.A. (Bengali)',
  'B.A. (Bhojpuri)',
  'B.A. (Dramatics)',
  'B.A. (Economics)',
  'B.A. (English)',
  'B.A. (Geography)',
  'B.A. (Home Science)',
  'B.A. (Hindi)',
  'B.A. (History)',
  'B.A. (Law)',
  'B.A. (Maithili)',
  'B.A. (Mathematics)',
  'B.A. (Music)',
  'B.A. (Pali)',
  'B.A. (Persian)',
  'B.A. (Philosophy)',
  'B.A. (Political Science)',
  'B.A. (Prakrit)',
  'B.A. (Psychology)',
  'B.A. (Rural Economics)',
  'B.A. (Sanskrit)',
  'B.A. (Sociology)',
  'B.A. (Statistics)',
  'B.A. (Urdu)',
  'Statistics',
] as const

export const BBA_SUBJECTS = [
  'Finance',
  'Marketing',
  'Human Resources (HR)',
  'Operations Management',
  'International Business',
] as const

export const BCA_SUBJECTS = [
  'Computer Science',
  'Information Technology',
  'Software Development',
  'Web Development',
  'Data Science',
] as const

export function subjectOptionsForCourse(course: string): { value: string; label: string }[] {
  const other = { value: OTHER_OPTION_VALUE, label: 'Other (Please specify)' }
  const base = (items: readonly string[]) => [...items.map((s) => ({ value: s, label: s })), other]
  if (course === 'B.Sc') return base(BSC_SUBJECTS)
  if (course === 'B.Com') return base(BCOM_SUBJECTS)
  if (course === 'B.A.') return base(BA_SUBJECTS)
  if (course === 'BBA') return base(BBA_SUBJECTS)
  if (course === 'BCA') return base(BCA_SUBJECTS)
  return []
}
