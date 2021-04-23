const QTY_CLASS_NAME = "quantity";
const QTY_INPUT_CLASS_NAME = "quantity__input";
const QTY_BTN_CLASS_NAME = "quantity__button";
const SELECTOR_QTY = `.${QTY_CLASS_NAME}`;
const SELECTOR_QTY_INPUT = `.${QTY_INPUT_CLASS_NAME}`;

class QuantityUI {
  constructor(numberInput) {
    this.input = numberInput;
    this.minus = null;
    this.plus = null;
    this._validate();
    this._addListeners();
  }

  _validate() {
    if (this.input.type !== "number") {
      throw new Error('element must be an input with type="number"');
    }

    if (!this.input.closest(SELECTOR_QTY)) {
      throw new Error(
        "element must have a parent with the class name: " + QTY_CLASS_NAME
      );
    }

    this.minus = this.input
      .closest(SELECTOR_QTY)
      .querySelector("[data-quantity-decrement]");
    this.plus = this.input
      .closest(SELECTOR_QTY)
      .querySelector("[data-quantity-increment]");

    return true;
  }

  _addListeners() {
    this.minus.addEventListener("click", this._decrement);
    this.plus.addEventListener("click", this._increment);
  }

  _decrement = (e) => {
    this.input.stepDown();
    this._forceChange();
  };

  _increment = (e) => {
    this.input.stepUp();
    this._forceChange();
  };

  _forceChange = (e) => {
//     const ev = new Event('change');
//     this.input.dispatchEvent(ev);
    
	// above not working, so putting this in for now
    let updateWarning = this.input.closest(SELECTOR_QTY).querySelector('.js-update-cart-message');
    console.log(typeof updateWarning);
    updateWarning.classlist.remove('hide');
  }
}


// init 

let qtyInputs = document.querySelectorAll(SELECTOR_QTY_INPUT);

qtyInputs.forEach(qtyInput => {
	new QuantityUI(qtyInput);
});