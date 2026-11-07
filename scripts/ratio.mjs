#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RULES_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../rules.json");

const USAGE = `color-631 — 6:3:1 配色配比换算

用法:
  node ratio.mjs                  输出三类颜色占比
  node ratio.mjs --total <N>      按总量 N 换算三类份数
  node ratio.mjs --json           输出结构化结果（含待确认项）
  node ratio.mjs --check          运行自测

不提供选色、色值或搭配建议。`;

function parseArgs(argv) {
  const opts = { total: 100, json: false, check: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") opts.json = true;
    else if (arg === "--check") opts.check = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg === "--total") {
      const raw = argv[++i];
      if (raw === undefined) throw new Error("--total 需要一个数值");
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) throw new Error(`--total 必须是正数，收到: ${raw}`);
      opts.total = n;
    } else {
      throw new Error(`未知参数: ${arg}`);
    }
  }
  return opts;
}

function round(n) {
  return Number(n.toFixed(4));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(USAGE);
    return;
  }

  const rules = JSON.parse(await readFile(RULES_PATH, "utf8"));
  const roles = rules.coreIdea.roles;

  if (opts.check) {
    const scaleOk = [100, 1000, 7, 1].every((t) =>
      round(roles.reduce((s, r) => s + round((t * r.percent) / 100), 0)) === t,
    );
    const checks = {
      ratioOk: roles.map((r) => r.parts).join(":") === "6:3:1",
      percentOk: roles.map((r) => r.percent).join(":") === "60:30:10",
      sumPercentOk: roles.reduce((s, r) => s + r.percent, 0) === 100,
      sumPartsOk: roles.reduce((s, r) => s + r.parts, 0) === 10,
      pendingKept:
        rules.inspiration.status === "pending" &&
        rules.applicableScenarios.status === "pending" &&
        rules.usage.pending.length > 0,
      scaleOk,
    };
    const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
    if (failed.length) {
      console.error(`FAIL: ${failed.join(", ")}`);
      process.exitCode = 1;
      return;
    }
    console.log("PASS: 6 项自检全部通过");
    return;
  }

  const result = {
    skill: rules.name,
    ratio: rules.coreIdea.ratio,
    total: opts.total,
    roles: roles.map((r) => ({
      name: r.name,
      percent: r.percent,
      parts: r.parts,
      amount: round((opts.total * r.percent) / 100),
    })),
    pending: {
      inspiration: rules.inspiration.status === "pending" ? rules.inspiration.note : null,
      applicableScenarios: rules.applicableScenarios.status === "pending" ? rules.applicableScenarios.note : null,
      usage: rules.usage.pending,
    },
  };

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`${rules.displayName} — ${rules.coreIdea.ratio}`);
  for (const r of result.roles) {
    console.log(`  ${r.name}\t${r.percent}%\t${r.amount} / ${opts.total}`);
  }
  console.log("待确认：灵感来源、适用场景、选色与执行步骤（见 rules.json）");
}

main().catch((err) => {
  console.error(`ERROR: ${err.message}`);
  process.exitCode = 1;
});
