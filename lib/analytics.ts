import { liveDaysInStage, slaForDays } from "./sla";
import { REGIONS } from "./types";

export type AnalyticsApp = {
  status: string;
  stageEnteredAt: Date;
  deficiencies: Array<{ status: string; complianceDeadline: Date }>;
  inspections: Array<{
    siteReportStatus: string;
    geofenceVerified: boolean;
    conflictCheckPassed: boolean;
  }>;
  escalations: Array<{ status: string; penaltyPoints: number }>;
  ruleChecks: Array<{ status: string }>;
  institution: { region: string };
};

export type AnalyticsDoc = {
  status: string;
  expiryDate: Date;
  docType: string;
  institutionId: string;
};

export function activeApps<T extends { status: string }>(apps: T[]): T[] {
  return apps.filter((app) => app.status !== "APPROVED" && app.status !== "REJECTED");
}

export function slaCounts(apps: AnalyticsApp[]) {
  const counts = { ON_TRACK: 0, WARNING: 0, BREACHED: 0, total: 0 };
  for (const app of activeApps(apps)) {
    const days = liveDaysInStage(app.stageEnteredAt);
    const status = slaForDays(days);
    counts[status] += 1;
    counts.total += 1;
  }
  return counts;
}

export function slaRows<T extends AnalyticsApp>(apps: T[]) {
  return apps
    .map((app) => {
      const days = liveDaysInStage(app.stageEnteredAt);
      return { app, days, sla: slaForDays(days) };
    })
    .sort((a, b) => {
      const weight = { BREACHED: 3, WARNING: 2, ON_TRACK: 1 };
      if (weight[a.sla] !== weight[b.sla]) return weight[b.sla] - weight[a.sla];
      return b.days - a.days;
    });
}

export function regionStats(apps: AnalyticsApp[]) {
  return REGIONS.map((region) => {
    const scoped = activeApps(apps.filter((app) => app.institution.region === region));
    let onTrack = 0;
    let warning = 0;
    let breached = 0;
    const dots: Array<"ON_TRACK" | "WARNING" | "BREACHED"> = [];
    for (const app of scoped) {
      const sla = slaForDays(liveDaysInStage(app.stageEnteredAt));
      if (sla === "BREACHED") breached += 1;
      else if (sla === "WARNING") warning += 1;
      else onTrack += 1;
      dots.push(sla);
    }
    const penalty = scoped.reduce(
      (sum, app) =>
        sum +
        app.escalations
          .filter((ticket) => ticket.status !== "RESOLVED")
          .reduce((inner, ticket) => inner + ticket.penaltyPoints, 0),
      0,
    );
    return {
      region,
      total: scoped.length,
      onTrack,
      warning,
      breached,
      penalty,
      dots: dots.slice(0, 12),
    };
  });
}

export function stageBuckets(apps: AnalyticsApp[]) {
  const buckets = {
    scrutiny: 0,
    evc: 0,
    council: 0,
    decided: 0,
  };
  for (const app of apps) {
    if (["SUBMITTED", "UNDER_SCRUTINY", "DEFICIENCY_REVERTED", "RE_SCRUTINY"].includes(app.status)) {
      buckets.scrutiny += 1;
    } else if (["SCRUTINY_CLEARED", "EVC_SCHEDULED", "EVC_COMPLETED"].includes(app.status)) {
      buckets.evc += 1;
    } else if (["SAC_REVIEW", "SHC_REVIEW"].includes(app.status)) {
      buckets.council += 1;
    } else {
      buckets.decided += 1;
    }
  }
  return buckets;
}

export function ruleStats(apps: AnalyticsApp[]) {
  let passed = 0;
  let flagged = 0;
  for (const app of apps) {
    for (const rule of app.ruleChecks) {
      if (rule.status === "PASSED") passed += 1;
      else flagged += 1;
    }
  }
  const total = passed + flagged;
  return { passed, flagged, total, rate: total > 0 ? Math.round((passed / total) * 100) : 100 };
}

export function deficiencyStats(apps: AnalyticsApp[]) {
  let open = 0;
  let resubmitted = 0;
  let resolved = 0;
  let nearestDays = Number.POSITIVE_INFINITY;
  for (const app of apps) {
    for (const ticket of app.deficiencies) {
      if (ticket.status === "OPEN") {
        open += 1;
        const remaining = Math.ceil(
          (new Date(ticket.complianceDeadline).getTime() - Date.now()) / 86_400_000,
        );
        nearestDays = Math.min(nearestDays, remaining);
      } else if (ticket.status === "RESUBMITTED") resubmitted += 1;
      else resolved += 1;
    }
  }
  return {
    open,
    resubmitted,
    resolved,
    nearestDays: Number.isFinite(nearestDays) ? nearestDays : null,
  };
}

export function inspectionStats(apps: AnalyticsApp[]) {
  const all = apps.flatMap((app) => app.inspections);
  return {
    total: all.length,
    pending: all.filter((inspection) => inspection.siteReportStatus === "PENDING").length,
    overdue: all.filter((inspection) => inspection.siteReportStatus === "OVERDUE").length,
    completed: all.filter((inspection) => inspection.siteReportStatus === "COMPLETED").length,
    geofenceVerified: all.filter((inspection) => inspection.geofenceVerified).length,
    conflicts: all.filter((inspection) => !inspection.conflictCheckPassed).length,
  };
}

export function documentStats(docs: AnalyticsDoc[]) {
  return {
    total: docs.length,
    valid: docs.filter((doc) => doc.status === "VALID").length,
    expiring: docs.filter((doc) => doc.status === "EXPIRING_SOON").length,
    expired: docs.filter((doc) => doc.status === "EXPIRED").length,
    pending: docs.filter((doc) => doc.status === "PENDING_RENEWAL").length,
    institutions: new Set(docs.map((doc) => doc.institutionId)).size,
  };
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

export function escalationStats(apps: AnalyticsApp[]) {
  const tickets = apps.flatMap((app) => app.escalations);
  return {
    total: tickets.length,
    open: tickets.filter((ticket) => ticket.status === "OPEN").length,
    acknowledged: tickets.filter((ticket) => ticket.status === "ACKNOWLEDGED").length,
    penalty: tickets
      .filter((ticket) => ticket.status !== "RESOLVED")
      .reduce((sum, ticket) => sum + ticket.penaltyPoints, 0),
  };
}

export type RegionStat = ReturnType<typeof regionStats>[number];
