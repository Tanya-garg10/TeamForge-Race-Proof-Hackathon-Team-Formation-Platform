import { Progress } from '@/src/components/ui/progress';
import { SkillTag } from '@/src/components/ui/badge';
import type { MatchBreakdown } from '@/shared/types';

export function MatchScoreBreakdown({ match }: { match: MatchBreakdown }) {
  return (
    <div className="space-y-3 rounded-xl border border-[#ECE8F4] bg-[#FAF9FF] p-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-medium text-[#77718C]">Skills ({Math.round(match.weights.skills * 100)}%)</span>
            <span className="font-mono font-semibold tabular-nums text-[#201B35]">
              {match.skillScore}%
            </span>
          </div>
          <Progress value={match.skillScore} tone="violet" className="h-1.5" />
        </div>

        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-medium text-[#77718C]">
              Timezone ({Math.round(match.weights.timezone * 100)}%)
            </span>
            <span className="font-mono font-semibold tabular-nums text-[#201B35]">
              {match.timezoneScore}%
            </span>
          </div>
          <Progress value={match.timezoneScore} tone="blue" className="h-1.5" />
        </div>

        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-medium text-[#77718C]">
              Availability ({Math.round(match.weights.availability * 100)}%)
            </span>
            <span className="font-mono font-semibold tabular-nums text-[#201B35]">
              {match.availabilityScore}%
            </span>
          </div>
          <Progress value={match.availabilityScore} tone="success" className="h-1.5" />
        </div>
      </div>

      <p className="text-xs text-[#77718C] leading-relaxed">{match.explanation}</p>

      {(match.complementarySkills.length > 0 || match.matchingSkills.length > 0) && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {match.complementarySkills.slice(0, 4).map((skill) => (
            <SkillTag key={`comp-${skill}`} matched>
              + {skill}
            </SkillTag>
          ))}
          {match.matchingSkills.slice(0, 3).map((skill) => (
            <SkillTag key={`match-${skill}`}>{skill}</SkillTag>
          ))}
        </div>
      )}
    </div>
  );
}
