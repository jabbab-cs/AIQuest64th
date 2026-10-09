import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Redirect,
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

import Landing from '@/pages/Landing';
import InstitutionPortal from '@/pages/InstitutionPortal';
import InstitutionVerification from '@/pages/InstitutionVerification';
import Site from '@/pages/Site';
import BankInbox from '@/pages/bank/Inbox';
import BankOverview from '@/pages/bank/Overview';
import BankFiles from '@/pages/bank/Files';
import BankDataChecks from '@/pages/bank/DataChecks';
import BankCompliance from '@/pages/bank/Compliance';
import BankAnalysis from '@/pages/bank/Analysis';
import BankReport from '@/pages/bank/Report';
import BankVerification from '@/pages/bank/Verification';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    }
  }
});

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/institution" component={InstitutionPortal} />
        <Route path="/institution/verification" component={InstitutionVerification} />
        <Route path="/university"><Redirect to="/institution" replace /></Route>
        <Route path="/site" component={Site} />
        
        <Route path="/bank" component={BankInbox} />
        <Route path="/bank/:id/overview" component={BankOverview} />
        <Route path="/bank/:id/files" component={BankFiles} />
        <Route path="/bank/:id/data-checks" component={BankDataChecks} />
        <Route path="/bank/:id/compliance" component={BankCompliance} />
        <Route path="/bank/:id/analysis" component={BankAnalysis} />
        <Route path="/bank/:id/report" component={BankReport} />
        <Route path="/bank/:id/verification" component={BankVerification} />
        
        {/* Redirect root bank routes to overview */}
        <Route path="/bank/:id">
          {(params) => <Redirect to={`/bank/${params.id}/overview`} replace />}
        </Route>
        
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
