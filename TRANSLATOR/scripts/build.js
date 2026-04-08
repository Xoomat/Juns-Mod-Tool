const fs = require("fs/promises");
const path = require("path");

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function copyDirectory(sourceDir, targetDir) {
  await fs.mkdir(targetDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
      continue;
    }

    await fs.copyFile(sourcePath, targetPath);
  }
}

async function removeIfExists(targetPath) {
  if (await pathExists(targetPath)) {
    await fs.rm(targetPath, { recursive: true, force: true });
  }
}

async function main() {
  const projectDir = path.resolve(__dirname, "..");
  const workspaceRoot = path.resolve(projectDir, "..", "..");
  const electronDistDir = path.join(projectDir, "node_modules", "electron", "dist");
  const outputDir = path.join(workspaceRoot, "bin", "translator");
  const appDir = path.join(outputDir, "resources", "app");

  if (!await pathExists(electronDistDir)) {
    throw new Error("Electron runtime was not found. Run npm install in TRANSLATOR first.");
  }

  await removeIfExists(outputDir);
  await copyDirectory(electronDistDir, outputDir);

  const electronExePath = path.join(outputDir, "electron.exe");
  const translatorExePath = path.join(outputDir, "translator.exe");
  if (await pathExists(electronExePath)) {
    await fs.rename(electronExePath, translatorExePath);
  }

  await fs.mkdir(appDir, { recursive: true });

  const filesToCopy = [
    "index.html",
    "main.js",
    "preload.js",
    "renderer.js",
    "styles.css"
  ];

  for (const fileName of filesToCopy) {
    await fs.copyFile(
      path.join(projectDir, fileName),
      path.join(appDir, fileName)
    );
  }

  const runtimePackageJson = {
    name: "mods-translator",
    productName: "Mods Translator",
    version: "1.0.0",
    description: "Translation tool for MDRG mods",
    main: "main.js"
  };

  await fs.writeFile(
    path.join(appDir, "package.json"),
    JSON.stringify(runtimePackageJson, null, 2),
    "utf8"
  );

  await fs.writeFile(
    path.join(outputDir, "BUILD_INFO.txt"),
    [
      "Mods Translator build",
      `Built: ${new Date().toISOString()}`,
      `Executable: ${translatorExePath}`,
      `App files: ${appDir}`
    ].join("\n"),
    "utf8"
  );

  console.log(`Build complete: ${outputDir}`);
  console.log(`Run: ${translatorExePath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
