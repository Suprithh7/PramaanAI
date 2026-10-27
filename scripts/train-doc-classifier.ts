// Trains the statutory document-type classifier (multinomial Naive Bayes) and
// writes lib/model/doc-classifier.json. Run with: npx tsx scripts/train-doc-classifier.ts
//
// The corpus is synthetic but written in the register of real AICTE annexures so
// the model generalises to unseen uploads instead of memorising one template.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { tokenize, predict, type DocClassifierModel } from "../lib/classifier-core";

const CORPUS: Record<string, string[]> = {
  LEASE_DEED: [
    "Registered lease deed executed between the lessor and the lessee for the land admeasuring 5.25 acres situated at Jaipur, Rajasthan. The lease period is 30 years commencing from the date of registration. Monthly rent payable is Rs. 1,25,000.",
    "This deed of lease is made on this day between the owner of the property and the institution. The lessee shall use the premises for educational purposes only. Lease tenure of 33 years renewable on mutual consent. Land area 6.10 acres.",
    "Land lease agreement. Plot area 4.80 acres. Leased for a period of 30 years. The lessor confirms clear title. Survey number 112/3. Rent escalation of five percent every three years.",
    "Memorandum of lease deed for campus land. Extent of land 7.5 acres. Lease for 35 years. The lessee shall not sublet the premises. Registration completed at the sub registrar office.",
    "Lease deed for the proposed technical campus. Total land 5.0 acres. Tenure of lease 30 years. Boundaries described in the schedule. Lessor and lessee signatures attested.",
    "This lease agreement is valid for a term of 30 years. The property measuring 8.2 acres is leased to the trust for running an engineering college. Rent fixed as per the schedule annexed.",
    "Registered instrument of lease. Land admeasuring 3.75 acres. Lease period 30 years. Owner and occupant details recorded. Encumbrance certificate enclosed.",
    "Deed of lease between Shri Ram Trust and the society. Premises comprising 6.4 acres. Term of 32 years. The lessee shall pay municipal taxes. Possession handed over on execution.",
    "Land lease for educational institution. Area 9.1 acres. Lease tenure thirty years. The lessor grants peaceful possession. No mortgage or lien on the property.",
    "Lease deed schedule. Survey 45/2, total extent 5.6 acres. Period of lease 30 years. Rent as mutually agreed. Both parties affix signatures before the registrar.",
    "Lease agreement for the campus plot measuring 4.25 acres. The lessor leases the land to the educational trust for 30 years. Rent and revision clause described.",
    "Registered lease deed dated this day. Land area 6.75 acres leased for 31 years for construction of the institute. Lessee responsible for approvals.",
    "Deed of lease registered under the Registration Act. Schedule of property: plot 14, sector 7, area 5.40 acre. Term 33 year. Lessor acknowledges receipt of advance rent.",
    "Lease cum development agreement between the trust and the landowner for 6.20 acre. The institute may construct academic buildings. Period thirty year with renewal option.",
    "Allotment of land on lease by the development authority to the society for establishing an engineering college. Extent 10.5 acre, premium paid, lease 30 year.",
    "Notarised lease deed. Lessee: Sri Vidya Trust. Property admeasuring 4.75 acre at survey 88/2. Rent Rs 2,50,000 per month. Term 30 year from commencement.",
    "Registered lease indenture dated 12 May 1998. The lessor lets out land measuring 7 acre to the institute for educational use. Thirty year term with rent escalation.",
    "Land documents: lease deed in favour of the college for 3.90 acre. Possession certificate enclosed. Registration number 4471. Lease valid for 32 year.",
    "Indenture of lease. Demised premises: 8 acre campus land. Term of 30 year. The lessee shall not transfer or sublet. Encumbrance free title confirmed.",
    "Certified copy of lease deed executed before the sub registrar. Land extent 5.85 acre. Lease period thirty year. Mutation records attached.",
    "Campus land taken on long lease of 30 year. Area 26.4 acre. Lease agreement registered, rent fixed as per schedule, no litigation pending.",
    "Lease deed schedule A: land measuring 6.05 acre in village Khed. Term 30 year. The institute shall use the land for technical education only.",
    "Registered development agreement cum lease. A 9.5 acre parcel leased for 35 year. Permission granted to mortgage leasehold rights for bank finance.",
    "Deed of lease between the landlord and the educational society. Premises 4.10 acre. Rent free period of two year. Lease tenure 30 year.",
  ],
  FIRE_SAFETY: [
    "Fire safety certificate issued under the National Building Code. The premises have adequate fire fighting arrangements including sprinklers, hydrants and extinguishers. Valid up to 31 March 2028. Occupancy permitted for 1200 persons.",
    "No objection certificate from the state fire services. Fire NOC for the academic block. Smoke detectors and alarm system installed. Renewal due before 30 June 2027. Compliance with fire safety norms verified.",
    "Certificate of fire safety. The building is equipped with automatic sprinkler system, fire hose reels and public address system. Valid till 15 August 2029. Fire exit routes clear.",
    "Fire safety inspection report. Fire extinguishers refilled and pressure tested. Emergency lighting operational. NOC valid for three years. Occupancy load within permissible limits.",
    "Provisional fire safety certificate for the new academic building. Fire alarm panel functional. Two staircases provided as means of escape. Valid up to 31 December 2027.",
    "State fire and rescue services certificate. Hydrant system tested. Fire tender access provided around the building. NOC renewed. Occupancy certificate linked.",
    "Fire NOC compliance. Sprinkler network, detection system and fire pumps verified. Certificate valid until 2028. Annual maintenance contract in place for fire fighting equipment.",
    "Fire safety clearance for the hostel and laboratory blocks. Hazardous chemical storage compliant. Fire exits and assembly points marked. Valid till 31 March 2030.",
    "Certificate issued by the directorate of fire services. Building height and setback comply with fire norms. Wet riser and down comer installed. NOC valid up to 30 September 2028.",
    "Fire safety and occupancy certificate. Fire drills conducted. Extinguishers and hose cabinets inspected. The certificate remains valid till 31 March 2029 subject to annual renewal.",
    "Fire fighting arrangements verified by the fire officer. Sprinklers, hydrants, extinguishers and alarms operational. Occupancy of 1500 persons permitted. NOC valid for three years.",
    "Renewal of fire safety certificate. Detection and suppression systems tested. Evacuation plan displayed. Valid till 31 March 2028.",
    "Fire NOC issued by the directorate of fire and emergency services. Premises: academic block and hostel. Valid until 31 March 2029. Occupancy load 2100 persons.",
    "Provisional fire safety NOC. Fire alarm, wet riser, down comer and portable extinguishers provided. Compliance with NBC 2016. Valid for three year.",
    "Renewal of fire safety certificate. Sprinkler system charged, hydrant pressure tested, fire pumps operational. Expiry 30 June 2027.",
    "Fire clearance certificate for the laboratory building. Chemical storage room provided with exhaust and fire suppression. NOC valid till 15 August 2028.",
    "No objection certificate for occupancy from the fire department. Escape staircases, refuge area and signage verified. Valid up to 31 December 2026.",
    "Fire safety compliance report. Automatic detection and alarm system linked to the control room. Hose reels inspected. Certificate valid until 2029.",
    "State fire services NOC for the campus. Fire tender access, static water tank and sprinkler network available. Occupancy permitted for 3000 persons.",
    "Fire audit clearance. Extinguishers refilled, emergency lights tested, mock drill conducted. Valid till 31 March 2030.",
    "Fire protection certificate issued after inspection. Building height 18 meter, setbacks compliant. Wet riser system present. NOC valid 2027.",
    "Fire safety and occupancy NOC. Two means of escape, fire doors and smoke vents provided. Valid up to 30 September 2028. Annual renewal required.",
    "Directorate of fire services renewal receipt cum certificate. Hydrants, sprinklers and extinguishers verified. Occupancy of 1500 person permitted until 2029.",
    "Fire NOC for the new academic and workshop block. Hazardous material storage compliant. Certificate valid until 31 December 2027.",
  ],
  BUILDING_PLAN: [
    "Approved building plan sanctioned by the local planning authority. Total built up area 12,450 square metres across four floors. Floor plan shows classrooms, laboratories, library and administrative block. Covered area as per sanctioned drawing.",
    "Sanctioned building plan. Built-up area of 9,800 sq m. Ground plus three floors. Structural drawings approved. Setbacks and floor area ratio compliant with the master plan.",
    "Building plan approval letter. Constructed area 15,200 square meters. Blueprint enclosed showing lecture halls, workshops and amenities. Sanction number and date mentioned.",
    "Approved layout and building plan for the technical campus. Total covered area 11,000 sq m. Parking provision as per norms. Fire staircase shown in the drawing.",
    "Sanctioned plan for academic block. Built up area 8,750 sqm. Floor plan indicates laboratory and classroom sizes. Approval from the municipal corporation.",
    "Building plan revision approved. Additional built up area 3,400 square metres. Floor plan and elevation drawings attached. Structural stability certificate enclosed.",
    "Approved architectural plan. Total built-up area 14,600 sq m. Site plan shows access roads and green area. Plan sanctioned by the development authority.",
    "Sanctioned construction plan. Constructed area of 10,250 square metres. Floor plans for each level attached. Compliance with building bye-laws certified.",
    "Building plan approval. Built up area 7,900 sqm over three floors. Drawing indicates ramp access and toilet facilities. Sanction order number quoted.",
    "Approved plan of the institution building. Covered area 13,300 sq m. Floor plan and structural drawings vetted. Occupancy certificate applied separately.",
    "Sanctioned floor plan with built up area of 9,300 square metres. Structural drawings and elevations approved by the authority. Parking and setbacks as per bye-laws.",
    "Building plan sanction for additional floors. Covered area increased to 16,100 sq m. Floor plan revised and approved. Drawing indicates laboratories and library.",
    "Building plan sanctioned by the municipal corporation. Total built up area 18,750 sqm, ground plus four floors, floor plan attached.",
    "Approved drawing showing covered area of 11,200 square meter. Site plan, elevation and structural drawings approved. Sanction letter enclosed.",
    "Building permission letter. Constructed area 13,450 sq m. FAR consumed 1.8. Setbacks as per bye laws. Parking for 90 cars.",
    "Sanctioned revised plan for an additional floor. Built up area increased from 9,000 to 12,800 sqm. Structural stability certificate enclosed.",
    "Approved architectural and structural plan for the institute. Total built up 22,300 sq m across five floors. Drawing number and date quoted.",
    "Occupancy plan approval. Floor plan indicates classrooms, seminar hall and laboratories. Covered area 8,900 sqm. Sanctioned by development authority.",
    "Building plan approval for the campus. Blueprint shows blocks A to D, total built up area 15,600 sqm. Access road and green area marked.",
    "Sanction order for construction. Built up area 10,450 sq m. Height 21 meter. Fire staircase and ramp shown in the drawing.",
    "Approved layout plan cum building plan. Plot area 5 acre, permissible FAR 2.0, proposed built up 24,000 square meter. Sanction number noted.",
    "Plan revision approved. Covered area 17,250 sqm after addition of a laboratory block. Floor plan and elevation drawings attached.",
    "Building plan sanction for the institute building. Total floor area 12,000 sq m over four floor. Structural drawings vetted by the authority.",
    "Sanctioned building drawing. Built up area of 9,650 square metre. Floor plan shows library, classrooms and administrative wing. Approval valid.",
  ],
  UNDERTAKING: [
    "I hereby undertake that the institution shall comply with all regulations prescribed by the council. The information furnished is true and correct. I am authorised to sign this undertaking on behalf of the society.",
    "Affidavit of undertaking. We declare that no capitation fee shall be collected. The institution will maintain the prescribed faculty student ratio. Any violation may invite action.",
    "Statutory undertaking submitted by the applicant institution. We undertake to adhere to the norms of the approval process handbook. The land and building documents are genuine.",
    "Declaration and undertaking. The management undertakes to provide the committed infrastructure within the stipulated period. We shall not seek any deviation from the approved norms.",
    "I declare that the details submitted are correct to the best of my knowledge. The institution undertakes to comply with all directions of the competent authority. Signature of the authorised signatory.",
    "Undertaking regarding faculty appointment. We undertake to recruit qualified faculty as per council norms. The affidavit is sworn before the notary.",
    "We hereby declare and undertake that the institution has not been debarred. The undertaking is given for the purpose of processing the approval application. Authorised signatory.",
    "Declaration of compliance. The trust undertakes to abide by the conditions of approval. We accept responsibility for the accuracy of the documents submitted.",
    "Undertaking affidavit. The applicant undertakes to maintain records and produce them on demand. We confirm that the leased land is free from litigation.",
    "I solemnly affirm and undertake that the statements made in the application are true. The institution shall comply with the norms and standards prescribed by the council.",
    "We hereby declare and undertake to comply with council regulations and to maintain the prescribed standards. Affidavit sworn before the notary. Authorised signatory.",
    "Undertaking that the information furnished is true and correct and that the institution shall abide by the conditions of approval.",
    "Affidavit cum undertaking that no capitation fee or donation has been collected. The institution shall abide by all council norms. Sworn before the notary.",
    "Declaration by the authorised signatory that the land documents and building plans submitted are genuine and unencumbered.",
    "Undertaking to maintain the prescribed faculty student ratio and to appoint qualified faculty before commencement of classes.",
    "We undertake that the institution has not been debarred by any council or university and that no criminal case is pending against the trust.",
    "Statutory affidavit regarding compliance with the approval process handbook. The institution accepts all conditions of approval.",
    "Declaration of accuracy of the information furnished in the application. The undersigned is authorised to sign on behalf of the society.",
    "Undertaking for production of original documents on demand for verification. We confirm the leased land is free from litigation.",
    "Affidavit that the institute will provide the committed infrastructure within the stipulated time and will not seek any deviation.",
    "Compliance undertaking under the regulations. The management shall maintain records of faculty, students and infrastructure.",
    "I hereby declare and affirm that the statements in the application are true to the best of my knowledge and belief.",
    "Undertaking regarding anti ragging and grievance redressal committees constituted as per norms. Affidavit enclosed.",
    "Declaration cum undertaking by the trust that no other institution is being run from the same campus without approval.",
  ],
  OTHER: [
    "Application form for extension of approval. Fee receipt enclosed. Covering letter from the institution. Correspondence with the regional office regarding the application status.",
    "Payment receipt for the processing fee. Demand draft details. Acknowledgement of online submission. Application number generated by the portal.",
    "Covering letter forwarding the documents. Index of enclosures. Request for issue of the approval letter. Contact details of the nodal officer.",
    "Internal correspondence regarding inspection scheduling. Email thread about document deficiencies. Request for clarification on the application.",
    "Fee payment challan. Transaction reference number. Bank acknowledgement. Receipt of application fee.",
    "Grievance representation submitted by the institution. Request for reconsideration. Supporting correspondence and acknowledgements.",
    "Document checklist and index. List of enclosures attached with the application. Seal and signature of the institution.",
    "Meeting notice and agenda for the academic council. Minutes of the previous meeting. Action taken report.",
    "Application acknowledgement slip. Portal generated reference. Instructions to track the application status online.",
    "Forwarding letter from the affiliating university. List of documents transmitted. Contact information for correspondence.",
    "Bank challan for processing fee, transaction reference and payment acknowledgement.",
    "Inspection scheduling email thread with the regional office, availability dates and nodal officer contact.",
    "Index of enclosures and covering letter forwarding the application to the council.",
    "Minutes of the academic council meeting and action taken report.",
    "Grievance representation requesting reconsideration of the deficiency raised.",
    "University affiliation letter forwarding the list of documents and contact details.",
    "Fee receipt cum acknowledgement of online submission generated by the portal.",
    "Document checklist signed and sealed by the institution, list of enclosures attached.",
    "Application status printout showing the current stage and pending action.",
    "Internal note on the faculty recruitment plan and interview schedule.",
    "Press release and brochure about the institution and its programmes.",
    "Certificate of registration of the society under the Societies Registration Act.",
  ],
};

