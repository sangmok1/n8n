import { buildWorkflowResearchContext } from '../workflow-build-research';
import type { InstanceAiWorkflowService } from '../types';

describe('buildWorkflowResearchContext', () => {
	const message = '3분마다 hi라는걸 구글 시트에 넣고 그걸 디스코드 봇이 받아서 보내는 워크플로우';

	it('includes required pipeline steps and research instructions', async () => {
		const workflowService = {
			list: jest.fn().mockResolvedValue([]),
			get: jest.fn(),
		} as unknown as InstanceAiWorkflowService;

		const context = await buildWorkflowResearchContext(workflowService, message);

		expect(context).toContain('Schedule Trigger');
		expect(context).toContain('Google Sheets');
		expect(context).toContain('Discord');
		expect(context).toContain('do not omit Google Sheets');
		expect(context).toContain('nodes(action="search")');
		expect(context).toContain('scheduling');
		expect(context).toContain('data_persistence');
	});

	it('lists similar workflows with node types when matches exist', async () => {
		const workflowService = {
			list: jest.fn().mockResolvedValue([
				{
					id: 'wf-1',
					name: 'Discord Google Sheets relay',
					versionId: 'v1',
					activeVersionId: null,
					isArchived: false,
					createdAt: '2026-01-01T00:00:00.000Z',
					updatedAt: '2026-01-01T00:00:00.000Z',
				},
			]),
			get: jest.fn().mockResolvedValue({
				id: 'wf-1',
				name: 'Discord Google Sheets relay',
				versionId: 'v1',
				activeVersionId: null,
				isArchived: false,
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z',
				nodes: [
					{ name: 'Every 3 minutes', type: 'n8n-nodes-base.scheduleTrigger', position: [0, 0] },
					{ name: 'Append', type: 'n8n-nodes-base.googleSheets', position: [0, 0] },
					{ name: 'Read', type: 'n8n-nodes-base.googleSheets', position: [0, 0] },
					{ name: 'Discord', type: 'n8n-nodes-base.discord', position: [0, 0] },
				],
				connections: {},
			}),
		} as unknown as InstanceAiWorkflowService;

		const context = await buildWorkflowResearchContext(workflowService, message);

		expect(context).toContain('Discord Google Sheets relay');
		expect(context).toContain('wf-1');
		expect(context).toContain('n8n-nodes-base.googleSheets');
		expect(context).toContain('n8n-nodes-base.discord');
	});
});
