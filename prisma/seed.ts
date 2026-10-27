import { PrismaClient } from "@prisma/client";
import { evaluateAphRules, type AphDocument } from "../lib/aph";
import { computeAuditHash } from "../lib/audit-hash";

const prisma = new PrismaClient();

const NOW = new Date();
const DAY = 86_400_000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);
const ahead = (days: number) => new Date(NOW.getTime() + days * DAY);
const yrsAhead = (years: number) => new Date(NOW.getTime() + years * 365.25 * DAY);

type InstitutionSeed = {
  id: string;
  name: string;
  code: string;
  region: string;
  city: string;
  state: string;
  affiliatingUniversity: string;
  totalLandAcres: number;
  builtUpAreaSqM: number;
  facultyCount: number;
  studentIntake: number;
  latitude: number;
  longitude: number;
};

const institutions: InstitutionSeed[] = [
  {
    id: "inst_dti",
    name: "Delhi Technological Institute",
    code: "DLI-ENG-0142",
    region: "NORTH",
    city: "New Delhi",
    state: "Delhi",
    affiliatingUniversity: "Delhi Technological University",
    totalLandAcres: 42.5,
    builtUpAreaSqM: 38500,
    facultyCount: 310,
    studentIntake: 4200,
    latitude: 28.7501,
    longitude: 77.1177,
  },
  {
    id: "inst_bit",
    name: "Bangalore Institute of Technology",
    code: "BLR-ENG-0084",
    region: "SOUTH",
    city: "Bengaluru",
    state: "Karnataka",
    affiliatingUniversity: "Visvesvaraya Technological University",
    totalLandAcres: 28.4,
    builtUpAreaSqM: 32600,
    facultyCount: 240,
    studentIntake: 3000,
    latitude: 12.9716,
    longitude: 77.5946,
  },
  {
    id: "inst_spit",
    name: "Sardar Patel Institute of Technology",
    code: "MUM-ENG-0210",
    region: "WEST",
    city: "Mumbai",
    state: "Maharashtra",
    affiliatingUniversity: "University of Mumbai",
    totalLandAcres: 22.6,
    builtUpAreaSqM: 26400,
    facultyCount: 180,
    studentIntake: 2400,
    latitude: 19.1075,
    longitude: 72.837,
  },
  {
    id: "inst_biem",
    name: "Bengal Institute of Engineering & Management",
    code: "KOL-ENG-0061",
    region: "EAST",
    city: "Kolkata",
    state: "West Bengal",
    affiliatingUniversity: "Maulana Abul Kalam Azad University of Technology",
    totalLandAcres: 12.2,
    builtUpAreaSqM: 9800,
    facultyCount: 95,
    studentIntake: 1500,
    latitude: 22.5726,
    longitude: 88.3639,
  },
  {
    id: "inst_bist",
    name: "Bhopal Institute of Science & Technology",
    code: "BHO-ENG-0133",
    region: "CENTRAL",
    city: "Bhopal",
    state: "Madhya Pradesh",
    affiliatingUniversity: "Rajiv Gandhi Proudyogiki Vishwavidyalaya",
    totalLandAcres: 16.5,
    builtUpAreaSqM: 19200,
    facultyCount: 120,
    studentIntake: 1800,
    latitude: 23.2599,
    longitude: 77.4126,
  },
  {
    id: "inst_jits",
    name: "Jaipur Institute of Technical Sciences",
    code: "JAI-ENG-0092",
    region: "NORTH",
    city: "Jaipur",
    state: "Rajasthan",
    affiliatingUniversity: "Rajasthan Technical University",
    totalLandAcres: 18.0,
    builtUpAreaSqM: 19500,
    facultyCount: 130,
    studentIntake: 1900,
    latitude: 26.9124,
    longitude: 75.7873,
  },
];

type DocSeed = {
  institutionId: string;
  docType: string;
  documentRef: string;
  expiryDate: Date;
  status: string;
  notes?: string;
};

