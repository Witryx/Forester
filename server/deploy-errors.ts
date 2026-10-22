export class DeploymentConfigError extends Error {}

export type DeploymentStage = 'nastavení' | 'připojení' | 'migrace' | 'první účet';
const explanations: Record<string, string> = {
  '28P01':
    'Databáze odmítla přihlašovací údaje. Obnovte DATABASE_URL z připojení správného Neon projektu.',
  '28000': 'Databáze odmítla přístup. Zkontrolujte roli a připojení v Neonu.',
  '3D000': 'Cílová databáze neexistuje. Zkontrolujte DATABASE_URL.',
  '3F000': 'Cílové databázové schéma neexistuje.',
  '42501': 'Databázová role nemá oprávnění potřebná k vytvoření tabulek nebo účtu.',
  '42P07':
    'Tabulka nebo index již existuje. Ověřte, že DATABASE_URL patří samostatné databázi Foresteru.',
  '42710': 'Databázový objekt již existuje. Zkontrolujte konflikt se schématem jiné aplikace.',
  '42703':
    'Databázová tabulka má jiné sloupce, než migrace očekává. Ověřte správnou databázi Foresteru.',
  '42P01': 'Očekávaná tabulka neexistuje. Zkontrolujte migrace a cílovou databázi.',
  '42601': 'Databáze odmítla SQL migraci kvůli syntaxi.',
  '23505': 'Záznam s tímto unikátním klíčem již existuje.',
  '23503': 'Zápis porušil cizí klíč.',
  '23502': 'V povinném sloupci chybí hodnota.',
  '23514': 'Zápis porušil databázové omezení CHECK.',
  '22003': 'Číselná hodnota se nevejde do typu sloupce. Zkontrolujte kompatibilitu schématu.',
  '53300': 'Databáze dosáhla limitu připojení. Použijte pooled DATABASE_URL.',
  '57P03': 'Databáze zatím nepřijímá připojení. Zkontrolujte stav projektu v Neonu.',
  ENOTFOUND: 'Databázový server nebyl nalezen. Zkontrolujte hostname v DATABASE_URL.',
  ECONNREFUSED: 'Databázový server odmítl síťové spojení.',
  ECONNRESET: 'Spojení s databází bylo přerušeno.',
  ETIMEDOUT: 'Vypršel čas pro připojení k databázi.',
  EAI_AGAIN: 'Dočasně selhalo DNS databázového serveru.',
  SELF_SIGNED_CERT_IN_CHAIN:
    'Ověření TLS certifikátu selhalo. Zkontrolujte připojení dodané Neonem.',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'Server předložil nedůvěryhodný TLS certifikát.',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'Nepodařilo se ověřit certifikát databázového serveru.',
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY: 'Chybí důvěryhodný vydavatel certifikátu databáze.',
  ERR_TLS_CERT_ALTNAME_INVALID: 'TLS certifikát neodpovídá názvu databázového serveru.',
  CERT_HAS_EXPIRED: 'TLS certifikát databázového serveru vypršel.',
  ENOENT: 'Chybí soubor SQL migrace v nasazení.',
};

// Log only known codes and fixed explanations. Driver messages, DETAIL, queries,
// connection strings, hosts and passwords must never reach deployment logs.
export function describeDeploymentError(error: unknown, stage: DeploymentStage): string {
  if (error instanceof DeploymentConfigError) return `[${stage}] CONFIG: ${error.message}`;
  const fields = error && typeof error === 'object' ? (error as Record<string, unknown>) : {};
  const code = typeof fields.code === 'string' ? fields.code : '';
  const known = Object.hasOwn(explanations, code);
  const label = known || /^[0-9A-Z]{5}$/.test(code) ? code : 'UNKNOWN';
  const position =
    typeof fields.position === 'string' && /^\d+$/.test(fields.position)
      ? ` Pozice v SQL: ${fields.position}.`
      : '';
  return `[${stage}] ${label}: ${known ? explanations[code] : 'Příprava databáze selhala; ověřte připojení a migrace.'}${position}`;
}
