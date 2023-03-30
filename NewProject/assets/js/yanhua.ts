import { _decorator, Component, Node, Animation, UIOpacity, AnimationClip, AnimationState } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('YanHua')
export default class YanHua extends Component {

    // onLoad() {}

    public start() {
        const uiOpacity = this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);
        uiOpacity.opacity = 255;
        const anim: Animation = this.getComponent(Animation);
        // Register the callback for the animation end
        anim.on(Animation.EventType.FINISHED, () => { uiOpacity.opacity = 0 }, this);

        // Play the animation with loop count
        this.playAnimationWithLoop(anim, "yanhua", 3); // Play the animation 3 times
    }

    // Custom method to play animation with loop count
    private playAnimationWithLoop(anim: Animation, animationName: string, loopCount: number) {
        let state: AnimationState = anim.getState(animationName);

        if (state) {
            state.wrapMode = AnimationClip.WrapMode.Loop;
            state.duration = state.duration / loopCount;
            anim.play(animationName);
        }
    }

    // update(dt) {}
}
