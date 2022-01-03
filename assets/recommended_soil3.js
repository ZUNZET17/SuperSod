
const addRecommended = function (ev) {
  ev.preventDefault();
  let input = ev.target;
  let recommendedProductId = input.getAttribute("data-id");
  let qty = document.querySelector('.js-byb-quantity').value;
  let attributes = JSON.parse(document.querySelector('.js-byb-properties').getAttribute('data-properties').replaceAll('=>', ': '));

  jQuery.post('/cart/add.js', {
    items: [
      {
        quantity: qty,
        id: recommendedProductId,
        properties: attributes
      }
    ]
  })
  window.localStorage.setItem('recommendedProduct', recommendedProductId);

   setTimeout(function() {
     location.reload();
   }, 1000)

}

const updateRecommendedProductPrice = function (ev) {
  const input = ev.target;
  const qty = input.value;
  const price = parseInt( document.querySelector('.js-recommended-product-price').getAttribute('value') );
  let total = price * qty;

  $('.js-recommended-product-price').text(Utils.formatMoneyWithPrecision(total) + ' USD');
}

$(document).on('click', '.js-byb-add-to-cart', addRecommended).on('change keyup input', '.js-byb-quantity', updateRecommendedProductPrice);
