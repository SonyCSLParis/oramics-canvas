import { mkdir, readFile, rm, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';
import { minify as minifyHtml } from 'html-minifier-terser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const srcPublic = path.join(root, 'public');
const srcCss = path.join(root, 'css', 'style.css');
const outDir = path.join(root, 'dist');

const jsFiles = [
  'sketch.js',
  'juce_frontend.js',
  'js/p5.min.js',
];

const htmlFiles = ['index.html', 'vst_bridge.html'];
const plainCopyFiles = ['manifest.json'];

async function ensureDir(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function minifyJs(relPath) {
  const inputPath = path.join(srcPublic, relPath);
  const outputPath = path.join(outDir, relPath);
  const source = await readFile(inputPath, 'utf8');
  const result = await transform(source, {
    loader: 'js',
    minify: true,
    target: 'es2018',
  });

  await ensureDir(outputPath);
  await writeFile(outputPath, result.code, 'utf8');
}

async function minifyHtmlFile(relPath) {
  const inputPath = path.join(srcPublic, relPath);
  const outputPath = path.join(outDir, relPath);
  const source = await readFile(inputPath, 'utf8');
  const result = await minifyHtml(source, {
    collapseWhitespace: true,
    removeComments: true,
    minifyCSS: true,
    minifyJS: true,
  });

  await ensureDir(outputPath);
  await writeFile(outputPath, result, 'utf8');
}

async function copyPlainFile(relPath) {
  const inputPath = path.join(srcPublic, relPath);
  const outputPath = path.join(outDir, relPath);
  await ensureDir(outputPath);
  await copyFile(inputPath, outputPath);
}

async function build() {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  for (const file of jsFiles) {
    await minifyJs(file);
  }

  for (const file of htmlFiles) {
    await minifyHtmlFile(file);
  }

  for (const file of plainCopyFiles) {
    await copyPlainFile(file);
  }

  const cssOut = path.join(outDir, 'css', 'style.css');
  await ensureDir(cssOut);
  const cssSource = await readFile(srcCss, 'utf8');
  const cssMin = await transform(cssSource, {
    loader: 'css',
    minify: true,
    target: 'es2018',
  });
  await writeFile(cssOut, cssMin.code, 'utf8');

  console.log(`Built web assets into: ${outDir}`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
