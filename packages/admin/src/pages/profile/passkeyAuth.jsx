import { startRegistration } from '@simplewebauthn/browser';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  getPasskeyRegisterOptions,
  getPasskeys,
  registerPasskey,
  removePasskey,
} from '../../services/auth.js';

export default function PasskeyAuth() {
  const { t } = useTranslation();
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    try {
      const { passkeys } = await getPasskeys();
      setKeys(Array.isArray(passkeys) ? passkeys : []);
    } catch {
      // passkey table column may not exist yet; keep the section usable
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const onRegister = async () => {
    setLoading(true);
    try {
      const { options, state } = await getPasskeyRegisterOptions();
      const credential = await startRegistration({ optionsJSON: options });
      await registerPasskey({ state, credential });
      await refresh();
    } catch (err) {
      alert(err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  const onRemove = async (id) => {
    if (!confirm(t('confirm remove passkey'))) {
      return;
    }
    try {
      await removePasskey(id);
      await refresh();
    } catch (err) {
      alert(err?.message || err);
    }
  };

  return (
    <section id="passkey-auth">
      <h3>{t('passkey')}</h3>
      {keys.length > 0 ? (
        <ul>
          {keys.map((key) => (
            <li key={key.id}>
              {key.name || t('passkey')}
              {key.createdAt ? <span className="description"> ({key.createdAt})</span> : null}
              <button
                className="btn"
                type="button"
                style={{ marginLeft: '8px' }}
                onClick={() => onRemove(key.id)}
              >
                {t('remove passkey')}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="description">{t('no passkey registered')}</p>
      )}
      <button className="btn primary" type="button" onClick={onRegister} disabled={loading}>
        {t('register passkey')}
      </button>
    </section>
  );
}
