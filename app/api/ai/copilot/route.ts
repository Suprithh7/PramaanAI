import { NextResponse } from "next/server";
import { askAicteHandbookCopilot } from "@/lib/gemini";
import { getSession } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    const body = (await req.json()) as {
      question: string;
      context?: {
        institutionName?: string;
        referenceNo?: string;
        programName?: string;
        studentIntake?: number;
        facultyCount?: number;
        builtUpAreaSqM?: number;
        totalLandAcres?: number;
      };
    };

    if (!body.question || typeof body.question !== "string" || body.question.trim().length === 0) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const response = await askAicteHandbookCopilot({
      question: body.question.trim(),
      context: {
        ...body.context,
        role: session.role,
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to query AICTE Copilot";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
