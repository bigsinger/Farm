const {ccclass, property} = cc._decorator;

@ccclass
export default class NewClass extends cc.Component {
	private self:Kuojian = this;

    // onLoad () {}

    start () {
		var self = this;
        this.node.on(cc.Node.EventType.TOUCH_START, function (event) {
			var pos = event.getLocation();
			cc.log("点击全局坐标： ", pos.x, pos.y)
        );
    }

    // update (dt) {}
}
