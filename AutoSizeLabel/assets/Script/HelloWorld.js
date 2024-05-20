cc.Class({
    extends: cc.Component,

    properties: {
        label: {
            default: null,
            type: cc.Label
        },
        editBox:{
            default:null,
            type:cc.EditBox
        },
        layoutContainer:cc.Node,
    },

    // use this for initialization
    onLoad: function () {
    },
    
    doSetText: function(){
		this.label.string = this.editBox.string;
		
		// 在属性面板中设置好的话，如下代码可以不用调用。如果想要动态实现，可以调用如下代码。
        // this.label.overflow = cc.Label.Overflow.NONE;
		// if (this.label.node.width >= 200) { //maxWidth气泡最大宽度
		// 	this.label.overflow = cc.Label.Overflow.RESIZE_HEIGHT;
		// 	this.label.node.width = 200;
		// };
		// this.layoutContainer.width = this.label.node.width;
		// this.layoutContainer.height = this.label.node.height;
    },
    // called every frame
    // update: function (dt) {

    // },
});
