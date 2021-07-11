const {ccclass, property} = cc._decorator;

@ccclass
export default class YanHua extends cc.Component {
    // onLoad () {}

    public start () {
      //console.log(this.node)
      this.node.opacity = 255;
      var anim:cc.Animation = this.getComponent(cc.Animation)
      // 注册播放动画结束的回调
      anim.on('finished', ()=>{this.node.opacity = 0}, this);
      var state = anim.play("yanhua")	//播放动画并且返回animationState对象
      state.repeatCount = 3			      //设置循环次数，如果是无限循环就是 = infinity
    }

    // update (dt) {}
}