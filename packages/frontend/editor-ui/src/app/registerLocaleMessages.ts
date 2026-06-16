import { updateLocaleMessages } from '@n8n/i18n';
import type { LocaleMessages } from '@n8n/i18n/types';

const localeModules = import.meta.glob('@n8n/i18n/locales/*.json', { eager: true }) as Record<
	string,
	{ default?: LocaleMessages }
>;

/**
 * Registers non-English locale JSON files for production builds.
 * English is already bundled in @n8n/i18n; dev HMR handles live locale updates separately.
 */
export function registerLocaleMessages(): void {
	for (const [path, mod] of Object.entries(localeModules)) {
		const locale = path.match(/\/locales\/([^/]+)\.json$/)?.[1];
		const messages = mod?.default;
		if (!locale || !messages || locale === 'en') continue;
		updateLocaleMessages(locale, messages);
	}
}
