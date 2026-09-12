// Lighthouse audit for challenge.md §10: início (/) and detalhe (/nfts/nft-0), mobile + desktop
// profiles, 3 runs each, reporting the median per category plus LCP/CLS/TBT.
//
// Usage: npm run lighthouse
// Requires a production build (`npm run build`) — this script builds it if `dist/` is missing.

import { execSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT_DIR = resolve(ROOT, 'lighthouse-reports')
const PORT = 4321
const RUNS_PER_CONFIG = 3

const PAGES = [
  { name: 'inicio', path: '/' },
  { name: 'detalhe', path: '/nfts/nft-0' },
]

// Desktop preset mirrors Lighthouse's own `--preset=desktop`: no device emulation, no throttling.
const PROFILES = {
  mobile: {
    formFactor: 'mobile',
    screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 2.625, disabled: false },
    throttling: {
      rttMs: 150,
      throughputKbps: 1638.4,
      cpuSlowdownMultiplier: 4,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0,
    },
  },
  desktop: {
    formFactor: 'desktop',
    screenEmulation: { mobile: false, width: 1440, height: 900, deviceScaleFactor: 1, disabled: false },
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0,
    },
  },
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function startPreviewServer() {
  const child = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: 'pipe',
  })
  return new Promise((resolvePromise, reject) => {
    let out = ''
    const onData = (data) => {
      out += data.toString()
      if (out.includes('Local:')) {
        child.stdout.off('data', onData)
        resolvePromise(child)
      }
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', (d) => process.stderr.write(d))
    child.on('error', reject)
    setTimeout(() => reject(new Error('preview server did not start in time')), 15_000)
  })
}

async function runOnce(chrome, url, profile) {
  const result = await lighthouse(
    url,
    {
      port: chrome.port,
      output: ['json', 'html'],
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      logLevel: 'error',
    },
    {
      extends: 'lighthouse:default',
      settings: {
        formFactor: profile.formFactor,
        screenEmulation: profile.screenEmulation,
        throttling: profile.throttling,
        throttlingMethod: 'simulate',
      },
    },
  )
  return result
}

async function main() {
  if (!existsSync(resolve(ROOT, 'dist'))) {
    console.log('No dist/ found — building production bundle first...')
    execSync('npm run build', { cwd: ROOT, stdio: 'inherit' })
  }
  mkdirSync(OUT_DIR, { recursive: true })

  console.log(`Starting preview server on :${PORT}...`)
  const server = await startPreviewServer()

  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
  })

  const summary = {
    generatedAt: new Date().toISOString(),
    lighthouseVersion: null,
    chromeVersion: null,
    node: process.version,
    results: [],
  }

  try {
    for (const page of PAGES) {
      for (const [profileName, profile] of Object.entries(PROFILES)) {
        const url = `http://localhost:${PORT}${page.path}`
        console.log(`\n=== ${page.name} (${profileName}) — ${url} ===`)
        const runs = []

        for (let i = 1; i <= RUNS_PER_CONFIG; i++) {
          console.log(`  run ${i}/${RUNS_PER_CONFIG}...`)
          const { lhr, report } = await runOnce(chrome, url, profile)
          summary.lighthouseVersion ??= lhr.lighthouseVersion
          summary.chromeVersion ??= lhr.environment?.hostUserAgent ?? null

          const jsonPath = resolve(OUT_DIR, `${page.name}-${profileName}-run${i}.json`)
          const htmlPath = resolve(OUT_DIR, `${page.name}-${profileName}-run${i}.html`)
          writeFileSync(jsonPath, report[0])
          writeFileSync(htmlPath, report[1])

          runs.push({
            performance: lhr.categories.performance.score * 100,
            accessibility: lhr.categories.accessibility.score * 100,
            bestPractices: lhr.categories['best-practices'].score * 100,
            seo: lhr.categories.seo.score * 100,
            lcp: lhr.audits['largest-contentful-paint'].numericValue,
            cls: lhr.audits['cumulative-layout-shift'].numericValue,
            tbt: lhr.audits['total-blocking-time'].numericValue,
          })
        }

        summary.results.push({
          page: page.name,
          path: page.path,
          profile: profileName,
          runs,
          median: {
            performance: median(runs.map((r) => r.performance)),
            accessibility: median(runs.map((r) => r.accessibility)),
            bestPractices: median(runs.map((r) => r.bestPractices)),
            seo: median(runs.map((r) => r.seo)),
            lcp: median(runs.map((r) => r.lcp)),
            cls: median(runs.map((r) => r.cls)),
            tbt: median(runs.map((r) => r.tbt)),
          },
        })
      }
    }
  } finally {
    await chrome.kill()
    server.kill()
  }

  writeFileSync(resolve(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2))
  printMarkdownSummary(summary)
}

function printMarkdownSummary(summary) {
  const TARGETS = { performance: 90, accessibility: 95, bestPractices: 95, seo: 90 }
  const lines = []
  lines.push('# Lighthouse — resumo (mediana de 3 execuções)')
  lines.push('')
  lines.push(`Gerado em: ${summary.generatedAt}`)
  lines.push(`Lighthouse: ${summary.lighthouseVersion} · Node: ${summary.node}`)
  lines.push(`User agent do Chrome: ${summary.chromeVersion}`)
  lines.push('')
  lines.push('| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP (ms) | CLS | TBT (ms) |')
  lines.push('| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |')
  for (const r of summary.results) {
    const m = r.median
    const flag = (val, target) => (val < target ? ' ⚠️' : '')
    lines.push(
      `| ${r.page} (\`${r.path}\`) | ${r.profile} | ${m.performance.toFixed(0)}${flag(m.performance, TARGETS.performance)} | ${m.accessibility.toFixed(0)}${flag(m.accessibility, TARGETS.accessibility)} | ${m.bestPractices.toFixed(0)}${flag(m.bestPractices, TARGETS.bestPractices)} | ${m.seo.toFixed(0)}${flag(m.seo, TARGETS.seo)} | ${m.lcp.toFixed(0)} | ${m.cls.toFixed(3)} | ${m.tbt.toFixed(0)} |`,
    )
  }
  lines.push('')
  lines.push('Metas: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90 (⚠️ = abaixo da meta).')
  const md = lines.join('\n') + '\n'
  writeFileSync(resolve(OUT_DIR, 'summary.md'), md)
  console.log('\n' + md)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
