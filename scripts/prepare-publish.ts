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

const rootPkgPath = join(rootDir, 'package.json');
const rootPkgData = JSON.parse(readFileSync(rootPkgPath, 'utf8'));
const catalog = rootPkgData.catalog || {};

// Second pass: replace workspace:* and catalog: with actual versions
for (const pkgName in pkgPaths) {
  const pkgPath = pkgPaths[pkgName]!;
  const pkgData = JSON.parse(readFileSync(pkgPath, 'utf8'));
  let modified = false;

  const replaceCatalog = (deps: Record<string, string>) => {
    let changed = false;
    for (const dep in deps) {
      if (deps[dep] === 'catalog:') {
        if (catalog[dep]) {
          deps[dep] = catalog[dep];
          changed = true;
        }
      }
    }
    return changed;
  };

  if (pkgData.dependencies) {
    for (const dep in pkgData.dependencies) {
      if (pkgData.dependencies[dep].startsWith('workspace:') && versions[dep]) {
        pkgData.dependencies[dep] = `^${versions[dep]}`;
        modified = true;
      }
    }
    if (replaceCatalog(pkgData.dependencies)) modified = true;
  }

  if (pkgData.devDependencies) {
    if (replaceCatalog(pkgData.devDependencies)) modified = true;
  }

  if (modified) {
    writeFileSync(pkgPath, JSON.stringify(pkgData, null, 2) + '\n');
    console.log(`✅ Updated workspace and catalog dependencies in ${pkgName}`);
  }
}
