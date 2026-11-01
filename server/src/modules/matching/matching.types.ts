export type DimensionKey =
  | 'skills'
  | 'experience'
  | 'domain'
  | 'education'
  | 'leadership'
  | 'certifications'

export type WorkMode = 'onsite' | 'hybrid' | 'remote'

export type ProfileSkill = {
  termId: string
  level: number
  years: number
}

export type ProfileRole = {
  title: string
  years: number
  domainId?: string
}

// 0 none, 1 diploma/associate, 2 bachelor, 3 master, 4 doctorate.
export type ProfileEducation = {
  degreeLevel: number
}

export type ProfileContent = {
  skills: ProfileSkill[]
  roles: ProfileRole[]
  education: ProfileEducation[]
  leadershipLevel: number
  certIds: string[]
  preferences?: {
    locations?: string[]
    workModes?: WorkMode[]
    minSalary?: number
  }
}

export type JobSkill = {
  termId: string
  required: boolean
  minLevel: number
  minYears?: number
}

export type JobContent = {
  skills: JobSkill[]
  minYears: number
  domainId?: string
  minDomainYears: number
  minDegreeLevel: number
  leadershipLevel: number
  certIds: string[]
  location?: string
  workMode?: WorkMode
  salaryMax?: number
}

export type DimensionResult = {
  key: DimensionKey
  score: number
  weight: number
  applicable: boolean
}

export type MissingSkill = {
  termId: string
  required: boolean
}

export type MatchResult = {
  score: number
  engineVersion: string
  dimensions: DimensionResult[]
  missing: {
    skills: MissingSkill[]
    certs: string[]
  }
}

export type EligibilityStatus = 'ok' | 'mismatch' | 'unknown'

export type EligibilityResult = {
  location: EligibilityStatus
  workMode: EligibilityStatus
  salary: EligibilityStatus
}
