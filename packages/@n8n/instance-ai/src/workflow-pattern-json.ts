import { randomUUID } from 'node:crypto';

import { buildAiWorkflowDefaultName } from './ai-workflow-name';

export interface PatternWorkflowJson {
	name: string;
	nodes: Array<{
		id: string;
		name: string;
		type: string;
		typeVersion: number;
		position: [number, number];
		parameters: Record<string, unknown>;
	}>;
	connections: Record<
		string,
		{ main: Array<Array<{ node: string; type: 'main'; index: number }>> }
	>;
	settings: Record<string, never>;
}

type ScheduledMessagingIntegration = 'discord' | 'telegram' | 'slack';
type ScheduleIntervalConfig =
	| { field: 'minutes'; minutesInterval: number }
	| { field: 'hours'; hoursInterval: number; triggerAtMinute: number };

const INTEGRATION_PATTERNS: Array<{ integration: ScheduledMessagingIntegration; pattern: RegExp }> =
	[
		{ integration: 'discord', pattern: /discord|디스코드/i },
		{ integration: 'telegram', pattern: /telegram|텔레그램/i },
		{ integration: 'slack', pattern: /slack|슬랙/i },
	];

const BIGQUERY_PATTERN = /bigquery|빅쿼리/i;
const QUERY_RESULT_PATTERN = /결과|조회|쿼리|query|sql/i;

const GOOGLE_SHEETS_PATTERN = /구글\s*시트|google\s*sheets?|spreadsheet|스프레드시트/i;

const SHEET_CONTENT_RELAY_PATTERN =
	/시트\s*내용|sheet\s*content|내용을?\s*(보내|전송)|읽어\s*서?\s*보내|가져와\s*서?\s*보내/i;

const SHEET_CONTENT_DISCORD_MESSAGE =
	'={{ JSON.stringify($input.all().map((item) => item.json), null, 2).slice(0, 1900) }}';

const NODE_X_GAP = 320;

function parseMinutesInterval(text: string): number | null {
	const everyMinutes = text.match(/(\d+)\s*분마다/i);
	if (everyMinutes?.[1]) {
		const minutes = Number.parseInt(everyMinutes[1], 10);
		return minutes >= 1 && minutes <= 59 ? minutes : null;
	}

	if (/\b(매분|1분마다)\b/i.test(text)) {
		return 1;
	}

	const englishEvery = text.match(/every\s+(\d+)\s+minutes?/i);
	if (englishEvery?.[1]) {
		const minutes = Number.parseInt(englishEvery[1], 10);
		return minutes >= 1 && minutes <= 59 ? minutes : null;
	}

	if (/\bevery\s+minute\b/i.test(text)) {
		return 1;
	}

	return null;
}

function parseHoursInterval(text: string): number | null {
	const everyHours = text.match(/(\d+)\s*시간마다/i);
	if (everyHours?.[1]) {
		const hours = Number.parseInt(everyHours[1], 10);
		return hours >= 1 && hours <= 23 ? hours : null;
	}

	if (/매시간|한\s*시간마다/i.test(text)) {
		return 1;
	}

	const englishEvery = text.match(/every\s+(\d+)\s+hours?/i);
	if (englishEvery?.[1]) {
		const hours = Number.parseInt(englishEvery[1], 10);
		return hours >= 1 && hours <= 23 ? hours : null;
	}

	if (/\bevery\s+hour\b/i.test(text)) {
		return 1;
	}

	return null;
}

function parseScheduleInterval(text: string): ScheduleIntervalConfig | null {
	const minutesInterval = parseMinutesInterval(text);
	if (minutesInterval) {
		return { field: 'minutes', minutesInterval };
	}

	const hoursInterval = parseHoursInterval(text);
	if (hoursInterval) {
		return { field: 'hours', hoursInterval, triggerAtMinute: 0 };
	}

	return null;
}

function parseOutboundMessage(text: string): string {
	const quoted = text.match(/["']([^"']+)["']/);
	if (quoted?.[1]?.trim()) {
		return quoted[1].trim();
	}

	const beforeWrite = text.match(
		/([a-zA-Z0-9]+|[가-힣]+?)\s*(?:를|을)\s*(?:구글\s*시트|시트|google\s*sheets?|spreadsheet|에\s*쓰|에\s*기록)/i,
	);
	if (beforeWrite?.[1]?.trim()) {
		return beforeWrite[1].trim();
	}

	const beforeSend = text.match(/([a-zA-Z가-힣0-9]+)\s*(?:를|을)?\s*보내/i);
	if (beforeSend?.[1]?.trim()) {
		return beforeSend[1].trim();
	}

	return 'hi';
}

function detectIntegration(text: string): ScheduledMessagingIntegration | null {
	for (const { integration, pattern } of INTEGRATION_PATTERNS) {
		if (pattern.test(text)) {
			return integration;
		}
	}
	return null;
}

