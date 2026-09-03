import { IUser } from '../models/User';

export function calculateProfileCompletion(user: Partial<IUser> | any): number {
  if (!user) return 0;

  const role = user.role;
  let score = 0;

  const hasBio = Boolean(user.bio && user.bio.trim().length > 0);
  const hasPhoto = Boolean(user.profilePhotoUrl && user.profilePhotoUrl.trim().length > 0);
  const hasLocation = Boolean(user.location && user.location.trim().length > 0);
  const hasSkills = Boolean(Array.isArray(user.skills) && user.skills.length > 0);
  const hasEducation = Boolean(Array.isArray(user.education) && user.education.length > 0);
  
  let hasLinks = false;
  if (user.links) {
    if (user.links instanceof Map) {
      hasLinks = user.links.size > 0;
    } else if (typeof user.links === 'object') {
      hasLinks = Object.keys(user.links).length > 0;
    }
  }

  if (role === 'alumni') {
    const hasCompany = Boolean(user.company && user.company.trim().length > 0);
    const hasDesignation = Boolean(user.designation && user.designation.trim().length > 0);
    const hasExperience = Boolean(Array.isArray(user.experience) && user.experience.length > 0);

    if (hasBio) score += 15;
    if (hasPhoto) score += 20;
    if (hasLocation) score += 10;
    if (hasSkills) score += 15;
    if (hasEducation) score += 15;
    if (hasLinks) score += 5;
    if (hasCompany) score += 5;
    if (hasDesignation) score += 5;
    if (hasExperience) score += 10;
  } else {
    // Student or other
    if (hasBio) score += 20;
    if (hasPhoto) score += 25;
    if (hasLocation) score += 15;
    if (hasSkills) score += 20;
    if (hasEducation) score += 10;
    if (hasLinks) score += 10;
  }

  return Math.min(100, Math.max(0, score));
}
