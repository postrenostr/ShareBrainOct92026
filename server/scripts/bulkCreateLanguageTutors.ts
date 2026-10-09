import "dotenv/config";
import { pool } from "../db";
import { initializeLanguageTutorCatalog } from "../services/languageTutorCatalog";

try {
  console.log("Language tutor catalog:", await initializeLanguageTutorCatalog());
} catch {
  console.error("Language tutor initialization failed. Check database connectivity and the catalog schema; no partial catalog update was committed.");
  process.exitCode = 1;
} finally {
  await pool.end();
}
