// Settings.ts

import { sys, Component, _decorator, error } from 'cc';
import { common } from './Common';
const { ccclass, property } = _decorator;


@ccclass("Settings")
export class Settings extends Component {
    public static instance: Settings = null!;

    protected onLoad(): void {
        Settings.instance = this;

    }

    // 音效开关
    public soundEffectSwitch: number = -1;

    // 背景音乐开关
    public bgmSwitch: number = -1;

    // 获取音效开关
    public getSoundEffectSwitch(): boolean {
        if (this.soundEffectSwitch == -1) {
            this.soundEffectSwitch = sys.localStorage.getItem("soundEffectSwitch") == "1" ? 1 : 0;
        }
        return this.soundEffectSwitch == 1;
    }

    // 获取背景音乐开关
    public getBGMSwitch(): boolean {
        if (this.bgmSwitch == -1) {
            this.bgmSwitch = sys.localStorage.getItem("bgmSwitch") == "1" ? 1 : 0;
        }
        return this.bgmSwitch == 1;
    }

    // 切换音效开关
    public SwitchSoundEffect(toggle: boolean) {
        this.soundEffectSwitch = toggle ? 1 : 0;
        sys.localStorage.setItem("soundEffectSwitch", this.soundEffectSwitch.toString());
    }

    // 切换背景音乐开关
    public SwitchBGM(toggle: boolean) {
        this.bgmSwitch = toggle ? 1 : 0;
        sys.localStorage.setItem("bgmSwitch", this.bgmSwitch.toString());

        if (toggle) { common.audioController.playBGM(); } else { common.audioController.stopBGM(); }
    }
}