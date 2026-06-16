import { buildAiWorkflowDefaultName } from './ai-workflow-name';

export interface ScaffoldWorkflowJson {
	name: string;
	nodes: Array<{
		id: string;
		name: string;
		type: string;
		typeVersion: number;
		position: [number, number];
		parameters: Record<string, unknown>;
	}>;
	connections: Record<string, never>;
	settings: Record<string, never>;
}

/** Minimal editable workflow draft — manual trigger + sticky note with the user request. */
export function buildScaffoldWorkflowJson(message: string): ScaffoldWorkflowJson {
	const title = buildAiWorkflowDefaultName();
	const noteContent = message.trim().slice(0, 4000);

	return {
		name: title,
		nodes: [
			{
				id: 'manual-trigger',
				name: 'When clicking ‘Execute workflow’',
				type: 'n8n-nodes-base.manualTrigger',
				typeVersion: 1,
				position: [0, 300],
				parameters: {},
			},
			{
				id: 'request-note',
				name: '요청 사항',
				type: 'n8n-nodes-base.stickyNote',
				typeVersion: 1,
				position: [280, 220],
				parameters: {
					content: noteContent,
					width: 420,
					height: 220,
				},
			},
		],
		connections: {},
		settings: {},
	};
}
