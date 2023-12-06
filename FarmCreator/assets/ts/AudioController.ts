// AudioController.ts

import { AudioClip, AudioSource, Component, _decorator } from 'cc';
import { common } from './Common';
const { ccclass, property } = _decorator;


@ccclass("AudioController")
export class AudioController extends Component {

    // 点击音效
    @property(AudioClip)
    public clipClick: AudioClip = null!;

    // 扩展音效
    @property(AudioClip)
    public clipExtand: AudioClip = null!;
    
    // 铲除音效
    @property(AudioClip)
    public clipWipe: AudioClip = null!;

    // 收获音效
    @property(AudioClip)
    public clipGather: AudioClip = null!;
    
    // 烟花音效
    @property(AudioClip)
    public clipFireworks: AudioClip = null!;

    // 背景音乐
    @property(AudioSource)
    public backgroud: AudioSource = null!;


    protected onLoad(): void {
        common.audioController = this;
    }

    // 播放音乐
    playBGM() {
        this.backgroud.play();
    }

    // 暂停音乐
    pauseBGM() {
        this.backgroud.pause();
    }

    // 音效：点击
    playSoundClick() {
        this.backgroud.playOneShot(this.clipClick, 1);
    }

    // 音效：扩建
    playSoundExtand() {
        this.backgroud.playOneShot(this.clipExtand, 1);
    }

    // 音效：铲除
    playSoundWipe() {
        this.backgroud.playOneShot(this.clipWipe, 1);
    }

    // 音效：收获
    playSoundGather() {
        this.backgroud.playOneShot(this.clipGather, 1);
    }

    // 音效：烟花
    playSoundFireworks() {
        this.backgroud.playOneShot(this.clipFireworks, 1);
    }
}