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
      if (i === index) {
        continue;
      } else if (chosenDates.length < 1) {
        $('.js-tail-datetime-field-' + (i + 1)).val('');
        $('.js-tail-datetime-field-' + (i + 1)).data('value', '');
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

  const updateOtherCalendars = function (index) {
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
        const date = dateStringToMilliseconds(input.val() + ' 00:00:00');
        chosenDates.push(date);
      }
    }
  };

  const searchAvailableDates = function (ev) {
    const button = $(ev.target);
    if (typeof hasCustomPricing === 'undefined') {
      return;
    }

    const noDatesInfo = $('.js-no-dates');
    const originalText = button.html();
    const endpoint = 'available_dates';
    const ajaxData = {
      latitude: $('.js-address-latitude').val(),
      longitude: $('.js-address-longitude').val(),
      type_delivery_pickup: $('.js-delivery-type:checked').val(),
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
          $('.js-tail-datetime-field-' + (index + 1)).val(data.available_dates[index]);
          const modifiedDate = data.available_dates[index].replace(/T.+/g, '');
          const milliseconds = dateStringToMilliseconds(modifiedDate + ' 00:00:00');
          availableDates.push(milliseconds);
        }
      }

      const dateRangesMilliseconds = getDateRangesMilliseconds(data.available_dates);
      initDatePicker(dateRangesMilliseconds);
      button.html(originalText);
      $('.js-go-to-checkout').prop('disabled', false);
    }).fail(function () {
      button.html(originalText);
      noDatesInfo.removeClass('hide');
    });
  };

  const getDateRangesMilliseconds = function (dates) {
    return dates.map(function (date) {
      const modifiedDate = date.replace(/T.+/g, '');
      const milliseconds = dateStringToMilliseconds(modifiedDate + ' 00:00:00');
      return {
        days: true,
        end: milliseconds,
        start: milliseconds
      };
    });
  };

  const dateStringToMilliseconds = function (date) {
    const milliDate = new Date(date);
    return milliDate.getTime();
  };

  const validateCheckout = function (ev) {
    $('.js-dates-invalid').addClass('hide');
    $('.js-no-response').addClass('hide');
    const button = $(ev.target);
    const originalText = button.html();

    button.html('Checking ...');
    let dates = document.querySelectorAll('input[class*="js-tail-datetime-field-');
    dates = Array.prototype.slice.call(dates);
    const filledDates = dates.length;

    dates = dates.map(function (input) {
      return input.value;
    }).filter(function (value, index, self) {
      return self.indexOf(value) === index;
    });
    console.log(dates);

    if (dates.length < filledDates) {
      $('.js-dates-invalid').removeClass('hide');
      button.html(originalText);
      return;
    }

    const settings = {
      button: button,
      dates: dates,
      originalText: originalText
    };
    processDates(settings);
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

  const sendOrderData = function (settings) {
    const cartItemsString = cartItems.reduce(function (acc, item) {
      return acc + (acc === '' ? '' : '&') +
        'products[]variant_id=' + item.variant_id +
        '&products[]quantity=' + item.quantity +
        '&products[]price=' + item.price +
        '&products[]product_id=' + item.product_id +
        '&products[]product_type=' + item.product_type
    }, '');
    const ajaxData = 
      'delivery_type=' + $('.js-delivery-type:checked').val() +
      '&shop_domain=' + theme.routes.validation_tool_shop +
      '&' + cartItemsString;
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
      $('.js-tail-datetime-field-' + (i + 1)).val('');
      $('.js-tail-datetime-field-' + (i + 1)).data('value', '');
    }
  };

  const init = function () {
    setEvents();
  };

  const setEvents = function () {
    $(document)
      .on('click', '.js-check-dates', searchAvailableDates)
      .on('change', '.js-delivery-type', resetCheckoutForm)
      .on('click', '.js-go-to-checkout', validateCheckout);
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
