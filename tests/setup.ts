/**
 * Loads .env before tests run so DATABASE_URL etc. are available.
 * CI sets these env vars directly via the workflow and won't have a .env.
 */
import "dotenv/config";
