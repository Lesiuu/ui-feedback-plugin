#!/usr/bin/env node
/**
 * PreToolUse hook on end_round: adds the round's diff from git to the call, so the agent never spends tokens
 * writing it and the board gets what git says, not a retelling. Without a git repository or with a bad commit
 * the call goes on as the agent wrote it, minus any diff of its own.
 */
import { execFile } from "node:child_process"

const MAX_DIFF = 256 * 1024
const SHA = /^[0-9a-f]{7,40}$/

/** Cut to `max` bytes on whole files, the same way mcp.js cuts: a file that does not fit keeps its "diff --git" line. */
function cutDiff(text, max = MAX_DIFF) {
  let size = 0
  const out = []
  for (const part of text.split(/(?=^diff --git )/m)) {
    const n = Buffer.byteLength(part)
    if (size + n <= max) {
      out.push(part)
      size += n
      continue
    }
    const head = `${part.split("\n", 1)[0]}\n`
    if (size + Buffer.byteLength(head) > max) break
    out.push(head)
    size += Buffer.byteLength(head)
  }
  return out.join("")
}

function git(cwd, args) {
  const opts = { cwd, maxBuffer: 64 * 1024 * 1024, timeout: 20000, env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } }
  // External diff drivers and textconv run programs from the repository's config and change what the board sees.
  const flags = ["--no-color", "--no-ext-diff", "--no-textconv", "-U3"]
  return new Promise((resolve, reject) => execFile("git", ["--no-pager", "-c", "core.quotePath=false", ...args, ...flags], opts, (err, out) => (err ? reject(err) : resolve(out))))
}

function roundDiff(cwd, { commit, base }) {
  if (commit && base) return git(cwd, ["diff", `${base}..${commit}`])
  if (commit) return git(cwd, ["show", "--format=", commit])
  // No commit: the round's changes are in the working tree, and since base also in any commit left unnamed.
  return git(cwd, ["diff", base ?? "HEAD"])
}

const chunks = []
for await (const chunk of process.stdin) chunks.push(chunk)
let event = {}
try {
  event = JSON.parse(Buffer.concat(chunks).toString("utf8"))
} catch {
  // Not a hook event: the call goes on untouched.
}
const input = event?.tool_input && typeof event.tool_input === "object" ? event.tool_input : {}
const ok = (x) => x === undefined || x === "" || (typeof x === "string" && SHA.test(x.trim().toLowerCase()))
const { diff: written, ...rest } = input
let diff = ""
if (ok(input.commit) && ok(input.base)) {
  const refs = { commit: input.commit?.trim().toLowerCase() || undefined, base: input.base?.trim().toLowerCase() || undefined }
  diff = cutDiff(await roundDiff(event.cwd || process.cwd(), refs).catch(() => ""))
}
if (diff || written !== undefined) {
  const updatedInput = diff ? { ...rest, diff } : rest
  // "allow" because without a decision auto mode reviews the call as the agent wrote it and turns down the
  // changed one, and the agent would then write the diff itself. end_round only reaches the person's own board.
  const out = { hookEventName: "PreToolUse", permissionDecision: "allow", permissionDecisionReason: "UI Feedback added the round's git diff.", updatedInput }
  process.stdout.write(JSON.stringify({ hookSpecificOutput: out }))
}
