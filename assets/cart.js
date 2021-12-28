const Cart = (function () {
  let availableDates = [];
  let chosenDates = [];
  let calendarHandles = [];
  let firstTime = true;

  const initDatePicker = function (dates) {
    for (let index = 0; index < 3; index++) {
      const fieldSelector = '.js-tail-datetime-field-' + (index + 1);
      applyDatePickerConfig(fieldSelector, dates, index);
    }
  };

  const applyDatePickerConfig = function (fieldSelector, dates, index) {
    $(fieldSelector).Zebra_DatePicker({
      direction: true,
      disabled_dates: ['* * *'],
      enabled_dates: dates,
      format: 'Y-m-d',
      onSelect: function(chosenDate) {
        const newDates = dates.filter(function (date) {
          return date !== chosenDate;
        });

        for (let i = 0; i < 3; i++) {
          if (i !== index) {
            const element = $(fieldSelector).data('Zebra_DatePicker');
            element.update({
              enabled_dates: newDates
            });
          }
        }
      }
    });
  };

  const updateCalendars = function (index) {
    for (let i = 0; i < calendarHandles.length; i++) {
      if (i !== index && chosenDates.length < 1) {
        const dateField = $('.js-tail-datetime-field-' + (i + 1));
        dateField.val('');
        dateField.data('value', '');
      }
    }

    updateChosenDates();
    const filtered = availableDates.filter(function (date) {
      return chosenDates.indexOf(date) < 0;
    }).map(function (date) {
      return {
        days: ['TUE', 'WED', 'THU', 'FRI', 'SAT'],
        end: date,
        start: date
      };
    });

    for (let i = 0; i < calendarHandles.length; i++) {
      if (i === index) {
        continue;
      }

      const element = calendarHandles[i];
      element.config('dateRanges', filtered);
      element.reload();
    }
  };

  const updateOtherCalendars = function () {
    if (!firstTime) {
      updateChosenDates();
      firstTime = false;
      return;
    }
  };

  const updateChosenDates = function () {
    chosenDates = [];
    for (let i = 0; i < 3; i++) {
      const input = $('.js-tail-datetime-field-' + (i + 1));
      if (input.val()) {
        const date = Utils.dateStringToMilliseconds(input.val() + ' 00:00:00');
        chosenDates.push(date);
      }
    }
  };

  const searchAvailableDates = function (ev) {
    const input = $(ev.target);
    const button = $('.js-checking-dates');
    if (typeof hasCustomPricing === 'undefined') {
      return;
    }

    $('.js-delivery-empty').addClass('hide');

    const noDatesInfo = $('.js-no-dates');
    const originalText = button.html();
    const endpoint = 'available_dates';
    const addedValue = parseFloat(input.data('price'));
    const firstZip = Utils.extractZip(typeof firstZipAddress !== 'undefined' ? firstZipAddress : '');
    let ajaxZip = cartZipCode !== '' ? cartZipCode : (typeof firstZip !== 'undefined' ? firstZip : '');
    if (cartDeliveryMethod === 'pickup') {
      ajaxZip = (typeof firstZip !== 'undefined' ? firstZip : '');
    }
    let ajaxData = 'type_delivery_pickup=' + input.val() +
      '&shop_domain=' + theme.routes.validation_tool_shop +
      '&zipcode=' + ajaxZip;

    for (let i = 0; i < cartItems.length; i++) {
      ajaxData += '&products[]shopify_product_id=' + cartItems[i].product_id;
    }

    button.html('Checking ...');
    noDatesInfo.addClass('hide');
    const ajax = $.ajax({
      type: 'GET',
      url: theme.routes.validation_tool_url + endpoint,
      data: ajaxData,
      timeout: 5000
    });
    ajax.done(function (data) {
      if (!data || typeof data.available_dates === 'undefined') {
        button.html(originalText);
        noDatesInfo.removeClass('hide');
        return;
      }
      for (let index = 0; index < data.available_dates.length; index++) {
        if (typeof data.available_dates[index] !== 'undefined') {
          const modifiedDate = data.available_dates[index].replace(/T.+/g, '');
          const milliseconds = Utils.dateStringToMilliseconds(modifiedDate + ' 00:00:00');
          availableDates.push(milliseconds);
        }
      }

      const dates = datesWithoutHour(data.available_dates);
      initDatePicker(dates);
      button.html(originalText);
      $('.js-go-to-checkout').prop('disabled', false);
      $('.js-submit-button').prop('disabled', false);
      const subtotalElement = $('.js-cart-subtotal');
      const subtotal = parseFloat(subtotalElement.data('value')) + addedValue;
      const formattedSubtotal =
        typeof Shopify.formatMoney !== 'undefined'
          ? Shopify.formatMoney(subtotal)
          : Utils.formatMoneyWithPrecision(subtotal);
      subtotalElement.html( formattedSubtotal );
    }).fail(function () {
      button.html(originalText);
      noDatesInfo.removeClass('hide');
    });
  };

  const getDateRangesMilliseconds = function (dates) {
    return dates.map(function (date) {
      const modifiedDate = date.replace(/T.+/g, '');
      const milliseconds = Utils.dateStringToMilliseconds(modifiedDate + ' 00:00:00');
      return {
        days: true,
        end: milliseconds,
        start: milliseconds
      };
    });
  };

  const datesWithoutHour = function (dates) {
    return dates.map(function (date) {
      return date.replace(/T.+/g, '').split('-').reverse().join(' ');
    });
  };


  const validationItems = function () {
    var sodLawnValidation = false;

    for (var i=0; i < cartItems.length; i++) {
      if (cartItems[i].product_type && isLawnPlanted) {;
        sodLawnValidation = true;
      }
    }

    if (sodLawnValidation) {
      $('.js-open-validation-modal').trigger('click');
      $('.js-go-to-checkout').prop('disabled', 1);
    }
    return sodLawnValidation;
  }

  const validateCheckout = function (ev) {
    removeInvalidBundleProducts(function () {
      validateCheckoutProcess(ev);
    });
  };


  const validateCheckoutProcess = function (ev) {
    $('.js-dates-invalid').addClass('hide');
    $('.js-dates-empty').addClass('hide');
    $('.js-dates-same').addClass('hide');
    $('.js-no-response').addClass('hide');
    $('.js-delivery-empty').addClass('hide');

    const button = $(ev.target);
    const originalText = button.html();

    button.html('Checking ...');
    let dates = document.querySelectorAll('input[class*="js-tail-datetime-field-"]');
    let radioGroup = $('.js-delivery-type:checked');
    dates = Array.prototype.slice.call(dates);
    const filledDates = dates.length;
    const validIndexes = [true, true, true];

    for (let i = 0; i < validIndexes.length; i++) {
      $('.js-tail-datetime-field-' + (i + 1)).removeClass('form__input--date-missing');
    }

    let containsEmpty = false;
    dates = dates.map(function (input) {
      return input.value;
    }).filter(function (value, index, self) {
      if (self.indexOf(value) !== index || value === '') {
        validIndexes[index] = false;
        containsEmpty = true;
      }
      return self.indexOf(value) === index;
    }).filter(function (value) {
      return value !== '';
    });

    const datesAreValid = validIndexes.reduce(function (acc, item) {
      return acc && item;
    }, true);

    if(radioGroup.length === 0) {
      $('.js-delivery-empty').removeClass('hide');
    }

    let invalidTextSelector = '';
    if (dates.length === 0) {
      invalidTextSelector = '.js-dates-empty';
      button.html(originalText);
    } else if (filledDates > dates.length || containsEmpty) {
      invalidTextSelector = '.js-dates-same';
    } else if (!datesAreValid) {
      invalidTextSelector = '.js-dates-invalid';
    }

    if (invalidTextSelector !== '') {
      $(invalidTextSelector).removeClass('hide');
      button.html(originalText);

      for (let i = 0; i < validIndexes.length; i++) {
        const isValid = validIndexes[i];
        if (!isValid) {
          $('.js-tail-datetime-field-' + (i + 1)).addClass('form__input--date-missing');
        }
      }
      return;
    }

    const phoneMessage = $('.js-no-phone-message');
    const invalidPhoneMessage = $('.js-invalid-phone-message');
    const phoneNumber = (document.querySelector('.js-phone').value).trim().replace(/\s{2,}/g, ' ');

    if (regexPhoneNumber(phoneNumber) === false ) {
          document.querySelector('.js-phone').focus();
          if (phoneNumber === '' ) {
            phoneMessage.removeClass('hide');
            invalidPhoneMessage.addClass('hide');
          } else {
            invalidPhoneMessage.removeClass('hide');
            phoneMessage.addClass('hide');
          }
          return;
        }
        phoneMessage.addClass('hide');
        invalidPhoneMessage.addClass('hide');
    Utils.addToCartParameters([{parameter: 'phone', value: phoneNumber}]);

    const settings = {
      button: button,
      dates: dates,
      originalText: originalText
    };

    if(validationItems()) {
      validationItems();
      e.preventDefault();
    }

    if (document.querySelector('.js-open-soil3-modal')) {
      button.html(originalText);
      showSoil3Modal(function () {
        sendOrderData(settings);
      });
    } else {
      sendOrderData(settings);
    }
  };

  const showSoil3Modal = function (callback) {
    $('.js-open-soil3-modal').trigger('click');
    $('.js-soil3-continue-to-checkout').on('click', callback);
  }

  const processDates = function (settings) {
    const ajaxData = {
      shop_domain: theme.routes.validation_tool_shop,
      schedule_dates: settings.dates
    };
    const ajax = $.ajax({
      type: 'PUT',
      url: theme.routes.validation_tool_url + 'confirm_dates',
      data: ajaxData,
      timeout: 3000
    });
  };

  const getCartAttributesElementsValue = function () {
    let cartAttributes = '';
    const firstZip = Utils.extractZip(typeof firstZipAddress !== 'undefined' ? firstZipAddress : '');
    $('.js-cart-attribute').each(function (i, el) {
      cartAttributes += (cartAttributes !== '' ? '&' : '');
      if (el.dataset.name === 'zipcode' && el.value === '') {
        cartAttributes += '' + el.dataset.name + '=' + (cartZipCode !== '' ? cartZipCode : firstZip);
        return;
      }
      cartAttributes += '' + el.dataset.name + '=' + el.value;
    });
    return cartAttributes;
  }

  const getCartItemsString = function () {
    return cartItems.reduce(function (acc, item) {
      return acc + (acc === '' ? '' : '&') +
        'products[]variant_id=' + item.variant_id +
        '&products[]quantity=' + item.quantity +
        '&products[]price=' + (item.price / item.quantity) +
        (typeof item.full_price !== 'undefined' ? '&products[]full_price=' + item.full_price : '') +
        '&products[]product_id=' + item.product_id +
        (item.product_type.toLowerCase() === 'sod' ? '&products[]product_name=' + item.product_name : '') +
        (item.product_type.toLowerCase() === 'sod' ? '&products[]product_image=' + item.product_image : '') +
        '&products[]product_type=' + item.product_type +
        '&products[]pickup_location=' + (typeof item.properties.pickup_location !== 'undefined' ? item.properties.pickup_location : '')
    }, '');
  }

  const sendOrderData = function (settings) {
    const cartItemsString = getCartItemsString();
    const cartAttributes = getCartAttributesElementsValue();
    const deliveryType = $('.js-delivery-type:checked').val();
    const deliveryTypeText = $('.js-delivery-type:checked + span').html();
    const note = $('.js-cart-note').val();
    const phoneNumber = (document.querySelector('.js-phone').value).trim().replace(/\s{2,}/g, ' ');
    let pickupZip = '';
    if (deliveryType === 'pickup') {
      const found = Utils.extractZip(cartPickupAddress);
      if (found !== null && found.length > 0) {
        pickupZip = '&zipcode=' + found;
      }
    }

    const discountCode = $('.js-discount-code').val();
    const ajaxData =
      'delivery_type=' + deliveryType +
      '&shop_domain=' + theme.routes.validation_tool_shop +
      '&note=' + note +
      '&customer_address=' + (cartDeliveryMethod === 'delivery' ? 'Delivery address:' + cartDeliveryAddress : 'Pick up in: ' + cartPickupAddress) +
      '&schedule_dates=' + (settings.dates.join(',')) +
      (discountCode ? '&discount_code=' + discountCode : '') +
      '&' + cartAttributes + pickupZip +
      (typeof isLawnAnswer !== 'undefined' ? '&lawn_planted=' + isLawnAnswer : '') +
      '&' + cartItemsString;

    window.localStorage.setItem('delivery_type', deliveryType);
    if (cartDeliveryMethod === 'delivery') {
      window.localStorage.setItem('delivery_method', cartDeliveryMethod);
      window.localStorage.setItem('delivery_address', cartDeliveryAddress);
      window.localStorage.setItem('delivery_zipcode', cartZipCode);
      window.localStorage.setItem('delivery_phone', phoneNumber);
    }

    const ajax = $.ajax({
      type: 'GET',
      url: theme.routes.validation_tool_url + 'draft_orders',
      data: ajaxData.replace(/#/g, '%23'),
      timeout: 3000
    });

    ajax.done(function (data) {
      if (data.draft_order) {
        setTimeout(function () {
          window.location.href = data.draft_order;
        }, 2000);
        return;
      }

      settings.button.html(settings.originalText);
      $('.js-no-response').removeClass('hide');
    }).fail(function () {
      $('.js-no-response').removeClass('hide');
      settings.button.html(settings.originalText);
    });
  };

  const resetCheckoutForm = function (ev) {
    $('.js-go-to-checkout').prop('disabled', true);
    for (let i = 0; i < 3; i++) {
      const dateField = $('.js-tail-datetime-field-' + (i + 1));
      dateField.val('');
      dateField.data('value', '');
    }
  };

  const highlightUpdateButton = function (ev) {
    $('.js-update-cart-message').removeClass('hide');
  };
//ticket SSOD-310
  const updateTotals = function (ev) {
    let input = ev.target;
    let stepQuantity = parseFloat( input.getAttribute('step') );
    let newQuantity = parseFloat(input.value);
    let index = input.dataset.inputIndex;
    let price = Utils.formatMoneyWithPrecision( parseInt(document.querySelector('.js-item-price-' + index).getAttribute('value')) ).split('$')[1];
    let linePrice = document.querySelector('#js-line-price' + index);   
    let linePriceTotal = Utils.formatMoneyWithPrecision(( newQuantity * price ).toFixed(2));
    let dataItemPrice = newQuantity * price;
    let linePrices = [...$('.js-line-price')].map(x => parseFloat(x.dataset.linePrice));
    let subTotal = Utils.formatMoneyWithPrecision(linePrices.reduce((a, b) => a + b).toFixed(2));
    
    document.querySelector('.js-submit-button').removeAttribute('disabled');
    console.log($('.js-submit-button'))

    if ( newQuantity % stepQuantity == 0 && input.hasAttribute('step') ) {
      linePrice.setAttribute('data-line-price', dataItemPrice );
      linePrice.innerHTML = linePriceTotal;
      $('.js-cart-subtotal').text(subTotal);
      $('.js-invalid-quantity-' + index).addClass('hide');
      

      jQuery.post('/cart/change.js', { quantity: newQuantity, line: index });

    } else {
      if ( input.hasAttribute('step') ) { 
        $('.js-invalid-quantity-' + index).removeClass('hide');
        document.querySelector('.js-go-to-checkout').disabled = true;
       }  
    }

  };

  const showFixedPrices = function () {
    if (typeof cartItems === 'undefined') {
      return;
    }

    for (let i = 0; i < cartItems.length; i++) {
      const element = cartItems[i];
      if (
        typeof element.properties !== 'undefined' &&
        element.properties !== null &&
        Object.keys(element.properties).length > 0 &&
        (element.properties).constructor === Object &&
        typeof element.properties._custom_price !== 'undefined'
      ) {
        const unitPrice = Utils.formatMoneyWithPrecision(
          element.properties._custom_price * 100,
          2
        );
        $('.js-item-price-' + (i+1)).html(unitPrice);
      }
    }
  };

  const areDatesValid = function () {
    let dates = document.querySelectorAll('input[class*="js-tail-datetime-field-"]');
    let containsEmpty = false;
    dates = Array.prototype.slice.call(dates);
    const validIndexes = [true, true, true];
    const filledDates = dates.length;

    dates = dates.map(function (input) {
      return input.value;
    }).filter(function (value, index, self) {
      if (self.indexOf(value) !== index || value === '') {
        validIndexes[index] = false;
        containsEmpty = true;
      }
      return self.indexOf(value) === index;
    }).filter(function (value) {
      return value !== '';
    });

    checkValidDateIndexes({
      dates: dates,
      validIndexes: validIndexes,
      filledDates: filledDates,
      containsEmpty: containsEmpty
    });

    const datesAreValid = validIndexes.reduce(function (acc, item) {
      return acc && item;
    }, true);

    return datesAreValid;
  };

  const checkValidDateIndexes = function (settings) {
    const datesAreValid = settings.validIndexes.reduce(function (acc, item) {
      return acc && item;
    }, true);

    $('.js-dates-empty').addClass('hide');
    for (let i = 0; i < settings.validIndexes.length; i++) {
      $('.js-tail-datetime-field-' + (i + 1)).removeClass('form__input--date-missing');
    }

    let invalidTextSelector = '';
    if (settings.dates.length === 0) {
      invalidTextSelector = '.js-dates-empty';
    } else if (settings.filledDates > settings.dates.length || settings.containsEmpty) {
      invalidTextSelector = '.js-dates-same';
    } else if (!datesAreValid) {
      invalidTextSelector = '.js-dates-invalid';
    }

    if (invalidTextSelector !== '') {
      $(invalidTextSelector).removeClass('hide');
    }

    for (let i = 0; i <settings. validIndexes.length; i++) {
      const isValid = settings.validIndexes[i];
      if (!isValid) {
        $('.js-tail-datetime-field-' + (i + 1)).addClass('form__input--date-missing');
      }
    }
  };

  const isDeliveryTypeChosen = function () {
    let radioGroup = $('.js-delivery-type:checked');
    if(radioGroup.length === 0) {
      $('.js-delivery-empty').removeClass('hide');
      return false;
    }

    $('.js-delivery-empty').addClass('hide');
    return true;
  };

  const updateCartNote = function () {
    $.ajax({
      type: 'POST',
      url: '/cart/update.js',
      dataType: 'json',
      data: {
        note: document.querySelector('.js-cart-note').value
      }
    });
  };

  const regexPhoneNumber = function (str) {
     const regexPhoneNumber = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/im;
     if (!str.match(regexPhoneNumber)) {
       return false;
     }

     return true;
   };

  const interceptCartSubmit = function (ev) {
    const deliveryType = $('.js-delivery-type:checked').val();

    const button = $('.js-submit-button');
    const originalText = button.html();
    
    button.html('Checking ...');

    const form = ev.target;
    ev.preventDefault();
    const changes = [];
    const cartParameters = [];
    let isInvalid = false;

    $('.js-update-cart-button').prop('disabled', true);
    const phoneMessage = $('.js-no-phone-message');
    const invalidPhoneMessage = $('.js-invalid-phone-message');
    const phoneNumber = (document.querySelector('.js-phone').value).trim().replace(/\s{2,}/g, ' ');

    if (regexPhoneNumber(phoneNumber) === false ) {
      button.html(originalText);
      document.querySelector('.js-phone').focus();
      if (phoneNumber === '' ) {
        phoneMessage.removeClass('hide');
        invalidPhoneMessage.addClass('hide');
      } else {
        invalidPhoneMessage.removeClass('hide');
        phoneMessage.addClass('hide');
      }
      return;
    }
    phoneMessage.addClass('hide');
    invalidPhoneMessage.addClass('hide');

    window.localStorage.setItem('delivery_type', deliveryType);
    if (cartDeliveryMethod === 'delivery') {
      window.localStorage.setItem('delivery_method', cartDeliveryMethod);
      window.localStorage.setItem('delivery_address', cartDeliveryAddress);
      window.localStorage.setItem('delivery_zipcode', cartZipCode);
      window.localStorage.setItem('delivery_phone', phoneNumber);
    }

    if (document.querySelector('.js-tail-datetime-field-1')) {
      if (! isDeliveryTypeChosen()) {
        ev.preventDefault();
        return;
      }

      let scheduleDates = '';
      const dateFields = document.querySelectorAll('[class*="js-tail-datetime-field-"]');

      for (let i = 0; i < dateFields.length; i++) {
        if (scheduleDates !== '') {
          scheduleDates += ',';
        }
        scheduleDates += dateFields[i].value;
      }

      if (scheduleDates !== '' && areDatesValid()) {
        let customerAddress = typeof firstZipAddress !== 'undefined' ? firstZipAddress : '';
        const addressParts = customerAddress.split('-');

        $('.js-scheduled-dates').val(scheduleDates);
        $('.js-location').val(addressParts[0].trim());

        let addressPrefix = 'Delivery address: ';
        if (document.querySelector('.js-delivery-address')) {
          customerAddress = document.querySelector('.js-delivery-address').value;
        }

        if (deliveryType === 'pickup') {
          addressPrefix = 'Pick up in: ';
          cartParameters.push({parameter: 'customer_latitude', value: ''});
          cartParameters.push({parameter: 'customer_longitude', value: ''});
          cartParameters.push({parameter: 'zip_code', value: ''});
        }

        cartParameters.push({parameter: 'schedule_dates', value: scheduleDates});
        cartParameters.push({parameter: 'delivery_type', value: deliveryType});
        cartParameters.push({
          parameter: 'customer_address',
          value: deliveryType ? addressPrefix + customerAddress : (cartDeliveryMethod === 'pickup' ? firstZipAddress : null)
        });
        cartParameters.push({parameter: 'location', value: addressParts[0].trim()});
        $('.js-pickup-address').val(deliveryType ? addressPrefix + customerAddress : (cartDeliveryMethod === 'pickup' ? firstZipAddress : null));
        $('.js-delivery-type').val(deliveryType ? deliveryType : (cartDeliveryMethod === 'pickup' ? cartDeliveryMethod : null));
      } else {
        areDatesValid();
        button.html(originalText);
        ev.preventDefault();
        return;
      }
    } else if (typeof hasCustomPricing === 'undefined') {
      let addressPrefix = 'Delivery address: ';
      let customerAddress = '';
      if (typeof firstZipAddress !== 'undefined') {
        customerAddress = firstZipAddress;
      }
      if (cartDeliveryMethod === 'pickup') {
        addressPrefix = 'Pick up in: ';
        customerAddress = cartPickupAddress;
        cartParameters.push({parameter: 'customer_latitude', value: ''});
        cartParameters.push({parameter: 'customer_longitude', value: ''});
      }

      cartParameters.push({parameter: 'customer_address', value: deliveryType ? addressPrefix + customerAddress : (cartDeliveryMethod === 'pickup' ? firstZipAddress : null)});
      cartParameters.push({
        parameter: 'delivery_type',
        value: deliveryType ? deliveryType : (cartDeliveryMethod === 'pickup' ? cartDeliveryMethod : null)
      });
      $('.js-pickup-address').val(deliveryType ? addressPrefix + customerAddress : (cartDeliveryMethod === 'pickup' ? firstZipAddress : null));
      $('.js-delivery-type').val(deliveryType ? deliveryType : (cartDeliveryMethod === 'pickup' ? cartDeliveryMethod : null));
    }

    cartParameters.push({parameter: 'phone_number', value: phoneNumber});
    if (typeof isLawnAnswer !== 'undefined') {
      cartParameters.push({parameter: 'lawn_planted', value: isLawnAnswer});
    }
    Utils.addToCartParameters(cartParameters).always(function () {
      updateCartNote();
    });

    if (typeof hasCustomPricing === 'undefined') {
      removeInvalidBundleProducts(function () {
        setTimeout(function () {
          form.submit();
        }, 1000);
      });
      return;
    }

    $('.js-invalid-quantity').addClass('hide');
    $('.js-item-custom-price').each(function (i, el) {
      const index = parseInt(el.dataset.index);
      const itemProperties = JSON.parse(
        JSON.stringify(cartItems[index - 1].properties)
      );
      const input = $('.js-cart-quantity-selector-' + index);
      let quantity = parseInt(input.val());
      const step = parseInt(input.prop('step'));
      if (quantity % step !== 0) {
        $('.js-invalid-quantity-' + index).removeClass('hide');
        isInvalid = true;
        return;
      }
      // itemProperties._custom_price = quantity * parseFloat(el.value / el.dataset.units);
      changes.push({
        line: index,
        properties: itemProperties
      });
    });

    if (isInvalid) {
      button.html(originalText);
      $('.js-update-cart-button').prop('disabled', null);
      return;
    }
    changeCartItemsProperties(changes, form);
  };

  const changeCartItemsProperties = function (changes, form) {
    if (changes.length < 1) {
      setTimeout(() => {
        form.submit();
      }, 3500);
      return;
    }
    const current = changes.shift();
    const ajax = $.ajax({
      type: 'POST',
      url: '/cart/change.js',
      dataType: 'json',
      data: current
    });
    ajax.always(function () {
      changeCartItemsProperties(changes, form);
    });
  };

  const removeInvalidBundleProducts = function (noInvalidProductsCallback) {
    const invalidBundleProducts = $('.js-remove-bundle-from-cart');
    if (invalidBundleProducts.length < 1) {
      if (typeof noInvalidProductsCallback === 'function') {
        noInvalidProductsCallback();
      }
      return;
    }

    const updates = {};
    invalidBundleProducts.each(function (i, item) {
      updates[item.innerHTML] = 0;
    });

    $('.js-removed-bundle-products').removeClass('hide');

    const ajax = $.ajax({
      type: 'POST',
      url: '/cart/update.js',
      dataType: 'json',
      data: {
        updates: updates
      }
    });
    ajax.done(function (data) {
      setTimeout(function () {
        window.location.reload();
      }, 3000);
    })
  };

  const showRemoveLinks = function () {
    setTimeout(() => {
      $('.js-remove-link').each(function (i, link) {
        $(link).removeClass('hide');
      });
    }, 3000);
  };

  const setCartDeliveryAttribute = function (deliveryMethod) {
    Utils.addToCartParameters('delivery_method', deliveryMethod);
  };

  const checkForSod = function(ev) {
    ev.preventDefault();
    const btn = ev.target;
    const removeLink = btn.getAttribute('href');
    let lineIndex = btn.getAttribute('data-index');
    let recommendedProductId = $('.js-byb-add-to-cart').data('id');
    let currentLineItemSodQty = document.querySelector('.js-cart-quantity-selector-' + lineIndex).value;
    let totalSod = document.querySelector('.js-totalSod').value;
    let currentTotalSod = totalSod - currentLineItemSodQty;
    let lineId = parseInt(btn.getAttribute('data-line-id'));

    if ( totalSod > 0 ) {
      if ( currentTotalSod <= 0 && $('.js-byb-add-to-cart') ) {
        const data = { updates: {
            [recommendedProductId]: 0,
            [lineId]: 0
          }
        }
        console.log(data);
        jQuery.ajax({
          type: 'POST',
          url: '/cart/update.js',
          data: data,
          dataType: 'json',
          success: function() { 
            location.reload();
          }
        });
      }
    }  else {
      window.location.href = removeLink;
    }

  }

  const init = function () {
    setEvents();
    showFixedPrices();
    showRemoveLinks();
    validationItems();
    if (
      typeof cartDeliveryAttribute !== 'undefined' &&
      cartDeliveryAttribute !== '' &&
      cartDeliveryAttribute !== cartDeliveryMethod
    ) {
      setCartDeliveryAttribute(cartDeliveryMethod);
    }
  };

  const setEvents = function () {
    $(document)
      .on('click', '.js-check-dates', searchAvailableDates)
      .on('change', '.js-delivery-type', resetCheckoutForm)
      .on('click', '.js-go-to-checkout', validateCheckout)
      .on('change keyup input', '.js-cart-quantity-selector', highlightUpdateButton)     
      .on('change keyup input', '.js-cart-quantity-selector', updateTotals)
      .on('submit', '.js-cart-form', interceptCartSubmit)
      .on('click', '.js-remove-link', checkForSod)
    for (let index = 0; index < 3; index++) {
      const fieldSelector = '.js-tail-datetime-field-' + (index + 1);
      $(document).on('click', fieldSelector, function () {
        updateOtherCalendars(index);
      });
    }

    $('.form__input--date').click(function() {
      let radioGroup = $('.js-delivery-type:checked');
      if(radioGroup.length === 0) {
        alert(chooseStepOneMessage);
      }
    });

    $('.js-open-soil3-modal').magnificPopup({
      type:'inline',
      callbacks: {
        close: function () {
          $('.js-open-soil3-modal').removeClass('js-open-soil3-modal');
        }
      }
    });
    $('.js-open-validation-modal').magnificPopup({
      type:'inline',
      callbacks: {
        close: function () {
          $('.js-open-soil3-modal').removeClass('js-open-soil3-modal');
        }
      }
    });
    $('body').on( 'click', '.return-to-cart', function( e ) {
        e.preventDefault();
        $.magnificPopup.close();
    });

  };

  return {
    init: init
  };
})();

Cart.init();
