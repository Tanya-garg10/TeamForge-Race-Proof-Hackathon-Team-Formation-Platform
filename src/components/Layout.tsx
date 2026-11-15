import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Compass,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Plus,
  Search,
  Sparkles,
  User,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { useSocket } from '@/src/context/SocketContext';
import { TeamForgeLogo } from './TeamForgeLogo';
import { Button } from './ui/button';
import { UserAvatar } from './ui/avatar';
import { DropdownMenu } from './ui/dropdown-menu';
import { StatusBadge } from './ui/badge';
import { cn, formatRelativeTime } from '@/src/lib/utils';

const SIDEBAR_ITEMS = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/teams', label: 'Discover Teams', icon: Compass },
  { to: '/hackathons', label: 'Hackathons', icon: CalendarDays },
  { to: '/my-team', label: 'My Team', icon: Users },
  { to: '/invitations', label: 'Invitations', icon: Mail },
  { to: '/teammates', label: 'Find Teammates', icon: Sparkles },
  { to: '/profile', label: 'My Profile', icon: User },
  { to: '/activity', label: 'Activity', icon: Activity },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { isConnected, notifications, unreadCount, markAllRead } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [publicMobileOpen, setPublicMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');

  const isPublicPage = location.pathname === '/' || location.pathname === '/auth';

  useEffect(() => {
    setMobileDrawerOpen(false);
    setPublicMobileOpen(false);
    setNotifOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = globalQuery.trim();
    if (!q) return;
    navigate(`/teams?search=${encodeURIComponent(q)}`);
  };

  if (isPublicPage) {
    return (
      <div className="min-h-screen flex flex-col bg-[#FAF9FF] text-[#201B35]">
        <header className="sticky top-0 z-40 border-b border-[#ECE8F4] bg-[#FAF9FF]/95 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6">
            <Link
              to="/"
              className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7257E8]"
            >
              <TeamForgeLogo />
            </Link>

            <nav
              aria-label="Primary navigation"
              className="hidden md:flex items-center gap-7 text-sm font-medium text-[#77718C]"
            >
              <a href="/#product" className="hover:text-[#201B35] transition-colors">
                Product
              </a>
              <Link to="/teams" className="hover:text-[#201B35] transition-colors">
                Explore Teams
              </Link>
              <Link to="/hackathons" className="hover:text-[#201B35] transition-colors">
                Hackathons
              </Link>
              <a href="/#how-it-works" className="hover:text-[#201B35] transition-colors">
                How It Works
              </a>
            </nav>

            <div className="hidden md:flex items-center gap-3">
              {user ? (
                <>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/dashboard">Open Workspace</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link to="/teams/new">
                      <Plus className="h-4 w-4" />
                      Create Team
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/auth">Sign In</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link to="/auth?mode=register">Get Started</Link>
                  </Button>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setPublicMobileOpen((p) => !p)}
              aria-label="Toggle menu"
              className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#ECE8F4] bg-white text-[#201B35] cursor-pointer"
            >
              {publicMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          {publicMobileOpen && (
            <div className="md:hidden border-t border-[#ECE8F4] bg-white px-6 py-4 space-y-3">
              <a
                href="/#product"
                onClick={() => setPublicMobileOpen(false)}
                className="block py-1.5 text-sm font-medium text-[#201B35]"
              >
                Product
              </a>
              <Link
                to="/teams"
                className="block py-1.5 text-sm font-medium text-[#201B35]"
              >
                Explore Teams
              </Link>
              <Link
                to="/hackathons"
                className="block py-1.5 text-sm font-medium text-[#201B35]"
              >
                Hackathons
              </Link>
              <a
                href="/#how-it-works"
                onClick={() => setPublicMobileOpen(false)}
                className="block py-1.5 text-sm font-medium text-[#201B35]"
              >
                How It Works
              </a>
              <div className="pt-2 border-t border-[#ECE8F4] flex items-center gap-3">
                {user ? (
                  <Button asChild className="w-full">
                    <Link to="/dashboard">Go to Dashboard</Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild variant="outline" className="flex-1">
                      <Link to="/auth">Sign In</Link>
                    </Button>
                    <Button asChild className="flex-1">
                      <Link to="/auth?mode=register">Get Started</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-[#ECE8F4] bg-white">
          <div className="mx-auto max-w-7xl px-6 py-12">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-8 border-b border-[#ECE8F4]">
              <div className="md:col-span-5 space-y-3">
                <TeamForgeLogo />
                <p className="text-sm text-[#77718C] max-w-sm leading-relaxed">
                  Race-proof hackathon team formation with transactional seat locking, transparent
                  skill matching, and real-time squad synchronization.
                </p>
              </div>
              <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-6 text-sm">
                <div className="space-y-2.5">
                  <p className="font-bold text-[#201B35] text-xs uppercase tracking-wider">Platform</p>
                  <Link to="/teams" className="block text-[#77718C] hover:text-[#7257E8]">
                    Discover Teams
                  </Link>
                  <Link to="/hackathons" className="block text-[#77718C] hover:text-[#7257E8]">
                    Hackathons
                  </Link>
                  <Link to="/teammates" className="block text-[#77718C] hover:text-[#7257E8]">
                    Find Teammates
                  </Link>
                </div>
                <div className="space-y-2.5">
                  <p className="font-bold text-[#201B35] text-xs uppercase tracking-wider">Engineering</p>
                  <Link to="/lab" className="block text-[#77718C] hover:text-[#7257E8]">
                    Concurrency Lab
                  </Link>
                  <Link to="/activity" className="block text-[#77718C] hover:text-[#7257E8]">
                    Activity Timeline
                  </Link>
                  <Link to="/invitations/accept" className="block text-[#77718C] hover:text-[#7257E8]">
                    Redeem Invite
                  </Link>
                </div>
                <div className="space-y-2.5">
                  <p className="font-bold text-[#201B35] text-xs uppercase tracking-wider">Workspace</p>
                  <Link to="/dashboard" className="block text-[#77718C] hover:text-[#7257E8]">
                    Overview
                  </Link>
                  <Link to="/teams/new" className="block text-[#77718C] hover:text-[#7257E8]">
                    Create Team
                  </Link>
                  <Link to="/auth" className="block text-[#77718C] hover:text-[#7257E8]">
                    Sign In
                  </Link>
                </div>
              </div>
            </div>
            <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-[#77718C]">
              <span>© {new Date().getFullYear()} TeamForge. Engineered for zero-overbooking team formation.</span>
              <span className="font-mono">WAL Transactional Core · Socket.IO Live</span>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#FAF9FF] text-[#201B35]">
      {/* Desktop Left Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col shrink-0 border-r border-[#ECE8F4] bg-white sticky top-0 h-screen transition-all duration-200 z-30',
          sidebarCollapsed ? 'w-[76px]' : 'w-[252px]',
        )}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-[#ECE8F4]">
          <Link to="/" className="overflow-hidden">
            <TeamForgeLogo showWordmark={!sidebarCollapsed} />
          </Link>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="h-8 w-8 rounded-lg border border-[#ECE8F4] text-[#77718C] hover:bg-[#F3F0FF] hover:text-[#201B35] flex items-center justify-center cursor-pointer shrink-0"
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <div className="p-3">
          <Button asChild className={cn('w-full', sidebarCollapsed && 'px-0')}>
            <Link to="/teams/new" title="Create Team">
              <Plus className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && <span>Create Team</span>}
            </Link>
          </Button>
        </div>

        <nav aria-label="Workspace navigation" className="flex-1 px-3 py-1 space-y-1 overflow-y-auto">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={sidebarCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                    sidebarCollapsed && 'justify-center px-0',
                    isActive
                      ? 'bg-[#EAE5FF] text-[#4338A8] font-semibold'
                      : 'text-[#77718C] hover:bg-[#F3F0FF]/70 hover:text-[#201B35]',
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[#ECE8F4] space-y-2">
          <NavLink
            to="/lab"
            title={sidebarCollapsed ? 'Concurrency Lab' : undefined}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition-colors border',
                sidebarCollapsed && 'justify-center px-0',
                isActive
                  ? 'bg-[#4338A8] border-[#4338A8] text-white'
                  : 'bg-[#FAF9FF] border-[#ECE8F4] text-[#4338A8] hover:bg-[#EAE5FF]/70',
              )
            }
          >
            <FlaskConical className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span>50-Seat Concurrency Lab</span>}
          </NavLink>
          {!sidebarCollapsed && (
            <div className="flex items-center justify-between px-2 py-1 text-[11px] text-[#77718C]">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    isConnected ? 'bg-[#16A477]' : 'bg-[#E9A23B]',
                  )}
                />
                {isConnected ? 'Live sync active' : 'Reconnecting...'}
              </span>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#201B35]/35 backdrop-blur-[2px]"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <aside className="relative z-10 w-72 max-w-[85vw] bg-white h-full border-r border-[#ECE8F4] flex flex-col">
            <div className="h-16 px-4 flex items-center justify-between border-b border-[#ECE8F4]">
              <Link to="/" onClick={() => setMobileDrawerOpen(false)}>
                <TeamForgeLogo />
              </Link>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Close menu"
                className="h-9 w-9 rounded-xl border border-[#ECE8F4] flex items-center justify-center text-[#77718C]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-3">
              <Button asChild className="w-full">
                <Link to="/teams/new" onClick={() => setMobileDrawerOpen(false)}>
                  <Plus className="h-4 w-4" />
                  Create Team
                </Link>
              </Button>
            </div>
            <nav className="flex-1 px-3 py-1 space-y-1 overflow-y-auto">
              {SIDEBAR_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileDrawerOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium',
                        isActive
                          ? 'bg-[#EAE5FF] text-[#4338A8] font-semibold'
                          : 'text-[#77718C] hover:bg-[#F3F0FF] hover:text-[#201B35]',
                      )
                    }
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
              <NavLink
                to="/lab"
                onClick={() => setMobileDrawerOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium mt-2 border border-[#ECE8F4]',
                    isActive ? 'bg-[#4338A8] text-white' : 'bg-[#FAF9FF] text-[#4338A8]',
                  )
                }
              >
                <FlaskConical className="h-4 w-4" />
                <span>Concurrency Lab</span>
              </NavLink>
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 h-16 border-b border-[#ECE8F4] bg-white/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Open navigation"
              className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#ECE8F4] bg-white text-[#201B35] cursor-pointer shrink-0"
            >
              <Menu className="h-4 w-4" />
            </button>

            <form onSubmit={handleGlobalSearch} className="relative max-w-md w-full hidden sm:block">
              <Search className="h-4 w-4 text-[#77718C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={globalQuery}
                onChange={(e) => setGlobalQuery(e.target.value)}
                placeholder="Search teams, skills, or hackathons..."
                aria-label="Global search"
                className="h-9 w-full rounded-xl border border-[#ECE8F4] bg-[#FAF9FF] pl-9 pr-3 text-sm text-[#201B35] placeholder:text-[#77718C]/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7257E8]/25 focus:border-[#7257E8]"
              />
            </form>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Notification Center */}
            <div className="relative">
              <button
                type="button"
                aria-label="Notifications"
                onClick={() => {
                  setNotifOpen((o) => !o);
                  if (!notifOpen && unreadCount > 0) markAllRead();
                }}
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#ECE8F4] bg-white text-[#77718C] hover:bg-[#F3F0FF] hover:text-[#201B35] cursor-pointer"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-[#7257E8] text-white text-[10px] font-mono font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-[#ECE8F4] bg-white p-3 tf-elevated-shadow z-50">
                  <div className="flex items-center justify-between px-2 pb-2.5 border-b border-[#ECE8F4]">
                    <span className="text-sm font-bold text-[#201B35]">Live Activity Feed</span>
                    <StatusBadge tone={isConnected ? 'success' : 'warning'}>
                      {isConnected ? 'Connected' : 'Offline'}
                    </StatusBadge>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-[#ECE8F4]/70">
                    {notifications.length === 0 ? (
                      <div className="py-8 px-4 text-center text-xs text-[#77718C]">
                        Real-time team joins, leadership transfers, and invitation alerts appear here.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} className="px-2 py-2.5 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-[#201B35]">{n.title}</span>
                            <span className="font-mono text-[10px] text-[#77718C]">
                              {formatRelativeTime(n.createdAt)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[#77718C]">{n.description}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="pt-2 border-t border-[#ECE8F4] text-right">
                    <Link
                      to="/activity"
                      onClick={() => setNotifOpen(false)}
                      className="text-xs font-semibold text-[#7257E8] hover:text-[#4338A8]"
                    >
                      View full activity timeline →
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {user ? (
              <DropdownMenu
                trigger={
                  <button
                    type="button"
                    className="inline-flex items-center gap-2.5 rounded-xl border border-[#ECE8F4] bg-white pl-1.5 pr-3 py-1 hover:bg-[#F3F0FF]/60 transition-colors cursor-pointer"
                  >
                    <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />
                    <span className="hidden sm:inline text-sm font-semibold text-[#201B35] max-w-[130px] truncate">
                      {user.name}
                    </span>
                  </button>
                }
              >
                <div className="px-3 py-2 border-b border-[#ECE8F4] mb-1">
                  <p className="text-xs font-bold text-[#201B35] truncate">{user.name}</p>
                  <p className="text-xs text-[#77718C] truncate">{user.email}</p>
                </div>
                <Link
                  to="/profile"
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-[#201B35] hover:bg-[#F3F0FF]"
                >
                  <User className="h-4 w-4 text-[#77718C]" />
                  My Profile
                </Link>
                <Link
                  to="/my-team"
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-[#201B35] hover:bg-[#F3F0FF]"
                >
                  <Users className="h-4 w-4 text-[#77718C]" />
                  My Team
                </Link>
                <Link
                  to="/invitations"
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-[#201B35] hover:bg-[#F3F0FF]"
                >
                  <Mail className="h-4 w-4 text-[#77718C]" />
                  Invitations
                </Link>
                <Link
                  to="/lab"
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-[#4338A8] hover:bg-[#F3F0FF]"
                >
                  <FlaskConical className="h-4 w-4" />
                  Concurrency Lab
                </Link>
                <div className="my-1 border-t border-[#ECE8F4]" />
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-[#E15B70] hover:bg-[#FDECEF] cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </DropdownMenu>
            ) : (
              <Button asChild size="sm">
                <Link to={`/auth?redirect=${encodeURIComponent(location.pathname)}`}>Sign In</Link>
              </Button>
            )}
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-7 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
