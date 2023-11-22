import { _decorator, Node, Button, Sprite, director, SpriteFrame, UITransform, Vec2, Layers } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Crop')
export class Crop extends Node {
    public mButton: Button;
    private mSprite: Sprite;

    public cellX: number;
    public cellY: number;

    constructor(spriteFrame: SpriteFrame) {
        super();

        var self = this;
        self.on(Node.EventType.TOUCH_START, function (event) {
            console.log(`Crop TOUCH_START tile: (${self.cellX}, ${self.cellY}) ; xyz: (${self.position.x}, ${self.position.y}, ${self.position.z})`);
        });

        //director.getScene().addChild(this);

        // 设置精灵节点的锚点为中下角
        //this.addComponent(UITransform).setAnchorPoint(0.5, 0);


        this.layer = Layers.Enum.UI_2D;
        self.mSprite = self.addComponent(Sprite);
        self.mSprite.spriteFrame = spriteFrame;
        self.mSprite.type = Sprite.Type.SIMPLE;
        self.mSprite.sizeMode = Sprite.SizeMode.TRIMMED;
        self.active = true;

        this.mButton = this.addComponent(Button);
        this.mButton.transition = Button.Transition.SCALE;
    }

    public setCellPosition(x:number, y:number){
        this.cellX = x;
        this.cellY = y;
    }
}
