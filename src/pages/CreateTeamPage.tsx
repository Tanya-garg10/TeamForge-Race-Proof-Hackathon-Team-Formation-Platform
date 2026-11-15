import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Plus, Sparkles, Users } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { apiFetch, ApiError } from '@/src/lib/api';
import { formatDeadline } from '@/src/lib/utils';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { FilterChip, SkillTag, StatusBadge } from '@/src/components/ui/badge';
import { Progress } from '@/src/components/ui/progress';
import { AvatarStack } from '@/src/components/ui/avatar';
import { EmptyState } from '@/src/components/ui/empty-state';
import type { Hackathon, TeamDTO } from '@/shared/types';

const STEPS = [
  '1. Select hackathon',
  '2. Team identity',
  '3. Team description',
  '4. Required skills',
  '5. Team size',
  '6. Review & create',
];

const SUGGESTED_SKILLS = [
  'TypeScript',
  'React',
  'Node.js',
  'PostgreSQL',
  'Python',
  'PyTorch',
  'Docker',
  'GraphQL',
  'UI/UX',
  'Rust',
  'Go',
  'Tailwind CSS',
];

export function CreateTeamPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const preselectedHackathon = searchParams.get('hackathonId') || '';

  const [step, setStep] = useState(0);
  const [hackathonId, setHackathonId] = useState(preselectedHackathon);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState<string[]>(['TypeScript', 'React']);
  const [customSkill, setCustomSkill] = useState('');
  const [minSize, setMinSize] = useState(2);
  const [maxSize, setMaxSize] = useState(4);
  const [stepError, setStepError] = useState<string | null>(null);

  const { data: hackathonsData } = useQuery({
    queryKey: ['hackathons', 'wizard'],
    queryFn: () => apiFetch<{ items: Hackathon[] }>('/api/hackathons?limit=25&openOnly=true'),
  });

  const hackathons = hackathonsData?.items ?? [];

  useEffect(() => {
    if (!hackathonId && hackathons.length > 0) {
      setHackathonId(hackathons[0].id);
    }
  }, [hackathonId, hackathons]);

  const selectedHackathon = hackathons.find((h) => h.id === hackathonId);

  useEffect(() => {
    if (selectedHackathon) {
      setMinSize((prev) => Math.max(selectedHackathon.minTeamSize, Math.min(prev, selectedHackathon.maxTeamSize)));
      setMaxSize((prev) => Math.max(selectedHackathon.minTeamSize, Math.min(prev, selectedHackathon.maxTeamSize)));
    }
  }, [selectedHackathon?.id]);

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ team: TeamDTO }>('/api/teams', {
        method: 'POST',
        body: JSON.stringify({
          hackathonId,
          name: name.trim(),
          description: description.trim(),
          requiredSkills: skills,
          minSize: Number(minSize),
          maxSize: Number(maxSize),
        }),
      }),
    onSuccess: (res) => {
      toast.success(`Team "${res.team.name}" created — you are the team leader`);
      void queryClient.invalidateQueries({ queryKey: ['teams'] });
      void queryClient.invalidateQueries({ queryKey: ['my-teams'] });
      navigate(`/teams/${res.team.id}`);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Unable to create team');
    },
  });

  if (!user) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="Sign in to create a team"
          description="You'll automatically become the initial team leader and can invite teammates or open seats immediately."
          action={
            <Button asChild>
              <Link to="/auth?redirect=/teams/new">Sign In</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const toggleSkill = (sk: string) => {
    setSkills((prev) =>
      prev.includes(sk) ? prev.filter((item) => item !== sk) : [...prev, sk],
    );
  };

  const addCustomSkill = () => {
    const trimmed = customSkill.trim();
    if (!trimmed) return;
    if (!skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setSkills((prev) => [...prev, trimmed]);
    }
    setCustomSkill('');
  };

  const validateCurrentStep = (): boolean => {
    setStepError(null);
    if (step === 0 && !hackathonId) {
      setStepError('Please select a hackathon for your team.');
      return false;
    }
    if (step === 1 && name.trim().length < 3) {
      setStepError('Team name must be at least 3 characters.');
      return false;
    }
    if (step === 2 && description.trim().length < 10) {
      setStepError('Add at least 10 characters describing what your team is building.');
      return false;
    }
    if (step === 3 && skills.length === 0) {
      setStepError('Select at least one required skill.');
      return false;
    }
    if (step === 4) {
      const hMin = selectedHackathon?.minTeamSize ?? 2;
      const hMax = selectedHackathon?.maxTeamSize ?? 6;
      if (minSize < hMin || maxSize > hMax || minSize > maxSize) {
        setStepError(`Team size must be within ${hMin} and ${hMax}, with min <= max.`);
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const progressPct = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div className="space-y-7 max-w-6xl mx-auto">
      <div>
        <Link
          to="/teams"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#77718C] hover:text-[#201B35]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Discover Teams
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#201B35]">
          Launch Your Hackathon Squad
        </h1>
        <p className="mt-1 text-sm text-[#77718C]">
          Follow the 6-step builder to configure your hackathon rules, skills, and seat capacity.
        </p>
      </div>

      {/* Stepper Progress */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#4338A8]">{STEPS[step]}</span>
            <span className="font-mono font-semibold tabular-nums text-[#77718C]">
              Step {step + 1} of {STEPS.length} ({progressPct}%)
            </span>
          </div>
          <Progress value={progressPct} />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {STEPS.map((label, idx) => (
              <button
                key={label}
                type="button"
                onClick={() => idx <= step && setStep(idx)}
                className={`text-left rounded-xl border px-3 py-2 text-[11px] font-semibold transition-all ${
                  idx === step
                    ? 'bg-[#EAE5FF] border-[#7257E8] text-[#4338A8]'
                    : idx < step
                      ? 'bg-[#FAF9FF] border-[#ECE8F4] text-[#16A477] cursor-pointer'
                      : 'bg-white border-[#ECE8F4] text-[#77718C] opacity-60 cursor-not-allowed'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        {/* Wizard Form Panel */}
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>{STEPS[step]}</CardTitle>
            <CardDescription>
              {step === 0 && 'Choose which hackathon event your squad will compete in.'}
              {step === 1 && 'Give your squad a memorable name that stands out on the board.'}
              {step === 2 && 'Describe the problem you are tackling and the collaborators you need.'}
              {step === 3 && 'Pick the technical skills and roles your team needs to cover.'}
              {step === 4 && 'Set minimum and maximum team sizes within the hackathon rules.'}
              {step === 5 && 'Confirm your details before creating the team transactionally.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {stepError && (
              <div className="rounded-xl border border-[#F8CBD3] bg-[#FDECEF] px-4 py-3 text-xs font-medium text-[#B83249]">
                {stepError}
              </div>
            )}

            {step === 0 && (
              <div className="space-y-3">
                {hackathons.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setHackathonId(h.id)}
                    className={`w-full text-left rounded-xl border p-4 transition-all cursor-pointer ${
                      hackathonId === h.id
                        ? 'border-[#7257E8] bg-[#F3F0FF]/80 ring-2 ring-[#7257E8]/20'
                        : 'border-[#ECE8F4] bg-white hover:bg-[#FAF9FF]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-[#201B35]">{h.name}</span>
                      <StatusBadge tone={hackathonId === h.id ? 'violet' : 'neutral'}>
                        {h.minTeamSize}–{h.maxTeamSize} seats
                      </StatusBadge>
                    </div>
                    <p className="mt-1 text-xs text-[#77718C]">
                      {h.theme} · {formatDeadline(h.registrationDeadline)}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-2">
                <label htmlFor="wiz-name" className="block text-sm font-semibold text-[#201B35]">
                  Team name
                </label>
                <Input
                  id="wiz-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. VectorMesh Collective"
                />
                <p className="text-xs text-[#77718C]">
                  Keep it concise and descriptive (3–80 characters).
                </p>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-2">
                <label htmlFor="wiz-desc" className="block text-sm font-semibold text-[#201B35]">
                  Project pitch & goals
                </label>
                <Textarea
                  id="wiz-desc"
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="We are building an edge-deployed telemetry router with a live React visualization..."
                />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_SKILLS.map((sk) => (
                    <FilterChip
                      key={sk}
                      active={skills.includes(sk)}
                      onClick={() => toggleSkill(sk)}
                    >
                      {skills.includes(sk) && <Check className="h-3 w-3" />}
                      {sk}
                    </FilterChip>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={customSkill}
                    onChange={(e) => setCustomSkill(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomSkill())}
                    placeholder="Add custom skill (e.g. WebSockets, Kubernetes)..."
                  />
                  <Button type="button" variant="secondary" onClick={addCustomSkill}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {skills.map((sk) => (
                    <SkillTag key={sk} matched onRemove={() => toggleSkill(sk)}>
                      {sk}
                    </SkillTag>
                  ))}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="wiz-min" className="block text-sm font-semibold text-[#201B35] mb-1.5">
                    Minimum size
                  </label>
                  <Input
                    id="wiz-min"
                    type="number"
                    min={selectedHackathon?.minTeamSize ?? 1}
                    max={selectedHackathon?.maxTeamSize ?? 10}
                    value={minSize}
                    onChange={(e) => setMinSize(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label htmlFor="wiz-max" className="block text-sm font-semibold text-[#201B35] mb-1.5">
                    Maximum capacity
                  </label>
                  <Input
                    id="wiz-max"
                    type="number"
                    min={selectedHackathon?.minTeamSize ?? 2}
                    max={selectedHackathon?.maxTeamSize ?? 10}
                    value={maxSize}
                    onChange={(e) => setMaxSize(Number(e.target.value))}
                  />
                </div>
                {selectedHackathon && (
                  <p className="sm:col-span-2 text-xs text-[#77718C]">
                    Hackathon rules allow between {selectedHackathon.minTeamSize} and{' '}
                    {selectedHackathon.maxTeamSize} members.
                  </p>
                )}
              </div>
            )}

            {step === 5 && (
              <div className="rounded-xl border border-[#ECE8F4] bg-[#FAF9FF] p-5 space-y-3 text-sm">
                <div className="flex items-center gap-2 text-[#16A477] font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Ready for atomic team creation</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2">
                  <div>
                    <span className="text-[#77718C]">Hackathon</span>
                    <p className="font-bold text-[#201B35] mt-0.5">{selectedHackathon?.name}</p>
                  </div>
                  <div>
                    <span className="text-[#77718C]">Capacity</span>
                    <p className="font-mono font-bold text-[#201B35] mt-0.5">
                      {minSize}–{maxSize} seats (1 filled by you)
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[#77718C]">Required Skills</span>
                    <p className="font-semibold text-[#201B35] mt-0.5">{skills.join(' · ')}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-[#ECE8F4] flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={step === 0}
                onClick={() => {
                  setStepError(null);
                  setStep((s) => Math.max(0, s - 1));
                }}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>

              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={handleNext}>
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  isLoading={createMutation.isPending}
                  onClick={() => createMutation.mutate()}
                >
                  <Plus className="h-4 w-4" />
                  Create Team
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Live Team Card Preview */}
        <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#77718C]">
            <Sparkles className="h-3.5 w-3.5 text-[#7257E8]" />
            Live Marketplace Preview
          </div>
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#7257E8] to-[#4338A8] text-white font-bold text-sm flex items-center justify-center shrink-0">
                    {(name.trim() || 'TF').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-bold text-[#201B35] truncate">
                      {name.trim() || 'Your Team Name'}
                    </p>
                    <p className="text-xs text-[#77718C] truncate">
                      {selectedHackathon?.name || 'Select a hackathon'}
                    </p>
                  </div>
                </div>
                <StatusBadge tone="violet">
                  {Math.max(0, maxSize - 1)} open
                </StatusBadge>
              </div>

              <p className="text-sm text-[#77718C] leading-relaxed">
                {description.trim() ||
                  'Your project description and collaboration goals will appear here so matching builders understand your vision.'}
              </p>

              <div className="flex flex-wrap gap-1.5">
                {skills.map((s) => (
                  <SkillTag key={s} matched>
                    {s}
                  </SkillTag>
                ))}
              </div>

              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[#77718C]">Team capacity</span>
                  <span className="font-mono font-semibold tabular-nums text-[#201B35]">
                    1/{maxSize} seats
                  </span>
                </div>
                <Progress value={Math.round((1 / Math.max(1, maxSize)) * 100)} />
              </div>

              <div className="pt-3 border-t border-[#ECE8F4] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AvatarStack members={[{ name: user.name, avatarUrl: user.avatarUrl }]} size="xs" />
                  <span className="text-xs text-[#77718C]">{user.name} (Leader)</span>
                </div>
                <span className="text-xs font-semibold text-[#7257E8]">Preview</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