const documents: DocSeed[] = [
  {
    institutionId: "inst_dti",
    docType: "LEASE_DEED",
    documentRef: "LEASE/DDA/2016/DTI-0417",
    expiryDate: yrsAhead(39.5),
    status: "VALID",
  },
  {
    institutionId: "inst_dti",
    docType: "FIRE_SAFETY",
    documentRef: "FS/DFS/2026/11842",
    expiryDate: yrsAhead(1.4),
    status: "VALID",
  },
  {
    institutionId: "inst_dti",
    docType: "BUILDING_PLAN",
    documentRef: "BP/DDA/2024/7712",
    expiryDate: yrsAhead(2.2),
    status: "VALID",
  },
  {
    institutionId: "inst_dti",
    docType: "UNDERTAKING",
    documentRef: "UND/DTI/2026/014",
    expiryDate: yrsAhead(3.1),
    status: "VALID",
  },
  {
    institutionId: "inst_bit",
    docType: "LEASE_DEED",
    documentRef: "LEASE/BBMP/2017/BIT-0084",
    expiryDate: yrsAhead(33.4),
    status: "VALID",
  },
  {
    institutionId: "inst_bit",
    docType: "FIRE_SAFETY",
    documentRef: "FS/KFES/2026/3381",
    expiryDate: ahead(52),
    status: "EXPIRING_SOON",
    notes: "Renewal application filed with Karnataka Fire & Emergency Services.",
  },
  {
    institutionId: "inst_bit",
    docType: "BUILDING_PLAN",
    documentRef: "BP/BDA/2023/9921",
    expiryDate: yrsAhead(2.9),
    status: "VALID",
  },
  {
    institutionId: "inst_bit",
    docType: "UNDERTAKING",
    documentRef: "UND/BIT/2026/021",
    expiryDate: yrsAhead(4.4),
    status: "VALID",
  },
  {
    institutionId: "inst_spit",
    docType: "LEASE_DEED",
    documentRef: "LEASE/MHADA/2015/SPIT-0210",
    expiryDate: yrsAhead(35.5),
    status: "VALID",
  },
  {
    institutionId: "inst_spit",
    docType: "FIRE_SAFETY",
    documentRef: "FS/MFES/2026/7742",
    expiryDate: ahead(38),
    status: "EXPIRING_SOON",
    notes: "Annual renewal inspection completed; certificate awaited.",
  },
  {
    institutionId: "inst_spit",
    docType: "BUILDING_PLAN",
    documentRef: "BP/MCGM/2022/4471",
    expiryDate: yrsAhead(3.6),
    status: "VALID",
  },
  {
    institutionId: "inst_spit",
    docType: "UNDERTAKING",
    documentRef: "UND/SPIT/2026/009",
    expiryDate: yrsAhead(4.2),
    status: "VALID",
  },
  {
    institutionId: "inst_biem",
    docType: "LEASE_DEED",
    documentRef: "LEASE/WBHB/2009/BIEM-0061",
    expiryDate: yrsAhead(12.7),
    status: "VALID",
    notes: "Lease tenure falls below the 30-year APH threshold.",
  },
  {
    institutionId: "inst_biem",
    docType: "FIRE_SAFETY",
    documentRef: "FS/WBFES/2025/2214",
    expiryDate: ago(87),
    status: "EXPIRED",
    notes: "Renewal inspection not requested by institution.",
  },
  {
    institutionId: "inst_biem",
    docType: "BUILDING_PLAN",
    documentRef: "BP/KMC/2021/6130",
    expiryDate: ago(26),
    status: "PENDING_RENEWAL",
    notes: "Revised plan for additional workshop block under review.",
  },
  {
    institutionId: "inst_biem",
    docType: "UNDERTAKING",
    documentRef: "UND/BIEM/2026/003",
    expiryDate: yrsAhead(0.7),
    status: "VALID",
  },
  {
    institutionId: "inst_bist",
    docType: "LEASE_DEED",
    documentRef: "LEASE/MPHB/2014/BIST-0133",
    expiryDate: yrsAhead(37.4),
    status: "VALID",
  },
  {
    institutionId: "inst_bist",
    docType: "FIRE_SAFETY",
    documentRef: "FS/MPFES/2026/5518",
    expiryDate: yrsAhead(1.7),
    status: "VALID",
    notes: "Renewed certificate received 24 Oct 2026; awaiting re-scrutiny.",
  },
  {
    institutionId: "inst_bist",
    docType: "BUILDING_PLAN",
    documentRef: "BP/BMC/2023/1177",
    expiryDate: yrsAhead(2.4),
    status: "VALID",
  },
  {
    institutionId: "inst_bist",
    docType: "UNDERTAKING",
    documentRef: "UND/BIST/2026/007",
    expiryDate: yrsAhead(3.4),
    status: "VALID",
  },
  {
    institutionId: "inst_jits",
    docType: "LEASE_DEED",
    documentRef: "LEASE/RHB/2013/JITS-0092",
    expiryDate: yrsAhead(32.7),
    status: "VALID",
  },
  {
    institutionId: "inst_jits",
    docType: "FIRE_SAFETY",
    documentRef: "FS/RFES/2026/4409",
    expiryDate: yrsAhead(0.9),
    status: "VALID",
  },
  {
    institutionId: "inst_jits",
    docType: "BUILDING_PLAN",
    documentRef: "BP/JDA/2022/8814",
    expiryDate: yrsAhead(2.2),
    status: "VALID",
  },
  {
    institutionId: "inst_jits",
    docType: "UNDERTAKING",
    documentRef: "UND/JITS/2026/011",
    expiryDate: yrsAhead(2.7),
    status: "VALID",
  },
];

type ApplicationSeed = {
  id: string;
  referenceNo: string;
  institutionId: string;
  applicationType: string;
  programName: string;
  intakeRequested: number;
  status: string;
  processingPath: string;
  daysInCurrentStage: number;
  slaStatus: string;
  stageEnteredAt: Date;
  submittedAt: Date;
  decisionAt?: Date;
  approvalOrderNo?: string;
  remarks: string;
};

