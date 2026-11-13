export type UserRole = 'worker' | 'coordinator';

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  crewOrRegion: string;
  initials: string;
}
