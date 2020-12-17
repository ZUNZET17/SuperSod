const Utils = (function () {
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

  const defaultOption = function (opt, def) {
    return (typeof opt === 'undefined' ? def : opt);
  };

  const formatWithDelimiters = function (number, precision, thousands, decimal) {
    precision = defaultOption(precision, 2);
    thousands = defaultOption(thousands, ',');
    decimal = defaultOption(decimal, '.');

    if (isNaN(number) || number == null) {
      return 0;
    }

    number = (number / 100.0).toFixed(precision);

    let parts = number.split('.'),
      dollars = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + thousands),
      cents = parts[1] ? (decimal + parts[1]) : '';

    return dollars + cents;
  };

  const formatMoneyWithPrecision = function (cents, centPrecision, format) {
    if (typeof cents == 'string') {
      cents = cents.replace('.', '');
    }
    var value = '';
    var placeholderRegex = /\{\{\s*(\w+)\s*\}\}/;
    var formatString = (format || theme.moneyFormat);
    const centsPrecision = defaultOption(centPrecision, 2);

    switch(formatString.match(placeholderRegex)[1]) {
      case 'amount':
        value = formatWithDelimiters(cents, centsPrecision);
        break;
      case 'amount_no_decimals':
        value = formatWithDelimiters(cents, 0);
        break;
      case 'amount_with_comma_separator':
        value = formatWithDelimiters(cents, centsPrecision, '.', ',');
        break;
      case 'amount_no_decimals_with_comma_separator':
        value = formatWithDelimiters(cents, 0, '.', ',');
        break;
    }

    return formatString.replace(placeholderRegex, value);
  };

  const capitalize = function (s) {
    if (typeof s !== 'string') {
      return '';
    }

    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  return {
    addToCartParameters: addToCartParameters,
    capitalize: capitalize,
    formatMoneyWithPrecision: formatMoneyWithPrecision,
    onlyNumbers: onlyNumbers
  };
})();