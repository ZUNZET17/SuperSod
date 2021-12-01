const addRecommended = function (ev) {
  ev.preventDefault();
  let input = ev.target;
  let bybId = input.getAttribute("data-id");
  let bybQty = document.querySelector('.js-byb-quantity').value;
  debugger
  let attributes = JSON.parse(document.querySelector('.js-byb-properties').getAttribute('data-properties').replaceAll('=>', ': '));
  console.log(attributes)

  jQuery.post('/cart/add.js', {
    items: [
      {
        quantity: bybQty,
        id: bybId,
        properties: attributes
      }
    ]
  });

}

$(document).on('click', '.js-byb-add-to-cart', addRecommended);