const applications: ApplicationSeed[] = [
  {
    id: "app_dti_cse",
    referenceNo: "AICTE/APH/2026/NR/0117",
    institutionId: "inst_dti",
    applicationType: "INTAKE_EXPANSION",
    programName: "B.Tech — Computer Science & Engineering",
    intakeRequested: 180,
    status: "DEFICIENCY_REVERTED",
    processingPath: "SCRUTINY_EVC",
    daysInCurrentStage: 12,
    slaStatus: "BREACHED",
    stageEnteredAt: ago(12),
    submittedAt: ago(20),
    remarks:
      "Deficiency notice APH/DFC/2026/NR/0117-A issued for built-up area shortfall. Evidence window open.",
  },
  {
    id: "app_bit_mca",
    referenceNo: "AICTE/APH/2026/SR/0084",
    institutionId: "inst_bit",
    applicationType: "EOA_EXTENSION",
    programName: "MCA — New Course Approval",
    intakeRequested: 60,
    status: "EVC_SCHEDULED",
    processingPath: "EVC_SAC_SHC",
    daysInCurrentStage: 6,
    slaStatus: "WARNING",
    stageEnteredAt: ago(6),
    submittedAt: ago(18),
    remarks: "Expert Visit Committee constituted; visit scheduled without conflict.",
  },
  {
    id: "app_spit_it",
    referenceNo: "AICTE/APH/2026/WR/0210",
    institutionId: "inst_spit",
    applicationType: "EOA_EXTENSION",
    programName: "B.Tech — Information Technology",
    intakeRequested: 120,
    status: "UNDER_SCRUTINY",
    processingPath: "SCRUTINY_ONLY",
    daysInCurrentStage: 3,
    slaStatus: "ON_TRACK",
    stageEnteredAt: ago(3),
    submittedAt: ago(4),
    remarks: "All APH rules satisfied on automated evaluation. Awaiting scrutiny clearance.",
  },
  {
    id: "app_biem_mech",
    referenceNo: "AICTE/APH/2026/ER/0061",
    institutionId: "inst_biem",
    applicationType: "NEW_INSTITUTE",
    programName: "B.Tech — Mechanical Engineering",
    intakeRequested: 60,
    status: "UNDER_SCRUTINY",
    processingPath: "SCRUTINY_EVC",
    daysInCurrentStage: 14,
    slaStatus: "BREACHED",
    stageEnteredAt: ago(14),
    submittedAt: ago(21),
    remarks:
      "Five APH rule failures detected. Regional office has not yet issued a formal deficiency notice.",
  },
  {
    id: "app_bist_ece",
    referenceNo: "AICTE/APH/2026/CR/0133",
    institutionId: "inst_bist",
    applicationType: "INTAKE_EXPANSION",
    programName: "B.Tech — Electronics & Communication Engineering",
    intakeRequested: 120,
    status: "RE_SCRUTINY",
    processingPath: "SCRUTINY_EVC",
    daysInCurrentStage: 2,
    slaStatus: "ON_TRACK",
    stageEnteredAt: ago(2),
    submittedAt: ago(24),
    remarks: "Renewed fire safety certificate submitted. Re-scrutiny pending.",
  },
  {
    id: "app_jits_civil",
    referenceNo: "AICTE/APH/2026/NR/0092",
    institutionId: "inst_jits",
    applicationType: "EOA_EXTENSION",
    programName: "B.Tech — Civil Engineering",
    intakeRequested: 60,
    status: "APPROVED",
    processingPath: "EVC_ONLY",
    daysInCurrentStage: 0,
    slaStatus: "ON_TRACK",
    stageEnteredAt: ago(14),
    submittedAt: ago(30),
    decisionAt: ago(14),
    approvalOrderNo: "AICTE/EOA/2026/NR/0087",
    remarks: "Approved by the Executive Committee. Letter of Approval issued.",
  },
  {
    id: "app_dti_ai",
    referenceNo: "AICTE/APH/2026/NR/0129",
    institutionId: "inst_dti",
    applicationType: "NEW_INSTITUTE",
    programName: "School of AI — B.Tech Artificial Intelligence & Data Science",
    intakeRequested: 60,
    status: "SUBMITTED",
    processingPath: "EVC_SAC_SHC",
    daysInCurrentStage: 1,
    slaStatus: "ON_TRACK",
    stageEnteredAt: ago(1),
    submittedAt: ago(1),
    remarks: "New school filing received. Awaiting scrutiny commencement.",
  },
  {
    id: "app_bit_ds",
    referenceNo: "AICTE/APH/2026/SR/0108",
    institutionId: "inst_bit",
    applicationType: "INTAKE_EXPANSION",
    programName: "B.Tech — Data Science & Engineering",
    intakeRequested: 60,
    status: "EVC_SCHEDULED",
    processingPath: "EVC_SAC_SHC",
    daysInCurrentStage: 11,
    slaStatus: "BREACHED",
    stageEnteredAt: ago(11),
    submittedAt: ago(20),
    remarks: "Site visit conducted; geofence confirmed. EVC report overdue.",
  },
];

const users = [
  {
    id: "usr_ia_meera",
    name: "Dr. Meera Krishnan",
    email: "meera.krishnan@dti.ac.in",
    role: "INSTITUTION_ADMIN",
    designation: "Registrar, Delhi Technological Institute",
    institutionId: "inst_dti",
    region: null as string | null,
  },
  {
    id: "usr_ia_raghavan",
    name: "Dr. S. Raghavan",
    email: "registrar@bit.ac.in",
    role: "INSTITUTION_ADMIN",
    designation: "Registrar, Bangalore Institute of Technology",
    institutionId: "inst_bit",
    region: null,
  },
  {
    id: "usr_ia_kulkarni",
    name: "Dr. A. R. Kulkarni",
    email: "registrar@spit.ac.in",
    role: "INSTITUTION_ADMIN",
    designation: "Registrar, Sardar Patel Institute of Technology",
    institutionId: "inst_spit",
    region: null,
  },
  {
    id: "usr_ia_bhattacharya",
    name: "Dr. S. Bhattacharya",
    email: "registrar@biem.ac.in",
    role: "INSTITUTION_ADMIN",
    designation: "Registrar, Bengal Institute of Engineering & Management",
    institutionId: "inst_biem",
    region: null,
  },
  {
    id: "usr_ia_malhotra",
    name: "Dr. R. Malhotra",
    email: "registrar@bist.ac.in",
    role: "INSTITUTION_ADMIN",
    designation: "Registrar, Bhopal Institute of Science & Technology",
    institutionId: "inst_bist",
    region: null,
  },
  {
    id: "usr_ia_saxena",
    name: "Dr. V. K. Saxena",
    email: "registrar@jits.ac.in",
    role: "INSTITUTION_ADMIN",
    designation: "Registrar, Jaipur Institute of Technical Sciences",
    institutionId: "inst_jits",
    region: null,
  },
  {
    id: "usr_ro_rakesh",
    name: "Rakesh K. Sharma",
    email: "r.sharma@aicte.gov.in",
    role: "REGIONAL_OFFICER",
    designation: "Regional Officer — APH Scrutiny Pool",
    institutionId: null,
    region: "NORTH",
  },
  {
    id: "usr_evc_bansal",
    name: "Dr. A. S. Bansal",
    email: "a.bansal@aicte-evc.gov.in",
    role: "EVC_MEMBER",
    designation: "Expert Visit Committee — Computer Science & AI",
    institutionId: null,
    region: "NORTH",
  },
  {
    id: "usr_ch_nandini",
    name: "Dr. Nandini Iyer",
    email: "n.iyer@aicte.gov.in",
    role: "COMPLIANCE_HEAD",
    designation: "Head — National Compliance & Assurance",
    institutionId: null,
    region: null,
  },
  {
    id: "usr_bo_vikram",
    name: "Shri Vikram Deshpande",
    email: "v.deshpande@aicte.gov.in",
    role: "BUREAU_OFFICER",
    designation: "Bureau Officer — Member Secretary's Office",
    institutionId: null,
    region: null,
  },
];

