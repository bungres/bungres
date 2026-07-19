import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const rootDir = process.cwd();
const packagesDir = join(rootDir, 'packages');
const packages = readdirSync(packagesDir);

const versions: Record<string, string> = {};
const pkgPaths: Record<string, string> = {};

// First pass: collect versions
for (const pkg of packages) {
  const pkgPath = join(packagesDir, pkg, 'package.json');
  if (existsSync(pkgPath)) {
    const pkgData = JSON.parse(readFileSync(pkgPath, 'utf8'));
    versions[pkgData.name] = pkgData.version;
    pkgPaths[pkgData.name] = pkgPath;
  }
}

// Second pass: replace workspace:* with actual versions
for (const pkgName in pkgPaths) {
  const pkgPath = pkgPaths[pkgName]!;
  const pkgData = JSON.parse(readFileSync(pkgPath, 'utf8'));
  let modified = false;

  if (pkgData.dependencies) {
    for (const dep in pkgData.dependencies) {
      if (pkgData.dependencies[dep].startsWith('workspace:') && versions[dep]) {
        pkgData.dependencies[dep] = `^${versions[dep]}`;
        modified = true;
      }
    }
  }

  if (modified) {
    writeFileSync(pkgPath, JSON.stringify(pkgData, null, 2) + '\n');
    console.log(`✅ Updated workspace dependencies in ${pkgName}`);
  }
}
