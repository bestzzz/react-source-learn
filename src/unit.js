import {Element} from './element';
import $ from 'jquery';
import types from './types';

let diffQueue; // 差异队列(补丁)
let updateDepth = 0; // 更新的级别

class Unit {
  constructor(element) {
    this._currentElement = element;
    this._reactid = null;
  }

  getHTMLString() {
    throw Error('无可用元素');
  }
};

class TestUnit extends Unit {
  getHTMLString(reactid) {
    this._reactid = reactid;
    return `<span data-reactid=${reactid}>${this._currentElement}</span>`;
  }

  update(nextElement) {
    if (this._currentElement === nextElement) {
      return;
    };

    this._currentElement = nextElement;
    $(`[data-reactid="${this._reactid}"]`).html(nextElement);
  }
}

class NativeUnit extends Unit {
  getHTMLString(reactid) {
    this._reactid = reactid;
    const {type, props} = this._currentElement;
    let tagStart = `<${type} data-reactid="${this._reactid}"`;
    const tagEnd = `</${type}>`;
    let childString = '';
    
    this._renderedChildrenUnits = [];

    /**
      {
        id: 'sayHello',
        style: {color: 'red', backgroundColor: 'blue'},
        onClick: sayHello
      }
     */
    for (let propName in props) {
      // 绑定事件
      if (/^on[A_Z]/.test(propName)) {
        const event = propName.slice(2).toLowerCase();
        $(document).delegate(`[data-reactid="${this._reactid}"]`, `${event}.${this._reactid}`, props[propName]);
      } else if (propName === 'className') {
        tagStart += `class=${props[propName]}`;
      } else if (propName === 'style') {
        const styleObj = props[propName];
        const styles = Object.entries(styleObj).map(([attr, value]) => {
          attr = attr.replace(/A-Z/g, (matched) => `-${matched.toLowerCase()}`);
          return `${attr}:${value}`;
        });
        tagStart += `style=${styles.join(';')}`;
      } else if (propName === 'children') {
        const children = props[propName];
        const childrenArr = children.map((item, index) => {
          const childUnit = createUnit(item);
          this._renderedChildrenUnits.push(childUnit);
          return childUnit.getHTMLString(`${this._reactid}.${index}`)
        });
        childString += childrenArr.join('\n');
      } else {
        tagStart += ` ${propName}=${props[propName]} `;
      }
    }

    return tagStart + '>' + childString + tagEnd;
  };

  update(nextElement) {
    const oldProps = this._currentElement.props;
    const newProps = nextElement.props;
    this.updateDOMProperties(oldProps, newProps);
    this.updateDOMChildren(nextElement.props.children);
  }

  // 此处要把新儿子们传过来，然后和老的儿子们比较，找出差异，修改dom
  updateDOMChildren(newChildrenElements) {
    updateDepth++;
    this.diff(diffQueue, newChildrenElements);
    updateDepth--;
    if (updateDepth === 0) {
      this.patch(diffQueue);
      diffQueue = [];
    }
  }

  // 打补丁
  patch(diffQueue) {
    const deleteChildren = []; // 这里放着所有要删除的节点
    const deleteMap = {}; // 这里暂存能复用的节点
    for (let i = 0; i < diffQueue.length; i++) {
      const difference = diffQueue[i];
      if (difference.type === types.MOVE || difference.type === types.REMOVE) {
        const fromIndex = difference.fromIndex;
        const oldChild = $(difference.parentNode.children().get(fromIndex));
        deleteMap[fromIndex] = oldChild;
        deleteChildren.push(oldChild);
      }
    }
    $.each(deleteChildren, (idx, item) => $(item).remove());

    for (let i = 0; i < diffQueue.length; i++) {
      const difference = diffQueue[i];
      switch (difference.type) {
        case types.INSERT:
          this.insertChildAt(difference.parentNode, difference.toIndex, $(difference.markUp));
          break;
        case types.MOVE:
          this.insertChildAt(difference.parentNode, difference.toIndex, deleteMap[difference.fromIndex]);
          break;
        default:
          break;
      }
    }
  }

  insertChildAt(parentNode, index, newNode) {
    const oldChild = parentNode.children().get(index);
    oldChild ? newNode.insertBefore(oldChild) : newNode.appendTo(parentNode);
  };

