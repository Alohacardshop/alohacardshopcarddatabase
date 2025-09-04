import { TCGDashboard } from '@/components/tcg/TCGDashboard';
import { Button } from '@/components/ui/button';
import { Shield, ArrowRight } from 'lucide-react';

const Index = () => {
  return (
    <div className="space-y-8 min-h-screen p-6">
      {/* Admin Access */}
      <div className="bg-card border rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Administration Panel</h2>
            <p className="text-muted-foreground">
              Access the comprehensive admin interface to manage your TCG database service
            </p>
          </div>
          <Button asChild>
            <a href="/admin" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Admin Panel
              <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>

      {/* Main Dashboard */}
      <TCGDashboard />
    </div>
  );
};

export default Index;
