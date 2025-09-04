import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import { AdminLayout } from "./components/admin/AdminLayout";
import { AdminOverview } from "./pages/admin/AdminOverview";
import { EnvironmentConfig } from "./pages/admin/EnvironmentConfig";
import { DatabaseManagement } from "./pages/admin/DatabaseManagement";
import { DataBrowser } from "./pages/admin/DataBrowser";
import { APITesting } from "./pages/admin/APITesting";
import { PricingMonitor } from "./pages/admin/PricingMonitor";
import { SetsManager } from "./components/tcg/SetsManager";
import { JobMonitor } from "./components/tcg/JobMonitor";
import { Developers } from "./pages/admin/Developers";
import AdminSetup from "./pages/admin/AdminSetup";
import Health from "./pages/debug/Health";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/debug/health" element={<Health />} />
            
            {/* Admin Setup (no auth required to check if setup needed) */}
            <Route path="/admin/setup" element={<AdminSetup />} />
            
            {/* Protected Admin Routes */}
            <Route path="/admin" element={
              <ProtectedRoute requireRole="admin">
                <AdminLayout />
              </ProtectedRoute>
            }>
              <Route index element={<AdminOverview />} />
              <Route path="environment" element={<EnvironmentConfig />} />
              <Route path="database" element={<DatabaseManagement />} />
              <Route path="sync" element={<SetsManager />} />
              <Route path="jobs" element={<JobMonitor />} />
              <Route path="pricing" element={<PricingMonitor />} />
              <Route path="data" element={<DataBrowser />} />
              <Route path="api-test" element={<APITesting />} />
              <Route path="developers" element={<Developers />} />
            </Route>
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
