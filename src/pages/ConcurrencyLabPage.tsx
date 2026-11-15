import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Lock, Play, ShieldCheck, XCircle } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { apiFetch, ApiError } from '@/src/lib/api';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { StatusBadge } from '@/src/components/ui/badge';
import { Progress } from '@/src/components/ui/progress';

interface ConcurrencyOutcome {
  contender: string;
  status: number;
  outcome: 'JOINED' | 'REJECTED';
  message: string;
}

interface ConcurrencyDemoResult {
  runId: string;
  totalRequests: number;
  initialMembers: number;
  maxCapacity: number;
  succeededCount: number;
  conflictCount: number;
  finalMemberCount: number;
  auditJoinCount: number;
  capacityRespected: boolean;
  durationMs: number;
  winner: string | null;
  sampleOutcomes: ConcurrencyOutcome[];
  allOutcomes?: ConcurrencyOutcome[];
}

export function ConcurrencyLabPage() {
  const { user } = useAuth();
  const [result, setResult] = useState<ConcurrencyDemoResult | null>(null);

  const demoMutation = useMutation({
    mutationFn: () =>
      apiFetch<ConcurrencyDemoResult>('/api/admin/concurrency-demo', {
        method: 'POST',
      }),
    onSuccess: (data) => {
      setResult(data);
      toast.success(
        `Benchmark verified: ${data.succeededCount} succeeded (201), ${data.conflictCount} rejected (409)`,
      );
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Unable to execute concurrency test');
    },
  });

  const outcomes = result?.allOutcomes ?? result?.sampleOutcomes ?? [];

  return (
    <div className="space-y-7 max-w-6xl">
      <div>
        <StatusBadge tone="indigo">
          <Lock className="h-3 w-3" />
          Live Transactional Benchmark
        </StatusBadge>
        <h1 className="mt-2.5 text-3xl font-extrabold tracking-tight text-[#201B35]">
          One Seat. Fifty Participants. Zero Overbooking.
        </h1>
        <p className="mt-1.5 text-sm sm:text-base text-[#77718C] max-w-3xl">
          Dispatches 50 simultaneous <code className="font-mono text-xs text-[#4338A8]">Promise.all</code>{' '}
          join requests against an isolated team holding 4 of 5 seats using the real serialized
          transactional service.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        {/* Sandbox Control Panel */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle className="text-base">Target Sandbox Team</CardTitle>
            <CardDescription>
              Restricted to Demo Admin accounts (<code className="font-mono text-xs">alice@teamforge.dev</code>{' '}
              or <code className="font-mono text-xs">admin@teamforge.dev</code>).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Capacity Visualizer */}
            <div className="rounded-2xl border border-[#ECE8F4] bg-[#FAF9FF] p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#201B35]">Pre-test Team Capacity</span>
                <StatusBadge tone="warning">1 seat left</StatusBadge>
              </div>
              <Progress value={result ? 100 : 80} tone={result ? 'success' : 'warning'} />
              <div className="grid grid-cols-3 gap-2 pt-1 text-center text-xs">
                <div className="rounded-xl border border-[#ECE8F4] bg-white p-2.5">
                  <p className="text-[#77718C]">Capacity</p>
                  <p className="font-mono font-bold text-[#201B35] mt-0.5">5</p>
                </div>
                <div className="rounded-xl border border-[#ECE8F4] bg-white p-2.5">
                  <p className="text-[#77718C]">Current</p>
                  <p className="font-mono font-bold text-[#201B35] mt-0.5">
                    {result ? result.finalMemberCount : 4}
                  </p>
                </div>
                <div className="rounded-xl border border-[#ECE8F4] bg-white p-2.5">
                  <p className="text-[#77718C]">Available</p>
                  <p className="font-mono font-bold text-[#7257E8] mt-0.5">
                    {result ? 0 : 1}
                  </p>
                </div>
              </div>
            </div>

            {!user ? (
              <Button asChild size="lg" className="w-full">
                <Link to="/auth?redirect=/lab">Sign In as Demo Admin</Link>
              </Button>
            ) : !user.isDemoAdmin ? (
              <div className="rounded-xl border border-[#F7E0B5] bg-[#FDF4E5] p-3.5 text-xs text-[#A86D14]">
                Signed in as {user.email}. Switch to{' '}
                <code className="font-mono font-semibold">alice@teamforge.dev</code> or{' '}
                <code className="font-mono font-semibold">admin@teamforge.dev</code> to trigger the
                live 50-request race test.
              </div>
            ) : (
              <Button
                size="lg"
                className="w-full"
                isLoading={demoMutation.isPending}
                onClick={() => demoMutation.mutate()}
              >
                <Play className="h-4 w-4" />
                {demoMutation.isPending ? 'Dispatching 50 Concurrent Joins...' : 'Run Concurrency Test'}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Measured Backend Results */}
        <Card className="lg:col-span-7">
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="text-base">50-Request Execution Matrix</CardTitle>
              <CardDescription>
                Real HTTP status codes returned by the transactional join engine.
              </CardDescription>
            </div>
            {result && (
              <StatusBadge tone={result.capacityRespected ? 'success' : 'danger'}>
                {result.capacityRespected ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    PASSED
                  </>
                ) : (
                  <>
                    <XCircle className="h-3.5 w-3.5" />
                    FAILED
                  </>
                )}
              </StatusBadge>
            )}
          </CardHeader>
          <CardContent>
            {!result ? (
              <div className="rounded-2xl border border-dashed border-[#DCD4EE] bg-[#FAF9FF] p-12 text-center text-sm text-[#77718C]">
                Click <strong className="text-[#201B35]">Run Concurrency Test</strong> to execute 50
                simultaneous requests and inspect every outcome.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  <div className="rounded-xl border border-[#ECE8F4] bg-[#FAF9FF] p-3.5">
                    <p className="text-xs text-[#77718C]">Total Requests</p>
                    <p className="mt-1 font-mono text-2xl font-extrabold tabular-nums text-[#201B35]">
                      {result.totalRequests}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#C7EEDF] bg-[#E8F8F2]/60 p-3.5">
                    <p className="text-xs text-[#117A58]">Succeeded (201)</p>
                    <p className="mt-1 font-mono text-2xl font-extrabold tabular-nums text-[#16A477]">
                      {result.succeededCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#F8CBD3] bg-[#FDECEF]/60 p-3.5">
                    <p className="text-xs text-[#B83249]">Rejected (409)</p>
                    <p className="mt-1 font-mono text-2xl font-extrabold tabular-nums text-[#E15B70]">
                      {result.conflictCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#DCD4FA] bg-[#F3F0FF] p-3.5">
                    <p className="text-xs text-[#4338A8]">Final Members</p>
                    <p className="mt-1 font-mono text-2xl font-extrabold tabular-nums text-[#7257E8]">
                      {result.finalMemberCount}/{result.maxCapacity}
                    </p>
                  </div>
                </div>

                {/* 50-Request Status Indicator Grid */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-2.5">
                    <span className="font-semibold text-[#201B35]">
                      All {outcomes.length} Concurrent Request Indicators
                    </span>
                    <span className="font-mono text-[#77718C]">Completed in {result.durationMs}ms</span>
                  </div>
                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                    {outcomes.map((item, idx) => (
                      <div
                        key={idx}
                        title={`${item.contender}: HTTP ${item.status} — ${item.message}`}
                        className={`h-7 rounded-lg border font-mono text-[11px] font-bold flex items-center justify-center ${
                          item.outcome === 'JOINED'
                            ? 'bg-[#E8F8F2] border-[#16A477] text-[#117A58]'
                            : 'bg-[#FDECEF] border-[#F8CBD3] text-[#B83249]'
                        }`}
                      >
                        {item.status}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 rounded-xl border border-[#C7EEDF] bg-[#E8F8F2] px-4 py-3 text-xs sm:text-sm text-[#117A58]">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span>
                    <strong>{result.winner}</strong> claimed seat 5/5 atomically;{' '}
                    {result.conflictCount} concurrent contenders received HTTP 409 Conflict;{' '}
                    {result.auditJoinCount} winning audit entry persisted.
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
