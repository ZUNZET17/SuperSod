const Product = (function () {
  let minimumQuantity = null;
  let themeCart = null;
  let autocomplete;
  let checkPULocationsTimeout = null;
  const componentForm = {
    street_number: 'short_name',
    route: 'long_name',
    locality: 'long_name',
    administrative_area_level_1: 'short_name',
    country: 'long_name',
    postal_code: 'short_name',
  };
  const productObject = {};
  const bundleProducts = [];

  const init = function () {
    setEvents();
    initElements();
    initAutocomplete();
    Shopify.getCart(function(cart) {
      themeCart = JSON.parse(JSON.stringify(cart));
    });
  };

  const setEvents = function () {
    $(document)
      .on('click', '.js-pickup-shorcut', choosePickUpMode)
      .on('click', '.js-product-price-check', checkZipCode)
      .on('click', '.js-product-single-thumbnail', switchImage)
      .on('click', '.js-bundle-submit', interceptBundleSubmit)
      .on('click', '.js-lawn-planted', checkLawnPlantedAnswer)
      .on('change keyup', '.js-zip-code', validateZipCode)
      .on('change keyup', '.js-autocomplete-address', resetAddressInput)
      .on('change', '.js-delivery-method', changeDeliveryForm)
      .on('change', '.js-product-pickup-variants', selectPickupVariant)
      .on('change', '.js-product-variants', changeLabelPrice)
      .on('change', '.js-product-variant', selectMultivariant)
      .on('change keyup input', '.js-quantity-input', checkQuantityIncrement)
      .on('change keyup', '.js-autocomplete-address', hideAddToCart)
      .on('focus', '.js-autocomplete-address', geolocate)
      .on('keypress', '.js-product-form input', function (e) {
        const code = e.keyCode || e.which;
        if (code == 13) {
          e.preventDefault();
          return false;
        }
      })
      .on('click', '.js-bold-clone', function (ev) {
        ev.preventDefault();
      });

    if (window.location.search.indexOf('variant') > -1) {
      const searchVariant = Utils.getParameterByName('variant');
      if (searchVariant) {
        $('.js-product-variants').trigger('change');
      }
    }
  };

  const checkLawnPlantedAnswer = function (ev) {
    let yesOption = document.querySelector('.js-lawn-planted-yes');
    let noOption = document.querySelector('.js-lawn-planted-no');
    let lawnPlantedWarning = document.querySelector(".js-lawn-planted-warning")

    if ( !yesOption.checked && !noOption.checked) {
      lawnPlantedWarning.classList.remove('lawn-planted-warning-hide');
      ev.preventDefault();
    }
  }

  const initElements = function () {
    $('.js-show-youtube-popup').magnificPopup( { type:'iframe' } );
    addZoomImage();

    const zipCodeElement = $('.js-zip-code');
    if (zipCodeElement.val() !== '') {
      $('.js-delivery-method').trigger('change');
      setTimeout(function () {
        zipCodeElement.trigger('change');
      }, 1000);
    }

    if (typeof isBundle !== 'undefined' && isBundle) {
      startBundleObserver();
    }
  };

  const validateZipCode = function (ev) {
    Utils.onlyNumbers(ev);

    const input = ev.target;
    const value = (input.value).trim();
    if (!value || value == '' || value.length < 5) {
      toggleSubmitButton('disable', 'js-product-price-check');
      return;
    }
    if (
      typeof usesVariantToggle === 'undefined' &&
      typeof usesRegularToggle === 'undefined'
    ) {
      checkMinimumQuantity(value);
    }
    toggleSubmitButton('show', 'js-product-price-check');

    if (
      typeof productObject.geometry !== 'undefined' &&
      typeof productObject.geometry.zipCode === 'undefined'
    ) {
      const parameters = [];
      parameters.push({parameter: 'customer_latitude', value: productObject.geometry.latitude});
      parameters.push({parameter: 'customer_longitude', value: productObject.geometry.longitude});
      parameters.push({parameter: 'customer_address', value: $('.js-autocomplete-address').val()});
      parameters.push({parameter: 'zip_code', value: value});
      $('.js-zip-not-found').addClass('hide');
      Utils.addToCartParameters(parameters);
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
    let zipCode = '';
    const deliveryMethod = $('.js-delivery-method:checked').val();
    if (deliveryMethod === 'delivery') {
      zipCode = (input.value).trim();
      if (!zipCode || zipCode == '' || zipCode.length < 5) {
        toggleSubmitButton('disable');
        $('.js-invalid-address').removeClass('hide');
        return;
      }
    }

    $('.js-invalid-address').addClass('hide');

    if (
      typeof usesVariantToggle !== 'undefined' ||
      typeof usesRegularToggle !== 'undefined'
    ) {
      if (deliveryMethod === 'delivery') {
        if (typeof isDeliveredEverywhere !== 'undefined') {
          toggleSubmitButton('show');
          showButtonMessage(deliveryMethod);
          // $('.js-delivery-method').trigger('change');
          $('.js-not-available-text').addClass('hide');
          chooseVariant('delivery');
          return;
        }
      }

      const boldLinks = $('.js-product-form .bold-bundles-child-product__link');
      if (boldLinks.length > 0) {
        checkBundleProductsInfo(boldLinks, zipCode, $(ev.target));
        return;
      }
      checkNonSodAvailability(zipCode, $(ev.target));
      return;
    }
    checkProductZoneAvailability(zipCode, $(ev.target));
  };

  const checkBundleProductsInfo = function (links, zipCode, button) {
    const productHandles = [].slice.call(links).map(function (link) {
      const hrefs = link.getAttribute('href').split('/');
      return hrefs[hrefs.length - 1];
    });
    const originalText = button.html();
    button.html('Checking ...');
    checkBundleProductsIds(productHandles, zipCode, button, originalText, '');
  };

  const checkBundleProductsIds = function (handles, zipCode, button, originalText, ids) {
    if (handles.length < 1 && ids !== null) {
      const count = (ids.match(/&/g) || []).length;
      button.html(originalText);
      if (count < 1) {
        $('.js-not-available-text').removeClass('hide');
      } else {
        $('.js-not-available-text').addClass('hide');
        checkNonSodAvailability(zipCode, button, ids);
      }
      return;
    } else if (handles.length < 1 && ids === null) {
      button.html(originalText);
      $('.js-not-available-text').removeClass('hide');
      return;
    }

    const current = handles.shift();
    const ajax = $.ajax({
      type: 'GET',
      url: '/products/' + current + '.js',
      dataType: 'json'
    });
    ajax.always(function (data) {
      if (typeof data.id !== 'undefined') {
        ids += (ids !== '' ? '&' : '') + 'products[]shopify_product_id=' + data.id;
        bundleProducts.push({
          id: data.id,
          variants: data.variants.map(function (variant) {
            return variant.id
          })
        });
      }
      checkBundleProductsIds(handles, zipCode, button, originalText, ids);
    });
  };

  const searchProductBundleVariant = function (productId) {
    if (!document.querySelector('select[id^="bold_bundle_variant_' + productId + '"]')) {
      for (let i = 0; i < bundleProducts.length; i++) {
        const bundleProduct = bundleProducts[i];
        if (bundleProduct.id === productId) {
          return bundleProduct.variants[0];
        }
      }
    }

    const options = document.querySelector('select[id^="bold_bundle_variant_' + productId + '"]').options;
    for (let j = 0; j < options.length; j++) {
      const option = options[j];
      if (option.selected) {
        return parseInt(option.value);
      }
    }
    return false;
  };

  const interceptBundleSubmit = function (ev) {
    ev.preventDefault();
    if (bundleProducts.length < 1) {
      return;
    }

    const deliveryMethod = $('.js-delivery-method:checked').val();
    const quantity = $('.js-quantity-input-' + deliveryMethod).val();
    const properties = {
      _method: deliveryMethod,
      _address: deliveryMethod === 'delivery' ? $('.js-customer-address').val() : $('.js-product-pickup-variants').val(),
      _added_from_bundle: true
    }

    if (deliveryMethod === 'delivery') {
      properties._zip = $('.js-zip-code').val();
    } else if (deliveryMethod === 'pickup') {
      properties.pickup_location = $('.js-product-pickup-variants').val()
    }

    const cartQuantities = {};
    const bundleVariants = [];
    let alreadyInCart = 0;

    for (let i = 0; i < bundleProducts.length; i++) {
      const bundleProduct = bundleProducts[i];
      const foundVariant = searchProductBundleVariant(bundleProduct.id);
      if (foundVariant) {
        bundleVariants.push(foundVariant);
      }
    }

    for (let i = 0; i < bundleVariants.length; i++) {
      const bundleVariant = bundleVariants[i];
      for (let j = 0; j < cartItems.length; j++) {
        const cartItem = cartItems[j];
        if (
          bundleVariant == cartItem.variant_id &&
          cartItem.properties._address === properties._address &&
          cartItem.properties._method === properties._method
        ) {
          alreadyInCart++;
          cartQuantities[bundleVariant] = parseInt(quantity) + cartItem.quantity;
        }
      }
    }

    if (alreadyInCart > 1) {
      const ajax = $.ajax({
        type: 'POST',
        url: '/cart/update.js',
        dataType: 'json',
        data: {
          updates: cartQuantities
        }
      });
      ajax
        .done(function () {
          window.location.href = '/cart';
        })
        .fail(function (jqXHR, textStatus, errorThrown) {
          alert(jqXHR.responseJSON.message);
        });
      return;
    }

    const items = bundleVariants.map(function (variantId) {
      return {
        quantity: parseInt(quantity),
        id: variantId,
        properties: properties
      };
    });

    const ajax = $.ajax({
      type: 'POST',
      url: '/cart/add.js',
      dataType: 'json',
      data: {
        items: items
      }
    });

    ajax
      .done(function () {
        window.location.href = '/cart';
      })
      .fail(function (jqXHR, textStatus, errorThrown) {
        alert(jqXHR.responseJSON.message);
      });
  };

  const checkNonSodAvailability = function (zipCode, button, productIds) {
    const originalText = button.html();
    const deliveryMethod = $('.js-delivery-method:checked').val();
    const endpoint = 'available_in_zone';
    let productString = '&products[]shopify_product_id=' + productData.id;

    if (typeof productIds !== 'undefined' && productIds !== '') {
      productString = '&' + productIds;
    }

    const ajaxData =
      'zipcode=' + zipCode + productString +
      '&shop_domain=' + theme.routes.validation_tool_shop;

    button.html('Checking ...');
    $('.js-current-increment-unit').html('');
    toggleSubmitButton('disable');

    const ajax = $.ajax({
      type: 'GET',
      url: theme.routes.validation_tool_url + endpoint,
      data: ajaxData,
      timeout: 3000
    });
    ajax.done(function (response) {
      if (
        typeof response.message !== 'undefined' ||
        typeof response.error !== 'undefined' ||
        (typeof response.data !== 'undefined' &&
          (response.data.length < 1 ||
            response.data[0].available_in_zone === false ||
            response.data[0][deliveryMethod] === false))
      ) {
        if (
          (typeof response.message !== 'undefined' &&
            response.message.indexOf('not available') > -1) ||
          typeof response.error !== 'undefined'
        ) {
          if (deliveryMethod === 'pickup') {
            if (typeof isSod !== 'undefined') {
              button.html(originalText);
              checkProductPricing(zipCode, button);
            } else {
              showPricesAndLocations({
                button: button,
                originalText: originalText,
                deliveryMethod: deliveryMethod,
                zipCode: zipCode,
                skipShowSubmitButton: true
              });
            }
            return;
          }
          button.html(originalText);
          hideFormElements('.js-not-available-delivery');

          return;
        } else if (
          response.data[0][deliveryMethod] === false &&
          deliveryMethod === 'pickup'
        ) {
          if (typeof isBundle !== 'undefined' && isBundle) {
            $('.bold_hidden').removeClass('js-product-submit');
            $('.bold_clone').removeClass('js-product-submit');
          }
          if (typeof isSod !== 'undefined') {
            button.html(originalText);
            checkProductPricing(zipCode, button);
          } else {
            showPricesAndLocations({
              button: button,
              originalText: originalText,
              deliveryMethod: deliveryMethod,
              zipCode: zipCode
            });
          }
          return;
        }

        const longitude = $('.js-address-longitude').val();
        const latitude = $('.js-address-latitude').val();
        const productString = getUnavailableInZoneProductString();
        const queryData =
          'zipcode=' + zipCode + productString +
          '&shop_domain=' + theme.routes.validation_tool_shop + '&longitude=' + longitude + '&latitude=' + latitude;
        checkProductMethodAvailability({
          button: button,
          originalText: originalText,
          queryData: queryData,
          zipCode: zipCode,
          callback: function () {
            showPricesAndLocations({
              button: button,
              originalText: originalText,
              deliveryMethod: deliveryMethod,
              zipCode: zipCode
            });
          },
          failCallback: function () {
            button.html(originalText);
            availiabilityError({zipCode: zipCode});
            hideFormElements();
          }
        });
        return;
      }

      let isAvailable = true;

      for (let i = 0; i < response.data.length; i++) {
        const data = response.data[i];
        if (data.available_in_zone === false ||
          data[deliveryMethod] === false
        ) {
          isAvailable = false;
        }
      }

      if (!isAvailable) {
        button.html(originalText);
        hideFormElements();
        return;
      }

      showPricesAndLocations({
        button: button,
        originalText: originalText,
        deliveryMethod: deliveryMethod,
        zipCode: zipCode
      });
    }).fail(function () {
      button.html(originalText);
      hideFormElements();
    });
  };

  const getUnavailableInZoneProductString = function () {
    const productString = '&products[]id=' + productData.id + '&products[]quantity=' + $('.js-product-quantity').val() + '&products[]type=' + productData.type;
    if (themeCart === null) {
      return productString;
    }

    const cartProducts = themeCart.items.reduce(function (acc, item) {
      if (item.product_id === productData.id) {
        return acc;
      }
      return acc + (acc !== '' ? '&' : '') + 'products[]id=' + item.product_id + '&products[]quantity=' + item.quantity + '&products[]type=' + item.product_type;
    }, '');
    return productString + (cartProducts !== '' ? '&' : '') + cartProducts;
  };

  const showPricesAndLocations = function (options) {
    options.button.html(options.originalText);
    updateForm(options.zipCode);
    const boldLinks = $('.js-product-form .bold-bundles-child-product__link');
    let buttonClassname = null;
    if (boldLinks.length > 0) {
      buttonClassname = 'js-product-submit';
      $('.bold_hidden').removeClass('js-product-submit');
      $('.bold_clone').removeClass('js-product-submit');
    }
    if (options.deliveryMethod === 'pickup') {
      const longitude = $('.js-address-longitude').val();
      const latitude = $('.js-address-latitude').val();
      const quantity = $('.js-product-quantity').val()
      checkNearestPickupLocations({
        customer_type: 'retail',
        latitude: latitude,
        longitude: longitude,
        product_id: productData.id,
        quantity: quantity,
        shop_domain: theme.routes.validation_tool_shop,
        unit_price: $('.js-product-variants option:selected').data('price-val'),
        zipcode: options.zipCode
      }, function () {
        if (buttonClassname) {
          toggleSubmitButton('show', buttonClassname);
        }
        showButtonMessage('pickup');
        if (
          typeof usesVariantToggle !== 'undefined' ||
          typeof usesRegularToggle !== 'undefined'
        ) {
          checkChosenVariant();
        }
      });
    } else {
      if (buttonClassname) {
        toggleSubmitButton('show', buttonClassname);
      }
      showButtonMessage('delivery');
      if (
        typeof usesVariantToggle !== 'undefined' ||
        typeof usesRegularToggle !== 'undefined'
      ) {
        checkChosenVariant();
      }
    }
    // $('.js-delivery-method').trigger('change');
    const submitButton = $('.js-product-submit');
    if (submitButton.hasClass('hide')) {
      if (options.skipShowSubmitButton) {
        toggleSubmitButton('disable');
      } else {
        toggleSubmitButton('show');
        $('.js-not-available-delivery').addClass('hide');
      }
    }
    $('.js-not-available-text').addClass('hide');
  };

  const checkNearestPickupLocations = function (ajaxData, doneCallback) {
    const endpoint = 'nearest_locations_price';
    const ajax = $.ajax({
      type: 'GET',
      url: theme.routes.validation_tool_url + endpoint,
      data: ajaxData,
      timeout: 3000
    });
    ajax.done(function (data) {
      const deliveryMethod = $('.js-delivery-method:checked').val();
      if (
        typeof data.error !== 'undefined'
      ) {
        if (
          deliveryMethod === 'pickup' &&
          typeof data.nearest_locations === 'undefined'
        ) {
          hideFormElements('.js-not-available-pickup-text');
          return;
        }
        availiabilityError({zipCode: ''});
        return;
      }

      enableNearestLocations(typeof data.nearest_locations !== 'undefined' ? data.nearest_locations : null);
      $('.js-product-pickup-variants').trigger('change');
      if (typeof doneCallback === 'function') {
        doneCallback();
      }
    });
  };

  const checkProductZoneAvailability = function (zipCode, button, productIds) {
    const endpoint = 'available_in_zone';
    let productString = '&products[]shopify_product_id=' + productData.id;

    if (typeof productIds !== 'undefined' && productIds !== '') {
      productString = '&' + productIds;
    }
    const ajaxData =
      'zipcode=' + zipCode + productString +
      '&shop_domain=' + theme.routes.validation_tool_shop;

    const originalText = button.html();
    button.html('Checking ...');
    const ajax = $.ajax({
      type: 'GET',
      url: theme.routes.validation_tool_url + endpoint,
      data: ajaxData,
      timeout: 3000
    });

    ajax.done(function (response) {
      const deliveryMethod = $('.js-delivery-method:checked').val();

      if (
        typeof response.message !== 'undefined' ||
        typeof response.error !== 'undefined' ||
        (typeof response.data !== 'undefined' &&
          (response.data.length < 1 ||
            response.data[0].available_in_zone === false ||
            response.data[0][deliveryMethod] === false))
      ) {
        if (
          (typeof response.message !== 'undefined' &&
            response.message.indexOf('not available') > -1) ||
          typeof response.error !== 'undefined'
        ) {
          if (deliveryMethod === 'pickup') {
            if (typeof isSod !== 'undefined') {
              button.html(originalText);
              checkProductPricing(zipCode, button);
            } else {
              showPricesAndLocations({
                button: button,
                originalText: originalText,
                deliveryMethod: deliveryMethod,
                zipCode: zipCode,
              });
            }
            return;
          }

          button.html(originalText);
          hideFormElements('.js-not-available-delivery');
          return;
        } else if (
          response.data[0][deliveryMethod] === false &&
          deliveryMethod === 'pickup'
        ) {
          if (typeof isSod !== 'undefined') {
            button.html(originalText);
            checkProductPricing(zipCode, button);
          } else {
            showPricesAndLocations({
              button: button,
              originalText: originalText,
              deliveryMethod: deliveryMethod,
              zipCode: zipCode
            });
          }
          return;
        } else if (response.data[0].delivery === false || response.data[0].pickup === false) {

          if (response.data[0].delivery === false && response.data[0].pickup === true) {
            hideFormElements('.js-not-available-delivery');
          } else if (response.data[0].delivery === true && response.data[0].pickup === false) {
            hideFormElements('.js-not-available-pickup');
          } else if (response.data[0].delivery === false && response.data[0].pickup === false) {
            hideFormElements();
          }

          $('.js-delivery-method').prop('disabled', 1 );
          $('.js-msg-availability' ).addClass('not-available');
          checkProductPricing(zipCode,button);

          return;

        } else if (response.data[0].delivery === true || response.data[0].pickup === true) {

          $('.js-not-available-text').addClass('hide');

          if (!$('.js-not-available-text').hasClass('hide')) {
            $(this).addClass('hide')
          }

          $('.js-delivery-method').prop('disabled', 0 );
          $('.js-msg-availability' ).removeClass('not-available');
          checkProductPricing(zipCode,button);

          return;
        }

        const longitude = $('.js-address-longitude').val();
        const latitude = $('.js-address-latitude').val();
        const productString = getUnavailableInZoneProductString();
        const queryData =
          'zipcode=' +
          zipCode +
          productString +
          '&shop_domain=' +
          theme.routes.validation_tool_shop +
          '&longitude=' +
          longitude +
          '&latitude=' +
          latitude;
        checkProductMethodAvailability({
          button: button,
          originalText: originalText,
          queryData: queryData,
          zipCode: zipCode,
          callback: function () {
            button.html(originalText);
            checkProductPricing(zipCode, button);
          },
          failCallback: function () {
            button.html(originalText);
            hideFormElements();
          }
        });
        return;
      }

      let isAvailable = true;

      for (let i = 0; i < response.data.length; i++) {
        const data = response.data[i];
        if (data.available_in_zone === false ||
          data[deliveryMethod] === false
        ) {
          isAvailable = false;
        }
      }

      if (!isAvailable) {
        button.html(originalText);
        hideFormElements();
        return;
      }

      button.html(originalText);
      checkProductPricing(zipCode, button);
    })
    .fail(function (response) {
      button.html(originalText);
      hideFormElements();
    });
  };

  const checkProductMethodAvailability = function (options) {
    const endpoint = 'check_products';
    const ajax = $.ajax({
      type: 'GET',
      url: theme.routes.validation_tool_url + endpoint,
      data: options.queryData,
      timeout: 3000
    });
    ajax.done(function (data) {
      options.button.html(options.originalText);
      if (typeof data.delivery_pickup_aviability === 'undefined') {
        hideFormElements();
        return;
      }

      const deliveryMethod = $('.js-delivery-method:checked').val();
      let isAvailable = data.delivery_pickup_aviability.filter(function (product) {
        return product.id == productData.id;
      }).every(function (product) {
        return product[deliveryMethod] === true;
      });

      if (isAvailable && typeof options.callback === 'function') {
        options.callback();
        return;
      } else if (typeof options.failCallback === 'function') {
        options.failCallback();
        return;
      }

      hideFormElements();
    }).fail(function () {

      const deliveryMethod = $('.js-delivery-method:checked').val();
      options.button.html(options.originalText);

      if(deliveryMethod === 'delivery'){
          hideFormElements('.js-not-available-delivery');
      } else {
          hideFormElements('.js-not-available-pickup-text');
      }

    });
  };

  const checkProductPricing = function (zipCode, button) {
    const originalText = button.html();
    const deliveryMethod = $('.js-delivery-method:checked').val();
    const latitude = $('.js-address-latitude').val();
    const longitude = $('.js-address-longitude').val();
    const quantity = $('.js-quantity-input-' + deliveryMethod).val();

    const ajaxData = {
      customer_type: 'retail',
      product_id: productData.id,
      quantity: quantity,
      shop_domain: theme.routes.validation_tool_shop,
    };

    const endpoint = deliveryMethod === 'pickup' ? 'nearest_locations_price' : 'pricing_info';
    if (deliveryMethod === 'delivery') {
      ajaxData.latitude = latitude;
      ajaxData.longitude = longitude;
      ajaxData.zipcode = zipCode;
      ajaxData.unit_price = $('.js-product-variants option:selected').data('price-val');
    }

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
      if (
        typeof data.error !== 'undefined' ||
        (
          deliveryMethod === 'pickup' &&
          typeof data.nearest_locations === 'undefined'
        )
      ) {
        button.html(originalText);
        availiabilityError({zipCode: zipCode});
        hideFormElements();
        return;
      }
      data.fulfillment = deliveryMethod;
      button.html(originalText);


      const deliveryIsDisabled = $('.js-delivery-method').prop('disabled');
      if (!deliveryIsDisabled) {
        toggleSubmitButton('show');
        showButtonMessage(deliveryMethod);
        $('.js-not-available-text').addClass('hide');
        updateForm(zipCode);
      }

      if (deliveryMethod === 'pickup') {
        enableNearestLocations(typeof data.nearest_locations !== 'undefined' ? data.nearest_locations : null);
        $('.js-product-pickup-variants').trigger('change');
        const unitPrice = $('.js-product-pickup-variants option:selected').data('price');
        const totalPrice = unitPrice * $('.js-product-quantity').val();
        showProductPricing({
          additional_miles_cost: 0,
          fulfillment: 'pickup',
          unit_price: unitPrice,
          total_price: totalPrice
        });

        if (
          typeof isBundle !== 'undefined' &&
          !!isBundle
        ) {
          // Disable show submit button when it's a pickup type in order to force the user to select a pickup location
          // toggleSubmitButton('show', 'js-product-submit');
          showButtonMessage('pickup');
          if (
            typeof usesVariantToggle !== 'undefined' ||
            typeof usesRegularToggle !== 'undefined'
          ) {
            checkChosenVariant();
          }
        }

      } else if (deliveryMethod === 'delivery') {
        chooseVariant('delivery');
        showProductPricing(data);
      }
    }).fail(function () {
      button.html(originalText);
      availiabilityError({zipCode: zipCode});
      hideFormElements();
    });
  };

  const showButtonMessage = function (deliveryMethod) {
    const submitButtonTextDelivery = $('.js-add-to-cart-text-delivery');
    const submitButtonTextPickup = $('.js-add-to-cart-text-pickup');
    submitButtonTextDelivery.addClass('hide');
    submitButtonTextPickup.addClass('hide');

    if (deliveryMethod === 'delivery') {
      submitButtonTextDelivery.removeClass('hide');
    } else if (deliveryMethod === 'pickup') {
      submitButtonTextPickup.removeClass('hide');
    }
  };

  const availiabilityError = function (data) {
    if (
      typeof data !== 'undefined' &&
      data &&
      typeof data.zipCode !== 'undefined'
    ) {
      updateForm(data.zipCode);
    }

    showProductPricing();

    if (data === 'pickup-select') {
      hideFormElements('.js-not-available-pickup-text');
    } else {
      hideFormElements();
    }

    toggleSubmitButton('show', 'js-product-price-check');
    const submitButton = $('.js-product-submit');
    if (!submitButton.hasClass('hide')) {
      toggleSubmitButton('hide');
    }
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

      dropdown.addClass('js-dropdown-with-minimums')

      const options = data.reduce(function (acc, customLocation) {
        return (
          acc +
          '<option value="' +
          (typeof customLocation.location_name !== 'undefined' ? customLocation.location_name : customLocation) +
          '"' +
          (typeof customLocation.unit_price !== 'undefined'
            ? ' data-price="' + customLocation.unit_price + '"'
            : "") +
          (
            typeof customLocation.pickup !== 'undefined'
            ? ' data-available="' + customLocation.pickup + '"'
            : ''
          ) +
          ">" +
          (typeof customLocation.location_name !== 'undefined' ? customLocation.location_name : customLocation) +
          (typeof customLocation.distance !== 'undefined' ? ' (' + customLocation.distance + ' miles away)' : '') +
          "</option>"
        );
      }, '<option value="" disabled selected="selected" >Select a pickup location</option>');
      dropdown.html(options);
      dropdown.removeAttr('disabled')
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

    if (isNaN(data.total_price)) {
      return;
    }

    const type = data.fulfillment == 'delivery' ? 'Delivered' : 'Pickup';

    productObject.fullPrice = data.total_price * 100;
    productObject.unitPrice = data.unit_price ? data.unit_price * 100 : data.total_price * 100;
    if (data.fulfillment === 'delivery') {
      productObject.unitPrice = productObject.unitPrice / $('.js-product-quantity').val();
    }
    $('.js-custom-value').val(productObject.unitPrice / 100);
    priceElement.html(type + ' price: ' + Shopify.formatMoney(productObject.fullPrice, theme.moneyFormat));
     priceElement.removeClass('hide');
  };

  const changeDeliveryForm = function (ev) {
    const input = ev.target;
    if (!input.checked) {
      return;
    }

    $('.js-not-available-text').addClass('hide');
    $('.js-not-available-delivery-text').addClass('hide');
    $('.js-not-available-pickup-text').addClass('hide');

    changeDeliveryElements(input);
    const submitButton = $('.js-product-submit');
    if (!submitButton.hasClass('hide')) {
      toggleSubmitButton('hide');
    }
    $('.js-current-price-unit').addClass('hide');
    const zipCode = $('.js-zip-code').val();
    if (zipCode == '' || zipCode == null) {
      return;
    } else if (typeof usesVariantToggle !== 'undefined') {
      checkChosenVariant();
      return;
    }
    chooseVariant(input.value);
  };

  const checkChosenVariant = function () {
    let variantText = '';

    if (typeof isMultiOption !== 'undefined' && isMultiOption) {
      const selectedOptions = document.querySelectorAll('.js-product-variant');
      for (let i = 0; i < selectedOptions.length; i++) {
        const element = selectedOptions[i];
        variantText += (variantText === '' ? '' : ' / ') + element.options[element.selectedIndex].text;
      }
    } else if (typeof hasMultipleOptions !== 'undefined') {
      const input = document.querySelector('.js-delivery-method:checked');
      const firstOption = document.querySelector('.js-first-product-variant').value;
      variantText = firstOption + ' / ' + Utils.capitalize(input.value);
    } else {
      const input = document.querySelector('.js-delivery-method:checked');
      if (input) {
        variantText = input.value;
      }
    }

    if (variantText !== '') {
      chooseVariantToggle(variantText);
    }
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
      return variant.text.toLocaleLowerCase().indexOf(value.toLocaleLowerCase()) > -1;
    });
    changeDropdownOptions(foundVariant.length > 0 ? foundVariant[0].id : null);
  };

  const selectMultivariant = function (ev) {
    checkChosenVariant();
  };

  const chooseVariantToggle = function (value) {
    const variants = getVariants();
    const foundVariant = variants.filter(function (variant) {
      return (
        ((variant.text).toLocaleLowerCase()).indexOf(value.toLocaleLowerCase()) > -1
      );
    });

    if (foundVariant.length < 1) {
      return;
    }

    const variantPriceInCents = parseFloat(foundVariant[0].priceValue) * 100;
    const variantFormattedPrice = Shopify.formatMoney(variantPriceInCents, theme.money_format)
    $('.js-product-single-price').html(variantFormattedPrice);
    $('.js-product-variants option').each(function (i, option) {
      if (option.value === foundVariant[0].id) {
        option.selected = true;
        $('.js-price-compare').html('$' + option.dataset.compareVal);
      }
    });
  };

  const updateBundleSelector = function () {
    if (typeof isBundle !== 'undefined' && isBundle) {
      const deliveryInput = document.querySelector('.js-delivery-method:checked');
      const deliveryMethod = deliveryInput.value;
      $('.bold-bundles-child-product__variant-selector').each(function (i, element) {
        for (let j = 0; j < element.options.length; j++) {
          const option = element.options[j];
          if (option.text.toLocaleLowerCase() === deliveryMethod) {
            option.selected = true;
          }
        }
        $(element).trigger('change');
      });
    }
  };

  const changeDeliveryElements = function (input, skipTriggers) {
    $('.js-quantity-block').addClass('hide');
    $('.js-quantity-input').prop('disabled', true);
    $('.js-quantity-input-' + (input.value)).removeAttr('disabled');
    $('.js-' + (input.value) + '-quantity-block').removeClass('hide');
    $('.js-product-quantity').val( $('.js-quantity-input-' + (input.value)).val() );

    if (input.value === 'delivery' && minimumQuantity != null) {
      $('.js-quantity-input-' + (input.value)).prop('min', minimumQuantity);
    }
    if (input.value === 'pickup' && !skipTriggers) {
      updatePickUpLocations();
    }

    $('.js-quantity-input-' + (input.value)).trigger('change');
    $('.js-increment-value').val( $('.js-quantity-input-' + (input.value)).prop('min') );
    $('.js-product-pickup-variants').prop('disabled', input.value === 'delivery');
    updateBundleSelector();
  };

  const checkQuantityIncrement = function (ev) {
    const input = ev.target;
    const value = parseInt(input.value);
    const increment = parseInt(input.getAttribute('step'));
    const minimum = parseInt(input.getAttribute('min'));
    const wrongQuantityText = $('.js-wrong-quantity');
    const wrongMinimumQuantityText = $('.js-wrong-min-quantity');
    const deliveryMethodInput = $('.js-delivery-method:checked');
    const submitButton = $('.js-product-price-check');

    const unitPrice = parseFloat( $('.js-product-pickup-variants option:selected').data('price') );
    let totalPrice = unitPrice * value ;

    if (ev.type === 'keyup' || ev.type === 'input') {
      if ( $('.js-dropdown-with-minimums') ) {
        showProductPricing({
          additional_miles_cost: 0,
          fulfillment: 'pickup',
          unit_price: unitPrice,
          total_price: totalPrice
        });   
      } else {
        hideSubmitButton();
      }

      if (checkPULocationsTimeout) {
        clearTimeout(checkPULocationsTimeout);
      }
      checkPULocationsTimeout = setTimeout(function () {
        if (input.classList.contains('js-quantity-input-pickup')) {
          updatePickUpLocations();
        }
      }, 300);
    }

    wrongQuantityText.addClass('hide');
    wrongMinimumQuantityText.addClass('hide');
    $('.js-not-available-text').addClass('hide');
    $('.js-minimum-quantity-alert').addClass('hide');

    if (value < 0) {
      $('.js-product-quantity').val(0);
      toggleSubmitButton('disable');
      toggleSubmitButton('', 'js-product-price-check');
      return;
    } else if (deliveryMethodInput.val() == 'delivery' && value < minimum) {
      $('.js-min-number').html(minimum);
      wrongMinimumQuantityText.removeClass('hide');
      toggleSubmitButton('disable');
      toggleSubmitButton('', 'js-product-price-check');
      return;
    } else if (value % increment !== 0) {
      $('.js-product-quantity').val(0);
      $('.js-multiple-number').html(increment);
      wrongQuantityText.removeClass('hide');
      toggleSubmitButton('hide');
      toggleSubmitButton('', 'js-product-price-check');
      return;
    }
    toggleSubmitButton('show', 'js-product-price-check');

    $('.js-product-quantity').val(value);

    const deliveryInput = document.querySelector('.js-delivery-method:checked');
    const deliveryMethod = deliveryInput.value;
    if (deliveryMethod === 'delivery') {
      const zipCode = (document.querySelector('.js-zip-code').value).trim();
      if (!zipCode || zipCode == '' || zipCode.length < 5) {
        toggleSubmitButton('disable');
        return;
      }
    }

    submitButton.html('Check delivery price');
    toggleSubmitButton('enable');
  };

  const toggleSubmitButton = function (action, customSelector) {
    let buttons = document.getElementsByClassName('js-product-submit');

    if (typeof customSelector !== 'undefined' && customSelector !== null) {
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
        priceValue: priceToNumber(option.getAttribute('data-price-val')),
        text: option.text,
        zips: zips
      };
    });
  };

  const priceToNumber = function (originalPrice) {
    if (typeof originalPrice === 'undefined') {
      return 0;
    }

    const processedPrice = originalPrice.replace(/,/g, '');
    return processedPrice;
  };

  const updateForm = function (zipCode) {
    const deliveryMethodInput = $('.js-delivery-method:checked')[0];
    changeDeliveryElements(deliveryMethodInput, true);

    const parameters = [];

    if (deliveryMethodInput.value === 'delivery') {
      parameters.push({ parameter: 'zip_code', value: zipCode });
      parameters.push({
        parameter: 'customer_address',
        value: $('.js-autocomplete-address').val(),
      });
    }

    parameters.push({ parameter: 'delivery_method', value: deliveryMethodInput.value });
    Utils.addToCartParameters(parameters);
  };

  const selectPickupVariant = function (ev) {
    const select = ev.target;
    const selectedVariant = select.value;
    // Pick the quantity from the option selected, this will have the minimum quantity for this zone
    const zipcode = selectedVariant.match(/(\d{5})$/);
    if ( select.classList.contains('js-product-pickup-variants') ) {
      if ( zipcode !== null ) {
        const productString = '&products[]id=' + productData.id + '&products[]quantity=' + $('.js-product-quantity').val() + '&products[]type=' + productData.type + '&products[]name=' + productData.name;
        const dataString = 'zipcode=' + zipcode[0] + productString + '&shop_domain=' + theme.routes.validation_tool_shop + '&customer_type=retail';
        const endpoint = 'check_products';
        if (select.classList.contains('js-dropdown-with-minimums') && selectedVariant.length > 0 ) {
          $.ajax({
            type: 'GET',
            url: theme.routes.validation_tool_url + endpoint,
            data: dataString,
            timeout: 3000,
            success: function(result){
              const selectedMinimumQuantity = result.delivery_pickup_aviability[0].minimum_pickup;
              const type = result.delivery_pickup_aviability[0].type;
              
              if ( type == 'Sod' ) {
                if ( typeof(selectedMinimumQuantity) !== 'undefined' && typeof(selectedMinimumQuantity) !== null ){
                  $('.js-quantity-input-pickup').attr('min', selectedMinimumQuantity);
                  $('.js-minimum-quantity-alert').removeClass('hide')
                  $('.js-minimum-quantity-alert-value').text(selectedMinimumQuantity);  
                  document.getElementById('pickup-uantity').value = selectedMinimumQuantity;   
                  const unitPrice = $('.js-product-pickup-variants option:selected').data('price');
                  const totalPrice = unitPrice * document.getElementById('pickup-uantity').value;
                  showProductPricing({
                    additional_miles_cost: 0,
                    fulfillment: 'pickup',
                    unit_price: unitPrice,
                    total_price: totalPrice
                  });   
                }
              }
              return result.delivery_pickup_aviability[0].minimum_pickup;
                  }
          });
        }
      } else {
        hideSubmitButton();
      }
    };

    const variants = getVariants();
    const foundVariant = variants.filter(function (variant) {
      return selectedVariant.indexOf(variant.text) > -1;
    });
    const hasQuantityError = !$('.js-wrong-quantity').hasClass('hide');
    const selectedOption = select.options[select.selectedIndex];

    if (selectedOption.disabled) {
      toggleSubmitButton('disable');
      return;
    }

    let fullValue = 0;
    let unitPrice = 0;
    if (select.id === 'pickup-select') {
      let isEnabled = true;
      if (typeof selectedOption.dataset.available !== 'undefined') {
        isEnabled = (/true/i).test(selectedOption.dataset.available);
      }

      if (selectedVariant && isEnabled && !hasQuantityError) {
        toggleSubmitButton('show');
        $('.js-not-available-text').addClass('hide');
        $('.js-not-available-pickup-text').addClass('hide');
      } else {
        availiabilityError(select.id);
      }
    }

    if (
      typeof usesVariantToggle === 'undefined' &&
      typeof usesRegularToggle === 'undefined' &&
      typeof selectedOption.dataset.price !== 'undefined'
    ) {
      fullValue = selectedOption.dataset.price * $('.js-product-quantity').val();
      unitPrice = selectedOption.dataset.price * 1;
    } else if (foundVariant.length > 0) {
      fullValue = foundVariant[0].priceValue * $('.js-product-quantity').val();
      unitPrice = foundVariant[0].priceValue * 1;
      selectVariant(foundVariant[0]);
    } else {
      // If the select triggered is the pick up selector and there is no value do nothing
      if (select.id === 'pickup-select' && !selectedVariant) {
        return;
      }
      fullValue = $('.js-product-variants option:selected').data('price-val') * $('.js-product-quantity').val();
      unitPrice = $('.js-product-variants option:selected').data('price-val') * 1;
      chooseVariant('pickup');
    }
    if (!hasQuantityError) {
      showProductPricing({
        additional_miles_cost: 0,
        fulfillment: 'pickup',
        unit_price: unitPrice,
        total_price: fullValue
      });
    }

    const boldLinks = $('.js-product-form .bold-bundles-child-product__link');
    if (boldLinks.length > 0) {
      addBoldBundleParameters(selectedVariant);
    }
  };

  const selectVariant = function (variant) {
    $('.js-not-available-text').addClass('hide');
    $('.js-product-variants').val(variant.id);
    productObject.variantId = variant.id;
    toggleSubmitButton('enable');
  };

  const addBoldBundleParameters = function (selectedVariant) {
    const deliveryMethodInput = $('.js-delivery-method:checked')[0];
    const zipCode = $('.js-zip-code')[0];
    let parameters = [];
    parameters.push({parameter: 'zip_code', value: zipCode.value});
    parameters.push({parameter: 'delivery_method', value: deliveryMethodInput.value});
    parameters.push({parameter: 'customer_address', value: $('.js-autocomplete-address').val()});
    if (deliveryMethodInput.value === 'pickup') {
      parameters.push({parameter: 'pickup_address', value: selectedVariant});
    }
    if (typeof parameters === 'object' && parameters.length > 1) {
      Utils.addToCartParameters(parameters);
    }
  };

  const changeDropdownOptions = function (id) {
    const deliveryOption = $('.js-delivery-method:checked').val();

    if (id != null) {
      let found = 0;
      $('.js-product-variants option').each(function (i, option) {
        if (option.value != id) {
          option.removeAttribute('selected');
          return;
        }

        option.setAttribute('selected', true);
        found++;
      });

      if (found === 0) {
        changeDropdownOptions(null);
        return;
      }

      $('.js-product-variants').trigger('change');
      updateBundleSelector();
      return;
    } else if (deliveryOption === 'pickup') {
      $('.js-product-variants').show();
    } else if (deliveryOption === 'delivery') {
      $('.js-product-variants').hide();
    }
  };

  const hideFormElements = function (selector) {
    $(selector ? selector : '.js-not-available-text').removeClass('hide');
    toggleSubmitButton('disable');
  };

  const changeLabelPrice = function (ev) {
    const dropdown = ev.target;
    const selectedOption = dropdown.options[dropdown.selectedIndex];
    $('.js-product-single-price').html('$' + selectedOption.dataset.priceVal);
    if (selectedOption.dataset.compareVal !== null) {
      $('.js-price-compare').html('$' + selectedOption.dataset.compareVal);
    }
    if (document.querySelector('.js-date-selector-custom-value')) {
      document.querySelector('.js-date-selector-custom-value').value = selectedOption.dataset.priceVal;
      document.querySelector('.js-pickup-location').value = selectedOption.text;
    }
  };

  const resetAddressInput = function (ev) {
    const input = ev.target;
    const value = input.value.trim();
    $('.js-not-available-text').addClass('hide');
    $('.js-not-available-delivery-text').addClass('hide');
    $('.js-not-available-pickup-text').addClass('hide');
    $('.js-delivery-method').prop('disabled', 0 );
    $('.js-msg-availability' ).removeClass('not-available');
    $('.js-current-price-unit').addClass('hide');

    const submitButton = $('.js-product-price-check');
    submitButton.html('Check delivery price');

    if (value.length < 6) {
      $('.js-address-latitude').val('');
      $('.js-address-longitude').val('');
      $('.js-zip-code').val('');
      $('.js-customer-address').val('');
    }
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

    $('.js-zip-not-found').addClass('hide');
    $('.js-zip-code').prop('readonly', true);

    for (const component in componentForm) {
      if (!document.getElementById(component)) {
        continue;
      }
      document.getElementById(component).value = '';
      document.getElementById(component).disabled = false;
    }

    productObject.geometry = null;
    $('.js-address-latitude').val('');
    $('.js-address-longitude').val('');
    $('.js-zip-code').val('');
    $('.js-customer-address').val('');

    if (typeof place === 'undefined') {
      return
    } else if (typeof place.address_components === 'undefined') {
      return;
    }

    if (typeof place.geometry !== 'undefined') {
      productObject.geometry = {
        latitude: place.geometry.location.lat(),
        longitude: place.geometry.location.lng()
      };
    }

    for (let i = 0; i < place.address_components.length; i++) {
      const component = place.address_components[i];
      const addressType = component.types[0];

      if (document.getElementById(addressType) && componentForm[addressType]) {
        const val = component[componentForm[addressType]];
        document.getElementById(addressType).value = val;
        $('#' + addressType).trigger('change');
        if (addressType === 'postal_code') {
          productObject.geometry.zipCode = val;
          parameters.push({parameter: 'zip_code', value: productObject.geometry.zipCode});
        }
      }
    }

    const hasZipCode = parameters.some(function (data) {
      return data.parameter === 'zip_code';
    });

    if (typeof productObject.geometry.zipCode !== 'undefined') {
      const customerAddress = $('.js-autocomplete-address').val()
      $('.js-customer-address').val(customerAddress);
      $('.js-address-latitude').val(productObject.geometry.latitude);
      $('.js-address-longitude').val(productObject.geometry.longitude);
      parameters.push({parameter: 'customer_latitude', value: productObject.geometry.latitude});
      parameters.push({parameter: 'customer_longitude', value: productObject.geometry.longitude});
      parameters.push({parameter: 'customer_address', value: customerAddress});
    }

    parameters.push({ parameter: 'delivery_method', value: document.querySelector('.js-delivery-method:checked').value });

    if (!hasZipCode) {
      parameters.push({parameter: 'zip_code', value: ''});
      $('.js-zip-not-found').removeClass('hide');
      $('.js-zip-code').prop('readonly', false);
    }

    if (typeof parameters === 'object' && parameters.length > 1) {
      Utils.addToCartParameters(parameters);
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

  const switchImage = function (ev) {
    ev.preventDefault();
    const imageId = $(this).attr('data-image-id');

    const $newImage = $(
      ".js-image-wrapper[data-image-id='" +
        imageId +
        "']"
    );
    const $otherImages = $(
      ".js-image-wrapper:not([data-image-id='" +
        imageId +
        "'])"
    );

    $newImage.removeClass('hidden');
    $otherImages.addClass('hidden');
  };

  const addZoomImage = function () {
    $('.js-product-single-photo').magnificPopup({
      type: 'image',
      mainClass: 'mfp-fade',
      closeOnBgClick: true,
      closeBtnInside: false,
      closeOnContentClick: true,
      tClose: theme.strings.zoomClose,
      removalDelay: 500,
      callbacks: {
        open: function() {
          $('html').css('overflow-y', 'hidden');
        },
        close: function() {
          $('html').css('overflow-y', '');
        }
      },
      gallery: {
        enabled: true,
        navigateByImgClick: false,
        arrowMarkup:
          '<button title="%title%" type="button" class="mfp-arrow mfp-arrow-%dir%"><span class="mfp-chevron mfp-chevron-%dir%"></span></button>',
        tPrev: theme.strings.zoomPrev,
        tNext: theme.strings.zoomNext
      }
    });
  };

  const hideAddToCart = function () {
    const quantityInputs = $('.js-quantity-input#delivery-quantity');
    if (quantityInputs.length === 1) {
      const synteticEv = {
        target: quantityInputs[0]
      }
      checkQuantityIncrement(synteticEv);
    }
  };

  const startBundleObserver = function () {
    const targetNode = document.querySelector('.js-product-form');
    const config = { attributes: true, childList: true, subtree: true };
    const callback = function (mutationsList, observer) {
      for (let i = 0; i < mutationsList.length; i++) {
        const mutation = mutationsList[i];
        if (mutation.type === 'childList') {
          const bundleVariantDropdowns = document.querySelectorAll('.bold-bundles-child-product__variant-selector');
          if (bundleVariantDropdowns.length > 0) {
            observer.disconnect();
            hideDropdowns(bundleVariantDropdowns);
          }
        }
      }
    }

    const observer = new MutationObserver(callback);
    observer.observe(targetNode, config);
  };

  const hideDropdowns = function (dropdowns) {
    for (let i = 0; i < dropdowns.length; i++) {
      const dropdown = dropdowns[i];
      let hasDeliveryVariant = false;
      for (let j = 0; j < dropdown.options.length; j++) {
        const option = dropdown.options[j];
        if (option.text.toLocaleLowerCase() === 'delivery') {
          hasDeliveryVariant = true;
        }
      }
      if (hasDeliveryVariant) {
        dropdown.classList.add('sr-only');
      }
    }
  };

  const choosePickUpMode = function (ev) {
    ev.preventDefault();
    $('.js-not-available-delivery').addClass('hide');
    const pickUpButton = document.querySelector('.js-delivery-method[value="pickup"]');
    if (pickUpButton) {
      pickUpButton.click();
    }
  };

  const updatePickUpLocations = function () {
    const fakeButton = document.createElement('button');
    const dropdown = $('.js-product-pickup-variants');
    dropdown.removeClass('hide');
    dropdown.html('<option value="" selected="selected" disabled="true">Loading...</option>');
    setTimeout(() => {
      dropdown[0].setAttribute('disabled', 1);
    }, 0)
    checkZipCode({ target: fakeButton });

  };

  return {
    init: init
  }
})();

Product.init();
