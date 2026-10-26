import { getPortfolio } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { PROCESSING_PATH_META, statusMeta, type ProcessingPath } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim().toLowerCase();

  if (query.length < 2) {
    return Response.json(
      { applications: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const portfolio = await getPortfolio(session);
  const applications = portfolio
    .filter((app) =>
      [
        app.referenceNo,
        app.institution.name,
        app.institution.code,
        app.institution.city,
        app.institution.state,
        app.programName,
        app.approvalOrderNo ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    )
    .slice(0, 6)
    .map((app) => ({
      id: app.id,
      referenceNo: app.referenceNo,
      institution: app.institution.name,
      institutionCode: app.institution.code,
      state: app.institution.state,
      status: app.status,
      statusLabel: statusMeta(app.status).label,
      pathLabel:
        PROCESSING_PATH_META[app.processingPath as ProcessingPath]?.label ?? app.processingPath,
    }));

  return Response.json(
    { applications },
    { headers: { "Cache-Control": "no-store" } },
  );
}