async function main() {
  const classes = Object.keys(CORPUS);
const vocab = new Set<string>();
const counts: Record<string, Record<string, number>> = {};
const totals: Record<string, number> = {};
let totalDocs = 0;

for (const cls of classes) {
  counts[cls] = {};
  let total = 0;
  for (const doc of CORPUS[cls]) {
    totalDocs += 1;
    for (const token of tokenize(doc)) {
      counts[cls][token] = (counts[cls][token] ?? 0) + 1;
      vocab.add(token);
      total += 1;
    }
  }
  totals[cls] = total;
}

const vocabSize = vocab.size;
const logPrior: Record<string, number> = {};
const unknown: Record<string, number> = {};
const logLikelihood: Record<string, Record<string, number>> = {};

for (const cls of classes) {
  logPrior[cls] = Math.log(CORPUS[cls].length / totalDocs);
  unknown[cls] = Math.log(1 / (totals[cls] + vocabSize));
  const row: Record<string, number> = {};
  for (const [token, count] of Object.entries(counts[cls])) {
    row[token] = Math.log((count + 1) / (totals[cls] + vocabSize));
  }
  logLikelihood[cls] = row;
}

const model: DocClassifierModel = {
  version: "pramaan-doc-nb-2",
  trainedAt: new Date().toISOString(),
  classes,
  vocabSize,
  examples: totalDocs,
  logPrior,
  unknown,
  logLikelihood,
};

const outDir = path.join(process.cwd(), "lib", "model");
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "doc-classifier.json"), JSON.stringify(model, null, 2));

