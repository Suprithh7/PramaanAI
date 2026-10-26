import {
  isTerminal,
  type ApplicationStatus,
  type ProcessingPath,
} from "./types";

export type RailState = "COMPLETE" | "CURRENT" | "UPCOMING" | "SKIPPED" | "FAILED";

export type RailStage = {
  key: string;
  label: string;
  caption: string;
  state: RailState;
};

export function pathHasEvc(path: string): boolean {
  return path !== "SCRUTINY_ONLY";
}

export function pathHasCouncil(path: string): boolean {
  return path === "EVC_SAC_SHC";
}

type StageDef = { key: string; label: string; caption: string };

function stagesForPath(path: string): StageDef[] {
  const submission: StageDef = {
    key: "submission",
    label: "Submission",
    caption: "Application & statutory declarations",
  };
  const scrutiny: StageDef = {
    key: "scrutiny",
    label: "Scrutiny",
    caption: "APH automated rule evaluation",
  };
  const deficiency: StageDef = {
    key: "deficiency",
    label: "Deficiency Control",
    caption: "Notice, evidence & re-scrutiny",
  };
  const evc: StageDef = {
    key: "evc",
    label: "EVC Inspection",
    caption: "Expert visit & geofenced report",
  };
  const sac: StageDef = {
    key: "sac",
    label: "SAC Review",
    caption: "Standing Appellate Committee",
  };
  const shc: StageDef = {
    key: "shc",
    label: "SHC Review",
    caption: "Secretary-level clearance",
  };
  const approval: StageDef = {
    key: "approval",
    label: "Approval",
    caption: "Council order & EOA issue",
  };

  switch (path as ProcessingPath) {
    case "EVC_ONLY":
      return [submission, evc, approval];
    case "SCRUTINY_ONLY":
      return [submission, scrutiny, deficiency, approval];
    case "SCRUTINY_EVC":
      return [submission, scrutiny, deficiency, evc, approval];
    case "EVC_SAC_SHC":
    default:
      return [submission, scrutiny, deficiency, evc, sac, shc, approval];
  }
}

function currentStageKey(status: string, path: string): string {
  const hasEvc = pathHasEvc(path);
  switch (status as ApplicationStatus) {
    case "SUBMITTED":
      return "submission";
    case "UNDER_SCRUTINY":
      return "scrutiny";
    case "DEFICIENCY_REVERTED":
    case "RE_SCRUTINY":
      return "deficiency";
    case "SCRUTINY_CLEARED":
      return hasEvc ? "evc" : "approval";
    case "EVC_SCHEDULED":
      return "evc";
    case "EVC_COMPLETED":
      return pathHasCouncil(path) ? "sac" : "approval";
    case "SAC_REVIEW":
      return "sac";
    case "SHC_REVIEW":
      return "shc";
    case "APPROVED":
    case "REJECTED":
      return "approval";
    default:
      return "submission";
  }
}

export function workflowRail(status: string, path: string): RailStage[] {
  const stages = stagesForPath(path);
  const currentKey = currentStageKey(status, path);
  const currentIndex = stages.findIndex((stage) => stage.key === currentKey);
  const terminal = isTerminal(status);

  return stages.map((stage, index) => {
    let state: RailState;
    if (terminal) {
      state = status === "REJECTED" ? "FAILED" : "COMPLETE";
    } else if (index < currentIndex) {
      state = "COMPLETE";
    } else if (index === currentIndex) {
      state = "CURRENT";
    } else {
      state = "UPCOMING";
    }

    if (!pathHasEvc(path) && stage.key === "evc") state = "SKIPPED";
    if (!pathHasCouncil(path) && (stage.key === "sac" || stage.key === "shc")) {
      state = "SKIPPED";
    }

    if (
      status === "DEFICIENCY_REVERTED" &&
      stage.key === "deficiency" &&
      state === "CURRENT"
    ) {
      state = "FAILED";
    }

    let caption = stage.caption;
    if (status === "DEFICIENCY_REVERTED" && stage.key === "deficiency") {
      caption = "Formal notice open · evidence due";
    }
    if (status === "SCRUTINY_CLEARED" && stage.key === "evc") {
      caption = "Scrutiny cleared · awaiting EVC schedule";
    }
    if (status === "EVC_SCHEDULED" && stage.key === "evc") {
      caption = "Visit scheduled · geofence armed";
    }

    return { ...stage, caption, state };
  });
}

export function canRunAph(status: string): boolean {
  return !isTerminal(status);
}

export function canRaiseDeficiency(status: string): boolean {
  return status === "UNDER_SCRUTINY" || status === "RE_SCRUTINY";
}

export function canAcceptResubmission(status: string): boolean {
  return status === "RE_SCRUTINY";
}

export function canScheduleEvc(status: string): boolean {
  return status === "SCRUTINY_CLEARED";
}

export function canSubmitSiteReport(status: string): boolean {
  return status === "EVC_SCHEDULED";
}

export function canDecide(status: string): boolean {
  return (
    status === "SCRUTINY_CLEARED" ||
    status === "EVC_COMPLETED" ||
    status === "SAC_REVIEW" ||
    status === "SHC_REVIEW"
  );
}

export function statusAfterSiteReport(path: string): ApplicationStatus {
  return pathHasCouncil(path) ? "SAC_REVIEW" : "EVC_COMPLETED";
}
