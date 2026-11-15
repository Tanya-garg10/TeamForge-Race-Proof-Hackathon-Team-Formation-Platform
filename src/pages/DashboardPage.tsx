import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  Crown,
  Mail,
  Plus,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { apiFetch, ApiError } from '@/src/lib/api';
import { getHackathonBanner } from '@/src/lib/hackathonImages';
import { formatDeadline, formatRelativeTime } from '@/src/lib/utils';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Progress } from '@/src/components/ui/progress';
import { AvatarStack, UserAvatar } from '@/src/components/ui/avatar';
import { SkillTag, StatusBadge } from '@/src/components/ui/badge';
import { EmptyState } from '@/src/components/ui/empty-state';
import { Skeleton } from '@/src/components/ui/skeleton';
import type {
  AuditLogDTO,
  Hackathon,
  InvitationDTO,
  TeamDTO,
  TeammateRecommendation,
} from '@/shared/types';

export function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const { data: myTeamsData, isLoading: teamsLoading } = useQuery({
    queryKey: ['my-teams', user?.id],
    queryFn: () => apiFetch<{ items: TeamDTO[] }>('/api/users/me/teams'),
    enabled: Boolean(user),
  });

  const { data: invitesData } = useQuery({
    queryKey: ['my-invitations', user?.id],
    queryFn: () =>
      apiFetch<{ items: Array<InvitationDTO & { teamName: string; hackathonName: string }> }>(
        '/api/users/me/invitations',
      ),
    enabled: Boolean(user),
  });

  const { data: teammatesData, isLoading: teammatesLoading } = useQuery({
    queryKey: ['matching-teammates', user?.id],
    queryFn: () => apiFetch<{ items: TeammateRecommendation[] }>('/api/matching/teammates'),
    enabled: Boolean(user),
  });

  const { data: hackathonsData } = useQuery({
    queryKey: ['dashboard-hackathons'],
    queryFn: () => apiFetch<{ items: Hackathon[] }>('/api/hackathons?limit=3&openOnly=true'),
  });

  const { data: auditData } = useQuery({
    queryKey: ['audit-logs', 'dashboard'],
    queryFn: () => apiFetch<{ items: AuditLogDTO[] }>('/api/audit-logs?limit=6'),
  });

  const acceptInviteMutation = useMutation({
    mutationFn: (invId: string) =>
      apiFetch(`/api/invitations/direct/${invId}/accept`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Invitation accepted — you joined the team');
      void queryClient.invalidateQueries({ queryKey: ['my-teams'] });
      void queryClient.invalidateQueries({ queryKey: ['my-invitations'] });
      void queryClient.invalidateQueries({ queryKey: ['my-invitations-all'] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Unable to accept invite'),
  });

  if (authLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Skeleton className="lg:col-span-4 h-64 rounded-2xl" />
          <Skeleton className="lg:col-span-8 h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="Sign in to open your workspace"
          description="View your active hackathon teams, personalized teammate matches, pending invitations, and profile completion."
          action={
            <>
              <Button asChild>
                <Link to="/auth?redirect=/dashboard">Sign In</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/teams">Explore Open Teams</Link>
              </Button>
            </>
          }
        />
      </div>
    );
  }

  const firstName = user.name.split(' ')[0] || user.name;
  const myTeams = myTeamsData?.items ?? [];
  const pendingInvites = invitesData?.items ?? [];
  const teammates = teammatesData?.items ?? [];
  const hackathons = hackathonsData?.items ?? [];
  const recentActivity = auditData?.items ?? [];

  const profileChecks = [
    { label: 'Add a short engineering bio', done: Boolean(user.bio && user.bio.trim().length > 10) },
    { label: 'List at least 3 technical skills', done: user.skills.length >= 3 },
    { label: 'Select preferred hackathon roles', done: user.preferredRoles.length >= 1 },
    { label: 'Set timezone & weekly availability', done: Boolean(user.timezone && user.weeklyAvailability > 0) },
    { label: 'Link GitHub or portfolio URL', done: Boolean(user.githubUrl || user.portfolioUrl) },
  ];
  const completedChecks = profileChecks.filter((c) => c.done).length;
  const profileCompletionPct = Math.round((completedChecks / profileChecks.length) * 100);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <StatusBadge tone="violet">Workspace Overview</StatusBadge>
          <h1 className="mt-2.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#201B35]">
            Good morning, {firstName}
          </h1>
          <p className="mt-1 text-sm sm:text-base text-[#77718C]">
            Let&apos;s find the right people to build something amazing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button asChild variant="outline">
            <Link to="/teammates">
              <Sparkles className="h-4 w-4 text-[#7257E8]" />
              Find Teammates
            </Link>
          </Button>
          <Button asChild>
            <Link to="/teams/new">
              <Plus className="h-4 w-4" />
              Create Team
            </Link>
          </Button>
        </div>
      </div>

      {/* Pending Invitations Banner if any */}
      {pendingInvites.length > 0 && (
        <div className="rounded-2xl border border-[#DCD4FA] bg-[#F3F0FF] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#7257E8] text-white flex items-center justify-center shrink-0">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#201B35]">
                You have {pendingInvites.length} pending team invitation
                {pendingInvites.length > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-[#77718C] mt-0.5">
                {pendingInvites[0].inviterName || 'A team leader'} invited you to join{' '}
                <strong className="text-[#201B35]">{pendingInvites[0].teamName}</strong> (
                {pendingInvites[0].hackathonName}).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              isLoading={acceptInviteMutation.isPending}
              onClick={() => acceptInviteMutation.mutate(pendingInvites[0].id)}
            >
              Accept Invite
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/invitations">Review All</Link>
            </Button>
          </div>
        </div>
      )}

      {/* Top Row: A. Profile Completion + C. Active Team */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* A. Profile Completion Card */}
        <Card className="lg:col-span-5">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Profile Completion</CardTitle>
              <span className="font-mono text-sm font-bold tabular-nums text-[#7257E8]">
                {profileCompletionPct}%
              </span>
            </div>
            <CardDescription>
              Complete profiles earn higher-precision compatibility matches.
            </CardDescription>
            <Progress
              value={profileCompletionPct}
              tone={profileCompletionPct === 100 ? 'success' : 'violet'}
              className="mt-3"
            />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              {profileChecks.map((check) => (
                <div key={check.label} className="flex items-center gap-2.5 text-xs">
                  {check.done ? (
                    <CheckCircle2 className="h-4 w-4 text-[#16A477] shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-[#DCD4EE] shrink-0" />
                  )}
                  <span className={check.done ? 'text-[#201B35] font-medium' : 'text-[#77718C]'}>
                    {check.label}
                  </span>
                </div>
              ))}
            </div>
            <div className="pt-2">
              <Button asChild variant="secondary" size="sm" className="w-full">
                <Link to="/profile">
                  {profileCompletionPct === 100 ? 'Edit Builder Profile' : 'Complete Your Profile'}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* C. Active Team Card */}
        <Card className="lg:col-span-7">
          <CardHeader className="pb-4 flex flex-row items-center justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="text-base">Active Team</CardTitle>
              <CardDescription>Your current hackathon memberships and open seats.</CardDescription>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link to="/my-team">
                Open My Team
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {teamsLoading ? (
              <Skeleton className="h-40 w-full rounded-xl" />
            ) : myTeams.length === 0 ? (
              <EmptyState
                icon={<Users className="h-5 w-5" />}
                title="You haven't joined a team yet"
                description="Browse teams looking for your skills or start your own squad for an upcoming hackathon."
                action={
                  <>
                    <Button asChild size="sm">
                      <Link to="/teams">Discover Teams</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/teams/new">Create Team</Link>
                    </Button>
                  </>
                }
                className="py-8"
              />
            ) : (
              <div className="space-y-3">
                {myTeams.slice(0, 2).map((team) => {
                  const isLeader = team.leaderId === user.id;
                  const fillPct = Math.round((team.memberCount / Math.max(1, team.maxSize)) * 100);
                  return (
                    <div
                      key={team.id}
                      className="rounded-xl border border-[#ECE8F4] bg-[#FAF9FF] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-2 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`/teams/${team.id}`}
                            className="text-sm font-bold text-[#201B35] hover:text-[#7257E8] truncate"
                          >
                            {team.name}
                          </Link>
                          {isLeader && (
                            <StatusBadge tone="violet">
                              <Crown className="h-3 w-3" />
                              Leader
                            </StatusBadge>
                          )}
                          <StatusBadge tone={team.openSeats > 0 ? 'blue' : 'success'}>
                            {team.openSeats > 0 ? `${team.openSeats} open` : 'Roster full'}
                          </StatusBadge>
                        </div>
                        <p className="text-xs text-[#77718C]">{team.hackathonName}</p>
                        <div className="flex items-center gap-3 pt-1">
                          <AvatarStack
                            members={(team.members ?? []).map((m) => ({
                              name: m.user.name,
                              avatarUrl: m.user.avatarUrl,
                            }))}
                            size="xs"
                          />
                          <div className="flex-1 max-w-[160px]">
                            <Progress value={fillPct} className="h-1.5" />
                          </div>
                          <span className="font-mono text-xs tabular-nums text-[#77718C]">
                            {team.memberCount}/{team.maxSize}
                          </span>
                        </div>
                      </div>
                      <Button asChild size="sm" variant="secondary" className="shrink-0">
                        <Link to={`/teams/${team.id}`}>Manage</Link>
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* B. Recommended Teammates */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#201B35]">Recommended Teammates</h2>
            <p className="text-xs text-[#77718C] mt-0.5">
              Scored deterministically across skill overlap, timezone proximity, and weekly hours.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/teammates">
              See All Matches
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {teammatesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {teammates.slice(0, 3).map(({ user: cand, match }) => (
              <Card key={cand.id} interactive>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar name={cand.name} avatarUrl={cand.avatarUrl} size="md" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#201B35] truncate">{cand.name}</p>
                        <p className="text-xs text-[#77718C] truncate">
                          {cand.preferredRoles[0] || cand.experienceLevel}
                        </p>
                      </div>
                    </div>
                    <StatusBadge tone="violet" className="font-mono tabular-nums">
                      {match.overallScore}% match
                    </StatusBadge>
                  </div>

                  <p className="text-xs text-[#77718C] line-clamp-2 leading-relaxed">
                    {match.explanation}
                  </p>

                  <div className="flex flex-wrap gap-1.5">
                    {cand.skills.slice(0, 4).map((s) => (
                      <SkillTag
                        key={s}
                        matched={match.complementarySkills.includes(s) || match.matchingSkills.includes(s)}
                      >
                        {s}
                      </SkillTag>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-[#ECE8F4] flex items-center justify-between text-xs text-[#77718C]">
                    <span>{cand.timezone}</span>
                    <Link
                      to="/teammates"
                      className="font-semibold text-[#7257E8] hover:text-[#4338A8]"
                    >
                      Inspect breakdown →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Bottom Row: D. Upcoming Hackathons + E. Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* D. Upcoming Hackathons */}
        <Card className="lg:col-span-7">
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="text-base">Upcoming Hackathons</CardTitle>
              <CardDescription>Open registration sprints accepting new teams.</CardDescription>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link to="/hackathons">Browse All</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {hackathons.map((h) => (
              <Link
                key={h.id}
                to={`/hackathons/${h.id}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#ECE8F4] bg-[#FAF9FF] p-4 hover:border-[#D5CCF2] hover:bg-white transition-all"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <img
                    src={getHackathonBanner(h)}
                    alt={h.name}
                    referrerPolicy="no-referrer"
                    className="h-12 w-20 rounded-lg object-cover border border-[#ECE8F4] shrink-0"
                  />
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#201B35] truncate">{h.name}</span>
                    </div>
                    <p className="text-xs text-[#77718C]">
                      {h.theme} · {formatDeadline(h.registrationDeadline)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-xs tabular-nums text-[#4338A8] font-semibold">
                    {h.currentTeamCount} teams
                  </span>
                  <ArrowRight className="h-4 w-4 text-[#77718C]" />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* E. Recent Activity */}
        <Card className="lg:col-span-5">
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#7257E8]" />
              <CardTitle className="text-base">Recent Activity</CardTitle>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link to="/activity">All Logs</Link>
            </Button>
          </CardHeader>
          <CardContent className="divide-y divide-[#ECE8F4]/70">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-[#77718C] py-6 text-center">No recent events recorded.</p>
            ) : (
              recentActivity.map((log) => (
                <div key={log.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#201B35]">{log.actionType}</span>
                    <span className="font-mono text-[11px] tabular-nums text-[#77718C]">
                      {formatRelativeTime(log.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[#77718C]">
                    Actor: {log.actorName || log.actorUserId}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
