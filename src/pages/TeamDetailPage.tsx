import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Check,
  Copy,
  Crown,
  History,
  KeyRound,
  Send,
  Sparkles,
  Target,
  Trash2,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { useSocket } from '@/src/context/SocketContext';
import { apiFetch, ApiError } from '@/src/lib/api';
import { formatRelativeTime } from '@/src/lib/utils';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { UserAvatar } from '@/src/components/ui/avatar';
import { SkillTag, StatusBadge } from '@/src/components/ui/badge';
import { Progress } from '@/src/components/ui/progress';
import { ConfirmDialog } from '@/src/components/ui/confirm-dialog';
import { Skeleton } from '@/src/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/components/ui/dialog';
import type {
  AuditLogDTO,
  InvitationDTO,
  JoinRequestDTO,
  TeammateRecommendation,
  TeamDTO,
} from '@/shared/types';

export function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMaxUses, setInviteMaxUses] = useState(1);
  const [createdInviteLink, setCreatedInviteLink] = useState<string | null>(null);
  const [joinRequestMsg, setJoinRequestMsg] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editMaxSize, setEditMaxSize] = useState(4);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [kickMemberTarget, setKickMemberTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!socket || !id) return;
    socket.emit('subscribe:team', id);
    return () => {
      socket.emit('unsubscribe:team', id);
    };
  }, [socket, id]);

  const { data: teamData, isLoading } = useQuery({
    queryKey: ['team', id],
    queryFn: () => apiFetch<{ team: TeamDTO }>(`/api/teams/${id}`),
    enabled: Boolean(id),
  });

  const team = teamData?.team;
  const isLeader = Boolean(user && team && team.leaderId === user.id);
  const isMember = Boolean(user && team?.members?.some((m) => m.userId === user.id));

  const { data: invitationsData } = useQuery({
    queryKey: ['team-invitations', id],
    queryFn: () => apiFetch<{ items: InvitationDTO[] }>(`/api/teams/${id}/invitations`),
    enabled: Boolean(id && isLeader),
  });

  const { data: joinRequestsData } = useQuery({
    queryKey: ['team-join-requests', id],
    queryFn: () => apiFetch<{ items: JoinRequestDTO[] }>(`/api/join-requests?teamId=${id}`),
    enabled: Boolean(id && isLeader),
  });

  const { data: matchesData } = useQuery({
    queryKey: ['team-matches', id],
    queryFn: () => apiFetch<{ items: TeammateRecommendation[] }>(`/api/matching/teammates?teamId=${id}`),
    enabled: Boolean(id && isLeader),
  });

  const { data: auditData } = useQuery({
    queryKey: ['audit-logs', 'team', id],
    queryFn: () => apiFetch<{ items: AuditLogDTO[] }>(`/api/audit-logs?teamId=${id}&limit=15`),
    enabled: Boolean(id),
  });

  const joinMutation = useMutation({
    mutationFn: () => {
      const idempotencyKey = `join-${id}-${crypto.randomUUID()}`;
      return apiFetch<{ team: TeamDTO }>(`/api/teams/${id}/join`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ idempotencyKey }),
      });
    },
    onSuccess: () => {
      toast.success('Successfully claimed seat in team');
      void queryClient.invalidateQueries({ queryKey: ['team', id] });
      void queryClient.invalidateQueries({ queryKey: ['my-teams'] });
      void queryClient.invalidateQueries({ queryKey: ['audit-logs', 'team', id] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Unable to join team'),
  });

  const leaveMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ deletedTeam: boolean; newLeaderId: string | null }>(`/api/teams/${id}/leave`, {
        method: 'POST',
      }),
    onSuccess: (res) => {
      setLeaveConfirmOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['my-teams'] });
      if (res.deletedTeam) {
        toast.success('Last member left — team archived and deleted');
        navigate('/teams');
      } else {
        toast.success(
          res.newLeaderId
            ? 'Left team and transferred leadership deterministically'
            : 'Left team cleanly',
        );
        void queryClient.invalidateQueries({ queryKey: ['team', id] });
        void queryClient.invalidateQueries({ queryKey: ['audit-logs', 'team', id] });
      }
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to leave team'),
  });

  const kickMutation = useMutation({
    mutationFn: (memberUserId: string) =>
      apiFetch(`/api/teams/${id}/members/${memberUserId}`, { method: 'DELETE' }),
    onSuccess: () => {
      setKickMemberTarget(null);
      toast.success('Member removed from team');
      void queryClient.invalidateQueries({ queryKey: ['team', id] });
      void queryClient.invalidateQueries({ queryKey: ['audit-logs', 'team', id] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to remove member'),
  });

  const createInviteMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ invitation: InvitationDTO; rawToken: string }>(`/api/teams/${id}/invitations`, {
        method: 'POST',
        body: JSON.stringify({
          inviteeEmail: inviteEmail.trim() || null,
          maxUses: Number(inviteMaxUses) || 1,
          expiresInHours: 72,
        }),
      }),
    onSuccess: (res) => {
      const url = `${window.location.origin}/invitations/accept?token=${res.rawToken}`;
      setCreatedInviteLink(url);
      setInviteEmail('');
      toast.success('Invitation generated (token hashed in database)');
      void queryClient.invalidateQueries({ queryKey: ['team-invitations', id] });
      void queryClient.invalidateQueries({ queryKey: ['audit-logs', 'team', id] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to create invite'),
  });

  const revokeInviteMutation = useMutation({
    mutationFn: (invitationId: string) =>
      apiFetch(`/api/teams/${id}/invitations/${invitationId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Invitation revoked');
      void queryClient.invalidateQueries({ queryKey: ['team-invitations', id] });
    },
  });

  const sendJoinRequestMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/join-requests', {
        method: 'POST',
        body: JSON.stringify({ teamId: id, message: joinRequestMsg.trim() || null }),
      }),
    onSuccess: () => {
      setJoinRequestMsg('');
      toast.success('Join request sent to team leader');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not send request'),
  });

  const reviewRequestMutation = useMutation({
    mutationFn: ({ reqId, action }: { reqId: string; action: 'accept' | 'reject' }) =>
      apiFetch(`/api/join-requests/${reqId}/${action}`, { method: 'POST' }),
    onSuccess: (_, vars) => {
      toast.success(vars.action === 'accept' ? 'Applicant added to team' : 'Request rejected');
      void queryClient.invalidateQueries({ queryKey: ['team', id] });
      void queryClient.invalidateQueries({ queryKey: ['team-join-requests', id] });
      void queryClient.invalidateQueries({ queryKey: ['audit-logs', 'team', id] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Review failed'),
  });

  const updateTeamMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ team: TeamDTO }>(`/api/teams/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editName,
          description: editDesc,
          maxSize: Number(editMaxSize),
        }),
      }),
    onSuccess: () => {
      setEditOpen(false);
      toast.success('Team details updated');
      void queryClient.invalidateQueries({ queryKey: ['team', id] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Update failed'),
  });

  const deleteTeamMutation = useMutation({
    mutationFn: () => apiFetch(`/api/teams/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setDeleteConfirmOpen(false);
      toast.success('Team deleted');
      void queryClient.invalidateQueries({ queryKey: ['my-teams'] });
      navigate('/teams');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Delete failed'),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-52 w-full rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Skeleton className="lg:col-span-7 h-72 rounded-2xl" />
          <Skeleton className="lg:col-span-5 h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <h1 className="text-xl font-bold text-[#201B35]">Team not found</h1>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/teams">Back to Teams</Link>
        </Button>
      </div>
    );
  }

  const invitations = invitationsData?.items ?? [];
  const joinRequests = (joinRequestsData?.items ?? []).filter((jr) => jr.status === 'PENDING');
  const recommendedCandidates = matchesData?.items ?? [];
  const auditLogs = auditData?.items ?? [];
  const coveredSkills = new Set(
    (team.members ?? []).flatMap((m) => m.user.skills.map((s) => s.toLowerCase())),
  );
  const fillPct = Math.round((team.memberCount / Math.max(1, team.maxSize)) * 100);

  return (
    <div className="space-y-7">
      <Link
        to="/teams"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#77718C] hover:text-[#201B35]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Discover Teams
      </Link>

      {/* Immersive Team Header */}
      <Card>
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div className="flex items-start gap-4 max-w-3xl">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#7257E8] to-[#4338A8] text-white font-extrabold text-xl flex items-center justify-center shrink-0 shadow-sm">
                {team.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Link
                    to={`/hackathons/${team.hackathonId}`}
                    className="text-xs font-semibold text-[#7257E8] hover:underline"
                  >
                    {team.hackathonName}
                  </Link>
                  {team.openSeats === 1 ? (
                    <StatusBadge tone="warning">
                      <Sparkles className="h-3 w-3" />1 seat left
                    </StatusBadge>
                  ) : team.openSeats > 1 ? (
                    <StatusBadge tone="violet">{team.openSeats} open seats</StatusBadge>
                  ) : (
                    <StatusBadge tone="success">Roster full</StatusBadge>
                  )}
                  {isMember && <StatusBadge tone="blue">You are a member</StatusBadge>}
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#201B35]">
                  {team.name}
                </h1>
                <p className="mt-2.5 text-sm sm:text-base text-[#77718C] leading-relaxed">
                  {team.description}
                </p>

                <div className="mt-5 max-w-md space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#77718C]">Capacity</span>
                    <span className="font-mono font-semibold tabular-nums text-[#201B35]">
                      {team.memberCount}/{team.maxSize} seats filled
                    </span>
                  </div>
                  <Progress value={fillPct} tone={team.openSeats === 0 ? 'success' : 'violet'} />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {!user && (
                <Button asChild size="lg">
                  <Link to={`/auth?redirect=/teams/${team.id}`}>Sign In to Join</Link>
                </Button>
              )}

              {user && !isMember && (
                <Button
                  size="lg"
                  disabled={team.openSeats <= 0}
                  isLoading={joinMutation.isPending}
                  onClick={() => joinMutation.mutate()}
                >
                  {team.openSeats <= 0 ? 'Team Full' : 'Join Seat Atomically'}
                </Button>
              )}

              {isMember && (
                <Button
                  variant="outline"
                  className="text-[#E15B70] border-[#F8CBD3] hover:bg-[#FDECEF]"
                  onClick={() => setLeaveConfirmOpen(true)}
                >
                  Leave Team
                </Button>
              )}

              {isLeader && (
                <>
                  <Dialog
                    open={editOpen}
                    onOpenChange={(open) => {
                      setEditOpen(open);
                      if (open) {
                        setEditName(team.name);
                        setEditDesc(team.description);
                        setEditMaxSize(team.maxSize);
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button variant="secondary">Edit Team</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit team details</DialogTitle>
                        <DialogDescription>
                          Update team name, project description, or seat capacity.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold text-[#201B35] mb-1">Name</label>
                          <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-[#201B35] mb-1">
                            Description
                          </label>
                          <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-[#201B35] mb-1">
                            Maximum seats
                          </label>
                          <Input
                            type="number"
                            min={Math.max(team.minSize, team.memberCount)}
                            max={10}
                            value={editMaxSize}
                            onChange={(e) => setEditMaxSize(Number(e.target.value))}
                          />
                        </div>
                        <Button
                          className="w-full"
                          isLoading={updateTeamMutation.isPending}
                          onClick={() => updateTeamMutation.mutate()}
                        >
                          Save Changes
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button
                    variant="destructive"
                    size="icon"
                    aria-label="Delete team"
                    onClick={() => setDeleteConfirmOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Two-Column Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
        <div className="lg:col-span-7 space-y-6">
          {/* Required Skills & Team Goals */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-[#7257E8]" />
                <CardTitle className="text-base">Required Skills & Open Positions</CardTitle>
              </div>
              <CardDescription>
                Highlighted skills are already covered by current team members.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {team.requiredSkills.map((s) => (
                  <SkillTag key={s} matched={coveredSkills.has(s.toLowerCase())}>
                    {s} {coveredSkills.has(s.toLowerCase()) ? '✓' : ''}
                  </SkillTag>
                ))}
              </div>
              <div className="rounded-xl border border-[#ECE8F4] bg-[#FAF9FF] p-4 flex items-center justify-between text-xs">
                <span className="text-[#77718C]">Available positions in squad</span>
                <span className="font-mono font-bold text-[#4338A8]">
                  {team.openSeats} open of {team.maxSize} (min {team.minSize})
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Current Members */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#7257E8]" />
                <CardTitle className="text-base">Current Members ({team.memberCount})</CardTitle>
              </div>
              <CardDescription>
                {isLeader
                  ? 'If you leave, leadership transfers deterministically to the earliest-joined remaining member.'
                  : 'Verified hackathon roster.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(team.members ?? []).map((m) => (
                <div
                  key={m.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[#ECE8F4] bg-[#FAF9FF] p-4"
                >
                  <div className="flex items-start gap-3">
                    <UserAvatar name={m.user.name} avatarUrl={m.user.avatarUrl} size="md" />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-[#201B35]">{m.user.name}</span>
                        {m.role === 'LEADER' && (
                          <StatusBadge tone="indigo">
                            <Crown className="h-3 w-3" />
                            Leader
                          </StatusBadge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-[#77718C]">
                        {m.user.experienceLevel} · {m.user.timezone} · {m.user.weeklyAvailability}h/wk
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.user.skills.slice(0, 4).map((sk) => (
                          <SkillTag key={sk}>{sk}</SkillTag>
                        ))}
                      </div>
                    </div>
                  </div>

                  {isLeader && m.userId !== user?.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-[#E15B70] hover:bg-[#FDECEF] shrink-0"
                      onClick={() => setKickMemberTarget({ id: m.userId, name: m.user.name })}
                    >
                      <UserMinus className="h-4 w-4" />
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Non-member Join Request */}
          {user && !isMember && team.openSeats > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Request to Join with an Intro</CardTitle>
                <CardDescription>
                  Prefer leader approval before claiming a seat? Introduce yourself below.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder="Share what role you'd like to own and how your skills complement this team..."
                  value={joinRequestMsg}
                  onChange={(e) => setJoinRequestMsg(e.target.value)}
                />
                <Button
                  variant="secondary"
                  isLoading={sendJoinRequestMutation.isPending}
                  onClick={() => sendJoinRequestMutation.mutate()}
                >
                  <Send className="h-4 w-4" />
                  Submit Join Request
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Leader-only Controls */}
          {isLeader && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Pending Join Requests ({joinRequests.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {joinRequests.length === 0 ? (
                    <p className="text-sm text-[#77718C]">No pending join requests right now.</p>
                  ) : (
                    <div className="space-y-3">
                      {joinRequests.map((jr) => (
                        <div
                          key={jr.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#ECE8F4] bg-[#FAF9FF] p-4"
                        >
                          <div>
                            <p className="text-sm font-bold text-[#201B35]">
                              {jr.user?.name || jr.userId}
                            </p>
                            <p className="text-xs text-[#77718C]">{jr.user?.skills.join(' · ')}</p>
                            {jr.message && (
                              <p className="mt-1.5 text-xs text-[#201B35]">{jr.message}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="sm"
                              onClick={() => reviewRequestMutation.mutate({ reqId: jr.id, action: 'accept' })}
                            >
                              <Check className="h-3.5 w-3.5" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => reviewRequestMutation.mutate({ reqId: jr.id, action: 'reject' })}
                            >
                              <X className="h-3.5 w-3.5" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-[#7257E8]" />
                    <CardTitle className="text-base">Secure Invitations</CardTitle>
                  </div>
                  <CardDescription>
                    Tokens are cryptographically random and stored solely as SHA-256 hashes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-6">
                      <Input
                        placeholder="Invitee email (or leave blank for open link)"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        aria-label="Max uses"
                        value={inviteMaxUses}
                        onChange={(e) => setInviteMaxUses(Number(e.target.value))}
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <Button
                        className="w-full"
                        isLoading={createInviteMutation.isPending}
                        onClick={() => createInviteMutation.mutate()}
                      >
                        Generate
                      </Button>
                    </div>
                  </div>

                  {createdInviteLink && (
                    <div className="rounded-xl border border-[#DCD4FA] bg-[#F3F0FF] p-3.5 space-y-2">
                      <p className="text-xs font-semibold text-[#4338A8]">
                        One-time invite link (only shown once — token is hashed in DB):
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 truncate text-xs font-mono bg-white border border-[#ECE8F4] rounded-lg px-2.5 py-1.5 text-[#201B35]">
                          {createdInviteLink}
                        </code>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            void navigator.clipboard.writeText(createdInviteLink);
                            toast.success('Invite link copied');
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copy
                        </Button>
                      </div>
                    </div>
                  )}

                  {invitations.length > 0 && (
                    <div className="divide-y divide-[#ECE8F4] border-t border-[#ECE8F4] pt-2">
                      {invitations.map((inv) => (
                        <div key={inv.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                          <div>
                            <span className="font-semibold text-[#201B35]">
                              {inv.inviteeEmail || 'Open invite link'}
                            </span>
                            <span className="text-[#77718C] ml-2 font-mono tabular-nums">
                              {inv.status} · {inv.usesCount}/{inv.maxUses} uses
                            </span>
                          </div>
                          {inv.status === 'ACTIVE' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-[#E15B70] h-8"
                              onClick={() => revokeInviteMutation.mutate(inv.id)}
                            >
                              Revoke
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Right Sidebar: Recommended Teammates & Team Activity */}
        <div className="lg:col-span-5 space-y-6">
          {isLeader && recommendedCandidates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recommended Teammates</CardTitle>
                <CardDescription>Ranked by skill gap coverage, timezone, and hours.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {recommendedCandidates.slice(0, 4).map(({ user: cand, match }) => (
                  <div key={cand.id} className="rounded-xl border border-[#ECE8F4] bg-[#FAF9FF] p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserAvatar name={cand.name} avatarUrl={cand.avatarUrl} size="sm" />
                        <span className="text-sm font-bold text-[#201B35] truncate">{cand.name}</span>
                      </div>
                      <StatusBadge tone="violet" className="font-mono tabular-nums">
                        {match.overallScore}%
                      </StatusBadge>
                    </div>
                    <p className="mt-1.5 text-xs text-[#77718C]">{match.explanation}</p>
                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#77718C]">
                      <span className="truncate">{cand.skills.slice(0, 3).join(' · ')}</span>
                      <button
                        type="button"
                        className="text-[#7257E8] font-semibold hover:underline cursor-pointer shrink-0 ml-2"
                        onClick={() => setInviteEmail(cand.email)}
                      >
                        Invite email →
                      </button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-[#7257E8]" />
                <CardTitle className="text-base">Team Activity Timeline</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-[#ECE8F4]">
              {auditLogs.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-[#77718C]">No activity recorded yet.</p>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="px-6 py-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#201B35]">{log.actionType}</span>
                      <span className="text-xs font-mono tabular-nums text-[#77718C]">
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

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        open={leaveConfirmOpen}
        onOpenChange={setLeaveConfirmOpen}
        title="Leave this team?"
        description={
          isLeader
            ? team.memberCount <= 1
              ? 'You are the last member. Leaving will safely archive and delete this team.'
              : 'As team leader, leaving will deterministically transfer leadership to the earliest-joined remaining member.'
            : 'Your seat will immediately reopen for other hackathon participants.'
        }
        confirmLabel="Leave Team"
        destructive
        isLoading={leaveMutation.isPending}
        onConfirm={() => leaveMutation.mutate()}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete team permanently?"
        description="This deletes the team, active invitations, join requests, and memberships transactionally."
        confirmLabel="Delete Team"
        destructive
        isLoading={deleteTeamMutation.isPending}
        onConfirm={() => deleteTeamMutation.mutate()}
      />

      <ConfirmDialog
        open={Boolean(kickMemberTarget)}
        onOpenChange={(open) => !open && setKickMemberTarget(null)}
        title={`Remove ${kickMemberTarget?.name || 'member'}?`}
        description="They will be removed from the roster and one seat will reopen."
        confirmLabel="Remove Member"
        destructive
        isLoading={kickMutation.isPending}
        onConfirm={() => kickMemberTarget && kickMutation.mutate(kickMemberTarget.id)}
      />
    </div>
  );
}
