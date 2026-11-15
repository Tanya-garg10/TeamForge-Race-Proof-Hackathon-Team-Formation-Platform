import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, ExternalLink, Plus, Save, User } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { apiFetch, ApiError } from '@/src/lib/api';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { UserAvatar } from '@/src/components/ui/avatar';
import { SkillTag, StatusBadge } from '@/src/components/ui/badge';
import { EmptyState } from '@/src/components/ui/empty-state';
import type { PublicUser } from '@/shared/types';

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [roleInput, setRoleInput] = useState('');
  const [experienceLevel, setExperienceLevel] = useState<PublicUser['experienceLevel']>('INTERMEDIATE');
  const [timezone, setTimezone] = useState('UTC');
  const [weeklyAvailability, setWeeklyAvailability] = useState(20);
  const [githubUrl, setGithubUrl] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setAvatarUrl(user.avatarUrl || '');
    setBio(user.bio || '');
    setSkills(user.skills);
    setRoles(user.preferredRoles);
    setExperienceLevel(user.experienceLevel);
    setTimezone(user.timezone);
    setWeeklyAvailability(user.weeklyAvailability);
    setGithubUrl(user.githubUrl || '');
    setPortfolioUrl(user.portfolioUrl || '');
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ user: PublicUser }>('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          avatarUrl: avatarUrl.trim() || null,
          bio: bio.trim() || null,
          skills,
          preferredRoles: roles,
          experienceLevel,
          timezone,
          weeklyAvailability: Number(weeklyAvailability),
          githubUrl: githubUrl.trim() || null,
          portfolioUrl: portfolioUrl.trim() || null,
        }),
      }),
    onSuccess: (res) => {
      setUser(res.user);
      setSavedNotice(true);
      toast.success('Profile updated');
      setTimeout(() => setSavedNotice(false), 3000);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Unable to save profile');
    },
  });

  if (!user) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <EmptyState
          icon={<User className="h-6 w-6" />}
          title="Sign in to customize your builder profile"
          description="Your skills, timezone, and weekly availability power TeamForge matching recommendations."
          action={
            <Button asChild>
              <Link to="/auth?redirect=/profile">Sign In</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const addSkill = () => {
    const val = skillInput.trim();
    if (!val) return;
    if (!skills.some((s) => s.toLowerCase() === val.toLowerCase())) {
      setSkills((prev) => [...prev, val]);
    }
    setSkillInput('');
  };

  const addRole = () => {
    const val = roleInput.trim();
    if (!val) return;
    if (!roles.some((r) => r.toLowerCase() === val.toLowerCase())) {
      setRoles((prev) => [...prev, val]);
    }
    setRoleInput('');
  };

  return (
    <div className="space-y-7 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <StatusBadge tone="violet">Participant Profile</StatusBadge>
          <h1 className="mt-2.5 text-3xl font-extrabold tracking-tight text-[#201B35]">
            My Profile
          </h1>
          <p className="mt-1 text-sm text-[#77718C]">
            Keep your stack, availability, and links updated for accurate teammate matching.
          </p>
        </div>
        {savedNotice && (
          <StatusBadge tone="success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            All changes saved
          </StatusBadge>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateMutation.mutate();
        }}
        className="space-y-6"
      >
        {/* Identity + Avatar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identity & Avatar</CardTitle>
            <CardDescription>Signed in as {user.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <UserAvatar name={name || user.name} avatarUrl={avatarUrl || null} size="xl" />
              <div className="flex-1 w-full space-y-1.5">
                <label htmlFor="prof-avatar" className="block text-sm font-semibold text-[#201B35]">
                  Profile photo URL
                </label>
                <Input
                  id="prof-avatar"
                  type="url"
                  placeholder="https://avatars.githubusercontent.com/..."
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="prof-name" className="block text-sm font-semibold text-[#201B35] mb-1.5">
                  Display name
                </label>
                <Input id="prof-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label htmlFor="prof-exp" className="block text-sm font-semibold text-[#201B35] mb-1.5">
                  Experience level
                </label>
                <select
                  id="prof-exp"
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value as PublicUser['experienceLevel'])}
                  className="flex h-10 w-full rounded-xl border border-[#ECE8F4] bg-white px-3 text-sm text-[#201B35]"
                >
                  <option value="BEGINNER">Beginner</option>
                  <option value="INTERMEDIATE">Intermediate</option>
                  <option value="ADVANCED">Advanced</option>
                  <option value="EXPERT">Expert</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="prof-bio" className="block text-sm font-semibold text-[#201B35] mb-1.5">
                Engineering bio
              </label>
              <Textarea
                id="prof-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share your background, hackathon strengths, and what you want to build..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Interactive Skill & Role Tags */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Skills & Preferred Roles</CardTitle>
            <CardDescription>
              Used directly in the 60% skill complementarity matching weight.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2.5">
              <label className="block text-sm font-semibold text-[#201B35]">Technical Skills</label>
              <div className="flex gap-2">
                <Input
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                  placeholder="Add a skill (e.g. TypeScript, PyTorch, PostgreSQL)..."
                />
                <Button type="button" variant="secondary" onClick={addSkill}>
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {skills.map((s) => (
                  <SkillTag
                    key={s}
                    matched
                    onRemove={() => setSkills((prev) => prev.filter((item) => item !== s))}
                  >
                    {s}
                  </SkillTag>
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              <label className="block text-sm font-semibold text-[#201B35]">Preferred Roles</label>
              <div className="flex gap-2">
                <Input
                  value={roleInput}
                  onChange={(e) => setRoleInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRole())}
                  placeholder="Add a role (e.g. Full-Stack Engineer, Product Designer)..."
                />
                <Button type="button" variant="secondary" onClick={addRole}>
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {roles.map((r) => (
                  <SkillTag
                    key={r}
                    onRemove={() => setRoles((prev) => prev.filter((item) => item !== r))}
                  >
                    {r}
                  </SkillTag>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Availability & Links */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Availability & Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="prof-tz" className="block text-sm font-semibold text-[#201B35] mb-1.5">
                  Time zone
                </label>
                <select
                  id="prof-tz"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="flex h-10 w-full rounded-xl border border-[#ECE8F4] bg-white px-3 text-sm text-[#201B35]"
                >
                  <option value="UTC">UTC</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (UTC-8)</option>
                  <option value="America/New_York">America/New_York (UTC-5)</option>
                  <option value="Europe/London">Europe/London (UTC+0)</option>
                  <option value="Europe/Berlin">Europe/Berlin (UTC+1)</option>
                  <option value="Asia/Kolkata">Asia/Kolkata (UTC+5:30)</option>
                  <option value="Asia/Singapore">Asia/Singapore (UTC+8)</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
                </select>
              </div>
              <div>
                <label htmlFor="prof-hours" className="block text-sm font-semibold text-[#201B35] mb-1.5">
                  Weekly availability (hours)
                </label>
                <Input
                  id="prof-hours"
                  type="number"
                  min={1}
                  max={168}
                  value={weeklyAvailability}
                  onChange={(e) => setWeeklyAvailability(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="prof-gh" className="block text-sm font-semibold text-[#201B35] mb-1.5">
                  GitHub URL
                </label>
                <Input
                  id="prof-gh"
                  type="url"
                  placeholder="https://github.com/username"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="prof-port" className="block text-sm font-semibold text-[#201B35] mb-1.5">
                  Portfolio URL
                </label>
                <Input
                  id="prof-port"
                  type="url"
                  placeholder="https://yoursite.dev"
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                />
              </div>
            </div>

            {(githubUrl || portfolioUrl) && (
              <div className="flex flex-wrap gap-4 text-xs text-[#7257E8] pt-1">
                {githubUrl && (
                  <a href={githubUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                    GitHub Preview <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {portfolioUrl && (
                  <a href={portfolioUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                    Portfolio Preview <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}

            <div className="pt-3 border-t border-[#ECE8F4] flex justify-end">
              <Button type="submit" size="lg" isLoading={updateMutation.isPending}>
                <Save className="h-4 w-4" />
                {updateMutation.isPending ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
