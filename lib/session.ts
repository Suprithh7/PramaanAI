import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "./db";
import { ROLE_META, isRole, type Role } from "./types";

export const ROLE_COOKIE = "pramaan_role";
export const TENANT_COOKIE = "pramaan_tenant";

const PERSONA_EMAIL: Record<Role, string> = {
  INSTITUTION_ADMIN: "meera.krishnan@dti.ac.in",
  REGIONAL_OFFICER: "r.sharma@aicte.gov.in",
  EVC_MEMBER: "a.bansal@aicte-evc.gov.in",
  COMPLIANCE_HEAD: "n.iyer@aicte.gov.in",
  BUREAU_OFFICER: "v.deshpande@aicte.gov.in",
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  designation: string | null;
  region: string | null;
  institutionId: string | null;
  institutionName: string | null;
};

export type TenantInstitution = {
  id: string;
  name: string;
  code: string;
  region: string;
};

export type Session = {
  role: Role;
  user: SessionUser;
  tenant: TenantInstitution | null;
  isDefaultRole: boolean;
};

export const getSession = cache(async (): Promise<Session> => {
  const jar = await cookies();
  const rawRole = jar.get(ROLE_COOKIE)?.value;
  const role: Role = isRole(rawRole) ? rawRole : "COMPLIANCE_HEAD";
  const isDefaultRole = !isRole(rawRole);

  const record = await prisma.user.findFirst({
    where: { role },
    include: { institution: true },
    orderBy:
      role === "INSTITUTION_ADMIN"
        ? { createdAt: "asc" }
        : { createdAt: "asc" },
  });

  const user = record
    ? {
        id: record.id,
        name: record.name,
        email: record.email,
        role,
        designation: record.designation,
        region: record.region,
        institutionId: record.institutionId,
        institutionName: record.institution?.name ?? null,
      }
    : {
        id: "demo-identity",
        name: ROLE_META[role].label,
        email: PERSONA_EMAIL[role],
        role,
        designation: ROLE_META[role].summary,
        region: null,
        institutionId: null,
        institutionName: null,
      };

  let tenant: TenantInstitution | null = null;
  if (role === "INSTITUTION_ADMIN") {
    const requested = jar.get(TENANT_COOKIE)?.value;
    const scoped =
      (requested
        ? await prisma.institution.findUnique({
            where: { id: requested },
            select: { id: true, name: true, code: true, region: true },
          })
        : null) ??
      (user.institutionId
        ? await prisma.institution.findUnique({
            where: { id: user.institutionId },
            select: { id: true, name: true, code: true, region: true },
          })
        : null);
    tenant = scoped;
  }

  return { role, user, tenant, isDefaultRole };
});

export async function getTenantOptions(): Promise<TenantInstitution[]> {
  const session = await getSession();
  if (session.role !== "INSTITUTION_ADMIN") return [];
  return prisma.institution.findMany({
    select: { id: true, name: true, code: true, region: true },
    orderBy: { name: "asc" },
  });
}

export function landingForRole(role: Role): string {
  return ROLE_META[role].landing;
}
