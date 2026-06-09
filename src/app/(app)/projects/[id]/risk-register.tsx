"use client";

import * as React from "react";
import { AlertTriangle, Loader2, Plus, Shield } from "lucide-react";
import type { WorkspacePermissions } from "@/types/app";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Risk = {
  id: string;
  title: string;
  description: string | null;
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  probability: number;
  impact: number;
  status: "OPEN" | "MITIGATED" | "ACCEPTED" | "CLOSED";
  mitigation: string | null;
};

const LEVEL_COLORS: Record<Risk["level"], string> = {
  LOW: "bg-green-100 text-green-800 border-green-200",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-200",
  HIGH: "bg-orange-100 text-orange-800 border-orange-200",
  CRITICAL: "bg-red-100 text-red-800 border-red-200",
};

const STATUS_COLORS: Record<Risk["status"], string> = {
  OPEN: "bg-red-100 text-red-700",
  MITIGATED: "bg-green-100 text-green-700",
  ACCEPTED: "bg-blue-100 text-blue-700",
  CLOSED: "bg-muted text-muted-foreground",
};

function riskScore(r: Risk) {
  return r.probability * r.impact;
}

export function RiskRegister({
  projectId,
  permissions,
}: {
  projectId: string;
  permissions: WorkspacePermissions;
}) {
  const { toast } = useToast();
  const [risks, setRisks] = React.useState<Risk[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    title: "",
    description: "",
    level: "MEDIUM",
    probability: "3",
    impact: "3",
    mitigation: "",
  });

  const loadRisks = React.useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/risks`);
    if (res.ok) {
      const data = await res.json();
      setRisks(data.risks);
    }
    setLoading(false);
  }, [projectId]);

  React.useEffect(() => {
    loadRisks();
  }, [loadRisks]);

  async function createRisk() {
    if (!form.title.trim()) {
      toast({ title: "Risk title required", variant: "error" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/risks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          level: form.level,
          probability: parseInt(form.probability),
          impact: parseInt(form.impact),
          mitigation: form.mitigation || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Risk logged", variant: "success" });
      setDialogOpen(false);
      setForm({ title: "", description: "", level: "MEDIUM", probability: "3", impact: "3", mitigation: "" });
      loadRisks();
    } catch {
      toast({ title: "Could not log risk", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function closeRisk(id: string) {
    await fetch(`/api/projects/${projectId}/risks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CLOSED" }),
    });
    loadRisks();
  }

  const sorted = [...risks].sort((a, b) => riskScore(b) - riskScore(a));

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Risk Register</h3>
          <p className="text-sm text-muted-foreground">
            Track and mitigate project risks with probability × impact scoring
          </p>
        </div>
        {permissions.canCreateTask && (
          <Button variant="brand" size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Log Risk
          </Button>
        )}
      </div>

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Shield className="h-10 w-10 text-muted-foreground/40" />
            <p className="font-medium">No risks logged</p>
            <p className="text-sm text-muted-foreground">
              Log risks to track probability and impact
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Risk</th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground hidden sm:table-cell">Level</th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground hidden md:table-cell">P</th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground hidden md:table-cell">I</th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground hidden md:table-cell">Score</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground hidden lg:table-cell">Mitigation</th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {sorted.map((risk) => (
                <tr key={risk.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium">{risk.title}</p>
                    {risk.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {risk.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${LEVEL_COLORS[risk.level]}`}>
                      {risk.level}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center hidden md:table-cell">
                    <span className="font-medium">{risk.probability}</span>
                  </td>
                  <td className="px-4 py-3 text-center hidden md:table-cell">
                    <span className="font-medium">{risk.impact}</span>
                  </td>
                  <td className="px-4 py-3 text-center hidden md:table-cell">
                    <span className={`rounded font-bold text-sm ${riskScore(risk) >= 15 ? "text-red-600" : riskScore(risk) >= 9 ? "text-orange-600" : "text-green-700"}`}>
                      {riskScore(risk)}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-muted-foreground line-clamp-1">
                      {risk.mitigation ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[risk.status]}`}>
                      {risk.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {risk.status === "OPEN" && permissions.canCreateTask && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => closeRisk(risk.id)}
                      >
                        Close
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log a Risk</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Risk title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Supplier delay affecting critical path"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                placeholder="What could go wrong?"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Level</Label>
                <Select value={form.level} onValueChange={(v) => setForm((f) => ({ ...f, level: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Probability (1-5)</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={form.probability}
                  onChange={(e) => setForm((f) => ({ ...f, probability: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Impact (1-5)</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={form.impact}
                  onChange={(e) => setForm((f) => ({ ...f, impact: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Mitigation plan</Label>
              <Textarea
                value={form.mitigation}
                onChange={(e) => setForm((f) => ({ ...f, mitigation: e.target.value }))}
                rows={2}
                placeholder="How will we reduce or manage this risk?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="brand" onClick={createRisk} disabled={saving}>
              {saving && <Loader2 className="animate-spin h-4 w-4" />}
              Log Risk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
