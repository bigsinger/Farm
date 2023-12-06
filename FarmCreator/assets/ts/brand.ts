import { _decorator, Component, Node, Animation, UIOpacity } from 'cc';
import { common } from './Common';
const { ccclass, property } = _decorator;

@ccclass('Brand')
export class Brand extends Component {

    // 使用property装饰器定义fireworks属性，类型为Node
    @property({ type: Node })
    fireworks: Node = null;

    onLoad() {
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
    }

    onTouchStart(event: Event) {
        common.audioController.playClickEffect();   // 播放点击音效

        // 获取fireworks节点的UIOpacity组件，并设置透明度为255（完全可见），并激活fireworks节点
        const uiOpacity = this.fireworks.getComponent(UIOpacity) || this.fireworks.addComponent(UIOpacity);
        uiOpacity.opacity = 255;
        this.fireworks.active = true;

        // 获取fireworks节点的Animation组件
        const anim: Animation = this.fireworks.getComponent(Animation);
        anim.on(Animation.EventType.FINISHED, () => {
            // 动画播放完成后，隐藏fireworks节点
            this.fireworks.active = false;
        }, this);

        // 播放名为'fireworks'的动画
        const state = anim.play('fireworks');
    }
}
