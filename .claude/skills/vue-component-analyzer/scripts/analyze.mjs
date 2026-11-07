#!/usr/bin/env node
// Static analyzer for Vue 3 single-file components.
//
// Usage (run from the Vue app root, the folder with package.json and node_modules):
//   node <skill>/scripts/analyze.mjs [srcDir=src] [--json] [--min-block=6] [--min-decls=4]
//
// It measures component structure and flags performance and code-reuse candidates.
// It never edits files. Output is a text report by default, or JSON with --json.
// Rule IDs are documented in ../references/rules.md.

import { createRequire } from 'module'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

// ---------- CLI ----------

const argv = process.argv.slice(2)
const flags = Object.fromEntries(
  argv.filter(a => a.startsWith('--')).map(a => {
    const [k, v] = a.slice(2).split('=')
    return [k, v ?? true]
  })
)
const srcDir = argv.find(a => !a.startsWith('--')) || 'src'
// Numeric flags must be written --name=N; a bare --name (value `true`) would coerce to 1.
const numFlag = (name, fallback) => {
  if (flags[name] === undefined) return fallback
  const n = Number(flags[name])
  if (flags[name] === true || !Number.isFinite(n) || n < 0) {
    console.error(`--${name} needs a non-negative number, written --${name}=N`)
    process.exit(2)
  }
  return n
}
const MIN_BLOCK = numFlag('min-block', 6) // min element count for a duplicated template block
const MIN_DECLS = numFlag('min-decls', 4) // min declarations for a duplicated CSS rule body

// Resolve the compiler from the *target app*, not from this script's folder, so the
// skill adds no dependency of its own and always matches the app's Vue version.
const appRequire = createRequire(path.join(process.cwd(), 'package.json'))
let sfc
for (const id of ['vue/compiler-sfc', '@vue/compiler-sfc']) {
  try { sfc = appRequire(id); break } catch { /* try next */ }
}
if (!sfc) {
  console.error('Could not load vue/compiler-sfc from ' + process.cwd() +
    '. Run this from the Vue app root after installing dependencies.')
  process.exit(2)
}
if (!fs.existsSync(srcDir)) {
  console.error(`Source directory not found: ${srcDir}`)
  process.exit(2)
}

// ---------- Helpers ----------

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.nuxt', '.output', 'coverage'])

function listFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) listFiles(full, out)
    else out.push(full)
  }
  return out
}

