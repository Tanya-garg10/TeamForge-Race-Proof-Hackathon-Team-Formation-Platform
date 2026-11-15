import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { CheckCircle2, Eye, EyeOff, Lock, LogIn, ShieldCheck, Sparkles, UserPlus } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { ApiError } from '@/src/lib/api';
import { loginSchema, registerSchema } from '@/shared/validation';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Card, CardContent } from '@/src/components/ui/card';
import { StatusBadge } from '@/src/components/ui/badge';
import { UserAvatar } from '@/src/components/ui/avatar';
import { TeamForgeLogo } from '@/src/components/TeamForgeLogo';

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormInput = z.input<typeof registerSchema>;
type RegisterFormOutput = z.output<typeof registerSchema>;

const DEMO_ACCOUNTS = [
  {
    name: 'Alice Chen',
    role: 'Team Leader · Systems & Lab Admin',
    email: 'alice@teamforge.dev',
    password: 'Password123!',
  },
  {
    name: 'Marcus Vance',
    role: 'Frontend Lead · UI/UX',
    email: 'bob@teamforge.dev',
    password: 'Password123!',
  },
  {
    name: 'Priya Nair',
    role: 'ML Engineer · Python',
    email: 'carol@teamforge.dev',
    password: 'Password123!',
  },
  {
    name: 'Nadia Park',
    role: 'Platform Admin · Concurrency Lab',
    email: 'admin@teamforge.dev',
    password: 'Password123!',
  },
];

