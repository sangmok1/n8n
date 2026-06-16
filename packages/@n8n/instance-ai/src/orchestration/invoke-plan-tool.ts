import { createPlanWithAgentTool } from '../tools/orchestration/plan-with-agent.tool';
import type { OrchestrationContext } from '../types';
import { executeTool } from '../utils/execute-tool';

export async function invokePlanTool(
	context: OrchestrationContext,
	input: { guidance?: string } = {},
): Promise<{ result: string }> {
	const tool = createPlanWithAgentTool(context);
	return await executeTool<{ result: string }>(tool, input, {});
}
