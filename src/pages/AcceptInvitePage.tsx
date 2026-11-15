import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { KeyRound } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { apiFetch, ApiError } from '@/src/lib/api';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { StatusBadge } from '@/src/components/ui/badge';
import type { TeamDTO } from '@/shared/types';

export function AcceptInvitePage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(searchParams.get('token') || '');

  const acceptMutation = useMutation({
    mutationFn: (rawToken: string) =>
      apiFetch<{ team: TeamDTO }>(`/api/invitations/${encodeURIComponent(rawToken.trim())}/accept`, {
        method: 'POST',
      }),
    onSuccess: (res) => {
      toast.success(`Joined ${res.team.name} via secure invitation`);
      navigate(`/teams/${res.team.id}`);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Unable to accept invitation');
    },
  });

  return (
    <div className="mx-auto max-w-lg py-10">
      <Card>
        <CardHeader>
          <StatusBadge tone="violet" className="w-fit mb-2">
            <KeyRound className="h-3.5 w-3.5" />
            Cryptographic Redemption
          </StatusBadge>
          <CardTitle>Accept Team Invitation</CardTitle>
          <CardDescription>
            Validate your SHA-256 verified token and claim your team seat atomically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!user ? (
            <div className="space-y-4">
              <p className="text-sm text-[#77718C]">
                Please sign in first so your membership is bound to your participant profile.
              </p>
              <Button asChild className="w-full" size="lg">
                <Link
                  to={`/auth?redirect=${encodeURIComponent(`/invitations/accept?token=${token}`)}`}
                >
                  Sign In to Accept
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="inv-tok" className="block text-sm font-semibold text-[#201B35] mb-1.5">
                  Invitation Token
                </label>
                <Input
                  id="inv-tok"
                  placeholder="Paste 64-character invitation token..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
              <Button
                className="w-full"
                size="lg"
                disabled={!token.trim()}
                isLoading={acceptMutation.isPending}
                onClick={() => acceptMutation.mutate(token)}
              >
                {acceptMutation.isPending ? 'Verifying Token...' : 'Accept & Join Team'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
