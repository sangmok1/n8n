import type { WorkSummary } from './stream/work-summary-accumulator';

const WORKFLOW_DISPATCH_TOOLS = new Set([
	'build-workflow-with-agent',
	'create-tasks',
	'delegate',
]);

const EXCLUDE_PATTERNS = [
	/\b(delete|remove|삭제|지워)\b/i,
	/\b(list|show|describe|explain|목록|보여|설명)\b.*\b(workflow|워크플로)/i,
	/\b(workflow|워크플로).*\b(list|show|describe|explain|목록|보여|설명)\b/i,
	/\bwhat\s+is\b/i,
	/\b어떻게\s+작동\b/i,
];

const EXPLICIT_BUILD_PATTERNS = [
	/워크플로(u)?\s*(를|을)?\s*(만들|생성|구축|짜|작성)/i,
	/걍\s*만(?:들|드)[^\s]{0,2}\s*줘/i,
	/그냥\s*만(?:들|드)[^\s]{0,2}\s*줘/i,
	/대충\s*만(?:들|드)[^\s]{0,2}\s*줘/i,
	/\b만들어\s*(줘|줄래|주세요)\b/i,
	/\b(봇|bot)\b.*\b(만들|생성|구축)\b/i,
	/\b(만들|생성|구축)\b.*\b(봇|bot)\b/i,
	/\bcreate\s+(a\s+)?workflow\b/i,
	/\bbuild\s+(a\s+)?workflow\b/i,
	/\bautomate\b/i,
	/\b자동화\b/i,
];

const SCHEDULE_PATTERNS =
	/매일|매주|매월|매분|매시간|\d+\s*분마다|1분마다|분마다|아침|저녁|every\s+(\d+\s+)?(day|morning|evening|hour|minute|week)|cron|스케줄|주기|정기/i;

const INTEGRATION_PATTERNS =
	/gmail|discord|slack|telegram|notion|google|openai|outlook|이메일|디스코드|슬랙|텔레그램/i;

const ACTION_PATTERNS =
	/보내|읽|추출|요약|전송|알림|수신|send|read|extract|summar|notify|post|fetch|sync/i;

const BOT_ALIAS_BUILD_PATTERNS =
	/(봇|bot).*(만들|생성|구축|짜|작성)|(만들|생성|구축|짜|작성).*(봇|bot)/i;

/** Heuristic: user wants a new workflow built (not list/describe/delete). */
export function isWorkflowBuildRequest(message: string): boolean {
	const text = message.trim();
	if (text.length < 3) return false;

	if (EXCLUDE_PATTERNS.some((pattern) => pattern.test(text))) {
		return false;
	}

	if (EXPLICIT_BUILD_PATTERNS.some((pattern) => pattern.test(text))) {
		return true;
	}

	if (BOT_ALIAS_BUILD_PATTERNS.test(text)) {
		return true;
	}

	const hasSchedule = SCHEDULE_PATTERNS.test(text);
	const hasIntegration = INTEGRATION_PATTERNS.test(text);
	const hasAction = ACTION_PATTERNS.test(text);

	if (hasSchedule && (hasIntegration || hasAction)) {
		return true;
	}

	if (hasIntegration && hasAction) {
		return true;
	}

	if (hasSchedule && hasIntegration && /\b(봇|bot)\b/i.test(text)) {
		return true;
	}

	return false;
}

export function hasDispatchedWorkflowWork(workSummary: WorkSummary): boolean {
	return workSummary.toolCalls.some(
		(call) => call.succeeded && WORKFLOW_DISPATCH_TOOLS.has(call.toolName),
	);
}
