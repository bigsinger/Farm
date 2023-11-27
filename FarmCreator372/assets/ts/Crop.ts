import { _decorator, Node, Button, Sprite, SpriteAtlas, JsonAsset, resources, SpriteFrame, UITransform, Vec2, Layers, error } from 'cc';
import { Common, NaturalEnv, common } from './Common'

const { ccclass, property } = _decorator;


// 作物的生命周期
@ccclass('CropLifecycle')
export class CropLifecycle {
    // 当前生命周期名称
    public Name: string;

    // 当前生命周期需要的养料
    public Fuel: number = 1;

    // 当前生命周期需要的水分
    public Water: number = 1;

    // 当前生命周期需要的时间（单位：天），超过这个时间就会进入下一个生命周期
    public Days: number = 15;

    // 从json数据反序列化CropLifecycle
    public static deserialize(json: any): CropLifecycle {
        var lifecycle = new CropLifecycle();
        lifecycle.Name = json.name;
        lifecycle.Fuel = json.fuel;
        lifecycle.Water = json.water;
        lifecycle.Days = json.time;
        return lifecycle;
    }
}

// 作物数据
@ccclass('CropData')
export class CropData {
    // 作物名称
    public CropName: string = "";

    // 作物Id
    public CropId: number = 0;

    // 最低生长温度
    public TempLow: number = 0;

    // 最高生长温度
    public TempHigh: number = 0;
    
    // 一次生命周期最大的成熟次数
    public MatureMaxTimes: number = 1;

    // 生命周期数组
    public Lifecycles: CropLifecycle[] = [];

    // 全部作物数据
    public static AllCrops: CropData[] = [];
    
    // 作物的当前生命周期
    public CurrentLifecycleIndex: number = 0;

    // 作物的当前生命周期的开始时间（13位总毫秒数）
    public CurrentLifecycleStartTime: number = 0;

    // 作物的当前生命周期的累积生长时间（13位总毫秒数）
    public CurrentLifecycleGrowTime: number = 0;

    // 已经成熟的次数
    public MatureAlreadyTimes: number = 0;


    constructor() {
        if (CropData.AllCrops.length == 0) {
            CropData.AllCrops = CropData.deserializeAll();
        }
    }

    // 从json数据反序列化单个作物数据
    public static deserializeOne(json: any): CropData {
        var cropData = new CropData();

        cropData.CropName = json.name;
        cropData.CropId = json.id;
        cropData.MatureMaxTimes = json.matureTimes;
        cropData.TempLow = json.tempLow;
        cropData.TempHigh = json.tempHigh;

        for (var i = 0; i < json.lifecycle.length; i++) {
            var lifecycle = CropLifecycle.deserialize(json.lifecycle[i]);
            cropData.Lifecycles.push(lifecycle);
        }

        return cropData;
    }

    // 从json数据反序列化所有作物数据
    // 读取json资源：https://docs.cocos.com/creator/manual/zh/asset/json.html
    public static deserializeAll(): CropData[] {
        var AllCrops: CropData[] = [];
        // resources.load(CropDataResourceName, (err: any, res: JsonAsset) => {
        //     if (err) {
        //         error(err.message || err);
        //         return;
        //     }
        //     // 获取到 Json 数据
        //     const jsonData: any = res.json!;
        //     for (var i = 0; i < jsonData.length; i++) {
        //         CropData.AllCrops.push(CropData.deserializeOne(jsonData[i]));
        //     }
        // })

        return AllCrops;
    }
}

let cropsData: CropData = new CropData();


@ccclass('CropNode')
export class CropNode extends Node {
    public mButton: Button;
    private mSprite: Sprite;

    public TilePosX: number;
    public TilePosY: number;

    public crop: CropData = null;

    // @property({visible:true})
    // private _jsonAsset: JsonAsset = new JsonAsset();

    constructor(cropAtlas: SpriteAtlas, CropId: number) {
        super();

        var self = this;
        this.crop.CropId = CropId;
        self.on(Node.EventType.TOUCH_START, function () {
            console.log(`Crop TOUCH_START tile: (${self.TilePosX}, ${self.TilePosY}) ; xyz: (${self.position.x}, ${self.position.y}, ${self.position.z})`);
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

    // 通过作物Id创建作物
    public static createFromId(cropAtlas: SpriteAtlas, CropId: number): CropNode {
        var crop = new CropNode(cropAtlas, CropId);
        return crop;
    }

    // 通过作物名称创建作物
    public static createFromName(cropAtlas: SpriteAtlas, CropName: string): CropNode {
        // 通过作物名称查找作物Id
        var CropId = 0;
        for (var i = 0; i < CropData.AllCrops.length; i++) {
            if (CropData.AllCrops[i].CropName == CropName) {
                CropId = CropData.AllCrops[i].CropId;
                break;
            }
        }

        if (CropId != 0) {
            return CropNode.createFromId(cropAtlas, CropId);
        } else {
            console.log("作物名称错误：", CropName);
        }
    }

    // 设置作物的位置（瓦块坐标）
    public setTilePosition(x: number, y: number) {
        this.TilePosX = x;
        this.TilePosY = y;
    }

    // 返回作物的精灵图片名
    private getSpriteFrameName(lifecycleIndex: number = 0): string {
        var name = "crop_" + this.crop.CropId;
        if (lifecycleIndex > 0) {
            var name = "crop_" + this.crop.CropId + "_0" + lifecycleIndex;
        }
        return name;
    }

    public onGrowing(env: NaturalEnv, deltaTime: number): void {
        if(env){
            if (env.Water <= 0) {
                console.log("水分不足，作物停止生长");
                return;
            }
            if (env.Fuel <= 0) {
                console.log("养料不足，作物停止生长");
                return;
            }
            if (env.Temperature < this.crop.TempLow) {
                console.log("气温过低，作物停止生长");
                return;
            }
            if (env.Temperature > this.crop.TempHigh) {
                console.log("气温过高，作物停止生长");
                return;
            }
            if (env.Bug > 0) {
                console.log("有虫害，作物停止生长");
                return;
            }
        }

        var minutes = Common.RealTimeToGameTime(this.crop.Lifecycles[this.crop.CurrentLifecycleIndex].Days);

        // 转化为秒计算
        if ((Date.now() - this.crop.CurrentLifecycleStartTime) > minutes * 60 * 1000) {
            this.crop.CurrentLifecycleIndex += 1;
            if (this.crop.CurrentLifecycleIndex >= this.crop.Lifecycles.length) {
                this.crop.MatureAlreadyTimes += 1;
                if (this.crop.MatureMaxTimes > 0 && this.crop.MatureAlreadyTimes >= this.crop.MatureMaxTimes) {
                    console.log("作物寿命结束，作物死亡");
                    return;
                } else {
                    this.crop.CurrentLifecycleIndex = CropState.Growing; // 重新进入生长期
                }
            }

            var spriteFrame = common.cropAtlas.getSpriteFrame(this.getSpriteFrameName(this.crop.CurrentLifecycleIndex));
            this.mSprite.spriteFrame = spriteFrame;
        }
    }
}
