import { _decorator, Component, Node, Label, Prefab, instantiate } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('NewClass')
export class NewClass extends Component {

    @property(Label)
    label: Label = null;

    @property
    text: string = 'hello';

    // LIFE-CYCLE CALLBACKS:

    // onLoad () {}

    start () {
        /* 动态添加动画代码示例 */
        // TODO：加载飞翔的鸟群动画，完全不知道怎么添加，有兴趣的可以研究下
    }

    // update (dt) {}
}

