import { setLanguage } from '@n8n/i18n';
import { locale as designLocale } from '@n8n/design-system';
import { useRootStore } from '@n8n/stores/useRootStore';
import axios from 'axios';
import { computed, ref } from 'vue';
import { useLocalStorage } from '@vueuse/core';

import { LOCAL_STORAGE_UI_LOCALE } from '@/app/constants/localStorage';

export const UI_LOCALE_OPTIONS = ['en', 'ko'] as const;
export type UiLocale = (typeof UI_LOCALE_OPTIONS)[number];

function isUiLocale(value: string): value is UiLocale {
	return (UI_LOCALE_OPTIONS as readonly string[]).includes(value);
}

const uiLocale = ref<UiLocale>('en');

export function useUiLocale() {
	const rootStore = useRootStore();
	const storedLocale = useLocalStorage<string | null>(LOCAL_STORAGE_UI_LOCALE, null);

	const currentUiLocale = computed({
		get: () => uiLocale.value,
		set: (locale: UiLocale) => {
			applyUiLocale(locale);
			storedLocale.value = locale;
		},
	});

	function resolveInitialLocale(): UiLocale {
		if (storedLocale.value && isUiLocale(storedLocale.value)) {
			return storedLocale.value;
		}
		const fromServer = rootStore.defaultLocale;
		if (fromServer && isUiLocale(fromServer)) {
			return fromServer;
		}
		return 'en';
	}

	function applyUiLocale(locale: UiLocale) {
		uiLocale.value = locale;
		setLanguage(locale);
		axios.defaults.headers.common['Accept-Language'] = locale;
		void designLocale.use(locale);
	}

	function initUiLocale() {
		applyUiLocale(resolveInitialLocale());
	}

	return {
		uiLocale: currentUiLocale,
		initUiLocale,
		applyUiLocale,
		localeOptions: UI_LOCALE_OPTIONS,
	};
}