function detectGoogleSheets(text: string): boolean {
	return GOOGLE_SHEETS_PATTERN.test(text);
}

function wantsSheetContentRelay(text: string): boolean {
	return detectGoogleSheets(text) && SHEET_CONTENT_RELAY_PATTERN.test(text);
}

function wantsBigQuerySlackPattern(
	text: string,
	integration: ScheduledMessagingIntegration,
): boolean {
	return integration === 'slack' && BIGQUERY_PATTERN.test(text) && QUERY_RESULT_PATTERN.test(text);
}

function buildScheduleTriggerNode(
	interval: ScheduleIntervalConfig,
): PatternWorkflowJson['nodes'][number] {
	const name =
		interval.field === 'minutes'
			? interval.minutesInterval === 1
				? 'Every minute'
				: `Every ${interval.minutesInterval} minutes`
			: interval.hoursInterval === 1
				? 'Every hour'
				: `Every ${interval.hoursInterval} hours`;

	return {
		id: randomUUID(),
		name,
		type: 'n8n-nodes-base.scheduleTrigger',
		typeVersion: 1.2,
		position: [0, 300],
		parameters: {
			rule: {
				interval: [interval],
			},
		},
	};
}

function buildGoogleSheetsAppendNode(
	message: string,
	xPosition: number,
): PatternWorkflowJson['nodes'][number] {
	return {
		id: randomUUID(),
		name: 'Append to Google Sheets',
		type: 'n8n-nodes-base.googleSheets',
		typeVersion: 4.7,
		position: [xPosition, 300],
		parameters: {
			resource: 'sheet',
			operation: 'append',
			documentId: {
				__rl: true,
				mode: 'list',
				value: '',
			},
			sheetName: {
				__rl: true,
				mode: 'list',
				value: 'gid=0',
			},
			columns: {
				mappingMode: 'defineBelow',
				value: {
					Message: message,
				},
				matchingColumns: [],
				schema: [
					{
						id: 'Message',
						displayName: 'Message',
						required: false,
						defaultMatch: false,
						display: true,
						type: 'string',
						canBeUsedToMatch: true,
					},
				],
			},
			options: {},
		},
	};
}

function buildGoogleSheetsReadNode(xPosition: number): PatternWorkflowJson['nodes'][number] {
	return {
		id: randomUUID(),
		name: 'Read Google Sheet',
		type: 'n8n-nodes-base.googleSheets',
		typeVersion: 4.7,
		position: [xPosition, 300],
		parameters: {
			resource: 'sheet',
			operation: 'read',
			documentId: {
				__rl: true,
				mode: 'list',
				value: '',
			},
			sheetName: {
				__rl: true,
				mode: 'list',
				value: 'gid=0',
			},
			filtersUI: {},
			options: {
				returnFirstMatch: false,
			},
		},
	};
}

function buildBigQueryNode(xPosition: number): PatternWorkflowJson['nodes'][number] {
	return {
		id: randomUUID(),
		name: 'Run BigQuery Query',
		type: 'n8n-nodes-base.googleBigQuery',
		typeVersion: 2.1,
		position: [xPosition, 300],
		parameters: {
			resource: 'database',
			operation: 'executeQuery',
			projectId: 'YOUR_BIGQUERY_PROJECT_ID',
			sqlQuery: 'SELECT * FROM `project.dataset.table` LIMIT 10',
		},
	};
}

function buildFormatResultsNode(xPosition: number): PatternWorkflowJson['nodes'][number] {
	return {
		id: randomUUID(),
		name: 'Format Results',
		type: 'n8n-nodes-base.set',
		typeVersion: 3.4,
		position: [xPosition, 300],
		parameters: {
			mode: 'manual',
			includeOtherFields: false,
			assignments: [
				{
					assignTo: 'slackMessage',
					value: '={{ "BigQuery results:\\n\\n" + JSON.stringify($json, null, 2) }}',
					type: 'string',
				},
			],
		},
	};
}

function buildDiscordNode(
	content: string,
	xPosition = NODE_X_GAP,
): PatternWorkflowJson['nodes'][number] {
	return {
		id: randomUUID(),
		name: 'Send Discord message',
		type: 'n8n-nodes-base.discord',
		typeVersion: 2,
		position: [xPosition, 300],
		parameters: {
			resource: 'message',
			operation: 'send',
			content,
		},
	};
}

function buildTelegramNode(
	content: string,
	xPosition = NODE_X_GAP,
): PatternWorkflowJson['nodes'][number] {
	return {
		id: randomUUID(),
		name: 'Send Telegram message',
		type: 'n8n-nodes-base.telegram',
		typeVersion: 1.2,
		position: [xPosition, 300],
		parameters: {
			text: content,
			additionalFields: {},
		},
	};
}

