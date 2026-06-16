#!/usr/bin/env node
/**
 * Batch-translate n8n UI locale JSON using Google Gemini (run locally).
 *
 * Usage:
 *   export GEMINI_API_KEY="your-key"
 *   node scripts/translate-locale-gemini.mjs
 *   node scripts/translate-locale-gemini.mjs --locale ko --batch-size 40
 *   node scripts/translate-locale-gemini.mjs --dry-run
 *
 * Get a key: https://aistudio.google.com/apikey
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const LOCALES_DIR = resolve(REPO_ROOT, 'packages/frontend/@n8n/i18n/src/locales');

const DEFAULT_LOCALE = 'ko';
const DEFAULT_SOURCE = 'en';
const DEFAULT_MODEL = 'gemini-2.0-flash';
const DEFAULT_BATCH_SIZE = 35;
const DEFAULT_DELAY_MS = 1500;
const DEFAULT_MAX_RETRIES = 6;

function parseArgs(argv) {
	const args = {
		locale: DEFAULT_LOCALE,
		source: DEFAULT_SOURCE,
		model: process.env.GEMINI_MODEL ?? DEFAULT_MODEL,
		batchSize: DEFAULT_BATCH_SIZE,
		delayMs: DEFAULT_DELAY_MS,
		maxRetries: DEFAULT_MAX_RETRIES,
		dryRun: false,
		maxBatches: Infinity,
	};
	for (let i = 2; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--dry-run') args.dryRun = true;
		else if (a === '--locale') args.locale = argv[++i];
		else if (a === '--source') args.source = argv[++i];
		else if (a === '--batch-size') args.batchSize = Number(argv[++i]);
		else if (a === '--delay-ms') args.delayMs = Number(argv[++i]);
		else if (a === '--max-retries') args.maxRetries = Number(argv[++i]);
		else if (a === '--max-batches') args.maxBatches = Number(argv[++i]);
		else if (a === '--help' || a === '-h') {
			console.log(`Usage: GEMINI_API_KEY=... node scripts/translate-locale-gemini.mjs [options]
  --locale ko       Target locale file (default: ko)
  --source en       Source locale file (default: en)
  --batch-size 35   Leaf strings per API call
  --max-retries 6   Retry transient API/network failures
  --max-batches N   Stop after N batches (for testing)
  --dry-run         List pending keys only`);
			process.exit(0);
		}
	}
	return args;
}

function isLeafString(value) {
	return typeof value === 'string';
}

function collectLeaves(obj, prefix = '', out = []) {
	if (isLeafString(obj)) {
		out.push({ path: prefix, value: obj });
		return out;
	}
	if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
		for (const [key, child] of Object.entries(obj)) {
			const next = prefix ? `${prefix}.${key}` : key;
			collectLeaves(child, next, out);
		}
	}
	return out;
}

function getAtPath(obj, path) {
	return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

function setAtPath(obj, path, value) {
	const keys = path.split('.');
	let cur = obj;
	for (let i = 0; i < keys.length - 1; i++) {
		const key = keys[i];
		if (cur[key] === undefined || typeof cur[key] !== 'object' || Array.isArray(cur[key])) {
			cur[key] = {};
		}
		cur = cur[key];
	}
	cur[keys[keys.length - 1]] = value;
}

/** Gemini sometimes returns nested JSON instead of flat dot-path keys. */
function flattenTranslationResponse(input) {
	if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
	const out = {};
	for (const [key, value] of Object.entries(input)) {
		if (typeof value === 'string') {
			out[key] = value;
		} else if (value && typeof value === 'object') {
			for (const [nestedKey, nestedValue] of Object.entries(flattenTranslationResponse(value))) {
				out[nestedKey.includes('.') ? nestedKey : `${key}.${nestedKey}`] = nestedValue;
			}
		}
	}
	return out;
}

function hasHangul(text) {
	return /[\uAC00-\uD7A3]/.test(text);
}

function needsTranslation(sourceValue, targetValue) {
	if (targetValue === undefined || targetValue === '') return true;
	if (targetValue === sourceValue) return true;
	if (!hasHangul(targetValue) && hasHangul(sourceValue) === false) {
		// Still English (or same as source) — translate
		return targetValue === sourceValue || !hasHangul(targetValue);
	}
	return false;
}

