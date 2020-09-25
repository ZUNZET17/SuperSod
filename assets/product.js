const Product = (function () {
  let minimumQuantity = null;
  let market = null;

  const init = function () {
    setEvents();
    initElements();
  };

  const setEvents = function () {
    $(document)
      .on('change keyup', '.js-zip-code', checkZipCode)
      .on('change', '.js-delivery-method', changeDeliveryForm)
      .on('change keyup', '.js-quantity-input', checkQuantityIncrement);
  };

  const initElements = function () {
    $('.js-show-youtube-popup').magnificPopup( { type:'iframe' } );

    const zipCodeElement = $('.js-zip-code');
    if (zipCodeElement.val() !== '') {
      setTimeout(function () {
        zipCodeElement.trigger('change');
      }, 1000);
    }
  };

  const checkZipCode = function (ev) {
    const input = ev.target;
    const zipCode = (input.value).trim();
    if (!zipCode || zipCode == '' || zipCode.length < 5) {
      toggleSubmitButton('disable');
      return;
    }

    const numberRegex = new RegExp('[^0-9]+');
    const hasNoDigitsCharacters = numberRegex.test(zipCode);
    if (hasNoDigitsCharacters) {
      input.value = zipCode.replace(numberRegex, '');
      return;
    }

    checkProductAvailability(zipCode);
  };

  const changeDeliveryForm = function (ev) {
    const input = ev.target;
    if (!input.checked) {
      return;
    }

    changeDeliveryElements(input);
  };

  const changeDeliveryElements = function (input) {
    $('.js-quantity-block').addClass('hide');
    $('.js-quantity-input').prop('disabled', true);
    $('.js-quantity-input-' + (input.value)).removeAttr('disabled');
    $('.js-' + (input.value) + '-quantity-block').removeClass('hide');
    $('.js-product-quantity').val( $('.js-quantity-input-' + (input.value)).val() );

    if (minimumQuantity != null && input.value == 'delivery') {
      $('.js-quantity-input-' + (input.value)).prop('step', minimumQuantity);
      $('.js-quantity-input-' + (input.value)).prop('min', minimumQuantity);
    }
    $('.js-quantity-input-' + (input.value)).trigger('keyup');
  };

  const checkQuantityIncrement = function (ev) {
    const input = ev.target;
    const value = parseInt(input.value);
    const increment = parseInt(input.getAttribute('step'));
    const wrongQuantityText = $('.js-wrong-quantity');

    if (value <= 0 || value % increment !== 0) {
      $('.js-product-quantity').val(0);
      wrongQuantityText.removeClass('hide');
      $('.js-multiple-number').html(increment);
      toggleSubmitButton('disable');
      return;
    }

    wrongQuantityText.addClass('hide');
    $('.js-product-quantity').val(value);

    const zipCode = (document.querySelector('.js-zip-code').value).trim();
    if (!zipCode || zipCode == '' || zipCode.length < 5) {
      toggleSubmitButton('disable');
      return;
    }
    toggleSubmitButton('enable');
  };

  const toggleSubmitButton = function (action) {
    const button = document.getElementsByClassName('js-product-submit')[0];
    if (typeof button === 'undefined' || !button) {
      return;
    }

    switch (action) {
      case 'enable':
        button.removeAttribute('disabled');
        break;
      case 'disable':
        button.setAttribute('disabled', true);
        break;
    
      default:
        if (button.getAttribute('disabled')) {
          button.removeAttribute('disabled');
          break;
        }
        button.setAttribute('disabled', true);
        break;
    }
  };

  const addToCartParameters = function (parameter, value) {
    const cartData = {
      attributes: JSON.parse('{"' + parameter + '": "' + value + '"}')
    };
    return $.ajax({
      type: 'POST',
      url: '/cart/update.js',
      dataType: 'json',
      data: cartData
    });
  };

  const getVariants = function () {
    const select = document.querySelector('.js-product-variants');
    return [].slice.call(select.options).map(function (option, index) {
      return {
        id: option.value,
        index: index,
        price: option.getAttribute('data-price'),
        text: option.text,
        zips: option.getAttribute('data-sod-zips').split(',')
      };
    });
  };

  const updateForm = function (zipCode) {
    const zipCodes = getVariants();
    const foundVariant = zipCodes.filter(function (zip) {
      return zip.zips.indexOf(zipCode) > -1;
    });

    if (foundVariant.length > 0) {
      selectVariant(foundVariant[0]);
      changeDeliveryElements($('.js-delivery-method')[0]);
      addToCartParameters('zip_code', zipCode);
      return;
    }

    lookForMarketVariant(zipCode);
  };

  const lookForMarketVariant = function (zipCode) {
    if (market === null || market === '') {
      hideFormElements();
      changeDeliveryElements($('.js-delivery-method')[0]);
      return;
    }
  
    const variants = getVariants();
    const foundVariant = variants.filter(function (variant) {
      return variant.text.indexOf(market) > -1;
    });
    if (foundVariant.length > 0) {
      selectVariant(foundVariant[0]);
      changeDeliveryElements($('.js-delivery-method')[0]);
      addToCartParameters('zip_code', zipCode);
      return;
    }

    hideFormElements();
    changeDeliveryElements($('.js-delivery-method')[0]);
  };

  const selectVariant = function (variant) {
    $('.js-not-available-text').addClass('hide');
    $('.js-product-variants').val(variant.id);
    $('.js-current-price')
      .removeClass('hide')
      .html(variant.price);
    $('.js-current-price-unit').removeClass('hide');
    toggleSubmitButton('enable');
  };

  const hideFormElements = function () {
    $('.js-current-price')
      .addClass('hide')
      .html('');
    $('.js-current-price-unit').addClass('hide');
    $('.js-not-available-text').removeClass('hide');
    toggleSubmitButton('disable');
  };

  const checkProductAvailability = function (zipCode) {
    const ajax = $.ajax({
      type: 'GET',
      url: theme.routes.validation_tool_url + 'zone_market_info',
      data: {
        zipcode: zipCode,
        shop_domain: theme.routes.validation_tool_shop
      },
      timeout: 3000
    });
    ajax.done(function (data) {
      if (
        typeof data.min_sod_quantity !== 'undefined' &&
        data.min_sod_quantity > 0
      ) {
        minimumQuantity = data.min_sod_quantity;
      }
      if (typeof data.zone_market !== 'undefined') {
        market = data.zone_market;
      }
      updateForm(zipCode);
      $('.js-delivery-method').trigger('change');
    }).fail(function () {
      updateForm(zipCode);
    });
  };

  return {
    init: init
  }
})();

Product.init();