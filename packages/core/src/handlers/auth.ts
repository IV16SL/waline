import { unauthorized, WalineError } from '../error.js';
import type { PasskeyCredential, WalineContext } from '../types.js';
import { currentUser, requireUser } from '../utils/auth.js';
import { createAvatarFormatter } from '../utils/avatar.js';
import type { CoreRuntime } from '../utils/runtime.js';
import { requiredCapability, requiredString } from '../utils/validation.js';


const parsePasskeys = (raw: unknown): PasskeyCredential[] => {
  if (!raw) return [];
  try {
    const list = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(list)) return [];
    return list.filter(
      (item): item is PasskeyCredential =>
        !!item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string',
    );
  } catch {
    return [];
  }
};

export const createAuthHandler = (runtime: CoreRuntime) => {
  const { models, services } = runtime;
  const avatar = createAvatarFormatter(runtime);

  return {
    async resolveSession(input: { token?: string }, ctx: WalineContext) {
      if (!input.token) return;

      const tokenService = requiredCapability(services.token, 'token');
      let id: string;

      try {
        id = await tokenService.verify(input.token);
      } catch {
        return;
      }

      const [account] = await models.Users.select(
        {
          objectId: id,
          type: ['!=', 'banned'],
        },
        {
          field: [
            'id',
            'email',
            'url',
            'display_name',
            'type',
            'avatar',
            '2fa',
            'label',
            ...(ctx.state.oauthServices?.map(({ name }) => name) ?? []),
          ],
        },
      );

      if (!account) return;

      return { ...account, avatar: await avatar(account), token: input.token };
    },

    async login(input: { email: string; password: string; code?: string }, _ctx: WalineContext) {
      const email = requiredString(input.email, 'email');
      requiredString(input.password, 'password');
      const passwordService = requiredCapability(services.password, 'password');
      const tokenService = requiredCapability(services.token, 'token');
      const [account] = await models.Users.select({ email });

      if (
        !account ||
        account.type.startsWith('verify:') ||
        account.type === 'banned' ||
        !account.password ||
        !(await passwordService.verify(input.password, account.password))
      ) {
        throw new WalineError('LOGIN_FAILED', 400);
      }

      if (account['2fa']) {
        const twoFactor = requiredCapability(services.twoFactor, 'twoFactor');
        if (!input.code || !(await twoFactor.verify(account['2fa'], input.code))) {
          throw new WalineError('TWO_FACTOR_AUTH_ERROR', 400);
        }
      }

      return {
        ...account,
        password: undefined,
        avatar: await avatar(account),
        token: await tokenService.sign(account.objectId),
      };
    },

    async getTwoFactorStatus(input: { email?: string }, ctx: WalineContext) {
      if (!currentUser(ctx) && !input.email) unauthorized();

      const email = input.email ?? currentUser(ctx)?.email;
      const [account] = await models.Users.select({ email });

      return { enable: Boolean(account?.['2fa']) };
    },

    async createTwoFactorSecret(_input: object, ctx: WalineContext) {
      const user = requireUser(ctx);
      const twoFactor = requiredCapability(services.twoFactor, 'twoFactor');

      if (user['2fa'] && user['2fa'].length === 32) {
        return {
          otpauth_url: `otpauth://totp/waline_${user.objectId}?secret=${user['2fa']}`,
          secret: user['2fa'],
        };
      }

      return twoFactor.create(user.objectId);
    },

    async enableTwoFactor(input: { secret: string; code: string }, ctx: WalineContext) {
      const user = requireUser(ctx);
      const twoFactor = requiredCapability(services.twoFactor, 'twoFactor');

      if (!(await twoFactor.verify(input.secret, input.code))) {
        throw new WalineError('TWO_FACTOR_AUTH_ERROR', 400, 'TWO_FACTOR_AUTH_ERROR_DETAIL');
      }

      await models.Users.update({ '2fa': input.secret }, { objectId: user.objectId });
    },

    async getPasskeyRegisterOptions(_input: object, ctx: WalineContext) {
      const user = requireUser(ctx);
      const passkey = requiredCapability(services.passkey, 'passkey');
      const [account] = await models.Users.select(
        { objectId: user.objectId },
        { field: ['passkey'] },
      );
      try {
        return await passkey.getRegistrationOptions({
          userId: String(user.objectId),
          userName: user.email,
          displayName: user.display_name || user.email,
          excludeCredentialIds: parsePasskeys(account?.passkey).map(({ id }) => id),
        });
      } catch {
        throw new WalineError('PASSKEY_NOT_CONFIGURED', 500);
      }
    },

    async verifyPasskeyRegistration(
      input: { state: string; credential: unknown },
      ctx: WalineContext,
    ) {
      const user = requireUser(ctx);
      const passkey = requiredCapability(services.passkey, 'passkey');
      let record: PasskeyCredential;
      try {
        record = await passkey.verifyRegistration({
          credential: input.credential,
          state: requiredString(input.state, 'state'),
          userId: String(user.objectId),
        });
      } catch {
        throw new WalineError('PASSKEY_REGISTER_FAILED', 400);
      }
      const [account] = await models.Users.select(
        { objectId: user.objectId },
        { field: ['passkey'] },
      );
      const list = parsePasskeys(account?.passkey).filter(({ id }) => id !== record.id);
      list.push({
        ...record,
        name: 'Passkey ' + (list.length + 1),
        createdAt: new Date().toISOString(),
      });
      await models.Users.update({ passkey: JSON.stringify(list) }, { objectId: user.objectId });
      return { ok: true };
    },

    async getPasskeyAuthOptions(input: { email?: string }, _ctx: WalineContext) {
      const passkey = requiredCapability(services.passkey, 'passkey');
      const email = typeof input.email === 'string' && input.email ? input.email : undefined;
      if (email) {
        const [account] = await models.Users.select({ email }, { field: ['passkey'] });
        const list = parsePasskeys(account?.passkey);
        if (!account || list.length === 0) {
          throw new WalineError('PASSKEY_NOT_REGISTERED', 400);
        }
        try {
          return await passkey.getAuthenticationOptions({
            allowCredentialIds: list.map(({ id }) => id),
            email,
          });
        } catch {
          throw new WalineError('PASSKEY_NOT_CONFIGURED', 500);
        }
      }
      // usernameless: the browser shows an account picker instead
      try {
        return await passkey.getAuthenticationOptions({ allowCredentialIds: [] });
      } catch {
        throw new WalineError('PASSKEY_NOT_CONFIGURED', 500);
      }
    },

    async verifyPasskeyLogin(
      input: {
        state: string;
        credential: { id: string; response?: { userHandle?: string } } & Record<string, unknown>;
      },
      _ctx: WalineContext,
    ) {
      const passkey = requiredCapability(services.passkey, 'passkey');
      const tokenService = requiredCapability(services.token, 'token');
      const credential = input.credential;
      if (!credential || typeof credential.id !== 'string') {
        throw new WalineError('PASSKEY_VERIFY_FAILED', 400);
      }
      let challenge: string;
      let email: string | undefined;
      try {
        ({ challenge, email } = await passkey.peekAuthState(requiredString(input.state, 'state')));
      } catch {
        throw new WalineError('PASSKEY_CHALLENGE_INVALID', 400);
      }
      let account;
      if (email) {
        [account] = await models.Users.select({ email });
      } else {
        // usernameless: the authenticator returns the userHandle we set at registration
        const userHandle = credential.response?.userHandle;
        if (typeof userHandle !== 'string' || !userHandle) {
          throw new WalineError('PASSKEY_VERIFY_FAILED', 400);
        }
        try {
          const userId = await passkey.decodeUserHandle(userHandle);
          [account] = await models.Users.select({ objectId: userId });
        } catch {
          throw new WalineError('PASSKEY_VERIFY_FAILED', 400);
        }
      }
      if (!account || account.type.startsWith('verify:') || account.type === 'banned') {
        throw new WalineError('PASSKEY_VERIFY_FAILED', 400);
      }
      const list = parsePasskeys(account.passkey);
      const stored = list.find(({ id }) => id === credential.id);
      if (!stored) {
        throw new WalineError('PASSKEY_VERIFY_FAILED', 400);
      }
      try {
        stored.counter = await passkey.verifyAuthentication({
          credential,
          challenge,
          storedCredential: stored,
        });
      } catch {
        throw new WalineError('PASSKEY_VERIFY_FAILED', 400);
      }
      await models.Users.update({ passkey: JSON.stringify(list) }, { objectId: account.objectId });
      return {
        ...account,
        password: undefined,
        passkey: undefined,
        avatar: await avatar(account),
        token: await tokenService.sign(account.objectId),
      };
    },

    async getPasskeys(_input: object, ctx: WalineContext) {
      const user = requireUser(ctx);
      const [account] = await models.Users.select(
        { objectId: user.objectId },
        { field: ['passkey'] },
      );
      return {
        passkeys: parsePasskeys(account?.passkey).map(
          ({ id, name, createdAt, deviceType, backedUp }) => ({
            id,
            name,
            createdAt,
            deviceType,
            backedUp,
          }),
        ),
      };
    },

    async removePasskey(input: { id: string }, ctx: WalineContext) {
      const user = requireUser(ctx);
      const id = requiredString(input.id, 'id');
      const [account] = await models.Users.select(
        { objectId: user.objectId },
        { field: ['passkey'] },
      );
      const list = parsePasskeys(account?.passkey).filter((item) => item.id !== id);
      await models.Users.update({ passkey: JSON.stringify(list) }, { objectId: user.objectId });
      return { ok: true };
    },

    async requestPasswordReset(input: { email: string }, ctx: WalineContext) {
      const [account] = await models.Users.select({
        email: requiredString(input.email, 'email'),
      });

      if (!account) throw new WalineError('USER_NOT_EXIST', 400);

      const notification = requiredCapability(services.notification, 'notification');
      const reset = requiredCapability(
        notification.passwordReset?.bind(notification),
        'notification.passwordReset',
      );
      const tokenService = requiredCapability(services.token, 'token');
      const profileUrl = `${ctx.serverUrl ?? ''}/ui/profile?token=${await tokenService.sign(account.objectId)}`;

      await reset(account, profileUrl);
    },
  };
};
