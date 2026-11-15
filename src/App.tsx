import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/src/context/AuthContext';
import { SocketProvider } from '@/src/context/SocketContext';
import { TooltipProvider } from '@/src/components/ui/tooltip';
import { Layout } from '@/src/components/Layout';
import { LandingPage } from '@/src/pages/LandingPage';
import { AuthPage } from '@/src/pages/AuthPage';
import { DashboardPage } from '@/src/pages/DashboardPage';
import { HackathonsPage, HackathonDetailPage } from '@/src/pages/HackathonsPage';
import { TeamsBoardPage } from '@/src/pages/TeamsBoardPage';
import { TeamDetailPage } from '@/src/pages/TeamDetailPage';
import { CreateTeamPage } from '@/src/pages/CreateTeamPage';
import { MyTeamPage } from '@/src/pages/MyTeamPage';
import { InvitationsPage } from '@/src/pages/InvitationsPage';
import { FindTeammatesPage } from '@/src/pages/FindTeammatesPage';
import { ProfilePage } from '@/src/pages/ProfilePage';
import { AuditLogPage } from '@/src/pages/AuditLogPage';
import { ConcurrencyLabPage } from '@/src/pages/ConcurrencyLabPage';
import { AcceptInvitePage } from '@/src/pages/AcceptInvitePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SocketProvider>
          <TooltipProvider>
            <BrowserRouter>
              <Layout>
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/hackathons" element={<HackathonsPage />} />
                  <Route path="/hackathons/:id" element={<HackathonDetailPage />} />
                  <Route path="/teams" element={<TeamsBoardPage />} />
                  <Route path="/teams/new" element={<CreateTeamPage />} />
                  <Route path="/teams/:id" element={<TeamDetailPage />} />
                  <Route path="/my-team" element={<MyTeamPage />} />
                  <Route path="/invitations" element={<InvitationsPage />} />
                  <Route path="/invitations/accept" element={<AcceptInvitePage />} />
                  <Route path="/teammates" element={<FindTeammatesPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/activity" element={<AuditLogPage />} />
                  <Route path="/audit" element={<AuditLogPage />} />
                  <Route path="/lab" element={<ConcurrencyLabPage />} />
                </Routes>
              </Layout>
              <Toaster position="bottom-right" richColors />
            </BrowserRouter>
          </TooltipProvider>
        </SocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