type DeficiencySeed = {
  applicationId: string;
  noticeNo?: string;
  raisedBy: string;
  deficiencyDetails: string;
  complianceDeadline: Date;
  status: string;
  resubmittedDocUrl?: string;
  resubmittedAt?: Date;
  resolvedAt?: Date;
  createdAt: Date;
};

const deficiencies: DeficiencySeed[] = [
  {
    applicationId: "app_dti_cse",
    noticeNo: "APH/DFC/2026/NR/0117-A",
    raisedBy: "Rakesh K. Sharma — Regional Officer (North)",
    deficiencyDetails:
      "APH-102 FAILURE — The built-up area available per admitted student computes to 9.17 sqm against the APH minimum of 10.00 sqm for the requested enhanced intake of 4,200. Submit a revised architectural area statement, sanctioned plan revision and structural stability certificate for the additional 5,400 sqm academic block.",
    complianceDeadline: ahead(7),
    status: "OPEN",
    createdAt: ago(12),
  },
  {
    applicationId: "app_bist_ece",
    noticeNo: "APH/DFC/2026/CR/0133-A",
    raisedBy: "Central Regional Office — Bhopal",
    deficiencyDetails:
      "APH-104 FAILURE — Fire safety certificate on record expired on 30 Sep 2026. Submit a renewed certificate issued by the Madhya Pradesh Fire and Emergency Services for all academic and hostel blocks.",
    complianceDeadline: ahead(3),
    status: "RESUBMITTED",
    resubmittedDocUrl:
      "https://evidence.aicte.gov.in/bist/evidence/fire-safety-renewal-2026.pdf",
    resubmittedAt: ago(2),
    createdAt: ago(20),
  },
  {
    applicationId: "app_jits_civil",
    noticeNo: "APH/DFC/2026/NR/0092-A",
    raisedBy: "Northern Regional Office — New Delhi",
    deficiencyDetails:
      "APH-105 FAILURE — The sanctioned building plan on record did not cover the 2,100 sqm workshop annexe. Submit the revised sanction letter from the Jaipur Development Authority.",
    complianceDeadline: ago(17),
    status: "RESOLVED",
    resubmittedDocUrl:
      "https://evidence.aicte.gov.in/jits/evidence/building-plan-revision-2026.pdf",
    resubmittedAt: ago(25),
    resolvedAt: ago(24),
    createdAt: ago(27),
  },
];

type EvcSeed = {
  id: string;
  applicationId: string;
  scheduledDate: Date;
  committeeLead: string;
  committeeRegion: string;
  committeeAffiliation: string;
  conflictCheckPassed: boolean;
  conflictNotes: string;
  siteReportStatus: string;
  geofenceVerified: boolean;
  geofenceCoordinates?: string;
  geofenceDistanceM?: number;
  reportSummary?: string;
  recommendation?: string;
  reportSubmittedAt?: Date;
  createdAt: Date;
};

const inspections: EvcSeed[] = [
  {
    id: "evc_bit_mca",
    applicationId: "app_bit_mca",
    scheduledDate: ahead(3),
    committeeLead: "Prof. Kavita Menon",
    committeeRegion: "WEST",
    committeeAffiliation: "University of Mumbai",
    conflictCheckPassed: true,
    conflictNotes:
      "No overlap with applicant region (SOUTH) or affiliating university (Visvesvaraya Technological University).",
    siteReportStatus: "PENDING",
    geofenceVerified: false,
    createdAt: ago(6),
  },
  {
    id: "evc_jits_civil",
    applicationId: "app_jits_civil",
    scheduledDate: ago(7),
    committeeLead: "Dr. P. V. Ramesh",
    committeeRegion: "CENTRAL",
    committeeAffiliation: "Rajiv Gandhi Proudyogiki Vishwavidyalaya",
    conflictCheckPassed: true,
    conflictNotes: "Regional and affiliation conflict checks cleared.",
    siteReportStatus: "COMPLETED",
    geofenceVerified: true,
    geofenceCoordinates: "26.9124° N, 75.7873° E",
    geofenceDistanceM: 18,
    reportSummary:
      "Campus, workshops and library verified on site. Faculty registers and laboratory equipment matched the submitted schedule.",
    recommendation: "RECOMMENDED",
    reportSubmittedAt: ago(6),
    createdAt: ago(23),
  },
  {
    id: "evc_bit_ds",
    applicationId: "app_bit_ds",
    scheduledDate: ago(2),
    committeeLead: "Dr. A. S. Bansal",
    committeeRegion: "NORTH",
    committeeAffiliation: "Delhi Technological University",
    conflictCheckPassed: true,
    conflictNotes:
      "No overlap with applicant region (SOUTH) or affiliating university (Visvesvaraya Technological University).",
    siteReportStatus: "OVERDUE",
    geofenceVerified: true,
    geofenceCoordinates: "12.9716° N, 77.5946° E",
    geofenceDistanceM: 22,
    createdAt: ago(11),
  },
];

