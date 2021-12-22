
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
  setTimeout(function() {
    location.reload()
  }, 1000)

}

$(document).on('click', '.js-byb-add-to-cart', addRecommended);




