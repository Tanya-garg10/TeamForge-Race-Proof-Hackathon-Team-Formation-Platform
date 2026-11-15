import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Crown,
  History,
  KeyRound,
  LogOut,
  Plus,
  Radio,
  ShieldAlert,
  Target,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { useSocket } from '@/src/context/SocketContext';
import { apiFetch, ApiError } from '@/src/lib/api';
import { formatRelativeTime } from '@/src/lib/utils';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { UserAvatar } from '@/src/components/ui/avatar';
import { SkillTag, StatusBadge } from '@/src/components/ui/badge';
import { Progress } from '@/src/components/ui/progress';
import { EmptyState } from '@/src/components/ui/empty-state';
import { ConfirmDialog } from '@/src/components/ui/confirm-dialog';
import { Skeleton } from '@/src/components/ui/skeleton';
import type { AuditLogDTO, InvitationDTO, JoinRequestDTO, TeamDTO } from '@/shared/types';

export function MyTeamPage() {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const queryClient = useQueryClient();
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);

  const { data: myTeamsData, isLoading } = useQuery({
    queryKey: ['my-teams', user?.id],
    queryFn: () => apiFetch<{ items: TeamDTO[] }>('/api/users/me/teams'),
    enabled: Boolean(user),
  });

  const teams = myTeamsData?.items ?? [];
  const activeTeam = teams.find((t) => t.id === selectedTeamId) ?? teams[0];
  const isLeader = Boolean(user && activeTeam && activeTeam.leaderId === user.id);

  useEffect(() => {
    if (!socket || !activeTeam?.id) return;
    socket.emit('subscribe:team', activeTeam.id);
    return () => {
      socket.emit('unsubscribe:team', activeTeam.id);
    };
  }, [socket, activeTeam?.id]);

  const { data: invitationsData } = useQuery({
    queryKey: ['team-invitations', activeTeam?.id],
    queryFn: () => apiFetch<{ items: InvitationDTO[] }>(`/api/teams/${activeTeam!.id}/invitations`),
    enabled: Boolean(activeTeam?.id && isLeader),
  });

  const { data: joinRequestsData } = useQuery({
    queryKey: ['team-join-requests', activeTeam?.id],
    queryFn: () => apiFetch<{ items: JoinRequestDTO[] }>(`/api/join-requests?teamId=${activeTeam!.id}`),
    enabled: Boolean(activeTeam?.id && isLeader),
  });

  const { data: auditData } = useQuery({
    queryKey: ['audit-logs', 'team', activeTeam?.id],
    queryFn: () => apiFetch<{ items: AuditLogDTO[] }>(`/api/audit-logs?teamId=${activeTeam!.id}&limit=10`),
    enabled: Boolean(activeTeam?.id),
  });

  const leaveMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ deletedTeam: boolean; newLeaderId: string | null }>(
        `/api/teams/${activeTeam!.id}/leave`,
        { method: 'POST' },
      ),
    onSuccess: (res) => {
      setLeaveConfirmOpen(false);
      toast.success(
        res.deletedTeam
          ? 'Last member left — team archived cleanly'
          : res.newLeaderId
            ? 'Left team and transferred leadership deterministically'
            : 'Left team cleanly',
      );
      void queryClient.invalidateQueries({ queryKey: ['my-teams'] });
      void queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Unable to leave team'),
  });

  const reviewRequestMutation = useMutation({
    mutationFn: ({ reqId, action }: { reqId: string; action: 'accept' | 'reject' }) =>
      apiFetch(`/api/join-requests/${reqId}/${action}`, { method: 'POST' }),
    onSuccess: (_, vars) => {
      toast.success(vars.action === 'accept' ? 'Applicant added to squad' : 'Request declined');
      void queryClient.invalidateQueries({ queryKey: ['my-teams'] });
      void queryClient.invalidateQueries({ queryKey: ['team-join-requests', activeTeam?.id] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Review failed'),
  });

  if (!user) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="Sign in to view your team workspace"
          description="Manage your roster, track skill coverage, review join requests, and monitor real-time seat activity."
          action={
            <Button asChild>
              <Link to="/auth?redirect=/my-team">Sign In</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }

  if (!activeTeam) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No active team membership yet"
          description="Join an open hackathon team or launch a new squad in 6 guided steps."
          action={
            <>
              <Button asChild>
                <Link to="/teams">Discover Open Teams</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/teams/new">
                  <Plus className="h-4 w-4" />
                  Create Team
                </Link>
              </Button>
            </>
          }
        />
      </div>
    );
  }

  const members = activeTeam.members ?? [];
  const memberSkills = new Set(members.flatMap((m) => m.user.skills.map((s) => s.toLowerCase())));
  const coveredCount = activeTeam.requiredSkills.filter((s) =>
    memberSkills.has(s.toLowerCase()),
  ).length;
  const skillCoveragePct = activeTeam.requiredSkills.length
    ? Math.round((coveredCount / activeTeam.requiredSkills.length) * 100)
    : 100;
  const fillPct = Math.round((activeTeam.memberCount / Math.max(1, activeTeam.maxSize)) * 100);
  const pendingRequests = (joinRequestsData?.items ?? []).filter((r) => r.status === 'PENDING');
  const activeInvites = (invitationsData?.items ?? []).filter((i) => i.status === 'ACTIVE');
  const logs = auditData?.items ?? [];

  return (
    <div className="space-y-7">
      {/* Header + Team Switcher */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="violet">Team Workspace</StatusBadge>
            <StatusBadge tone={isConnected ? 'success' : 'warning'}>
              <Radio className="h-3 w-3" />
              {isConnected ? 'Socket.IO synced' : 'Reconnecting'}
            </StatusBadge>
          </div>
          <h1 className="mt-2.5 text-3xl font-extrabold tracking-tight text-[#201B35]">
            {activeTeam.name}
          </h1>
          <p className="mt-1 text-sm text-[#77718C]">{activeTeam.hackathonName}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {teams.length > 1 && (
            <select
              aria-label="Select active team"
              value={activeTeam.id}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="h-10 rounded-xl border border-[#ECE8F4] bg-white px-3 text-sm font-semibold text-[#201B35]"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.memberCount}/{t.maxSize})
                </option>
              ))}
            </select>
          )}
          <Button asChild variant="outline">
            <Link to={`/teams/${activeTeam.id}`}>
              Full Team Page
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="outline"
            className="text-[#E15B70] border-[#F8CBD3] hover:bg-[#FDECEF]"
            onClick={() => setLeaveConfirmOpen(true)}
          >
            <LogOut className="h-4 w-4" />
            Leave Team
          </Button>
        </div>
      </div>

      {/* Leadership Transfer Notice */}
      {isLeader && (
        <div className="rounded-2xl border border-[#DCD4FA] bg-[#F3F0FF] p-4 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-[#4338A8] shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-[#201B35]">
            <span className="font-bold">Leadership Protection Active:</span> You are the squad
            leader. If you leave while teammates remain, leadership transfers deterministically to
            the earliest-joined member—and if you are the last member, the team archives safely.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
        <div className="lg:col-span-7 space-y-6">
          {/* Member Roster */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Member Roster</CardTitle>
                  <CardDescription>
                    {activeTeam.memberCount} of {activeTeam.maxSize} seats filled ·{' '}
                    {activeTeam.openSeats} open position{activeTeam.openSeats === 1 ? '' : 's'}
                  </CardDescription>
                </div>
                <span className="font-mono text-sm font-bold tabular-nums text-[#7257E8]">
                  {fillPct}%
                </span>
              </div>
              <Progress value={fillPct} className="mt-3" />
            </CardHeader>
            <CardContent className="space-y-3">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl border border-[#ECE8F4] bg-[#FAF9FF] p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar name={m.user.name} avatarUrl={m.user.avatarUrl} size="md" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-[#201B35] truncate">
                          {m.user.name}
                        </span>
                        {m.role === 'LEADER' && (
                          <StatusBadge tone="indigo">
                            <Crown className="h-3 w-3" />
                            Leader
                          </StatusBadge>
                        )}
                      </div>
                      <p className="text-xs text-[#77718C] mt-0.5">
                        {m.user.timezone} · {m.user.weeklyAvailability}h/wk ·{' '}
                        {m.user.skills.slice(0, 3).join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Skill Coverage Matrix */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-[#7257E8]" />
                  <CardTitle className="text-base">Skill Coverage Matrix</CardTitle>
                </div>
                <span className="font-mono text-xs font-bold tabular-nums text-[#16A477]">
                  {skillCoveragePct}% covered
                </span>
              </div>
              <CardDescription>
                Required hackathon skills matched against your active squad roster.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {activeTeam.requiredSkills.map((sk) => {
                  const covered = memberSkills.has(sk.toLowerCase());
                  return (
                    <div
                      key={sk}
                      className={`rounded-xl border px-3.5 py-2.5 flex items-center justify-between text-xs ${
                        covered
                          ? 'bg-[#E8F8F2]/60 border-[#C7EEDF] text-[#117A58]'
                          : 'bg-[#FAF9FF] border-[#ECE8F4] text-[#77718C]'
                      }`}
                    >
                      <span className="font-semibold">{sk}</span>
                      {covered ? (
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Covered
                        </span>
                      ) : (
                        <span className="font-medium text-[#A86D14]">Needed</span>
                      )}
                    </div>
                  );
                })}
              </div>
              {activeTeam.openSeats > 0 && (
                <div className="pt-2 flex items-center justify-between text-xs text-[#77718C]">
                  <span>Need someone to cover remaining skills?</span>
                  <Link
                    to="/teammates"
                    className="font-semibold text-[#7257E8] hover:text-[#4338A8]"
                  >
                    Find matching teammates →
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Leader Requests/Invitations + Team Activity */}
        <div className="lg:col-span-5 space-y-6">
          {isLeader && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">Join Requests & Invitations</CardTitle>
                  <CardDescription>
                    {pendingRequests.length} pending requests · {activeInvites.length} active links
                  </CardDescription>
                </div>
                <Button asChild size="sm" variant="secondary">
                  <Link to={`/teams/${activeTeam.id}`}>
                    <KeyRound className="h-3.5 w-3.5" />
                    Invite
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingRequests.length === 0 ? (
                  <p className="text-xs text-[#77718C]">
                    No pending join requests. Use the team page to generate SHA-256 invite links.
                  </p>
                ) : (
                  pendingRequests.map((jr) => (
                    <div
                      key={jr.id}
                      className="rounded-xl border border-[#ECE8F4] bg-[#FAF9FF] p-3.5 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-[#201B35]">
                          {jr.user?.name || jr.userId}
                        </span>
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => reviewRequestMutation.mutate({ reqId: jr.id, action: 'accept' })}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => reviewRequestMutation.mutate({ reqId: jr.id, action: 'reject' })}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      {jr.user?.skills && (
                        <div className="flex flex-wrap gap-1">
                          {jr.user.skills.slice(0, 3).map((s) => (
                            <SkillTag key={s}>{s}</SkillTag>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-[#7257E8]" />
                <CardTitle className="text-base">Team Activity</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-[#ECE8F4]">
              {logs.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-[#77718C]">No activity entries yet.</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="px-6 py-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#201B35]">{log.actionType}</span>
                      <span className="font-mono text-[11px] tabular-nums text-[#77718C]">
                        {formatRelativeTime(log.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[#77718C]">
                      By {log.actorName || log.actorUserId}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={leaveConfirmOpen}
        onOpenChange={setLeaveConfirmOpen}
        title={`Leave ${activeTeam.name}?`}
        description={
          isLeader
            ? activeTeam.memberCount <= 1
              ? 'You are the final member. Leaving will safely delete this team and its dependent records.'
              : 'Leadership will transfer deterministically to the earliest-joined remaining teammate.'
            : 'Your seat will open immediately for other participants.'
        }
        confirmLabel="Confirm Leave"
        destructive
        isLoading={leaveMutation.isPending}
        onConfirm={() => leaveMutation.mutate()}
      />
    </div>
  );
}
