#!/usr/bin/env node
// 云悦酒店 App 自动打包脚本（Python 版 build.py 的 Node 移植 —— 本项目规定脚本一律 .mjs）
// 用法：node build.mjs [版本类型]
//   - 不传参 / minor：递增 versionName 小数位（0.48 -> 0.49），versionCode +1
//   - major         ：递增 versionName 整数位（0.48 -> 1.0）
//   - --check       ：只自检【版本递增 + 文件改写】逻辑（fixture，不碰真文件、不跑 gradle）
//
// 每次运行：
//   1. 自动递增版本号（versionCode +1，versionName 递增）
//   2. 构建前端 (npm run build)
//   3. 同步到安卓 (npx cap sync android)
//   4. 打包 APK (gradle assembleDebug)
//   5. 复制到 D:/教学app/ 并自动命名 云悦酒店-vX.X.apk
//
// ★ 行尾纪律：build.gradle / src/version.js 都是 CRLF —— 只做【行内替换】、新文件显式写 \r\n，
//   绝不让一次打包把这两个文件的行尾翻掉（否则整个文件在 git 里全变）。

import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'

const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)))
const ANDROID = path.join(BASE, 'android')
const GRADLE_FILE = path.join(ANDROID, 'app', 'build.gradle')
const OUTPUT_APK = path.join(ANDROID, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
const DEST_DIR = path.dirname(BASE)
const VERSION_JS = path.join(BASE, 'src', 'version.js')

const SDK = 'D:\\教学app\\apk打包\\android\\sdk'
const GRADLE = 'D:\\教学app\\apk打包\\gradle\\gradle-8.13\\bin\\gradle.bat'
const JAVA_HOME = 'D:\\教学app\\java 21\\jdk-21.0.12.1-hotspot'   // ★ 目录名带空格（原 build.py 同款）

// ── 纯函数（--check 直接测这几个）──────────────────────────────────────
export function parseVersion(gradleText) {
  const vc = /versionCode\s+(\d+)/.exec(gradleText)
  const vn = /versionName\s+"([^"]+)"/.exec(gradleText)
  if (!vc || !vn) throw new Error('build.gradle 里找不到 versionCode / versionName')
  return { versionCode: Number(vc[1]), versionName: vn[1] }
}

export function bumpVersion(versionCode, versionName, bumpType = 'minor') {
  const [major, minor] = versionName.split('.').map(Number)
  if (!Number.isFinite(major) || !Number.isFinite(minor)) throw new Error('versionName 不是 x.y 形式：' + versionName)
  return bumpType === 'major'
    ? { versionCode: versionCode + 1, versionName: `${major + 1}.0` }
    : { versionCode: versionCode + 1, versionName: `${major}.${minor + 1}` }
}

// 行内替换：不改动任何换行符（CRLF 原样保留）
export function applyVersion(gradleText, { versionCode, versionName }) {
  return gradleText
    .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
    .replace(/versionName\s+"[^"]+"/, `versionName "${versionName}"`)
}

export function versionJsText({ versionCode, versionName }) {
  return '// 由 build.mjs 自动生成\r\n'
    + `export const APP_VERSION = '${versionName}'\r\n`
    + `export const APP_VERSION_CODE = ${versionCode}\r\n`
}

