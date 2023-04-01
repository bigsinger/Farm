import { _decorator, Component, Node, tween, Vec3, Tween, UITransform, UIOpacity } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ConvertedClass')
export class ConvertedClass extends Component {
    // LIFE-CYCLE CALLBACKS:

    // onLoad() {}

    start() {
        const self = this.node;
        const uiOpacity = self.getComponent(UIOpacity) || self.addComponent(UIOpacity);
        uiOpacity.opacity = 0;

        const seqOpacity: Tween<UIOpacity> = tween(uiOpacity)
            .delay(1)
            .to(6, { opacity: 255 })
            .union()
            .repeatForever();

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

    // update(dt) {}
}
