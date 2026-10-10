const Base = require('../base.js');

module.exports = class extends Base {
  async getAction() {
    const { action } = this.get();
    const { userInfo } = this.ctx.state;

    // auth-options is public (login page, email-based); others require login
    if (think.isEmpty(userInfo) && action !== 'auth-options') {
      return this.fail(401);
    }
  }

  async postAction() {
    const { action } = this.post();
    const { userInfo } = this.ctx.state;

    // verify is the login itself (public); register/remove require login
    if (think.isEmpty(userInfo) && action !== 'verify') {
      return this.fail(401);
    }
  }
};
