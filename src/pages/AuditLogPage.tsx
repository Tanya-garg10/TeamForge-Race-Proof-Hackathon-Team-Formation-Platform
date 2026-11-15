import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, Crown, KeyRound, Plus, Trash2, UserMinus, UserPlus } from 'lucide-react';
import { apiFetch } from '@/src/lib/api';
import { formatRelativeTime } from '@/src/lib/utils';
import { Card, CardContent } from '@/src/components/ui/card';
import { FilterChip, StatusBadge } from '@/src/components/ui/badge';
import { UserAvatar } from '@/src/components/ui/avatar';
import { EmptyState } from '@/src/components/ui/empty-state';
import { Skeleton } from '@/src/components/ui/skeleton';
import { Pagination } from '@/src/components/ui/pagination';
import type { AuditLogDTO } from '@/shared/types';

const ACTION_FILTERS = [
  { value: '', label: 'All Events' },
  { value: 'TEAM_CREATED', label: 'Team Created' },
  { value: 'TEAM_MEMBER_JOINED', label: 'Member Joined' },
  { value: 'INVITATION_ACCEPTED', label: 'Invite Accepted' },
  { value: 'LEADERSHIP_TRANSFERRED', label: 'Leadership Transferred' },
  { value: 'TEAM_MEMBER_LEFT', label: 'Member Left' },
  { value: 'TEAM_DELETED', label: 'Team Deleted' },
];

function getActionVisual(actionType: string) {
  switch (actionType) {
    case 'TEAM_CREATED':
      return { icon: Plus, tone: 'violet' as const, label: 'Created a team' };
    case 'TEAM_MEMBER_JOINED':
      return { icon: UserPlus, tone: 'success' as const, label: 'Claimed an open seat' };
    case 'INVITATION_ACCEPTED':
      return { icon: KeyRound, tone: 'blue' as const, label: 'Accepted a team invitation' };
    case 'LEADERSHIP_TRANSFERRED':
      return { icon: Crown, tone: 'warning' as const, label: 'Transferred team leadership' };
    case 'TEAM_MEMBER_LEFT':
      return { icon: UserMinus, tone: 'neutral' as const, label: 'Left a team roster' };
    case 'TEAM_DELETED':
      return { icon: Trash2, tone: 'danger' as const, label: 'Team archived & dissolved' };
    default:
      return { icon: Activity, tone: 'neutral' as const, label: actionType.replace(/_/g, ' ') };
  }
}

export function AuditLogPage() {
  const [actionType, setActionType] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  if (actionType) params.set('actionType', actionType);
  params.set('page', String(page));
  params.set('limit', '15');

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', 'timeline', actionType, page],
    queryFn: () =>
      apiFetch<{ items: AuditLogDTO[]; total: number; totalPages: number }>(
        `/api/audit-logs?${params.toString()}`,
      ),
  });

  const logs = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-7 max-w-5xl">
      <div>
        <StatusBadge tone="violet">Transactional Audit Trail</StatusBadge>
        <h1 className="mt-2.5 text-3xl font-extrabold tracking-tight text-[#201B35]">
          Activity Timeline
        </h1>
        <p className="mt-1 text-sm sm:text-base text-[#77718C]">
          Chronological record of team creations, atomic seat claims, invitations, and leadership
          transfers.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {ACTION_FILTERS.map((f) => (
          <FilterChip
            key={f.value || 'all'}
            active={actionType === f.value}
            onClick={() => {
              setActionType(f.value);
              setPage(1);
            }}
          >
            {f.label}
          </FilterChip>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={<Activity className="h-6 w-6" />}
          title="No activity recorded for this filter"
          description="Try switching back to All Events or perform a team action to record a transactional entry."
        />
      ) : (
        <Card>
          <CardContent className="p-6">
            <div className="relative space-y-6 before:absolute before:left-5 before:top-2 before:bottom-2 before:w-px before:bg-[#ECE8F4]">
              {logs.map((log) => {
                const visual = getActionVisual(log.actionType);
                const Icon = visual.icon;
                const actor = log.actorName || log.actorUserId;
                return (
                  <div key={log.id} className="relative flex items-start gap-4 pl-1">
                    <div className="relative z-10 h-8 w-8 rounded-full border border-[#ECE8F4] bg-white flex items-center justify-center shrink-0 mt-0.5 text-[#7257E8]">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0 rounded-xl border border-[#ECE8F4] bg-[#FAF9FF] p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <UserAvatar name={actor} size="xs" />
                          <span className="text-sm font-bold text-[#201B35]">{actor}</span>
                          <StatusBadge tone={visual.tone}>{log.actionType}</StatusBadge>
                        </div>
                        <span className="font-mono text-xs tabular-nums text-[#77718C]">
                          {formatRelativeTime(log.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-[#77718C]">
                        {visual.label}
                        {log.teamId ? (
                          <>
                            {' · '}
                            <Link
                              to={`/teams/${log.teamId}`}
                              className="font-semibold text-[#7257E8] hover:underline"
                            >
                              View team
                            </Link>
                          </>
                        ) : null}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Pagination page={page} totalPages={totalPages} totalItems={total} onPageChange={setPage} />
    </div>
  );
}
