/**
 * Strato git del reviewer: esegue `git diff` e `git log` via execSync e li
 * trasforma in FileDiff[] + GitContext.
 *
 * È il PRIMO uso di git CLI nel repo (verificato: scripts/ e src/lib/ non
 * shelllano mai a git, usano solo dati già in DB). Per questo il parsing è
 * minimale e difensivo: il formato `git diff` è stabile, ma normalizziamo i
 * path e scartiamo i file senza nome (delezioni "pur7").
 *
 * Strategia: usiamo `git diff --numstat` per sapere quali file e quante righe
 * cambiano, poi `git diff -U0` per le righe effettive (U0 = zero contesto,
 * vogliamo solo aggiunte/rimozioni).
 */
import { execSync } from "node:child_process";
import type { FileDiff, GitContext } from "./types.js";

export interface DiffOptions {
  /** Ref di base (es. `origin/develop`). Default: `origin/develop`. */
  base?: string;
  /** Ref di head. Default: `HEAD`. */
  head?: string;
  /** Cwd del repo (per test). Default: process.cwd(). */
  cwd?: string;
}

/** Esegue git e torna stdout come stringa. Lancia su errore. */
function git(args: string[], cwd: string): string {
  return execSync("git " + args.map(shellQuote).join(" "), {
    cwd,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
}

/** Quote minimale per argomenti git (solo se contengono spazi o caratteri shell). */
function shellQuote(arg: string): string {
  return /[\s"'`$\\()|;&<>]/.test(arg) ? `'${arg.replace(/'/g, "'\\''")}'` : arg;
}

interface NumstatRow {
  path: string;
  status: FileDiff["status"];
  added: number;
  removed: number;
}

/** Parsa `git diff --numstat -z` in righe strutturate. */
function parseNumstat(output: string): NumstatRow[] {
  // numstat -z separa i record con NUL. Formato:
  //   <added>\t<removed>\t<path>   (modifica/add)
  //   -\t-\t<path>                 (binario)
  // Con --find-renames può comparire un campo rename:
  //   <added>\t<removed>\t<old>\t<new>  (rinomina effettiva)
  // Teniamo semplicemente il path "finale" come nuovo nome o, se assente, old.
  const records = output.split("\0").filter((r) => r.length > 0);
  const rows: NumstatRow[] = [];
  for (const rec of records) {
    const parts = rec.split("\t");
    if (parts.length < 3) continue;
    const [addedStr, removedStr, ...paths] = parts;
    const path = paths[paths.length - 1]; // ultimo = nuovo nome (o unico)
    const renamed = parts.length > 3;
    const added = addedStr === "-" ? 0 : Number(addedStr);
    const removed = removedStr === "-" ? 0 : Number(removedStr);
    let status: FileDiff["status"];
    if (renamed) status = "renamed";
    else if (added > 0 && removed === 0) status = "added";
    else if (added === 0 && removed > 0) status = "deleted";
    else status = "modified";
    rows.push({ path, status, added, removed });
  }
  return rows;
}

/** Parsa `git diff -U0` riempiendo added/removed di un FileDiff. */
function fillDiffFromUnified(file: FileDiff, unified: string): void {
  // L'header del file nel formato unified inizia con "diff --git a/... b/...".
  // Splittiamo per quel marker per isolare i blocchi per file.
  const fileBlock = unified.includes("\0")
    ? unified // già separato se usiamo -z (ma non lo usiamo qui)
    : unified;

  // Cerchiamo il blocco che riguarda questo path. Marker: "diff --git a/<path> b/<path>"
  // o "--- a/<path>" dopo il diff header. Normalizziamo: estraiamo hunk per hunk.
  const lines = fileBlock.split("\n");
  let inThisFile = false;
  let newNo = 0;
  let oldNo = 0;

  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      // "diff --git a/<path> b/<path>" → controlla se è il nostro file.
      const m = /^diff --git a\/(.*) b\/(.*)$/.exec(line);
      inThisFile = !!(m && (m[2] === file.path || m[1] === file.path));
      continue;
    }
    if (!inThisFile) continue;
    if (line.startsWith("@@")) {
      // "@@ -oldStart,oldLen +newStart,newLen @@" → estrai newStart/oldStart.
      const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
      if (m) {
        oldNo = Number(m[1]);
        newNo = Number(m[2]);
      }
      continue;
    }
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("+")) {
      file.added.push({ text: line.slice(1), newNo });
      newNo++;
    } else if (line.startsWith("-")) {
      file.removed.push({ text: line.slice(1), oldNo });
      oldNo++;
    } else if (line.startsWith(" ") || line === "") {
      // contesto o riga vuota: avanza entrambi i contatori per restare allineati.
      if (line.startsWith(" ")) {
        newNo++;
        oldNo++;
      }
    }
  }
}

/**
 * Carica il diff base..head come FileDiff[].
 *
 * Usa due chiamate git:
 * 1. `git diff --numstat -z --find-renames` → lista file + status.
 * 2. `git diff -U0 --find-renames` → contenuto righe (solo add/del, zero contesto).
 */
export function loadDiff(opts: DiffOptions = {}): FileDiff[] {
  const cwd = opts.cwd ?? process.cwd();
  const base = opts.base ?? "origin/develop";
  const head = opts.head ?? "HEAD";
  const range = `${base}..${head}`;

  const numstat = git(
    ["diff", "--numstat", "-z", "--find-renames", range],
    cwd,
  );
  const rows = parseNumstat(numstat);
  if (rows.length === 0) return [];

  const unified = git(["diff", "-U0", "--find-renames", range], cwd);

  return rows.map((r) => {
    const file: FileDiff = {
      path: r.path,
      status: r.status,
      added: [],
      removed: [],
      hunks: [],
    };
    fillDiffFromUnified(file, unified);
    return file;
  });
}

/** Carica GitContext: subject dei commit nel range + branch HEAD. */
export function loadGitContext(opts: DiffOptions = {}): GitContext {
  const cwd = opts.cwd ?? process.cwd();
  const base = opts.base ?? "origin/develop";
  const head = opts.head ?? "HEAD";
  const range = `${base}..${head}`;

  const subjectsRaw = git(["log", "--format=%s", range], cwd);
  const commitSubjects = subjectsRaw.split("\n").filter((s) => s.length > 0);

  let branch = "";
  try {
    // --show-current ritorna "" in detached HEAD; fallback a rev-parse --abbrev-ref.
    branch = git(["branch", "--show-current"], cwd).trim();
    if (!branch) branch = git(["rev-parse", "--abbrev-ref", "HEAD"], cwd).trim();
    // rev-parse in detached HEAD ritorna il literal "HEAD": non è un branch.
    if (branch === "HEAD") branch = "";
  } catch {
    branch = "";
  }
  // In GitHub Actions su pull_request il checkout è detached sul merge-ref:
  // il nome del branch sorgente della PR arriva da GITHUB_HEAD_REF.
  if (!branch) branch = process.env.GITHUB_HEAD_REF ?? "";

  return { commitSubjects, branch };
}
