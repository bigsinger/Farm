import { _decorator, Node, Button, Sprite, director, SpriteFrame, UITransform } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Crop')
export class Crop extends Node {
    public mButton: Button;
    private mSprite: Sprite;

    setParent(p:any){
        self.parent = p;
    } 

    constructor(spriteFrame: SpriteFrame) {
        super();

        var self = this;
        director.getScene().addChild(this);

        self.mSprite = self.addComponent(Sprite);
        self.mSprite.spriteFrame = spriteFrame;
        self.mSprite.type = Sprite.Type.SIMPLE;
        self.mSprite.sizeMode = Sprite.SizeMode.TRIMMED;
        self.active = true;

        this.mButton = this.addComponent(Button);
        this.mButton.transition = Button.Transition.SCALE;
    }
}
