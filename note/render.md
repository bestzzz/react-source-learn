## 首先由React.createElement创建出来一个虚拟dom元素 （虚拟dom是一个{type, props}的对象）
element = {
  type: 'button',
  props: {
    id: 'sayHello',
    style: {color: 'red', backgroundColor: 'blue'},
    onClick: sayHello (fn),
    children: [
      'say',
      {
        type: 'b',
        props: {}
      }
    ]
  }
};

## 第二步我们要把这个虚拟dom元素变成真实dom渲染到页面上，应该这么做：
**1.将虚拟dom转化为字符串 2.使用innerHTML 将字符串加到顶层父容器里**


### 通过createUnit创建当前元素所对应的单元实例
{
  _currentElement: element,
  _reactid: 0
}

### 通过调用单元的getHTMLString方法得到dom字符串
**getHTMLString：这个方法会将element转为字符串，并遍历其props。遇到on开头的事件时通过事件委托将事件绑定到document上(事件合成)； 遇到className或style将其转为样式属性；遇到children则递归createUnit方法拼接**

最终得到
<button id="sayHello" style={{color: 'red', backgroundColor: 'blue'}} onClick={sayHello}>
  say
  <b></b>
</button>
并通过innerHTML方法将其渲染到页面上
