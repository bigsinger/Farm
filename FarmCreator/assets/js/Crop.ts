export class Crop extends cc.Node{
    public mButton:cc.Button
    private mSprite:cc.Sprite

    constructor(spriteFrame: cc.SpriteFrame){
        super()
        
        var self = this;
        cc.director.getScene().addChild(this);

        self.mSprite = self.addComponent(cc.Sprite);
        self.mSprite.spriteFrame = spriteFrame;
        self.mSprite.type = cc.Sprite.Type.SIMPLE;
        self.mSprite.sizeMode = cc.Sprite.SizeMode.TRIMMED;
        self.active = true
        
        this.mButton = this.addComponent(cc.Button)
        this.mButton.transition = cc.Button.Transition.SCALE
    }
}