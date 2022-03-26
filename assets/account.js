const Account = (function () {
  const getUrlParameter = function (name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
  };
  
  const init = function () {
    checkResetPassword();
  };

  const checkResetPassword = function () {
    const isResetPassword = getUrlParameter('reset_pass');
    if (isResetPassword) {
      showInterface('.js-reset-password-div');
      $('.js-sidebar-item').removeClass('site-nav--active');
      $('.js-sidebar-item a[href*="reset_pass"]').parent().addClass('site-nav--active');
      return;
    }
    showInterface('.js-account-content');
  };

  const showInterface = function (selector) {
    $(selector).removeClass('hide');
    $('.js-loading-image').addClass('hide');
  };

  return {
    init: init
  }
})();

Account.init();