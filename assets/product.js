const Product = (function () {
  const init = function () {
    setEvents();
  };

  const setEvents = function () {
    $(document).on('change', '.js-zip-code', checkZipCode);
    $('.js-show-youtube-popup').magnificPopup( { type:'iframe' } );
  };

  const checkZipCode = function (ev) {
    const input = ev.target;
    const zipCode = (input.value).trim();
    if (!zipCode || zipCode == '') {
      return;
    }
    const select = document.querySelector('.js-product-variants');
    const zipCodes = [].slice.call(select.options).map(function (option, index) {
      return {
        id: option.value,
        index: index,
        price: option.getAttribute('data-price'),
        zips: option.getAttribute('data-sod-zips').split(',')
      };
    });
    const foundVariant = zipCodes.filter(function (zip) {
      return zip.zips.indexOf(zipCode) > -1;
    });
    if (foundVariant.length > 0) {
      $('.js-not-available-text').addClass('hide');
      $('.js-product-variants').val(foundVariant[0].id);
      $('.js-current-price')
        .removeClass('hide')
        .html(foundVariant[0].price);
      $('.js-current-price-text').addClass('hide');
      document.querySelector('.js-product-submit').removeAttribute('disabled');
      return;
    }
    $('.js-current-price')
      .addClass('hide')
      .html('');
    $('.js-current-price-text').removeClass('hide');
    $('.js-not-available-text').removeClass('hide');
    document.querySelector('.js-product-submit').setAttribute('disabled', true);
  };

  return {
    init: init
  }
})();

Product.init();