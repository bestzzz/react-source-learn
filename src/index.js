import React from './react';
const {Component} = React;

// function sayHello () {
//   console.log('111');
//   alert('hello');
// };

// const element = React.createElement('button', {
//   id: 'sayHello',
//   style: {color: 'red', backgroundColor: 'blue'},
//   onClick: sayHello
// }, 'say', React.createElement('b', {}, 'Hello'));

class Counter extends Component {
  state = {
    count: 0
  };

  handleClick = () => {
    this.setState({count: ++this.state.count});
  }

  render() {
    return React.createElement('span', {onClick: this.handleClick}, this.state.count);
  };
}
const element = React.createElement(Counter);

React.render(element, document.getElementById('root'));
