import { createFileRoute, Link } from "@tanstack/react-router";
import { Settings as SettingsIcon, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AdminPipelinePanel } from "@/components/admin/AdminPipelinePanel";
import { useAuth } from "@/contexts/AuthContext";
import { usePositions } from "@/hooks/use-vetting-data";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/admin")({
  beforeLoad: requireAuth,
  head: () => ({
    meta: [
      { title: "Admin · onboard" },
      { name: "description", content: "Admin controls for managing pipeline, scenarios, and questions." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin } = useAuth();
  const { data: positions = [], isLoading: positionsLoading } = usePositions();
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);
  const activePosition = positions.find((p) => p.id === selectedPositionId) ?? positions[0];

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-20">
          <SettingsIcon className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="bp-label">Admin Access Required</p>
          <p className="mt-2 text-center text-[13px] text-muted-foreground">
            You don't have permission to access this page.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-4 bp-fade-up">
        <Link to="/" className="inline-flex items-center gap-2 bp-meta hover:underline">
          <ArrowLeft className="h-3 w-3" /> Back to Pipeline
        </Link>
      </div>

      <h1 className="mb-6 text-[36px] leading-[0.95] font-extrabold tracking-tight uppercase">
        Admin<br />Controls
      </h1>

      {positionsLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="bp-meta">Loading...</p>
        </div>
      ) : positions.length === 0 ? (
        <div className="bp-card p-5">
          <p className="bp-label">No Positions</p>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Create a position to begin managing the pipeline.
          </p>
          <Link
            to="/transition"
            className="mt-4 inline-flex items-center gap-2 border-2 border-ink bg-ink px-4 py-3 text-surface bp-press"
          >
            Create Position
          </Link>
        </div>
      ) : (
        <>
          {activePosition && (
            <AdminPipelinePanel
              position={activePosition}
              positions={positions}
              onPositionChange={setSelectedPositionId}
            />
          )}
        </>
      )}
    </AppShell>
  );
}
