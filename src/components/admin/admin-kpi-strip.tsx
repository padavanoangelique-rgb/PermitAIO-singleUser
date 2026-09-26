"use client";

import { KpiCard } from "@/components/ui/kpi-card";
import { Building2, Users, DollarSign, Clock, AlertTriangle, XCircle, Gift } from "lucide-react";

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function AdminKpiStrip({
  orgCount,
  trialingCount,
  activeCount,
  pastDueCount,
  canceledCount,
  compedCount,
  mrr,
}: {
  orgCount: number;
  trialingCount: number;
  activeCount: number;
  pastDueCount: number;
  canceledCount: number;
  compedCount: number;
  mrr: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
      <KpiCard label="Organizations" value={orgCount} icon={Building2} />
      <KpiCard label="Trialing" value={trialingCount} icon={Clock} tone="info" />
      <KpiCard label="Active" value={activeCount} icon={Users} tone="good" />
      <KpiCard label="Past due" value={pastDueCount} icon={AlertTriangle} tone="warn" />
      <KpiCard label="Canceled" value={canceledCount} icon={XCircle} tone="danger" />
      <KpiCard label="Comped" value={compedCount} icon={Gift} tone="info" />
      <KpiCard label="MRR" value={formatMoney(mrr)} icon={DollarSign} tone="primary" />
    </div>
  );
}
