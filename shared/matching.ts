import type { MatchBreakdown, MatchingWeights } from './types.ts';

export const DEFAULT_MATCHING_WEIGHTS: MatchingWeights = {
  skills: 0.6,
  timezone: 0.25,
  availability: 0.15,
};

const TIMEZONE_OFFSETS: Record<string, number> = {
  UTC: 0,
  'America/Los_Angeles': -8,
  'America/Denver': -7,
  'America/Chicago': -6,
  'America/New_York': -5,
  'America/Toronto': -5,
  'America/Sao_Paulo': -3,
  'Europe/London': 0,
  'Europe/Berlin': 1,
  'Europe/Paris': 1,
  'Europe/Warsaw': 1,
  'Asia/Dubai': 4,
  'Asia/Kolkata': 5.5,
  'Asia/Singapore': 8,
  'Asia/Tokyo': 9,
  'Australia/Sydney': 10,
};

export function parseTimezoneOffsetHours(tz: string): number {
  if (tz in TIMEZONE_OFFSETS) return TIMEZONE_OFFSETS[tz];
  const utcMatch = tz.match(/^UTC([+-]\d+(?:\.\d+)?)$/i);
  if (utcMatch) return Number(utcMatch[1]);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date());
    const offsetPart = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
    const match = offsetPart.match(/GMT([+-]\d+)(?::(\d+))?/);
    if (!match) return 0;
    const hours = Number(match[1]);
    const mins = match[2] ? Number(match[2]) / 60 : 0;
    return hours >= 0 ? hours + mins : hours - mins;
  } catch {
    return 0;
  }
}

export function normalizeWeights(input?: Partial<MatchingWeights>): MatchingWeights {
  const rawSkills = input?.skills ?? DEFAULT_MATCHING_WEIGHTS.skills;
  const rawTz = input?.timezone ?? DEFAULT_MATCHING_WEIGHTS.timezone;
  const rawAvail = input?.availability ?? DEFAULT_MATCHING_WEIGHTS.availability;
  const sum = rawSkills + rawTz + rawAvail;
  if (sum <= 0) return DEFAULT_MATCHING_WEIGHTS;
  return {
    skills: Number((rawSkills / sum).toFixed(4)),
    timezone: Number((rawTz / sum).toFixed(4)),
    availability: Number((rawAvail / sum).toFixed(4)),
  };
}

/**
 * Transparent Teammate Matching Formula:
 * - Complementary / Required Skills Coverage (default 60%):
 *   Evaluates overlap with target required/desired skills plus bonus for unique complementary skills.
 * - Time-zone Compatibility (default 25%):
 *   Circular UTC difference (max 12h): score = max(0, 100 - (diffHours / 12) * 100).
 * - Availability Overlap (default 15%):
 *   Ratio of overlapping weekly hours: min(a, b) / max(a, b) * 100.
 */
export function computeMatchScore(params: {
  candidateSkills: string[];
  candidateTimezone: string;
  candidateWeeklyHours: number;
  targetRequiredSkills: string[];
  targetExistingSkills?: string[];
  targetTimezone: string;
  targetWeeklyHours: number;
  weights?: Partial<MatchingWeights>;
}): MatchBreakdown {
  const weights = normalizeWeights(params.weights);

  const norm = (arr: string[]) => Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)));
  const candSkills = norm(params.candidateSkills);
  const candLower = new Set(candSkills.map((s) => s.toLowerCase()));

  const reqSkills = norm(params.targetRequiredSkills);
  const existingLower = new Set((params.targetExistingSkills ?? []).map((s) => s.toLowerCase()));

  // Skills that are required by the team/hackathon and covered by candidate
  const matchingSkills = reqSkills.filter((s) => candLower.has(s.toLowerCase()));
  // Skills required by the team that are NOT yet covered by existing members and candidate fills
  const neededSkills = reqSkills.filter((s) => !existingLower.has(s.toLowerCase()));
  const filledGaps = neededSkills.filter((s) => candLower.has(s.toLowerCase()));
  const missingSkills = reqSkills.filter(
    (s) => !candLower.has(s.toLowerCase()) && !existingLower.has(s.toLowerCase()),
  );
  // Extra skills candidate brings that existing members don't already have
  const complementarySkills = candSkills.filter((s) => !existingLower.has(s.toLowerCase()));

  let skillScore = 0;
  if (reqSkills.length > 0) {
    const reqCoverage = matchingSkills.length / reqSkills.length;
    const gapCoverage = neededSkills.length > 0 ? filledGaps.length / neededSkills.length : reqCoverage;
    const bonusDiversity = Math.min(1, complementarySkills.length / 4) * 0.15;
    skillScore = Math.round(Math.min(100, (reqCoverage * 0.55 + gapCoverage * 0.35 + bonusDiversity) * 100));
  } else {
    skillScore = Math.min(100, complementarySkills.length * 25);
  }

  // Timezone compatibility (0 to 100)
  const offA = parseTimezoneOffsetHours(params.candidateTimezone);
  const offB = parseTimezoneOffsetHours(params.targetTimezone);
  const rawDiff = Math.abs(offA - offB);
  const circularDiff = Math.min(rawDiff, 24 - rawDiff);
  const timezoneScore = Math.round(Math.max(0, 100 - (circularDiff / 12) * 100));

  // Availability overlap (0 to 100)
  const hoursA = Math.max(1, params.candidateWeeklyHours || 10);
  const hoursB = Math.max(1, params.targetWeeklyHours || 10);
  const availabilityScore = Math.round((Math.min(hoursA, hoursB) / Math.max(hoursA, hoursB)) * 100);

  const overallScore = Math.round(
    skillScore * weights.skills +
      timezoneScore * weights.timezone +
      availabilityScore * weights.availability,
  );

  const reasons: string[] = [];
  if (filledGaps.length > 0) {
    reasons.push(`Covers ${filledGaps.length} open skill requirement${filledGaps.length > 1 ? 's' : ''} (${filledGaps.slice(0, 3).join(', ')})`);
  } else if (matchingSkills.length > 0) {
    reasons.push(`Matches ${matchingSkills.length} target skill${matchingSkills.length > 1 ? 's' : ''} (${matchingSkills.slice(0, 3).join(', ')})`);
  } else if (complementarySkills.length > 0) {
    reasons.push(`Brings complementary skills (${complementarySkills.slice(0, 3).join(', ')})`);
  }

  if (circularDiff <= 2) {
    reasons.push(`Near-identical timezone (${circularDiff}h offset)`);
  } else if (circularDiff <= 5) {
    reasons.push(`Workable timezone overlap (${circularDiff}h offset)`);
  } else {
    reasons.push(`${circularDiff}h timezone offset`);
  }

  reasons.push(`${hoursA}h/wk availability (${availabilityScore}% cadence alignment)`);

  return {
    overallScore,
    skillScore,
    timezoneScore,
    availabilityScore,
    matchingSkills,
    complementarySkills,
    missingSkills,
    explanation: reasons.join(' · '),
    weights,
  };
}
