import { createHash, randomBytes, randomUUID } from "node:crypto";

export const tenWordsScopes = ["languages:read", "lessons:read", "audio:read"] as const;
export type TenWordsScope = typeof tenWordsScopes[number];
export interface ClientOptions { name: string; scopes: TenWordsScope[]; rateLimit: number }
export interface QueryDatabase {
  query(sql: string, values?: any[]): Promise<{ rows: any[] }>;
}
const publicColumns = `id, name, key_prefix AS "keyPrefix", scopes, rate_limit AS "rateLimit",
  usage_count AS "usageCount", last_used_at AS "lastUsedAt", created_at AS "createdAt", revoked_at AS "revokedAt"`;
export function hashTenWordsKey(key: string) { return createHash("sha256").update(key).digest("hex"); }
function credentials() {
  const key = `tw_${randomBytes(32).toString("hex")}`;
  return { key, hash: hashTenWordsKey(key), prefix: key.slice(0, 11) };
}
export class TenWordsApiKeys {
  constructor(private database: QueryDatabase) {}
  async list(owner: string) {
    return (await this.database.query(`SELECT ${publicColumns} FROM ten_words_api_clients WHERE owner_id=$1 ORDER BY created_at DESC`, [owner])).rows;
  }
  async create(owner: string, options: ClientOptions) {
    const secret = credentials();
    const { rows } = await this.database.query(`INSERT INTO ten_words_api_clients
      (id, owner_id, name, key_hash, key_prefix, scopes, rate_limit) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${publicColumns}`,
      [randomUUID(), owner, options.name, secret.hash, secret.prefix, options.scopes, options.rateLimit]);
    return { key: secret.key, client: rows[0] };
  }
  async rotate(owner: string, id: string) {
    const secret = credentials();
    const { rows } = await this.database.query(`UPDATE ten_words_api_clients SET key_hash=$3, key_prefix=$4
      WHERE owner_id=$1 AND id=$2 AND revoked_at IS NULL RETURNING ${publicColumns}`, [owner, id, secret.hash, secret.prefix]);
    return rows[0] ? { key: secret.key, client: rows[0] } : null;
  }
  async revoke(owner: string, id: string) {
    const { rows } = await this.database.query(`UPDATE ten_words_api_clients SET revoked_at=COALESCE(revoked_at,now())
      WHERE owner_id=$1 AND id=$2 RETURNING ${publicColumns}`, [owner, id]);
    return rows[0] || null;
  }
  async authorize(key: string, scope: TenWordsScope): Promise<"ok" | "invalid" | "forbidden" | "limited"> {
    const hash = hashTenWordsKey(key);
    // Atomic update serializes concurrent requests for this client across all server instances.
    const { rows } = await this.database.query(`UPDATE ten_words_api_clients SET
      window_count=CASE WHEN window_start=date_trunc('minute',now()) THEN window_count+1 ELSE 1 END,
      window_start=date_trunc('minute',now()), usage_count=usage_count+1, last_used_at=now()
      WHERE key_hash=$1 AND revoked_at IS NULL AND $2=ANY(scopes)
      AND (window_start<>date_trunc('minute',now()) OR window_count<rate_limit) RETURNING id`, [hash, scope]);
    if (rows.length) return "ok";
    const existing = await this.database.query(`SELECT scopes FROM ten_words_api_clients WHERE key_hash=$1 AND revoked_at IS NULL`, [hash]);
    if (!existing.rows.length) return "invalid";
    return existing.rows[0].scopes.includes(scope) ? "limited" : "forbidden";
  }
}
