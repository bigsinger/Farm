System.register(["cc"], function (_export, _context) {
  "use strict";

  var _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Animation, UIOpacity, AnimationClip, _dec, _dec2, _class, _class2, _descriptor, _crd, ccclass, property, Fireworks;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  return {
    setters: [function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
      Component = _cc.Component;
      Animation = _cc.Animation;
      UIOpacity = _cc.UIOpacity;
      AnimationClip = _cc.AnimationClip;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "bd20bkRNRBNZpS1ElE7Lf5u", "fireworks", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'Animation', 'UIOpacity', 'AnimationClip', 'AnimationState']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("default", Fireworks = (_dec = ccclass('Fireworks'), _dec2 = property(AnimationClip), _dec(_class = (_class2 = class Fireworks extends Component {
        constructor(...args) {
          super(...args);

          _initializerDefineProperty(this, "fireworksClip", _descriptor, this);

          this.loopCount = 0;
          this.maxLoopCount = 3;
        }

        start() {
          const uiOpacity = this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);
          uiOpacity.opacity = 255;
          const anim = this.getComponent(Animation);

          if (this.fireworksClip) {
            this.fireworksClip.wrapMode = AnimationClip.WrapMode.Loop;
          }

          anim.on(Animation.EventType.FINISHED, () => {
            this.loopCount++;
            console.log("烟花播放 ", this.loopCount, " 次");

            if (this.loopCount >= this.maxLoopCount) {
              uiOpacity.opacity = 0;
              this.loopCount = 0;
              anim.stop();
              console.log("烟花播放次数达到，停止播放");
            } else {
              anim.play("fireworks"); // 播放动画
            }
          }, this);
          anim.play("fireworks"); // 播放动画
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "fireworksClip", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      })), _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=00be9d5ba23aa07aba8b8009188646b03329a7ed.js.map