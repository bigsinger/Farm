const {ccclass, property} = cc._decorator;

@ccclass
export default class Brand extends cc.Component {
    private self:Brand = null;

    @property(cc.Node)
    yanhua: cc.Node = null;

    onLoad () {
        var self = this;
        this.node.on(cc.Node.EventType.TOUCH_START, function (event) {
            self.yanhua.opacity = 255
            self.yanhua.active = true
            var anim:cc.Animation = self.yanhua.getComponent(cc.Animation)
                anim.on('finished', ()=>{self.yanhua.active = false}, this);
                var state = anim.play("yanhua")
                state.repeatCount = 3
            }
        );
    }
    // update (dt) {}
}