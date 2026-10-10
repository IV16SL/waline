const BaseRest = require('../rest.js');
const { WalineError } = require('@waline/core');

module.exports = class extends BaseRest {
  getAction() {
    const { action, email } = this.get();

    return this.runCore((core, ctx) => {
      switch (action) {
        case 'register-options':
          return core.auth.getPasskeyRegisterOptions({}, ctx);
        case 'auth-options':
          return core.auth.getPasskeyAuthOptions({ email }, ctx);
        case 'status':
          return core.auth.getPasskeys({}, ctx);
        default:
          throw new WalineError('PARAM_ERROR', 400);
      }
    });
  }

  postAction() {
    const { action, ...rest } = this.post();

    return this.runCore((core, ctx) => {
      switch (action) {
        case 'register':
          return core.auth.verifyPasskeyRegistration(rest, ctx);
        case 'verify':
          return core.auth.verifyPasskeyLogin(rest, ctx);
        case 'remove':
          return core.auth.removePasskey(rest, ctx);
        default:
          throw new WalineError('PARAM_ERROR', 400);
      }
    });
  }
};
