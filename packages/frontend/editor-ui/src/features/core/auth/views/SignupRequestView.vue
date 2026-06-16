<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { createPasswordRules } from '@n8n/design-system';

import { VIEWS } from '@/app/constants';
import { useToast } from '@/app/composables/useToast';
import { useSettingsStore } from '@/app/stores/settings.store';
import type { IFormBoxConfig } from '@/Interface';
import { useUsersStore } from '@/features/settings/users/users.store';
import AuthView from './AuthView.vue';

const usersStore = useUsersStore();
const settingsStore = useSettingsStore();
const router = useRouter();
const toast = useToast();
const loading = ref(false);
const passwordMinLength = settingsStore.userManagement.passwordMinLength ?? 8;

const formConfig: IFormBoxConfig = reactive({
	title: '계정 가입 신청',
	buttonText: '가입 신청 보내기',
	redirectText: '로그인으로 돌아가기',
	redirectLink: '/signin',
	inputs: [
		{
			name: 'loginId',
			properties: {
				label: '아이디',
				type: 'text',
				required: true,
				showRequiredAsterisk: false,
				validateOnBlur: false,
				autocomplete: 'off',
				capitalize: false,
				focusInitially: true,
			},
		},
		{
			name: 'password',
			properties: {
				label: '비밀번호',
				type: 'password',
				required: true,
				showRequiredAsterisk: false,
				validateOnBlur: false,
				autocomplete: 'new-password',
				validationRules: [createPasswordRules(passwordMinLength)],
				infoText: `${passwordMinLength}자 이상, 숫자/대문자 포함`,
				capitalize: true,
			},
		},
	],
});

async function onSubmit(values?: { [key: string]: string | boolean }) {
	if (!values) {
		toast.showError(new Error('Invalid signup form payload'), '가입 신청을 보낼 수 없습니다');
		return;
	}

	const loginId = values.loginId?.toString().trim() ?? '';
	const password = values.password?.toString() ?? '';

	try {
		loading.value = true;
		await usersStore.requestSignup({
			loginId,
			password,
		});
		toast.showMessage({
			type: 'success',
			title: '가입 신청 완료',
			message: '관리자 승인 후 로그인할 수 있습니다.',
		});
		await router.push({ name: VIEWS.SIGNIN });
	} catch (error) {
		toast.showError(error, '가입 신청을 보낼 수 없습니다');
	} finally {
		loading.value = false;
	}
}
</script>

<template>
	<AuthView :form="formConfig" :form-loading="loading" @submit="onSubmit" />
</template>
