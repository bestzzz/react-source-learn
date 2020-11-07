import {createUnit} from './unit';
import {createElement} from './element';
import Component from './component';
import $ from 'jquery';

const React = {
  render,
  rootIndex: 0,
  createElement,
  Component
}

// element可能是个 文本/jsx/dom
function render(element, container) {
  // container.innerHTML = `<span data-reactid=${React.rootIndex}>${element}</span>`;
  let unit = createUnit(element);
  let markUp = unit.getHTMLString(React.rootIndex); // 用来返回html标记
  container.innerHTML = markUp;
  $(document).trigger('mounted');
};

export default React;
