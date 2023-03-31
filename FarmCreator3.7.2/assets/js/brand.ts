import { _decorator, Component, Node, Animation, UIOpacity, AnimationClip } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Brand')
export class Brand extends Component {
    private self: Brand = null;

    @property({ type: Node })
    yanhua: Node = null;

    onLoad() {
        this.self = this;
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
    }

    onTouchStart(event: Event) {
        const uiOpacity = this.yanhua.getComponent(UIOpacity);
        if (uiOpacity) {
            uiOpacity.opacity = 255;
        }
        this.yanhua.active = true;
        const anim : Animation = this.yanhua.getComponent(Animation);
        anim.on(Animation.EventType.FINISHED, () => {
            this.yanhua.active = false;
        }, this);

        const clipName = 'yanhua';
        const state = anim.play(clipName);

        // 使用 wrapMode 和 repeatCount 实现循环播放
        // state.wrapMode = AnimationClip.WrapMode.Loop;
        // state.repeatCount = 3;
    }
}
