import { PricingJobMonitor } from "@/components/admin/PricingJobMonitor";

export function PricingMonitor() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Pricing Monitor</h1>
        <p className="text-muted-foreground">
          Monitor and manage nightly variant pricing refresh jobs for Pokemon EN/JP and MTG
        </p>
      </div>
      
      <PricingJobMonitor />
    </div>
  );
}