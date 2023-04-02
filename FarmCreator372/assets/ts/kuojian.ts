import { _decorator, Component, Node, EventTouch } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('NewClass')
export default class NewClass extends Component {
    private self: NewClass = this;

    // onLoad() {}

    start() {
        var self = this;
        this.node.on(Node.EventType.TOUCH_START, (event) => {
            var pos = event.getLocation();
            console.log("点击全局坐标： ", pos.x, pos.y);
            console.log(`Kuojian TOUCH_START xyz: (${self.node.position.x}, ${self.node.position.y}, ${self.node.position.z}); event.getLocation:(${pos.x}, ${pos.y})`);
        });
    }

    // update(dt) {}
}
