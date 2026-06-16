import { buildScaffoldWorkflowJson } from '../workflow-scaffold';

describe('buildScaffoldWorkflowJson', () => {
	it('creates a manual trigger and sticky note from the user message', () => {
		const message = '매일 아침 Gmail을 읽고 요약 이메일을 보내줘';
		const json = buildScaffoldWorkflowJson(message);

		expect(json.name).toMatch(/^AI workflow \d{5}$/);
		expect(json.nodes).toHaveLength(2);
		expect(json.nodes[0]?.type).toBe('n8n-nodes-base.manualTrigger');
		expect(json.nodes[1]?.type).toBe('n8n-nodes-base.stickyNote');
		expect(json.nodes[1]?.parameters.content).toBe(message);
	});
});
