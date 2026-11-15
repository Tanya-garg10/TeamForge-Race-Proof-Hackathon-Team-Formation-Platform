import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Compass, Plus, Radio, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { useSocket } from '@/src/context/SocketContext';
import { apiFetch, ApiError } from '@/src/lib/api';
import { Button } from '@/src/components/ui/button';
import { SearchField } from '@/src/components/ui/input';
import { Card, CardContent } from '@/src/components/ui/card';
import { FilterChip, StatusBadge } from '@/src/components/ui/badge';
import { TeamCard } from '@/src/components/TeamCard';
import { TeamCardSkeleton } from '@/src/components/ui/skeleton';
import { EmptyState } from '@/src/components/ui/empty-state';
import { Pagination } from '@/src/components/ui/pagination';
import type { Hackathon, TeamDTO } from '@/shared/types';

const POPULAR_SKILLS = ['TypeScript', 'React', 'Python', 'PostgreSQL', 'PyTorch', 'Docker', 'Go', 'UI/UX'];

export function TeamsBoardPage() {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [hackathonId, setHackathonId] = useState(searchParams.get('hackathonId') || '');
  const [skill, setSkill] = useState('');
  const [timezone, setTimezone] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [maxCapacity, setMaxCapacity] = useState('');
  const [hasOpenSeats, setHasOpenSeats] = useState(false);
  const [sort, setSort] = useState<'newest' | 'open_seats' | 'most_members'>('newest');
  const [page, setPage] = useState(1);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  useEffect(() => {
    const paramSearch = searchParams.get('search') || '';
    if (paramSearch !== search) setSearch(paramSearch);
    const paramHack = searchParams.get('hackathonId') || '';
    if (paramHack !== hackathonId) setHackathonId(paramHack);
  }, [searchParams]);

  useEffect(() => {
    if (!socket) return;
    socket.emit('subscribe:board');
    return () => {
      socket.emit('unsubscribe:board');
    };
  }, [socket]);

  const { data: hackathonsData } = useQuery({
    queryKey: ['hackathons', 'all-filter'],
    queryFn: () => apiFetch<{ items: Hackathon[] }>('/api/hackathons?limit=25'),
  });

  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (hackathonId) params.set('hackathonId', hackathonId);
  if (skill.trim()) params.set('skill', skill.trim());
  if (timezone.trim()) params.set('timezone', timezone.trim());
  if (experienceLevel) params.set('experienceLevel', experienceLevel);
  if (maxCapacity) params.set('maxCapacity', maxCapacity);
  if (hasOpenSeats) params.set('hasOpenSeats', 'true');
  params.set('sort', sort);
  params.set('page', String(page));
  params.set('limit', '12');

  const { data, isLoading } = useQuery({
    queryKey: [
      'teams',
      search,
      hackathonId,
      skill,
      timezone,
      experienceLevel,
      maxCapacity,
      hasOpenSeats,
      sort,
      page,
    ],
    queryFn: () =>
      apiFetch<{ items: TeamDTO[]; total: number; totalPages: number }>(`/api/teams?${params.toString()}`),
  });

  const joinMutation = useMutation({
    mutationFn: (teamId: string) => {
      setJoiningId(teamId);
      const idempotencyKey = `join-${teamId}-${crypto.randomUUID()}`;
      return apiFetch<{ team: TeamDTO }>(`/api/teams/${teamId}/join`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ idempotencyKey }),
      });
    },
    onSuccess: (res) => {
      toast.success(`Joined ${res.team.name} cleanly`);
      void queryClient.invalidateQueries({ queryKey: ['teams'] });
      void queryClient.invalidateQueries({ queryKey: ['my-teams'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Unable to claim seat');
    },
    onSettled: () => setJoiningId(null),
  });

  const resetFilters = () => {
    setSearch('');
    setHackathonId('');
    setSkill('');
    setTimezone('');
    setExperienceLevel('');
    setMaxCapacity('');
    setHasOpenSeats(false);
    setSort('newest');
    setPage(1);
    setSearchParams({});
  };

  const teams = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const hackathons = hackathonsData?.items ?? [];

  return (
    <div className="space-y-7">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <StatusBadge tone="violet">Team Marketplace</StatusBadge>
            <StatusBadge tone={isConnected ? 'success' : 'warning'}>
              <Radio className="h-3 w-3" />
              {isConnected ? 'Real-time seats live' : 'Syncing...'}
            </StatusBadge>
          </div>
          <h1 className="mt-2.5 text-3xl font-extrabold tracking-tight text-[#201B35]">
            Find Your People.
          </h1>
          <p className="mt-1 text-sm sm:text-base text-[#77718C]">
            Explore teams that match your skills and ambitions.
          </p>
        </div>

        <Button asChild>
          <Link to="/teams/new">
            <Plus className="h-4 w-4" />
            Launch a Team
          </Link>
        </Button>
      </div>

      {/* Top Search & Sort Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex-1 max-w-2xl">
          <SearchField
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            onClear={() => {
              setSearch('');
              setPage(1);
            }}
            placeholder="Search teams by project idea, squad name, or stack..."
            aria-label="Search teams"
            className="h-11"
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-xs tabular-nums text-[#77718C] whitespace-nowrap">
            {total.toLocaleString()} squads
          </span>
          <select
            aria-label="Sort teams"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as typeof sort);
              setPage(1);
            }}
            className="h-11 rounded-xl border border-[#ECE8F4] bg-white px-3.5 text-sm font-medium text-[#201B35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7257E8]/30"
          >
            <option value="newest">Sort: Newest</option>
            <option value="open_seats">Sort: Most Open Seats</option>
            <option value="most_members">Sort: Largest Roster</option>
          </select>
        </div>
      </div>

      {/* Filter Sidebar + Marketplace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        <Card className="lg:col-span-3 lg:sticky lg:top-24">
          <CardContent className="p-5 space-y-5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm font-bold text-[#201B35]">
                <SlidersHorizontal className="h-4 w-4 text-[#7257E8]" />
                Filters
              </span>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#77718C] hover:text-[#7257E8] cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#201B35]">Hackathon</label>
              <select
                value={hackathonId}
                onChange={(e) => {
                  setHackathonId(e.target.value);
                  setPage(1);
                }}
                className="h-10 w-full rounded-xl border border-[#ECE8F4] bg-[#FAF9FF] px-3 text-xs font-medium text-[#201B35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7257E8]/30"
              >
                <option value="">All Hackathons</option>
                {hackathons.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#201B35]">Required Skills</label>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_SKILLS.map((s) => (
                  <FilterChip
                    key={s}
                    active={skill.toLowerCase() === s.toLowerCase()}
                    onClick={() => {
                      setSkill((prev) => (prev.toLowerCase() === s.toLowerCase() ? '' : s));
                      setPage(1);
                    }}
                  >
                    {s}
                  </FilterChip>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#201B35]">Available Seats</label>
              <FilterChip
                active={hasOpenSeats}
                onClick={() => {
                  setHasOpenSeats((p) => !p);
                  setPage(1);
                }}
                className="w-full justify-center py-2"
              >
                {hasOpenSeats ? 'Only Open Teams Active' : 'Show Open Seats Only'}
              </FilterChip>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#201B35]">Team Capacity</label>
              <select
                value={maxCapacity}
                onChange={(e) => {
                  setMaxCapacity(e.target.value);
                  setPage(1);
                }}
                className="h-10 w-full rounded-xl border border-[#ECE8F4] bg-[#FAF9FF] px-3 text-xs font-medium text-[#201B35]"
              >
                <option value="">Any team size</option>
                <option value="3">Small squads (up to 3)</option>
                <option value="4">Standard squads (up to 4)</option>
                <option value="6">Large squads (up to 6)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#201B35]">Leader Experience</label>
              <select
                value={experienceLevel}
                onChange={(e) => {
                  setExperienceLevel(e.target.value);
                  setPage(1);
                }}
                className="h-10 w-full rounded-xl border border-[#ECE8F4] bg-[#FAF9FF] px-3 text-xs font-medium text-[#201B35]"
              >
                <option value="">Any experience level</option>
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
                <option value="EXPERT">Expert</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#201B35]">
                Time-Zone Compatibility
              </label>
              <select
                value={timezone}
                onChange={(e) => {
                  setTimezone(e.target.value);
                  setPage(1);
                }}
                className="h-10 w-full rounded-xl border border-[#ECE8F4] bg-[#FAF9FF] px-3 text-xs font-medium text-[#201B35]"
              >
                <option value="">All Time Zones</option>
                <option value="America/">Americas (UTC-8 to UTC-5)</option>
                <option value="Europe/">Europe (UTC+0 to UTC+2)</option>
                <option value="Asia/">Asia-Pacific (UTC+5:30 to UTC+9)</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-9 space-y-6">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[1, 2, 3, 4].map((i) => (
                <TeamCardSkeleton key={i} />
              ))}
            </div>
          ) : teams.length === 0 ? (
            <EmptyState
              icon={<Compass className="h-6 w-6" />}
              title="No matching teams found"
              description="Try clearing a skill or capacity filter, or create a brand-new team with the stack you want to build with."
              action={
                <>
                  <Button variant="outline" onClick={resetFilters}>
                    Clear All Filters
                  </Button>
                  <Button asChild>
                    <Link to="/teams/new">Create Team</Link>
                  </Button>
                </>
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {teams.map((team) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    currentUserId={user?.id}
                    highlightSkills={user?.skills ?? []}
                    isJoining={joiningId === team.id}
                    onJoin={(teamId) => joinMutation.mutate(teamId)}
                  />
                ))}
              </div>
              <Pagination
                page={page}
                totalPages={totalPages}
                totalItems={total}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
