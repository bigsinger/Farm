System.register(["cc"], function (_export, _context) {
  "use strict";

  var _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, tween, Vec3, UITransform, UIOpacity, _dec, _class, _crd, ccclass, property, ConvertedClass;

  return {
    setters: [function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
      Component = _cc.Component;
      tween = _cc.tween;
      Vec3 = _cc.Vec3;
      UITransform = _cc.UITransform;
      UIOpacity = _cc.UIOpacity;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "5276boieP9O94R22r33JfnI", "cloud", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'tween', 'Vec3', 'Tween', 'UITransform', 'UIOpacity']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("ConvertedClass", ConvertedClass = (_dec = ccclass('ConvertedClass'), _dec(_class = class ConvertedClass extends Component {
        // LIFE-CYCLE CALLBACKS:
        // onLoad() {}
        start() {
          const self = this.node;
          const uiOpacity = self.getComponent(UIOpacity) || self.addComponent(UIOpacity);
          uiOpacity.opacity = 0;
          const seqOpacity = tween(uiOpacity).delay(1).to(6, {
            opacity: 255
          }).union().repeatForever();
          const seqPosition = tween(self).delay(1).by(500, {
            position: new Vec3(1000, self.getPosition().y, 0)
          }).call(() => {
            const contentSize = self.getComponent(UITransform).contentSize;
            self.setPosition(new Vec3(-contentSize.width, self.getPosition().y, 0));
          }).union().repeatForever();
          seqOpacity.start();
          seqPosition.start();
        } // update(dt) {}


      }) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=8833e08d1ff75334b060dfeb8045fb1a25989dcf.js.map