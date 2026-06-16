import { startBuildWorkflowAgentTask } from '../tools/orchestration/build-workflow-agent.tool';
import type { OrchestrationContext } from '../types';

export async function invokeDirectWorkflowBuild(
	context: OrchestrationContext,
	input: { task: string; conversationContext?: string; directBuildMessage?: string },
): Promise<{ taskId: string; result: string; agentId: string }> {
	return await startBuildWorkflowAgentTask(context, {
		task: input.task,
		conversationContext: input.conversationContext ?? input.task,
		skipAutoFollowUp: true,
		directBuildMessage: input.directBuildMessage,
	});
}