const escalations = [
  {
    id: "esc_dti_cse",
    escalationNo: "ESC-2026-NR-0117",
    applicationId: "app_dti_cse",
    region: "NORTH",
    trigger: "STATUTORY_DEADLINE_BREACH",
    daysInStage: 12,
    penaltyPoints: 5,
    status: "OPEN",
    assignedTo: "Member Secretary, AICTE",
    createdAt: ago(2),
  },
  {
    id: "esc_biem_mech",
    escalationNo: "ESC-2026-ER-0061",
    applicationId: "app_biem_mech",
    region: "EAST",
    trigger: "STATUTORY_DEADLINE_BREACH",
    daysInStage: 14,
    penaltyPoints: 5,
    status: "OPEN",
    assignedTo: "Member Secretary, AICTE",
    createdAt: ago(4),
  },
  {
    id: "esc_bit_ds",
    escalationNo: "ESC-2026-SR-0108",
    applicationId: "app_bit_ds",
    region: "SOUTH",
    trigger: "STATUTORY_DEADLINE_BREACH",
    daysInStage: 11,
    penaltyPoints: 5,
    status: "ACKNOWLEDGED",
    assignedTo: "Bureau Officer — Southern Desk",
    createdAt: ago(1),
    acknowledgedAt: ago(1),
  },
];

type AuditSeed = {
  applicationId: string | null;
  institutionId: string | null;
  performedBy: string;
  role: string;
  action: string;
  previousState: string | null;
  newState: string | null;
  detail: string;
  timestamp: Date;
};

const IA = "INSTITUTION_ADMIN";
const RO = "REGIONAL_OFFICER";
const EVC = "EVC_MEMBER";
const CH = "COMPLIANCE_HEAD";
const BO = "BUREAU_OFFICER";
const SYSTEM = "SYSTEM";

const RO_NAME = "Rakesh K. Sharma";
const BO_NAME = "Shri Vikram Deshpande";
const CH_NAME = "Dr. Nandini Iyer";
const EVC_NAME = "Dr. P. V. Ramesh";

