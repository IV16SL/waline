import request from '../utils/request.js';

export const login = ({ email, password, code, recaptchaV3, turnstile }) =>
  request({
    url: 'token',
    method: 'POST',
    body: { email, password, code, recaptchaV3, turnstile },
  });

export const logout = () => {
  window.TOKEN = null;
  sessionStorage.removeItem('TOKEN');
  localStorage.removeItem('TOKEN');
};

export const register = (user) => request({ url: 'user', method: 'POST', body: user });

export const forgot = ({ email }) =>
  request({
    url: 'user/password',
    method: 'PUT',
    body: { email },
  });

export const getUserInfo = () =>
  request('token').catch(() => {
    logout();
    Promise.reject(new Error('get userinfo failed'));
  });

export const getPasskeyRegisterOptions = () =>
  request({ url: 'token/passkey?action=register-options', method: 'GET' });

export const registerPasskey = (data) =>
  request({ url: 'token/passkey', method: 'POST', body: { action: 'register', ...data } });

export const getPasskeyAuthOptions = (email) =>
  request({
    url: `token/passkey?action=auth-options&email=${encodeURIComponent(email)}`,
    method: 'GET',
  });

export const verifyPasskeyLogin = (data) =>
  request({ url: 'token/passkey', method: 'POST', body: { action: 'verify', ...data } });

export const getPasskeys = () =>
  request({ url: 'token/passkey?action=status', method: 'GET' });

export const removePasskey = (id) =>
  request({ url: 'token/passkey', method: 'POST', body: { action: 'remove', id } });
