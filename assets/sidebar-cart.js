theme.createCookie = function (name, value, days) {
  var expires = "";

  if (days) {
    var date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = "; expires=" + date.toUTCString();
  }

  document.cookie = name + "=" + value + expires + "; path=/";
};

theme.readCookie = function (name) {
  var nameEQ = name + "=";

  try {
    var ca = document.cookie.split(';');

    for (var i = 0; i < ca.length; i++) {
      var c = ca[i];

      while (c.charAt(0) == ' ') {
        c = c.substring(1, c.length);
      }

      if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
  } catch (error) {}

  return null;
};

theme.eraseCookie = function (name) {
  theme.createCookie(name, "", -1);
};

theme.cartUpdatingRemoveTimeout = -1;

theme.cartLoadingStarted = function () {
  $('body').addClass('updating-cart');
};

theme.cartLoadingFinished = function () {
  clearTimeout(theme.cartUpdatingRemoveTimeout);
  setTimeout(function () {
    $('body').removeClass('updating-cart');
  }, 500);
};

theme.loadInPlaceQuantityAdjustment = function (container, itemData) {
  // handling both mini product forms and quantity updaters (inc in cart)
  if ($('.qty-adjuster:first', container).length) {
    var updateGridWithItemData = function updateGridWithItemData(data) {
      $('.product-form--mini', container).addClass('product-form--temp-could-remove');

      for (var i = 0; i < data.items.length; i++) {
        var item = data.items[i],
            $qtyAdj = null; // mini form

        var $form = $('.product-form--mini[data-product-id="' + item.product_id + '"]', container);

        if ($form) {
          $form.addClass('product-form--added').removeClass('product-form--temp-could-remove');
          $qtyAdj = $form.parent().find('.qty-adjuster').attr('data-line-item-id', item.id);
        } // any qty adjuster


        if (!$qtyAdj) {
          $qtyAdj = $('.qty-adjuster[data-line-item-id="' + item.id + '"]', container);
        }

        if ($qtyAdj) {
          $qtyAdj.find('.qty-adjuster__value').val(item.quantity);
          var limitReached = typeof $qtyAdj.data('limit') !== 'undefined' && item.quantity >= $qtyAdj.data('limit');

          if (limitReached) {
            $qtyAdj.find('.qty-adjuster__up').attr('disabled', 'disabled');
          } else {
            $qtyAdj.find('.qty-adjuster__up').removeAttr('disabled');
          }
        }
      }

      $('.product-form--temp-could-remove', container).removeClass('product-form--added product-form--temp-could-remove');
    };

    if (itemData) {
      updateGridWithItemData(itemData);
    } else {
      $.getJSON(theme.routes.cart_url + '.js', updateGridWithItemData);
    }
  }
};

theme.applyAjaxToProductForm = function ($form_param) {
  var shopifyAjaxAddURL = theme.routes.cart_add_url + '.js';
  var shopifyAjaxCartURL = theme.routes.cart_url + '.js';
  $form_param.filter('[data-ajax-add-to-cart="true"]').on('submit', function (e) {
    e.preventDefault();
    var $form = $(this); // Disable add button

    $form.find(':submit').attr('disabled', 'disabled').each(function () {
      var contentFunc = $(this).is('button') ? 'html' : 'val';
      $(this).data('previous-value', $(this)[contentFunc]())[contentFunc](theme.strings.productAddingToCart);
    }); // add class to page

    theme.cartLoadingStarted(); // Add to cart

    $.post(shopifyAjaxAddURL, $form.serialize(), function (itemData) {
      theme.createCookie('theme_added_to_cart', 'justnow', 1); // Update persistent cart summaries

      if ($form.closest('.quickbuy-form').length == 0) {
        // enable add button
        var $btn = $form.find(':submit').each(function () {
          var $btn = $(this);
          var contentFunc = $(this).is('button') ? 'html' : 'val'; //Set to 'DONE', alter button style, wait a few secs, revert to normal

          $btn.removeAttr('disabled')[contentFunc](theme.strings.productAddedToCart);
          setTimeout(function () {
            $btn[contentFunc]($btn.data('previous-value'));
          }, 2000);
        }).first(); // update and reveal sidebar

        theme.updateCartSummaries(!$form.hasClass('product-form--mini'));
      } else {
        // transition out form
        var itemData = itemData; // get full product data

        if (!theme.productData[itemData.product_id]) {
          theme.productData[itemData.product_id] = JSON.parse(document.getElementById('ProductJson-' + itemData.product_id).innerHTML);
        }

        var productPrice = '';
        var productDiscounts = '';

        for (var i = 0; i < theme.productData[itemData.product_id].variants.length; i++) {
          var variant = theme.productData[itemData.product_id].variants[i];

          if (variant.id == itemData.variant_id) {
            if (itemData.final_price < itemData.original_price) {
              productPrice += ['<span class="added-notice__price-reduced theme-money">', theme.Shopify.formatMoney(itemData.final_price, theme.money_format), '</span> ', '<span class="added-notice__price-compare theme-money">', theme.Shopify.formatMoney(itemData.original_price, theme.money_format), '</span>'].join('');

              if (itemData.line_level_discount_allocations && itemData.line_level_discount_allocations.length > 0) {
                productDiscounts = '<ul class="cart-discount-list">';

                for (var j = 0; j < itemData.line_level_discount_allocations.length; j++) {
                  itemData.line_level_discount_allocations[j];
                  productDiscounts += ['<li class="cart-discount cart-discount--inline">', '<span class="cart-discount__label">', itemData.line_level_discount_allocations[j].discount_application.title, '</span>', '<span class="cart-discount__amount theme-money">', theme.Shopify.formatMoney(itemData.line_level_discount_allocations[j].amount, theme.money_format), '</span>', '</li>'].join('');
                }

                productDiscounts += '</ul>';
              }
            } else {
              productPrice += '<span class="theme-money">' + theme.Shopify.formatMoney(itemData.final_price, theme.money_format) + '</span>';
            }
          }
        }

        if (itemData.quantity > 1) {
          productPrice += '<span class="added-notice__quantity">x' + itemData.quantity + '</span>';
        }

        var productVariants = '';

        if (itemData.variant_options.length > 0) {
          // get option names from full product data
          var optionNames = theme.productData[itemData.product_id].options;
          productVariants = '<div class="added-notice__product__variants">';

          for (var i = 0; i < itemData.variant_options.length; i++) {
            if (itemData.variant_options[i].indexOf('Default Title') < 0) {
              productVariants += '<div class="added-notice__variant">';
              productVariants += '<span class="added-notice__variant-label">' + optionNames[i] + ':</span> ';
              productVariants += '<span class="added-notice__variant-value">' + itemData.variant_options[i] + '</span>';
              productVariants += '</div>';
            }
          }

          productVariants += '</div>';
        }

        $form.closest('.quickbuy-form').animate({
          opacity: 0
        }, 500, function () {
          // show 'thank you' message in lightbox
          var productImage = theme.Shopify.Image.getSizedImageUrl(itemData.image || '', '200x');
          var $template = $(['<div class="added-notice" style="opacity: 0">', '<div class="added-notice__title">' + theme.strings.quickbuyAdded + '</div>', '<div class="added-notice__tick" role="presentation">', theme.icons.tick, '</div>', '<div class="added-notice__product">', '<div class="added-notice__product-image"><img src="', productImage, '" alt="" role="presentation"></div>', '<div class="added-notice__product__description">', '<h2 class="added-notice__product-title">', itemData.product_title, '</h2>', '<div class="added-notice__price">', productPrice, '</div>', productDiscounts, productVariants, '</div>', '</div>', '<div class="added-notice__checkout"><a class="button" href="' + theme.routes.cart_url + '">' + theme.strings.cartSummary + '</a></div>', '<div class="added-notice__continue"><a class="close-box more-link" href="#">' + theme.strings.cartContinue + '</a></div>', '</div>'].join(''));
          $.colorbox({
            closeButton: false,
            preloading: false,
            open: true,
            speed: 200,
            transition: "elastic",
            html: ['<div class="action-icons">', '<a href="#" class="close-box action-icon" aria-label="', theme.strings.close, '">' + theme.icons.close + '</a>', '</div>', $template.wrap('<div>').parent().html()].join(''),
            onComplete: function onComplete() {
              $('.added-notice').animate({
                opacity: 1
              }, 500);
            }
          });
        }); // update sidebar

        theme.updateCartSummaries(false);
      }
    }, 'json').error(function (data) {
      //Enable add button
      var $firstBtn = $form.find(':submit').removeAttr('disabled').each(function () {
        var $btn = $(this);
        var contentFunc = $btn.is('button') ? 'html' : 'val';
        $btn[contentFunc]($btn.data('previous-value'));
      }).first(); //Not added, show message

      if (typeof data != 'undefined' && typeof data.status != 'undefined') {
        var jsonRes = $.parseJSON(data.responseText);
        theme.showQuickPopup(jsonRes.description, $firstBtn);
      } else {
        //Some unknown error? Disable ajax and submit the old-fashioned way.
        $form.attr('ajax-add-to-cart', 'false').submit();
      }
    }).complete(function () {
      theme.cartLoadingFinished();
    });
  });
};

theme.removeAjaxFromProductForm = function ($form_param) {
  $form_param.off('submit');
};

theme.updateCartSummaries = function (showCartSummary) {
  theme.cartLoadingStarted();
  var itemListScrollTop = $('.cart-summary__item-list:first').scrollTop(),
      cartDrawerInnerScrollTop = $('.cart-summary__inner:first').scrollTop();
  $.get(theme.routes.search_url, function (data) {
    var selectors = ['.toolbar-cart .current-cart', '.cart-summary']; // some little fiddles to make it parseable and resilient to broken markup

    var $parsed = $($.parseHTML('<div>' + data + '</div>')).wrap('<div>').parent();

    for (var i = 0; i < selectors.length; i++) {
      var cartSummarySelector = selectors[i];
      var $newCartObj = $parsed.find(cartSummarySelector).clone(); // do not transition images in again

      $newCartObj.find('.fade-in').removeClass('fade-in');
      var $currCart = $(cartSummarySelector);
      $currCart.replaceWith($newCartObj);
    }

    var cartItemData = JSON.parse($('#LimitedCartJson').html());
    theme.loadInPlaceQuantityAdjustment($('body'), cartItemData);
    theme.applyAjaxToProductForm($('.cart-summary form.product-form'));
    theme.loadCartNoteMonitor($('.cart-summary'));
    $('.cart-summary__item-list:first').scrollTop(itemListScrollTop);
    $('.cart-summary__inner:first').scrollTop(cartDrawerInnerScrollTop);

    if (theme.cartType != 'page') {
      //Show cart dropdown, if on a product page
      if (showCartSummary) {
        setTimeout(function () {
          $('body').addClass('show-cart-summary');
        }, 20);
      } // Remove updating classes


      $('.cart-summary.updating, .cart-summary .updating').removeClass('updating');
    }
  }).complete(function () {
    theme.cartLoadingFinished();
  });
};

var qtyAdjustXhttp = null,
    qtyAdjustDebounceTime = 700;
$(document).on('change', '.qty-adjuster--ajax .qty-adjuster__value', function (e) {
  // debounce
  if ($(this).data('postTimeout')) {
    clearTimeout($(this).data('postTimeout'));

    if (qtyAdjustXhttp) {
      qtyAdjustXhttp.abort();
    }
  }

  theme.cartLoadingStarted();
  $(this).data('postTimeout', setTimeout(function () {
    var postData = {
      quantity: $(this).val(),
      id: $(this).closest('.qty-adjuster').data('line-item-id')
    };

    if (qtyAdjustXhttp) {
      qtyAdjustXhttp.abort();
    }

    theme.cartLoadingStarted();
    qtyAdjustXhttp = $.post(theme.routes.cart_url + '/change.js', postData, function (data) {
      theme.updateCartSummaries(false);
      theme.loadInPlaceQuantityAdjustment($('body'), data);
      qtyAdjustXhttp = null;
    }, 'json').complete(function () {
      theme.cartLoadingFinished();
    });
  }.bind(this), qtyAdjustDebounceTime));
}); /// In-page links

function fixedNavWebkitHack() {
  if ($('body').hasClass('show-mobile-nav') || $('body').hasClass('show-cart-summary')) {
    var $headerAbove = $('.header-announcement--above');
    $('.toolbar.docked').css({
      position: 'absolute',
      top: $(window).scrollTop() - ($headerAbove.length ? $headerAbove.outerHeight(true) : 0),
      left: -15,
      right: -15,
      width: 'auto'
    });
  } else {
    setTimeout(function () {
      $('.toolbar').css({
        position: '',
        top: '',
        left: '',
        right: '',
        width: ''
      });
    }, 500);
  }
}

$(document).on('click', '.qty-adjuster--ajax .qty-adjuster__remove', function (e) {
  e.preventDefault();
  $(this).closest('.qty-adjuster').find('.qty-adjuster__value').val(0).trigger('change');
});

$(document).on('click', '[data-toggle-class]', function (e) {
  e.preventDefault();
  var spl = $(this).data('toggle-class').split('|');
  $(spl[1]).toggleClass(spl[0]);
  $(window).trigger('resize');
}); /// Accordions

$(document).on('click', '.cart-accordion-btn', function (e) {
  e.preventDefault();
  e.stopImmediatePropagation();
  var isHidden = $(this).parent().next().toggleClass('hidden').hasClass('hidden');
  $(this).toggleClass('cart-accordion-btn--collapsed', isHidden);

  if (!isHidden) {
    $(this).closest('.cart-summary').find('.cart-accordion-btn:not(.cart-accordion-btn--collapsed)').not(this).click();
  }
});

$(document).on('click', '.cart-accordion-btn-container', function (e) {
  e.preventDefault();
  $(this).find('.cart-accordion-btn').click();
}); /// Close side-modals

$(document).on('click', '.toggle-cart-summary', function (ev) {
  ev.preventDefault();
  // check if cart is toggleable
  if ($('.cart-summary .toggle-cart-summary').is(':visible')) {
    //prep for reveal
    $('#mobile-nav').removeClass('active');
    $('.cart-summary').addClass('active'); //toggle

    if (!$('body').toggleClass('show-cart-summary').hasClass('show-cart-summary')) {
      sideModTransOutHelper();
    }

    fixedNavWebkitHack();
    return false;
  }
});

theme.loadCartNoteMonitor = function (container) {
  $('.cart-form [name="note"]', container).on('change.themeLoadCartNoteMonitor', function () {
    $.post(theme.routes.cart_url + '/update.js', {
      note: $(this).val()
    }, function (data) {}, 'json');
  });
};

theme.unloadCartNoteMonitor = function (container) {
  $('.cart-form [name="note"]', container).off('change.themeLoadCartNoteMonitor');
};

if (typeof theme.readCookie('theme_added_to_cart') != 'undefined' && theme.readCookie('theme_added_to_cart') == 'justnow') {
  theme.eraseCookie('theme_added_to_cart');
  theme.updateCartSummaries(false);
} /// Heights in grids
