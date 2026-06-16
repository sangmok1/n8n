import { z } from 'zod';

import { Z } from '../../zod-class';

export class SignupRequestDto extends Z.class({
	loginId: z.string().trim().min(2).max(64),
	password: z.string().min(8).max(256),
}) {}
