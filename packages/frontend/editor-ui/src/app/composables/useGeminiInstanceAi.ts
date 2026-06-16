import { computed, ref } from 'vue';
import { useRootStore } from '@n8n/stores/useRootStore';
import { useSettingsStore } from '@/app/stores/settings.store';
import { useCredentialsStore } from '@/features/credentials/credentials.store';
import { useProjectsStore } from '@/features/collaboration/projects/projects.store';
import { useToast } from '@/app/composables/useToast';
import { useI18n } from '@n8n/i18n';
import { hasPermission } from '@/app/utils/rbac/permissions';
import {
	fetchPreferences,
	updatePreferences,
	fetchSettings,
	updateSettings,
} from '@/features/ai/instanceAi/instanceAi.settings.api';

const GEMINI_CREDENTIAL_TYPE = 'googlePalmApi';
const GEMINI_CREDENTIAL_NAME = 'Gemini API';
const GEMINI_HOST = 'https://generativelanguage.googleapis.com';
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export function useGeminiInstanceAi() {
	const rootStore = useRootStore();
	const settingsStore = useSettingsStore();
	const credentialsStore = useCredentialsStore();
	const projectsStore = useProjectsStore();
	const { showToast, showError } = useToast();
	const i18n = useI18n();

	const isSaving = ref(false);
	const isConfigured = ref(false);
	const configuredModelName = ref(DEFAULT_GEMINI_MODEL);
	const geminiApiKey = ref('');

	const isModuleActive = computed(() => settingsStore.isModuleActive('instance-ai'));

	// mnetplus: always show Gemini setup in Personal settings
	const canConfigure = computed(() => true);

	const canEnableInstanceAi = computed(() =>
		hasPermission(['rbac'], { rbac: { scope: 'instanceAi:manage' } }),
	);

	async function loadStatus(): Promise<void> {
		if (!canConfigure.value) return;

		try {
			const preferences = await fetchPreferences(rootStore.restApiContext);
			isConfigured.value = Boolean(preferences.credentialId);
			configuredModelName.value = preferences.modelName || DEFAULT_GEMINI_MODEL;
		} catch {
			isConfigured.value = false;
		}
	}

	async function saveApiKey(apiKey: string): Promise<boolean> {
		if (!canConfigure.value) return false;

		const trimmedKey = apiKey.trim();
		if (!trimmedKey) {
			showToast({
				title: i18n.baseText('settings.personal.gemini.error.empty'),
				type: 'error',
			});
			return false;
		}

		isSaving.value = true;
		try {
			const preferences = await fetchPreferences(rootStore.restApiContext);
			let credentialId = preferences.credentialId;

			if (credentialId) {
				const existing = credentialsStore.getCredentialById(credentialId);
				await credentialsStore.updateCredential({
					id: credentialId,
					data: {
						id: credentialId,
						name: existing?.name ?? GEMINI_CREDENTIAL_NAME,
						type: GEMINI_CREDENTIAL_TYPE,
						data: {
							host: GEMINI_HOST,
							apiKey: trimmedKey,
						},
					},
				});
			} else {
				const projectId = projectsStore.personalProject?.id;
				const created = await credentialsStore.createNewCredential(
					{
						name: GEMINI_CREDENTIAL_NAME,
						type: GEMINI_CREDENTIAL_TYPE,
						data: {
							host: GEMINI_HOST,
							apiKey: trimmedKey,
						},
					},
					projectId,
					'personal-settings',
				);
				credentialId = created.id;
			}

			await updatePreferences(rootStore.restApiContext, {
				credentialId,
				modelName: configuredModelName.value || DEFAULT_GEMINI_MODEL,
			});

			if (canEnableInstanceAi.value) {
				const adminSettings = await fetchSettings(rootStore.restApiContext);
				if (!adminSettings.enabled) {
					await updateSettings(rootStore.restApiContext, { enabled: true });
					await settingsStore.getModuleSettings();
				}
			}

			isConfigured.value = true;
			geminiApiKey.value = '';
			showToast({
				title: i18n.baseText('settings.personal.gemini.success'),
				type: 'success',
			});
			return true;
		} catch (error) {
			showError(error, i18n.baseText('settings.personal.gemini.error.save'));
			return false;
		} finally {
			isSaving.value = false;
		}
	}

	return {
		isModuleActive,
		canConfigure,
		isSaving,
		isConfigured,
		configuredModelName,
		geminiApiKey,
		loadStatus,
		saveApiKey,
	};
}