  diff(diffQueue, newChildrenElements) {
    // 第一步生成一个map, key===老的unit的key
    const oldChildrenUnitMap = this.getOldChildrenMap(this._renderedChildrenUnits);
    // 第二步生成一个新的儿子的unit数组
    const {newChildrenUnitMap, newChildrenUnits} = this.getNewChildrenUnits(oldChildrenUnitMap, newChildrenElements);

    let lastIndex = 0; // 上一个已经确定位置的索引
    for (let i = 0; i < newChildrenUnits.length; i++) {
      const newUnit = newChildrenUnits[i];
      const newKey = (newUnit._currentElement.props && newUnit._currentElement.props.key) || i;
      const oldChildUnit = oldChildrenUnitMap[newKey];
      if (oldChildUnit === newUnit) { // 如果新老单元一致 说明复用了老节点
        if (oldChildUnit._mountIndex < lastIndex) {
          diffQueue.push({
            parentId: this._reactid,
            parentNode: $(`[data-reactid="${this._reactid}"]`),
            type: types.MOVE,
            fromIndex: oldChildUnit._mountIndex,
            toIndex: i
          });
        }
        lastIndex = Math.max(lastIndex, oldChildUnit._mountIndex);
      } else {
        if (oldChildUnit) {
          diffQueue.push({
            parentId: this._reactid,
            parentNode: $(`[data-reactid="${this._reactid}"]`),
            type: types.REMOVE,
            fromIndex: oldChildUnit._mountIndex,
          });
          $(document).undelegate(`.${oldChildUnit._reactid}`);
        }
        diffQueue.push({
          parentId: this._reactid,
          parentNode: $(`[data-reactid="${this._reactid}"]`),
          type: types.INSERT,
          toIndex: i,
          markUp: newUnit.getMarkUp(`${this._reactid}.${i}`)
        });
      }
      newUnit._mountIndex = i;
    };

    for (let oldKey in oldChildrenUnitMap) {
      const oldChild = oldChildrenUnitMap[oldKey];
      if (!newChildrenUnitMap.hasOwnProperty(oldKey)) {
        diffQueue.push({
          parentId: this._reactid,
          parentNode: $(`[data-reactid="${this._reactid}"]`),
          type: types.REMOVE,
          fromIndex: oldChild._mountIndex
        });

        // 如果要删除掉某一个节点，则要把它对应的unit也删除掉
        this._renderedChildrenUnits = this._renderedChildrenUnits.filter(item => item != oldChild);
        // 还要把这个节点的事件委托也干掉
        $(document).undelegate(`.${oldChild._reactid}`);
      }
    }
  }
  
  getOldChildrenMap(childrenUnits = []) {
    let map = {};
    for(let i = 0; i < childrenUnits.length; i++) {
      const unit = childrenUnits[i];
      let key = (unit._currentElement.props && unit._currentElement.props.key) || i.toString();
      map[key] = unit;
    }
    return map;
  }

  getNewChildrenUnits(oldChildrenUnitMap, newChildrenElements) {
    let newChildrenUnits = [];
    let newChildrenUnitMap = {};
    newChildrenElements.forEach((newElement, index) => {
      const newKey = (newElement.props && newElement.props.key) || index.toString();
      const oldUnit = oldChildrenUnitMap[newKey]; // 找到老得unit
      const oldElement = oldUnit && oldUnit._currentElement; // 获取老元素

      if (shouldDeepCompare(oldElement, newElement)) {
        oldUnit.update(newElement);
        newChildrenUnits.push(oldUnit);
        newChildrenUnitMap[newKey] = oldUnit;
      } else {
        const newUnit = createUnit(newElement);
        newChildrenUnits.push(newUnit);
        newChildrenUnitMap[newKey] = newUnit;
        this._renderedChildrenUnits[index] = newUnit;
      }
    });

    return {newChildrenUnitMap, newChildrenUnits};
  };
  
