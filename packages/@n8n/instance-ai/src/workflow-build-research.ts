import { WorkflowTechnique } from './tools/best-practices/techniques';
import type { InstanceAiWorkflowService, WorkflowSummary } from './types';

const INTEGRATION_SEARCH_TERMS: Array<{ label: string; terms: string[] }> = [
	{ label: 'Discord', terms: ['discord', '디스코드'] },
	{ label: 'Google Sheets', terms: ['google sheets', 'google sheet', '구글 시트', '구글시트', 'spreadsheet'] },
	{ label: 'Telegram', terms: ['telegram', '텔레그램'] },
	{ label: 'Slack', terms: ['slack', '슬랙'] },
	{ label: 'Gmail', terms: ['gmail', '이메일', 'email'] },
	{ label: 'Notion', terms: ['notion', '노션'] },
];

const SCHEDULE_PATTERN =
	/매일|매주|매월|매분|매시간|\d+\s*분마다|1분마다|분마다|every\s+(\d+\s+)?(day|morning|evening|hour|minute|week)|cron|스케줄|주기|정기/i;

const SHEETS_WRITE_PATTERN =
	/구글\s*시트|google\s*sheets?|spreadsheet|스프레드시트/i;

const SHEETS_RELAY_PATTERN =
	/시트\s*내용|sheet\s*content|내용을?\s*(보내|전송)|읽어\s*서?\s*보내|가져와\s*서?\s*보내|받아\s*서?\s*보내/i;

function normalise(text: string): string {
	return text.toLowerCase().replace(/\s+/g, ' ');
}

function detectIntegrations(message: string): string[] {
	const text = normalise(message);
	return INTEGRATION_SEARCH_TERMS.filter(({ terms }) =>
		terms.some((term) => text.includes(normalise(term))),
	).map(({ label }) => label);
}

function detectTechniques(message: string): string[] {
	const text = normalise(message);
	const techniques = new Set<string>();

	if (SCHEDULE_PATTERN.test(message)) {
		techniques.add(WorkflowTechnique.SCHEDULING);
	}
	if (SHEETS_WRITE_PATTERN.test(message)) {
		techniques.add(WorkflowTechnique.DATA_PERSISTENCE);
	}
	if (/보내|전송|알림|notify|send|post/i.test(message)) {
		techniques.add(WorkflowTechnique.NOTIFICATION);
	}
	if (/봇|bot|chatbot|챗봇/i.test(message)) {
		techniques.add(WorkflowTechnique.CHATBOT);
	}
	if (/변환|transform|가공/i.test(text)) {
		techniques.add(WorkflowTechnique.DATA_TRANSFORMATION);
	}

	return [...techniques];
}

function detectRequiredSteps(message: string): string[] {
	const steps: string[] = [];

	if (SCHEDULE_PATTERN.test(message)) {
		steps.push('Schedule Trigger (요청한 주기로 실행)');
	}

	if (SHEETS_WRITE_PATTERN.test(message)) {
		steps.push('Google Sheets — 행 추가/값 기록 (append 또는 update)');
	}

	if (SHEETS_WRITE_PATTERN.test(message) && SHEETS_RELAY_PATTERN.test(message)) {
		steps.push('Google Sheets — 시트 데이터 읽기 (read)');
	}

	if (/discord|디스코드/i.test(message)) {
		steps.push('Discord — 메시지 전송');
	} else if (/telegram|텔레그램/i.test(message)) {
		steps.push('Telegram — 메시지 전송');
	} else if (/slack|슬랙/i.test(message)) {
		steps.push('Slack — 메시지 전송');
	}

	return steps;
}

function scoreWorkflow(message: string, workflow: WorkflowSummary): number {
	const text = normalise(message);
	const name = normalise(workflow.name);
	let score = 0;

	for (const { terms } of INTEGRATION_SEARCH_TERMS) {
		for (const term of terms) {
			const normalisedTerm = normalise(term);
			if (text.includes(normalisedTerm) && name.includes(normalisedTerm)) {
				score += 3;
			} else if (text.includes(normalisedTerm) || name.includes(normalisedTerm)) {
				score += 1;
			}
		}
	}

	if (SCHEDULE_PATTERN.test(message) && /schedule|cron|분|minute|매/i.test(name)) {
		score += 2;
	}

	return score;
}

