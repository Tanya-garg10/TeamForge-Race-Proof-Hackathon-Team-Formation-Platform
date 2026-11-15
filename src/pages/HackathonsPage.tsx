import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calendar, Plus, Users } from 'lucide-react';
import { apiFetch } from '@/src/lib/api';
import { getHackathonBanner } from '@/src/lib/hackathonImages';
import { formatDeadline } from '@/src/lib/utils';
import { Button } from '@/src/components/ui/button';
import { SearchField } from '@/src/components/ui/input';
import { Card, CardContent } from '@/src/components/ui/card';
import { FilterChip, SkillTag, StatusBadge } from '@/src/components/ui/badge';
import { EmptyState } from '@/src/components/ui/empty-state';
import { Skeleton } from '@/src/components/ui/skeleton';
import { TeamCard } from '@/src/components/TeamCard';
import { useAuth } from '@/src/context/AuthContext';
import type { Hackathon, TeamDTO } from '@/shared/types';

export function HackathonsPage() {
  const [search, setSearch] = useState('');
  const [theme, setTheme] = useState('');
  const [openOnly, setOpenOnly] = useState(true);

  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (theme) params.set('theme', theme);
  if (openOnly) params.set('openOnly', 'true');

  const { data, isLoading } = useQuery({
    queryKey: ['hackathons', search, theme, openOnly],
    queryFn: () => apiFetch<{ items: Hackathon[]; total: number }>(`/api/hackathons?${params.toString()}`),
  });

  const hackathons = data?.items ?? [];

  return (
    <div className="space-y-7">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <StatusBadge tone="violet">Hackathon Discovery</StatusBadge>
          <h1 className="mt-2.5 text-3xl font-extrabold tracking-tight text-[#201B35]">
            Explore Hackathons
          </h1>
          <p className="mt-1 text-sm sm:text-base text-[#77718C]">
            Browse upcoming engineering sprints, team capacity rules, and open squads.
          </p>
        </div>
        <Button asChild>
          <Link to="/teams/new">
            <Plus className="h-4 w-4" />
            Launch a Team
          </Link>
        </Button>
      </div>

      {/* Filter Toolbar */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-5">
            <SearchField
              aria-label="Search hackathons"
              placeholder="Search by title, theme, or stack..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch('')}
            />
          </div>
          <div className="md:col-span-4">
            <select
              aria-label="Filter by theme"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="flex h-10 w-full rounded-xl border border-[#ECE8F4] bg-white px-3 text-sm text-[#201B35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7257E8]/30"
            >
              <option value="">All Themes</option>
              <option value="AI">AI & Distributed Systems</option>
              <option value="Climate">Climate & Civic Infrastructure</option>
              <option value="FinTech">FinTech & Security</option>
              <option value="BioTech">BioTech & AI</option>
              <option value="Robotics">Robotics & Systems</option>
            </select>
          </div>
          <div className="md:col-span-3 flex items-center md:justify-end">
            <FilterChip active={openOnly} onClick={() => setOpenOnly((prev) => !prev)}>
              {openOnly ? 'Open Registration Only' : 'All Deadlines'}
            </FilterChip>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-88 rounded-2xl" />
          ))}
        </div>
      ) : hackathons.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-6 w-6" />}
          title="No hackathons match your filters"
          description="Reset your search or toggle deadline filters to view all available hackathons."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setSearch('');
                setTheme('');
                setOpenOnly(false);
              }}
            >
              Reset Filters
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hackathons.map((h) => (
            <Card key={h.id} interactive className="overflow-hidden flex flex-col">
              <div className="aspect-[16/9] w-full bg-[#F3F0FF] border-b border-[#ECE8F4] overflow-hidden">
                <img
                  src={getHackathonBanner(h)}
                  alt={h.name}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              </div>
              <CardContent className="p-6 flex-1 flex flex-col">
                <div className="flex items-center justify-between gap-2 text-xs text-[#77718C] mb-2">
                  <StatusBadge tone="violet">{h.theme}</StatusBadge>
                  <span className="font-mono tabular-nums">
                    {formatDeadline(h.registrationDeadline)}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-[#201B35]">{h.name}</h2>
                <p className="mt-2 text-sm text-[#77718C] flex-1 leading-relaxed">{h.description}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {h.requiredSkills.slice(0, 4).map((s) => (
                    <SkillTag key={s}>{s}</SkillTag>
                  ))}
                </div>
                <div className="mt-5 pt-4 border-t border-[#ECE8F4] flex items-center justify-between">
                  <span className="font-mono text-xs tabular-nums text-[#77718C]">
                    {h.minTeamSize}–{h.maxTeamSize} seats · {h.currentTeamCount} teams
                  </span>
                  <Button asChild size="sm" variant="secondary">
                    <Link to={`/hackathons/${h.id}`}>View Details</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function HackathonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['hackathon', id],
    queryFn: () => apiFetch<{ hackathon: Hackathon; teams: TeamDTO[] }>(`/api/hackathons/${id}`),
    enabled: Boolean(id),
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }

  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <EmptyState
          icon={<Calendar className="h-6 w-6" />}
          title="Hackathon not found"
          description="This event may have been removed or the URL is incorrect."
          action={
            <Button asChild variant="outline">
              <Link to="/hackathons">Back to Hackathons</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const { hackathon, teams } = data;

  return (
    <div className="space-y-8">
      <Link
        to="/hackathons"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#77718C] hover:text-[#201B35]"
      >
        <ArrowLeft className="h-4 w-4" />
        All Hackathons
      </Link>

      <Card className="overflow-hidden">
        <div className="aspect-[21/7] w-full bg-[#F3F0FF] border-b border-[#ECE8F4] overflow-hidden">
          <img
            src={getHackathonBanner(hackathon)}
            alt={hackathon.name}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        </div>
        <CardContent className="p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-3xl space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <StatusBadge tone="violet">{hackathon.theme}</StatusBadge>
              <StatusBadge tone="blue">
                <Calendar className="h-3 w-3" />
                {formatDeadline(hackathon.registrationDeadline)}
              </StatusBadge>
              <StatusBadge tone="neutral" className="font-mono tabular-nums">
                {hackathon.minTeamSize}–{hackathon.maxTeamSize} members
              </StatusBadge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#201B35]">
              {hackathon.name}
            </h1>
            <p className="text-sm sm:text-base text-[#77718C] leading-relaxed">
              {hackathon.description}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {hackathon.requiredSkills.map((sk) => (
                <SkillTag key={sk} matched>
                  {sk}
                </SkillTag>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
            <Button asChild size="lg">
              <Link to={`/teams/new?hackathonId=${hackathon.id}`}>Create Team Here</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/teams?hackathonId=${hackathon.id}`}>Filter Discover Teams</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-bold text-[#201B35]">Forming Teams ({teams.length})</h2>
        {teams.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="No active teams yet for this hackathon"
            description="Launch the first squad and invite teammates who match your stack."
            action={
              <Button asChild>
                <Link to={`/teams/new?hackathonId=${hackathon.id}`}>Create First Team</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {teams.map((team) => (
              <TeamCard key={team.id} team={team} currentUserId={user?.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
