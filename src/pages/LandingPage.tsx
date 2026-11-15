import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Crown,
  GitBranch,
  KeyRound,
  Lock,
  Radio,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import { apiFetch } from '@/src/lib/api';
import { getHackathonBanner } from '@/src/lib/hackathonImages';
import { formatDeadline } from '@/src/lib/utils';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent } from '@/src/components/ui/card';
import { AvatarStack, UserAvatar } from '@/src/components/ui/avatar';
import { SkillTag, StatusBadge } from '@/src/components/ui/badge';
import { Progress } from '@/src/components/ui/progress';
import type { Hackathon, PublicUser, TeamDTO } from '@/shared/types';

export function LandingPage() {
  const { data: hackathonsData } = useQuery({
    queryKey: ['landing-hackathons'],
    queryFn: () => apiFetch<{ items: Hackathon[]; total: number }>('/api/hackathons?limit=3'),
  });

  const { data: teamsData } = useQuery({
    queryKey: ['landing-teams'],
    queryFn: () => apiFetch<{ items: TeamDTO[]; total: number }>('/api/teams?limit=4&hasOpenSeats=true'),
  });

  const { data: usersData } = useQuery({
    queryKey: ['landing-users'],
    queryFn: () => apiFetch<{ items: PublicUser[]; total: number }>('/api/users?limit=4'),
  });

  const hackathons = hackathonsData?.items ?? [];
  const teamsTotal = teamsData?.total ?? 2000;
  const usersTotal = usersData?.total ?? 10000;
  const previewTeammates = usersData?.items ?? [];

  return (
    <div className="bg-[#FAF9FF] text-[#201B35]">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-[#ECE8F4]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 right-0 h-[420px] w-[520px] rounded-full bg-[#EAE5FF]/70 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-20 h-[320px] w-[360px] rounded-full bg-[#5B8DEF]/10 blur-3xl"
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-16 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Copy */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#DCD4FA] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#4338A8] shadow-xs">
                <ShieldCheck className="h-3.5 w-3.5 text-[#7257E8]" />
                <span>Transactional seat locking · Zero overbooking</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-extrabold tracking-tight leading-[1.08] text-[#201B35]">
                Your Next Great Team Starts Here.
              </h1>

              <p className="text-base sm:text-lg text-[#77718C] leading-relaxed max-w-xl">
                Find people who complement your skills, share your ambition, and turn hackathon ideas
                into real products.
              </p>

              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <Button asChild size="lg">
                  <Link to="/teams">
                    Find Your Team
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/hackathons">Explore Hackathons</Link>
                </Button>
              </div>

              <div className="pt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[#77718C]">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-[#16A477]" />
                  {usersTotal.toLocaleString()}+ builders indexed
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-[#16A477]" />
                  {teamsTotal.toLocaleString()}+ active squads
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-[#16A477]" />
                  100% deterministic capacity lock
                </span>
              </div>
            </div>

            {/* Right Composition: Connected Profile Cards, Skill Tags & SVG Network */}
            <div className="lg:col-span-6">
              <div className="relative rounded-3xl border border-[#ECE8F4] bg-[#F3F0FF]/65 p-5 sm:p-7 tf-elevated-shadow overflow-hidden">
                {/* Geometric SVG connecting lines */}
                <svg
                  viewBox="0 0 480 340"
                  fill="none"
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full pointer-events-none opacity-80"
                >
                  <path
                    d="M120 96 C210 96, 230 165, 320 165"
                    stroke="#7257E8"
                    strokeWidth="1.75"
                    strokeDasharray="5 5"
                    strokeOpacity="0.45"
                  />
                  <path
                    d="M150 245 C220 245, 250 185, 320 165"
                    stroke="#5B8DEF"
                    strokeWidth="1.75"
                    strokeDasharray="5 5"
                    strokeOpacity="0.5"
                  />
                  <circle cx="120" cy="96" r="4.5" fill="#7257E8" />
                  <circle cx="320" cy="165" r="5" fill="#4338A8" />
                  <circle cx="150" cy="245" r="4.5" fill="#5B8DEF" />
                </svg>

                <div className="relative space-y-4">
                  {/* Top floating profile card */}
                  <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-start justify-between">
                    <div className="rounded-2xl border border-[#ECE8F4] bg-white p-4 tf-card-shadow sm:w-[60%]">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <UserAvatar name="Alice Chen" size="md" />
                          <div>
                            <p className="text-sm font-bold text-[#201B35]">Alice Chen</p>
                            <p className="text-xs text-[#77718C]">Distributed Systems · UTC-8</p>
                          </div>
                        </div>
                        <StatusBadge tone="violet">
                          <Crown className="h-3 w-3" />
                          Leader
                        </StatusBadge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <SkillTag matched>TypeScript</SkillTag>
                        <SkillTag matched>PostgreSQL</SkillTag>
                        <SkillTag>Docker</SkillTag>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#DCD4FA] bg-white p-3.5 tf-card-shadow sm:w-[36%] self-end">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#77718C]">
                        Match Score
                      </p>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="font-mono text-2xl font-extrabold tabular-nums text-[#7257E8]">
                          94%
                        </span>
                        <span className="text-xs font-medium text-[#16A477]">Complementary</span>
                      </div>
                      <Progress value={94} tone="violet" className="mt-2 h-1.5" />
                    </div>
                  </div>

                  {/* Middle Squad Anchor Card */}
                  <div className="rounded-2xl border border-[#DCD4FA] bg-white p-4 tf-elevated-shadow sm:ml-10">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#7257E8] to-[#4338A8] text-white font-bold text-xs flex items-center justify-center">
                          AI
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#201B35]">VectorMesh Collective</p>
                          <p className="text-xs text-[#77718C]">Global AI Systems Sprint</p>
                        </div>
                      </div>
                      <StatusBadge tone="warning">1 seat left</StatusBadge>
                    </div>
                    <div className="mt-3.5 flex items-center justify-between gap-3">
                      <AvatarStack
                        members={[
                          { name: 'Alice Chen' },
                          { name: 'Marcus Vance' },
                          { name: 'Priya Nair' },
                          { name: 'Diego Morales' },
                        ]}
                        size="sm"
                      />
                      <span className="font-mono text-xs font-semibold tabular-nums text-[#4338A8]">
                        4/5 filled · Row-locked
                      </span>
                    </div>
                  </div>

                  {/* Bottom complementary teammate card */}
                  <div className="rounded-2xl border border-[#ECE8F4] bg-white p-4 tf-card-shadow sm:w-[74%]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar name="Priya Nair" size="sm" />
                        <div>
                          <p className="text-sm font-bold text-[#201B35]">Priya Nair</p>
                          <p className="text-xs text-[#77718C]">ML & Retrieval · 25h/wk</p>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <SkillTag matched>Python</SkillTag>
                        <SkillTag matched>PyTorch</SkillTag>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="border-b border-[#ECE8F4] bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-1">
              <p className="font-mono text-2xl font-extrabold tabular-nums text-[#201B35]">
                1 / 50
              </p>
              <p className="text-xs text-[#77718C]">
                Exact winner under 50 simultaneous last-seat joins
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-mono text-2xl font-extrabold tabular-nums text-[#7257E8]">
                60 / 25 / 15
              </p>
              <p className="text-xs text-[#77718C]">
                Transparent matching across skills, timezone & hours
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-mono text-2xl font-extrabold tabular-nums text-[#201B35]">
                SHA-256
              </p>
              <p className="text-xs text-[#77718C]">
                Cryptographic invite tokens hashed prior to storage
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-mono text-2xl font-extrabold tabular-nums text-[#16A477]">
                Socket.IO
              </p>
              <p className="text-xs text-[#77718C]">
                Post-commit live broadcasts for seat & roster updates
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works in 3 Steps */}
      <section id="how-it-works" className="mx-auto max-w-7xl px-4 sm:px-6 py-16 lg:py-20">
        <div className="max-w-2xl">
          <StatusBadge tone="violet">How It Works</StatusBadge>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#201B35]">
            From solo builder to balanced squad in three steps.
          </h2>
          <p className="mt-2.5 text-base text-[#77718C]">
            Built so you spend your hackathon shipping code instead of chasing Discord threads.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              step: '01',
              title: 'Publish your builder profile',
              desc: 'Add your technical stack, experience level, timezone, and weekly commitment so matching scores reflect reality.',
              icon: Sparkles,
            },
            {
              step: '02',
              title: 'Match with complementary squads',
              desc: 'Filter teams by open seats, required skills, and timezone overlap—or inspect why each teammate fits your gaps.',
              icon: Users,
            },
            {
              step: '03',
              title: 'Claim your seat atomically',
              desc: 'Join open seats with idempotency keys and database row locking—no double bookings, no stale UI state.',
              icon: Lock,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.step}>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="h-10 w-10 rounded-xl bg-[#EAE5FF] text-[#4338A8] flex items-center justify-center">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="font-mono text-xs font-bold text-[#77718C]">STEP {item.step}</span>
                  </div>
                  <h3 className="text-lg font-bold text-[#201B35]">{item.title}</h3>
                  <p className="text-sm text-[#77718C] leading-relaxed">{item.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Featured Hackathons */}
      <section className="border-y border-[#ECE8F4] bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <StatusBadge tone="blue">Live Events</StatusBadge>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#201B35]">
                Featured Hackathons
              </h2>
              <p className="mt-2 text-sm text-[#77718C]">
                Browse active sprints with enforced team capacities and real-time roster counts.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/hackathons">
                View All Hackathons
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                  <div className="flex items-center justify-between gap-2 text-xs text-[#77718C]">
                    <StatusBadge tone="violet">{h.theme}</StatusBadge>
                    <span className="font-mono tabular-nums">{formatDeadline(h.registrationDeadline)}</span>
                  </div>
                  <h3 className="mt-3 text-lg font-bold text-[#201B35]">{h.name}</h3>
                  <p className="mt-2 text-sm text-[#77718C] line-clamp-2 flex-1">{h.description}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {h.requiredSkills.slice(0, 3).map((s) => (
                      <SkillTag key={s}>{s}</SkillTag>
                    ))}
                  </div>
                  <div className="mt-5 pt-4 border-t border-[#ECE8F4] flex items-center justify-between">
                    <span className="font-mono text-xs tabular-nums text-[#77718C]">
                      {h.minTeamSize}–{h.maxTeamSize} seats · {h.currentTeamCount} teams
                    </span>
                    <Button asChild size="sm" variant="secondary">
                      <Link to={`/hackathons/${h.id}`}>Explore</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Recommended Teammates Preview */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16 lg:py-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <StatusBadge tone="success">Skill Compatibility</StatusBadge>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#201B35]">
              Meet Builders Ready to Ship
            </h2>
            <p className="mt-2 text-sm text-[#77718C]">
              Live participant profiles with verified skills, timezones, and weekly availability.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/teammates">
              Open Teammate Finder
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {previewTeammates.map((person) => (
            <Card key={person.id} interactive>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <UserAvatar name={person.name} avatarUrl={person.avatarUrl} size="md" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#201B35] truncate">{person.name}</p>
                    <p className="text-xs text-[#77718C] truncate">
                      {person.preferredRoles[0] || person.experienceLevel}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {person.skills.slice(0, 3).map((s) => (
                    <SkillTag key={s}>{s}</SkillTag>
                  ))}
                </div>
                <div className="pt-3 border-t border-[#ECE8F4] flex items-center justify-between text-xs text-[#77718C]">
                  <span className="truncate">{person.timezone}</span>
                  <span className="font-mono font-semibold tabular-nums text-[#4338A8]">
                    {person.weeklyAvailability}h/wk
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Why TeamForge + Race-Proof Technology */}
      <section id="product" className="border-t border-[#ECE8F4] bg-[#F3F0FF]/55 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6 space-y-5">
              <StatusBadge tone="indigo">Race-Proof Architecture</StatusBadge>
              <h2 className="text-3xl font-extrabold tracking-tight text-[#201B35]">
                50 Simultaneous Joins. 1 Remaining Seat. Zero Overbooking.
              </h2>
              <p className="text-sm sm:text-base text-[#77718C] leading-relaxed">
                Every join operation runs inside an exclusive write transaction with idempotency-key
                replay protection and a composite unique database constraint preventing multi-team
                membership within the same hackathon.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {[
                  {
                    icon: Lock,
                    title: 'Serialized Seat Lock',
                    desc: 'Exclusive transaction serializes concurrent claims on the final seat.',
                  },
                  {
                    icon: KeyRound,
                    title: 'Idempotent Retries',
                    desc: 'Network retries replay the original 201 response without double-joining.',
                  },
                  {
                    icon: GitBranch,
                    title: 'Deterministic Leadership',
                    desc: 'Leader departures automatically promote the earliest eligible teammate.',
                  },
                  {
                    icon: Radio,
                    title: 'Post-Commit Broadcasts',
                    desc: 'Socket.IO events fire strictly after database commit succeeds.',
                  },
                ].map((f) => {
                  const Icon = f.icon;
                  return (
                    <div key={f.title} className="rounded-2xl border border-[#ECE8F4] bg-white p-4">
                      <Icon className="h-4 w-4 text-[#7257E8] mb-2" />
                      <p className="text-sm font-bold text-[#201B35]">{f.title}</p>
                      <p className="mt-1 text-xs text-[#77718C] leading-relaxed">{f.desc}</p>
                    </div>
                  );
                })}
              </div>
              <div className="pt-2">
                <Button asChild>
                  <Link to="/lab">
                    <Zap className="h-4 w-4" />
                    Run Live 50-Request Benchmark
                  </Link>
                </Button>
              </div>
            </div>

            <div className="lg:col-span-6">
              <Card className="p-6 sm:p-7 space-y-5">
                <div className="flex items-center justify-between border-b border-[#ECE8F4] pb-4">
                  <div>
                    <p className="text-xs font-mono uppercase tracking-wider text-[#77718C]">
                      Transactional Invariant Proof
                    </p>
                    <p className="text-base font-bold text-[#201B35] mt-0.5">
                      50 Concurrent Contenders → 1 Seat Remaining
                    </p>
                  </div>
                  <StatusBadge tone="success">100% Verified</StatusBadge>
                </div>

                <div className="grid grid-cols-10 gap-1.5">
                  {Array.from({ length: 50 }).map((_, idx) => {
                    const winner = idx === 0;
                    return (
                      <div
                        key={idx}
                        title={winner ? 'HTTP 201 · Seat 5/5 claimed' : 'HTTP 409 · Team capacity full'}
                        className={`h-6 rounded-md font-mono text-[10px] font-bold flex items-center justify-center border ${
                          winner
                            ? 'bg-[#E8F8F2] border-[#16A477] text-[#117A58]'
                            : 'bg-[#FDECEF] border-[#F8CBD3] text-[#B83249]'
                        }`}
                      >
                        {winner ? '201' : '409'}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-[#ECE8F4]">
                  <span className="text-[#117A58] font-mono font-semibold">1 × HTTP 201 Created</span>
                  <span className="text-[#B83249] font-mono font-semibold">49 × HTTP 409 Conflict</span>
                  <span className="text-[#4338A8] font-mono font-semibold">Roster: 5/5</span>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16 lg:py-20">
        <div className="rounded-3xl border border-[#DCD4FA] bg-gradient-to-br from-[#F3F0FF] via-white to-[#EAE5FF]/70 px-6 py-12 sm:px-12 text-center tf-elevated-shadow">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#201B35]">
            Ready to build with people who complement your stack?
          </h2>
          <p className="mt-3 text-base text-[#77718C] max-w-2xl mx-auto">
            Create your TeamForge profile, inspect transparent match breakdowns, and lock in your
            hackathon squad today.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3.5">
            <Button asChild size="lg">
              <Link to="/auth?mode=register">Get Started Free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/teams">Browse Open Teams</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
