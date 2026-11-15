import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Clock, ExternalLink, Globe, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { apiFetch } from '@/src/lib/api';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent } from '@/src/components/ui/card';
import { SearchField } from '@/src/components/ui/input';
import { UserAvatar } from '@/src/components/ui/avatar';
import { SkillTag, StatusBadge } from '@/src/components/ui/badge';
import { EmptyState } from '@/src/components/ui/empty-state';
import { Skeleton } from '@/src/components/ui/skeleton';
import { MatchScoreBreakdown } from '@/src/components/MatchScoreBreakdown';
import type { TeamDTO, TeammateRecommendation } from '@/shared/types';

export function FindTeammatesPage() {
  const { user } = useAuth();
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [search, setSearch] = useState('');
  const [wSkills, setWSkills] = useState(60);
  const [wTimezone, setWTimezone] = useState(25);
  const [wAvailability, setWAvailability] = useState(15);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const { data: myTeamsData } = useQuery({
    queryKey: ['my-teams', user?.id],
    queryFn: () => apiFetch<{ items: TeamDTO[] }>('/api/users/me/teams'),
    enabled: Boolean(user),
  });

  const params = new URLSearchParams();
  if (selectedTeamId) params.set('teamId', selectedTeamId);
  params.set('wSkills', String(wSkills));
  params.set('wTimezone', String(wTimezone));
  params.set('wAvailability', String(wAvailability));

  const { data, isLoading } = useQuery({
    queryKey: ['matching-teammates', user?.id, selectedTeamId, wSkills, wTimezone, wAvailability],
    queryFn: () =>
      apiFetch<{ items: TeammateRecommendation[] }>(`/api/matching/teammates?${params.toString()}`),
    enabled: Boolean(user),
  });

  if (!user) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <EmptyState
          icon={<Sparkles className="h-6 w-6" />}
          title="Sign in to unlock teammate matching"
          description="Our compatibility engine compares your skills, timezone, and weekly availability against active builders."
          action={
            <Button asChild>
              <Link to="/auth?redirect=/teammates">Sign In</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const myTeams = myTeamsData?.items ?? [];
  const rawRecommendations = data?.items ?? [];
  const filtered = rawRecommendations.filter((rec) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      rec.user.name.toLowerCase().includes(q) ||
      rec.user.skills.some((s) => s.toLowerCase().includes(q)) ||
      rec.user.preferredRoles.some((r) => r.toLowerCase().includes(q)) ||
      rec.user.timezone.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-7">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <StatusBadge tone="violet">Smart Compatibility</StatusBadge>
          <h1 className="mt-2.5 text-3xl font-extrabold tracking-tight text-[#201B35]">
            Meet Your Next Teammate.
          </h1>
          <p className="mt-1 text-sm sm:text-base text-[#77718C]">
            Every score is computed live from skill gap coverage, timezone alignment, and weekly hours.
          </p>
        </div>

        <Button asChild variant="outline">
          <Link to="/profile">Tune My Skills & Hours</Link>
        </Button>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          <div className="lg:col-span-4">
            <SearchField
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch('')}
              placeholder="Filter matches by name, skill, or role..."
            />
          </div>

          <div className="lg:col-span-3">
            <select
              aria-label="Match context"
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="h-10 w-full rounded-xl border border-[#ECE8F4] bg-[#FAF9FF] px-3 text-xs font-semibold text-[#201B35]"
            >
              <option value="">Match for my personal profile</option>
              {myTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  Fill skill gaps for: {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-5 flex flex-wrap items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#201B35]">
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#7257E8]" />
              Weights:
            </span>
            <label className="flex items-center gap-1.5 text-[#77718C]">
              Skills
              <input
                type="number"
                min={0}
                max={100}
                value={wSkills}
                onChange={(e) => setWSkills(Math.max(0, Number(e.target.value) || 0))}
                className="w-14 h-8 rounded-lg border border-[#ECE8F4] bg-[#FAF9FF] px-2 font-mono text-xs text-[#201B35]"
              />
            </label>
            <label className="flex items-center gap-1.5 text-[#77718C]">
              TZ
              <input
                type="number"
                min={0}
                max={100}
                value={wTimezone}
                onChange={(e) => setWTimezone(Math.max(0, Number(e.target.value) || 0))}
                className="w-14 h-8 rounded-lg border border-[#ECE8F4] bg-[#FAF9FF] px-2 font-mono text-xs text-[#201B35]"
              />
            </label>
            <label className="flex items-center gap-1.5 text-[#77718C]">
              Hours
              <input
                type="number"
                min={0}
                max={100}
                value={wAvailability}
                onChange={(e) => setWAvailability(Math.max(0, Number(e.target.value) || 0))}
                className="w-14 h-8 rounded-lg border border-[#ECE8F4] bg-[#FAF9FF] px-2 font-mono text-xs text-[#201B35]"
              />
            </label>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-6 w-6" />}
          title="No matching teammates found"
          description="Adjust your search filter or update your preferred roles and skills in your profile."
          action={
            <Button variant="outline" onClick={() => setSearch('')}>
              Clear Search
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map(({ user: cand, match }) => {
            const expanded = Boolean(expandedIds[cand.id]);
            return (
              <Card key={cand.id} interactive>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <UserAvatar name={cand.name} avatarUrl={cand.avatarUrl} size="lg" />
                      <div className="min-w-0">
                        <h2 className="text-base font-bold text-[#201B35] truncate">{cand.name}</h2>
                        <p className="text-xs text-[#77718C] truncate">
                          {cand.preferredRoles.join(' · ') || cand.experienceLevel}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-[#77718C]">
                          <span className="inline-flex items-center gap-1">
                            <Globe className="h-3 w-3 text-[#5B8DEF]" />
                            {cand.timezone}
                          </span>
                          <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                            <Clock className="h-3 w-3 text-[#16A477]" />
                            {cand.weeklyAvailability}h/wk
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono text-2xl font-extrabold tabular-nums text-[#7257E8]">
                        {match.overallScore}%
                      </span>
                      <p className="text-[11px] font-medium text-[#77718C]">Compatibility</p>
                    </div>
                  </div>

                  {cand.bio && (
                    <p className="text-sm text-[#77718C] line-clamp-2 leading-relaxed">{cand.bio}</p>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {cand.skills.map((s) => (
                      <SkillTag
                        key={s}
                        matched={
                          match.complementarySkills.includes(s) || match.matchingSkills.includes(s)
                        }
                      >
                        {s}
                      </SkillTag>
                    ))}
                  </div>

                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#ECE8F4]">
                    <button
                      type="button"
                      onClick={() => toggleExpand(cand.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4338A8] hover:text-[#7257E8] cursor-pointer"
                    >
                      {expanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                      Why this is a good match
                    </button>

                    <div className="flex items-center gap-2">
                      {cand.githubUrl && (
                        <a
                          href={cand.githubUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#77718C] hover:text-[#201B35]"
                        >
                          GitHub
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {selectedTeamId && (
                        <Button asChild size="sm" variant="secondary">
                          <Link to={`/teams/${selectedTeamId}`}>Invite from Team</Link>
                        </Button>
                      )}
                    </div>
                  </div>

                  {expanded && <MatchScoreBreakdown match={match} />}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