function buildSlackNode(
	content: string,
	xPosition = NODE_X_GAP,
): PatternWorkflowJson['nodes'][number] {
	return {
		id: randomUUID(),
		name: 'Send Slack message',
		type: 'n8n-nodes-base.slack',
		typeVersion: 2.2,
		position: [xPosition, 300],
		parameters: {
			resource: 'message',
			operation: 'post',
			channel: 'YOUR_SLACK_CHANNEL_ID',
			text: content,
			otherOptions: {},
		},
	};
}

function buildActionNode(
	integration: ScheduledMessagingIntegration,
	content: string,
	xPosition: number,
): PatternWorkflowJson['nodes'][number] {
	switch (integration) {
		case 'discord':
			return buildDiscordNode(content, xPosition);
		case 'telegram':
			return buildTelegramNode(content, xPosition);
		case 'slack':
			return buildSlackNode(content, xPosition);
	}
}

function chainNodes(
	nodes: PatternWorkflowJson['nodes'][number][],
): Pick<PatternWorkflowJson, 'nodes' | 'connections'> {
	const connections: PatternWorkflowJson['connections'] = {};

	for (let index = 0; index < nodes.length - 1; index++) {
		const from = nodes[index];
		const to = nodes[index + 1];
		if (!from || !to) continue;

		connections[from.name] = {
			main: [[{ node: to.name, type: 'main', index: 0 }]],
		};
	}

	return { nodes, connections };
}

const SETUP_HINTS: Record<ScheduledMessagingIntegration, string> = {
	discord: 'Discord 봇 자격 증명과 채널을',
	telegram: 'Telegram 자격 증명과 chatId를',
	slack: 'Slack 자격 증명과 채널을',
};

/** Build a ready-to-edit workflow for scheduled outbound messaging bots. */
export function tryBuildPatternWorkflowJson(message: string): PatternWorkflowJson | null {
	const text = message.trim();
	const scheduleInterval = parseScheduleInterval(text);
	const integration = detectIntegration(text);

	if (!scheduleInterval || !integration) {
		return null;
	}

	const outboundMessage = parseOutboundMessage(text);
	const scheduleNode = buildScheduleTriggerNode(scheduleInterval);

	if (wantsBigQuerySlackPattern(text, integration)) {
		const bigQueryNode = buildBigQueryNode(NODE_X_GAP);
		const formatNode = buildFormatResultsNode(NODE_X_GAP * 2);
		const slackNode = buildSlackNode('={{ $json.slackMessage }}', NODE_X_GAP * 3);
		const { nodes, connections } = chainNodes([scheduleNode, bigQueryNode, formatNode, slackNode]);

		return {
			name: buildAiWorkflowDefaultName(),
			nodes,
			connections,
			settings: {},
		};
	}

	if (detectGoogleSheets(text)) {
		const relaySheetContent = wantsSheetContentRelay(text);
		const nodes: PatternWorkflowJson['nodes'][number][] = [
			scheduleNode,
			buildGoogleSheetsAppendNode(outboundMessage, NODE_X_GAP),
		];

		if (relaySheetContent) {
			nodes.push(buildGoogleSheetsReadNode(NODE_X_GAP * 2));
		}

		const actionContent = relaySheetContent
			? SHEET_CONTENT_DISCORD_MESSAGE
			: `={{ $json.Message ?? '${outboundMessage}' }}`;

		nodes.push(
			buildActionNode(integration, actionContent, NODE_X_GAP * (relaySheetContent ? 3 : 2)),
		);

		const { nodes: chainedNodes, connections } = chainNodes(nodes);

		return {
			name: buildAiWorkflowDefaultName(),
			nodes: chainedNodes,
			connections,
			settings: {},
		};
	}

	const actionNode = buildActionNode(integration, outboundMessage, NODE_X_GAP);
	const { nodes, connections } = chainNodes([scheduleNode, actionNode]);

	return {
		name: buildAiWorkflowDefaultName(),
		nodes,
		connections,
		settings: {},
	};
}

export function getPatternWorkflowSetupHint(message: string): ScheduledMessagingIntegration | null {
	const text = message.trim();
	if (!parseMinutesInterval(text) || !detectIntegration(text)) {
		return null;
	}
	return detectIntegration(text);
}

export function formatPatternWorkflowCreatedMessage(
	workflowName: string,
	userMessage: string,
): string {
	const integration = getPatternWorkflowSetupHint(userMessage);
	const setupHint = integration ? SETUP_HINTS[integration] : '노드 자격 증명과 대상 채널을';
	const sheetsHint = detectGoogleSheets(userMessage) ? 'Google Sheets 스프레드시트·시트와 ' : '';
	return `워크플로 "${workflowName}"을(를) 만들었습니다. 에디터에서 ${sheetsHint}${setupHint} 설정한 뒤 활성화해 주세요.`;
}