let correct = 0;
for (const cls of classes) {
  for (const doc of CORPUS[cls]) {
    if (predict(model, doc).type === cls) correct += 1;
  }
}

const holdout: Array<[string, string]> = [
  ["Memorandum of lease for 30 years over 4.2 acres of land between lessor and lessee, rent payable monthly.", "LEASE_DEED"],
  ["Fire NOC renewed; sprinklers and hydrants inspected; valid up to 31 December 2027.", "FIRE_SAFETY"],
  ["Sanctioned floor plan with built up area of 9,300 square metres and structural drawings.", "BUILDING_PLAN"],
  ["We hereby declare and undertake to comply with council regulations; affidavit sworn before the notary.", "UNDERTAKING"],
  ["Fee receipt and covering letter for the application.", "OTHER"],
  ["Lease deed executed for a plot of 6 acres for a period of 30 years.", "LEASE_DEED"],
  ["Certificate of fire safety with automatic sprinkler system and fire exit routes.", "FIRE_SAFETY"],
  ["Approved building plan showing covered area of 11,500 sq m and floor plan.", "BUILDING_PLAN"],
  ["NOC from fire and rescue services for occupancy of the academic block; hydrant and sprinkler system functional; valid till 2028.", "FIRE_SAFETY"],
  ["Campus taken on lease for a period of thirty years; land admeasuring 5.2 acre; rent escalation clause; registered before the sub registrar.", "LEASE_DEED"],
  ["Sanction letter for revised building plan; covered area 14,800 sq. m.; structural drawings approved by the corporation.", "BUILDING_PLAN"],
  ["We affirm that the particulars given above are correct and undertake to comply with the norms of the council.", "UNDERTAKING"],
  ["Enclosure list and covering letter submitted with the application form; fee payment receipt attached.", "OTHER"],
  ["Fire safety certificate. Occupancy permitted 1200 persons. Valid upto 31 March 2029.", "FIRE_SAFETY"],
  ["Lease agreement for 4.6 hectare of land executed in favour of the educational trust for thirty years.", "LEASE_DEED"],
  ["Approved plan showing built up area of 21,000 square feet across three floors.", "BUILDING_PLAN"],
];

let holdoutCorrect = 0;
console.log(`Trained ${totalDocs} examples across ${classes.length} classes, vocab ${vocabSize}.`);
console.log(`Training accuracy: ${correct}/${totalDocs}`);
for (const [text, expected] of holdout) {
  const result = predict(model, text);
  const pass = result.type === expected;
  if (pass) holdoutCorrect += 1;
  console.log(
    `${pass ? "PASS" : "FAIL"}  expected=${expected.padEnd(14)} got=${result.type.padEnd(14)} conf=${result.confidence}`,
  );
}
console.log(`Holdout accuracy: ${holdoutCorrect}/${holdout.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