// Paths relative to the app root; files outside it keep their absolute path instead of a ../ chain.
const rel = f => {
  const r = path.relative(process.cwd(), f)
  return (r.startsWith('..') ? path.resolve(f) : r).split(path.sep).join('/')
}
const hash = s => crypto.createHash('md5').update(s).digest('hex').slice(0, 12)
const lineCount = s => (s ? s.split('\n').length : 0)
// Absolute file line for an offset inside a block's content. A block's loc.start is
// where its content begins (right after the opening tag), so offset 0 sits on that line.
const lineAt = (block, offset) => block.loc.start.line + (block.content.slice(0, offset).match(/\n/g) || []).length
const stripStrings = s => s.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, '""')
// Replace each template literal with just its ${} expressions, so `${item.id}-${i}` reads as
// `item.id + i` rather than disappearing entirely under stripStrings.
const templateExprs = s => s.replace(/`(?:[^`\\]|\\.)*`/g, m => [...m.matchAll(/\$\{([^}]*)\}/g)].map(x => x[1]).join(' + ') || '""')
// Map.groupBy needs Node 21+; package engines often still allow Node 20.
const groupBy = (arr, fn) => {
  const m = new Map()
  for (const x of arr) { const k = fn(x); m.has(k) ? m.get(k).push(x) : m.set(k, [x]) }
  return m
}
// Split "a, {b, c}, i" on top-level commas only, so destructured aliases stay whole.
const splitTopLevel = s => {
  const out = []; let depth = 0, cur = ''
  for (const ch of s) {
    if ('{[('.includes(ch)) depth++
    if ('}])'.includes(ch)) depth--
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = '' } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
const normalizeCode = s => stripComments(s).replace(/\s+/g, ' ').trim()
// PascalCase and kebab-case tags refer to the same component, so compare on this form.
const normTag = t => t.replace(/-/g, '').toLowerCase()

const findings = []
const add = (rule, severity, file, line, message, extra = {}) =>
  findings.push({ rule, severity, file, line, message, ...extra })

// Body patterns that make a function cost O(n) or more per call.
const LOOP_RE = /\.(filter|map|reduce|sort|find|findIndex|forEach|flatMap|some|every)\s*\(|\bfor\s*\(|\bwhile\s*\(/
// Collection ops written inline in a template expression re-run on every render.
const INLINE_OP_RE = /\.(filter|map|reduce|sort|find|findIndex|flatMap)\s*\(/g
// Per-component lifecycle/handler names are expected to repeat across files; skip them
// when looking for repeated helper names worth extracting.
// The lookahead requires a word boundary in camelCase, so `onClick` matches but `online` doesn't.
const PER_COMPONENT_NAME_RE = /^(load|fetch|handle|on|toggle|open|close|submit|reset|init|update|set|save|remove|delete|add|select|clear|apply|refresh)(?=[A-Z]|$)/
const BUILTIN_COMPONENTS = new Set(['transition', 'transitiongroup', 'keepalive', 'teleport', 'suspense', 'component', 'slot',
  'routerlink', 'routerview'].map(normTag))

function parseJs(code, lang) {
  const plugins = []
  if (lang === 'ts' || lang === 'tsx') plugins.push('typescript')
  if (lang === 'jsx' || lang === 'tsx') plugins.push('jsx')
  return sfc.babelParse(code, { sourceType: 'module', plugins })
}

// ---------- Shared helpers (utils / composables) ----------
// Exported names from these folders are what components should reuse instead of
// redefining. For exported use*() composables we also collect the keys they return,
// since that is how their helpers reach components.

const files = listFiles(srcDir)
const vueFiles = files.filter(f => f.endsWith('.vue'))
const helperFiles = files.filter(f => /\.(m?js|ts)$/.test(f) && /(^|\/)(utils|composables|helpers|lib|hooks)\//.test(rel(f)))
const sharedHelpers = {} // name -> [file]
const sharedBodies = new Map() // normalized body hash -> {name, file}

function functionText(node, code) {
  // Hash params + body only, so the same logic under a different name still matches.
  const params = node.params.map(p => code.slice(p.start, p.end)).join(',')
  return normalizeCode(params + '=>' + code.slice(node.body.start, node.body.end))
}

for (const file of helperFiles) {
  const code = fs.readFileSync(file, 'utf8')
  let ast
  try { ast = parseJs(code, file.endsWith('.ts') ? 'ts' : 'js') } catch { continue }
  const record = (name, fnNode) => {
    (sharedHelpers[name] ||= []).push(rel(file))
    if (fnNode) sharedBodies.set(hash(functionText(fnNode, code)), { name, file: rel(file) })
  }
  for (const stmt of ast.program.body) {
    const decl = stmt.type === 'ExportNamedDeclaration' ? stmt.declaration : null
    if (!decl) {
      if (stmt.type === 'ExportNamedDeclaration') stmt.specifiers.forEach(s => record(s.exported.name ?? s.exported.value))
      continue
    }
    const fns = []
    if (decl.type === 'FunctionDeclaration') fns.push([decl.id.name, decl])
    if (decl.type === 'VariableDeclaration') {
      for (const d of decl.declarations) {
        if (d.id.type !== 'Identifier') continue
        // Exported constants (config objects, lookup tables) are not helpers a component
        // could "shadow", so only function-valued exports are recorded.
        const isFn = d.init && /FunctionExpression|ArrowFunctionExpression/.test(d.init.type)
        if (isFn) fns.push([d.id.name, d.init])
      }
    }
    for (const [name, fn] of fns) {
      record(name, fn)
      if (!/^use[A-Z]/.test(name) || fn.body.type !== 'BlockStatement') continue
      const ret = fn.body.body.findLast(s => s.type === 'ReturnStatement')
      if (ret?.argument?.type === 'ObjectExpression') {
        for (const p of ret.argument.properties) {
          const key = p.key?.name ?? p.key?.value
          if (key) record(key)
        }
      }
    }
  }
}

// Global registrations (app.component('X', ...)) count as resolved components.
const globalComponents = new Set()
for (const f of files.filter(f => /(^|\/)main\.(m?js|ts)$/.test(f))) {
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/\.component\(\s*['"]([\w-]+)['"]/g)) globalComponents.add(normTag(m[1]))
}
// Auto-import plugins resolve components at build time, so "unresolved" would be noise.
const pkg = (() => { try { return JSON.parse(fs.readFileSync('package.json', 'utf8')) } catch { return {} } })()
const autoImport = Boolean({ ...pkg.dependencies, ...pkg.devDependencies }['unplugin-vue-components']) || files.some(f => f.endsWith('components.d.ts'))
// Nuxt auto-imports components from components/ at build time, the same way.
const isNuxt = Boolean({ ...pkg.dependencies, ...pkg.devDependencies }.nuxt)
const notes = []
if (autoImport) notes.push('unplugin-vue-components detected; template/unresolved-component was skipped.')
if (isNuxt) notes.push('Nuxt detected; template/unresolved-component was skipped (components are auto-imported).')

// ---------- Script analysis ----------

function analyzeScript(descriptor, file) {
  const isSetup = Boolean(descriptor.scriptSetup)
  const block = descriptor.scriptSetup || descriptor.script
  const info = {
    api: isSetup ? 'script-setup' : 'options',
    lines: block ? lineCount(block.content) : 0,
    props: [], emits: 0, computed: 0, state: 0, watchers: 0,
    functions: [], // {name, line, expensive, bodyHash}
    registered: new Set(), // component names available to the template
    returned: [], // setup() return keys (options API only)
    // Only set once a props binding is actually found (setup(props) or `const x = defineProps()`);
    // otherwise an unrelated local named `props` would be reported as a prop mutation.
    propsVar: null,
  }
  if (!block) return info
  const code = block.content
  let ast
  try { ast = parseJs(code, block.lang) } catch (e) {
    add('parse-error', 'low', file, block.loc.start.line, `Script did not parse: ${e.message}`)
    return info
  }
  const abs = node => block.loc.start.line + node.loc.start.line - 1

  // Pick the scope whose declarations make up the component: the <script setup> body,
  // or the body of setup() inside `export default {}` / `defineComponent({})`.
  let scope = null
  let options = null
  if (isSetup) scope = ast.program.body
  else {
    const exp = ast.program.body.find(s => s.type === 'ExportDefaultDeclaration')
    let obj = exp?.declaration
    if (obj?.type === 'CallExpression') obj = obj.arguments[0]
    if (obj?.type === 'ObjectExpression') {
      options = Object.fromEntries(obj.properties.filter(p => p.key).map(p => [p.key.name || p.key.value, p]))
      const setup = options.setup
      const fn = setup?.type === 'ObjectMethod' ? setup : setup?.value
      if (fn?.body?.type === 'BlockStatement') scope = fn.body.body
      // setup(props) may rename the props parameter.
      if (fn?.params?.[0]?.type === 'Identifier') info.propsVar = fn.params[0].name
    }
  }

  const keysOf = node => {
    if (!node) return []
    if (node.type === 'ArrayExpression') return node.elements.map(e => e?.value).filter(Boolean)
    if (node.type === 'ObjectExpression') return node.properties.map(p => p.key?.name || p.key?.value).filter(Boolean)
    if (node.type === 'TSTypeLiteral') return node.members.map(m => m.key?.name).filter(Boolean)
    return []
  }

  // local name -> imported name, for every named import in the block.
  const importAliases = {}
  for (const stmt of ast.program.body) {
    if (stmt.type !== 'ImportDeclaration') continue
    for (const s of stmt.specifiers) if (s.imported) importAliases[s.local.name] = s.imported.name ?? s.imported.value
  }

  if (options) {
    info.props = keysOf(options.props?.value)
    info.emits = keysOf(options.emits?.value).length
    keysOf(options.components?.value).forEach(n => info.registered.add(n))
    // Plain Options API: methods are functions, computed entries are computed.
    for (const m of options.methods?.value?.properties || []) {
      const fn = m.type === 'ObjectMethod' ? m : m.value
      if (fn?.body) info.functions.push(fnInfo(m.key.name, fn, abs(m)))
    }
    info.computed += keysOf(options.computed?.value).length
    info.watchers += keysOf(options.watch?.value).length
  }

  function fnInfo(name, fn, line) {
    const text = functionText(fn, code)
    // A loop only matters per render if it walks component data (`this.x`, `x.value`, or
    // the props object); a loop over the characters of one argument string is cheap.
    const dataRef = info.propsVar ? new RegExp(`\\bthis\\.|\\.value\\b|\\b${info.propsVar}\\.`) : /\bthis\.|\.value\b/
    const expensive = LOOP_RE.test(text) && dataRef.test(text)
    // `const formatCurrency = v => formatCurrencyUtil(v, ...)` wraps the shared helper
    // under an import alias; that is reuse, not shadowing.
    const wrapsShared = Object.entries(importAliases).some(([local, imported]) =>
      imported === name && local !== name && new RegExp(`\\b${local}\\s*\\(`).test(text))
    return { name, line, expensive, wrapsShared, bodyHash: hash(text), size: text.length }
  }

  const calleeName = c => c?.type === 'Identifier' ? c.name : null
  for (const stmt of scope || []) {
    if (stmt.type === 'ImportDeclaration' && isSetup) {
      stmt.specifiers.forEach(s => info.registered.add(s.local.name))
    }
    // <script setup> exposes every top-level binding to the template, so a component can
    // also come from `const Chart = defineAsyncComponent(...)` or similar.
    if (isSetup && stmt.type === 'VariableDeclaration') {
      stmt.declarations.forEach(d => d.id?.type === 'Identifier' && info.registered.add(d.id.name))
    }
    if (isSetup && stmt.type === 'FunctionDeclaration' && stmt.id) info.registered.add(stmt.id.name)
    if (stmt.type === 'FunctionDeclaration' && stmt.id) info.functions.push(fnInfo(stmt.id.name, stmt, abs(stmt)))
    if (stmt.type === 'ReturnStatement' && stmt.argument?.type === 'ObjectExpression') {
      // Quoted keys (`return { 'a-b': x }`) have a string `value` rather than a `name`.
      info.returned = stmt.argument.properties.filter(p => p.key)
        .map(p => ({ name: p.key.name ?? p.key.value, line: abs(p) }))
        .filter(r => typeof r.name === 'string' && r.name)
    }
    const decls = stmt.type === 'VariableDeclaration' ? stmt.declarations
      : stmt.type === 'ExpressionStatement' ? [{ init: stmt.expression }] : []
    for (const d of decls) {
      const init = d.init
      if (!init) continue
      const name = d.id?.type === 'Identifier' ? d.id.name : null
      if (/FunctionExpression|ArrowFunctionExpression/.test(init.type) && name) info.functions.push(fnInfo(name, init, abs(d)))
      if (init.type !== 'CallExpression') continue
      const callee = calleeName(init.callee)
      if (callee === 'computed') info.computed++
      else if (['ref', 'reactive', 'shallowRef', 'shallowReactive'].includes(callee)) info.state++
      else if (['watch', 'watchEffect', 'watchPostEffect'].includes(callee)) info.watchers++
      else if (callee === 'defineProps' || callee === 'withDefaults') {
        const call = callee === 'withDefaults' ? init.arguments[0] : init
        info.props = keysOf(call.arguments?.[0] || call.typeParameters?.params?.[0])
        if (name) info.propsVar = name
      } else if (callee === 'defineEmits') {
        info.emits = keysOf(init.arguments[0] || init.typeParameters?.params?.[0]).length
      }
    }
  }

  // Whole-script walk for patterns that can appear at any depth.
  const counts = { addEventListener: [], removeEventListener: 0, setInterval: [], clearInterval: 0, console: [] }
  const rootName = n => { while (n?.type === 'MemberExpression') n = n.object; return n?.type === 'Identifier' ? n.name : null }
  const MUTATORS = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'])
  // rootName() returns null for `this.x`, so without a props binding the comparisons
  // below must not run at all (null === null would flag every non-identifier root).
  const isPropsRoot = n => info.propsVar !== null && rootName(n) === info.propsVar
  sfc.walk(ast, {
    enter(node) {
      // Writing through the props object (or calling a mutating array method on a prop)
      // bypasses one-way data flow; Vue only warns for top-level prop assignment.
      if ((node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression' && isPropsRoot(node.left)) ||
          (node.type === 'UpdateExpression' && node.argument.type === 'MemberExpression' && isPropsRoot(node.argument))) {
        add('script/prop-mutation', 'high', file, abs(node), `Mutates a prop through \`${info.propsVar}\`. Emit an event or copy into local state.`)
      }
      if (node.type !== 'CallExpression') return
      const c = node.callee
      const prop = c.type === 'MemberExpression' ? c.property.name : null
      const name = calleeName(c) || prop
      if (prop && MUTATORS.has(prop) && c.object.type === 'MemberExpression' && isPropsRoot(c.object)) {
        add('script/prop-mutation', 'high', file, abs(node), `Calls .${prop}() on a prop array, mutating parent state.`)
      }
      if (name === 'addEventListener' || name === 'setInterval') counts[name].push(abs(node))
      if (name === 'removeEventListener' || name === 'clearInterval') counts[name]++
      if (c.type === 'MemberExpression' && c.object.name === 'console' && ['log', 'debug', 'info'].includes(prop)) counts.console.push(abs(node))
      if (['watch'].includes(calleeName(c))) {
        const opts = node.arguments.find(a => a.type === 'ObjectExpression')
        if (opts?.properties.some(p => p.key?.name === 'deep' && p.value?.value === true)) {
          add('script/deep-watch', 'low', file, abs(node), 'Deep watcher traverses the whole object on every change. Watch a getter for the fields you need.')
        }
      }
    }
  })
  if (counts.addEventListener.length > counts.removeEventListener) {
    add('script/listener-leak', 'medium', file, counts.addEventListener[0],
      `${counts.addEventListener.length} addEventListener vs ${counts.removeEventListener} removeEventListener. Remove listeners in onUnmounted.`)
  }
  if (counts.setInterval.length > counts.clearInterval) {
    add('script/listener-leak', 'medium', file, counts.setInterval[0], 'setInterval without a matching clearInterval. Clear it in onUnmounted.')
  }
  if (counts.console.length) {
    add('script/console-log', 'low', file, counts.console[0], `${counts.console.length} console.log/debug/info call(s) left in the component.`, { lines: counts.console })
  }
  return info
}

