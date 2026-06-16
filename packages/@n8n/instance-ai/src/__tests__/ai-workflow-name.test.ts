import { buildAiWorkflowDefaultName } from '../ai-workflow-name';

describe('buildAiWorkflowDefaultName', () => {
	it('uses the AI workflow prefix with a 5-character time-based suffix', () => {
		const name = buildAiWorkflowDefaultName(new Date('2025-06-08T21:43:05'));

		expect(name).toBe('AI workflow 14305');
	});

	it('changes between different timestamps', () => {
		const first = buildAiWorkflowDefaultName(new Date('2025-06-08T21:43:05'));
		const second = buildAiWorkflowDefaultName(new Date('2025-06-08T21:43:06'));

		expect(first).not.toBe(second);
	});
});
