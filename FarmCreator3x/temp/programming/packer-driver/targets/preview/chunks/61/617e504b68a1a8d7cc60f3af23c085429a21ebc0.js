System.register(["cc"], function (_export, _context) {
  "use strict";

  var _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, Animation, UIOpacity, _dec, _dec2, _class, _class2, _descriptor, _crd, ccclass, property, Brand;

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
      Node = _cc.Node;
      Animation = _cc.Animation;
      UIOpacity = _cc.UIOpacity;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "e896eA28e5CF5EpzZACBZcA", "brand", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'Animation', 'UIOpacity', 'AnimationClip']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("Brand", Brand = (_dec = ccclass('Brand'), _dec2 = property({
        type: Node
      }), _dec(_class = (_class2 = class Brand extends Component {
        constructor() {
          super(...arguments);
          this.self = null;

          _initializerDefineProperty(this, "fireworks", _descriptor, this);
        }

        onLoad() {
          this.self = this;
          this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        }

        onTouchStart(event) {
          var uiOpacity = this.fireworks.getComponent(UIOpacity);

          if (uiOpacity) {
            uiOpacity.opacity = 255;
          }

          this.fireworks.active = true;
          var anim = this.fireworks.getComponent(Animation);
          anim.on(Animation.EventType.FINISHED, () => {
            this.fireworks.active = false;
          }, this);
          var state = anim.play('fireworks');
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "fireworks", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      })), _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=617e504b68a1a8d7cc60f3af23c085429a21ebc0.js.map