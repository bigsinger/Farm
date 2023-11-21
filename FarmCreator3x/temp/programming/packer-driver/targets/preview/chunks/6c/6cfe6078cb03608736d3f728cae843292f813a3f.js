System.register(["__unresolved_0", "cc", "__unresolved_1"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, TiledMap, TiledLayer, SpriteAtlas, Vec2, Node, Vec3, UITransform, TiledObjectGroup, Crop, _dec, _dec2, _dec3, _dec4, _dec5, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _crd, ccclass, property, landStateNothing, landStateVirgin, landStateDry, landStateDryHalf, landStateFatHalf, landStateFat, Soil;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfCrop(extras) {
    _reporterNs.report("Crop", "./Crop", _context.meta, extras);
  }

  return {
    setters: [function (_unresolved_) {
      _reporterNs = _unresolved_;
    }, function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
      Component = _cc.Component;
      TiledMap = _cc.TiledMap;
      TiledLayer = _cc.TiledLayer;
      SpriteAtlas = _cc.SpriteAtlas;
      Vec2 = _cc.Vec2;
      Node = _cc.Node;
      Vec3 = _cc.Vec3;
      UITransform = _cc.UITransform;
      TiledObjectGroup = _cc.TiledObjectGroup;
    }, function (_unresolved_2) {
      Crop = _unresolved_2.Crop;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "83382YY7JhEz7Px1DovfdS8", "soil", undefined);

      __checkObsolete__(['_decorator', 'Component', 'TiledMap', 'TiledLayer', 'SpriteAtlas', 'Vec2', 'Node', 'Vec3', 'UITransform', 'Layers', 'TiledObjectGroup', 'Sprite', 'SpriteFrame']);

      ({
        ccclass,
        property
      } = _decorator); // 土地的状态标识

      landStateNothing = 0;
      landStateVirgin = 1;
      landStateDry = 2;
      landStateDryHalf = 3;
      landStateFatHalf = 4;
      landStateFat = 5;

      _export("default", Soil = (_dec = ccclass('Soil'), _dec2 = property(TiledMap), _dec3 = property(TiledLayer), _dec4 = property(TiledObjectGroup), _dec5 = property(SpriteAtlas), _dec(_class = (_class2 = class Soil extends Component {
        constructor() {
          super(...arguments);

          _initializerDefineProperty(this, "mapNode", _descriptor, this);

          _initializerDefineProperty(this, "soilLayer", _descriptor2, this);

          _initializerDefineProperty(this, "cropLayer", _descriptor3, this);

          _initializerDefineProperty(this, "cropAtlas", _descriptor4, this);
        }

        onLoad() {
          this.initLand();
          var gid = this.soilLayer.getTileGIDAt(0, 1);
          var layer = this.soilLayer;
          var layerSize = layer.getLayerSize();
          this.initCrops();
          this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        }

        onTouchStart(event) {
          // 获取点击位置
          var clickPos = event.getLocation();
          var uiTransform = this.mapNode.node.getComponent(UITransform);
          var localClickPos = uiTransform.convertToNodeSpaceAR(new Vec3(clickPos.x, clickPos.y, 0)); // 将点击位置转换为瓦块坐标

          var tilePos = this.getTilePos(localClickPos);
          console.log("\u70B9\u51FB\u7684\u74E6\u5757\u5750\u6807\u4E3A: (" + tilePos.x + ", " + tilePos.y + ")");
        }

        getTilePos(localClickPos) {
          var tileSize = this.mapNode.getTileSize();
          var layerSize = this.soilLayer.getLayerSize();
          var x = (localClickPos.x - this.mapNode.node.getPosition().x) / tileSize.x;
          var y = (this.mapNode.node.getPosition().y - localClickPos.y) / tileSize.y;
          var tileX = Math.floor((layerSize.height - y + x) / 2);
          var tileY = Math.floor((layerSize.height - y - x) / 2);
          return new Vec2(tileX, tileY);
        } // 初始化植物


        initCrops() {
          var layerSize = this.soilLayer.getLayerSize();

          for (var row = 0; row < 2; row++) {
            for (var col = 0; col < layerSize.width; col++) {
              this.soilLayer.setTileGIDAt(landStateFat, col, row, 1);
              this.addCrop(row, col);
            }
          }
        } // 在行列处添加植物


        addCrop(row, col) {
          // 创建一个新的精灵节点
          var crop = new (_crd && Crop === void 0 ? (_reportPossibleCrUseOfCrop({
            error: Error()
          }), Crop) : Crop)(this.cropAtlas.getSpriteFrame('crop_101_04')); //cc.instantiate(this.spritePrefab);

          crop.setCellPosition(row, col); //设置精灵节点的锚点为中下角

          var cropUITransform = crop.getComponent(UITransform);
          cropUITransform.anchorX = 0.5;
          cropUITransform.anchorY = 0; // 使用修复后的getReleasePos函数设置精灵节点的位置
          //const tilePos = this.soilLayer.getPositionAt(col, row); // 注意该函数的参数顺序是：列，行
          //crop.setPosition(tilePos.x, tilePos.y);
          //this.soilLayer.addUserNode(crop);
          //let tile = this.soilLayer.getTiledTileAt(col, row);
          //tile.node.addComponent(Sprite).spriteFrame = this.cropAtlas.getSpriteFrame('crop_101_04');

          this.soilLayer.node.addChild(crop); // 使用修复后的getReleasePos函数设置精灵节点的位置

          var tilePos = this.soilLayer.getPositionAt(col, row); // 注意该函数的参数顺序是：列，行

          crop.setPosition(tilePos.x, tilePos.y);
        }

        initLand() {
          var layerSize = this.soilLayer.getLayerSize();
          console.log("layersize ", layerSize);

          for (var i = 0; i < layerSize.width; i++) {
            for (var j = 0; j < layerSize.height; j++) {
              this.soilLayer.setTileGIDAt(landStateNothing, i, j, 0);
            }
          }
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "mapNode", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "soilLayer", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "cropLayer", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "cropAtlas", [_dec5], {
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
//# sourceMappingURL=6cfe6078cb03608736d3f728cae843292f813a3f.js.map