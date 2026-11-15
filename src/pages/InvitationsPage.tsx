import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, KeyRound, Mail, MailCheck, Send, X } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { apiFetch, ApiError } from '@/src/lib/api';
import { formatRelativeTime } from '@/src/lib/utils';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { StatusBadge } from '@/src/components/ui/badge';
import { EmptyState } from '@/src/components/ui/empty-state';
import { Skeleton } from '@/src/components/ui/skeleton';
import type { InvitationDTO, TeamDTO } from '@/shared/types';

type EnrichedInvitation = InvitationDTO & { teamName: string; hackathonName: string };

export function InvitationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [rawToken, setRawToken] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['my-invitations-all', user?.id],
    queryFn: () =>
      apiFetch<{
        received: EnrichedInvitation[];
        sent: EnrichedInvitation[];
        expired: EnrichedInvitation[];
      }>('/api/users/me/invitations/all'),
    enabled: Boolean(user),
  });

  const acceptDirectMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ team: TeamDTO }>(`/api/invitations/direct/${id}/accept`, { method: 'POST' }),
    onSuccess: (res) => {
      toast.success(`Joined ${res.team.name}`);
      void queryClient.invalidateQueries({ queryKey: ['my-invitations-all'] });
      void queryClient.invalidateQueries({ queryKey: ['my-invitations'] });
      void queryClient.invalidateQueries({ queryKey: ['my-teams'] });
      navigate(`/teams/${res.team.id}`);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Unable to accept invitation'),
  });

  const declineDirectMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/invitations/direct/${id}/decline`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Invitation declined');
      void queryClient.invalidateQueries({ queryKey: ['my-invitations-all'] });
      void queryClient.invalidateQueries({ queryKey: ['my-invitations'] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Unable to decline'),
  });

  const revokeSentMutation = useMutation({
    mutationFn: ({ teamId, invId }: { teamId: string; invId: string }) =>
      apiFetch(`/api/teams/${teamId}/invitations/${invId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Invitation revoked');
      void queryClient.invalidateQueries({ queryKey: ['my-invitations-all'] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Unable to revoke'),
  });

  const redeemTokenMutation = useMutation({
    mutationFn: (token: string) =>
      apiFetch<{ team: TeamDTO }>(`/api/invitations/${encodeURIComponent(token.trim())}/accept`, {
        method: 'POST',
      }),
    onSuccess: (res) => {
      toast.success(`Joined ${res.team.name} via cryptographic token`);
      setRawToken('');
      void queryClient.invalidateQueries({ queryKey: ['my-teams'] });
      navigate(`/teams/${res.team.id}`);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Invalid or expired token'),
  });

  if (!user) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <EmptyState
          icon={<Mail className="h-6 w-6" />}
          title="Sign in to view your invitations"
          description="Accept direct team invites, track invitations you have sent as a leader, or redeem an invite link."
          action={
            <Button asChild>
              <Link to="/auth?redirect=/invitations">Sign In</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const received = data?.received ?? [];
  const sent = data?.sent ?? [];
  const expired = data?.expired ?? [];

  return (
    <div className="space-y-7 max-w-5xl">
      <div>
        <StatusBadge tone="violet">Secure Invitations</StatusBadge>
        <h1 className="mt-2.5 text-3xl font-extrabold tracking-tight text-[#201B35]">
          Invitations
        </h1>
        <p className="mt-1 text-sm sm:text-base text-[#77718C]">
          Manage received team offers, active outgoing invitations, and token redemptions.
        </p>
      </div>

      {/* Token redemption card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[#7257E8]" />
            <CardTitle className="text-base">Redeem an Invitation Token</CardTitle>
          </div>
          <CardDescription>
            Paste a cryptographic invitation token shared by a team leader to claim a seat atomically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (rawToken.trim()) redeemTokenMutation.mutate(rawToken);
            }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <Input
              value={rawToken}
              onChange={(e) => setRawToken(e.target.value)}
              placeholder="Paste 64-character SHA-256 invitation token..."
              className="font-mono text-xs flex-1"
            />
            <Button type="submit" disabled={!rawToken.trim()} isLoading={redeemTokenMutation.isPending}>
              Accept & Join
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : (
        <Tabs defaultValue="received">
          <TabsList>
            <TabsTrigger value="received">
              <MailCheck className="h-3.5 w-3.5" />
              Received ({received.length})
            </TabsTrigger>
            <TabsTrigger value="sent">
              <Send className="h-3.5 w-3.5" />
              Sent ({sent.length})
            </TabsTrigger>
            <TabsTrigger value="expired">Expired / History ({expired.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="received" className="space-y-3">
            {received.length === 0 ? (
              <EmptyState
                icon={<Mail className="h-6 w-6" />}
                title="No pending invitations received"
                description="Direct email invitations sent to your account appear here for one-click acceptance."
                action={
                  <Button asChild variant="outline">
                    <Link to="/teams">Explore Open Teams</Link>
                  </Button>
                }
              />
            ) : (
              received.map((inv) => (
                <Card key={inv.id}>
                  <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/teams/${inv.teamId}`}
                          className="text-base font-bold text-[#201B35] hover:text-[#7257E8]"
                        >
                          {inv.teamName}
                        </Link>
                        <StatusBadge tone="violet">Active Offer</StatusBadge>
                      </div>
                      <p className="text-xs text-[#77718C]">
                        {inv.hackathonName} · Invited by {inv.inviterName || 'Team Leader'} ·{' '}
                        {formatRelativeTime(inv.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        isLoading={acceptDirectMutation.isPending}
                        onClick={() => acceptDirectMutation.mutate(inv.id)}
                      >
                        <Check className="h-3.5 w-3.5" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        isLoading={declineDirectMutation.isPending}
                        onClick={() => declineDirectMutation.mutate(inv.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                        Decline
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="sent" className="space-y-3">
            {sent.length === 0 ? (
              <EmptyState
                icon={<Send className="h-6 w-6" />}
                title="No active outgoing invitations"
                description="As a team leader, you can generate SHA-256 invitations from your team workspace."
                action={
                  <Button asChild variant="outline">
                    <Link to="/my-team">Open My Team</Link>
                  </Button>
                }
              />
            ) : (
              sent.map((inv) => (
                <Card key={inv.id}>
                  <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-[#201B35]">
                          {inv.inviteeEmail || 'Open invite link'}
                        </span>
                        <StatusBadge tone="blue" className="font-mono tabular-nums">
                          {inv.usesCount}/{inv.maxUses} uses
                        </StatusBadge>
                      </div>
                      <p className="text-xs text-[#77718C]">
                        Team: {inv.teamName} · {inv.hackathonName} · Sent{' '}
                        {formatRelativeTime(inv.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/teams/${inv.teamId}`}>View Team</Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-[#E15B70] hover:bg-[#FDECEF]"
                        onClick={() => revokeSentMutation.mutate({ teamId: inv.teamId, invId: inv.id })}
                      >
                        Revoke
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="expired" className="space-y-3">
            {expired.length === 0 ? (
              <EmptyState
                icon={<KeyRound className="h-6 w-6" />}
                title="No past or expired invitations"
                description="Accepted, revoked, and expired invitations are tracked here for transparency."
              />
            ) : (
              expired.map((inv) => (
                <Card key={inv.id}>
                  <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-[#201B35]">
                        {inv.teamName} — {inv.inviteeEmail || 'Open invite link'}
                      </p>
                      <p className="text-xs text-[#77718C] mt-0.5">
                        {inv.hackathonName} · {formatRelativeTime(inv.createdAt)}
                      </p>
                    </div>
                    <StatusBadge
                      tone={
                        inv.status === 'ACCEPTED'
                          ? 'success'
                          : inv.status === 'REVOKED'
                            ? 'danger'
                            : 'neutral'
                      }
                    >
                      {inv.status}
                    </StatusBadge>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
