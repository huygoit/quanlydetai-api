export const UNIVERSITY_STATUSES = ['ACTIVE', 'INACTIVE'] as const
export type UniversityStatus = (typeof UNIVERSITY_STATUSES)[number]

/** Khu vực / khối trong danh mục (khớp file nguồn). */
export const UNIVERSITY_REGIONS = [
  'HA_NOI',
  'HCM',
  'MIEN_BAC',
  'MIEN_NAM',
  'MIEN_TRUNG',
  'QUAN_DOI',
  'CONG_AN',
] as const
export type UniversityRegion = (typeof UNIVERSITY_REGIONS)[number]

export const UNIVERSITY_REGION_LABELS: Record<UniversityRegion, string> = {
  HA_NOI: 'Hà Nội',
  HCM: 'TP.HCM',
  MIEN_BAC: 'Miền Bắc',
  MIEN_NAM: 'Miền Nam',
  MIEN_TRUNG: 'Miền Trung',
  QUAN_DOI: 'Quân đội',
  CONG_AN: 'Công an',
}

/** Khối trường */
export const UNIVERSITY_SCHOOL_BLOCKS = ['CIVIL', 'MILITARY', 'POLICE'] as const
export type UniversitySchoolBlock = (typeof UNIVERSITY_SCHOOL_BLOCKS)[number]

export const UNIVERSITY_SCHOOL_BLOCK_LABELS: Record<UniversitySchoolBlock, string> = {
  CIVIL: 'Dân sự',
  MILITARY: 'Quân đội',
  POLICE: 'Công an',
}
