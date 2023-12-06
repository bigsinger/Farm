import { _decorator, Component, Node, tween, Vec3, Tween, UITransform, UIOpacity } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Cloud')
export class Cloud extends Component {
    start() {
        const self = this.node;
        const uiOpacity = self.getComponent(UIOpacity) || self.addComponent(UIOpacity);
        uiOpacity.opacity = 0;

        // 在6秒内逐渐将节点的不透明度从0变为255，使节点变为完全可见。此动画设置为永久重复。
        const seqOpacity: Tween<UIOpacity> = tween(uiOpacity)
            .delay(1)
            .to(6, { opacity: 255 })
            .union()
            .repeatForever();

        // 在500秒内将节点在x方向上移动1000个单位。移动后，它将节点的x位置重置为节点宽度的负值，有效地创建了一个循环，使节点从右向左移动穿过屏幕。此动画也设置为永久重复。
        const seqPosition: Tween<Node> = tween(self)
            .delay(1)
            .by(500, { position: new Vec3(1000, self.getPosition().y, 0) })
            .call(() => {
                const contentSize = self.getComponent(UITransform).contentSize;
                self.setPosition(new Vec3(-contentSize.width, self.getPosition().y, 0));
            })
            .union()
            .repeatForever();

        seqOpacity.start();
        seqPosition.start();
    }
}
