import { _decorator, Node, Button, Sprite, SpriteAtlas, SpriteFrame, UITransform, Vec2, Layers } from 'cc';
const { ccclass, property } = _decorator;


// 作物的生长状态
const CropStateSeed = 0;        // 种子
const CropStateBud = 1;         // 发芽
const CropStateMature = 1000;   // 成熟

export const CropIdBegin = 101;        // 种子Id起始序号
export const CropIdEnd = 115;          // 种子Id结束序号



@ccclass('Crop')
export class Crop extends Node {
    public mButton: Button;
    private mSprite: Sprite;

    public cellX: number;
    public cellY: number;

    // 作物Id
    public CropId: number = 0;

    constructor(cropAtlas: SpriteAtlas, CropId: number) {
        super();

        var self = this;
        this.CropId = CropId;
        self.on(Node.EventType.TOUCH_START, function () {
            console.log(`Crop TOUCH_START tile: (${self.cellX}, ${self.cellY}) ; xyz: (${self.position.x}, ${self.position.y}, ${self.position.z})`);
        });


        //director.getScene().addChild(this);

        // 设置精灵节点的锚点为中下角
        //this.addComponent(UITransform).setAnchorPoint(0.5, 0);


        var spriteFrame = cropAtlas.getSpriteFrame(this.getSpriteFrameName());
        this.layer = Layers.Enum.UI_2D;
        self.mSprite = self.addComponent(Sprite);
        self.mSprite.spriteFrame = spriteFrame;
        self.mSprite.type = Sprite.Type.SIMPLE;
        self.mSprite.sizeMode = Sprite.SizeMode.TRIMMED;
        self.active = true;

        this.mButton = this.addComponent(Button);
        this.mButton.transition = Button.Transition.SCALE;
    }

    public setCellPosition(x: number, y: number) {
        this.cellX = x;
        this.cellY = y;
    }

    // 返回作物的精灵图片名
    private getSpriteFrameName(): string {
        var name = "crop_" + this.CropId + "_01";
        return name;
    }
}
