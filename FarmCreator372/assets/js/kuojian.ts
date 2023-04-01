import { _decorator, Component, Node, EventTouch } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('NewClass')
export default class NewClass extends Component {
    private self: NewClass = this;

    // onLoad() {}

    start() {
        var self = this;
        this.node.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
            var pos = event.getLocation();
            console.log("点击全局坐标： ", pos.x, pos.y);
        });
    }

    // update(dt) {}
}
