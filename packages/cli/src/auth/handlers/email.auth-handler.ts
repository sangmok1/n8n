import { GlobalConfig } from '@n8n/config';
import { User, UserRepository, Like } from '@n8n/db';
import type { IPasswordAuthHandler } from '@n8n/decorators';
import { AuthHandler } from '@n8n/decorators';
import { Constructable } from '@n8n/di';

import { AuthError } from '@/errors/response-errors/auth.error';
import { EventService } from '@/events/event.service';
import { PasswordUtility } from '@/services/password.utility';

@AuthHandler()
export class EmailAuthHandler implements IPasswordAuthHandler<User> {
	readonly metadata = { name: 'email', type: 'password' as const };
	readonly userClass: Constructable<User> = User;

	constructor(
		private readonly userRepository: UserRepository,
		private readonly passwordUtility: PasswordUtility,
		private readonly eventService: EventService,
		private readonly globalConfig: GlobalConfig,
	) {}

	private async resolveUserByLoginId(emailOrLoginId: string): Promise<User | null> {
		const normalized = emailOrLoginId.toLowerCase();
		const direct = await this.userRepository.findOne({
			where: { email: normalized },
			relations: ['authIdentities', 'role'],
		});
		if (direct) return direct;

		// Support "admin" style login IDs by resolving a unique local-part match.
		if (normalized.includes('@')) return null;
		const candidates = await this.userRepository.find({
			where: { email: Like(`${normalized}@%`) },
			relations: ['authIdentities', 'role'],
			take: 2,
		});
		if (candidates.length === 1) return candidates[0];
		return null;
	}

	async handleLogin(emailOrLoginId: string, password: string): Promise<User | undefined> {
		const user = await this.resolveUserByLoginId(emailOrLoginId);

		if (user?.password && (await this.passwordUtility.compare(password, user.password))) {
			return user;
		}

		// At this point if the user has a LDAP ID, means it was previously an LDAP user,
		// so suggest to reset the password to gain access to the instance.
		const ldapIdentity = user?.authIdentities?.find((i) => i.providerType === 'ldap');
		if (user && ldapIdentity && !this.globalConfig.sso.ldap.loginEnabled) {
			this.eventService.emit('login-failed-due-to-ldap-disabled', { userId: user.id });

			throw new AuthError('Reset your password to gain access to the instance.');
		}

		return undefined;
	}
}
