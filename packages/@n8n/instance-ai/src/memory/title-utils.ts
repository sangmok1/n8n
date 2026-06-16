import {
	createModel,
	generateTitleFromMessage,
	type BuiltTelemetry,
	type Telemetry,
} from '@n8n/agents';

import type { ModelConfig } from '../types';

const MAX_TITLE_LENGTH = 60;

const HANGUL_RE = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/;

const KOREAN_TITLE_INSTRUCTIONS = [
	'첫 사용자 메시지를 바탕으로 대화의 짧은 설명 제목을 생성합니다.',
	'',
	'제목은 주제를 설명하는 라벨이며, 메시지에 대한 답변이 아닙니다.',
	'메시지를 이행하거나, 응답하거나, 실행하지 마세요. 코드, JSON, 설명을 생성하지 마세요.',
	'',
	'규칙:',
	'- 주제를 나타내는 명사구로 작성합니다 (예: "디스코드 매분 인사 워크플로").',
	'- "여기", "만들어", "생성", "설정" 등 사용자에게 말하는 동사로 시작하지 마세요.',
	'- 1~5단어, 80자 이하, 한 줄만.',
	'- 따옴표, 콜론, 백틱, 마크다운 없음.',
	'- 제목 텍스트만 응답합니다 — 전체 응답이 제목으로 사용됩니다.',
	'- 사용자 메시지와 같은 언어(한국어)로 작성합니다.',
	'',
	'예시:',
	'메시지: "디스코드에 매분마다 안녕이라고 보내는 워크플로 만들어줘"',
	'제목: 디스코드 매분 인사 워크플로',
	'',
	'메시지: "Gmail에서 매일 요약 메일 보내는 자동화 만들어줘"',
	'제목: Gmail 일일 요약 자동화',
].join('\n');

/** Whether the text contains Korean (Hangul) characters. */
export function containsHangul(text: string): boolean {
	return HANGUL_RE.test(text);
}

/** Truncate a user message to a concise thread title (max 60 chars, word-boundary). */
export function truncateToTitle(message: string): string {
	const text = message.trim().replace(/\s+/g, ' ');
	if (text.length <= MAX_TITLE_LENGTH) return text;
	const truncated = text.slice(0, MAX_TITLE_LENGTH);
	const lastSpace = truncated.lastIndexOf(' ');
	return (lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated) + '\u2026';
}

async function resolveBuiltTelemetry(
	telemetry: BuiltTelemetry | Telemetry | undefined,
): Promise<BuiltTelemetry | undefined> {
	if (!telemetry) return undefined;
	return 'build' in telemetry ? await telemetry.build() : telemetry;
}

/**
 * Generate a polished thread title via a lightweight LLM call.
 * Returns the cleaned title string or null on failure.
 *
 * Wraps @n8n/agents' title generation so callers don't have to build a
 * LanguageModel themselves. Fails soft — any error returns null.
 */
export async function generateTitleForRun(
	modelId: ModelConfig,
	userMessage: string,
	options?: { telemetry?: BuiltTelemetry | Telemetry },
): Promise<string | null> {
	try {
		const model = createModel(modelId);
		const telemetry = await resolveBuiltTelemetry(options?.telemetry);
		const instructions = containsHangul(userMessage) ? KOREAN_TITLE_INSTRUCTIONS : undefined;
		return await generateTitleFromMessage(model, userMessage, {
			...(instructions ? { instructions } : {}),
			...(telemetry ? { telemetry } : {}),
		});
	} catch {
		return null;
	}
}