const auditEvents: AuditSeed[] = [
  // DTI — CSE intake expansion
  {
    applicationId: "app_dti_cse",
    institutionId: "inst_dti",
    performedBy: "Dr. Meera Krishnan",
    role: IA,
    action: "APPLICATION_SUBMITTED",
    previousState: null,
    newState: "SUBMITTED",
    detail: "Online filing received with architectural area statement and 14 statutory annexures.",
    timestamp: ago(20),
  },
  {
    applicationId: "app_dti_cse",
    institutionId: "inst_dti",
    performedBy: RO_NAME,
    role: RO,
    action: "SCRUTINY_COMMENCED",
    previousState: "SUBMITTED",
    newState: "UNDER_SCRUTINY",
    detail: "Case allotted to Northern Regional scrutiny desk. Statutory clock started.",
    timestamp: ago(19),
  },
  {
    applicationId: "app_dti_cse",
    institutionId: "inst_dti",
    performedBy: RO_NAME,
    role: RO,
    action: "APH_EVALUATION_RUN",
    previousState: "UNDER_SCRUTINY",
    newState: "UNDER_SCRUTINY",
    detail: "APH-101 and APH-103 to APH-106 passed. APH-102 flagged at 9.17 sqm per student.",
    timestamp: ago(18),
  },
  {
    applicationId: "app_dti_cse",
    institutionId: "inst_dti",
    performedBy: RO_NAME,
    role: RO,
    action: "DEFICIENCY_ISSUED",
    previousState: "UNDER_SCRUTINY",
    newState: "DEFICIENCY_REVERTED",
    detail: "Formal notice APH/DFC/2026/NR/0117-A issued. Ten-day evidence window opened.",
    timestamp: ago(12),
  },
  // BIT — MCA course approval
  {
    applicationId: "app_bit_mca",
    institutionId: "inst_bit",
    performedBy: "Dr. S. Raghavan",
    role: IA,
    action: "APPLICATION_SUBMITTED",
    previousState: null,
    newState: "SUBMITTED",
    detail: "MCA course approval filing received with syllabus and faculty cadre statement.",
    timestamp: ago(18),
  },
  {
    applicationId: "app_bit_mca",
    institutionId: "inst_bit",
    performedBy: RO_NAME,
    role: RO,
    action: "SCRUTINY_COMMENCED",
    previousState: "SUBMITTED",
    newState: "UNDER_SCRUTINY",
    detail: "Southern Regional scrutiny desk accepted the case for rule evaluation.",
    timestamp: ago(17),
  },
  {
    applicationId: "app_bit_mca",
    institutionId: "inst_bit",
    performedBy: RO_NAME,
    role: RO,
    action: "APH_EVALUATION_RUN",
    previousState: "UNDER_SCRUTINY",
    newState: "UNDER_SCRUTINY",
    detail: "All six APH rules passed. Fire certificate flagged as expiring in 52 days.",
    timestamp: ago(16),
  },
  {
    applicationId: "app_bit_mca",
    institutionId: "inst_bit",
    performedBy: RO_NAME,
    role: RO,
    action: "SCRUTINY_CLEARED",
    previousState: "UNDER_SCRUTINY",
    newState: "SCRUTINY_CLEARED",
    detail: "Desk scrutiny cleared. Case routed to Expert Visit Committee.",
    timestamp: ago(15),
  },
  {
    applicationId: "app_bit_mca",
    institutionId: "inst_bit",
    performedBy: RO_NAME,
    role: RO,
    action: "EVC_SCHEDULED",
    previousState: "SCRUTINY_CLEARED",
    newState: "EVC_SCHEDULED",
    detail: "Committee led by Prof. Kavita Menon (West). Conflict-of-interest check cleared.",
    timestamp: ago(6),
  },
  // SPIT — EOA extension
  {
    applicationId: "app_spit_it",
    institutionId: "inst_spit",
    performedBy: "Dr. A. R. Kulkarni",
    role: IA,
    action: "APPLICATION_SUBMITTED",
    previousState: null,
    newState: "SUBMITTED",
    detail: "EOA extension filing submitted with compliance declarations.",
    timestamp: ago(4),
  },
  {
    applicationId: "app_spit_it",
    institutionId: "inst_spit",
    performedBy: RO_NAME,
    role: RO,
    action: "SCRUTINY_COMMENCED",
    previousState: "SUBMITTED",
    newState: "UNDER_SCRUTINY",
    detail: "Western Regional scrutiny desk commenced evaluation.",
    timestamp: ago(3),
  },
  {
    applicationId: "app_spit_it",
    institutionId: "inst_spit",
    performedBy: RO_NAME,
    role: RO,
    action: "APH_EVALUATION_RUN",
    previousState: "UNDER_SCRUTINY",
    newState: "UNDER_SCRUTINY",
    detail: "All six APH rules passed; fire safety renewal advisory recorded.",
    timestamp: ago(3),
  },
  // BIEM — new institute
  {
    applicationId: "app_biem_mech",
    institutionId: "inst_biem",
    performedBy: "Dr. S. Bhattacharya",
    role: IA,
    action: "APPLICATION_SUBMITTED",
    previousState: null,
    newState: "SUBMITTED",
    detail: "New institute application received for a 60-seat Mechanical Engineering programme.",
    timestamp: ago(21),
  },
  {
    applicationId: "app_biem_mech",
    institutionId: "inst_biem",
    performedBy: RO_NAME,
    role: RO,
    action: "SCRUTINY_COMMENCED",
    previousState: "SUBMITTED",
    newState: "UNDER_SCRUTINY",
    detail: "Eastern Regional desk commenced scrutiny.",
    timestamp: ago(14),
  },
  {
    applicationId: "app_biem_mech",
    institutionId: "inst_biem",
    performedBy: RO_NAME,
    role: RO,
    action: "APH_EVALUATION_RUN",
    previousState: "UNDER_SCRUTINY",
    newState: "UNDER_SCRUTINY",
    detail:
      "Five rules flagged: APH-101, APH-102, APH-103, APH-104 and APH-105. No formal notice issued yet.",
    timestamp: ago(13),
  },
  {
    applicationId: "app_biem_mech",
    institutionId: "inst_biem",
    performedBy: "SLA Automation Engine",
    role: SYSTEM,
    action: "SLA_ESCALATION_RAISED",
    previousState: "UNDER_SCRUTINY",
    newState: "UNDER_SCRUTINY",
    detail: "14 days in stage exceeded the 10-day limit. Escalation ESC-2026-ER-0061 raised; 5 penalty points against East region.",
    timestamp: ago(4),
  },
  // BIST — intake expansion, resubmission
  {
    applicationId: "app_bist_ece",
    institutionId: "inst_bist",
    performedBy: "Dr. R. Malhotra",
    role: IA,
    action: "APPLICATION_SUBMITTED",
    previousState: null,
    newState: "SUBMITTED",
    detail: "Intake expansion filing submitted for ECE programme.",
    timestamp: ago(24),
  },
  {
    applicationId: "app_bist_ece",
    institutionId: "inst_bist",
    performedBy: RO_NAME,
    role: RO,
    action: "SCRUTINY_COMMENCED",
    previousState: "SUBMITTED",
    newState: "UNDER_SCRUTINY",
    detail: "Central Regional desk commenced scrutiny.",
    timestamp: ago(23),
  },
  {
    applicationId: "app_bist_ece",
    institutionId: "inst_bist",
    performedBy: RO_NAME,
    role: RO,
    action: "APH_EVALUATION_RUN",
    previousState: "UNDER_SCRUTINY",
    newState: "UNDER_SCRUTINY",
    detail: "APH-104 flagged: fire safety certificate expired. Remaining rules passed.",
    timestamp: ago(22),
  },
  {
    applicationId: "app_bist_ece",
    institutionId: "inst_bist",
    performedBy: RO_NAME,
    role: RO,
    action: "DEFICIENCY_ISSUED",
    previousState: "UNDER_SCRUTINY",
    newState: "DEFICIENCY_REVERTED",
    detail: "Formal deficiency raised for expired fire safety certificate.",
    timestamp: ago(20),
  },
  {
    applicationId: "app_bist_ece",
    institutionId: "inst_bist",
    performedBy: "Dr. R. Malhotra",
    role: IA,
    action: "DEFICIENCY_RESUBMITTED",
    previousState: "DEFICIENCY_REVERTED",
    newState: "RE_SCRUTINY",
    detail: "Renewed fire safety certificate uploaded; case returned for re-scrutiny.",
    timestamp: ago(2),
  },
  // JITS — approved case
  {
    applicationId: "app_jits_civil",
    institutionId: "inst_jits",
    performedBy: "Dr. V. K. Saxena",
    role: IA,
    action: "APPLICATION_SUBMITTED",
    previousState: null,
    newState: "SUBMITTED",
    detail: "EOA extension filing received.",
    timestamp: ago(30),
  },
  {
    applicationId: "app_jits_civil",
    institutionId: "inst_jits",
    performedBy: RO_NAME,
    role: RO,
    action: "APH_EVALUATION_RUN",
    previousState: "UNDER_SCRUTINY",
    newState: "UNDER_SCRUTINY",
    detail: "All applicable APH rules passed.",
    timestamp: ago(28),
  },
  {
    applicationId: "app_jits_civil",
    institutionId: "inst_jits",
    performedBy: RO_NAME,
    role: RO,
    action: "DEFICIENCY_ISSUED",
    previousState: "UNDER_SCRUTINY",
    newState: "DEFICIENCY_REVERTED",
    detail: "Building plan revision requested for the workshop annexe.",
    timestamp: ago(27),
  },
  {
    applicationId: "app_jits_civil",
    institutionId: "inst_jits",
    performedBy: "Dr. V. K. Saxena",
    role: IA,
    action: "DEFICIENCY_RESUBMITTED",
    previousState: "DEFICIENCY_REVERTED",
    newState: "RE_SCRUTINY",
    detail: "Revised building plan sanction uploaded.",
    timestamp: ago(25),
  },
  {
    applicationId: "app_jits_civil",
    institutionId: "inst_jits",
    performedBy: RO_NAME,
    role: RO,
    action: "DEFICIENCY_RESOLVED",
    previousState: "RE_SCRUTINY",
    newState: "SCRUTINY_CLEARED",
    detail: "Revised plan verified against the sanctioned drawing. Deficiency closed.",
    timestamp: ago(24),
  },
  {
    applicationId: "app_jits_civil",
    institutionId: "inst_jits",
    performedBy: RO_NAME,
    role: RO,
    action: "EVC_SCHEDULED",
    previousState: "SCRUTINY_CLEARED",
    newState: "EVC_SCHEDULED",
    detail: "EVC constituted under Dr. P. V. Ramesh. Conflict check cleared.",
    timestamp: ago(23),
  },
  {
    applicationId: "app_jits_civil",
    institutionId: "inst_jits",
    performedBy: EVC_NAME,
    role: EVC,
    action: "SITE_REPORT_SUBMITTED",
    previousState: "EVC_SCHEDULED",
    newState: "EVC_COMPLETED",
    detail: "Site visit completed and geofence verified at 26.9124° N, 75.7873° E.",
    timestamp: ago(20),
  },
  {
    applicationId: "app_jits_civil",
    institutionId: "inst_jits",
    performedBy: BO_NAME,
    role: BO,
    action: "APPLICATION_APPROVED",
    previousState: "EVC_COMPLETED",
    newState: "APPROVED",
    detail: "Executive Committee approved the extension. Order AICTE/EOA/2026/NR/0087 issued.",
    timestamp: ago(14),
  },
  // DTI — School of AI
  {
    applicationId: "app_dti_ai",
    institutionId: "inst_dti",
    performedBy: "Dr. Meera Krishnan",
    role: IA,
    action: "APPLICATION_SUBMITTED",
    previousState: null,
    newState: "SUBMITTED",
    detail: "New School of AI filing received with programme structure and land records.",
    timestamp: ago(1),
  },
  // BIT — Data Science intake expansion
  {
    applicationId: "app_bit_ds",
    institutionId: "inst_bit",
    performedBy: "Dr. S. Raghavan",
    role: IA,
    action: "APPLICATION_SUBMITTED",
    previousState: null,
    newState: "SUBMITTED",
    detail: "Data Science intake expansion filing received.",
    timestamp: ago(20),
  },
  {
    applicationId: "app_bit_ds",
    institutionId: "inst_bit",
    performedBy: RO_NAME,
    role: RO,
    action: "SCRUTINY_COMMENCED",
    previousState: "SUBMITTED",
    newState: "UNDER_SCRUTINY",
    detail: "Southern Regional desk commenced scrutiny.",
    timestamp: ago(19),
  },
  {
    applicationId: "app_bit_ds",
    institutionId: "inst_bit",
    performedBy: RO_NAME,
    role: RO,
    action: "APH_EVALUATION_RUN",
    previousState: "UNDER_SCRUTINY",
    newState: "UNDER_SCRUTINY",
    detail: "All six APH rules passed.",
    timestamp: ago(18),
  },
  {
    applicationId: "app_bit_ds",
    institutionId: "inst_bit",
    performedBy: RO_NAME,
    role: RO,
    action: "SCRUTINY_CLEARED",
    previousState: "UNDER_SCRUTINY",
    newState: "SCRUTINY_CLEARED",
    detail: "Case cleared for expert visit.",
    timestamp: ago(17),
  },
  {
    applicationId: "app_bit_ds",
    institutionId: "inst_bit",
    performedBy: RO_NAME,
    role: RO,
    action: "EVC_SCHEDULED",
    previousState: "SCRUTINY_CLEARED",
    newState: "EVC_SCHEDULED",
    detail: "EVC constituted under Dr. A. S. Bansal. Conflict check cleared.",
    timestamp: ago(11),
  },
  {
    applicationId: "app_bit_ds",
    institutionId: "inst_bit",
    performedBy: "SLA Automation Engine",
    role: SYSTEM,
    action: "SLA_ESCALATION_RAISED",
    previousState: "EVC_SCHEDULED",
    newState: "EVC_SCHEDULED",
    detail:
      "11 days in stage and site report overdue. Escalation ESC-2026-SR-0108 raised; 5 penalty points against South region.",
    timestamp: ago(1),
  },
  {
    applicationId: "app_bit_ds",
    institutionId: "inst_bit",
    performedBy: BO_NAME,
    role: BO,
    action: "ESCALATION_ACKNOWLEDGED",
    previousState: "EVC_SCHEDULED",
    newState: "EVC_SCHEDULED",
    detail: "Bureau acknowledged the South region escalation and directed the EVC to file the site report within 48 hours.",
    timestamp: ago(1),
  },
];

