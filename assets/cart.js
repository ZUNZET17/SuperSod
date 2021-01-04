const Cart = (function () {
  let availableDates = [];
  let chosenDates = [];
  let calendarHandles = [];
  let firstTime = true;

  const initDatePicker = function (dates) {
    for (let index = 0; index < 3; index++) {
      const fieldSelector = '.js-tail-datetime-field-' + (index + 1);
      const handle = applyDatePickerConfig(fieldSelector, dates);
      handle.on('change', function () {
        updateCalendars(index);
      });
      calendarHandles.push(handle);
    }
  };

  const applyDatePickerConfig = function (fieldSelector, dates) {
    return tail.DateTime(fieldSelector, {
      dateEnd: 9999954000000,
      dateBlacklist: false,
      dateRanges: dates,
      days: ['TUE', 'WED', 'THU', 'FRI', 'SAT'],
      timeFormat: false,
      position: 'bottom',
      startOpen: false,
      stayOpen: false
    })
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

    const noDatesInfo = $('.js-no-dates');
    const originalText = button.html();
    const endpoint = 'available_dates';
    const addedValue = parseFloat(input.data('price'));
    const ajaxData = {
      latitude: $('.js-address-latitude').val(),
      longitude: $('.js-address-longitude').val(),
      type_delivery_pickup: input.val(),
      shop_domain: theme.routes.validation_tool_shop,
      zipcode: $('.js-address-zip').val()
    };

    button.html('Checking ...');
    noDatesInfo.addClass('hide');
    const ajax = $.ajax({
      type: 'GET',
      url: theme.routes.validation_tool_url + endpoint,
      data: ajaxData,
      timeout: 3000
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

      const dateRangesMilliseconds = getDateRangesMilliseconds(data.available_dates);
      initDatePicker(dateRangesMilliseconds);
      button.html(originalText);
      $('.js-go-to-checkout').prop('disabled', false);
      const subtotalElement = $('.js-cart-subtotal')
      const subtotal = parseFloat(subtotalElement.data('value')) + addedValue;
      subtotalElement.html( Shopify.formatMoney(subtotal) );
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

  const validateCheckout = function (ev) {
    removeInvalidBundleProducts();
    $('.js-dates-invalid').addClass('hide');
    $('.js-dates-empty').addClass('hide');
    $('.js-dates-same').addClass('hide');
    $('.js-no-response').addClass('hide');
    const button = $(ev.target);
    const originalText = button.html();

    button.html('Checking ...');
    let dates = document.querySelectorAll('input[class*="js-tail-datetime-field-"]');
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

    const settings = {
      button: button,
      dates: dates,
      originalText: originalText
    };
    sendOrderData(settings);
  };

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
    $('.js-cart-attribute').each(function (i, el) {
      cartAttributes += (cartAttributes !== '' ? '&' : '');
      cartAttributes += 'cart_attributes[]' + el.dataset.name + '=' + el.value;
    });
    return cartAttributes;
  }

  const getCartItemsString = function () {
    return cartItems.reduce(function (acc, item) {
      return acc + (acc === '' ? '' : '&') +
        'products[]variant_id=' + item.variant_id +
        '&products[]quantity=' + item.quantity +
        '&products[]price=' + item.price +
        (typeof item.full_price !== 'undefined' ? '&products[]full_price=' + item.full_price : '') +
        '&products[]product_id=' + item.product_id +
        (item.product_type.toLowerCase() === 'sod' ? '&products[]product_name=' + item.product_name : '') +
        (item.product_type.toLowerCase() === 'sod' ? '&products[]product_image=' + item.product_image : '') +
        '&products[]product_type=' + item.product_type
    }, '');
  }

  const sendOrderData = function (settings) {
    const cartItemsString = getCartItemsString();
    const cartAttributes = getCartAttributesElementsValue();
    const ajaxData =
      'delivery_type=' + $('.js-delivery-type:checked').val() +
      '&shop_domain=' + theme.routes.validation_tool_shop +
      '&schedule_dates=' + (settings.dates.join(',')) +
      '&note=' + $('.js-cart-note').val() +
      '&discount=' + $('.js-discount-code').val() +
      '&' + cartAttributes +
      '&' + cartItemsString;

    window.localStorage.setItem('delivery_type', $('.js-delivery-type:checked').val());
    const ajax = $.ajax({
      type: 'GET',
      url: theme.routes.validation_tool_url + 'draft_orders',
      data: ajaxData,
      timeout: 3000
    });

    ajax.done(function (data) {
      if (data.draft_order) {
        window.location.href = data.draft_order;
        return;
      }
      $('.js-no-response').removeClass('hide');
    }).fail(function () {
      $('.js-no-response').removeClass('hide');
    });
    settings.button.html(settings.originalText);
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

  const showFixedPrices = function () {
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
          (element.properties._custom_price / element.quantity) * 100,
          3
        );
        $('.js-item-price-' + (i+1)).html(unitPrice);
      }
    }
  };

  const interceptCartSubmit = function (ev) {
    if (typeof hasCustomPricing === 'undefined') {
      return;
    }

    const form = ev.target;
    ev.preventDefault();
    const changes = [];
    let isInvalid = false;

    $('.js-update-cart-button').prop('disabled', true);

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
      itemProperties._custom_price = quantity * parseFloat(el.value / el.dataset.units);
      changes.push({
        line: index,
        properties: itemProperties
      });
    });

    if (isInvalid) {
      $('.js-update-cart-button').prop('disabled', null);
      return;
    }
    changeCartItemsProperties(changes, form);
  };

  const changeCartItemsProperties = function (changes, form) {
    if (changes.length < 1) {
      form.submit();
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

  const removeInvalidBundleProducts = function () {
    const invalidBundleProducts = $('.js-remove-bundle-from-cart');
    if (invalidBundleProducts.length < 1) {
      return;
    }

    const updates = {};
    invalidBundleProducts.each(function (i, item) {
      updates[item.innerHTML] = 0;
    });

    const ajax = $.ajax({
      type: 'POST',
      url: '/cart/update.js',
      dataType: 'json',
      data: {
        updates: updates
      }
    });
    ajax.done(function (data) {
      window.location.reload();
    })
  };

  const init = function () {
    setEvents();
    showFixedPrices();
  };

  const setEvents = function () {
    $(document)
      .on('click', '.js-check-dates', searchAvailableDates)
      .on('change', '.js-delivery-type', resetCheckoutForm)
      .on('click', '.js-go-to-checkout', validateCheckout)
      .on('change keyup input', '.js-cart-quantity-selector', highlightUpdateButton)
      .on('submit', '.js-cart-form', interceptCartSubmit);
    for (let index = 0; index < 3; index++) {
      const fieldSelector = '.js-tail-datetime-field-' + (index + 1);
      $(document).on('click', fieldSelector, function () {
        updateOtherCalendars(index);
      });
    }
  };

  return {
    init: init
  };
})();

Cart.init();
