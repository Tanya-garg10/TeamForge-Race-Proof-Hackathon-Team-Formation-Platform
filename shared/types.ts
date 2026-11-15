export type ExperienceLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
export type TeamRole = 'LEADER' | 'MEMBER';
export type TeamStatus = 'ACTIVE' | 'LOCKED' | 'ARCHIVED';
export type InvitationStatus = 'ACTIVE' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
export type JoinRequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  skills: string[];
  experienceLevel: ExperienceLevel;
  preferredRoles: string[];
  timezone: string;
  weeklyAvailability: number;
  githubUrl: string | null;
  portfolioUrl: string | null;
  isDemoAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Hackathon {
  id: string;
  name: string;
  slug: string;
  description: string;
  theme: string;
  registrationDeadline: string;
  minTeamSize: number;
  maxTeamSize: number;
  requiredSkills: string[];
  bannerUrl: string | null;
  currentTeamCount: number;
  createdAt: string;
}

export interface TeamMemberDTO {
  id: string;
  teamId: string;
  hackathonId: string;
  userId: string;
  role: TeamRole;
  joinedAt: string;
  user: Pick<
    PublicUser,
    'id' | 'name' | 'avatarUrl' | 'skills' | 'experienceLevel' | 'preferredRoles' | 'timezone' | 'weeklyAvailability' | 'githubUrl'
  >;
}

export interface TeamDTO {
  id: string;
  hackathonId: string;
  hackathonName?: string;
  name: string;
  description: string;
  requiredSkills: string[];
  minSize: number;
  maxSize: number;
  leaderId: string;
  status: TeamStatus;
  memberCount: number;
  openSeats: number;
  createdAt: string;
  updatedAt: string;
  members?: TeamMemberDTO[];
}

export interface InvitationDTO {
  id: string;
  teamId: string;
  hackathonId: string;
  inviterId: string;
  inviterName?: string;
  inviteeEmail: string | null;
  status: InvitationStatus;
  maxUses: number;
  usesCount: number;
  expiresAt: string;
  createdAt: string;
}

export interface JoinRequestDTO {
  id: string;
  teamId: string;
  teamName?: string;
  hackathonId: string;
  userId: string;
  user?: PublicUser;
  message: string | null;
  status: JoinRequestStatus;
  createdAt: string;
  reviewedAt: string | null;
}

export interface AuditLogDTO {
  id: string;
  actorUserId: string;
  actorName: string | null;
  actionType: string;
  entityType: string;
  entityId: string;
  hackathonId: string | null;
  teamId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface MatchingWeights {
  skills: number;
  timezone: number;
  availability: number;
}

export interface MatchBreakdown {
  overallScore: number;
  skillScore: number;
  timezoneScore: number;
  availabilityScore: number;
  matchingSkills: string[];
  complementarySkills: string[];
  missingSkills: string[];
  explanation: string;
  weights: MatchingWeights;
}

export interface TeammateRecommendation {
  user: PublicUser;
  match: MatchBreakdown;
}

export interface TeamRecommendation {
  team: TeamDTO;
  match: MatchBreakdown;
}
