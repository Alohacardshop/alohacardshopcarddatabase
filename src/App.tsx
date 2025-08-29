import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { AdminLayout } from "./components/admin/AdminLayout";
import { AdminOverview } from "./pages/admin/AdminOverview";
import { EnvironmentConfig } from "./pages/admin/EnvironmentConfig";
import { DatabaseManagement } from "./pages/admin/DatabaseManagement";
import { DataBrowser } from "./pages/admin/DataBrowser";
import { APITesting } from "./pages/admin/APITesting";
import { SetsManager } from "./components/tcg/SetsManager";
import { JobMonitor } from "./components/tcg/JobMonitor";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          
          {/* Admin Routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverview />} />
            <Route path="environment" element={<EnvironmentConfig />} />
            <Route path="database" element={<DatabaseManagement />} />
            <Route path="sync" element={<SetsManager />} />
            <Route path="jobs" element={<JobMonitor />} />
            <Route path="data" element={<DataBrowser />} />
            <Route path="api-test" element={<APITesting />} />
          </Route>
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