  updateDOMProperties(oldProps, newProps) {
    let propName;
    for(propName in oldProps) {
      if(!newProps.hasOwnProperty(propName)) {
        $(`[data-reactid="${this._reactid}"]`).removeAttr(propName);
      }
      if(/^on[A-Z]/.test(propName)) {
        $(document).undelegate(`.${this._reactid}`);
      }
    }

    for (propName in newProps) {
      if (propName === 'children') {
        continue;
      } else if (/^on[A-Z]/.test(propName)) {
        const eventName = propName.slice(2).toLowerCase(); // click
        $(document).delegate(`[data-reactid="${this._reactid}"]`, `${eventName}.${this._reactid}`); 
      } else if (propName === 'className') {
        $(`[data-reactid="${this._reactid}"]`)[0].className = newProps[propName];
      } else if (propName === 'style') {
        const styleObj = newProps[propName];
        Object.entries(styleObj).map(([attr, value]) => {
          $(`[data-reactid="${this._reactid}"]`).css(attr, value);
        });
      } else {
        $(`[data-reactid="${this._reactid}"]`).prop(propName, newProps[propName]);
      }
    }
  }
};

class CompositeUnit extends Unit {
  getHTMLString(reactid) {
    this._reactid = reactid;

    const {type: Component, props} = this._currentElement;
    const component = this._componentInstance = new Component(props);
    // 让组件的实例的currentUnit属性等于当前unit
    component._currentUnit = this;
    // 如果有组件将要渲染的函数的话让他执行
    component.componentWillMount && component.componentWillMount();
    // 调用组件的render方法，获得要渲染的元素
    const renderedElement = component.render();
    // 得到这个元素对应的unit
    const unit = this._renderedUnitInstance = createUnit(renderedElement);
    // 订阅一个事件 用来在render完成以后触发componentDidMount周期
    $(document).on('mounted', () => {
      component.componentDidMount && component.componentDidMount();
    });
    // 通过unit可以获得他的html字符串
    return unit.getHTMLString(this._reactid);
  };

  // 这里负责处理组件的更新操作
  update(nextElement, partialState) {
    // 获取元素
    this._currentElement = nextElement || this._currentElement;
    // 获取新的状态 并且不管要不要更新组件(shouldComponentUpdate)，组件的状态一定会修改
    const newState = this._componentInstance.state = Object.assign(this._componentInstance.state, partialState);
    // 新的属性对象
    const nextProps = this._currentElement.props;
    // shouldComponentUpdate周期
    const shouldComponentUpdate = this._componentInstance.shouldComponentUpdate;
    if (shouldComponentUpdate && !shouldComponentUpdate()) {
      return;
    }

    // 下面要进行比较更新了

    // 先得到上次渲染的单元
    const preRenderedUnitInstance = this._renderedUnitInstance;
    // 得到上次渲染的元素
    const preRenderedElement = preRenderedUnitInstance._currentElement;
    const nextRenderElement = this._componentInstance.render();
    // 如果新旧两个元素类型一样，则可以进行深度比较，如果不一样，直接干掉老的元素，新建新的
    if (shouldDeepCompare(preRenderedElement, nextRenderElement)) {
        preRenderedUnitInstance.update(nextRenderElement);
        this._componentInstance.componentDidUpdate && this._componentInstance.componentDidUpdate();
    } else {
      this._renderedUnitInstance = createUnit(nextRenderElement);
      const nextMarkUp = this._renderedUnitInstance.getHTMLString();
      $(`[data-reactid=${this._reactid}]`).replaceWith(nextMarkUp);;
    }
  }
};


// 判断两个元素类型是否一致
function shouldDeepCompare (oldElement, newElement) {
  if (oldElement !== null && newElement !== null) {
    const oldType = typeof oldElement;
    const newType = typeof newElement;
    if ((oldType === 'string' || oldType === 'number') && (newType === 'string' || newType === 'number')) {
      return true;
    }
    if (oldElement instanceof Element && newElement instanceof Element) {
      return oldElement.type === newElement.type;
    }
  }
  return false;
};

function createUnit (element) {
  if (typeof element === 'string' || typeof element === 'number') {
    return new TestUnit(element);
  }
  if (element instanceof Element && typeof element.type === 'string') {
    return new NativeUnit(element);
  }
  if (element instanceof Element && typeof element.type === 'function') {
    return new CompositeUnit(element);
  }
};


export {
  createUnit
};
