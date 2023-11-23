import { _decorator, Component, Node, Animation, UIOpacity, AnimationClip } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Brand')
export class Brand extends Component {
    private self: Brand = null;

    @property({ type: Node })
    fireworks: Node = null;

    onLoad() {
        this.self = this;
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
    }

    onTouchStart(event: Event) {
        const uiOpacity = this.fireworks.getComponent(UIOpacity);
        if (uiOpacity) {
            uiOpacity.opacity = 255;
        }
        this.fireworks.active = true;
        const anim : Animation = this.fireworks.getComponent(Animation);
        anim.on(Animation.EventType.FINISHED, () => {
            this.fireworks.active = false;
        }, this);

        const state = anim.play('fireworks');
    }
}
