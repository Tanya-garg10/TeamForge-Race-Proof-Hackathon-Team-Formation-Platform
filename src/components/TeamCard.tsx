import { Link } from 'react-router-dom';
import { ArrowRight, Crown, Sparkles, Users } from 'lucide-react';
import { Card, CardContent } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { AvatarStack } from '@/src/components/ui/avatar';
import { SkillTag, StatusBadge } from '@/src/components/ui/badge';
import { Progress } from '@/src/components/ui/progress';
import type { TeamDTO } from '@/shared/types';

export interface TeamCardProps {
  team: TeamDTO;
  currentUserId?: string;
  onJoin?: (teamId: string) => void;
  isJoining?: boolean;
  highlightSkills?: string[];
}

export function TeamCard({
  team,
  currentUserId,
  onJoin,
  isJoining = false,
  highlightSkills = [],
}: TeamCardProps) {
  const members = team.members ?? [];
  const leader = members.find((m) => m.role === 'LEADER') ?? members[0];
  const isMember = Boolean(currentUserId && members.some((m) => m.userId === currentUserId));
  const fillPct = Math.round((team.memberCount / Math.max(1, team.maxSize)) * 100);
  const highlightSet = new Set(highlightSkills.map((s) => s.toLowerCase()));

  return (
    <Card interactive className="flex flex-col h-full">
      <CardContent className="p-6 flex-1 flex flex-col">
        {/* Header: Team emblem, Name, Hackathon, Seat badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#7257E8] to-[#4338A8] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
              {team.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <Link
                to={`/teams/${team.id}`}
                className="block text-base font-bold text-[#201B35] hover:text-[#7257E8] transition-colors truncate"
              >
                {team.name}
              </Link>
              <p className="text-xs text-[#77718C] truncate">
                {team.hackathonName || 'Hackathon Squad'}
              </p>
            </div>
          </div>

          {team.openSeats === 1 ? (
            <StatusBadge tone="warning" className="shrink-0">
              <Sparkles className="h-3 w-3" />1 seat left
            </StatusBadge>
          ) : team.openSeats > 1 ? (
            <StatusBadge tone="violet" className="shrink-0 font-mono tabular-nums">
              {team.openSeats} open
            </StatusBadge>
          ) : (
            <StatusBadge tone="neutral" className="shrink-0">
              Full
            </StatusBadge>
          )}
        </div>

        {/* Description */}
        <p className="mt-4 text-sm text-[#77718C] line-clamp-2 leading-relaxed flex-1">
          {team.description}
        </p>

        {/* Required skills */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {team.requiredSkills.slice(0, 4).map((skill) => (
            <SkillTag key={skill} matched={highlightSet.has(skill.toLowerCase())}>
              {skill}
            </SkillTag>
          ))}
          {team.requiredSkills.length > 4 && (
            <SkillTag>+{team.requiredSkills.length - 4}</SkillTag>
          )}
        </div>

        {/* Capacity bar */}
        <div className="mt-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#77718C] inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-[#7257E8]" />
              Team capacity
            </span>
            <span className="font-mono font-semibold tabular-nums text-[#201B35]">
              {team.memberCount}/{team.maxSize} seats
            </span>
          </div>
          <Progress
            value={fillPct}
            tone={team.openSeats === 0 ? 'success' : team.openSeats === 1 ? 'warning' : 'violet'}
            className="h-1.5"
          />
        </div>

        {/* Footer: Leader + Member avatar stack + CTA */}
        <div className="mt-5 pt-4 border-t border-[#ECE8F4] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <AvatarStack
              members={members.map((m) => ({ name: m.user.name, avatarUrl: m.user.avatarUrl }))}
              maxVisible={3}
              size="xs"
            />
            {leader && (
              <span className="text-xs text-[#77718C] truncate inline-flex items-center gap-1">
                <Crown className="h-3 w-3 text-[#7257E8] shrink-0" />
                <span className="truncate">{leader.user.name.split(' ')[0]}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isMember ? (
              <Button asChild size="sm" variant="secondary">
                <Link to={`/teams/${team.id}`}>
                  Manage
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : currentUserId && onJoin && team.openSeats > 0 ? (
              <>
                <Button asChild size="sm" variant="ghost">
                  <Link to={`/teams/${team.id}`}>Details</Link>
                </Button>
                <Button
                  size="sm"
                  isLoading={isJoining}
                  onClick={() => onJoin(team.id)}
                >
                  Join Team
                </Button>
              </>
            ) : (
              <Button asChild size="sm" variant="outline">
                <Link to={`/teams/${team.id}`}>
                  View Team
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
