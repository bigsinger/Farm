import { _decorator, Component, Node, Animation, UIOpacity } from 'cc';
import { common } from './Common';
const { ccclass, property } = _decorator;

@ccclass('Storehouse')
export class Storehouse extends Component {

    onLoad() {
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
    }

    onTouchStart(event: Event) {
        console.log("点击了仓库");
        common.audioController.playClickEffect();   // 播放点击音效
    }
}
