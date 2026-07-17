export async function ensureDatabase(dbUrl: string): Promise<void> {
  let sql;
  try {
    sql = new Bun.SQL(dbUrl);
    // Ping to check connection
    await sql.unsafe('SELECT 1');
    return;
  } catch (err: any) {
    if (err.message && err.message.includes('does not exist')) {
      try {
        const parsed = new URL(dbUrl);
        const dbName = parsed.pathname.slice(1);
        parsed.pathname = '/postgres';
        const fallbackUrl = parsed.toString();

        const fallback = new Bun.SQL(fallbackUrl);
        try {
          await fallback.unsafe(`CREATE DATABASE "${dbName}"`);
          console.log(`Created database "${dbName}" automatically.`);
        } finally {
          await fallback.end();
        }
      } catch (e: any) {
        // Ignore fallback errors, it will just fail downstream
      }
    }
  } finally {
    if (sql) {
      await sql.end();
    }
  }
}