// ── --check：fixture 自检（不碰真文件、不跑 gradle）────────────────────
function selfCheck() {
  let pass = 0, fail = 0
  const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
  console.log('▶ build.mjs --check（版本递增 + 文件改写逻辑自检）')

  // 1) 递增算术：minor / major / 默认
  const minor = bumpVersion(48, '0.48')
  ok(minor.versionCode === 49 && minor.versionName === '0.49', 'minor：0.48(vc48) → 0.49(vc49)', JSON.stringify(minor))
  const maj = bumpVersion(48, '0.48', 'major')
  ok(maj.versionCode === 49 && maj.versionName === '1.0', 'major：0.48 → 1.0（小数位归零）', JSON.stringify(maj))
  const def = bumpVersion(9, '1.9')
  ok(def.versionName === '1.10', '不传参 = minor：1.9 → 1.10（不是 2.0）', JSON.stringify(def))

  // 2) gradle 改写：只动两行、CRLF 保留、其他字节不变
  const fixture = 'android {\r\n    defaultConfig {\r\n        versionCode 48\r\n        versionName "0.48"\r\n        applicationId "yunyue.hotelsim"\r\n    }\r\n}\r\n'
  const rewritten = applyVersion(fixture, { versionCode: 49, versionName: '0.49' })
  ok(/versionCode 49/.test(rewritten) && /versionName "0.49"/.test(rewritten), 'gradle：两行都被改写')
  ok(!/[^\r]\n/.test(rewritten) && (rewritten.match(/\r\n/g) || []).length === (fixture.match(/\r\n/g) || []).length,
    'gradle：CRLF 行尾数量不变（无 LF 混入）')
  ok(rewritten.replace(/versionCode 49/, 'versionCode 48').replace('versionName "0.49"', 'versionName "0.48"') === fixture,
    'gradle：除版本两行外逐字节相同')
  ok(parseVersion(rewritten).versionCode === 49 && parseVersion(rewritten).versionName === '0.49', 'gradle：改写后可被自己解析回读')

  // 3) version.js：CRLF + 内容格式
  const vjs = versionJsText({ versionCode: 49, versionName: '0.49' })
  ok(vjs.split('\r\n').length === 4 && !/[^\r]\n/.test(vjs), 'version.js：三行内容 + 全 CRLF')
  ok(/APP_VERSION = '0\.49'/.test(vjs) && /APP_VERSION_CODE = 49/.test(vjs), 'version.js：版本号与 code 正确写入')

  // 4) 解析：真实 build.gradle 可被解析
  try {
    const real = parseVersion(readFileSync(GRADLE_FILE, 'utf8'))
    ok(Number.isFinite(real.versionCode) && /^\d+\.\d+$/.test(real.versionName),
      `真实 build.gradle 可解析：vc=${real.versionCode} vn=${real.versionName}`)
  } catch (e) { ok(false, '真实 build.gradle 可解析', e.message) }

  // 5) 工具链路径存在
  ok(existsSync(SDK) && existsSync(GRADLE) && existsSync(JAVA_HOME), 'Android SDK / Gradle / JDK 三条路径都存在')

  // 6) 沙盒往返：在临时目录真读写一遍（证明 write→read 闭环，且不误伤真文件）
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'buildmjs-'))
  try {
    const p = path.join(tmp, 'build.gradle')
    writeFileSync(p, rewritten, 'utf8')
    const back = parseVersion(readFileSync(p, 'utf8'))
    ok(back.versionCode === 49 && back.versionName === '0.49', '沙盒往返：写入后读回一致')
    ok((readFileSync(p, 'utf8').match(/\r\n/g) || []).length === (rewritten.match(/\r\n/g) || []).length,
      `沙盒往返：行尾仍是 CRLF（${(rewritten.match(/\r\n/g) || []).length} 个）`)
  } finally { rmSync(tmp, { recursive: true, force: true }) }

  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
  process.exit(fail ? 1 : 0)
}

// ── 正式流程 ─────────────────────────────────────────────────────────
function run(cmd, cwd, env) {
  console.log(`\n>>> ${cmd}`)
  const r = spawnSync(cmd, { cwd, env, shell: true, stdio: 'inherit' })
  if (r.status !== 0) { console.log(`!!! 命令失败: ${cmd}`); process.exit(1) }
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--check')) return selfCheck()
  const bumpType = args[0] || 'minor'

  const gradleText = readFileSync(GRADLE_FILE, 'utf8')
  const old = parseVersion(gradleText)
  const next = bumpVersion(old.versionCode, old.versionName, bumpType)
  console.log(`版本递增: ${old.versionName} (vc ${old.versionCode}) -> ${next.versionName} (vc ${next.versionCode})`)

  writeFileSync(GRADLE_FILE, applyVersion(gradleText, next), 'utf8')
  writeFileSync(VERSION_JS, versionJsText(next), 'utf8')
  console.log(`  已同步前端版本号 -> src/version.js (${next.versionName} / ${next.versionCode})`)

  const env = { ...process.env, ANDROID_HOME: SDK, ANDROID_SDK_ROOT: SDK, JAVA_HOME }

  // 1. 构建前端   2. 同步安卓   3. 打包 APK
  run('npm run build', BASE, env)
  run('npx cap sync android', BASE, env)
  run(`"${GRADLE}" assembleDebug`, ANDROID, env)

  // 4. 复制并命名
  const dest = path.join(DEST_DIR, `云悦酒店-v${next.versionName}.apk`)
  if (!existsSync(OUTPUT_APK)) { console.log(`!!! 没找到 APK 产物: ${OUTPUT_APK}`); process.exit(1) }
  copyFileSync(OUTPUT_APK, dest)
  console.log(`\n✅ 打包完成: ${dest}`)
  console.log(`   版本号: versionCode=${next.versionCode}, versionName=${next.versionName}`)
}

// 被 import 时不执行（--check 的纯函数可被测试引用）
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) main()
