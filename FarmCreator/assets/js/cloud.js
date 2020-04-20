cc.Class({
    extends: cc.Component,

    // LIFE-CYCLE CALLBACKS:

    // onLoad () {},

    start () {
      let self = this.node
      self.setOpacity(0)
      let seq = cc.sequence(
        cc.delayTime(1), 
        cc.fadeIn(6), 
        cc.moveTo(500, cc.p(1000, self.getPosition().y)),
        cc.place(cc.p(-self.getContentSize().width, self.getPosition().y))
      )
		  self.runAction(cc.repeatForever(seq));
    },

    // update (dt) {},
});