export function AuthPage() {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [skillsInput, setSkillsInput] = useState('TypeScript, React, PostgreSQL');

  const { login, register: registerUser, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const redirectTo = searchParams.get('redirect') || '/dashboard';

  useEffect(() => {
    if (searchParams.get('mode') === 'register') setMode('register');
  }, [searchParams]);

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const registerForm = useForm<RegisterFormInput, unknown, RegisterFormOutput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      timezone: 'America/Los_Angeles',
      skills: ['TypeScript', 'React'],
      preferredRoles: ['Full-Stack Engineer'],
      weeklyAvailability: 20,
      experienceLevel: 'INTERMEDIATE',
    },
  });

  const handleLoginSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    try {
      await login(values.email, values.password);
      toast.success('Signed in to TeamForge');
      navigate(redirectTo);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Unable to sign in');
    }
  };

  const handleDemoLogin = async (email: string, password: string) => {
    setServerError(null);
    try {
      await login(email, password);
      toast.success(`Signed in as ${email}`);
      navigate(redirectTo);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Demo sign-in failed');
    }
  };

  const handleRegisterSubmit = async (values: RegisterFormOutput) => {
    setServerError(null);
    const parsedSkills = skillsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await registerUser({
        ...values,
        skills: parsedSkills,
      });
      toast.success('Account created — welcome to TeamForge');
      navigate(redirectTo);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Registration failed');
    }
  };

  const handleGoogleSignIn = async () => {
    setServerError(null);
    try {
      await loginWithGoogle();
      toast.success('Signed in with Google');
      navigate(redirectTo);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Google Sign-In failed or was cancelled');
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 lg:py-14">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left Brand Illustration & Architecture Panel */}
        <div className="lg:col-span-5 rounded-3xl border border-[#DCD4FA] bg-gradient-to-br from-[#F3F0FF] via-white to-[#EAE5FF]/80 p-7 sm:p-9 flex flex-col justify-between tf-card-shadow">
          <div className="space-y-6">
            <TeamForgeLogo size="lg" />
            <div>
              <StatusBadge tone="violet">Collaborative Workspace</StatusBadge>
              <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#201B35]">
                Build balanced teams without the chaos.
              </h1>
              <p className="mt-2.5 text-sm text-[#77718C] leading-relaxed">
                Discover teammates with complementary stacks, claim open seats atomically, and keep
                your squad synchronized in real time.
              </p>
            </div>

            {/* Clean geometric connected squad graphic */}
            <div className="rounded-2xl border border-[#ECE8F4] bg-white p-5 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#201B35] inline-flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[#7257E8]" />
                  Live Team Formation Guarantees
                </span>
                <span className="font-mono text-[#16A477] font-semibold">ACTIVE</span>
              </div>
              <div className="space-y-2.5 text-xs text-[#77718C]">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-[#16A477] shrink-0" />
                  <span>Exclusive row locking on every seat claim</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-[#16A477] shrink-0" />
                  <span>Transparent 60/25/15 compatibility explanations</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-[#16A477] shrink-0" />
                  <span>SHA-256 hashed invitations & audit history</span>
                </div>
              </div>
            </div>
          </div>

          {/* Seeded Demo Accounts for fast evaluation */}
          <div className="mt-8 pt-6 border-t border-[#ECE8F4] space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4338A8]">
                <Lock className="h-3.5 w-3.5" />
                Instant Demo Accounts
              </span>
              <code className="font-mono text-[11px] bg-white border border-[#ECE8F4] px-2 py-0.5 rounded-md text-[#201B35]">
                Password123!
              </code>
            </div>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <div
                  key={acc.email}
                  className="flex items-center justify-between gap-2.5 rounded-xl border border-[#ECE8F4] bg-white p-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <UserAvatar name={acc.name} size="sm" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#201B35] truncate">{acc.name}</p>
                      <p className="text-[11px] text-[#77718C] truncate">{acc.role}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => handleDemoLogin(acc.email, acc.password)}
                  >
                    Use
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Minimal Form */}
        <div className="lg:col-span-7">
          <Card className="h-full">
            <CardContent className="p-7 sm:p-10 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight text-[#201B35]">
                    {mode === 'login' ? 'Welcome back' : 'Create your account'}
                  </h2>
                  <p className="mt-1 text-sm text-[#77718C]">
                    {mode === 'login'
                      ? 'Sign in to access your teams, matches, and invitations.'
                      : 'Set your skills and timezone to unlock smart teammate matches.'}
                  </p>
                </div>

                <div className="inline-flex items-center gap-1 rounded-xl border border-[#ECE8F4] bg-[#F3F0FF]/70 p-1 w-fit shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setServerError(null);
                    }}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      mode === 'login'
                        ? 'bg-white text-[#201B35] shadow-xs'
                        : 'text-[#77718C] hover:text-[#201B35]'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setServerError(null);
                    }}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      mode === 'register'
                        ? 'bg-white text-[#201B35] shadow-xs'
                        : 'text-[#77718C] hover:text-[#201B35]'
                    }`}
                  >
                    Create Account
                  </button>
                </div>
              </div>

              {serverError && (
                <div
                  role="alert"
                  className="rounded-xl border border-[#F8CBD3] bg-[#FDECEF] px-4 py-3 text-sm text-[#B83249]"
                >
                  {serverError}
                </div>
              )}

              {mode === 'login' ? (
                <form onSubmit={loginForm.handleSubmit(handleLoginSubmit)} className="space-y-4">
                  <div>
                    <label htmlFor="login-email" className="block text-sm font-semibold text-[#201B35] mb-1.5">
                      Email address
                    </label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="alice@teamforge.dev"
                      {...loginForm.register('email')}
                    />
                    {loginForm.formState.errors.email && (
                      <p className="mt-1 text-xs text-[#E15B70]">
                        {loginForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="login-password" className="block text-sm font-semibold text-[#201B35] mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="pr-10"
                        {...loginForm.register('password')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#77718C] hover:text-[#201B35] cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {loginForm.formState.errors.password && (
                      <p className="mt-1 text-xs text-[#E15B70]">
                        {loginForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    isLoading={loginForm.formState.isSubmitting}
                  >
                    <LogIn className="h-4 w-4" />
                    {loginForm.formState.isSubmitting ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
              ) : (
                <form onSubmit={registerForm.handleSubmit(handleRegisterSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="reg-name" className="block text-sm font-semibold text-[#201B35] mb-1.5">
                        Full name
                      </label>
                      <Input id="reg-name" placeholder="Jordan Taylor" {...registerForm.register('name')} />
                      {registerForm.formState.errors.name && (
                        <p className="mt-1 text-xs text-[#E15B70]">
                          {registerForm.formState.errors.name.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="reg-email" className="block text-sm font-semibold text-[#201B35] mb-1.5">
                        Email
                      </label>
                      <Input
                        id="reg-email"
                        type="email"
                        placeholder="jordan@example.com"
                        {...registerForm.register('email')}
                      />
                      {registerForm.formState.errors.email && (
                        <p className="mt-1 text-xs text-[#E15B70]">
                          {registerForm.formState.errors.email.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="reg-password" className="block text-sm font-semibold text-[#201B35] mb-1.5">
                        Password (min 8 chars)
                      </label>
                      <div className="relative">
                        <Input
                          id="reg-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="At least 8 characters"
                          className="pr-10"
                          {...registerForm.register('password')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((s) => !s)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#77718C] hover:text-[#201B35] cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {registerForm.formState.errors.password && (
                        <p className="mt-1 text-xs text-[#E15B70]">
                          {registerForm.formState.errors.password.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="reg-tz" className="block text-sm font-semibold text-[#201B35] mb-1.5">
                        Time zone
                      </label>
                      <select
                        id="reg-tz"
                        className="flex h-10 w-full rounded-xl border border-[#ECE8F4] bg-white px-3 text-sm text-[#201B35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7257E8]/30"
                        {...registerForm.register('timezone')}
                      >
                        <option value="America/Los_Angeles">America/Los_Angeles (UTC-8)</option>
                        <option value="America/New_York">America/New_York (UTC-5)</option>
                        <option value="Europe/London">Europe/London (UTC+0)</option>
                        <option value="Europe/Berlin">Europe/Berlin (UTC+1)</option>
                        <option value="Asia/Kolkata">Asia/Kolkata (UTC+5:30)</option>
                        <option value="Asia/Singapore">Asia/Singapore (UTC+8)</option>
                        <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="reg-exp" className="block text-sm font-semibold text-[#201B35] mb-1.5">
                        Experience level
                      </label>
                      <select
                        id="reg-exp"
                        className="flex h-10 w-full rounded-xl border border-[#ECE8F4] bg-white px-3 text-sm text-[#201B35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7257E8]/30"
                        {...registerForm.register('experienceLevel')}
                      >
                        <option value="BEGINNER">Beginner</option>
                        <option value="INTERMEDIATE">Intermediate</option>
                        <option value="ADVANCED">Advanced</option>
                        <option value="EXPERT">Expert</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="reg-hours" className="block text-sm font-semibold text-[#201B35] mb-1.5">
                        Weekly availability (hours)
                      </label>
                      <Input
                        id="reg-hours"
                        type="number"
                        min={1}
                        max={100}
                        {...registerForm.register('weeklyAvailability', { valueAsNumber: true })}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-skills" className="block text-sm font-semibold text-[#201B35] mb-1.5">
                      Primary skills (comma-separated)
                    </label>
                    <Input
                      id="reg-skills"
                      value={skillsInput}
                      onChange={(e) => setSkillsInput(e.target.value)}
                      placeholder="TypeScript, React, PostgreSQL"
                    />
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    isLoading={registerForm.formState.isSubmitting}
                  >
                    <UserPlus className="h-4 w-4" />
                    {registerForm.formState.isSubmitting ? 'Creating account...' : 'Create Account'}
                  </Button>
                </form>
              )}

              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-[#ECE8F4]" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-[#77718C]">or continue with</span>
                </div>
              </div>

              <Button type="button" variant="outline" size="lg" className="w-full" onClick={handleGoogleSignIn}>
                <ShieldCheck className="h-4 w-4 text-[#7257E8]" />
                Continue with Google
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