async function dropImmutabilityTriggers() {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "AuditLog_no_update"`);
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "AuditLog_no_delete"`);
}

async function installImmutabilityTriggers() {
  await prisma.$executeRawUnsafe(
    `CREATE TRIGGER IF NOT EXISTS "AuditLog_no_update" BEFORE UPDATE ON "AuditLog" BEGIN SELECT RAISE(ABORT, 'PRAMAAN audit ledger is append-only'); END;`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE TRIGGER IF NOT EXISTS "AuditLog_no_delete" BEFORE DELETE ON "AuditLog" BEGIN SELECT RAISE(ABORT, 'PRAMAAN audit ledger is append-only'); END;`,
  );
}

async function main() {
  console.log("→ Resetting PRAMAAN operational database…");
  await dropImmutabilityTriggers();

  await prisma.auditLog.deleteMany();
  await prisma.evidenceFile.deleteMany();
  await prisma.escalationTicket.deleteMany();
  await prisma.deficiencyTicket.deleteMany();
  await prisma.eVCInspection.deleteMany();
  await prisma.scrutinyRuleCheck.deleteMany();
  await prisma.application.deleteMany();
  await prisma.complianceDocument.deleteMany();
  await prisma.user.deleteMany();
  await prisma.institution.deleteMany();

  console.log("→ Seeding institutions and statutory documents…");
  for (const institution of institutions) {
    await prisma.institution.create({ data: institution });
  }
  await prisma.complianceDocument.createMany({
    data: documents.map((doc) => ({
      ...doc,
      lastVerifiedAt: ago(5),
    })),
  });

  console.log("→ Seeding role identities…");
  for (const user of users) {
    await prisma.user.create({ data: user });
  }

  console.log("→ Seeding eight applications…");
  for (const application of applications) {
    await prisma.application.create({
      data: {
        ...application,
        assignedOfficerId:
          application.status === "SUBMITTED" ? null : "usr_ro_rakesh",
      },
    });
  }

  console.log("→ Evaluating APH rule matrixes…");
  const evaluationTimes: Record<string, Date> = {
    app_dti_cse: ago(18),
    app_bit_mca: ago(16),
    app_spit_it: ago(3),
    app_biem_mech: ago(13),
    app_bist_ece: ago(22),
    app_jits_civil: ago(28),
    app_bit_ds: ago(18),
  };

  for (const application of applications) {
    if (application.id === "app_dti_ai") continue;
    const institution = institutions.find((item) => item.id === application.institutionId);
    if (!institution) continue;
    const docs = documents.filter((doc) => doc.institutionId === application.institutionId);
    let results = evaluateAphRules({
      applicationType: application.applicationType,
      institution,
      documents: docs as AphDocument[],
      now: NOW,
    });

    if (application.id === "app_bist_ece") {
      results = results.map((rule) =>
        rule.ruleCode === "APH-104"
          ? {
              ...rule,
              submittedValue: "EXPIRED · 30 Sep 2026",
              status: "DEFICIENCY_FLAGGED",
              remarks:
                "The fire safety certificate on record had expired; renewed evidence received after this evaluation.",
            }
          : rule,
      );
    }

    await prisma.scrutinyRuleCheck.createMany({
      data: results.map((rule) => ({
        applicationId: application.id,
        ruleCode: rule.ruleCode,
        ruleName: rule.ruleName,
        requiredValue: rule.requiredValue,
        submittedValue: rule.submittedValue,
        status: rule.status,
        officerRemarks: rule.remarks,
        evaluatedAt: evaluationTimes[application.id] ?? ago(3),
      })),
    });
  }

  console.log("→ Seeding deficiency tickets, inspections and escalations…");
  for (const deficiency of deficiencies) {
    await prisma.deficiencyTicket.create({ data: deficiency });
  }
  for (const inspection of inspections) {
    await prisma.eVCInspection.create({ data: inspection });
  }
  for (const escalation of escalations) {
    await prisma.escalationTicket.create({ data: escalation });
  }

  console.log("→ Building SHA-256 audit chain…");
  const ordered = [...auditEvents].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
  let previousHash: string | null = null;
  let sequence = 0;
  for (const event of ordered) {
    sequence += 1;
    const hashChecksum = computeAuditHash({
      sequence,
      applicationId: event.applicationId,
      institutionId: event.institutionId,
      performedBy: event.performedBy,
      role: event.role,
      action: event.action,
      previousState: event.previousState,
      newState: event.newState,
      detail: event.detail,
      previousHash,
      timestamp: event.timestamp,
    });
    await prisma.auditLog.create({
      data: {
        sequence,
        applicationId: event.applicationId,
        institutionId: event.institutionId,
        performedBy: event.performedBy,
        role: event.role,
        action: event.action,
        previousState: event.previousState,
        newState: event.newState,
        detail: event.detail,
        previousHash,
        hashChecksum,
        timestamp: event.timestamp,
      },
    });
    previousHash = hashChecksum;
  }

  await installImmutabilityTriggers();

  console.log(
    `✔ Seed complete — ${applications.length} applications, ${institutions.length} institutions, ${sequence} ledger entries.`,
  );
  console.log(`  Ledger head: ${previousHash}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
