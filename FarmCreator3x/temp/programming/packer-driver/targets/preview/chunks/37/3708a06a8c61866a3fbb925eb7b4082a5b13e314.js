System.register(["cc"], function (_export, _context) {
  "use strict";

  var _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Node, Button, Sprite, Layers, _dec, _class, _crd, ccclass, property, Crop;

  return {
    setters: [function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
      Node = _cc.Node;
      Button = _cc.Button;
      Sprite = _cc.Sprite;
      Layers = _cc.Layers;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "d05b0jHfHZBt73xLk+DN6dR", "Crop", undefined);

      __checkObsolete__(['_decorator', 'Node', 'Button', 'Sprite', 'director', 'SpriteFrame', 'UITransform', 'Vec2', 'Layers']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("Crop", Crop = (_dec = ccclass('Crop'), _dec(_class = class Crop extends Node {
        constructor(spriteFrame) {
          super();
          this.mButton = void 0;
          this.mSprite = void 0;
          this.cellX = void 0;
          this.cellY = void 0;
          var self = this;
          self.on(Node.EventType.TOUCH_START, function (event) {
            console.log("Crop TOUCH_START tile: (" + self.cellX + ", " + self.cellY + ") ; xyz: (" + self.position.x + ", " + self.position.y + ", " + self.position.z + ")");
          }); //director.getScene().addChild(this);
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

        setCellPosition(x, y) {
          this.cellX = x;
          this.cellY = y;
        }

      }) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=3708a06a8c61866a3fbb925eb7b4082a5b13e314.js.map