// ---------- Template analysis ----------

const templateBlocks = [] // {sig, size, file, line, endLine} for cross-file duplicate detection

function analyzeTemplate(descriptor, file, script) {
  const t = descriptor.template
  const info = { lines: t ? lineCount(t.content) : 0, elements: 0, maxDepth: 0, componentTags: new Set() }
  if (!t?.ast) return info
  const localFns = new Map(script.functions.map(f => [f.name, f]))
  const propSet = new Set(script.props)
  const calls = new Map() // fn name -> {lines, inLoop, noArgs}
  const templateText = t.content

  // Records calls to the component's own functions and inline collection ops in one
  // template expression. `loopDepth` > 0 means the expression runs once per list item.
  function scanExpr(exp, line, loopDepth) {
    if (!exp) return
    const clean = stripStrings(exp)
    // A bare identifier followed by "(" that isn't a member access (item.foo()).
    for (const m of clean.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\s*\((\s*\))?/g)) {
      if (!localFns.has(m[1])) continue
      const rec = calls.get(m[1]) || { lines: [], inLoop: false, noArgs: false }
      rec.lines.push(line)
      rec.inLoop ||= loopDepth > 0
      rec.noArgs ||= Boolean(m[2])
      calls.set(m[1], rec)
    }
    for (const m of clean.matchAll(INLINE_OP_RE)) {
      add('template/inline-collection-op', loopDepth > 0 ? 'high' : 'medium', file, line,
        `Inline .${m[1]}() in the template${loopDepth > 0 ? ' inside v-for' : ''} re-runs on every render. Move it into a computed.`,
        { expression: exp.trim().slice(0, 120) })
    }
  }

  function walk(node, depth, loopDepth) {
    if (node.type === 5) return scanExpr(node.content?.content, node.loc.start.line, loopDepth) // {{ interpolation }}
    if (node.type !== 1) return (node.children || []).forEach(c => walk(c, depth, loopDepth))
    info.elements++
    info.maxDepth = Math.max(info.maxDepth, depth)
    if (node.tagType === 1) info.componentTags.add(node.tag) // tagType 1 = component
    const line = node.loc.start.line
    const dirs = node.props.filter(p => p.type === 7)
    const vfor = dirs.find(p => p.name === 'for')
    const vif = dirs.find(p => p.name === 'if')
    const key = node.props.find(p => (p.type === 7 && p.name === 'bind' && p.arg?.content === 'key') || (p.type === 6 && p.name === 'key'))
    const innerLoop = loopDepth + (vfor ? 1 : 0)

    if (vfor) {
      let fr = vfor.forParseResult
      // forParseResult only exists from Vue 3.4; on older versions parse the raw
      // `(item, key, index) in source` expression ourselves.
      if (!fr) {
        const m = /^\s*\(?([\s\S]*?)\)?\s+(?:in|of)\s+([\s\S]+)$/.exec(vfor.exp?.content || '')
        const [value, k, index] = m ? splitTopLevel(m[1]) : []
        const wrap = s => (s ? { content: s } : undefined)
        fr = { source: wrap(m?.[2]?.trim()), value: wrap(value), key: wrap(k), index: wrap(index) }
      }
      const source = fr.source?.content || ''
      // Positional aliases: (item, i) or (value, key, index).
      const aliases = [fr.key?.content, fr.index?.content].filter(Boolean)
      const isRange = /^\s*\d+\s*$/.test(source)
      // A <template v-for> may put the key on its children instead (allowed in Vue 3).
      const elementChildren = (node.children || []).filter(c => c.type === 1)
      const childrenKeyed = node.tag === 'template' && elementChildren.length > 0 && elementChildren.every(c =>
        c.props.some(p => (p.type === 7 && p.name === 'bind' && p.arg?.content === 'key') || (p.type === 6 && p.name === 'key')))
      if (!key && !childrenKeyed) {
        add('vfor/missing-key', 'high', file, line, `v-for over \`${source}\` on <${node.tag}> has no :key.`)
      } else if (key?.type === 7 && aliases.length && !isRange) {
        // Index key if nothing but the alias remains once strings and the alias are removed
        // (catches :key="i", :key="'row-' + i", :key="`row-${i}`", but not `${item.id}-${i}`).
        const keyExpr = templateExprs(key.exp?.content || '')
        const rest = stripStrings(keyExpr).replace(new RegExp(`\\b(${aliases.join('|')})\\b`, 'g'), '').replace(/[\s+"]/g, '')
        const usesAlias = aliases.some(a => new RegExp(`\\b${a}\\b`).test(key.exp?.content || ''))
        if (usesAlias && rest === '') {
          add('vfor/index-key', 'medium', file, key.loc.start.line,
            `:key="${key.exp.content}" uses the position alias. Use a stable id (fine only if \`${source}\` is an object, where the 2nd alias is its property key).`)
        }
      }
      if (/(?<![\w$.])[A-Za-z_$][\w$]*\s*\(/.test(stripStrings(source)) || INLINE_OP_RE.test(stripStrings(source))) {
        INLINE_OP_RE.lastIndex = 0
        add('vfor/call-source', 'medium', file, line, `v-for source \`${source}\` is computed during render. Use a computed property.`)
      }
      if (vif) {
        // In Vue 3 v-if is evaluated before v-for, so it can't see the loop variable.
        const alias = fr.value?.content
        const refsAlias = alias && new RegExp(`\\b${alias.replace(/[{}[\]\s]/g, '').split(',')[0]}\\b`).test(vif.exp?.content || '')
        add('vfor/with-vif', refsAlias ? 'high' : 'medium', file, line,
          refsAlias ? 'v-if on the same element as v-for references the loop item; in Vue 3 v-if runs first, so this is a bug. Filter in a computed.'
            : 'v-if and v-for on the same element. Move v-if to a wrapper <template> or filter in a computed.')
      }
      scanExpr(source, line, loopDepth)
    }

    for (const d of dirs) {
      if (d.name === 'for' || d.name === 'on' || d.name === 'slot') continue // handlers run on events, not renders
      if (d.name === 'model' && propSet.has(d.exp?.content?.trim())) {
        add('script/prop-mutation', 'high', file, d.loc.start.line, `v-model="${d.exp.content}" writes to a prop. Use a local copy or a computed get/set that emits.`)
      }
      scanExpr(d.exp?.content, d.loc.start.line, innerLoop)
    }
    const children = node.children || []
    children.forEach(c => walk(c, depth + 1, innerLoop))

    // Structural signature for duplicate detection: tag, static classes and directive
    // names, recursively. Text and bound values are ignored on purpose so two blocks
    // that differ only in labels or data still match.
    const cls = node.props.find(p => p.type === 6 && p.name === 'class')?.value?.content.split(/\s+/).sort().join('.') || ''
    const childSigs = children.filter(c => c.type === 1).map(c => c._sig)
    node._size = 1 + children.filter(c => c.type === 1).reduce((n, c) => n + c._size, 0)
    node._sig = `${node.tag}.${cls}|${dirs.map(d => d.name).sort().join(',')}[${childSigs.join(';')}]`
    if (node._size >= MIN_BLOCK) {
      templateBlocks.push({ sig: hash(node._sig), size: node._size, file, line, endLine: node.loc.end.line, tag: node.tag })
    }
  }
  t.ast.children.forEach(c => walk(c, 1, 0))

  for (const [name, rec] of calls) {
    const fn = localFns.get(name)
    // Severity: per-item loops in render are the expensive case; a no-arg call is
    // always replaceable by a computed; cheap formatters with args are fine.
    let severity = null
    if (fn.expensive && rec.inLoop) severity = 'high'
    else if (fn.expensive || rec.noArgs) severity = rec.noArgs && !fn.expensive ? 'low' : 'medium'
    if (!severity) continue
    add('template/method-call', severity, file, rec.lines[0],
      `${name}() is called ${rec.lines.length}x from the template${rec.inLoop ? ' (inside v-for)' : ''}` +
      `${fn.expensive ? ' and loops over data' : ''}. ${rec.noArgs ? 'Make it a computed.' : 'Precompute per-item values in a computed.'}`,
      { fnLine: fn.line, lines: rec.lines })
  }

  // Unused setup() return keys are dead code or leftover reactivity exposed to the template.
  for (const r of script.returned) {
    if (!new RegExp(`(?<![\\w$.])${r.name.replace(/\$/g, '\\$')}(?![\\w$])`).test(templateText)) {
      add('script/unused-return', 'low', file, r.line, `\`${r.name}\` is returned from setup() but not used in the template.`)
    }
  }
  return info
}

// ---------- Style analysis ----------

const styleRules = [] // {file, line, selector, declHash, declCount}

function collectStyles(file, content, block) {
  const css = content.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')) // keep offsets stable
  // Flat rule match: selector text between braces. Rules inside @media still match,
  // because the selector part can't contain "{".
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim().replace(/\s+/g, ' ')
    if (!selector || selector.startsWith('@')) continue
    const decls = m[2].split(';').map(d => d.trim().replace(/\s*:\s*/, ':').toLowerCase()).filter(Boolean).sort()
    const offset = m.index + m[1].length - m[1].trimStart().length
    const line = block ? lineAt(block, offset) : (css.slice(0, offset).match(/\n/g) || []).length + 1
    styleRules.push({ file, line, selector, declHash: hash(decls.join(';')), declCount: decls.length })
  }
}

// ---------- Run ----------

const components = []
const allFunctions = [] // {file, ...fnInfo}

for (const f of vueFiles) {
  const file = rel(f)
  const src = fs.readFileSync(f, 'utf8')
  const { descriptor, errors } = sfc.parse(src, { filename: file })
  if (errors.length) add('parse-error', 'low', file, errors[0].loc?.start.line || 1, `SFC parse error: ${errors[0].message}`)
  const script = analyzeScript(descriptor, file)
  const template = analyzeTemplate(descriptor, file, script)
  descriptor.styles.forEach(s => collectStyles(file, s.content, s))
  script.functions.forEach(fn => allFunctions.push({ file, ...fn }))

  const styleLines = descriptor.styles.reduce((n, s) => n + lineCount(s.content), 0)
  const total = lineCount(src)
  components.push({
    file, lines: total,
    template: { lines: template.lines, elements: template.elements, maxDepth: template.maxDepth },
    script: { api: script.api, lines: script.lines, props: script.props.length, emits: script.emits,
      state: script.state, computed: script.computed, functions: script.functions.length, watchers: script.watchers },
    styles: { lines: styleLines, scoped: descriptor.styles.some(s => s.scoped), blocks: descriptor.styles.length },
  })

  // Size thresholds follow common Vue guidance (extract above ~100-line templates / 150-line logic);
  // the higher numbers here keep the report focused on the components that matter most.
  if (total > 800) add('size/large-component', 'high', file, 1, `${total} lines. Split into child components and composables.`)
  else if (total > 400) add('size/large-component', 'medium', file, 1, `${total} lines. Consider splitting.`)
  if (template.lines > 250) add('size/large-template', 'medium', file, descriptor.template.loc.start.line, `Template is ${template.lines} lines (${template.elements} elements, depth ${template.maxDepth}). Extract sections into components.`)
  if (script.lines > 300) add('size/large-script', 'medium', file, (descriptor.scriptSetup || descriptor.script).loc.start.line, `Script is ${script.lines} lines with ${script.functions.length} functions. Move reusable logic into composables.`)

  if (!autoImport && !isNuxt) {
    const registered = new Set([...script.registered].map(normTag))
    // A component may render itself recursively by its filename.
    registered.add(normTag(path.basename(f, '.vue')))
    for (const tag of template.componentTags) {
      const n = normTag(tag)
      if (tag.includes('.') || BUILTIN_COMPONENTS.has(n) || globalComponents.has(n) || registered.has(n)) continue
      const line = src.split('\n').findIndex(l => new RegExp(`<${tag}[\\s/>]|<${tag}$`).test(l)) + 1
      add('template/unresolved-component', 'high', file, line || 1, `<${tag}> is used but not imported or registered; it renders nothing.`)
    }
    // Only check the components option / .vue imports, so plain helper imports aren't flagged.
    const used = new Set([...template.componentTags].map(normTag))
    const optionNames = descriptor.script && !descriptor.scriptSetup ? [...script.registered] : []
    const vueImports = descriptor.scriptSetup
      ? [...descriptor.scriptSetup.content.matchAll(/import\s+(\w+)\s+from\s+['"][^'"]+\.vue['"]/g)].map(m => m[1]) : []
    for (const name of [...optionNames, ...vueImports]) {
      const block = descriptor.scriptSetup || descriptor.script
      const refs = (block.content.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length
      // `<component :is="Foo">` references the component only as an expression.
      const inTemplate = new RegExp(`\\b${name}\\b`).test(descriptor.template?.content || '')
      if (!used.has(normTag(name)) && !inTemplate && (optionNames.length || refs < 2)) {
        add('script/unused-component', 'low', file, block.loc.start.line, `Component ${name} is registered/imported but not used in the template.`)
      }
    }
  }
}

for (const f of files.filter(f => f.endsWith('.css'))) collectStyles(rel(f), fs.readFileSync(f, 'utf8'))

// ---------- Cross-file reuse ----------

// Same function body in 2+ places, or a component re-implementing a shared helper.
const byBody = groupBy(allFunctions.filter(f => f.size >= 60), f => f.bodyHash)
for (const [h, group] of byBody) {
  const shared = sharedBodies.get(h)
  if (shared) {
    for (const fn of group) add('reuse/shadows-shared-helper', 'medium', fn.file, fn.line, `${fn.name}() has the same body as ${shared.name}() in ${shared.file}. Import it instead.`)
  } else if (group.length > 1) {
    const where = group.map(g => `${g.file}:${g.line} ${g.name}()`).join(', ')
    add('reuse/duplicate-function', 'medium', group[0].file, group[0].line, `Identical function in ${group.length} places: ${where}. Extract to a shared util or composable.`, { occurrences: group.map(({ file, line, name }) => ({ file, line, name })) })
  }
}
for (const fn of allFunctions) {
  if (sharedHelpers[fn.name] && !sharedBodies.has(fn.bodyHash) && !fn.wrapsShared) {
    add('reuse/shadows-shared-helper', 'medium', fn.file, fn.line, `Local ${fn.name}() shadows the shared ${fn.name} exported from ${sharedHelpers[fn.name][0]}. Reuse it or rename if it really differs.`)
  }
}
const byName = groupBy(allFunctions.filter(f => !PER_COMPONENT_NAME_RE.test(f.name) && !sharedHelpers[f.name]), f => f.name)
for (const [name, group] of byName) {
  const filesWith = new Set(group.map(g => g.file))
  const bodies = new Set(group.map(g => g.bodyHash))
  if (filesWith.size > 1 && bodies.size > 1) {
    add('reuse/repeated-helper-name', 'low', group[0].file, group[0].line,
      `${name}() is defined separately in ${filesWith.size} components with ${bodies.size} different bodies (${group.map(g => `${g.file}:${g.line}`).join(', ')}). Candidate for one shared helper.`,
      { occurrences: group.map(({ file, line }) => ({ file, line })) })
  }
}

// Duplicate template blocks: report only the largest matching subtree, so a duplicated
// table doesn't also produce findings for every duplicated row inside it.
const covered = []
const isCovered = b => covered.some(c => c.file === b.file && b.line >= c.line && b.endLine <= c.endLine)
const blockGroups = [...groupBy(templateBlocks, b => b.sig).values()].filter(g => g.length > 1).sort((a, b) => b[0].size - a[0].size)
for (const group of blockGroups) {
  const fresh = group.filter(b => !isCovered(b))
  if (fresh.length < 2) continue
  fresh.forEach(b => covered.push(b))
  const crossFile = new Set(fresh.map(b => b.file)).size > 1
  add('reuse/duplicate-template-block', crossFile ? 'medium' : 'low', fresh[0].file, fresh[0].line,
    `<${fresh[0].tag}> block of ${fresh[0].size} elements repeated ${fresh.length}x: ${fresh.map(b => `${b.file}:${b.line}-${b.endLine}`).join(', ')}. Extract a component (or a v-for over data).`,
    { occurrences: fresh.map(({ file, line, endLine }) => ({ file, line, endLine })) })
}

// Duplicate CSS: identical declaration bodies across files, and the same simple class
// selector redefined in several files (drift from a global style).
for (const group of groupBy(styleRules.filter(r => r.declCount >= MIN_DECLS), r => r.declHash).values()) {
  if (new Set(group.map(r => r.file)).size < 2) continue
  add('reuse/duplicate-style-block', 'low', group[0].file, group[0].line,
    `Same ${group[0].declCount}-declaration rule body in ${group.length} places: ${group.map(r => `${r.file}:${r.line} ${r.selector}`).join(', ')}. Move to a shared class.`,
    { occurrences: group.map(({ file, line, selector }) => ({ file, line, selector })) })
}
for (const [sel, group] of groupBy(styleRules.filter(r => /^\.[\w-]+$/.test(r.selector)), r => r.selector)) {
  const filesWith = [...new Set(group.map(r => r.file))]
  if (filesWith.length < 3) continue // two definitions is often a deliberate override
  add('reuse/selector-redefined', 'low', group[0].file, group[0].line,
    `${sel} is defined in ${filesWith.length} files (${filesWith.join(', ')}). Keep one canonical definition.`)
}

// ---------- Output ----------

const ORDER = { high: 0, medium: 1, low: 2 }
findings.sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.rule.localeCompare(b.rule) || a.file.localeCompare(b.file) || a.line - b.line)
components.sort((a, b) => b.lines - a.lines)

const result = {
  tool: 'vue-component-analyzer', vueVersion: sfc.version || null, srcDir,
  totals: { components: components.length, lines: components.reduce((n, c) => n + c.lines, 0),
    findings: Object.fromEntries(Object.keys(ORDER).map(s => [s, findings.filter(f => f.severity === s).length])) },
  sharedHelpers, components, findings, notes,
}

if (flags.json) {
  console.log(JSON.stringify(result, null, 2))
} else {
  const out = []
  out.push(`Vue component analysis: ${srcDir} (vue ${result.vueVersion ?? '?'})`)
  out.push(`${result.totals.components} components, ${result.totals.lines} lines. Findings: ` +
    Object.entries(result.totals.findings).map(([k, v]) => `${v} ${k}`).join(', '))
  out.push('', 'COMPONENTS (lines | tpl lines/elements/depth | api script lines | props emits | state computed fns watchers | style lines)')
  for (const c of components) {
    out.push(`  ${c.file.padEnd(42)} ${String(c.lines).padStart(5)} | ${c.template.lines}/${c.template.elements}/${c.template.maxDepth} | ` +
      `${c.script.api} ${c.script.lines} | ${c.script.props}p ${c.script.emits}e | ${c.script.state}s ${c.script.computed}c ${c.script.functions}f ${c.script.watchers}w | ${c.styles.lines}`)
  }
  out.push('', 'SHARED HELPERS: ' + (Object.keys(sharedHelpers).join(', ') || '(none found)'))
  out.push('', 'FINDINGS')
  for (const f of findings) out.push(`  [${f.severity.toUpperCase()}] ${f.rule}  ${f.file}:${f.line}  ${f.message}`)
  if (notes.length) out.push('', 'NOTES', ...notes.map(n => '  ' + n))
  console.log(out.join('\n'))
}