async function callGemini({ apiKey, model, payload }) {
	const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
	const body = {
		contents: [
			{
				role: 'user',
				parts: [
					{
						text: `You are a native Korean UX writer localizing a workflow automation web app (n8n / mnetplus).

Translate each English UI string into natural, fluent Korean that sounds like a real product—not a dictionary or machine translation.

Style:
- Short labels: concise (e.g. "Save" → "저장", "Overview" → "개요").
- Sentences: polite but clear 해요체 or 합니다체; prefer "~합니다" for errors/help, "~해요" for friendly hints.
- Use established Korean UI terms: 워크플로, 자격 증명, 실행, 템플릿, 설정.
- Avoid awkward calques (e.g. prefer "워크플로" over "작업 흐름" unless context needs it).

Technical rules:
- Input JSON: keys are dot-paths, values are English. Output ONLY valid JSON with the same keys.
- Preserve exactly: {name}, {{variable}}, %s, HTML tags, URLs, @:_reusable... references.
- Brand: use "mnetplus" only where the string is clearly product branding; keep "n8n" in docs URLs or technical IDs if present.
- Do not add/remove keys or comments.

Input:
${JSON.stringify(payload, null, 2)}`,
					},
				],
			},
		],
		generationConfig: {
			temperature: 0.35,
			responseMimeType: 'application/json',
		},
	};

	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});

	if (!res.ok) {
		const errText = await res.text();
		throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 500)}`);
	}

	const data = await res.json();
	const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
	if (!text) throw new Error('Empty Gemini response');
	return parseTranslationJson(text);
}

function parseTranslationJson(text) {
	const trimmed = text.trim();
	const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
	const candidate = (fenced?.[1] ?? trimmed).trim();

	try {
		return JSON.parse(candidate);
	} catch {
		const start = candidate.indexOf('{');
		const end = candidate.lastIndexOf('}');
		if (start >= 0 && end > start) {
			try {
				return JSON.parse(candidate.slice(start, end + 1));
			} catch (innerError) {
				throw new Error(`Invalid JSON from Gemini: ${innerError.message}`);
			}
		}
		throw new Error('Invalid JSON from Gemini: could not parse response');
	}
}

function sleep(ms) {
	return new Promise((r) => setTimeout(r, ms));
}

function isTransientError(error) {
	const msg = String(error?.message ?? '');
	const name = String(error?.name ?? '');
	return (
		name === 'SyntaxError' ||
		msg.includes('Invalid JSON from Gemini') ||
		msg.includes('Empty Gemini response') ||
		msg.includes('Gemini API 429') ||
		msg.includes('Gemini API 500') ||
		msg.includes('Gemini API 502') ||
		msg.includes('Gemini API 503') ||
		msg.includes('Gemini API 504') ||
		msg.includes('UND_ERR_SOCKET') ||
		msg.includes('fetch failed') ||
		msg.includes('ECONNRESET') ||
		msg.includes('ETIMEDOUT')
	);
}

async function translateBatchWithRetry({ apiKey, model, payload, maxRetries }) {
	let attempt = 0;
	while (true) {
		try {
			return flattenTranslationResponse(await callGemini({ apiKey, model, payload }));
		} catch (error) {
			attempt += 1;
			if (!isTransientError(error) || attempt > maxRetries) throw error;
			const backoffMs = Math.min(20000, 1500 * 2 ** (attempt - 1));
			console.warn(
				`  Transient error (${attempt}/${maxRetries}), retrying in ${backoffMs}ms: ${String(error.message).slice(0, 120)}`,
			);
			await sleep(backoffMs);
		}
	}
}

async function main() {
	const args = parseArgs(process.argv);
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey && !args.dryRun) {
		console.error('Set GEMINI_API_KEY (https://aistudio.google.com/apikey)');
		process.exit(1);
	}

	const sourcePath = resolve(LOCALES_DIR, `${args.source}.json`);
	const targetPath = resolve(LOCALES_DIR, `${args.locale}.json`);
	const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
	let target = JSON.parse(readFileSync(targetPath, 'utf8'));

	const leaves = collectLeaves(source);
	const pending = leaves.filter(({ path, value }) => {
		const current = getAtPath(target, path);
		return needsTranslation(value, current);
	});

	console.log(`Locale: ${args.locale} | pending strings: ${pending.length} / ${leaves.length}`);

	if (args.dryRun) {
		pending.slice(0, 20).forEach(({ path, value }) => console.log(`  ${path}: ${value.slice(0, 60)}...`));
		if (pending.length > 20) console.log(`  ... and ${pending.length - 20} more`);
		return;
	}

	const batches = [];
	for (let i = 0; i < pending.length; i += args.batchSize) {
		batches.push(pending.slice(i, i + args.batchSize));
	}

	let done = 0;
	for (let b = 0; b < Math.min(batches.length, args.maxBatches); b++) {
		const batch = batches[b];
		const payload = Object.fromEntries(batch.map(({ path, value }) => [path, value]));
		console.log(`Batch ${b + 1}/${batches.length} (${batch.length} strings)...`);

		const translated = await translateBatchWithRetry({
			apiKey,
			model: args.model,
			payload,
			maxRetries: args.maxRetries,
		});
		for (const [path, koValue] of Object.entries(translated)) {
			if (typeof koValue === 'string') setAtPath(target, path, koValue);
		}

		writeFileSync(targetPath, `${JSON.stringify(target, null, '\t')}\n`, 'utf8');
		done += batch.length;
		console.log(`  Saved ${targetPath} (${done} updated so far)`);

		if (b < batches.length - 1) await sleep(args.delayMs);
	}

	console.log('Done. Restart dev servers and hard-refresh the browser.');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
