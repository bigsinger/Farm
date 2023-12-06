import { _decorator, Component, Node, Animation, UIOpacity } from 'cc';
import { common } from './Common';
const { ccclass, property } = _decorator;

@ccclass('Shop')
export class Shop extends Component {

    onLoad() {
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
    }

    onTouchStart(event: Event) {
        console.log("点击了商店");
        common.audioController.playSoundClick();   // 播放点击音效
    }
}
