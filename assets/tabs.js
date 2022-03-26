const Tabs = (function () {
  let tablist = document.querySelectorAll('[role="tablist"]')[0];
  let tabs;
  let panels;
  let delay = 0;
  const keys = {
    end: 35,
    home: 36,
    left: 37,
    up: 38,
    right: 39,
    down: 40,
    delete: 46
  };

  // Add or substract depending on key pressed
  const direction = {
    37: -1,
    38: -1,
    39: 1,
    40: 1
  };

  const setTabsBehavior = function () {
    delay = determineDelay();
    generateArrays();
    for (let i = 0; i < tabs.length; ++i) {
      addListeners(i);
    }
  };

  const determineDelay = function () {
    const hasDelay = tablist.hasAttribute('data-delay');
    if (! hasDelay) {
      return 0;
    }
    const delayValue = tablist.getAttribute('data-delay');
    if (delayValue) {
      return delayValue;
    }
    return 300;
  };

  const generateArrays = function () {
    tabs = document.querySelectorAll('[role="tab"]');
    panels = document.querySelectorAll('[role="tabpanel"]');
  };

  const addListeners = function (index) {
    tabs[index].addEventListener('click', clickEventListener);
    tabs[index].addEventListener('keydown', keydownEventListener);
    tabs[index].addEventListener('keyup', keyupEventListener);

    // Build an array with all tabs (<button>s) in it
    tabs[index].index = index;
  };

  const clickEventListener = function (event) {
    activateTab(event.target, false);
  };

  const keydownEventListener = function (event) {
    const key = event.keyCode;

    switch (key) {
      case keys.end:
        event.preventDefault();
        // Activate last tab
        activateTab(tabs[tabs.length - 1]);
        break;
      case keys.home:
        event.preventDefault();
        // Activate first tab
        activateTab(tabs[0]);
        break;

      // Up and down are in keydown
      // because we need to prevent page scroll >:)
      case keys.up:
      case keys.down:
        determineOrientation(event);
        break;
    };
  };

  const keyupEventListener = function (event) {
    const key = event.keyCode;

    switch (key) {
      case keys.left:
      case keys.right:
        determineOrientation(event);
        break;
      case keys.delete:
        determineDeletable(event);
        break;
    };
  };

  const activateTab = function (tab, setFocus) {
    setFocus = setFocus || true;
    // Deactivate all other tabs
    deactivateTabs();

    // Remove tabindex attribute
    tab.removeAttribute('tabindex');

    // Set the tab as selected
    tab.setAttribute('aria-selected', 'true');

    // Get the value of aria-controls (which is an ID)
    var controls = tab.getAttribute('aria-controls');

    // Remove hidden attribute from tab panel to make it visible
    document.getElementById(controls).removeAttribute('hidden');

    // Set focus when required
    if (setFocus) {
      tab.focus();
    };
  };

  const determineOrientation = function (event) {
    const key = event.keyCode;
    const vertical = tablist.getAttribute('aria-orientation') == 'vertical';
    let proceed = false;

    if (vertical && (key === keys.up || key === keys.down)) {
      event.preventDefault();
      proceed = true;
    }
    else if (key === keys.left || key === keys.right) {
      proceed = true;
    }

    if (proceed) {
      switchTabOnArrowPress(event);
    }
  };

  const switchTabOnArrowPress = function (event) {
    const pressed = event.keyCode;
    for (let x = 0; x < tabs.length; x++) {
      tabs[x].addEventListener('focus', focusEventHandler);
    }
    if (!direction[pressed]) {
      return;
    }
    const target = event.target;
    if (target.index === undefined) {
      return;
    }
    if (tabs[target.index + direction[pressed]]) {
      tabs[target.index + direction[pressed]].focus();
    } else if (pressed === keys.left || pressed === keys.up) {
      focusLastTab();
    } else if (pressed === keys.right || pressed == keys.down) {
      focusFirstTab();
    }
  };

  const deactivateTabs = function () {
    for (let t = 0; t < tabs.length; t++) {
      tabs[t].setAttribute('tabindex', '-1');
      tabs[t].setAttribute('aria-selected', 'false');
      tabs[t].removeEventListener('focus', focusEventHandler);
    }

    for (let p = 0; p < panels.length; p++) {
      panels[p].setAttribute('hidden', 'hidden');
    }
  };

  const focusFirstTab = function () {
    tabs[0].focus();
  };

  const focusLastTab = function () {
    tabs[tabs.length - 1].focus();
  };

  const determineDeletable = function (event) {
    target = event.target;
    if (target.getAttribute('data-deletable') == null) {
      return;
    }
    // Delete target tab
    deleteTab(event, target);

    // Update arrays related to tabs widget
    generateArrays();

    // Activate the closest tab to the one that was just deleted
    if (target.index - 1 < 0) {
      activateTab(tabs[0]);
      return;
    }
    activateTab(tabs[target.index - 1]);
  };

  const deleteTab = function (event) {
    let target = event.target;
    let panel = document.getElementById(target.getAttribute('aria-controls'));

    target.parentElement.removeChild(target);
    panel.parentElement.removeChild(panel);
  };

  const focusEventHandler = function (event) {
    const target = event.target;
    setTimeout(checkTabFocus, delay, target);
  };

  const checkTabFocus = function (target) {
    focused = document.activeElement;

    if (target === focused) {
      activateTab(target, false);
    }
  };

  return {
    setTabsBehavior: setTabsBehavior
  };
})();

Tabs.setTabsBehavior();