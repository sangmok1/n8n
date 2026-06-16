/** Default title for workflows created through Instance AI chat/build. */
export function buildAiWorkflowDefaultName(now = new Date()): string {
	const yy = String(now.getFullYear()).slice(-2);
	const mm = String(now.getMonth() + 1).padStart(2, '0');
	const dd = String(now.getDate()).padStart(2, '0');
	const hh = String(now.getHours()).padStart(2, '0');
	const mi = String(now.getMinutes()).padStart(2, '0');
	const ss = String(now.getSeconds()).padStart(2, '0');
	const suffix = `${yy}${mm}${dd}${hh}${mi}${ss}`.slice(-5);

	return `AI workflow ${suffix}`;
}
