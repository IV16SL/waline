const crypto = require('node:crypto');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

// Challenge is sealed into an HMAC-signed, self-contained token so the
// serverless deployment needs no shared session storage.
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

const b64u = (buf) => Buffer.from(buf).toString('base64url');

function getRpConfig(fallbackOrigin = '') {
  // PASSKEY_* env > SITE_URL > requesting origin (WebAuthn requires rpID to
  // match the domain the browser is on, so the request origin is a valid fallback)
  const siteUrl = process.env.SITE_URL || fallbackOrigin || '';
  let hostname = '';
  try {
    hostname = siteUrl ? new URL(siteUrl).hostname : '';
  } catch {
    hostname = '';
  }
  return {
    rpName: process.env.PASSKEY_RP_NAME || 'Waline',
    rpID: process.env.PASSKEY_RP_ID || hostname,
    origin: process.env.PASSKEY_ORIGIN || siteUrl,
  };
}

function assertRpConfig({ rpID, origin }) {
  if (!rpID || !origin) {
    throw new Error(
      'Passkey is not configured: set SITE_URL (or PASSKEY_RP_ID / PASSKEY_ORIGIN) environment variable',
    );
  }
}

module.exports = function createPasskeyService({ jwtKey }) {
  const sealKey = jwtKey
    ? crypto.createHmac('sha256', String(jwtKey)).update('waline:passkey-challenge:v1').digest()
    : null;

  const seal = (payload) => {
    if (!sealKey) throw new Error('PASSKEY_NO_JWT_SECRET');
    const body = b64u(JSON.stringify({ ...payload, exp: Date.now() + CHALLENGE_TTL_MS }));
    const sig = b64u(crypto.createHmac('sha256', sealKey).update(body).digest());
    return body + '.' + sig;
  };

  const unseal = (state, action) => {
    if (!sealKey) throw new Error('PASSKEY_NO_JWT_SECRET');
    const parts = String(state || '').split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error('PASSKEY_BAD_CHALLENGE');
    const [body, sig] = parts;
    const expected = b64u(crypto.createHmac('sha256', sealKey).update(body).digest());
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new Error('PASSKEY_BAD_CHALLENGE');
    }
    let payload;
    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    } catch {
      throw new Error('PASSKEY_BAD_CHALLENGE');
    }
    if (
      !payload ||
      payload.action !== action ||
      typeof payload.exp !== 'number' ||
      Date.now() > payload.exp ||
      typeof payload.challenge !== 'string'
    ) {
      throw new Error('PASSKEY_BAD_CHALLENGE');
    }
    return payload;
  };

  return {
    async getRegistrationOptions({ userId, userName, displayName, excludeCredentialIds, origin: reqOrigin }) {
      const { rpID, rpName, origin } = getRpConfig(reqOrigin);
      assertRpConfig({ rpID, origin });
      const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userName,
        userID: new TextEncoder().encode(String(userId)),
        userDisplayName: displayName || userName,
        attestationType: 'none',
        excludeCredentials: (excludeCredentialIds || []).map((id) => ({ id })),
        authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
      });
      return { options, state: seal({ action: 'register', userId, challenge: options.challenge }) };
    },

    async verifyRegistration({ credential, state, userId, origin: reqOrigin }) {
      const { rpID, origin } = getRpConfig(reqOrigin);
      assertRpConfig({ rpID, origin });
      const { challenge, userId: sealedUserId } = unseal(state, 'register');
      if (String(sealedUserId) !== String(userId)) throw new Error('PASSKEY_BAD_CHALLENGE');
      const { verified, registrationInfo } = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });
      if (!verified || !registrationInfo) throw new Error('PASSKEY_REGISTER_FAILED');
      const { credential: cred, credentialDeviceType, credentialBackedUp } = registrationInfo;
      return {
        id: cred.id,
        publicKey: b64u(cred.publicKey),
        counter: cred.counter,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: cred.transports || [],
      };
    },

    async getAuthenticationOptions({ allowCredentialIds, email, origin: reqOrigin }) {
      const { rpID, origin } = getRpConfig(reqOrigin);
      assertRpConfig({ rpID, origin });
      const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: (allowCredentialIds || []).map((id) => ({ id })),
        userVerification: 'preferred',
      });
      const sealed = { action: 'auth', challenge: options.challenge };
      if (email) sealed.email = email;
      return { options, state: seal(sealed) };
    },

    peekAuthState(state) {
      const { challenge, email } = unseal(state, 'auth');
      return { challenge, email };
    },

    decodeUserHandle(userHandle) {
      if (!userHandle || typeof userHandle !== 'string') {
        throw new Error('PASSKEY_BAD_CHALLENGE');
      }
      return Buffer.from(userHandle, 'base64url').toString('utf8');
    },

    async verifyAuthentication({ credential, challenge, storedCredential, origin: reqOrigin }) {
      const { rpID, origin } = getRpConfig(reqOrigin);
      assertRpConfig({ rpID, origin });
      const { verified, authenticationInfo } = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: storedCredential.id,
          publicKey: new Uint8Array(Buffer.from(storedCredential.publicKey, 'base64url')),
          counter: storedCredential.counter,
          transports: storedCredential.transports,
        },
      });
      if (!verified || !authenticationInfo) throw new Error('PASSKEY_VERIFY_FAILED');
      return authenticationInfo.newCounter;
    },
  };
};
