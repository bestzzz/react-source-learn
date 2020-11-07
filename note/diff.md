https://blog.csdn.net/qq_36407875/article/details/84965311

## 为什么要使用虚拟dom
主要原因是虚拟dom的性能更好。那么他的性能好在哪？
我们都知道dom本质也是一个js对象，所以操作dom其实也并不慢。他慢就慢在了操作完dom后，浏览器所做出的一些行为，比如布局、绘制等等。我们理想状态是一次性构建出完整的dom树，然后渲染。但是实际上浏览器收到第一个dom操作请求后，他就会走完一遍渲染流程。
而虚拟dom通过domdiff算法，计算出新树和老树的差异，最后才一次性的把差异应用到了真实dom中，然后进行布局绘制等一系列操作。

## diff的中心思想
1.当状态发生改变时(调用setState方法)，通过新的状态重新构造一个新的虚拟dom树。
2.然后让新树和老树进行比较，将两树的差异记录到差异队列中。
3.最后把差异队列补丁包打到真实dom树上，从而更新视图。

### 新树和老树具体的比较过程
diff算法采用分层比较的策略，对所在同一层次的节点进行比较，忽略dom跨层级移动操作。假如发现一个节点已经不存在，则将这个节点和其子节点完全删除。如果发现节点只是在同一层中换了个位置，那么diff算法会继续复用这个节点做移动操作。

diff算法对所在同一层级的节点提供了三种操作：插入、删除、移动。
例：
A B C D
B A C E

diff算法首先遍历下面的新树，然后每一次循环中，通过props.key来匹配老树中的元素。如果能匹配到，使用移动操作复用老节点。如果匹配不到，则删除或插入。

移动操作的具体实现是依靠双指针的方式。建立一个新指针lastIndex来记录最后移动的索引。

### key的作用
不加key的话，domdiff会采用暴力渲染的方式，他如果发现同一位置新老树的元素不一样，会直接删除并重新创建，这样会影响算法的性能。如果有key的话他会拿key去匹配，如果发现有相同的元素，则复用，使用移动的操作。