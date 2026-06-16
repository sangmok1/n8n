import { hasDispatchedWorkflowWork, isWorkflowBuildRequest } from '../workflow-build-intent';

describe('isWorkflowBuildRequest', () => {
	it('detects explicit Korean workflow creation requests', () => {
		expect(isWorkflowBuildRequest('1분마다 디스코드에 hi 보내는 워크플로 만들어줘')).toBe(true);
	});

	it('detects short Korean workflow creation requests', () => {
		expect(isWorkflowBuildRequest('워크플로 만들어줘')).toBe(true);
	});

	it('treats bot creation as a workflow creation alias', () => {
		expect(isWorkflowBuildRequest('빅쿼리 결과를 슬랙으로 보내는 봇 만들어줘')).toBe(true);
		expect(isWorkflowBuildRequest('슬랙 봇 생성해줘')).toBe(true);
	});

	it('detects short colloquial Korean build requests', () => {
		expect(isWorkflowBuildRequest('걍만드렁줘')).toBe(true);
		expect(isWorkflowBuildRequest('그냥 만들어줘')).toBe(true);
	});

	it('detects Discord bot requests without the word workflow', () => {
		expect(isWorkflowBuildRequest('1분마다 hi 보내는 디스코드 봇 만들어줄래?')).toBe(true);
	});

	it('detects scheduled automation descriptions without the word workflow', () => {
		const message =
			'매일 아침, 지난 24시간 동안 Gmail로 수신된 모든 이메일을 읽고, OpenAI를 사용해 할 일을 추출하고 요약 이메일을 보냅니다.';
		expect(isWorkflowBuildRequest(message)).toBe(true);
	});

	it('rejects workflow listing requests', () => {
		expect(isWorkflowBuildRequest('내 워크플로 목록 보여줘')).toBe(false);
	});
});

describe('hasDispatchedWorkflowWork', () => {
	it('returns false when only plan succeeded', () => {
		expect(
			hasDispatchedWorkflowWork({
				toolCalls: [{ toolCallId: '1', toolName: 'plan', succeeded: true }],
				totalToolCalls: 1,
				totalToolErrors: 0,
			}),
		).toBe(false);
	});

	it('returns true when workflow build tool succeeded', () => {
		expect(
			hasDispatchedWorkflowWork({
				toolCalls: [{ toolCallId: '1', toolName: 'build-workflow-with-agent', succeeded: true }],
				totalToolCalls: 1,
				totalToolErrors: 0,
			}),
		).toBe(true);
	});

	it('returns false when only research tools ran', () => {
		expect(
			hasDispatchedWorkflowWork({
				toolCalls: [
					{ toolCallId: '1', toolName: 'credentials', succeeded: true },
					{ toolCallId: '2', toolName: 'templates', succeeded: true },
				],
				totalToolCalls: 2,
				totalToolErrors: 0,
			}),
		).toBe(false);
	});
});
