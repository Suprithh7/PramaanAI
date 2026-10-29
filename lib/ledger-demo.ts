import { existsSync, promises as fs } from "node:fs";
import path from "node:path";

const BACKUP_PATH = path.join(process.cwd(), "storage", "ledger-tamper-backup.json");

export type LedgerBackup = { sequence: number; detail: string | null };

export async function readLedgerBackup(): Promise<LedgerBackup | null> {
  if (!existsSync(BACKUP_PATH)) return null;
  try {
    const parsed = JSON.parse(await fs.readFile(BACKUP_PATH, "utf8")) as LedgerBackup;
    return typeof parsed.sequence === "number" ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeLedgerBackup(backup: LedgerBackup): Promise<void> {
  await fs.mkdir(path.dirname(BACKUP_PATH), { recursive: true });
  await fs.writeFile(BACKUP_PATH, JSON.stringify(backup));
}

export async function clearLedgerBackup(): Promise<void> {
  await fs.rm(BACKUP_PATH, { force: true });
}
