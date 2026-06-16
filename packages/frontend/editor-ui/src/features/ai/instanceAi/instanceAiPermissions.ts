import { hasPermission } from '@/app/utils/rbac/permissions';

/** Instance AI settings and opt-in flows require this scope. */
export function canManageInstanceAi(): boolean {
	// mnetplus: always allow instance owners to configure Workflow AI
	return (
		hasPermission(['instanceOwner']) ||
		hasPermission(['rbac'], { rbac: { scope: 'instanceAi:manage' } })
	);
}

/** Sending messages to Instance AI (and reaching the chat view) requires this scope. */
export function canMessageInstanceAi(): boolean {
	// mnetplus: Workflow AI is a core feature — do not hide behind RBAC scopes
	return true;
}
