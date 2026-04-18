import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth, AuthProvider } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";

import { Layout } from "@/components/layout";
import { Login } from "@/pages/login";
import { Dashboard } from "@/pages/dashboard";
import { Scouts } from "@/pages/hadracha/scouts";
import { Attendance } from "@/pages/hadracha/attendance";
import { Activities } from "@/pages/hadracha/activities";
import { Events } from "@/pages/logistics/events";
import { EventWorkspace } from "@/pages/logistics/event-workspace";
import { Budget } from "@/pages/logistics/budget";
import { BudgetLines } from "@/pages/logistics/budget-lines";
import { Procurement } from "@/pages/logistics/procurement";
import { Admin } from "@/pages/admin";
import { Years } from "@/pages/years";
import { StaffTree } from "@/pages/staff-tree";
import { HadracheHub } from "@/pages/hadracha-hub";
import { LogisticsHub } from "@/pages/logistics-hub";
import { ManagementHub } from "@/pages/management-hub";
import { Tasks } from "@/pages/tasks";
import { Schedule } from "@/pages/schedule";
import { Teams } from "@/pages/teams";
import { DownloadPage } from "@/pages/download";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component, path, ...rest }: { component: React.ComponentType; path: string; [key: string]: unknown }) {
  const { role } = useAuth();
  if (!role) {
    return <Redirect to="/login" />;
  }
  return <Route path={path} component={() => <Layout><Component /></Layout>} {...rest} />;
}

function Router() {
  const { role } = useAuth();

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/download-code" component={DownloadPage} />
      <Route path="/" component={() => role ? <Redirect to="/dashboard" /> : <Redirect to="/login" />} />
      <ProtectedRoute path="/dashboard" component={Dashboard} />

      <ProtectedRoute path="/hadracha" component={HadracheHub} />
      <ProtectedRoute path="/hadracha/scouts" component={Scouts} />
      <ProtectedRoute path="/hadracha/attendance" component={Attendance} />
      <ProtectedRoute path="/hadracha/activities" component={Activities} />

      <ProtectedRoute path="/logistics" component={LogisticsHub} />
      <ProtectedRoute path="/logistics/events" component={Events} />
      <ProtectedRoute path="/logistics/events/:id" component={EventWorkspace} />
      <ProtectedRoute path="/logistics/budget" component={BudgetLines} />
      <ProtectedRoute path="/logistics/budget/classic" component={Budget} />
      <ProtectedRoute path="/logistics/procurement" component={Procurement} />

      <ProtectedRoute path="/tasks" component={Tasks} />
      <ProtectedRoute path="/schedule" component={Schedule} />
      <ProtectedRoute path="/teams" component={Teams} />

      <ProtectedRoute path="/management" component={ManagementHub} />
      <ProtectedRoute path="/admin" component={Admin} />
      <ProtectedRoute path="/years" component={Years} />
      <ProtectedRoute path="/management/staff" component={StaffTree} />
      <ProtectedRoute path="/staffing" component={StaffTree} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
