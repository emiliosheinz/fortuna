import type { EntityManager } from "typeorm";

export interface GroupContext {
  id: string;
  position: number;
  size: number;
}

/**
 * Resolve the read-time `group: { id, position, size }` shape for an
 * arbitrary set of transactions. Standalone rows (or unknown ids) are
 * absent from the returned map. Position is the 1-based rank of the row
 * when its siblings are ordered by `date ASC, id ASC`; size is the count
 * of owned sibling rows sharing the group.
 *
 * Implementation runs a single window-function query, scoped to the
 * current user and limited to the groups the requested ids participate
 * in so we never scan unrelated siblings.
 */
export async function loadGroupContext(
  manager: EntityManager,
  userId: string,
  transactionIds: string[],
): Promise<Map<string, GroupContext>> {
  const out = new Map<string, GroupContext>();
  if (transactionIds.length === 0) return out;

  const rows: Array<{
    id: string;
    group_id: string;
    position: string;
    size: string;
  }> = await manager.query(
    `WITH targets AS (
       SELECT DISTINCT group_id
       FROM "transactions"
       WHERE user_id = $1
         AND id = ANY($2::uuid[])
         AND group_id IS NOT NULL
     ),
     siblings AS (
       SELECT
         id,
         group_id,
         ROW_NUMBER() OVER (
           PARTITION BY group_id ORDER BY date ASC, id ASC
         ) AS position,
         COUNT(*) OVER (PARTITION BY group_id) AS size
       FROM "transactions"
       WHERE user_id = $1
         AND group_id IN (SELECT group_id FROM targets)
     )
     SELECT id, group_id, position, size
     FROM siblings
     WHERE id = ANY($2::uuid[])`,
    [userId, transactionIds],
  );

  for (const row of rows) {
    out.set(row.id, {
      id: row.group_id,
      position: Number(row.position),
      size: Number(row.size),
    });
  }
  return out;
}
