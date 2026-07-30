import { _decorator, Node, Button, Sprite, SpriteAtlas, JsonAsset, UITransform, Layers } from 'cc';
import { Common, NaturalEnv, common } from './Common';
import { CurrencySystem } from './CurrencySystem';
import { WarehouseManager } from './WarehouseManager';
import { WeatherSystem } from './WeatherSystem';
import { eventBus, GameEvent } from './EventBus';

const { ccclass, property } = _decorator;


////////////////////////////////////////////////////////////////
// 作物相关
////////////////////////////////////////////////////////////////

// 声明全局的枚举类型：作物状态
enum CropState {
    Seed = 0,
    Seeding = 1,
    Growing = 2,
    GrowingEx = 3,
    Flowering = 4,
    Fructifying = 5,
    Mature = 999,
    Dead = 1000,
}

// 声明全局的枚举类型：作物Id
export enum CropIdRange {
    Low = 101,      // 种子Id起始序号
    High = 115,     // 种子Id结束序号
}

// 作物配置文件名
const CropDataResourceName = "data/crops";   //resources/data/crops.json
////////////////////////////////////////////////////////////////


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
        const lifecycle = new CropLifecycle();
        lifecycle.Name = json.name;
        lifecycle.Days = json.time;
        lifecycle.Fuel = json.fuel;
        lifecycle.Water = json.water;
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

    // 种子价格
    public SeedPrice: number = 0;

    // 售卖价格
    public SellPrice: number = 0;

    // 成熟后允许收获的次数
    public MatureTimes: number = 1;

    // 生命周期数组
    public Lifecycles: CropLifecycle[] = [];

    // 全部作物数据
    public static AllCrops: CropData[] = [];

    constructor(CropId: number) {
        if (CropId > 0) {
            this.CropId = CropId;
            this.initCropLifecycleFromId(CropId);
        }
    }

    // 通过作物Id获取作物生长周期数据
    public initCropLifecycleFromId(CropId: number): void {
        for (let i = 0; i < CropData.AllCrops.length; i++) {
            if (CropData.AllCrops[i].CropId === CropId) {
                const crop = CropData.AllCrops[i];
                this.CropName = crop.CropName;
                this.TempLow = crop.TempLow;
                this.TempHigh = crop.TempHigh;
                this.SeedPrice = crop.SeedPrice;
                this.SellPrice = crop.SellPrice;
                this.MatureTimes = crop.MatureTimes;
                this.Lifecycles = crop.Lifecycles;
                break;
            }
        }
    }

    // 从json数据反序列化单个作物数据
    public static deserializeOne(json: any): CropData {
        if (!json || !Array.isArray(json.lifecycle)) {
            throw new Error(`作物 ${json?.id ?? 'unknown'} 缺少 lifecycle 数组`);
        }

        const cropData = new CropData(0);

        cropData.CropName = json.name;
        cropData.CropId = json.id;
        cropData.SeedPrice = json.seedPrice || 10;
        cropData.SellPrice = json.sellPrice || 20;
        cropData.MatureTimes = json.matureTimes ?? 1;
        cropData.TempLow = json.tempLow;
        cropData.TempHigh = json.tempHigh;

        for (let i = 0; i < json.lifecycle.length; i++) {
            const lifecycle = CropLifecycle.deserialize(json.lifecycle[i]);
            cropData.Lifecycles.push(lifecycle);
        }

        return cropData;
    }

    // 从json数据反序列化所有作物数据
    // 读取json资源：https://docs.cocos.com/creator/manual/zh/asset/json.html
    public static async deserializeAll(): Promise<void> {
        if (CropData.AllCrops.length > 0) {
            return;
        }

        const asset = await Common.loadResourceAsync<JsonAsset>(CropDataResourceName, JsonAsset);
        if (!asset || !Array.isArray(asset.json)) {
            // 抛给 GameManager 统一显示“加载失败”，避免缺少配置时仍进入不可玩的主场景。
            throw new Error(`无法加载作物配置: resources/${CropDataResourceName}.json`);
        }

        // 先完整解析到临时数组，任何一项失败都不会留下“只加载了一半”的全局状态。
        const crops = asset.json.map(item => CropData.deserializeOne(item));
        CropData.AllCrops = crops;
        console.log(`[CropData] 已加载 ${crops.length} 种作物配置`);
    }
}


