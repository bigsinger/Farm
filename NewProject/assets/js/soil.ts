import { _decorator, Component, TiledMap, TiledLayer, SpriteAtlas, Vec2, Node, Vec3 } from 'cc';
import { Crop } from './Crop';

const { ccclass, property } = _decorator;

@ccclass('NewClass')
export default class NewClass extends Component {
    @property(TiledMap)
    mapNode: TiledMap = null;

    @property(TiledLayer)
    tiledLayer: TiledLayer = null;

    @property(SpriteAtlas)
    cropAtlas: SpriteAtlas = null;

    // LIFE-CYCLE CALLBACKS:

    onLoad() {
        var gid = this.tiledLayer.getTileGIDAt(0, 1);

        let layer: TiledLayer = this.tiledLayer;
        let layerSize = layer.getLayerSize();

        for (let i = 0; i < layerSize.width; i++) {
            for (let j = 0; j < 2; j++) {
                layer.setTileGIDAt(5, i, j, 1);
                let gid = layer.getTileGIDAt(i, j);
                let pos: Vec3 = this.getReleasePos(i, j);
                let crop = new Crop(this.cropAtlas.getSpriteFrame('crop_101_04'));
                crop.setPosition(pos);
                crop.setParent(this.node);
                //crop.parent = this.node;


                crop.on(Node.EventType.TOUCH_START, function (event) {
                    console.log("TOUCH_START event=", event);
                });
            }
        }
    }

    //start() {}

    getReleasePos(cellX: number, cellY: number): Vec3 {
        var cellXCount: number = this.mapNode.getMapSize().width;
        var cellYCount: number = this.mapNode.getMapSize().height;
        var cellWidth: number = this.mapNode.getTileSize().width;
        var cellHeight: number = this.mapNode.getTileSize().height;
        var mapPixWidth: number = cellWidth * cellXCount;
        var mapPixHeight: number = cellHeight * cellYCount;
        var posX: number = 0 + (cellX - cellY) * cellWidth / 2;
        var posY: number = mapPixHeight / 2 - (cellX + cellY) * cellHeight / 2;
        posY -= cellHeight / 2 / 2;
        return new Vec3(posX, posY, 0);
    }

    // update(dt) {}
}
