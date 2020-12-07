const Product = (function () {
  let minimumQuantity = null;
  let market = null;
  let placeSearch;
  let autocomplete;
  const componentForm = {
    street_number: 'short_name',
    route: 'long_name',
    locality: 'long_name',
    administrative_area_level_1: 'short_name',
    country: 'long_name',
    postal_code: 'short_name',
  };

  const productObject = {};

  const init = function () {
    setEvents();
    initElements();
    initAutocomplete();
  };

  const setEvents = function () {
    $(document)
      .on('click', '.js-product-price-check', checkZipCode)
      .on('change keyup', '.js-zip-code', validateZipCode)
      .on('change', '.js-delivery-method', changeDeliveryForm)
      .on('change', '.js-product-pickup-variants', selectPickupVariant)
      .on('change keyup input', '.js-quantity-input', checkQuantityIncrement)
      .on('change keyup', '.js-autocomplete-address', hideAddToCart)
      .on('focus', '.js-autocomplete-address', geolocate)
      .on('keypress', '.js-product-form input', function (e) {
        const code = e.keyCode || e.which;
        if (code == 13) {
          e.preventDefault();
          return false;
        }
      });
  };

  const initElements = function () {
    $('.js-show-youtube-popup').magnificPopup( { type:'iframe' } );

    const zipCodeElement = $('.js-zip-code');
    if (zipCodeElement.val() !== '') {
      $('.js-delivery-method').trigger('change');
      setTimeout(function () {
        zipCodeElement.trigger('change');
      }, 1000);
    }
  };

  const validateZipCode = function (ev) {
    onlyNumbers(ev);

    const input = ev.target;
    const value = (input.value).trim();
    if (!value || value == '' || value.length < 5) {
      toggleSubmitButton('disable', 'js-product-price-check');
      return;
    }
    checkMinimumQuantity(value);
    toggleSubmitButton('show', 'js-product-price-check');
  };

  const onlyNumbers = function (ev) {
    const input = ev.target;
    const value = (input.value).trim();

    const numberRegex = new RegExp('[^0-9]+');
    const hasNoDigitsCharacters = numberRegex.test(value);
    if (hasNoDigitsCharacters) {
      input.value = value.replace(numberRegex, '');
      return;
    }
  };

  const checkMinimumQuantity = function (zip) {
    const ajax = $.ajax({
      type: 'GET',
      url: theme.routes.validation_tool_url + 'zone_market_info',
      data: {
        shop_domain: theme.routes.validation_tool_shop,
        zipcode: zip
      },
      timeout: 3000
    });
    ajax.done(function (data) {
      if (
        typeof data !== 'undefined' &&
        typeof data.min_sod_quantity !== 'undefined'
      ) {
        minimumQuantity = data.min_sod_quantity;
        $('.js-quantity-input-delivery').val(minimumQuantity);
        $('.js-delivery-method').trigger('change');
      }
    });
  };

  const checkZipCode = function (ev) {
    const input = $('.js-zip-code')[0];
    const zipCode = (input.value).trim();
    if (!zipCode || zipCode == '' || zipCode.length < 5) {
      toggleSubmitButton('disable');
      return;
    }

    checkProductAvailability(zipCode, $(ev.target));
  };

  const checkProductAvailability = function (zipCode, button) {
    const originalText = button.html();
    const deliveryMethod = $('.js-delivery-method:checked').val();
    const ajaxData = {
      latitude: $('.js-address-latitude').val(),
      longitude: $('.js-address-longitude').val(),
      product_id: productData.id,
      quantity: $('.js-product-quantity').val(),
      shop_domain: theme.routes.validation_tool_shop,
      unit_price: $('.js-product-variants option:selected').data('price-val'),
      zipcode: zipCode
    };
    const endpoint = deliveryMethod === 'pickup' ? 'nearest_locations' : 'pricing_info';

    button.html('Checking ...');
    $('.js-current-price-unit').html('');
    toggleSubmitButton('disable');

    const ajax = $.ajax({
      type: 'GET',
      url: theme.routes.validation_tool_url + endpoint,
      data: ajaxData,
      timeout: 3000
    });
    ajax.done(function (data) {
      if (typeof data.error !== 'undefined') {
        button.html(originalText);
        availiabilityError({zipCode: zipCode});
        return;
      }

      data.fulfillment = deliveryMethod;
      button.html(originalText);
      updateForm(zipCode);
      toggleSubmitButton('show');
      showButtonMessage(deliveryMethod);
      $('.js-delivery-method').trigger('change');
      $('.js-not-available-text').addClass('hide');

      if (deliveryMethod === 'pickup') {
        enableNearestLocations(typeof data.nearest_locations !== 'undefined' ? data.nearest_locations : null);
        $('.js-product-pickup-variants').trigger('change');
        const totalPrice = $('.js-product-variants option:selected').data('price-val') * $('.js-product-quantity').val();
        showProductPricing({
          additional_miles_cost: 0,
          fulfillment: 'pickup',
          total_price: totalPrice
        });
      } else if (deliveryMethod === 'delivery') {
        chooseVariant('delivery');
        showProductPricing(data);
      }
    }).fail(function () {
      button.html(originalText);
      availiabilityError({zipCode: zipCode});
      toggleSubmitButton('show');
    });
  };

  const showButtonMessage = function (deliveryMethod) {
    const submitButtonTextDelivery = $('.js-add-to-cart-text-delivery');
    const submitButtonTextPickup = $('.js-add-to-cart-text-pickup');
    submitButtonTextDelivery.addClass('hide');
    submitButtonTextPickup.addClass('hide');

    console.log(submitButtonTextDelivery)

    if (deliveryMethod === 'delivery') {
      submitButtonTextDelivery.removeClass('hide');
    } else if (deliveryMethod === 'pickup') {
      submitButtonTextPickup.removeClass('hide');
    }
  };

  const availiabilityError = function (data) {
    updateForm(data.zipCode);
    showProductPricing();
    hideFormElements();
    toggleSubmitButton('show', 'js-product-price-check');
    $('.js-delivery-method').trigger('change');
  };

  const enableNearestLocations = function (data) {
    $('.js-product-pickup-variants-title').removeClass('hide');
    const deliveryOption = $('.js-delivery-method:checked').val();

    if (deliveryOption !== 'pickup') {
      return;
    }

    const dropdown = $('.js-product-pickup-variants');
    dropdown.html('');
    chooseVariant('pickup');
    if (data != null && typeof data !== 'undefined') {
      const options = data.reduce(function (acc, customLocation) {
        return acc + '<option value="' + customLocation + '">' + customLocation + '</option>';
      }, '');
      dropdown.html(options);
    }
    dropdown.removeClass('hide');
  };

  const showProductPricing = function (data) {
    const priceElement = $('.js-current-price-unit');

    if (
      data == null ||
      typeof data === 'undefined' ||
      typeof data.additional_miles_cost === 'undefined'
    ) {
      priceElement.html('');
      priceElement.addClass('hide');
      return;
    }

    const type = data.fulfillment == 'delivery' ? 'Delivered' : 'Pickup';
    productObject.fullPrice = data.total_price * 100;
    $('.js-custom-value').val(productObject.fullPrice / 100);
    priceElement.html(type + ' price: ' + Shopify.formatMoney(productObject.fullPrice, theme.money_format));
    priceElement.removeClass('hide');
  };

  const changeDeliveryForm = function (ev) {
    const input = ev.target;
    if (!input.checked) {
      return;
    }

    changeDeliveryElements(input);
    const zipCode = $('.js-zip-code').val();
    if (zipCode == '' || zipCode == null) {
      return;
    }
    chooseVariant(input.value);
  };

  const hideSubmitButton = function () {
    toggleSubmitButton('disable');
    const priceElement = $('.js-current-price-unit');
    priceElement.html('');
    priceElement.addClass('hide');
  };

  const chooseVariant = function (value) {
    const variants = getVariants();
    const foundVariant = variants.filter(function (variant) {
      return variant.text.indexOf(value) > -1;
    });
    changeDropdownOptions(foundVariant.length > 0 ? foundVariant[0].id : null);
  };

  const changeDeliveryElements = function (input) {
    $('.js-quantity-block').addClass('hide');
    $('.js-quantity-input').prop('disabled', true);
    $('.js-quantity-input-' + (input.value)).removeAttr('disabled');
    $('.js-' + (input.value) + '-quantity-block').removeClass('hide');
    $('.js-product-quantity').val( $('.js-quantity-input-' + (input.value)).val() );

    if (input.value === 'delivery' && minimumQuantity != null) {
      $('.js-quantity-input-' + (input.value)).prop('min', minimumQuantity);
    }

    $('.js-quantity-input-' + (input.value)).trigger('change');
    $('.js-increment-value').val( $('.js-quantity-input-' + (input.value)).prop('min') );
  };

  const checkQuantityIncrement = function (ev) {
    const input = ev.target;
    const value = parseInt(input.value);
    const increment = parseInt(input.getAttribute('step'));
    const minimum = parseInt(input.getAttribute('min'));
    const wrongQuantityText = $('.js-wrong-quantity');
    const wrongMinimumQuantityText = $('.js-wrong-min-quantity');
    const deliveryMethodInput = $('.js-delivery-method:checked');

    if (ev.type === 'keyup' || ev.type === 'input') {
      hideSubmitButton();
    }

    wrongQuantityText.addClass('hide');
    wrongMinimumQuantityText.addClass('hide');
    $('.js-not-available-text').addClass('hide');

    if (value < 0) {
      $('.js-product-quantity').val(0);
      toggleSubmitButton('disable');
      return;
    } else if (deliveryMethodInput.val() == 'delivery' && value < minimum) {
      $('.js-min-number').html(minimum);
      wrongMinimumQuantityText.removeClass('hide');
      toggleSubmitButton('disable');
      return;
    } else if (value % increment !== 0) {
      $('.js-product-quantity').val(0);
      $('.js-multiple-number').html(increment);
      wrongQuantityText.removeClass('hide');
      toggleSubmitButton('disable');
      return;
    }

    $('.js-product-quantity').val(value);
    const zipCode = (document.querySelector('.js-zip-code').value).trim();
    if (!zipCode || zipCode == '' || zipCode.length < 5) {
      toggleSubmitButton('disable');
      return;
    }
    toggleSubmitButton('enable');
  };

  const toggleSubmitButton = function (action, customSelector) {
    let buttons = document.getElementsByClassName('js-product-submit');

    if (typeof customSelector !== 'undefined') {
      buttons = document.getElementsByClassName(customSelector);
    }
    if (typeof buttons === 'undefined' || buttons.length < 1) {
      return;
    }

    const button = buttons[0];
    switch (action) {
      case 'enable':
        button.removeAttribute('disabled');
        break;
      case 'disable':
        button.setAttribute('disabled', true);
        button.classList.add('hide');
        break;
      case 'show':
        button.removeAttribute('disabled', true);
        button.classList.remove('hide');
        break;

      default:
        if (button.getAttribute('disabled')) {
          button.removeAttribute('disabled');
          break;
        }
        button.setAttribute('disabled', true);
        button.classList.add('hide');
        break;
    }
  };

  const addToCartParameters = function (parameter, value) {
    if (typeof parameter === 'object') {
      for (let i = 0; i < parameter.length; i++) {
        const element = parameter[i];
        cartAttributes[element.parameter] = element.value;
      }
    } else {
      cartAttributes[parameter] = value;
    }

    const cartData = {
      attributes: cartAttributes
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
      let zips = [];
      const dataZips = option.getAttribute('data-sod-zips');
      if (typeof dataZips !== 'undefined' && dataZips !== null) {
        zips = dataZips.split(',');
      }
      return {
        id: option.value,
        index: index,
        price: option.getAttribute('data-price'),
        priceValue: option.getAttribute('data-price-val'),
        text: option.text,
        zips: zips
      };
    });
  };

  const updateForm = function (zipCode) {
    const deliveryMethodInput = $('.js-delivery-method')[0];
    changeDeliveryElements(deliveryMethodInput);

    let parameters = [];
    parameters.push({parameter: 'zip_code', value: zipCode});
    parameters.push({parameter: 'delivery_method', value: deliveryMethodInput.value});
    parameters.push({parameter: 'customer_address', value: $('.js-autocomplete-address').val()});
    if (typeof parameters === 'object' && parameters.length > 1) {
      addToCartParameters(parameters);
    }
  };

  const selectPickupVariant = function (ev) {
    const select = ev.target;
    const selectedVariant = select.value;
    const variants = getVariants();
    const foundVariant = variants.filter(function (variant) {
      return selectedVariant.indexOf(variant.text) > -1;
    });

    if (foundVariant.length > 0) {
      const fullValue = foundVariant[0].priceValue * $('.js-product-quantity').val();
      selectVariant(foundVariant[0]);
      showProductPricing({additional_miles_cost: 0, fulfillment: 'pickup', total_price: fullValue})
    }
  };

  const selectVariant = function (variant) {
    $('.js-not-available-text').addClass('hide');
    $('.js-product-variants').val(variant.id);
    productObject.variantId = variant.id;
    toggleSubmitButton('enable');
  };

  const changeDropdownOptions = function (id) {
    const deliveryOption = $('.js-delivery-method:checked').val();

    if (deliveryOption === 'pickup' && id != null) {
      let found = 0;
      $('.js-product-variants option').each(function (i, option) {
        if (option.value != id) {
          option.setAttribute('disabled', true);
          option.removeAttribute('selected');
          return;
        }
        option.removeAttribute('disabled');
        option.setAttribute('selected', true);
        found++;
      });

      if (found === 0) {
        changeDropdownOptions(null);
        return;
      }
      $('.js-product-variants').show();
      return;
    } else if (deliveryOption === 'pickup') {
      $('.js-product-variants').show();
    } else if (deliveryOption === 'delivery') {
      $('.js-product-variants').hide();
    }

    $('.js-product-variants option').each(function (i, option) {
      option.removeAttribute('disabled');
    });
  };

  const hideFormElements = function () {
    $('.js-not-available-text').removeClass('hide');
    toggleSubmitButton('disable');
  };

  const initAutocomplete = function () {
    if (typeof google === 'undefined') {
      return;
    }

    autocomplete = new google.maps.places.Autocomplete(
      document.getElementsByClassName('js-autocomplete-address')[0],
      {
        types: ['geocode'],
        componentRestrictions: {country: 'us'}
      }
    );

    autocomplete.setFields(['address_component', 'geometry']);
    autocomplete.addListener('place_changed', fillInAddress);
  };

  const fillInAddress = function () {
    const place = autocomplete.getPlace();
    let parameters = [];

    for (const component in componentForm) {
      if (!document.getElementById(component)) {
        continue;
      }
      document.getElementById(component).value = '';
      document.getElementById(component).disabled = false;
    }

    if (typeof place.geometry !== 'undefined') {
      productObject.geometry = {
        latitude: place.geometry.location.lat(),
        longitude: place.geometry.location.lng()
      };
      $('.js-address-latitude').val(productObject.geometry.latitude);
      $('.js-address-longitude').val(productObject.geometry.longitude);
      parameters.push({parameter: 'customer_latitude', value: productObject.geometry.latitude});
      parameters.push({parameter: 'customer_longitude', value: productObject.geometry.longitude});
      parameters.push({parameter: 'customer_address', value: $('.js-autocomplete-address').val()});
    }

    for (const component of place.address_components) {
      const addressType = component.types[0];

      if (document.getElementById(addressType) && componentForm[addressType]) {
        const val = component[componentForm[addressType]];
        document.getElementById(addressType).value = val;
        $('#' + addressType).trigger('change');
        if (addressType === 'postal_code') {
          parameters.push({parameter: 'zip_code', value: val});
        }
      }
    }

    if (typeof parameters === 'object' && parameters.length > 1) {
      addToCartParameters(parameters);
    }
  };

  const geolocate = function () {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function (position) {
        const geolocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        if (typeof google === 'undefined') {
          return;
        }
        const circle = new google.maps.Circle({
          center: geolocation,
          radius: position.coords.accuracy,
        });
        autocomplete.setBounds(circle.getBounds());
        $('.js-address-latitude').val(position.coords.latitude);
        $('.js-address-longitude').val(position.coords.longitude);
      });
    }
  };

  const hideAddToCart = function () {
    $('.js-quantity-input').trigger('keyup');
  };

  return {
    init: init
  }
})();

Product.init();