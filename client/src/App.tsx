import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, PrivateRoute } from "@/lib/auth";

import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import RfpsPage from "@/pages/rfps";
import RfpDetailPage from "@/pages/rfp-detail";
import ProfilePage from "@/pages/profile";
import SettingsPage from "@/pages/settings";
import CompanyEvidencePage from "@/pages/company-evidence";
import RfpLaunchPage from "@/pages/rfp-launch";
import NotFound from "@/pages/not-found";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/app/rfps">
        <PrivateRoute>
          <RfpsPage />
        </PrivateRoute>
      </Route>
      <Route path="/app/rfps/:id">
        <PrivateRoute>
          <RfpDetailPage />
        </PrivateRoute>
      </Route>
      <Route path="/app/profile">
        <PrivateRoute>
          <ProfilePage />
        </PrivateRoute>
      </Route>
      <Route path="/app/company-evidence">
        <PrivateRoute>
          <CompanyEvidencePage />
        </PrivateRoute>
      </Route>
      <Route path="/app/launch">
        <PrivateRoute>
          <RfpLaunchPage />
        </PrivateRoute>
      </Route>
      <Route path="/app/settings">
        <PrivateRoute>
          <SettingsPage />
        </PrivateRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router hook={useHashLocation}>
            <AppRouter />
          </Router>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
