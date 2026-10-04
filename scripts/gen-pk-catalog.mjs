// Builds data/pk-catalog.json — the AgenticCore Pakistan price list the
// assistants and the Telegram bot quote from — out of the PK site's own
// published data (Agenticcore-pk/data/services.json + packages.json).
// The server also refreshes it live from agenticcorepk.com (services/pk-catalog.mjs);
// this bundled copy is the fallback when that site can't be reached.
//
//   node scripts/gen-pk-catalog.mjs ../Agenticcore-pk/data

import fs from 'fs';
import path from 'path';
import { compactCatalog } from '../services/pk-catalog.mjs';

const dir = process.argv[2] || '../Agenticcore-pk/data';
const services = JSON.parse(fs.readFileSync(path.join(dir, 'services.json'), 'utf8'));
const packages = JSON.parse(fs.readFileSync(path.join(dir, 'packages.json'), 'utf8'));
const out = compactCatalog(services, packages);
fs.writeFileSync(new URL('../data/pk-catalog.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log('pk-catalog.json:', out.services.length, 'services,', out.packages.length, 'packages');
