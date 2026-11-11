import type { ApplicationStatus } from '../../../generated/prisma/client'

const STAGE_LABEL: Record<ApplicationStatus, string> = {
  applied: 'Applied',
  under_review: 'Under review',
  technical_interview: 'Technical interview',
  culture_fit: 'Culture fit',
  offer: 'Offer',
  rejected: 'Rejected',
  hired: 'Hired',
}

/** What a candidate is told when an employer moves their application. Pure, so the wording is testable. */
export function statusMessage(status: ApplicationStatus, jobTitle: string, companyName: string) {
  const at = companyName ? ` at ${companyName}` : ''
  if (status === 'rejected') {
    return {
      title: `Update on your application for ${jobTitle}`,
      body: `${companyName || 'The employer'} will not be taking your application${at ? ` for ${jobTitle}` : ''} forward.`,
    }
  }
  if (status === 'hired') {
    return { title: `You were hired: ${jobTitle}`, body: `Congratulations, you were hired as ${jobTitle}${at}.` }
  }
  return {
    title: `${STAGE_LABEL[status]}: ${jobTitle}`,
    body: `Your application for ${jobTitle}${at} moved to ${STAGE_LABEL[status].toLowerCase()}.`,
  }
}

/** What an employer is told when an admin suspends or restores one of their jobs. */
export function moderationMessage(action: 'suspended' | 'restored', jobTitle: string, reason?: string | null) {
  if (action === 'restored') {
    return { title: `Job restored: ${jobTitle}`, body: `${jobTitle} was reviewed and can be published again.` }
  }
  return {
    title: `Job suspended: ${jobTitle}`,
    body: `${jobTitle} is hidden from candidates while it is under review.${reason ? ` Reason: ${reason}` : ''}`,
  }
}

/** What an employer is told when someone applies. */
export function receivedMessage(candidateName: string, jobTitle: string, score: number) {
  return {
    title: `New application: ${jobTitle}`,
    body: `${candidateName} applied to ${jobTitle} (${score}% match).`,
  }
}
