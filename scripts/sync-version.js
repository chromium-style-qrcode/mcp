import { readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf-8'),
);
const serverPath = new URL('../server.json', import.meta.url);
const server = JSON.parse(readFileSync(serverPath, 'utf-8'));

server.version = pkg.version;
server.packages[0].version = pkg.version;

writeFileSync(serverPath, JSON.stringify(server, null, 2) + '\n');
