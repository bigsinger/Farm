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

    // 背景音乐
    @property(AudioSource)
    public backgroud: AudioSource = null!;


    protected onLoad(): void {
        common.audioController = this;
    }

    // 播放音乐
    play () {
        this.backgroud.play();
    }

    // 暂停音乐
    pause () {
        this.backgroud.pause();
    }

    playClickEffect () {
        this.backgroud.playOneShot(this.clipClick, 1);
    }

    playExtandEffect () {
        this.backgroud.playOneShot(this.clipExtand, 1);
    }
}