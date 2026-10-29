#!/usr/bin/env node
/**
 * 构建 dsh-idea-launcher 的两个半面（Host / Client）。
 *
 * 为什么不用 tsc 直接产出：
 *   1. Host 半要打成单文件 ESM（lib/index.js），依赖一起内联，避免安装后解析不到 node_modules；
 *   2. Client 半必须以「loader 注册的 lazy factory」形式交付（window.__ModuleLoader__.load），
 *      且只有一个 URL；tsc 直出的多文件 ESM 加载不了，所以这里用 esbuild 打 CJS 再套 loader 外壳。
 *   tsc 只负责 typecheck（npm run typecheck），不参与产物。
 */
import { build } from 'esbuild'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const outDir = join(root, 'lib')

// 1. 清空产物目录，保证「干净构建」可复现，不残留上一次的旧文件
await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })

// 2. Host 半：src/index.ts → lib/index.js，ESM、node 平台、依赖内联
//    banner 注入 createRequire：某些 CJS 依赖（iconv-lite）内部会 require('buffer')，
//    纯 ESM 产物里没有 require，会报 "Dynamic require of buffer is not supported"。
await build({
  entryPoints: [join(root, 'src/index.ts')],
  outfile: join(outDir, 'index.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: false,
  logLevel: 'info',
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module';\nconst require = __createRequire(import.meta.url);",
  },
})

// 3. Client 半：src/client.ts → 临时 CJS 产物，react 走 loader 的 require 注入
const clientCjs = await build({
  entryPoints: [join(root, 'src/client.ts')],
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  target: 'es2022',
  jsx: 'transform', // 经典 JSX：产出 React.createElement
  external: ['react', 'react-dom', 'react-dom/client'], // 三个都由浏览器模块表注入
  write: false,
  logLevel: 'info',
})

// 4. 把 CJS 产物套进 loader 外壳：id 必须是包名，factory 返回 { inject, apply }
const body = clientCjs.outputFiles[0].text
const wrapped = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(pkg.name)},
  factory(require) {
    const module = { exports: {} }
    const exports = module.exports
    ;(function (module, exports, require) {
${body}
    })(module, exports, require)
    return module.exports
  },
})
`
await writeFile(join(outDir, 'client.js'), wrapped)

console.log(`built ${pkg.name}: lib/index.js, lib/client.js`)