@ccclass('CropNode')
export class CropNode extends Node {
    public mButton: Button;
    private mSprite: Sprite;

    public TilePosX: number;
    public TilePosY: number;

    public crop: CropData = null;


    // 作物的当前生命周期
    public CurrentLifecycleIndex: number = CropState.Seed;

    // 作物的种植时间（13位总毫秒数）
    public PlantTime: number = 0;

    // 作物的当前生命周期的开始时间（13位总毫秒数）
    public CurrentLifecycleStartTime: number = 0;

    // 作物的当前生命周期的累积生长时间（13位总毫秒数）
    public CurrentLifecycleGrowTime: number = 0;

    // 已经成熟的次数
    public HarvestTimes: number = 0;

    // 作物状态
    private cropState: CropState = CropState.Seed;


    // 种下
    born(): void {
        this.CurrentLifecycleIndex = CropState.Seed;
        this.cropState = CropState.Seed;
        this.CurrentLifecycleStartTime = this.PlantTime = Date.now();
    }

    constructor(cropAtlas: SpriteAtlas, CropId: number) {
        super();

        const self = this;
        this.born();

        this.crop = new CropData(CropId);
        if (this.crop.Lifecycles.length == 0) {
            console.log("缺少作物数据，检查作物json配置文件是否加载成功, id: ", CropId);
            this.crop = null;
            return;
        }

        self.on(Node.EventType.TOUCH_START, this.onTouchStart, this);

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

    // 点击时判断下是否成熟了，成熟了就自动收获
    onTouchStart(event: Event) {
        console.log(`Crop TOUCH_START tile: (${this.TilePosX}, ${this.TilePosY}) ; xyz: (${this.position.x}, ${this.position.y}, ${this.position.z})`);

        var needUpdate: Boolean = false;
        if (this.cropState == CropState.Mature) {
            this.onHarvest();
            needUpdate = true;
        } else if (this.cropState == CropState.Dead) {
            common.audioController.playSoundWipe();   // 播放音效：铲除
            this.born();
            needUpdate = true;
        }

        if (needUpdate) {
            this.updateSpriteFrame();
        } else {
            common.audioController.playSoundClick();   // 播放点击音效
        }
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
        if (lifecycleIndex == 0) {
            return "crop_start";
        } else if (lifecycleIndex == CropState.Dead || this.isDead()) {
            return "crop_end";
        } else {
            return "crop_" + this.crop.CropId + "_0" + lifecycleIndex;
        }
    }

    // 作物生长，在soil.ts中的 update 函数中调用
    public onGrowing(env: NaturalEnv, deltaTime: number): void {
        if (this.isDead()) {
            //console.log("作物已经死亡，不再生长", this.crop.CropId, this.crop.CropName);
            return;
        }

        if (env) {
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

        if (CropData.AllCrops.length == 0) {
            console.log("缺少作物数据，检查作物json配置文件是否加载成功");
            return;
        }
        if (this.crop.Lifecycles.length == 0) {
            return;
        }

        //console.log(this.crop.CropName + " - " + this.crop.CropId + " 当前周期: ", this.CurrentLifecycleIndex + " / " + this.crop.Lifecycles.length);
        var timeNow = Date.now();

        // 天气生长倍率
        const weatherSystem = WeatherSystem.getInstance();
        const weatherMultiplier = weatherSystem ? weatherSystem.growthMultiplier : 1.0;

        var minutes = Common.RealTimeToGameTime(this.crop.Lifecycles[this.CurrentLifecycleIndex].Days);

        // 天气影响：生长时间除以倍率（倍率越高长得越快）
        var adjustedMinutes = minutes / weatherMultiplier;

        // 转化为毫秒计算
        if ((timeNow - this.CurrentLifecycleStartTime) > adjustedMinutes * 60 * 1000) {
            // 进入下一个周期
            this.enterNextLifecycle(timeNow);
            this.updateSpriteFrame();
        }
    }

    updateSpriteFrame(): void {
        var spriteFrame = common.cropAtlas.getSpriteFrame(this.getSpriteFrameName(this.CurrentLifecycleIndex));
        this.mSprite.spriteFrame = spriteFrame;
    }

    // 成熟了
    onMature(): void {
        this.cropState = CropState.Mature;
            eventBus.emit(GameEvent.CROP_MATURED, {
                cropId: this.crop.CropId,
                cropName: this.crop.CropName,
                position: { x: this.position.x, y: this.position.y },
                tile: { x: this.TilePosX, y: this.TilePosY },
            });
    }

    // 是否成熟了
    isMature(): boolean {
        return this.cropState == CropState.Mature;
    }

    // 收获
    onHarvest(): void {
        if (this.isMature()) {
            console.log(`作物: ${this.crop.CropName}(${this.crop.CropId})  收获了xxx`);
            common.audioController.playSoundGather();   // 播放收获音效

            // 存入仓库
            const warehouse = WarehouseManager.getInstance();
            if (warehouse) {
                warehouse.storeCrop(this.crop.CropId, this.crop.CropName, this.crop.SellPrice, 1);
                console.log(`[Crop] 收获作物存入仓库: ${this.crop.CropName}, 售卖价: ${this.crop.SellPrice}`);
            }

            this.HarvestTimes += 1;

            // 发送收获事件
            eventBus.emit(GameEvent.CROP_HARVESTED, {
                cropId: this.crop.CropId,
                cropName: this.crop.CropName,
                sellPrice: this.crop.SellPrice,
                harvestTimes: this.HarvestTimes,
                position: { x: this.position.x, y: this.position.y },
                tile: { x: this.TilePosX, y: this.TilePosY },
            });

            // 检查是否需要死亡（通过检查matureTimes）
            const cropData = CropData.AllCrops.find(c => c.CropId === this.crop.CropId);
            const maxHarvestTimes = cropData?.MatureTimes ?? 1;

            if (maxHarvestTimes > 0 && this.HarvestTimes >= maxHarvestTimes) {
                this.Die();
            } else {
                // 重新进入生长期
                this.enterNewLifecycle(Date.now());
            }
        }
    }

    // 判断作物是否已经死亡
    private isDead(): boolean {
        return this.CurrentLifecycleIndex == CropState.Dead || this.cropState == CropState.Dead;
    }

    // 设置作物死亡
    private Die(): void {
        console.log(`作物: ${this.crop.CropName}(${this.crop.CropId}) 寿命结束，作物死亡`);
        this.CurrentLifecycleIndex = CropState.Dead;
        this.cropState = CropState.Dead;
        eventBus.emit(GameEvent.CROP_DIED, {
            cropId: this.crop.CropId,
            cropName: this.crop.CropName,
            harvestTimes: this.HarvestTimes,
            position: { x: this.position.x, y: this.position.y },
            tile: { x: this.TilePosX, y: this.TilePosY },
        });
    }

    // 进入下一个周期
    public enterNextLifecycle(timeStart: number): void {
        // 如果当前周期已经是成熟状态，则自动收获
        if (this.isMature()) {
            this.onHarvest();
        } else {
            this.CurrentLifecycleIndex += 1;
            this.CurrentLifecycleStartTime = timeStart;
            this.CurrentLifecycleGrowTime = 0;

            // 判断作物是否已经成熟
            if (this.CurrentLifecycleIndex + 1 >= this.crop.Lifecycles.length) {
                this.onMature();    // 成熟了
            }
        }
    }

    // 进入新一轮的周期
    public enterNewLifecycle(timeStart: number): void {
        this.cropState = CropState.GrowingEx;
        this.CurrentLifecycleIndex = CropState.GrowingEx;
        this.CurrentLifecycleStartTime = timeStart;
        this.CurrentLifecycleGrowTime = 0;
    }

}