async function searchSimilarWorkflows(
	workflowService: InstanceAiWorkflowService,
	message: string,
): Promise<WorkflowSummary[]> {
	const queries = new Set<string>();

	for (const { terms } of INTEGRATION_SEARCH_TERMS) {
		for (const term of terms) {
			if (normalise(message).includes(normalise(term))) {
				queries.add(term);
			}
		}
	}

	if (queries.size === 0) {
		queries.add(message.slice(0, 40));
	}

	const byId = new Map<string, WorkflowSummary>();

	for (const query of queries) {
		try {
			const results = await workflowService.list({ query, limit: 8 });
			for (const workflow of results) {
				byId.set(workflow.id, workflow);
			}
		} catch {
			// Workflow search is best-effort context for the builder.
		}
	}

	return [...byId.values()]
		.map((workflow) => ({ workflow, score: scoreWorkflow(message, workflow) }))
		.filter(({ score }) => score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, 5)
		.map(({ workflow }) => workflow);
}

async function describeWorkflowNodes(
	workflowService: InstanceAiWorkflowService,
	workflow: WorkflowSummary,
): Promise<string | null> {
	try {
		const detail = await workflowService.get(workflow.id);
		const nodeTypes = [...new Set(detail.nodes.map((node) => node.type))];
		if (nodeTypes.length === 0) return null;
		return nodeTypes.join(', ');
	} catch {
		return null;
	}
}

/** Gather workflow/template research context before invoking the AI builder. */
export async function buildWorkflowResearchContext(
	workflowService: InstanceAiWorkflowService,
	message: string,
): Promise<string> {
	const integrations = detectIntegrations(message);
	const techniques = detectTechniques(message);
	const requiredSteps = detectRequiredSteps(message);
	const similarWorkflows = await searchSimilarWorkflows(workflowService, message);

	const workflowLines: string[] = [];
	for (const workflow of similarWorkflows.slice(0, 3)) {
		const nodeTypes = await describeWorkflowNodes(workflowService, workflow);
		workflowLines.push(
			nodeTypes
				? `- ${workflow.name} (id: ${workflow.id}) — nodes: ${nodeTypes}`
				: `- ${workflow.name} (id: ${workflow.id})`,
		);
	}

	const parts = [
		'<workflow-research>',
		'Build from the user request below. Do NOT skip integrations or merge steps into a simpler 2-node flow.',
		'',
		'## Research steps (do these before writing code)',
		'1. `nodes(action="search")` for each required service (e.g. Google Sheets, Discord, Schedule Trigger).',
		'2. `nodes(action="type-definition")` for the exact resource/operation you will use.',
		'3. `templates(action="best-practices")` for relevant techniques listed below.',
		similarWorkflows.length > 0
			? '4. `workflows(action="get-json", workflowId)` on similar workflows below when you need a proven node chain.'
			: '4. `workflows(action="list")` if you need more examples from this instance.',
		'5. `nodes(action="explore-resources")` to resolve real spreadsheet/channel IDs — never guess resource IDs.',
	];

	if (integrations.length > 0) {
		parts.push('', '## Detected integrations', integrations.map((item) => `- ${item}`).join('\n'));
	}

	if (requiredSteps.length > 0) {
		parts.push(
			'',
			'## Required pipeline (include every step — do not omit Google Sheets or other middle steps)',
			requiredSteps.map((step) => `- ${step}`).join('\n'),
		);
	}

	if (techniques.length > 0) {
		parts.push(
			'',
			'## Suggested template techniques',
			techniques.map((technique) => `- ${technique}`).join('\n'),
		);
	}

	if (workflowLines.length > 0) {
		parts.push('', '## Similar workflows in this instance', workflowLines.join('\n'));
	}

	parts.push('</workflow-research>');

	return parts.join('\n');
}
