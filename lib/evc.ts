export type EvcMember = {
  id: string;
  name: string;
  region: string;
  affiliation: string;
  specialisation: string;
};

export const EVC_ROSTER: EvcMember[] = [
  {
    id: "EVC-NR-03",
    name: "Dr. A. S. Bansal",
    region: "NORTH",
    affiliation: "Delhi Technological University",
    specialisation: "Computer Science & AI",
  },
  {
    id: "EVC-SR-02",
    name: "Prof. Ananth Rao",
    region: "SOUTH",
    affiliation: "Visvesvaraya Technological University",
    specialisation: "Mechanical & Manufacturing",
  },
  {
    id: "EVC-WR-01",
    name: "Prof. Kavita Menon",
    region: "WEST",
    affiliation: "University of Mumbai",
    specialisation: "Civil Structures",
  },
  {
    id: "EVC-CR-04",
    name: "Dr. P. V. Ramesh",
    region: "CENTRAL",
    affiliation: "Rajiv Gandhi Proudyogiki Vishwavidyalaya",
    specialisation: "Civil & Environmental",
  },
  {
    id: "EVC-ER-05",
    name: "Prof. Ipsita Sen",
    region: "EAST",
    affiliation: "Maulana Abul Kalam Azad University of Technology",
    specialisation: "Electronics & VLSI",
  },
  {
    id: "EVC-WR-06",
    name: "Dr. Farah Qureshi",
    region: "WEST",
    affiliation: "Savitribai Phule Pune University",
    specialisation: "Data Science",
  },
];

export type ConflictInstitution = {
  name: string;
  region: string;
  affiliatingUniversity: string;
};

export type ConflictResult = {
  passed: boolean;
  reasons: string[];
};

export function checkConflict(
  member: EvcMember,
  institution: ConflictInstitution,
): ConflictResult {
  const reasons: string[] = [];
  if (member.region === institution.region) {
    reasons.push(
      `Committee member is drawn from the applicant's ${institution.region.toLowerCase()} region.`,
    );
  }
  if (
    member.affiliation.trim().toLowerCase() ===
    institution.affiliatingUniversity.trim().toLowerCase()
  ) {
    reasons.push(
      `Committee member is affiliated to ${institution.affiliatingUniversity}, the applicant's affiliating university.`,
    );
  }
  return { passed: reasons.length === 0, reasons };
}

export function findEvcMember(id: string): EvcMember | undefined {
  return EVC_ROSTER.find((member) => member.id === id);
}

export const GEOFENCE_RADIUS_M = 750;

export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

export function geofenceResult(
  campus: { latitude: number; longitude: number },
  device: { latitude: number; longitude: number },
): { distanceM: number; verified: boolean } {
  const distanceM = haversineMeters(
    campus.latitude,
    campus.longitude,
    device.latitude,
    device.longitude,
  );
  return { distanceM, verified: distanceM <= GEOFENCE_RADIUS_M };
}
