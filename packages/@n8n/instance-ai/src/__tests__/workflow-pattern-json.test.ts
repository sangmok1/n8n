import {
	formatPatternWorkflowCreatedMessage,
	tryBuildPatternWorkflowJson,
} from '../workflow-pattern-json';

describe('tryBuildPatternWorkflowJson', () => {
	it('builds a schedule + Discord workflow for the Discord hi bot request', () => {
		const message = '1분마다 hi 보내는 디스코드 봇 만들어줄래?';
		const json = tryBuildPatternWorkflowJson(message);

		expect(json).not.toBeNull();
		expect(json?.nodes).toHaveLength(2);
		expect(json?.nodes[0]?.type).toBe('n8n-nodes-base.scheduleTrigger');
		expect(json?.nodes[0]?.parameters).toEqual({
			rule: { interval: [{ field: 'minutes', minutesInterval: 1 }] },
		});
		expect(json?.nodes[1]?.type).toBe('n8n-nodes-base.discord');
		expect(json?.nodes[1]?.parameters).toMatchObject({
			resource: 'message',
			operation: 'send',
			content: 'hi',
		});
		expect(json?.connections[json.nodes[0]!.name]?.main[0]?.[0]?.node).toBe(json?.nodes[1]?.name);
	});

	it('builds schedule + Google Sheets + read + Discord for sheet relay bots', () => {
		const message =
			'1분마다 hi를 구글 시트에 쓰고 그 구글시트 내용을 보내는 디스코드 봇 만들어줄래?';
		const json = tryBuildPatternWorkflowJson(message);

		expect(json).not.toBeNull();
		expect(json?.nodes).toHaveLength(4);
		expect(json?.nodes[0]?.type).toBe('n8n-nodes-base.scheduleTrigger');
		expect(json?.nodes[1]?.type).toBe('n8n-nodes-base.googleSheets');
		expect(json?.nodes[1]?.name).toBe('Append to Google Sheets');
		expect(json?.nodes[1]?.parameters).toMatchObject({
			resource: 'sheet',
			operation: 'append',
			columns: {
				mappingMode: 'defineBelow',
				value: { Message: 'hi' },
			},
		});
		expect(json?.nodes[2]?.type).toBe('n8n-nodes-base.googleSheets');
		expect(json?.nodes[2]?.name).toBe('Read Google Sheet');
		expect(json?.nodes[2]?.parameters).toMatchObject({
			resource: 'sheet',
			operation: 'read',
		});
		expect(json?.nodes[3]?.type).toBe('n8n-nodes-base.discord');
		expect(json?.nodes[3]?.parameters?.content).toContain('JSON.stringify');
		expect(json?.connections[json.nodes[0]!.name]?.main[0]?.[0]?.node).toBe(json?.nodes[1]?.name);
		expect(json?.connections[json.nodes[1]!.name]?.main[0]?.[0]?.node).toBe(json?.nodes[2]?.name);
		expect(json?.connections[json.nodes[2]!.name]?.main[0]?.[0]?.node).toBe(json?.nodes[3]?.name);
	});

	it('builds schedule + Google Sheets + Discord when sheet write is requested without relay', () => {
		const json = tryBuildPatternWorkflowJson('5분마다 hello를 구글 시트에 쓰고 디스코드로 알려줘');

		expect(json?.nodes).toHaveLength(3);
		expect(json?.nodes[1]?.parameters).toMatchObject({
			operation: 'append',
			columns: { value: { Message: 'hello' } },
		});
		expect(json?.nodes[2]?.type).toBe('n8n-nodes-base.discord');
		expect(json?.connections[json.nodes[1]!.name]?.main[0]?.[0]?.node).toBe(json?.nodes[2]?.name);
	});

	it('builds a Telegram variant with quoted message text', () => {
		const json = tryBuildPatternWorkflowJson('5분마다 텔레그램으로 "hello" 보내는 봇');

		expect(json?.nodes[1]?.type).toBe('n8n-nodes-base.telegram');
		expect(json?.nodes[1]?.parameters).toMatchObject({ text: 'hello' });
		expect(json?.nodes[0]?.parameters).toEqual({
			rule: { interval: [{ field: 'minutes', minutesInterval: 5 }] },
		});
	});

	it('builds hourly BigQuery -> Slack workflow when query results are requested', () => {
		const json = tryBuildPatternWorkflowJson(
			'1시간마다 빅쿼리 결과 받아서 슬랙으로 쓰는 봇 만들어줘',
		);

		expect(json).not.toBeNull();
		expect(json?.nodes).toHaveLength(4);
		expect(json?.nodes[0]?.type).toBe('n8n-nodes-base.scheduleTrigger');
		expect(json?.nodes[0]?.parameters).toEqual({
			rule: { interval: [{ field: 'hours', hoursInterval: 1, triggerAtMinute: 0 }] },
		});
		expect(json?.nodes[1]?.type).toBe('n8n-nodes-base.googleBigQuery');
		expect(json?.nodes[1]?.parameters).toMatchObject({
			resource: 'database',
			operation: 'executeQuery',
		});
		expect(json?.nodes[2]?.type).toBe('n8n-nodes-base.set');
		expect(json?.nodes[3]?.type).toBe('n8n-nodes-base.slack');
		expect(json?.nodes[3]?.parameters).toMatchObject({
			resource: 'message',
			operation: 'post',
			text: '={{ $json.slackMessage }}',
		});
	});

	it('returns null when schedule or integration is missing', () => {
		expect(tryBuildPatternWorkflowJson('디스코드 봇 만들어줘')).toBeNull();
		expect(tryBuildPatternWorkflowJson('1분마다 이메일 보내줘')).toBeNull();
	});
});

describe('formatPatternWorkflowCreatedMessage', () => {
	it('mentions Discord setup steps', () => {
		const message = formatPatternWorkflowCreatedMessage(
			'Discord hi bot',
			'1분마다 hi 보내는 디스코드 봇 만들어줄래?',
		);

		expect(message).toContain('Discord hi bot');
		expect(message).toContain('Discord 봇 자격 증명');
	});

	it('mentions Google Sheets setup when the request includes a sheet step', () => {
		const message = formatPatternWorkflowCreatedMessage(
			'AI workflow 12345',
			'1분마다 hi를 구글 시트에 쓰고 그 구글시트 내용을 보내는 디스코드 봇',
		);

		expect(message).toContain('Google Sheets');
		expect(message).toContain('Discord 봇 자격 증명');
	});
});
