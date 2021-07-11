cc.Class({
    extends: cc.Component,

    // LIFE-CYCLE CALLBACKS:

    // onLoad () {},

    start () {
        let self = this.node;
		self.opacity = 0;
      let seq = cc.sequence(
        cc.delayTime(1), 
        cc.fadeIn(6), 
        cc.moveTo(500, cc.Vec2(1000, self.getPosition().y)),
        cc.place(cc.Vec2(-self.getContentSize().width, self.getPosition().y))
      )
		  self.runAction(cc.repeatForever(seq));
    },

    // update (dt) {},
});