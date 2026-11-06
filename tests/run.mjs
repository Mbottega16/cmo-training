// `npm test`: runs every tests/*.test.ts with Node's built-in TypeScript support.
// Node 23.6+ strips types by default. Node 22.6 to 23.5 (the Windows PC has 22.14) needs the flag.
import { spawnSync } from 'node:child_process';

const flags = process.features.typescript ? [] : ['--experimental-strip-types', '--disable-warning=ExperimentalWarning'];
const run = spawnSync(process.execPath, [...flags, '--test', 'tests/*.test.ts'], { stdio: 'inherit' });
process.exit(run.status ?? 1);
