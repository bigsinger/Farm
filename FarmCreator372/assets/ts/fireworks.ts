import { _decorator, Component, Node, Animation, UIOpacity, AnimationClip, AnimationState } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Fireworks')
export default class Fireworks extends Component {
    @property(AnimationClip)
    public fireworksClip: AnimationClip = null;

    private loopCount: number = 0;
    private maxLoopCount: number = 3;

    public start() {
        const uiOpacity = this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);
        uiOpacity.opacity = 255;

        if (this.fireworksClip) {
            this.fireworksClip.wrapMode = AnimationClip.WrapMode.Loop;
        }

        const anim: Animation = this.getComponent(Animation);
        anim.on(Animation.EventType.FINISHED, () => {
            this.loopCount++;
            console.log("烟花播放 ", this.loopCount, " 次");
            if (this.loopCount >= this.maxLoopCount) {
                uiOpacity.opacity = 0;
                this.loopCount = 0;
                anim.stop();
            }else{
                anim.play("fireworks"); 
            }
        }, this);

        anim.play("fireworks");
    }
}
