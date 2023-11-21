System.register(["cc"], function (_export, _context) {
  "use strict";

  var _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, _dec, _class, _crd, ccclass, property, NewClass;

  return {
    setters: [function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
      Component = _cc.Component;
      Node = _cc.Node;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "f7181L3PqNGxp6EavyJ1T1w", "kuojian", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'EventTouch']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("default", NewClass = (_dec = ccclass('NewClass'), _dec(_class = class NewClass extends Component {
        constructor() {
          super(...arguments);
          this.self = this;
        }

        // onLoad() {}
        start() {
          var self = this;
          this.node.on(Node.EventType.TOUCH_START, event => {
            var pos = event.getLocation();
            console.log("点击全局坐标： ", pos.x, pos.y);
            console.log("Kuojian TOUCH_START xyz: (" + self.node.position.x + ", " + self.node.position.y + ", " + self.node.position.z + "); event.getLocation:(" + pos.x + ", " + pos.y + ")");
          });
        } // update(dt) {}


      }) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=bbc3bafcbb8e68e9ea9e87c914218e6bc7f7ff11.js.map