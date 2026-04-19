import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

// Load .env from project root regardless of cwd
const projectRoot = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(projectRoot, ".env") });

// Debug: confirm env loaded
console.log("  USDC Mint:", process.env.USDC_MINT || "(default)");



// Now import the actual server
await import("./src/index.ts");
