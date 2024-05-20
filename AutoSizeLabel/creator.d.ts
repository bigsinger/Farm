
/** !#en
The main namespace of Cocos2d-JS, all engine core classes, functions, properties and constants are defined in this namespace.
!#zh
Cocos 引擎的主要命名空间，引擎代码中所有的类，函数，属性和常量都在这个命名空间中定义。 */
declare module cc {	
	/** !#en Init Debug setting.
	!#zh 设置调试模式。 
	*/
	export function _initDebugSetting(mode : DebugMode) : void;	
	/** !#en
	Outputs an error message to the Cocos Creator Console (editor) or Web Console (runtime).<br/>
	- In Cocos Creator, error is red.<br/>
	- In Chrome, error have a red icon along with red message text.<br/>
	!#zh
	输出错误消息到 Cocos Creator 编辑器的 Console 或运行时页面端的 Console 中。<br/>
	- 在 Cocos Creator 中，错误信息显示是红色的。<br/>
	- 在 Chrome 中，错误信息有红色的图标以及红色的消息文本。<br/>
	@param obj A JavaScript string containing zero or more substitution strings.
	@param subst JavaScript objects with which to replace substitution strings within msg. This gives you additional control over the format of the output. 
	*/
	export function error(obj : any, subst : any) : void;	
	/** !#en
	Outputs a warning message to the Cocos Creator Console (editor) or Web Console (runtime).
	- In Cocos Creator, warning is yellow.
	- In Chrome, warning have a yellow warning icon with the message text.
	!#zh
	输出警告消息到 Cocos Creator 编辑器的 Console 或运行时 Web 端的 Console 中。<br/>
	- 在 Cocos Creator 中，警告信息显示是黄色的。<br/>
	- 在 Chrome 中，警告信息有着黄色的图标以及黄色的消息文本。<br/>
	@param obj A JavaScript string containing zero or more substitution strings.
	@param subst JavaScript objects with which to replace substitution strings within msg. This gives you additional control over the format of the output. 
	*/
	export function warn(obj : any, subst : any) : void;	
	/** !#en Outputs a message to the Cocos Creator Console (editor) or Web Console (runtime).
	!#zh 输出一条消息到 Cocos Creator 编辑器的 Console 或运行时 Web 端的 Console 中。
	@param obj A JavaScript string containing zero or more substitution strings.
	@param subst JavaScript objects with which to replace substitution strings within msg. This gives you additional control over the format of the output. 
	*/
	export function log(obj : any, subst : any) : void;	
	/** !#en
	Outputs an informational message to the Cocos Creator Console (editor) or Web Console (runtime).
	- In Cocos Creator, info is blue.
	- In Firefox and Chrome, a small "i" icon is displayed next to these items in the Web Console's log.
	!#zh
	输出一条信息消息到 Cocos Creator 编辑器的 Console 或运行时 Web 端的 Console 中。
	- 在 Cocos Creator 中，Info 信息显示是蓝色的。<br/>
	- 在 Firefox 和  Chrome 中，Info 信息有着小 “i” 图标。
	@param obj A JavaScript string containing zero or more substitution strings.
	@param subst JavaScript objects with which to replace substitution strings within msg. This gives you additional control over the format of the output. 
	*/
	export function info(obj : any, subst : any) : void;	
	/** !#en
	Creates the speed action which changes the speed of an action, making it take longer (speed > 1)
	or less (speed < 1) time. <br/>
	Useful to simulate 'slow motion' or 'fast forward' effect.
	!#zh 修改目标动作的速率。
	
	@example 
	```js
	// change the target action speed;
	var action = cc.scaleTo(0.2, 1, 0.6);
	var newAction = cc.speed(action, 0.5);
	``` 
	*/
	export function speed(action : ActionInterval, speed : number) : Action;	
	/** !#en Create a follow action which makes its target follows another node.
	!#zh 追踪目标节点的位置。
	
	@example 
	```js
	// example
	// creates the action with a set boundary
	var followAction = cc.follow(targetNode, cc.rect(0, 0, screenWidth * 2 - 100, screenHeight));
	node.runAction(followAction);
	
	// creates the action with no boundary set
	var followAction = cc.follow(targetNode);
	node.runAction(followAction);
	``` 
	*/
	export function follow(followedNode : Node, rect : Rect) : Action;	
	/** Points setter 
	*/
	export function setPoints(points : any[]) : void;	
	/** !#en Creates an action with a Cardinal Spline array of points and tension.
	!#zh 按基数样条曲线轨迹移动到目标位置。
	@param points array of control points
	
	@example 
	```js
	//create a cc.CardinalSplineTo
	var action1 = cc.cardinalSplineTo(3, array, 0);
	``` 
	*/
	export function cardinalSplineTo(duration : number, points : any[], tension : number) : ActionInterval;	
	/** update position of target 
	*/
	export function updatePosition(newPos : Vec2) : void;	
	/** !#en Creates an action with a Cardinal Spline array of points and tension.
	!#zh 按基数样条曲线轨迹移动指定的距离。 
	*/
	export function cardinalSplineBy(duration : number, points : any[], tension : number) : ActionInterval;	
	/** !#en Creates an action with a Cardinal Spline array of points and tension.
	!#zh 按 Catmull Rom 样条曲线轨迹移动到目标位置。
	
	@example 
	```js
	var action1 = cc.catmullRomTo(3, array);
	``` 
	*/
	export function catmullRomTo(dt : number, points : any[]) : ActionInterval;	
	/** !#en Creates an action with a Cardinal Spline array of points and tension.
	!#zh 按 Catmull Rom 样条曲线轨迹移动指定的距离。
	
	@example 
	```js
	var action1 = cc.catmullRomBy(3, array);
	``` 
	*/
	export function catmullRomBy(dt : number, points : any[]) : ActionInterval;	
	/** !#en
	Creates the action easing object with the rate parameter. <br />
	From slow to fast.
	!#zh 创建 easeIn 缓动对象，由慢到快。
	
	@example 
	```js
	// example
	action.easing(cc.easeIn(3.0));
	``` 
	*/
	export function easeIn(rate : number) : any;	
	/** !#en
	Creates the action easing object with the rate parameter. <br />
	From fast to slow.
	!#zh 创建 easeOut 缓动对象，由快到慢。
	
	@example 
	```js
	// example
	action.easing(cc.easeOut(3.0));
	``` 
	*/
	export function easeOut(rate : number) : any;	
	/** !#en
	Creates the action easing object with the rate parameter. <br />
	Slow to fast then to slow.
	!#zh 创建 easeInOut 缓动对象，慢到快，然后慢。
	
	@example 
	```js
	//The new usage
	action.easing(cc.easeInOut(3.0));
	``` 
	*/
	export function easeInOut(rate : number) : any;	
	/** !#en
	Creates the action easing object with the rate parameter. <br />
	Reference easeInExpo: <br />
	http://www.zhihu.com/question/21981571/answer/19925418
	!#zh
	创建 easeExponentialIn 缓动对象。<br />
	EaseExponentialIn 是按指数函数缓动进入的动作。<br />
	参考 easeInExpo：http://www.zhihu.com/question/21981571/answer/19925418
	
	@example 
	```js
	// example
	action.easing(cc.easeExponentialIn());
	``` 
	*/
	export function easeExponentialIn() : any;	
	/** !#en
	Creates the action easing object. <br />
	Reference easeOutExpo: <br />
	http://www.zhihu.com/question/21981571/answer/19925418
	!#zh
	创建 easeExponentialOut 缓动对象。<br />
	EaseExponentialOut 是按指数函数缓动退出的动作。<br />
	参考 easeOutExpo：http://www.zhihu.com/question/21981571/answer/19925418
	
	@example 
	```js
	// example
	action.easing(cc.easeExponentialOut());
	``` 
	*/
	export function easeExponentialOut() : any;	
	/** !#en
	Creates an EaseExponentialInOut action easing object. <br />
	Reference easeInOutExpo: <br />
	http://www.zhihu.com/question/21981571/answer/19925418
	!#zh
	创建 easeExponentialInOut 缓动对象。<br />
	EaseExponentialInOut 是按指数函数缓动进入并退出的动作。<br />
	参考 easeInOutExpo：http://www.zhihu.com/question/21981571/answer/19925418
	
	@example 
	```js
	// example
	action.easing(cc.easeExponentialInOut());
	``` 
	*/
	export function easeExponentialInOut() : any;	
	/** !#en
	Creates an EaseSineIn action. <br />
	Reference easeInSine: <br />
	http://www.zhihu.com/question/21981571/answer/19925418
	!#zh
	创建 EaseSineIn 缓动对象。<br />
	EaseSineIn 是按正弦函数缓动进入的动作。<br />
	参考 easeInSine：http://www.zhihu.com/question/21981571/answer/19925418
	
	@example 
	```js
	// example
	action.easing(cc.easeSineIn());
	``` 
	*/
	export function easeSineIn() : any;	
	/** !#en
	Creates an EaseSineOut action easing object. <br />
	Reference easeOutSine: <br />
	http://www.zhihu.com/question/21981571/answer/19925418
	!#zh
	创建 EaseSineOut 缓动对象。<br />
	EaseSineIn 是按正弦函数缓动退出的动作。<br />
	参考 easeOutSine：http://www.zhihu.com/question/21981571/answer/19925418
	
	@example 
	```js
	// example
	action.easing(cc.easeSineOut());
	``` 
	*/
	export function easeSineOut() : any;	
	/** !#en
	Creates the action easing object. <br />
	Reference easeInOutSine: <br />
	http://www.zhihu.com/question/21981571/answer/19925418
	!#zh
	创建 easeSineInOut 缓动对象。<br />
	EaseSineIn 是按正弦函数缓动进入并退出的动作。<br />
	参考 easeInOutSine：http://www.zhihu.com/question/21981571/answer/19925418
	
	@example 
	```js
	// example
	action.easing(cc.easeSineInOut());
	``` 
	*/
	export function easeSineInOut() : any;	
	/** !#en
	Creates the action easing obejct with the period in radians (default is 0.3). <br />
	Reference easeInElastic: <br />
	http://www.zhihu.com/question/21981571/answer/19925418
	!#zh
	创建 easeElasticIn 缓动对象。<br />
	EaseElasticIn 是按弹性曲线缓动进入的动作。<br />
	参数 easeInElastic：http://www.zhihu.com/question/21981571/answer/19925418
	
	@example 
	```js
	// example
	action.easing(cc.easeElasticIn(3.0));
	``` 
	*/
	export function easeElasticIn(period : number) : any;	
	/** !#en
	Creates the action easing object with the period in radians (default is 0.3). <br />
	Reference easeOutElastic: <br />
	http://www.zhihu.com/question/21981571/answer/19925418
	!#zh
	创建 easeElasticOut 缓动对象。<br />
	EaseElasticOut 是按弹性曲线缓动退出的动作。<br />
	参考 easeOutElastic：http://www.zhihu.com/question/21981571/answer/19925418
	
	@example 
	```js
	// example
	action.easing(cc.easeElasticOut(3.0));
	``` 
	*/
	export function easeElasticOut(period : number) : any;	
	/** !#en
	Creates the action easing object with the period in radians (default is 0.3). <br />
	Reference easeInOutElastic: <br />
	http://www.zhihu.com/question/21981571/answer/19925418
	!#zh
	创建 easeElasticInOut 缓动对象。<br />
	EaseElasticInOut 是按弹性曲线缓动进入并退出的动作。<br />
	参考 easeInOutElastic：http://www.zhihu.com/question/21981571/answer/19925418
	
	@example 
	```js
	// example
	action.easing(cc.easeElasticInOut(3.0));
	``` 
	*/
	export function easeElasticInOut(period : number) : any;	
	/** !#en
	Creates the action easing object. <br />
	Eased bounce effect at the beginning.
	!#zh
	创建 easeBounceIn 缓动对象。<br />
	EaseBounceIn 是按弹跳动作缓动进入的动作。
	
	@example 
	```js
	// example
	action.easing(cc.easeBounceIn());
	``` 
	*/
	export function easeBounceIn() : any;	
	/** !#en
	Creates the action easing object. <br />
	Eased bounce effect at the ending.
	!#zh
	创建 easeBounceOut 缓动对象。<br />
	EaseBounceOut 是按弹跳动作缓动退出的动作。
	
	@example 
	```js
	// example
	action.easing(cc.easeBounceOut());
	``` 
	*/
	export function easeBounceOut() : any;	
	/** !#en
	Creates the action easing object. <br />
	Eased bounce effect at the begining and ending.
	!#zh
	创建 easeBounceInOut 缓动对象。<br />
	EaseBounceInOut 是按弹跳动作缓动进入并退出的动作。
	
	@example 
	```js
	// example
	action.easing(cc.easeBounceInOut());
	``` 
	*/
	export function easeBounceInOut() : any;	
	/** !#en
	Creates the action easing object. <br />
	In the opposite direction to move slowly, and then accelerated to the right direction.
	!#zh
	创建 easeBackIn 缓动对象。<br />
	easeBackIn 是在相反的方向缓慢移动，然后加速到正确的方向。<br />
	
	@example 
	```js
	// example
	action.easing(cc.easeBackIn());
	``` 
	*/
	export function easeBackIn() : any;	
	/** !#en
	Creates the action easing object. <br />
	Fast moving more than the finish, and then slowly back to the finish.
	!#zh
	创建 easeBackOut 缓动对象。<br />
	easeBackOut 快速移动超出目标，然后慢慢回到目标点。
	
	@example 
	```js
	// example
	action.easing(cc.easeBackOut());
	``` 
	*/
	export function easeBackOut() : any;	
	/** !#en
	Creates the action easing object. <br />
	Begining of cc.EaseBackIn. Ending of cc.EaseBackOut.
	!#zh
	创建 easeBackInOut 缓动对象。<br />
	
	@example 
	```js
	// example
	action.easing(cc.easeBackInOut());
	``` 
	*/
	export function easeBackInOut() : any;	
	/** !#en
	Creates the action easing object. <br />
	Into the 4 reference point. <br />
	To calculate the motion curve.
	!#zh
	创建 easeBezierAction 缓动对象。<br />
	EaseBezierAction 是按贝塞尔曲线缓动的动作。
	@param p0 The first bezier parameter
	@param p1 The second bezier parameter
	@param p2 The third bezier parameter
	@param p3 The fourth bezier parameter
	
	@example 
	```js
	// example
	action.easing(cc.easeBezierAction(0.5, 0.5, 1.0, 1.0));
	``` 
	*/
	export function easeBezierAction(p0 : number, p1 : number, p2 : number, p3 : number) : any;	
	/** !#en
	Creates the action easing object. <br />
	Reference easeInQuad: <br />
	http://www.zhihu.com/question/21981571/answer/19925418
	!#zh
	创建 easeQuadraticActionIn 缓动对象。<br />
	EaseQuadraticIn是按二次函数缓动进入的动作。<br />
	参考 easeInQuad：http://www.zhihu.com/question/21981571/answer/19925418
	
	@example 
	```js
	//example
	action.easing(cc.easeQuadraticActionIn());
	``` 
	*/
	export function easeQuadraticActionIn() : any;	
	/** !#en
	Creates the action easing object. <br />
	Reference easeOutQuad: <br />
	http://www.zhihu.com/question/21981571/answer/19925418
	!#zh
	创建 easeQuadraticActionOut 缓动对象。<br />
	EaseQuadraticOut 是按二次函数缓动退出的动作。<br />
	参考 easeOutQuad：http://www.zhihu.com/question/21981571/answer/19925418
	
	@example 
	```js
	//example
	action.easing(cc.easeQuadraticActionOut());
	``` 
	*/
	export function easeQuadraticActionOut() : any;	
	/** !#en
	Creates the action easing object. <br />
	Reference easeInOutQuad: <br />
	http://www.zhihu.com/question/21981571/answer/19925418
	!#zh
	创建 easeQuadraticActionInOut 缓动对象。<br />
	EaseQuadraticInOut 是按二次函数缓动进入并退出的动作。<br />
	参考 easeInOutQuad：http://www.zhihu.com/question/21981571/answer/19925418
	
	@example 
	```js
	//example
	action.easing(cc.easeQuadraticActionInOut());
	``` 
	*/
	export function easeQuadraticActionInOut() : any;	
	/** !#en
	Creates the action easing object. <br />
	Reference easeIntQuart: <br />
	http://www.zhihu.com/question/21981571/answer/19925418
	!#zh
	创建 easeQuarticActionIn 缓动对象。<br />
	EaseQuarticIn 是按四次函数缓动进入的动作。<br />
	参考 easeIntQuart：http://www.zhihu.com/question/21981571/answer/19925418
	
	@example 
	```js
	//example
	action.easing(cc.easeQuarticActionIn());
	``` 
	*/
	export function easeQuarticActionIn() : any;	
	/** !#en
	Creates the action easing object. <br />
	Reference easeOutQuart: <br />
	http://www.zhihu.com/question/21981571/answer/19925418
	!#zh
	创建 easeQuarticActionOut 缓动对象。<br />
	EaseQuarticOut 是按四次函数缓动退出的动作。<br />
	参考 easeOutQuart：http://www.zhihu.com/question/21981571/answer/19925418
	
	@example 
	```js
	//example
	action.easing(cc.QuarticActionOut());
	``` 
	*/
	export function easeQuarticActionOut() : any;	
	/** !#en
	Creates the action easing object.  <br />
	Reference easeInOutQuart: <br />
	http://www.zhihu.com/question/21981571/answer/19925418
	!#zh
	创建 easeQuarticActionInOut 缓动对象。<br />
	EaseQuarticInOut 是按四次函数缓动进入并退出的动作。<br />
	参考 easeInOutQuart：http://www.zhihu.com/question/21981571/answer/19925418 
	*/
	export function easeQuarticActionInOut() : any;	
	/** !#en
	Creates the action easing object. <br />
	Reference easeInQuint: <br />
	http://www.zhihu.com/question/21981571/answer/19925418
	!#zh
	创建 easeQuinticActionIn 缓动对象。<br />
	EaseQuinticIn 是按五次函数缓动进的动作。<br />
	参考 easeInQuint：http://www.zhihu.com/question/21981571/answer/19925418
	
	@example 
	```js
	//example
	action.easing(cc.easeQuinticActionIn());
	``` 
	*/
	export function easeQuinticActionIn() : any;	
	/** !#en
	Creates the action easing object. <br />
	Reference easeOutQuint: <br />
	http://www.zhihu.com/question/21981571/answer/19925418
	!#zh
	创建 easeQuinticActionOut 缓动对象。<br />
	EaseQuinticOut 是按五次函数缓动退出的动作
	参考 easeOutQuint：http://www.zhihu.com/question/21981571/answer/19925418
	
	@example 
	```js
	//example
	action.easing(cc.easeQuadraticActionOut());
	``` 
	*/
	export function easeQuinticActionOut() : any;	
	/** !#en
	Creates the action easing object. <br />
	Reference easeInOutQuint: <br />
	http://www.zhihu.com/question/21981571/answer/19925418
	!#zh
	创建 easeQuinticActionInOut 缓动对象。<br />
	EaseQuinticInOut是按五次函数缓动进入并退出的动作。<br />
	参考 easeInOutQuint：http://www.zhihu.com/question/21981571/answer/19925418
	
	@example 
	```js
	//example
	action.easing(cc.easeQuinticActionInOut());
	``` 
	*/
	export function easeQuinticActionInOut() : any;	
	/** !#en
	Creates the action easing object. <br />
	Reference easeInCirc: <br />
	http://www.zhihu.com/question/21981571/answer/19925418
	!#zh
	创建 easeCircleActionIn 缓动对象。<br />
	EaseCircleIn是按圆形曲线缓动进入的动作。<br />
	参考 easeInCirc：http://www.zhihu.com/question/21981571/answer/19925418
	
	@example 
	```js
	//example
	action.easing(cc.easeCircleActionIn());
	``` 
	*/
	export function easeCircleActionIn() : any;	
	/** !#en
	Creates the action easing object. <br />
	Reference easeOutCirc: <br />
	http://www.zhihu.com/question/21981571/answer/19925418
	!#zh
	创建 easeCircleActionOut 缓动对象。<br />
	EaseCircleOut是按圆形曲线缓动退出的动作。<br />
	参考 easeOutCirc：http://www.zhihu.com/question/21981571/answer/19925418 
	*/
	export function easeCircleActionOut() : any;	
	/** !#en
	Creates the action easing object. <br />
	Reference easeInOutCirc: <br />
	http://www.zhihu.com/question/21981571/answer/19925418
	!#zh
	创建 easeCircleActionInOut 缓动对象。<br />
	EaseCircleInOut 是按圆形曲线缓动进入并退出的动作。<br />
	参考 easeInOutCirc：http://www.zhihu.com/question/21981571/answer/19925418
	
	@example 
	```js
	//example
	action.easing(cc.easeCircleActionInOut());
	``` 
	*/
	export function easeCircleActionInOut() : any;	
	/** !#en
	Creates the action easing object. <br />
	Reference easeInCubic: <br />
	http://www.zhihu.com/question/21981571/answer/19925418
	!#zh
	创建 easeCubicActionIn 缓动对象。<br />
	EaseCubicIn 是按三次函数缓动进入的动作。<br />
	参考 easeInCubic：http://www.zhihu.com/question/21981571/answer/19925418
	
	@example 
	```js
	//example
	action.easing(cc.easeCubicActionIn());
	``` 
	*/
	export function easeCubicActionIn() : any;	
	/** !#en
	Creates the action easing object. <br />
	Reference easeOutCubic: <br />
	http://www.zhihu.com/question/21981571/answer/19925418
	!#zh
	创建 easeCubicActionOut 缓动对象。<br />
	EaseCubicOut 是按三次函数缓动退出的动作。<br />
	参考 easeOutCubic：http://www.zhihu.com/question/21981571/answer/19925418
	
	@example 
	```js
	//example
	action.easing(cc.easeCubicActionOut());
	``` 
	*/
	export function easeCubicActionOut() : any;	
	/** !#en
	Creates the action easing object. <br />
	Reference easeInOutCubic: <br />
	http://www.zhihu.com/question/21981571/answer/19925418
	!#zh
	创建 easeCubicActionInOut 缓动对象。<br />
	EaseCubicInOut是按三次函数缓动进入并退出的动作。<br />
	参考 easeInOutCubic：http://www.zhihu.com/question/21981571/answer/19925418 
	*/
	export function easeCubicActionInOut() : any;	
	/** !#en Show the Node.
	!#zh 立即显示。
	
	@example 
	```js
	// example
	var showAction = cc.show();
	``` 
	*/
	export function show() : ActionInstant;	
	/** !#en Hide the node.
	!#zh 立即隐藏。
	
	@example 
	```js
	// example
	var hideAction = cc.hide();
	``` 
	*/
	export function hide() : ActionInstant;	
	/** !#en Toggles the visibility of a node.
	!#zh 显隐状态切换。
	
	@example 
	```js
	// example
	var toggleVisibilityAction = cc.toggleVisibility();
	``` 
	*/
	export function toggleVisibility() : ActionInstant;	
	/** !#en Create a RemoveSelf object with a flag indicate whether the target should be cleaned up while removing.
	!#zh 从父节点移除自身。
	
	@example 
	```js
	// example
	var removeSelfAction = cc.removeSelf();
	``` 
	*/
	export function removeSelf(isNeedCleanUp : boolean) : ActionInstant;	
	/** !#en Create a FlipX action to flip or unflip the target.
	!#zh X轴翻转。
	@param flip Indicate whether the target should be flipped or not
	
	@example 
	```js
	var flipXAction = cc.flipX(true);
	``` 
	*/
	export function flipX(flip : boolean) : ActionInstant;	
	/** !#en Create a FlipY action to flip or unflip the target.
	!#zh Y轴翻转。
	
	@example 
	```js
	var flipYAction = cc.flipY(true);
	``` 
	*/
	export function flipY(flip : boolean) : ActionInstant;	
	/** !#en Creates a Place action with a position.
	!#zh 放置在目标位置。
	
	@example 
	```js
	// example
	var placeAction = cc.place(cc.p(200, 200));
	var placeAction = cc.place(200, 200);
	``` 
	*/
	export function place(pos : Vec2|number, y? : number) : ActionInstant;	
	/** !#en Creates the action with the callback.
	!#zh 执行回调函数。
	@param data data for function, it accepts all data types.
	
	@example 
	```js
	// example
	// CallFunc without data
	var finish = cc.callFunc(this.removeSprite, this);
	
	// CallFunc with data
	var finish = cc.callFunc(this.removeFromParentAndCleanup, this._grossini,  true);
	``` 
	*/
	export function callFunc(selector : Function, selectorTarget? : any|void, data? : any|void) : ActionInstant;	
	/** !#en
	Helper constructor to create an array of sequenceable actions
	The created action will run actions sequentially, one after another.
	!#zh 顺序执行动作，创建的动作将按顺序依次运行。
	
	@example 
	```js
	// example
	// create sequence with actions
	var seq = cc.sequence(act1, act2);
	
	// create sequence with array
	var seq = cc.sequence(actArray);
	``` 
	*/
	export function sequence(tempArray : any[]|FiniteTimeAction) : ActionInterval;	
	/** !#en Creates a Repeat action. Times is an unsigned integer between 1 and pow(2,30)
	!#zh 重复动作，可以按一定次数重复一个动，如果想永远重复一个动作请使用 repeatForever 动作来完成。
	
	@example 
	```js
	// example
	var rep = cc.repeat(cc.sequence(jump2, jump1), 5);
	``` 
	*/
	export function repeat(action : FiniteTimeAction, times : number) : ActionInterval;	
	/** !#en Create a acton which repeat forever, as it runs forever, it can't be added into cc.sequence and cc.spawn.
	!#zh 永远地重复一个动作，有限次数内重复一个动作请使用 repeat 动作，由于这个动作不会停止，所以不能被添加到 cc.sequence 或 cc.spawn 中。
	
	@example 
	```js
	// example
	var repeat = cc.repeatForever(cc.rotateBy(1.0, 360));
	``` 
	*/
	export function repeatForever(action : FiniteTimeAction) : ActionInterval;	
	/** !#en Create a spawn action which runs several actions in parallel.
	!#zh 同步执行动作，同步执行一组动作。
	
	@example 
	```js
	// example
	var action = cc.spawn(cc.jumpBy(2, cc.p(300, 0), 50, 4), cc.rotateBy(2, 720));
	todo:It should be the direct use new
	``` 
	*/
	export function spawn(tempArray : any[]|FiniteTimeAction) : FiniteTimeAction;	
	/** !#en
	Rotates a Node object to a certain angle by modifying its rotation property. <br/>
	The direction will be decided by the shortest angle.
	!#zh 旋转到目标角度，通过逐帧修改它的 rotation 属性，旋转方向将由最短的角度决定。
	@param duration duration in seconds
	@param deltaAngleX deltaAngleX in degrees.
	@param deltaAngleY deltaAngleY in degrees.
	
	@example 
	```js
	// example
	var rotateTo = cc.rotateTo(2, 61.0);
	``` 
	*/
	export function rotateTo(duration : number, deltaAngleX : number, deltaAngleY? : number) : ActionInterval;	
	/** !#en
	Rotates a Node object clockwise a number of degrees by modifying its rotation property.
	Relative to its properties to modify.
	!#zh 旋转指定的角度。
	@param duration duration in seconds
	@param deltaAngleX deltaAngleX in degrees
	@param deltaAngleY deltaAngleY in degrees
	
	@example 
	```js
	// example
	var actionBy = cc.rotateBy(2, 360);
	``` 
	*/
	export function rotateBy(duration : number, deltaAngleX : number, deltaAngleY? : number) : ActionInterval;	
	/** !#en
	Moves a Node object x,y pixels by modifying its position property.                                  <br/>
	x and y are relative to the position of the object.                                                     <br/>
	Several MoveBy actions can be concurrently called, and the resulting                                  <br/>
	movement will be the sum of individual movements.
	!#zh 移动指定的距离。
	@param duration duration in seconds
	
	@example 
	```js
	// example
	var actionTo = cc.moveBy(2, cc.p(windowSize.width - 40, windowSize.height - 40));
	``` 
	*/
	export function moveBy(duration : number, deltaPos : Vec2|number, deltaY : number) : ActionInterval;	
	/** !#en
	Moves a Node object to the position x,y. x and y are absolute coordinates by modifying its position property. <br/>
	Several MoveTo actions can be concurrently called, and the resulting                                            <br/>
	movement will be the sum of individual movements.
	!#zh 移动到目标位置。
	@param duration duration in seconds
	
	@example 
	```js
	// example
	var actionBy = cc.moveTo(2, cc.p(80, 80));
	``` 
	*/
	export function moveTo(duration : number, position : Vec2, y : number) : ActionInterval;	
	/** !#en
	Create a action which skews a Node object to given angles by modifying its skewX and skewY properties.
	Changes to the specified value.
	!#zh 偏斜到目标角度。
	@param t time in seconds
	
	@example 
	```js
	// example
	var actionTo = cc.skewTo(2, 37.2, -37.2);
	``` 
	*/
	export function skewTo(t : number, sx : number, sy : number) : ActionInterval;	
	/** !#en
	Skews a Node object by skewX and skewY degrees. <br />
	Relative to its property modification.
	!#zh 偏斜指定的角度。
	@param t time in seconds
	@param sx sx skew in degrees for X axis
	@param sy sy skew in degrees for Y axis
	
	@example 
	```js
	// example
	var actionBy = cc.skewBy(2, 0, -90);
	``` 
	*/
	export function skewBy(t : number, sx : number, sy : number) : ActionInterval;	
	/** !#en
	Moves a Node object simulating a parabolic jump movement by modifying it's position property.
	Relative to its movement.
	!#zh 用跳跃的方式移动指定的距离。
	
	@example 
	```js
	// example
	var actionBy = cc.jumpBy(2, cc.p(300, 0), 50, 4);
	var actionBy = cc.jumpBy(2, 300, 0, 50, 4);
	``` 
	*/
	export function jumpBy(duration : number, position : Vec2|number, y? : number, height : number, jumps : number) : ActionInterval;	
	/** !#en
	Moves a Node object to a parabolic position simulating a jump movement by modifying its position property. <br />
	Jump to the specified location.
	!#zh 用跳跃的方式移动到目标位置。
	
	@example 
	```js
	// example
	var actionTo = cc.jumpTo(2, cc.p(300, 300), 50, 4);
	var actionTo = cc.jumpTo(2, 300, 300, 50, 4);
	``` 
	*/
	export function jumpTo(duration : number, position : Vec2|number, y? : number, height : number, jumps : number) : ActionInterval;	
	/** !#en
	An action that moves the target with a cubic Bezier curve by a certain distance.
	Relative to its movement.
	!#zh 按贝赛尔曲线轨迹移动指定的距离。
	@param t time in seconds
	@param c Array of points
	
	@example 
	```js
	// example
	var bezier = [cc.p(0, windowSize.height / 2), cc.p(300, -windowSize.height / 2), cc.p(300, 100)];
	var bezierForward = cc.bezierBy(3, bezier);
	``` 
	*/
	export function bezierBy(t : number, c : any[]) : ActionInterval;	
	/** !#en An action that moves the target with a cubic Bezier curve to a destination point.
	!#zh 按贝赛尔曲线轨迹移动到目标位置。
	@param c array of points
	
	@example 
	```js
	// example
	var bezier = [cc.p(0, windowSize.height / 2), cc.p(300, -windowSize.height / 2), cc.p(300, 100)];
	var bezierTo = cc.bezierTo(2, bezier);
	``` 
	*/
	export function bezierTo(t : number, c : any[]) : ActionInterval;	
	/** !#en Scales a Node object to a zoom factor by modifying it's scale property.
	!#zh 将节点大小缩放到指定的倍数。
	@param sx scale parameter in X
	@param sy scale parameter in Y, if Null equal to sx
	
	@example 
	```js
	// example
	// It scales to 0.5 in both X and Y.
	var actionTo = cc.scaleTo(2, 0.5);
	
	// It scales to 0.5 in x and 2 in Y
	var actionTo = cc.scaleTo(2, 0.5, 2);
	``` 
	*/
	export function scaleTo(duration : number, sx : number, sy? : number) : ActionInterval;	
	/** !#en
	Scales a Node object a zoom factor by modifying it's scale property.
	Relative to its changes.
	!#zh 按指定的倍数缩放节点大小。
	@param duration duration in seconds
	@param sx sx  scale parameter in X
	@param sy sy scale parameter in Y, if Null equal to sx
	
	@example 
	```js
	// example without sy, it scales by 2 both in X and Y
	var actionBy = cc.scaleBy(2, 2);
	
	//example with sy, it scales by 0.25 in X and 4.5 in Y
	var actionBy2 = cc.scaleBy(2, 0.25, 4.5);
	``` 
	*/
	export function scaleBy(duration : number, sx : number, sy? : number|void) : ActionInterval;	
	/** !#en Blinks a Node object by modifying it's visible property.
	!#zh 闪烁（基于透明度）。
	@param duration duration in seconds
	@param blinks blinks in times
	
	@example 
	```js
	// example
	var action = cc.blink(2, 10);
	``` 
	*/
	export function blink(duration : number, blinks : number) : ActionInterval;	
	/** !#en
	Fades an object that implements the cc.RGBAProtocol protocol.
	It modifies the opacity from the current value to a custom one.
	!#zh 修改透明度到指定值。
	@param opacity 0-255, 0 is transparent
	
	@example 
	```js
	// example
	var action = cc.fadeTo(1.0, 0);
	``` 
	*/
	export function fadeTo(duration : number, opacity : number) : ActionInterval;	
	/** !#en Fades In an object that implements the cc.RGBAProtocol protocol. It modifies the opacity from 0 to 255.
	!#zh 渐显效果。
	@param duration duration in seconds
	
	@example 
	```js
	//example
	var action = cc.fadeIn(1.0);
	``` 
	*/
	export function fadeIn(duration : number) : ActionInterval;	
	/** !#en Fades Out an object that implements the cc.RGBAProtocol protocol. It modifies the opacity from 255 to 0.
	!#zh 渐隐效果。
	@param d duration in seconds
	
	@example 
	```js
	// example
	var action = cc.fadeOut(1.0);
	``` 
	*/
	export function fadeOut(d : number) : ActionInterval;	
	/** !#en Tints a Node that implements the cc.NodeRGB protocol from current tint to a custom one.
	!#zh 修改颜色到指定值。
	@param red 0-255
	@param green 0-255
	@param blue 0-255
	
	@example 
	```js
	// example
	var action = cc.tintTo(2, 255, 0, 255);
	``` 
	*/
	export function tintTo(duration : number, red : number, green : number, blue : number) : ActionInterval;	
	/** !#en
	Tints a Node that implements the cc.NodeRGB protocol from current tint to a custom one.
	Relative to their own color change.
	!#zh 按照指定的增量修改颜色。
	@param duration duration in seconds
	
	@example 
	```js
	// example
	var action = cc.tintBy(2, -127, -255, -127);
	``` 
	*/
	export function tintBy(duration : number, deltaRed : number, deltaGreen : number, deltaBlue : number) : ActionInterval;	
	/** !#en Delays the action a certain amount of seconds.
	!#en 延迟指定的时间量。
	@param d duration in seconds
	
	@example 
	```js
	// example
	var delay = cc.delayTime(1);
	``` 
	*/
	export function delayTime(d : number) : ActionInterval;	
	/** !#en Executes an action in reverse order, from time=duration to time=0.
	!#zh 反转目标动作的时间轴。
	
	@example 
	```js
	// example
	 var reverse = cc.reverseTime(this);
	``` 
	*/
	export function reverseTime(action : FiniteTimeAction) : ActionInterval;	
	/** !#en Create an action with the specified action and forced target.
	!#zh 用已有动作和一个新的目标节点创建动作。 
	*/
	export function targetedAction(target : Node, action : FiniteTimeAction) : ActionInterval;	
	/** Constructor 
	*/
	export function HashElement() : void;	
	/** !#en cc.view is the shared view object.
	!#zh cc.view 是全局的视图对象。 */
	export var view : View;	
	/** !#en Director
	!#zh 导演类。 */
	export var director : Director;	
	/** !#en cc.winSize is the alias object for the size of the current game window.
	!#zh cc.winSize 为当前的游戏窗口的大小。 */
	export var winSize : Size;	
	export var game : Game;	
	/** !#en Defines a CCClass using the given specification, please see [Class](/en/scripting/class/) for details.
	!#zh 定义一个 CCClass，传入参数必须是一个包含类型参数的字面量对象，具体用法请查阅[类型定义](/zh/scripting/class/)。
	
	@example 
	```js
	// define base class
	var Node = cc.Class();
	
	// define sub class
	var Sprite = cc.Class({
	name: 'Sprite',
	extends: Node,
	ctor: function () {
	this.url = "";
	this.id = 0;
	},
	
	properties {
	width: {
	default: 128,
	type: 'Integer',
	tooltip: 'The width of sprite'
	},
	height: 128,
	size: {
	get: function () {
	return cc.v2(this.width, this.height);
	}
	}
	},
	
	load: function () {
	// load this.url
	};
	});
	
	// instantiate
	
	var obj = new Sprite();
	obj.url = 'sprite.png';
	obj.load();
	
	// define static member
	
	Sprite.count = 0;
	Sprite.getBounds = function (spriteList) {
	// ...
	};
	``` 
	*/
	export function Class(options : { name?; extends?; ctor?; properties?; statics?; mixins?; editor? : { requireComponent? : Component; disallowMultiple? : Component; menu? : string; executeInEditMode? : boolean; playOnFocus? : boolean; inspector? : string; icon? : string; help? : string; } ; update?; lateUpdate?; onLoad?; start?; onEnable?; onDisable?; onDestroy?; onFocusInEditor?; onLostFocusInEditor?; resetInEditor?; onRestore?; _getLocalBounds?; }) : Function;	
	/** Checks whether subclass is child of superclass or equals to superclass 
	*/
	export function isChildClassOf(subclass : Function, superclass : Function) : boolean;	
	/** Return all super classes 
	*/
	export function getInheritanceChain(constructor : Function) : Function[];	
	/** whether enable accelerometer event 
	*/
	export function setAccelerometerEnabled(isEnable : boolean) : void;	
	/** set accelerometer interval value 
	*/
	export function setAccelerometerInterval(interval : number) : void;	
	/** default gl blend src function. Compatible with premultiplied alpha images. */
	export var BLEND_SRC : number;	
	/** <p>
	    Linear interpolation between 2 numbers, the ratio sets how much it is biased to each end
	</p>
	@param a number A
	@param b number B
	@param r ratio between 0 and 1
	
	@example 
	```js
	----
	lerp
	cc.lerp(2,10,0.5)//returns 6
	cc.lerp(2,10,0.2)//returns 3.6
	
	``` 
	*/
	export function lerp(a : number, b : number, r : number) : void;	
	/** get a random number from 0 to 0xffffff 
	*/
	export function rand() : number;	
	/** returns a random float between -1 and 1 
	*/
	export function randomMinus1To1() : number;	
	/** returns a random float between 0 and 1, use Math.random directly 
	*/
	export function random0To1() : number;	
	/** converts degrees to radians 
	*/
	export function degreesToRadians(angle : number) : number;	
	/** converts radians to degrees 
	*/
	export function radiansToDegrees(angle : number) : number;	
	/** Helpful macro that setups the GL server state, the correct GL program and sets the Model View Projection matrix
	@param node setup node 
	*/
	export function nodeDrawSetup(node : Node) : void;	
	/** <p>
	 Increments the GL Draws counts by one.<br/>
	 The number of calls per frame are displayed on the screen when the CCDirector's stats are enabled.<br/>
	</p> 
	*/
	export function incrementGLDraws(addNumber : number) : void;	
	/** Check webgl error.Error will be shown in console if exists. 
	*/
	export function checkGLErrorDebug() : void;	
	/** !#en Checks whether the object is non-nil and not yet destroyed.
	!#zh 检查该对象是否不为 null 并且尚未销毁。
	
	@example 
	```js
	cc.log(cc.isValid(target));
	``` 
	*/
	export function isValid(value : any) : boolean;	
	/** Specify that the input value must be integer in Inspector.
	Also used to indicates that the elements in array should be type integer. */
	export var Integer : string;	
	/** Indicates that the elements in array should be type double. */
	export var Float : string;	
	/** Indicates that the elements in array should be type boolean. */
	export var Boolean : string;	
	/** Indicates that the elements in array should be type string. */
	export var String : string;	
	/** !#en Deserialize json to cc.Asset
	!#zh 将 JSON 反序列化为对象实例。
	
	当指定了 target 选项时，如果 target 引用的其它 asset 的 uuid 不变，则不会改变 target 对 asset 的引用，
	也不会将 uuid 保存到 result 对象中。
	@param data the serialized cc.Asset json string or json object.
	@param result additional loading result 
	*/
	export function deserialize(data : string|any, result? : Details, options? : any) : any;	
	/** !#en Clones the object original and returns the clone.
	
	See [Clone exists Entity](/en/scripting/create-destroy-entities/#instantiate)
	
	!#zh 复制给定的对象
	
	详细用法可参考[复制已有Entity](/zh/scripting/create-destroy-entities/#instantiate)
	
	Instantiate 时，function 和 dom 等非可序列化对象会直接保留原有引用，Asset 会直接进行浅拷贝，可序列化类型会进行深拷贝。
	<del>对于 Entity / Component 等 Scene Object，如果对方也会被一起 Instantiate，则重定向到新的引用，否则保留为原来的引用。</del>
	@param original An existing object that you want to make a copy of. 
	*/
	export function instantiate(original : any) : any;	
	/** Finds a node by hierarchy path, the path is case-sensitive.
	It will traverse the hierarchy by splitting the path using '/' character.
	This function will still returns the node even if it is inactive.
	It is recommended to not use this function every frame instead cache the result at startup. 
	*/
	export function find(path : string, referenceNode? : Node) : Node;	
	/** !#en
	The convenience method to create a new {{#crossLink "Color/Color:method"}}cc.Color{{/crossLink}}
	Alpha channel is optional. Default value is 255.
	
	!#zh
	通过该方法来创建一个新的 {{#crossLink "Color/Color:method"}}cc.Color{{/crossLink}} 对象。
	Alpha 通道是可选的。默认值是 255。
	
	@example 
	```js
	-----------------------
	// 1. All channels seperately as parameters
	var color1 = new cc.Color(255, 255, 255, 255);
	// 2. Convert a hex string to a color
	var color2 = new cc.Color("#000000");
	// 3. An color object as parameter
	var color3 = new cc.Color({r: 255, g: 255, b: 255, a: 255});
	
	``` 
	*/
	export function color(r? : number, g? : number, b? : number, a? : number) : Color;	
	/** !#en returns true if both ccColor3B are equal. Otherwise it returns false.
	!#zh 判断两个颜色对象的 RGB 部分是否相等，不比较透明度。
	
	@example 
	```js
	cc.log(cc.colorEqual(cc.Color.RED, new cc.Color(255, 0, 0))); // true
	``` 
	*/
	export function colorEqual(color1: (r: number, g: number, b: number, a: number) => void, color2: (r: number, g: number, b: number, a: number) => void) : boolean;	
	/** !#en
	convert a string of color for style to Color.
	e.g. "#ff06ff"  to : cc.color(255,6,255)。
	!#zh 16 进制转换为 Color
	
	@example 
	```js
	cc.hexToColor("#FFFF33"); // Color {r: 255, g: 255, b: 51, a: 255};
	``` 
	*/
	export function hexToColor(hex : string) : Color;	
	/** !#en
	convert Color to a string of color for style.
	e.g.  cc.color(255,6,255)  to : "#ff06ff"
	!#zh Color 转换为 16进制。
	
	@example 
	```js
	var color = new cc.Color(255, 6, 255)
	cc.colorToHex(color); // #ff06ff;
	``` 
	*/
	export function colorToHex(color: (r: number, g: number, b: number, a: number) => void) : string;	
	/** !#en
	Define an enum type. <br/>
	If a enum item has a value of -1, it will be given an Integer number according to it's order in the list.<br/>
	Otherwise it will use the value specified by user who writes the enum definition.
	
	!#zh
	定义一个枚举类型。<br/>
	用户可以把枚举值设为任意的整数，如果设为 -1，系统将会分配为上一个枚举值 + 1。
	@param obj a JavaScript literal object containing enum names and values
	
	@example 
	```js
	var WrapMode = cc.Enum({
	    Repeat: -1,
	    Clamp: -1
	});
	
	// Texture.WrapMode.Repeat == 0
	// Texture.WrapMode.Clamp == 1
	// Texture.WrapMode[0] == "Repeat"
	// Texture.WrapMode[1] == "Clamp"
	
	var FlagType = cc.Enum({
	    Flag1: 1,
	    Flag2: 2,
	    Flag3: 4,
	    Flag4: 8,
	});
	
	var AtlasSizeList = cc.Enum({
	    128: 128,
	    256: 256,
	    512: 512,
	    1024: 1024,
	});
	``` 
	*/
	export function Enum(obj : any) : any;	
	/** !#en Returns opposite of Vec2.
	!#zh 返回相反的向量。
	
	@example 
	```js
	cc.pNeg(cc.v2(10, 10));// Vec2 {x: -10, y: -10};
	``` 
	*/
	export function pNeg(point : Vec2) : Vec2;	
	/** !#en Calculates sum of two points.
	!#zh 返回两个向量的和。
	
	@example 
	```js
	cc.pAdd(cc.v2(1, 1), cc.v2(2, 2));// Vec2 {x: 3, y: 3};
	``` 
	*/
	export function pAdd(v1 : Vec2, v2 : Vec2) : Vec2;	
	/** !#en Calculates difference of two points.
	!#zh 返回两个向量的差。
	
	@example 
	```js
	cc.pSub(cc.v2(20, 20), cc.v2(5, 5)); // Vec2 {x: 15, y: 15};
	``` 
	*/
	export function pSub(v1 : Vec2, v2 : Vec2) : Vec2;	
	/** !#en Returns point multiplied by given factor.
	!#zh 向量缩放。
	
	@example 
	```js
	cc.pMult(cc.v2(5, 5), 4); // Vec2 {x: 20, y: 20};
	``` 
	*/
	export function pMult(point : Vec2, floatVar : number) : Vec2;	
	/** !#en Calculates midpoint between two points.
	!#zh 两个向量之间的中心点。
	
	@example 
	```js
	cc.pMidpoint(cc.v2(10, 10), cc.v2(5, 5)); // Vec2 {x: 7.5, y: 7.5};
	``` 
	*/
	export function pMidpoint(v1 : Vec2, v2 : Vec2) : Vec2;	
	/** !#en Calculates dot product of two points.
	!#zh 两个向量之间进行点乘。
	
	@example 
	```js
	cc.pDot(cc.v2(20, 20), cc.v2(5, 5)); // 200;
	``` 
	*/
	export function pDot(v1 : Vec2, v2 : Vec2) : number;	
	/** !#en Calculates cross product of two points.
	!#zh 两个向量之间进行叉乘。
	
	@example 
	```js
	cc.pCross(cc.v2(20, 20), cc.v2(5, 5)); // 0;
	``` 
	*/
	export function pCross(v1 : Vec2, v2 : Vec2) : number;	
	/** !#en Calculates perpendicular of v, rotated 90 degrees counter-clockwise -- cross(v, perp(v)) greater than 0.
	!#zh 返回逆时针旋转 90 度后的新向量。
	
	@example 
	```js
	cc.pPerp(cc.v2(20, 20)); // Vec2 {x: -20, y: 20};
	``` 
	*/
	export function pPerp(point : Vec2) : Vec2;	
	/** !#en Calculates perpendicular of v, rotated 90 degrees clockwise -- cross(v, rperp(v)) smaller than 0.
	!#zh 将指定向量顺时针旋转 90 度并返回。
	
	@example 
	```js
	cc.pRPerp(cc.v2(20, 20)); // Vec2 {x: 20, y: -20};
	``` 
	*/
	export function pRPerp(point : Vec2) : Vec2;	
	/** !#en Calculates the projection of v1 over v2.
	!#zh 返回 v1 在 v2 上的投影向量。
	
	@example 
	```js
	var v1 = cc.v2(20, 20);
	var v2 = cc.v2(5, 5);
	cc.pProject(v1, v2); // Vec2 {x: 20, y: 20};
	``` 
	*/
	export function pProject(v1 : Vec2, v2 : Vec2) : Vec2;	
	/** !#en Calculates the square length of a cc.Vec2 (not calling sqrt() ).
	!#zh 返回指定向量长度的平方。
	
	@example 
	```js
	cc.pLengthSQ(cc.v2(20, 20)); // 800;
	``` 
	*/
	export function pLengthSQ(v : Vec2) : number;	
	/** !#en Calculates the square distance between two points (not calling sqrt() ).
	!#zh 返回两个点之间距离的平方。
	
	@example 
	```js
	var point1 = cc.v2(20, 20);
	var point2 = cc.v2(5, 5);
	cc.pDistanceSQ(point1, point2); // 450;
	``` 
	*/
	export function pDistanceSQ(point1 : Vec2, point2 : Vec2) : number;	
	/** !#en Calculates distance between point an origin.
	!#zh 返回指定向量的长度.
	
	@example 
	```js
	cc.pLength(cc.v2(20, 20)); // 28.284271247461902;
	``` 
	*/
	export function pLength(v : Vec2) : number;	
	/** !#en Calculates the distance between two points.
	!#zh 返回指定 2 个向量之间的距离。
	
	@example 
	```js
	var v1 = cc.v2(20, 20);
	var v2 = cc.v2(5, 5);
	cc.pDistance(v1, v2); // 21.213203435596427;
	``` 
	*/
	export function pDistance(v1 : Vec2, v2 : Vec2) : number;	
	/** !#en Returns this vector with a magnitude of 1.
	!#zh 返回一个长度为 1 的标准化过后的向量。
	
	@example 
	```js
	cc.pNormalize(cc.v2(20, 20)); // Vec2 {x: 0.7071067811865475, y: 0.7071067811865475};
	``` 
	*/
	export function pNormalize(v : Vec2) : Vec2;	
	/** !#en Converts radians to a normalized vector.
	!#zh 将弧度转换为一个标准化后的向量，返回坐标 x = cos(a) , y = sin(a)。
	
	@example 
	```js
	cc.pForAngle(20); // Vec2 {x: 0.40808206181339196, y: 0.9129452507276277};
	``` 
	*/
	export function pForAngle(a : number) : Vec2;	
	/** !#en Converts a vector to radians.
	!#zh 返回指定向量的弧度。
	
	@example 
	```js
	cc.pToAngle(cc.v2(20, 20)); // 0.7853981633974483;
	``` 
	*/
	export function pToAngle(v : Vec2) : number;	
	/** !#en Clamp a value between from and to.
	!#zh
	限定浮点数的最大最小值。<br/>
	数值大于 max_inclusive 则返回 max_inclusive。<br/>
	数值小于 min_inclusive 则返回 min_inclusive。<br/>
	否则返回自身。
	
	@example 
	```js
	var v1 = cc.clampf(20, 0, 20); // 20;
	var v2 = cc.clampf(-1, 0, 20); //  0;
	var v3 = cc.clampf(10, 0, 20); // 10;
	``` 
	*/
	export function clampf(value : number, min_inclusive : number, max_inclusive : number) : number;	
	/** !#en Clamp a value between 0 and 1.
	!#zh 限定浮点数的取值范围为 0 ~ 1 之间。
	
	@example 
	```js
	var v1 = cc.clampf(20);  // 1;
	var v2 = cc.clampf(-1);  // 0;
	var v3 = cc.clampf(0.5); // 0.5;
	``` 
	*/
	export function clamp01(value : number) : number;	
	/** !#en Clamp a point between from and to.
	!#zh
	返回指定限制区域后的向量。<br/>
	向量大于 max_inclusive 则返回 max_inclusive。<br/>
	向量小于 min_inclusive 则返回 min_inclusive。<br/>
	否则返回自身。
	
	@example 
	```js
	var min_inclusive = cc.v2(0, 0);
	var max_inclusive = cc.v2(20, 20);
	var v1 = cc.pClamp(cc.v2(20, 20), min_inclusive, max_inclusive); // Vec2 {x: 20, y: 20};
	var v2 = cc.pClamp(cc.v2(0, 0), min_inclusive, max_inclusive);   // Vec2 {x: 0, y: 0};
	var v3 = cc.pClamp(cc.v2(10, 10), min_inclusive, max_inclusive); // Vec2 {x: 10, y: 10};
	``` 
	*/
	export function pClamp(p : Vec2, min_inclusive : Vec2, max_inclusive : Vec2) : Vec2;	
	/** !#en Quickly convert cc.Size to a cc.Vec2.
	!#zh 快速转换 cc.Size 为 cc.Vec2。
	
	@example 
	```js
	cc.pFromSize(new cc.size(20, 20)); // Vec2 {x: 20, y: 20};
	``` 
	*/
	export function pFromSize(s : Size) : Vec2;	
	/** !#en
	Run a math operation function on each point component <br />
	Math.abs, Math.fllor, Math.ceil, Math.round.
	!#zh 通过运行指定的数学运算函数来计算指定的向量。
	
	@example 
	```js
	cc.pCompOp(cc.p(-10, -10), Math.abs); // Vec2 {x: 10, y: 10};
	``` 
	*/
	export function pCompOp(p : Vec2, opFunc : Function) : Vec2;	
	/** !#en
	Linear Interpolation between two points a and b.<br />
	alpha == 0 ? a <br />
	alpha == 1 ? b <br />
	otherwise a value between a..b.
	!#zh
	两个点 A 和 B 之间的线性插值。 <br />
	alpha == 0 ? a <br />
	alpha == 1 ? b <br />
	否则这个数值在 a ~ b 之间。
	
	@example 
	```js
	cc.pLerp(cc.v2(20, 20), cc.v2(5, 5), 0.5); // Vec2 {x: 12.5, y: 12.5};
	``` 
	*/
	export function pLerp(a : Vec2, b : Vec2, alpha : number) : Vec2;	
	/** !#en TODO
	!#zh
	近似判断两个点是否相等。<br/>
	判断 2 个向量是否在指定数值的范围之内，如果在则返回 true，反之则返回 false。
	
	@example 
	```js
	var a = cc.v2(20, 20);
	var b = cc.v2(5, 5);
	var b1 = cc.pFuzzyEqual(a, b, 10); // false;
	var b2 = cc.pFuzzyEqual(a, b, 18); // true;
	``` 
	*/
	export function pFuzzyEqual(a : Vec2, b : Vec2, variance : number) : boolean;	
	/** !#en Multiplies a nd b components, a.x*b.x, a.y*b.y.
	!#zh 计算两个向量的每个分量的乘积， a.x * b.x, a.y * b.y。
	
	@example 
	```js
	cc.pCompMult(acc.v2(20, 20), cc.v2(5, 5)); // Vec2 {x: 100, y: 100};
	``` 
	*/
	export function pCompMult(a : Vec2, b : Vec2) : Vec2;	
	/** !#en TODO
	!#zh 返回两个向量之间带正负号的弧度。 
	*/
	export function pAngleSigned(a : Vec2, b : Vec2) : number;	
	/** !#en TODO
	!#zh 获取当前向量与指定向量之间的弧度角。 
	*/
	export function pAngle(a : Vec2, b : Vec2) : number;	
	/** !#en Rotates a point counter clockwise by the angle around a pivot.
	!#zh 返回给定向量围绕指定轴心顺时针旋转一定弧度后的结果。
	@param v v is the point to rotate
	@param pivot pivot is the pivot, naturally
	@param angle angle is the angle of rotation cw in radians 
	*/
	export function pRotateByAngle(v : Vec2, pivot : Vec2, angle : number) : Vec2;	
	/** !#en
	A general line-line intersection test
	indicating successful intersection of a line<br />
	note that to truly test intersection for segments we have to make<br />
	sure that s & t lie within [0..1] and for rays, make sure s & t > 0<br />
	the hit point is        p3 + t * (p4 - p3);<br />
	the hit point also is    p1 + s * (p2 - p1);
	!#zh
	返回 A 为起点 B 为终点线段 1 所在直线和 C 为起点 D 为终点线段 2 所在的直线是否相交，<br />
	如果相交返回 true，反之则为 false，参数 retP 是返回交点在线段 1、线段 2 上的比例。
	@param A A is the startpoint for the first line P1 = (p1 - p2).
	@param B B is the endpoint for the first line P1 = (p1 - p2).
	@param C C is the startpoint for the second line P2 = (p3 - p4).
	@param D D is the endpoint for the second line P2 = (p3 - p4).
	@param retP retP.x is the range for a hitpoint in P1 (pa = p1 + s*(p2 - p1)), <br />
	retP.y is the range for a hitpoint in P3 (pa = p2 + t*(p4 - p3)). 
	*/
	export function pLineIntersect(A : Vec2, B : Vec2, C : Vec2, D : Vec2, retP : Vec2) : boolean;	
	/** !#en ccpSegmentIntersect return YES if Segment A-B intersects with segment C-D.
	!#zh 返回线段 A - B 和线段 C - D 是否相交。 
	*/
	export function pSegmentIntersect(A : Vec2, B : Vec2, C : Vec2, D : Vec2) : boolean;	
	/** !#en ccpIntersectPoint return the intersection point of line A-B, C-D.
	!#zh 返回线段 A - B 和线段 C - D 的交点。 
	*/
	export function pIntersectPoint(A : Vec2, B : Vec2, C : Vec2, D : Vec2) : Vec2;	
	/** !#en check to see if both points are equal.
	!#zh 检查指定的 2 个向量是否相等。
	@param A A ccp a
	@param B B ccp b to be compared 
	*/
	export function pSameAs(A : Vec2, B : Vec2) : boolean;	
	/** !#en sets the position of the point to 0.
	!#zh 设置指定向量归 0。 
	*/
	export function pZeroIn(v : Vec2) : void;	
	/** !#en copies the position of one point to another.
	!#zh 令 v1 向量等同于 v2。 
	*/
	export function pIn(v1 : Vec2, v2 : Vec2) : void;	
	/** !#en multiplies the point with the given factor (inplace).
	!#zh 向量缩放，结果保存到第一个向量。 
	*/
	export function pMultIn(point : Vec2, floatVar : number) : void;	
	/** !#en subtracts one point from another (inplace).
	!#zh 向量减法，结果保存到第一个向量。 
	*/
	export function pSubIn(v1 : Vec2, v2 : Vec2) : void;	
	/** !#en adds one point to another (inplace).
	!#zh 向量加法，结果保存到第一个向量。 
	*/
	export function pAddIn(v1 : Vec2, v2 : Vec2) : void;	
	/** !#en normalizes the point (inplace).
	!#zh 规范化 v 向量，设置 v 向量长度为 1。 
	*/
	export function pNormalizeIn(v : Vec2) : void;	
	/** !#en
	The convenience method to create a new Rect.
	see {{#crossLink "Rect/Rect:method"}}cc.Rect{{/crossLink}}
	!#zh
	该方法用来快速创建一个新的矩形。{{#crossLink "Rect/Rect:method"}}cc.Rect{{/crossLink}}
	
	@example 
	```js
	var a = new cc.rect(0 , 0, 10, 0);
	``` 
	*/
	export function rect(x? : Number[]|number, y? : number, w? : number, h? : number) : Rect;	
	/** !#en Check whether a rect's value equals to another.
	!#zh 判断两个矩形是否相等。
	@param rect1 !#en
	Constructor of cc.Rect class.
	see {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} for convenience method.
	!#zh
	cc.Rect类的构造函数。可以通过 {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} 简便方法进行创建。
	@param rect2 !#en
	Constructor of cc.Rect class.
	see {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} for convenience method.
	!#zh
	cc.Rect类的构造函数。可以通过 {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} 简便方法进行创建。
	
	@example 
	```js
	var a = new cc.rect(0, 0, 10, 10);
	var b = new cc.rect(0, 0, 5, 5);
	cc.rectEqualToRect(a, b); // false;
	var c = new cc.rect(0, 0, 5, 5);
	cc.rectEqualToRect(b, c); // true;
	``` 
	*/
	export function rectEqualToRect(rect1: (x: number, y: number, w: number, h: number) => void, rect2: (x: number, y: number, w: number, h: number) => void) : boolean;	
	/** !#en Check whether the rect1 contains rect2.
	!#zh
	检查 rect1 矩形是否包含 rect2 矩形。 <br/>
	注意：如果要允许 rect1 和 rect2 的边界重合，应该用 cc.rectOverlapsRect
	@param rect1 !#en
	Constructor of cc.Rect class.
	see {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} for convenience method.
	!#zh
	cc.Rect类的构造函数。可以通过 {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} 简便方法进行创建。
	@param rect2 !#en
	Constructor of cc.Rect class.
	see {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} for convenience method.
	!#zh
	cc.Rect类的构造函数。可以通过 {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} 简便方法进行创建。
	
	@example 
	```js
	var a = new cc.rect(0, 0, 20, 20);
	var b = new cc.rect(10, 10, 20, 20);
	cc.rectContainsRect(a, b); // true;
	``` 
	*/
	export function rectContainsRect(rect1: (x: number, y: number, w: number, h: number) => void, rect2: (x: number, y: number, w: number, h: number) => void) : boolean;	
	/** !#en Returns the rightmost x-value of a rect.
	!#zh 返回矩形在 x 轴上的最大值
	@param rect !#en
	Constructor of cc.Rect class.
	see {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} for convenience method.
	!#zh
	cc.Rect类的构造函数。可以通过 {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} 简便方法进行创建。
	
	@example 
	```js
	var a = new cc.rect(10, 0, 20, 20);
	cc.rectGetMaxX(a); // 30;
	``` 
	*/
	export function rectGetMaxX(rect: (x: number, y: number, w: number, h: number) => void) : number;	
	/** !#en Return the midpoint x-value of a rect.
	!#zh 返回矩形在 x 轴上的中点。
	@param rect !#en
	Constructor of cc.Rect class.
	see {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} for convenience method.
	!#zh
	cc.Rect类的构造函数。可以通过 {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} 简便方法进行创建。
	
	@example 
	```js
	var a = new cc.rect(10, 0, 20, 20);
	cc.rectGetMidX(a); // 20;
	``` 
	*/
	export function rectGetMidX(rect: (x: number, y: number, w: number, h: number) => void) : number;	
	/** !#en Returns the leftmost x-value of a rect.
	!#zh 返回矩形在 x 轴上的最小值。
	@param rect !#en
	Constructor of cc.Rect class.
	see {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} for convenience method.
	!#zh
	cc.Rect类的构造函数。可以通过 {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} 简便方法进行创建。
	
	@example 
	```js
	var a = new cc.rect(10, 0, 20, 20);
	cc.rectGetMinX(a); // 10;
	``` 
	*/
	export function rectGetMinX(rect: (x: number, y: number, w: number, h: number) => void) : number;	
	/** !#en Return the topmost y-value of a rect.
	!#zh 返回矩形在 y 轴上的最大值。
	@param rect !#en
	Constructor of cc.Rect class.
	see {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} for convenience method.
	!#zh
	cc.Rect类的构造函数。可以通过 {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} 简便方法进行创建。
	
	@example 
	```js
	var a = new cc.rect(0, 10, 20, 20);
	cc.rectGetMaxY(a); // 30;
	``` 
	*/
	export function rectGetMaxY(rect: (x: number, y: number, w: number, h: number) => void) : number;	
	/** !#en Return the midpoint y-value of `rect'.
	!#zh 返回矩形在 y 轴上的中点。
	@param rect !#en
	Constructor of cc.Rect class.
	see {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} for convenience method.
	!#zh
	cc.Rect类的构造函数。可以通过 {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} 简便方法进行创建。
	
	@example 
	```js
	var a = new cc.rect(0, 10, 20, 20);
	cc.rectGetMidY(a); // 20;
	``` 
	*/
	export function rectGetMidY(rect: (x: number, y: number, w: number, h: number) => void) : number;	
	/** !#en Return the bottommost y-value of a rect.
	!#zh 返回矩形在 y 轴上的最小值。
	@param rect !#en
	Constructor of cc.Rect class.
	see {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} for convenience method.
	!#zh
	cc.Rect类的构造函数。可以通过 {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} 简便方法进行创建。
	
	@example 
	```js
	var a = new cc.rect(0, 10, 20, 20);
	cc.rectGetMinY(a); // 10;
	``` 
	*/
	export function rectGetMinY(rect: (x: number, y: number, w: number, h: number) => void) : number;	
	/** !#en Check whether a rect contains a point.
	!#zh 检查一个矩形是否包含某个坐标点。
	@param rect !#en
	Constructor of cc.Rect class.
	see {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} for convenience method.
	!#zh
	cc.Rect类的构造函数。可以通过 {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} 简便方法进行创建。
	
	@example 
	```js
	var a = new cc.rect(0, 10, 20, 20);
	var b = cc.v2(0, 10, 10, 10);
	cc.rectContainsPoint(a, b); // true;
	``` 
	*/
	export function rectContainsPoint(rect: (x: number, y: number, w: number, h: number) => void, point : Vec2) : boolean;	
	/** !#en Check whether a rect intersect with another.
	!#zh 检查一个矩形是否与另一个相交。
	@param rectA !#en
	Constructor of cc.Rect class.
	see {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} for convenience method.
	!#zh
	cc.Rect类的构造函数。可以通过 {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} 简便方法进行创建。
	@param rectB !#en
	Constructor of cc.Rect class.
	see {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} for convenience method.
	!#zh
	cc.Rect类的构造函数。可以通过 {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} 简便方法进行创建。
	
	@example 
	```js
	var a = new cc.rect(0, 10, 20, 20);
	var b = new cc.rect(0, 10, 10, 10);
	cc.rectIntersectsRect(a, b); // true;
	``` 
	*/
	export function rectIntersectsRect(rectA: (x: number, y: number, w: number, h: number) => void, rectB: (x: number, y: number, w: number, h: number) => void) : boolean;	
	/** !#en Check whether a rect overlaps another.
	!#zh 检查一个矩形是否重叠另一个。
	@param rectA !#en
	Constructor of cc.Rect class.
	see {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} for convenience method.
	!#zh
	cc.Rect类的构造函数。可以通过 {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} 简便方法进行创建。
	@param rectB !#en
	Constructor of cc.Rect class.
	see {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} for convenience method.
	!#zh
	cc.Rect类的构造函数。可以通过 {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} 简便方法进行创建。
	
	@example 
	```js
	var a = new cc.rect(0, 10, 20, 20);
	var b = new cc.rect(0, 10, 10, 10);
	cc.rectOverlapsRect(a, b); // true;
	``` 
	*/
	export function rectOverlapsRect(rectA: (x: number, y: number, w: number, h: number) => void, rectB: (x: number, y: number, w: number, h: number) => void) : boolean;	
	/** !#en Returns the smallest rectangle that contains the two source rectangles.
	!#zh 返回一个包含两个指定矩形的最小矩形。
	@param rectA !#en
	Constructor of cc.Rect class.
	see {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} for convenience method.
	!#zh
	cc.Rect类的构造函数。可以通过 {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} 简便方法进行创建。
	@param rectB !#en
	Constructor of cc.Rect class.
	see {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} for convenience method.
	!#zh
	cc.Rect类的构造函数。可以通过 {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} 简便方法进行创建。
	
	@example 
	```js
	var a = new cc.rect(0, 10, 20, 20);
	var b = new cc.rect(0, 10, 10, 10);
	cc.rectUnion(a, b); // Rect {x: 0, y: 10, width: 20, height: 20};
	``` 
	*/
	export function rectUnion(rectA: (x: number, y: number, w: number, h: number) => void, rectB: (x: number, y: number, w: number, h: number) => void) : Rect;	
	/** !#en Returns the overlapping portion of 2 rectangles.
	!#zh 返回 2 个矩形重叠的部分。
	@param rectA !#en
	Constructor of cc.Rect class.
	see {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} for convenience method.
	!#zh
	cc.Rect类的构造函数。可以通过 {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} 简便方法进行创建。
	@param rectB !#en
	Constructor of cc.Rect class.
	see {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} for convenience method.
	!#zh
	cc.Rect类的构造函数。可以通过 {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} 简便方法进行创建。
	
	@example 
	```js
	var a = new cc.rect(0, 10, 20, 20);
	var b = new cc.rect(0, 10, 10, 10);
	cc.rectIntersection(a, b); // Rect {x: 0, y: 10, width: 10, height: 10};
	``` 
	*/
	export function rectIntersection(rectA: (x: number, y: number, w: number, h: number) => void, rectB: (x: number, y: number, w: number, h: number) => void) : Rect;	
	export function V3F_C4B_T2F_QuadZero() : V3F_C4B_T2F_Quad;	
	/**  
	*/
	export function V3F_C4B_T2F_QuadCopy(sourceQuad: (tl: V3F_C4B_T2F, bl: V3F_C4B_T2F, tr: V3F_C4B_T2F, br: V3F_C4B_T2F, arrayBuffer: any[], offset: number) => void) : V3F_C4B_T2F_Quad;	
	/**  
	*/
	export function V3F_C4B_T2F_QuadsCopy(sourceQuads : any[]) : any[];	
	/** !#en The convenience method to create a new {{#crossLink "Vec2"}}cc.Vec2{{/crossLink}}.
	!#zh 通过该简便的函数进行创建 {{#crossLink "Vec2"}}cc.Vec2{{/crossLink}} 对象。
	
	@example 
	```js
	var v1 = cc.v2();
	var v2 = cc.v2(0, 0);
	var v3 = cc.v2(v2);
	var v4 = cc.v2({x: 100, y: 100});
	``` 
	*/
	export function v2(x? : number|any, y? : number) : Vec2;	
	/** !#en The convenience method to creates a new {{#crossLink "Vec2"}}cc.Vec2{{/crossLink}}.
	!#zh 通过该简便的函数进行创建 {{#crossLink "Vec2"}}cc.Vec2{{/crossLink}} 对象。
	@param x a Number or a size object
	
	@example 
	```js
	var point1 = cc.p();
	var point2 = cc.p(100, 100);
	var point3 = cc.p(point2);
	var point4 = cc.p({x: 100, y: 100});
	``` 
	*/
	export function p(x? : number|any, y? : number) : Vec2;	
	/** !#en Check whether a point's value equals to another.
	!#zh 判断两个向量是否相等。
	@param point1 !#en
	Constructor
	see {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} or {{#crossLink "cc/p:method"}}cc.p{{/crossLink}}
	!#zh
	构造函数，可查看 {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} 或者 {{#crossLink "cc/p:method"}}cc.p{{/crossLink}}
	@param point2 !#en
	Constructor
	see {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} or {{#crossLink "cc/p:method"}}cc.p{{/crossLink}}
	!#zh
	构造函数，可查看 {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} 或者 {{#crossLink "cc/p:method"}}cc.p{{/crossLink}} 
	*/
	export function pointEqualToPoint(point1: (x: number, y: number) => void, point2: (x: number, y: number) => void) : boolean;	
	/** !#en Enum for debug modes.
	!#zh 调试模式 */
	export enum DebugMode {		
		NONE = 0,
		INFO = 0,
		WARN = 0,
		ERROR = 0,
		INFO_FOR_WEB_PAGE = 0,
		WARN_FOR_WEB_PAGE = 0,
		ERROR_FOR_WEB_PAGE = 0,	
	}		
		/** !#en Class for animation data handling.
		!#zh 动画剪辑，用于存储动画数据。 */
		export class AnimationClip extends Asset {		
		/** !#en Duration of this animation.
		!#zh 动画的持续时间。 */
		duration : number;		
		/** !#en FrameRate of this animation.
		!#zh 动画的帧速率。 */
		sample : number;		
		/** !#en Speed of this animation.
		!#zh 动画的播放速度。 */
		speed : number;		
		/** !#en WrapMode of this animation.
		!#zh 动画的循环模式。 */
		wrapMode : WrapMode;		
		/** !#en Curve data.
		!#zh 曲线数据。 */
		curveData : any;		
		/** !#en Event data.
		!#zh 事件数据。 */
		events : any[];		
		/** !#en Crate clip with a set of sprite frames
		!#zh 使用一组序列帧图片来创建动画剪辑
		
		@example 
		```js
		var clip = cc.AnimationClip.createWithSpriteFrames(spriteFrames, 10);
		``` 
		*/
		createWithSpriteFrames(spriteFrames : [SpriteFrame], sample : number) : AnimationClip;	
	}		
		/** !#en
		The AnimationState gives full control over animation playback process.
		In most cases the Animation Component is sufficient and easier to use. Use the AnimationState if you need full control.
		!#zh
		AnimationState 完全控制动画播放过程。<br/>
		大多数情况下 动画组件 是足够和易于使用的。如果您需要更多的动画控制接口，请使用 AnimationState。 */
		export class AnimationState extends AnimationNode {		
		/**  
		*/
		AnimationState(clip : AnimationClip, name? : string) : AnimationState;		
		/** !#en The clip that is being played by this animation state.
		!#zh 此动画状态正在播放的剪辑。 */
		clip : AnimationClip;		
		/** !#en The name of the playing animation.
		!#zh 动画的名字 */
		name : string;	
	}		
		/** undefined */
		export class Playable {		
		/** !#en Is playing or paused in play mode?
		!#zh 当前是否正在播放。 */
		isPlaying : boolean;		
		/** !#en Is currently paused? This can be true even if in edit mode(isPlaying == false).
		!#zh 当前是否正在暂停 */
		isPaused : boolean;		
		/** !#en Play this animation.
		!#zh 播放动画。 
		*/
		play() : void;		
		/** !#en Stop this animation.
		!#zh 停止动画播放。 
		*/
		stop() : void;		
		/** !#en Pause this animation.
		!#zh 暂停动画。 
		*/
		pause() : void;		
		/** !#en Resume this animation.
		!#zh 重新播放动画。 
		*/
		resume() : void;		
		/** !#en Perform a single frame step.
		!#zh 执行一帧动画。 
		*/
		step() : void;	
	}	
	/** !#en Specifies how time is treated when it is outside of the keyframe range of an Animation.
	!#zh 动画使用的循环模式。 */
	export enum WrapMode {		
		Default = 0,
		Normal = 0,
		Reverse = 0,
		Loop = 0,
		LoopReverse = 0,
		PingPong = 0,
		PingPongReverse = 0,	
	}		
		/** !#en The abstract interface for all playing animation.
		!#zh 所有播放动画的抽象接口。 */
		export class AnimationNodeBase extends Playable {	
	}		
		/** !#en The collection and instance of playing animations.
		!#zh 动画曲线的集合，根据当前时间计算出每条曲线的状态。 */
		export class AnimationNode extends AnimationNodeBase {		
		/** !#en The curves list.
		!#zh 曲线列表。 */
		curves : AnimCurve[];		
		/** !#en The start delay which represents the number of seconds from an animation's start time to the start of
		the active interval.
		!#zh 延迟多少秒播放。 */
		delay : number;		
		/** !#en The animation's iteration count property.
		
		A real number greater than or equal to zero (including positive infinity) representing the number of times
		to repeat the animation node.
		
		Values less than zero and NaN values are treated as the value 1.0 for the purpose of timing model
		calculations.
		
		!#zh 迭代次数，指动画播放多少次后结束, normalize time。 如 2.5（2次半） */
		repeatCount : number;		
		/** !#en The iteration duration of this animation in seconds. (length)
		!#zh 单次动画的持续时间，秒。 */
		duration : number;		
		/** !#en The animation's playback speed. 1 is normal playback speed.
		!#zh 播放速率。 */
		speed : number;		
		/** !#en
		Wrapping mode of the playing animation.
		Notice : dynamic change wrapMode will reset time and repeatCount property
		!#zh
		动画循环方式。
		需要注意的是，动态修改 wrapMode 时，会重置 time 以及 repeatCount */
		wrapMode : WrapMode;		
		/** !#en The current time of this animation in seconds.
		!#zh 动画当前的时间，秒。 */
		time : number;	
	}		
		/** !#en Base class cc.Action for action classes.
		!#zh Action 类是所有动作类型的基类。 */
		export class Action {		
		/** !#en
		to copy object with deep copy.
		returns a clone of action.
		!#zh 返回一个克隆的动作。 
		*/
		clone() : Action;		
		/** !#en
		return true if the action has finished.
		!#zh 如果动作已完成就返回 true。 
		*/
		isDone() : boolean;		
		/** !#en get the target.
		!#zh 获取当前目标节点。 
		*/
		getTarget() : Node;		
		/** !#en The action will modify the target properties.
		!#zh 设置目标节点。 
		*/
		setTarget(target : Node) : void;		
		/** !#en get the original target.
		!#zh 获取原始目标节点。 
		*/
		getOriginalTarget() : Node;		
		/** !#en get tag number.
		!#zh 获取用于识别动作的标签。 
		*/
		getTag() : number;		
		/** !#en set tag number.
		!#zh 设置标签，用于识别动作。 
		*/
		setTag(tag : number) : void;		
		/** !#en Default Action tag.
		!#zh 默认动作标签。 */
		TAG_INVALID : number;	
	}		
		/** !#en
		Base class actions that do have a finite time duration. <br/>
		Possible actions: <br/>
		- An action with a duration of 0 seconds. <br/>
		- An action with a duration of 35.5 seconds.
		
		Infinite time actions are valid
		!#zh 有限时间动作，这种动作拥有时长 duration 属性。 */
		export class FiniteTimeAction extends Action {		
		/** !#en get duration of the action. (seconds).
		!#zh 获取动作以秒为单位的持续时间。 
		*/
		getDuration() : number;		
		/** !#en set duration of the action. (seconds).
		!#zh 设置动作以秒为单位的持续时间。 
		*/
		setDuration(duration : number) : void;		
		/** !#en
		Returns a reversed action. <br />
		For example: <br />
		- The action will be x coordinates of 0 move to 100. <br />
		- The reversed action will be x of 100 move to 0.
		- Will be rewritten
		!#zh 返回一个新的动作，执行与原动作完全相反的动作。 
		*/
		reverse() : void;		
		/** !#en
		to copy object with deep copy.
		returns a clone of action.
		!#zh 返回一个克隆的动作。 
		*/
		clone() : FiniteTimeAction;	
	}		
		/** !#en Base class for Easing actions.
		!#zh 所有缓动动作基类，用于修饰 ActionInterval。 */
		export class ActionEase extends ActionInterval {	
	}		
		/** !#en Base class for Easing actions with rate parameters
		!#zh 拥有速率属性的缓动动作基类。 */
		export class EaseRateAction extends ActionEase {	
	}		
		/** !#en Ease Elastic abstract class.
		!#zh 弹性缓动动作基类。 */
		export class EaseElastic extends ActionEase {	
	}		
		/** !#en cc.EaseBounce abstract class.
		!#zh 反弹缓动动作基类。 */
		export class EaseBounce extends ActionEase {	
	}		
		/** !#en Instant actions are immediate actions. They don't have a duration like the ActionInterval actions.
		!#zh 即时动作，这种动作立即就会执行，继承自 FiniteTimeAction。 */
		export class ActionInstant extends FiniteTimeAction {	
	}		
		/** !#en
		<p> An interval action is an action that takes place within a certain period of time. <br/>
		It has an start time, and a finish time. The finish time is the parameter<br/>
		duration plus the start time.</p>
		
		<p>These CCActionInterval actions have some interesting properties, like:<br/>
		- They can run normally (default)  <br/>
		- They can run reversed with the reverse method   <br/>
		- They can run with the time altered with the Accelerate, AccelDeccel and Speed actions. </p>
		
		<p>For example, you can simulate a Ping Pong effect running the action normally and<br/>
		then running it again in Reverse mode. </p>
		!#zh 时间间隔动作，这种动作在已定时间内完成，继承 FiniteTimeAction。 */
		export class ActionInterval extends FiniteTimeAction {		
		/** !#en Implementation of ease motion.
		!#zh 缓动运动。
		
		@example 
		
		action.easing(cc.easeIn(3.0));,```js
		action.easing(cc.easeIn(3.0));
		``` 
		*/
		easing(easeObj : any) : ActionInterval;		
		/** !#en
		Repeats an action a number of times.
		To repeat an action forever use the CCRepeatForever action.
		!#zh 重复动作可以按一定次数重复一个动作，使用 RepeatForever 动作来永远重复一个动作。 
		*/
		repeat(times : void) : ActionInterval;		
		/** !#en
		Repeats an action for ever.  <br/>
		To repeat the an action for a limited number of times use the Repeat action. <br/>
		!#zh 永远地重复一个动作，有限次数内重复一个动作请使用 Repeat 动作。 
		*/
		repeatForever() : ActionInterval;	
	}		
		/** !#en
		cc.MotionStreak manages a Ribbon based on it's motion in absolute space.                 <br/>
		You construct it with a fadeTime, minimum segment size, texture path, texture            <br/>
		length and color. The fadeTime controls how long it takes each vertex in                 <br/>
		the streak to fade out, the minimum segment size it how many pixels the                  <br/>
		streak will move before adding a new ribbon segment, and the texture                     <br/>
		length is the how many pixels the texture is stretched across. The texture               <br/>
		is vertically aligned along the streak segment.
		!#zh 运动轨迹，用于游戏对象的运动轨迹上实现拖尾渐隐效果。 */
		export class MotionStreak extends Component {		
		/** !#en
		!#zh 在编辑器模式下预览拖尾效果。 */
		preview : boolean;		
		/** !#en The fade time to fade.
		!#zh 拖尾的渐隐时间，以秒为单位。 */
		fadeTime : number;		
		/** !#en The minimum segment size.
		!#zh 拖尾之间最小距离。 */
		minSeg : number;		
		/** !#en The stroke's width.
		!#zh 拖尾的宽度。 */
		stroke : number;		
		/** !#en The texture of the MotionStreak.
		!#zh 拖尾的贴图。 */
		texture : Texture2D;		
		/** !#en The color of the MotionStreak.
		!#zh 拖尾的颜色 */
		color : Color;		
		/** !#en The fast Mode.
		!#zh 是否启用了快速模式。当启用快速模式，新的点会被更快地添加，但精度较低。 */
		fastMode : boolean;		
		/** !#en Remove all living segments of the ribbon.
		!#zh 删除当前所有的拖尾片段。
		
		@example 
		```js
		// stop particle system.
		myParticleSystem.stopSystem();
		``` 
		*/
		reset() : void;	
	}		
		/** !#en cc.audioEngine is the singleton object, it provide simple audio APIs.
		!#zh
		cc.audioengine是单例对象。<br/>
		主要用来播放音频，播放的时候会返回一个 audioID，之后都可以通过这个 audioID 来操作这个音频对象。<br/>
		不使用的时候，请使用 cc.audioEngine.uncache(filePath); 进行资源释放 <br/>
		注意：<br/>
		在 Android 系统浏览器上，不同浏览器，不同版本的效果不尽相同。<br/>
		比如说：大多数浏览器都需要用户物理交互才可以开始播放音效，有一些不支持 WebAudio，<br/>
		有一些不支持多音轨播放。总之如果对音乐依赖比较强，请做尽可能多的测试。 */
		export class audioEngine {		
		/** !#en Play audio.
		!#zh 播放音频
		@param filePath The path of the audio file without filename extension.
		@param loop Whether the music loop or not.
		@param volume Volume size.
		
		@example 
		```js
		//example
		var audioID = cc.audioEngine.play(path, false, 0.5);
		``` 
		*/
		play(filePath : string, loop : boolean, volume : number) : number;		
		/** !#en Set audio loop.
		!#zh 设置音频是否循环。
		@param audioID audio id.
		@param loop Whether cycle.
		
		@example 
		```js
		//example
		cc.audioEngine.setLoop(id, true);
		``` 
		*/
		setLoop(audioID : number, loop : boolean) : void;		
		/** !#en Get audio cycle state.
		!#zh 获取音频的循环状态。
		@param audioID audio id.
		
		@example 
		```js
		//example
		cc.audioEngine.isLoop(id);
		``` 
		*/
		isLoop(audioID : number) : boolean;		
		/** !#en Set the volume of audio.
		!#zh 设置音量（0.0 ~ 1.0）。
		@param audioID audio id.
		@param volume Volume must be in 0.0~1.0 .
		
		@example 
		```js
		//example
		cc.audioEngine.setVolume(id, 0.5);
		``` 
		*/
		setVolume(audioID : number, volume : number) : void;		
		/** !#en The volume of the music max value is 1.0,the min value is 0.0 .
		!#zh 获取音量（0.0 ~ 1.0）。
		@param audioID audio id.
		
		@example 
		```js
		//example
		var volume = cc.audioEngine.getVolume(id);
		``` 
		*/
		getVolume(audioID : number) : boolean;		
		/** !#en Set current time
		!#zh 设置当前的音频时间。
		@param audioID audio id.
		@param sec current time.
		
		@example 
		```js
		//example
		cc.audioEngine.setCurrentTime(id, 2);
		``` 
		*/
		setCurrentTime(audioID : number, sec : number) : boolean;		
		/** !#en Get current time
		!#zh 获取当前的音频播放时间。
		@param audioID audio id.
		
		@example 
		```js
		//example
		var time = cc.audioEngine.getCurrentTime(id);
		``` 
		*/
		getCurrentTime(audioID : number) : number;		
		/** !#en Get audio duration
		!#zh 获取音频总时长。
		@param audioID audio id.
		
		@example 
		```js
		//example
		var time = cc.audioEngine.getDuration(id);
		``` 
		*/
		getDuration(audioID : number) : number;		
		/** !#en Get audio state
		!#zh 获取音频状态。
		@param audioID audio id.
		
		@example 
		```js
		//example
		var state = cc.audioEngine.getState(id);
		``` 
		*/
		getState(audioID : number) : audioEngine.AudioState;		
		/** !#en Set Audio finish callback
		!#zh 设置一个音频结束后的回调
		@param audioID audio id.
		@param callback loaded callback.
		
		@example 
		```js
		//example
		cc.audioEngine.setFinishCallback(id, function () {});
		``` 
		*/
		setFinishCallback(audioID : number, callback : Function) : void;		
		/** !#en Pause playing audio.
		!#zh 暂停正在播放音频。
		@param audioID The return value of function play.
		
		@example 
		```js
		//example
		cc.audioEngine.pause(audioID);
		``` 
		*/
		pause(audioID : number) : void;		
		/** !#en Pause all playing audio
		!#zh 暂停现在正在播放的所有音频。
		
		@example 
		```js
		//example
		cc.audioEngine.pauseAll();
		``` 
		*/
		pauseAll() : void;		
		/** !#en Resume playing audio.
		!#zh 恢复播放指定的音频。
		@param audioID The return value of function play.
		//example
		cc.audioEngine.resume(audioID); 
		*/
		resume(audioID : number) : void;		
		/** !#en Resume all playing audio.
		!#zh 恢复播放所有之前暂停的所有音频。
		
		@example 
		```js
		//example
		cc.audioEngine.resumeAll();
		``` 
		*/
		resumeAll() : void;		
		/** !#en Stop playing audio.
		!#zh 停止播放指定音频。
		@param audioID The return value of function play.
		
		@example 
		```js
		//example
		cc.audioEngine.stop(audioID);
		``` 
		*/
		stop(audioID : number) : void;		
		/** !#en Stop all playing audio.
		!#zh 停止正在播放的所有音频。
		
		@example 
		```js
		//example
		cc.audioEngine.stopAll();
		``` 
		*/
		stopAll() : void;		
		/** !#en Set up an audio can generate a few examples.
		!#zh 设置一个音频可以设置几个实例
		@param num a number of instances to be created from within an audio
		
		@example 
		```js
		//example
		cc.audioEngine.setMaxAudioInstance(20);
		``` 
		*/
		setMaxAudioInstance(num : number) : void;		
		/** !#en Getting audio can produce several examples.
		!#zh 获取一个音频可以设置几个实例
		
		@example 
		```js
		//example
		cc.audioEngine.getMaxAudioInstance();
		``` 
		*/
		getMaxAudioInstance() : number;		
		/** !#en Unload the preloaded audio from internal buffer.
		!#zh 卸载预加载的音频。
		
		@example 
		```js
		//example
		cc.audioEngine.uncache(filePath);
		``` 
		*/
		uncache(filePath : string) : void;		
		/** !#en Unload all audio from internal buffer.
		!#zh 卸载所有音频。
		
		@example 
		```js
		//example
		cc.audioEngine.uncacheAll();
		``` 
		*/
		uncacheAll() : void;		
		/** !#en Preload audio file.
		!#zh 预加载一个音频
		@param filePath The file path of an audio.
		@param callback The callback of an audio.
		
		@example 
		```js
		//example
		cc.audioEngine.preload(path);
		``` 
		*/
		preload(filePath : void, callback : void) : void;		
		/** !#en Set a size, the unit is KB，Over this size is directly resolved into DOM nodes
		!#zh 设置一个以kb为单位的尺寸，大于这个尺寸的音频在加载的时候会强制使用 dom 方式加载
		@param kb The file path of an audio.
		
		@example 
		```js
		//example
		cc.audioEngine.setMaxWebAudioSize(300);
		``` 
		*/
		setMaxWebAudioSize(kb : void) : void;	
	}		
		/** Particle System base class. <br/>
		Attributes of a Particle System:<br/>
		 - emmision rate of the particles<br/>
		 - Gravity Mode (Mode A): <br/>
		 - gravity <br/>
		 - direction <br/>
		 - speed +-  variance <br/>
		 - tangential acceleration +- variance<br/>
		 - radial acceleration +- variance<br/>
		 - Radius Mode (Mode B):      <br/>
		 - startRadius +- variance    <br/>
		 - endRadius +- variance      <br/>
		 - rotate +- variance         <br/>
		 - Properties common to all modes: <br/>
		 - life +- life variance      <br/>
		 - start spin +- variance     <br/>
		 - end spin +- variance       <br/>
		 - start size +- variance     <br/>
		 - end size +- variance       <br/>
		 - start color +- variance    <br/>
		 - end color +- variance      <br/>
		 - life +- variance           <br/>
		 - blending function          <br/>
		 - texture                    <br/>
		<br/>
		cocos2d also supports particles generated by Particle Designer (http://particledesigner.71squared.com/).<br/>
		'Radius Mode' in Particle Designer uses a fixed emit rate of 30 hz. Since that can't be guarateed in cocos2d,  <br/>
		cocos2d uses a another approach, but the results are almost identical.<br/>
		cocos2d supports all the variables used by Particle Designer plus a bit more:  <br/>
		 - spinning particles (supported when using ParticleSystem)       <br/>
		 - tangential acceleration (Gravity mode)                               <br/>
		 - radial acceleration (Gravity mode)                                   <br/>
		 - radius direction (Radius mode) (Particle Designer supports outwards to inwards direction only) <br/>
		It is possible to customize any of the above mentioned properties in runtime. Example:   <br/> */
		export class ParticleSystem extends _RendererUnderSG {		
		/** !#en Play particle in edit mode.
		!#zh 在编辑器模式下预览粒子，启用后选中粒子时，粒子将自动播放。 */
		preview : boolean;		
		/** !#en
		If set custom to true, then use custom properties insteadof read particle file.
		!#zh 是否自定义粒子属性。 */
		custom : boolean;		
		/** !#en The plist file.
		!#zh plist 格式的粒子配置文件。 */
		file : string;		
		/** . */
		texture : Texture2D;		
		/** !#en Current quantity of particles that are being simulated.
		!#zh 当前播放的粒子数量。 */
		particleCount : number;		
		/** !#en Specify the source Blend Factor.
		!#zh 指定原图混合模式。 */
		srcBlendFactor : BlendFactor;		
		/** !#en Specify the destination Blend Factor.
		!#zh 指定目标的混合模式。 */
		dstBlendFactor : BlendFactor;		
		/** !#en If set to true, the particle system will automatically start playing on onLoad.
		!#zh 如果设置为 true 运行时会自动发射粒子。 */
		playOnLoad : boolean;		
		/** !#en Indicate whether the owner node will be auto-removed when it has no particles left.
		!#zh 粒子播放完毕后自动销毁所在的节点。 */
		autoRemoveOnFinish : boolean;		
		/** !#en Indicate whether the particle system is activated.
		!#zh 是否激活粒子。 */
		active : boolean;		
		/** !#en Maximum particles of the system.
		!#zh 粒子最大数量。 */
		totalParticles : number;		
		/** !#en How many seconds the emitter wil run. -1 means 'forever'.
		!#zh 发射器生存时间，单位秒，-1表示持续发射。 */
		duration : number;		
		/** !#en Emission rate of the particles.
		!#zh 每秒发射的粒子数目。 */
		emissionRate : number;		
		/** !#en Life of each particle setter.
		!#zh 粒子的运行时间。 */
		life : number;		
		/** !#en Variation of life.
		!#zh 粒子的运行时间变化范围。 */
		lifeVar : number;		
		/** !#en Start color of each particle.
		!#zh 粒子初始颜色。 */
		startColor : Color;		
		/** !#en Variation of the start color.
		!#zh 粒子初始颜色变化范围。 */
		startColorVar : Color;		
		/** !#en Ending color of each particle.
		!#zh 粒子结束颜色。 */
		endColor : Color;		
		/** !#en Variation of the end color.
		!#zh 粒子结束颜色变化范围。 */
		endColorVar : Color;		
		/** !#en Angle of each particle setter.
		!#zh 粒子角度。 */
		angle : number;		
		/** !#en Variation of angle of each particle setter.
		!#zh 粒子角度变化范围。 */
		angleVar : number;		
		/** !#en Start size in pixels of each particle.
		!#zh 粒子的初始大小。 */
		startSize : number;		
		/** !#en Variation of start size in pixels.
		!#zh 粒子初始大小的变化范围。 */
		startSizeVar : number;		
		/** !#en End size in pixels of each particle.
		!#zh 粒子结束时的大小。 */
		endSize : number;		
		/** !#en Variation of end size in pixels.
		!#zh 粒子结束大小的变化范围。 */
		endSizeVar : number;		
		/** !#en Start angle of each particle.
		!#zh 粒子开始自旋角度。 */
		startSpin : number;		
		/** !#en Variation of start angle.
		!#zh 粒子开始自旋角度变化范围。 */
		startSpinVar : number;		
		/** !#en End angle of each particle.
		!#zh 粒子结束自旋角度。 */
		endSpin : number;		
		/** !#en Variation of end angle.
		!#zh 粒子结束自旋角度变化范围。 */
		endSpinVar : number;		
		/** !#en Source position of the emitter.
		!#zh 发射器位置。 */
		sourcePos : Vec2;		
		/** !#en Variation of source position.
		!#zh 发射器位置的变化范围。（横向和纵向） */
		posVar : Vec2;		
		/** !#en Particles movement type.
		!#zh 粒子位置类型。 */
		positionType : ParticleSystem.PositionType;		
		/** !#en Particles emitter modes.
		!#zh 发射器类型。 */
		emitterMode : ParticleSystem.EmitterMode;		
		/** !#en Gravity of the emitter.
		!#zh 重力。 */
		gravity : Vec2;		
		/** !#en Speed of the emitter.
		!#zh 速度。 */
		speed : number;		
		/** !#en Variation of the speed.
		!#zh 速度变化范围。 */
		speedVar : number;		
		/** !#en Tangential acceleration of each particle. Only available in 'Gravity' mode.
		!#zh 每个粒子的切向加速度，即垂直于重力方向的加速度，只有在重力模式下可用。 */
		tangentialAccel : number;		
		/** !#en Variation of the tangential acceleration.
		!#zh 每个粒子的切向加速度变化范围。 */
		tangentialAccelVar : number;		
		/** !#en Acceleration of each particle. Only available in 'Gravity' mode.
		!#zh 粒子径向加速度，即平行于重力方向的加速度，只有在重力模式下可用。 */
		radialAccel : number;		
		/** !#en Variation of the radial acceleration.
		!#zh 粒子径向加速度变化范围。 */
		radialAccelVar : number;		
		/** !#en Indicate whether the rotation of each particle equals to its direction. Only available in 'Gravity' mode.
		!#zh 每个粒子的旋转是否等于其方向，只有在重力模式下可用。 */
		rotationIsDir : boolean;		
		/** !#en Starting radius of the particles. Only available in 'Radius' mode.
		!#zh 初始半径，表示粒子出生时相对发射器的距离，只有在半径模式下可用。 */
		startRadius : number;		
		/** !#en Variation of the starting radius.
		!#zh 初始半径变化范围。 */
		startRadiusVar : number;		
		/** !#en Ending radius of the particles. Only available in 'Radius' mode.
		!#zh 结束半径，只有在半径模式下可用。 */
		endRadius : number;		
		/** !#en Variation of the ending radius.
		!#zh 结束半径变化范围。 */
		endRadiusVar : number;		
		/** !#en Number of degress to rotate a particle around the source pos per second. Only available in 'Radius' mode.
		!#zh 粒子每秒围绕起始点的旋转角度，只有在半径模式下可用。 */
		rotatePerS : number;		
		/** !#en Variation of the degress to rotate a particle around the source pos per second.
		!#zh 粒子每秒围绕起始点的旋转角度变化范围。 */
		rotatePerSVar : number;		
		/** !#en The Particle emitter lives forever.
		!#zh 表示发射器永久存在 */
		DURATION_INFINITY : number;		
		/** !#en The starting size of the particle is equal to the ending size.
		!#zh 表示粒子的起始大小等于结束大小。 */
		START_SIZE_EQUAL_TO_END_SIZE : number;		
		/** !#en The starting radius of the particle is equal to the ending radius.
		!#zh 表示粒子的起始半径等于结束半径。 */
		START_RADIUS_EQUAL_TO_END_RADIUS : number;		
		/** !#en Add a particle to the emitter.
		!#zh 添加一个粒子到发射器中。 
		*/
		addParticle() : boolean;		
		/** !#en Stop emitting particles. Running particles will continue to run until they die.
		!#zh 停止发射器发射粒子，发射出去的粒子将继续运行，直至粒子生命结束。
		
		@example 
		```js
		// stop particle system.
		myParticleSystem.stopSystem();
		``` 
		*/
		stopSystem() : void;		
		/** !#en Kill all living particles.
		!#zh 杀死所有存在的粒子，然后重新启动粒子发射器。
		
		@example 
		```js
		// play particle system.
		myParticleSystem.resetSystem();
		``` 
		*/
		resetSystem() : void;		
		/** !#en Whether or not the system is full.
		!#zh 发射器中粒子是否大于等于设置的总粒子数量。 
		*/
		isFull() : boolean;		
		/** !#en
		<p> Sets a new CCSpriteFrame as particle.</br>
		WARNING: this method is experimental. Use setTextureWithRect instead.
		</p>
		!#zh
		<p> 设置一个新的精灵帧为粒子。</br>
		警告：这个函数只是试验，请使用 setTextureWithRect 实现。
		</p> 
		*/
		setDisplayFrame(spriteFrame : SpriteFrame) : void;		
		/** !#en Sets a new texture with a rect. The rect is in texture position and size.
		!#zh 设置一张新贴图和关联的矩形。 
		*/
		setTextureWithRect(texture : Texture2D, rect : Rect) : void;	
	}		
		/** !#en
		cc.ActionManager is a class that can manage actions.<br/>
		Normally you won't need to use this class directly. 99% of the cases you will use the CCNode interface,
		which uses this class's singleton object.
		But there are some cases where you might need to use this class. <br/>
		Examples:<br/>
		- When you want to run an action where the target is different from a CCNode.<br/>
		- When you want to pause / resume the actions<br/>
		!#zh
		cc.ActionManager 是可以管理动作的单例类。<br/>
		通常你并不需要直接使用这个类，99%的情况您将使用 CCNode 的接口。<br/>
		但也有一些情况下，您可能需要使用这个类。 <br/>
		例如：
		 - 当你想要运行一个动作，但目标不是 CCNode 类型时。 <br/>
		 - 当你想要暂停/恢复动作时。 <br/> */
		export class ActionManager {		
		/** !#en
		Adds an action with a target.<br/>
		If the target is already present, then the action will be added to the existing target.
		If the target is not present, a new instance of this target will be created either paused or not, and the action will be added to the newly created target.
		When the target is paused, the queued actions won't be 'ticked'.
		!#zh
		增加一个动作，同时还需要提供动作的目标对象，目标对象是否暂停作为参数。<br/>
		如果目标已存在，动作将会被直接添加到现有的节点中。<br/>
		如果目标不存在，将为这一目标创建一个新的实例，并将动作添加进去。<br/>
		当目标状态的 paused 为 true，动作将不会被执行 
		*/
		addAction(action : Action, target : Node, paused : boolean) : void;		
		/** !#en Removes all actions from all the targets.
		!#zh 移除所有对象的所有动作。 
		*/
		removeAllActions() : void;		
		/** !#en
		Removes all actions from a certain target. <br/>
		All the actions that belongs to the target will be removed.
		!#zh
		移除指定对象上的所有动作。<br/>
		属于该目标的所有的动作将被删除。 
		*/
		removeAllActionsFromTarget(target : any, forceDelete : boolean) : void;		
		/** !#en Removes an action given an action reference.
		!#zh 移除指定的动作。 
		*/
		removeAction(action : Action) : void;		
		/** !#en Removes an action given its tag and the target.
		!#zh 删除指定对象下特定标签的一个动作，将删除首个匹配到的动作。 
		*/
		removeActionByTag(tag : number, target : any) : void;		
		/** !#en Gets an action given its tag an a target.
		!#zh 通过目标对象和标签获取一个动作。 
		*/
		getActionByTag(tag : number, target : any) : Action;		
		/** !#en
		Returns the numbers of actions that are running in a certain target. <br/>
		Composable actions are counted as 1 action. <br/>
		Example: <br/>
		- If you are running 1 Sequence of 7 actions, it will return 1. <br/>
		- If you are running 7 Sequences of 2 actions, it will return 7.
		!#zh
		返回指定对象下所有正在运行的动作数量。 <br/>
		组合动作被算作一个动作。<br/>
		例如：<br/>
		 - 如果您正在运行 7 个动作组成的序列动作（Sequence），这个函数将返回 1。<br/>
		 - 如果你正在运行 2 个序列动作（Sequence）和 5 个普通动作，这个函数将返回 7。<br/> 
		*/
		getNumberOfRunningActionsInTarget(target : any) : number;		
		/** !#en Pauses the target: all running actions and newly added actions will be paused.
		!#zh 暂停指定对象：所有正在运行的动作和新添加的动作都将会暂停。 
		*/
		pauseTarget(target : any) : void;		
		/** !#en Resumes the target. All queued actions will be resumed.
		!#zh 让指定目标恢复运行。在执行序列中所有被暂停的动作将重新恢复运行。 
		*/
		resumeTarget(target : any) : void;		
		/** !#en Pauses all running actions, returning a list of targets whose actions were paused.
		!#zh 暂停所有正在运行的动作，返回一个包含了那些动作被暂停了的目标对象的列表。 
		*/
		pauseAllRunningActions() : any[];		
		/** !#en Resume a set of targets (convenience function to reverse a pauseAllRunningActions or pauseTargets call).
		!#zh 让一组指定对象恢复运行（用来逆转 pauseAllRunningActions 效果的便捷函数）。 
		*/
		resumeTargets(targetsToResume : any[]) : void;		
		/** !#en Pause a set of targets.
		!#zh 暂停一组指定对象。 
		*/
		pauseTargets(targetsToPause : any[]) : void;		
		/** !#en
		purges the shared action manager. It releases the retained instance. <br/>
		because it uses this, so it can not be static.
		!#zh
		清除共用的动作管理器。它释放了持有的实例。 <br/>
		因为它使用 this，因此它不能是静态的。 
		*/
		purgeSharedManager() : void;		
		/** !#en The ActionManager update。
		!#zh ActionManager 主循环。
		@param dt delta time in seconds 
		*/
		update(dt : number) : void;	
	}		
		/** !#en
		<p>
		   ATTENTION: USE cc.director INSTEAD OF cc.Director.<br/>
		   cc.director is a singleton object which manage your game's logic flow.<br/>
		   Since the cc.director is a singleton, you don't need to call any constructor or create functions,<br/>
		   the standard way to use it is by calling:<br/>
		     - cc.director.methodName(); <br/>
		
		   It creates and handle the main Window and manages how and when to execute the Scenes.<br/>
		   <br/>
		   The cc.director is also responsible for:<br/>
		     - initializing the OpenGL context<br/>
		     - setting the OpenGL pixel format (default on is RGB565)<br/>
		     - setting the OpenGL buffer depth (default on is 0-bit)<br/>
		     - setting the color for clear screen (default one is BLACK)<br/>
		     - setting the projection (default one is 3D)<br/>
		     - setting the orientation (default one is Portrait)<br/>
		     <br/>
		   <br/>
		   The cc.director also sets the default OpenGL context:<br/>
		     - GL_TEXTURE_2D is enabled<br/>
		     - GL_VERTEX_ARRAY is enabled<br/>
		     - GL_COLOR_ARRAY is enabled<br/>
		     - GL_TEXTURE_COORD_ARRAY is enabled<br/>
		</p>
		<p>
		  cc.director also synchronizes timers with the refresh rate of the display.<br/>
		  Features and Limitations:<br/>
		     - Scheduled timers & drawing are synchronizes with the refresh rate of the display<br/>
		     - Only supports animation intervals of 1/60 1/30 & 1/15<br/>
		</p>
		
		!#zh
		<p>
		    注意：用 cc.director 代替 cc.Director。<br/>
		    cc.director 一个管理你的游戏的逻辑流程的单例对象。<br/>
		    由于 cc.director 是一个单例，你不需要调用任何构造函数或创建函数，<br/>
		    使用它的标准方法是通过调用：<br/>
		      - cc.director.methodName();
		    <br/>
		    它创建和处理主窗口并且管理什么时候执行场景。<br/>
		    <br/>
		    cc.director 还负责：<br/>
		     - 初始化 OpenGL 环境。<br/>
		     - 设置OpenGL像素格式。(默认是 RGB565)<br/>
		     - 设置OpenGL缓冲区深度 (默认是 0-bit)<br/>
		     - 设置空白场景的颜色 (默认是 黑色)<br/>
		     - 设置投影 (默认是 3D)<br/>
		     - 设置方向 (默认是 Portrait)<br/>
		   <br/>
		   cc.director 设置了 OpenGL 默认环境 <br/>
		     - GL_TEXTURE_2D   启用。<br/>
		     - GL_VERTEX_ARRAY 启用。<br/>
		     - GL_COLOR_ARRAY  启用。<br/>
		     - GL_TEXTURE_COORD_ARRAY 启用。<br/>
		</p>
		<p>
		  cc.director 也同步定时器与显示器的刷新速率。
		  <br/>
		  特点和局限性: <br/>
		     - 将计时器 & 渲染与显示器的刷新频率同步。<br/>
		     - 只支持动画的间隔 1/60 1/30 & 1/15。<br/>
		</p> */
		export class Director {		
		/** !#en
		Converts an OpenGL coordinate to a view coordinate<br/>
		Useful to convert node points to window points for calls such as glScissor<br/>
		Implementation can be found in CCDirectorWebGL.
		!#zh 将触摸点的 WebGL View 坐标转换为屏幕坐标。 
		*/
		convertToUI(glPoint : Vec2) : Vec2;		
		/** !#en
		Returns the size of the WebGL view in points.<br/>
		It takes into account any possible rotation (device orientation) of the window.
		!#zh 获取视图的大小，以点为单位。 
		*/
		getWinSize() : Size;		
		/** !#en
		Returns the size of the OpenGL view in pixels.<br/>
		It takes into account any possible rotation (device orientation) of the window.<br/>
		On Mac winSize and winSizeInPixels return the same value.
		!#zh 获取视图大小，以像素为单位。 
		*/
		getWinSizeInPixels() : Size;		
		/** !#en Returns the visible size of the running scene.
		!#zh 获取运行场景的可见大小。 
		*/
		getVisibleSize() : Size;		
		/** !#en Returns the visible origin of the running scene.
		!#zh 获取视图在游戏内容中的坐标原点。 
		*/
		getVisibleOrigin() : Vec2;		
		/** !#en Pause the director's ticker, only involve the game logic execution.
		It won't pause the rendering process nor the event manager.
		If you want to pause the entier game including rendering, audio and event,
		please use {{#crossLink "Game.pause"}}cc.game.pause{{/crossLink}}
		!#zh 暂停正在运行的场景，该暂停只会停止游戏逻辑执行，但是不会停止渲染和 UI 响应。
		如果想要更彻底得暂停游戏，包含渲染，音频和事件，请使用 {{#crossLink "Game.pause"}}cc.game.pause{{/crossLink}}。 
		*/
		pause() : void;		
		/** !#en
		Run a scene. Replaces the running scene with a new one or enter the first scene.<br/>
		The new scene will be launched immediately.
		!#zh 立刻切换指定场景。
		@param scene The need run scene.
		@param onBeforeLoadScene The function invoked at the scene before loading.
		@param onLaunched The function invoked at the scene after launch. 
		*/
		runSceneImmediate(scene : Scene, onBeforeLoadScene? : Function, onLaunched? : Function) : void;		
		/** !#en Loads the scene by its name.
		!#zh 通过场景名称进行加载场景。
		@param sceneName The name of the scene to load.
		@param onLaunched callback, will be called after scene launched. 
		*/
		loadScene(sceneName : string, onLaunched? : Function) : boolean;		
		/** !#en
		Preloads the scene to reduces loading time. You can call this method at any time you want.
		After calling this method, you still need to launch the scene by `cc.director.loadScene`.
		It will be totally fine to call `cc.director.loadScene` at any time even if the preloading is not
		yet finished, the scene will be launched after loaded automatically.
		!#zh 预加载场景，你可以在任何时候调用这个方法。
		调用完后，你仍然需要通过 `cc.director.loadScene` 来启动场景，因为这个方法不会执行场景加载操作。
		就算预加载还没完成，你也可以直接调用 `cc.director.loadScene`，加载完成后场景就会启动。
		@param sceneName The name of the scene to preload.
		@param onLoaded callback, will be called after scene loaded. 
		*/
		preloadScene(sceneName : string, onLoaded: (error: Error) => void) : void;		
		/** !#en Resume game logic execution after pause, if the current scene is not paused, nothing will happen.
		!#zh 恢复暂停场景的游戏逻辑，如果当前场景没有暂停将没任何事情发生。 
		*/
		resume() : void;		
		/** !#en
		Enables or disables WebGL depth test.<br/>
		Implementation can be found in CCDirectorCanvas.js/CCDirectorWebGL.js
		!#zh 启用/禁用深度测试（在 Canvas 渲染模式下不会生效）。 
		*/
		setDepthTest(on : boolean) : void;		
		/** !#en
		set color for clear screen.<br/>
		Implementation can be found in CCDirectorCanvas.js/CCDirectorWebGL.js
		!#zh 设置场景的默认擦除颜色（支持白色全透明，但不支持透明度为中间值）。 
		*/
		setClearColor(clearColor : Color) : void;		
		/** !#en
		Sets an OpenGL projection.<br/>
		Implementation can be found in CCDirectorCanvas.js/CCDirectorWebGL.js.
		!#zh 设置 OpenGL 投影。 
		*/
		setProjection(projection : number) : void;		
		/** !#en
		Update the view port.<br/>
		Implementation can be found in CCDirectorCanvas.js/CCDirectorWebGL.js.
		!#zh 设置视窗（请不要主动调用这个接口，除非你知道你在做什么）。 
		*/
		setViewport() : void;		
		/** !#en
		Sets an OpenGL projection.<br/>
		Implementation can be found in CCDirectorCanvas.js/CCDirectorWebGL.js.
		!#zh 获取 OpenGL 投影。 
		*/
		getProjection() : number;		
		/** !#en
		Enables/disables OpenGL alpha blending.<br/>
		Implementation can be found in CCDirectorCanvas.js/CCDirectorWebGL.js.
		!#zh 启用/禁用 透明度融合。 
		*/
		setAlphaBlending(on : boolean) : void;		
		/** !#en
		Returns whether or not the replaced scene will receive the cleanup message.<br/>
		If the new scene is pushed, then the old scene won't receive the "cleanup" message.<br/>
		If the new scene replaces the old one, the it will receive the "cleanup" message.
		!#zh
		更换场景时是否接收清理消息。<br>
		如果新场景是采用 push 方式进入的，那么旧的场景将不会接收到 “cleanup” 消息。<br/>
		如果新场景取代旧的场景，它将会接收到 “cleanup” 消息。</br> 
		*/
		isSendCleanupToScene() : boolean;		
		/** !#en Returns current logic Scene.
		!#zh 获取当前逻辑场景。
		
		@example 
		```js
		// This will help you to get the Canvas node in scene
		 cc.director.getScene().getChildByName('Canvas');
		``` 
		*/
		getScene() : Scene;		
		/** !#en Returns the FPS value.
		!#zh 获取单位帧执行时间。 
		*/
		getAnimationInterval() : number;		
		/** !#en Returns whether or not to display the FPS informations.
		!#zh 获取是否显示 FPS 信息。 
		*/
		isDisplayStats() : boolean;		
		/** !#en Sets whether display the FPS on the bottom-left corner.
		!#zh 设置是否在左下角显示 FPS。 
		*/
		setDisplayStats(displayStats : boolean) : void;		
		/** !#en Returns seconds per frame.
		!#zh 获取实际记录的上一帧执行时间，可能与单位帧执行时间（AnimationInterval）有出入。 
		*/
		getSecondsPerFrame() : number;		
		/** !#en Returns whether next delta time equals to zero.
		!#zh 返回下一个 “delta time” 是否等于零。 
		*/
		isNextDeltaTimeZero() : boolean;		
		/** !#en Returns whether or not the Director is paused.
		!#zh 是否处于暂停状态。 
		*/
		isPaused() : boolean;		
		/** !#en Returns how many frames were called since the director started.
		!#zh 获取 director 启动以来游戏运行的总帧数。 
		*/
		getTotalFrames() : number;		
		/** !#en Returns the cc.Scheduler associated with this director.
		!#zh 获取和 director 相关联的 cc.Scheduler。 
		*/
		getScheduler() : Scheduler;		
		/** !#en Sets the cc.Scheduler associated with this director.
		!#zh 设置和 director 相关联的 cc.Scheduler。 
		*/
		setScheduler(scheduler : Scheduler) : void;		
		/** !#en Returns the cc.ActionManager associated with this director.
		!#zh 获取和 director 相关联的 cc.ActionManager（动作管理器）。 
		*/
		getActionManager() : ActionManager;		
		/** !#en Sets the cc.ActionManager associated with this director.
		!#zh 设置和 director 相关联的 cc.ActionManager（动作管理器）。 
		*/
		setActionManager(actionManager : ActionManager) : void;		
		/** Returns the cc.CollisionManager associated with this director. 
		*/
		getCollisionManager() : CollisionManager;		
		/** !#en Returns the delta time since last frame.
		!#zh 获取上一帧的 “delta time”。 
		*/
		getDeltaTime() : number;	
	}		
		/** !#en cc.game is the singleton object for game related functions.
		!#zh cc.game 是 Game 的实例，用来驱动整个游戏。 */
		export class Game {		
		/** Event triggered when game hide to background.
		Please note that this event is not 100% guaranteed to be fired. */
		EVENT_HIDE : string;		
		/** Event triggered when game back to foreground
		Please note that this event is not 100% guaranteed to be fired. */
		EVENT_SHOW : string;		
		/** Event triggered after game inited, at this point all engine objects and game scripts are loaded */
		EVENT_GAME_INITED : string;		
		/** Event triggered after renderer inited, at this point you will be able to use the render context */
		EVENT_RENDERER_INITED : string;		
		/** Key of config */
		CONFIG_KEY : any;		
		/** !#en The outer frame of the game canvas, parent of cc.container.
		!#zh 游戏画布的外框，cc.container 的父类。 */
		frame : any;		
		/** !#en The container of game canvas, equals to cc.container.
		!#zh 游戏画布的容器。 */
		container : any;		
		/** !#en The canvas of the game, equals to cc._canvas.
		!#zh 游戏的画布。 */
		canvas : any;		
		/** !#en
		The current game configuration, including:<br/>
		1. debugMode<br/>
		     "debugMode" possible values :<br/>
		     0 - No message will be printed.                                                      <br/>
		     1 - cc.error, cc.assert, cc.warn, cc.log will print in console.                      <br/>
		     2 - cc.error, cc.assert, cc.warn will print in console.                              <br/>
		     3 - cc.error, cc.assert will print in console.                                       <br/>
		     4 - cc.error, cc.assert, cc.warn, cc.log will print on canvas, available only on web.<br/>
		     5 - cc.error, cc.assert, cc.warn will print on canvas, available only on web.        <br/>
		     6 - cc.error, cc.assert will print on canvas, available only on web.                 <br/>
		2. showFPS<br/>
		     Left bottom corner fps information will show when "showFPS" equals true, otherwise it will be hide.<br/>
		3. exposeClassName<br/>
		     Expose class name to chrome debug tools, the class intantiate performance is a little bit slower when exposed.<br/>
		4. frameRate<br/>
		     "frameRate" set the wanted frame rate for your game, but the real fps depends on your game implementation and the running environment.<br/>
		5. id<br/>
		     "gameCanvas" sets the id of your canvas element on the web page, it's useful only on web.<br/>
		6. renderMode<br/>
		     "renderMode" sets the renderer type, only useful on web :<br/>
		     0 - Automatically chosen by engine<br/>
		     1 - Forced to use canvas renderer<br/>
		     2 - Forced to use WebGL renderer, but this will be ignored on mobile browsers<br/>
		7. scenes<br/>
		     "scenes" include available scenes in the current bundle.<br/>
		<br/>
		Please DO NOT modify this object directly, it won't have any effect.<br/>
		!#zh
		当前的游戏配置，包括：                                                                  <br/>
		1. debugMode（debug 模式，但是在浏览器中这个选项会被忽略）                                <br/>
		     "debugMode" 各种设置选项的意义。                                                   <br/>
		         0 - 没有消息被打印出来。                                                       <br/>
		         1 - cc.error，cc.assert，cc.warn，cc.log 将打印在 console 中。                  <br/>
		         2 - cc.error，cc.assert，cc.warn 将打印在 console 中。                          <br/>
		         3 - cc.error，cc.assert 将打印在 console 中。                                   <br/>
		         4 - cc.error，cc.assert，cc.warn，cc.log 将打印在 canvas 中（仅适用于 web 端）。 <br/>
		         5 - cc.error，cc.assert，cc.warn 将打印在 canvas 中（仅适用于 web 端）。         <br/>
		         6 - cc.error，cc.assert 将打印在 canvas 中（仅适用于 web 端）。                  <br/>
		2. showFPS（显示 FPS）                                                            <br/>
		     当 showFPS 为 true 的时候界面的左下角将显示 fps 的信息，否则被隐藏。              <br/>
		3. exposeClassName                                                           <br/>
		     暴露类名让 Chrome DevTools 可以识别，如果开启会稍稍降低类的创建过程的性能，但对对象构造没有影响。 <br/>
		4. frameRate (帧率)                                                              <br/>
		     “frameRate” 设置想要的帧率你的游戏，但真正的FPS取决于你的游戏实现和运行环境。      <br/>
		5. id                                                                            <br/>
		     "gameCanvas" Web 页面上的 Canvas Element ID，仅适用于 web 端。                         <br/>
		6. renderMode（渲染模式）                                                         <br/>
		     “renderMode” 设置渲染器类型，仅适用于 web 端：                              <br/>
		         0 - 通过引擎自动选择。                                                     <br/>
		         1 - 强制使用 canvas 渲染。
		         2 - 强制使用 WebGL 渲染，但是在部分 Android 浏览器中这个选项会被忽略。     <br/>
		7. scenes                                                                         <br/>
		     “scenes” 当前包中可用场景。                                                   <br/>
		<br/>
		注意：请不要直接修改这个对象，它不会有任何效果。 */
		config : any;		
		/** !#en Callback when the scripts of engine have been load.
		!#zh 当引擎完成启动后的回调函数。 
		*/
		onStart() : void;		
		/** !#en Set frameRate of game.
		!#zh 设置游戏帧率。 
		*/
		setFrameRate(frameRate : number) : void;		
		/** !#en Run the game frame by frame.
		!#zh 执行一帧游戏循环。 
		*/
		step() : void;		
		/** !#en Pause the game main loop. This will pause:
		game logic execution, rendering process, event manager, background music and all audio effects.
		This is different with cc.director.pause which only pause the game logic execution.
		!#zh 暂停游戏主循环。包含：游戏逻辑，渲染，事件处理，背景音乐和所有音效。这点和只暂停游戏逻辑的 cc.director.pause 不同。 
		*/
		pause() : void;		
		/** !#en Resume the game from pause. This will resume:
		game logic execution, rendering process, event manager, background music and all audio effects.
		!#zh 恢复游戏主循环。包含：游戏逻辑，渲染，事件处理，背景音乐和所有音效。 
		*/
		resume() : void;		
		/** !#en Check whether the game is paused.
		!#zh 判断游戏是否暂停。 
		*/
		isPaused() : boolean;		
		/** !#en Restart game.
		!#zh 重新开始游戏 
		*/
		restart() : void;		
		/** !#en End game, it will close the game window
		!#zh 退出游戏 
		*/
		end() : void;		
		/** !#en Prepare game.
		!#zh 准备引擎，请不要直接调用这个函数。 
		*/
		prepare(cb : Function) : void;		
		/** !#en Run game with configuration object and onStart function.
		!#zh 运行游戏，并且指定引擎配置和 onStart 的回调。
		@param config Pass configuration object or onStart function
		@param onStart function to be executed after game initialized 
		*/
		run(config? : any|Function, onStart? : Function) : void;		
		/** !#en
		Add a persistent root node to the game, the persistent node won't be destroyed during scene transition.<br/>
		The target node must be placed in the root level of hierarchy, otherwise this API won't have any effect.
		!#zh
		声明常驻根节点，该节点不会被在场景切换中被销毁。<br/>
		目标节点必须位于为层级的根节点，否则无效。
		@param node The node to be made persistent 
		*/
		addPersistRootNode(node : Node) : void;		
		/** !#en Remove a persistent root node.
		!#zh 取消常驻根节点。
		@param node The node to be removed from persistent node list 
		*/
		removePersistRootNode(node : Node) : void;		
		/** !#en Check whether the node is a persistent root node.
		!#zh 检查节点是否是常驻根节点。
		@param node The node to be checked 
		*/
		isPersistRootNode(node : Node) : boolean;	
	}		
		/** !#en
		cc.Scene is a subclass of cc.Node that is used only as an abstract concept.<br/>
		cc.Scene and cc.Node are almost identical with the difference that users can not modify cc.Scene manually.
		!#zh
		cc.Scene 是 cc.Node 的子类，仅作为一个抽象的概念。<br/>
		cc.Scene 和 cc.Node 有点不同，用户不应直接修改 cc.Scene。 */
		export class Scene extends _BaseNode {		
		/** !#en Indicates whether all (directly or indirectly) static referenced assets of this scene are releasable by default after scene unloading.
		!#zh 指示该场景中直接或间接静态引用到的所有资源是否默认在场景切换后自动释放。 */
		autoReleaseAssets : boolean;	
	}		
		/** !#en
		Class of all entities in Cocos Creator scenes.<br/>
		Node also inherits from {{#crossLink "EventTarget"}}Event Target{{/crossLink}}, it permits Node to dispatch events.
		For events supported by Node, please refer to {{#crossLink "Node.EventType"}}{{/crossLink}}
		!#zh
		Cocos Creator 场景中的所有节点类。节点也继承了 {{#crossLink "EventTarget"}}EventTarget{{/crossLink}}，它允许节点发送事件。<br/>
		支持的节点事件，请参阅 {{#crossLink "Node.EventType"}}{{/crossLink}}。 */
		export class Node extends _BaseNode {		
		/** !#en
		The local active state of this node.<br/>
		Note that a Node may be inactive because a parent is not active, even if this returns true.<br/>
		Use {{#crossLink "Node/activeInHierarchy:property"}}{{/crossLink}} if you want to check if the Node is actually treated as active in the scene.
		!#zh
		当前节点的自身激活状态。<br/>
		值得注意的是，一个节点的父节点如果不被激活，那么即使它自身设为激活，它仍然无法激活。<br/>
		如果你想检查节点在场景中实际的激活状态可以使用 {{#crossLink "Node/activeInHierarchy:property"}}{{/crossLink}}。 */
		active : boolean;		
		/** !#en Indicates whether this node is active in the scene.
		!#zh 表示此节点是否在场景中激活。 */
		activeInHierarchy : boolean;		
		/** !#en
		Group index of node.<br/>
		Which Group this node belongs to will resolve that this node's collision components can collide with which other collision componentns.<br/>
		!#zh
		节点的分组索引。<br/>
		节点的分组将关系到节点的碰撞组件可以与哪些碰撞组件相碰撞。<br/> */
		groupIndex : Integer;		
		/** !#en
		Group of node.<br/>
		Which Group this node belongs to will resolve that this node's collision components can collide with which other collision componentns.<br/>
		!#zh
		节点的分组。<br/>
		节点的分组将关系到节点的碰撞组件可以与哪些碰撞组件相碰撞。<br/> */
		group : string;		
		/** !#en
		Returns the component of supplied type if the node has one attached, null if it doesn't.<br/>
		You can also get component in the node by passing in the name of the script.
		!#zh
		获取节点上指定类型的组件，如果节点有附加指定类型的组件，则返回，如果没有则为空。<br/>
		传入参数也可以是脚本的名称。
		
		@example 
		```js
		// get sprite component.
		var sprite = node.getComponent(cc.Sprite);
		// get custom test calss.
		var test = node.getComponent("Test");
		``` 
		*/
		getComponent(typeOrClassName : Function|string) : Component;		
		/** !#en Returns all components of supplied type in the node.
		!#zh 返回节点上指定类型的所有组件。
		
		@example 
		```js
		var sprites = node.getComponents(cc.Sprite);
		var tests = node.getComponents("Test");
		``` 
		*/
		getComponents(typeOrClassName : Function|string) : Component[];		
		/** !#en Returns the component of supplied type in any of its children using depth first search.
		!#zh 递归查找所有子节点中第一个匹配指定类型的组件。
		
		@example 
		```js
		var sprite = node.getComponentInChildren(cc.Sprite);
		var Test = node.getComponentInChildren("Test");
		``` 
		*/
		getComponentInChildren(typeOrClassName : Function|string) : Component;		
		/** !#en Returns all components of supplied type in self or any of its children.
		!#zh 递归查找自身或所有子节点中指定类型的组件
		
		@example 
		```js
		var sprites = node.getComponentsInChildren(cc.Sprite);
		var tests = node.getComponentsInChildren("Test");
		``` 
		*/
		getComponentsInChildren(typeOrClassName : Function|string) : Component[];		
		/** !#en Adds a component class to the node. You can also add component to node by passing in the name of the script.
		!#zh 向节点添加一个指定类型的组件类，你还可以通过传入脚本的名称来添加组件。
		@param typeOrClassName The constructor or the class name of the component to add
		
		@example 
		```js
		var sprite = node.addComponent(cc.Sprite);
		var test = node.addComponent("Test");
		``` 
		*/
		addComponent(typeOrClassName : Function|string) : Component;		
		/** !#en
		Removes a component identified by the given name or removes the component object given.
		You can also use component.destroy() if you already have the reference.
		!#zh
		删除节点上的指定组件，传入参数可以是一个组件构造函数或组件名，也可以是已经获得的组件引用。
		如果你已经获得组件引用，你也可以直接调用 component.destroy()
		@param component The need remove component.
		
		@example 
		```js
		node.removeComponent(cc.Sprite);
		var Test = require("Test");
		node.removeComponent(Test);
		``` 
		*/
		removeComponent(component : string|Function|Component) : void;		
		/** !#en
		Register a callback of a specific event type on Node.<br/>
		Use this method to register touch or mouse event permit propagation based on scene graph,
		you can propagate the event to the parents or swallow it by calling stopPropagation on the event.<br/>
		It's the recommended way to register touch/mouse event for Node,
		please do not use cc.eventManager directly for Node.
		!#zh
		在节点上注册指定类型的回调函数，也可以设置 target 用于绑定响应函数的调用者。<br/>
		同时您可以将事件派发到父节点或者通过调用 stopPropagation 拦截它。<br/>
		推荐使用这种方式来监听节点上的触摸或鼠标事件，请不要在节点上直接使用 cc.eventManager。
		@param type A string representing the event type to listen for.<br>
		                       See {{#crossLink "Node/position-changed:event"}}Node Events{{/crossLink}} for all builtin events.
		@param callback The callback that will be invoked when the event is dispatched.
		                             The callback is ignored if it is a duplicate (the callbacks are unique).
		@param target The target to invoke the callback, can be null
		@param useCapture When set to true, the capture argument prevents callback
		                             from being invoked when the event's eventPhase attribute value is BUBBLING_PHASE.
		                             When false, callback will NOT be invoked when event's eventPhase attribute value is CAPTURING_PHASE.
		                             Either way, callback will be invoked when event's eventPhase attribute value is AT_TARGET.
		
		@example 
		```js
		this.node.on(cc.Node.EventType.TOUCH_START, this.memberFunction, this);  // if "this" is component and the "memberFunction" declared in CCClass.
		node.on(cc.Node.EventType.TOUCH_START, callback, this.node);
		node.on(cc.Node.EventType.TOUCH_MOVE, callback, this.node);
		node.on(cc.Node.EventType.TOUCH_END, callback, this.node);
		node.on(cc.Node.EventType.TOUCH_CANCEL, callback, this.node);
		node.on("anchor-changed", callback, this);
		``` 
		*/
		on(type : string, callback: (param: Event) => void, target? : any, useCapture : boolean) : Function;		
		/** !#en
		Removes the callback previously registered with the same type, callback, target and or useCapture.
		This method is merely an alias to removeEventListener.
		!#zh 删除之前与同类型，回调，目标或 useCapture 注册的回调。
		@param type A string representing the event type being removed.
		@param callback The callback to remove.
		@param target The target to invoke the callback, if it's not given, only callback without target will be removed
		@param useCapture Specifies whether the callback being removed was registered as a capturing callback or not.
		                             If not specified, useCapture defaults to false. If a callback was registered twice,
		                             one with capture and one without, each must be removed separately. Removal of a capturing callback
		                             does not affect a non-capturing version of the same listener, and vice versa.
		
		@example 
		```js
		this.node.off(cc.Node.EventType.TOUCH_START, this.memberFunction, this);
		node.off(cc.Node.EventType.TOUCH_START, callback, this.node);
		node.off("anchor-changed", callback, this);
		``` 
		*/
		off(type : string, callback : Function, target? : any, useCapture : boolean) : void;		
		/** !#en Removes all callbacks previously registered with the same target.
		!#zh 移除目标上的所有注册事件。
		@param target The target to be searched for all related callbacks
		
		@example 
		```js
		node.targetOff(target);
		``` 
		*/
		targetOff(target : any) : void;		
		/** !#en
		Executes an action, and returns the action that is executed.<br/>
		The node becomes the action's target. Refer to cc.Action's getTarget() <br/>
		Calling runAction while the node is not active won't have any effect. <br/>
		Note：You shouldn't modify the action after runAction, that won't take any effect.<br/>
		if you want to modify, when you define action plus.
		!#zh
		执行并返回该执行的动作。该节点将会变成动作的目标。<br/>
		调用 runAction 时，节点自身处于不激活状态将不会有任何效果。<br/>
		注意：你不应该修改 runAction 后的动作，将无法发挥作用，如果想进行修改，请在定义 action 时加入。
		
		@example 
		```js
		var action = cc.scaleTo(0.2, 1, 0.6);
		node.runAction(action);
		node.runAction(action).repeatForever(); // fail
		node.runAction(action.repeatForever()); // right
		``` 
		*/
		runAction(action : Action) : Action;		
		/** !#en Stops and removes all actions from the running action list .
		!#zh 停止并且移除所有正在运行的动作列表。
		
		@example 
		```js
		node.stopAllActions();
		``` 
		*/
		stopAllActions() : void;		
		/** !#en Stops and removes an action from the running action list.
		!#zh 停止并移除指定的动作。
		@param action An action object to be removed.
		
		@example 
		```js
		var action = cc.scaleTo(0.2, 1, 0.6);
		node.stopAction(action);
		``` 
		*/
		stopAction(action : Action) : void;		
		/** !#en Removes an action from the running action list by its tag.
		!#zh 停止并且移除指定标签的动作。
		@param tag A tag that indicates the action to be removed.
		
		@example 
		```js
		node.stopAction(1);
		``` 
		*/
		stopActionByTag(tag : number) : void;		
		/** !#en Returns an action from the running action list by its tag.
		!#zh 通过标签获取指定动作。
		
		@example 
		```js
		var action = node.getActionByTag(1);
		``` 
		*/
		getActionByTag(tag : number) : Action;		
		/** !#en
		Returns the numbers of actions that are running plus the ones that are schedule to run (actions in actionsToAdd and actions arrays).<br/>
		   Composable actions are counted as 1 action. Example:<br/>
		   If you are running 1 Sequence of 7 actions, it will return 1. <br/>
		   If you are running 7 Sequences of 2 actions, it will return 7.</p>
		!#zh
		获取运行着的动作加上正在调度运行的动作的总数。<br/>
		例如：<br/>
		- 如果你正在运行 7 个动作中的 1 个 Sequence，它将返回 1。<br/>
		- 如果你正在运行 2 个动作中的 7 个 Sequence，它将返回 7。<br/>
		
		@example 
		```js
		var count = node.getNumberOfRunningActions();
		cc.log("Running Action Count: " + count);
		``` 
		*/
		getNumberOfRunningActions() : number;	
	}		
		/** !#en
		Scheduler is responsible of triggering the scheduled callbacks.<br/>
		You should not use NSTimer. Instead use this class.<br/>
		<br/>
		There are 2 different types of callbacks (selectors):<br/>
		    - update callback: the 'update' callback will be called every frame. You can customize the priority.<br/>
		    - custom callback: A custom callback will be called every frame, or with a custom interval of time<br/>
		<br/>
		The 'custom selectors' should be avoided when possible. It is faster,
		and consumes less memory to use the 'update callback'. *
		!#zh
		Scheduler 是负责触发回调函数的类。<br/>
		通常情况下，建议使用 cc.director.getScheduler() 来获取系统定时器。<br/>
		有两种不同类型的定时器：<br/>
		    - update 定时器：每一帧都会触发。您可以自定义优先级。<br/>
		    - 自定义定时器：自定义定时器可以每一帧或者自定义的时间间隔触发。<br/>
		如果希望每帧都触发，应该使用 update 定时器，使用 update 定时器更快，而且消耗更少的内存。 */
		export class Scheduler {		
		/** !#en
		Modifies the time of all scheduled callbacks.<br/>
		You can use this property to create a 'slow motion' or 'fast forward' effect.<br/>
		Default is 1.0. To create a 'slow motion' effect, use values below 1.0.<br/>
		To create a 'fast forward' effect, use values higher than 1.0.<br/>
		Note：It will affect EVERY scheduled selector / action.
		!#zh
		设置时间间隔的缩放比例。<br/>
		您可以使用这个方法来创建一个 “slow motion（慢动作）” 或 “fast forward（快进）” 的效果。<br/>
		默认是 1.0。要创建一个 “slow motion（慢动作）” 效果,使用值低于 1.0。<br/>
		要使用 “fast forward（快进）” 效果，使用值大于 1.0。<br/>
		注意：它影响该 Scheduler 下管理的所有定时器。 
		*/
		setTimeScale(timeScale : number) : void;		
		/** !#en Returns time scale of scheduler.
		!#zh 获取时间间隔的缩放比例。 
		*/
		getTimeScale() : number;		
		/** !#en 'update' the scheduler. (You should NEVER call this method, unless you know what you are doing.)
		!#zh update 调度函数。(不应该直接调用这个方法，除非完全了解这么做的结果)
		@param dt delta time 
		*/
		update(dt : number) : void;		
		/** !#en
		<p>
		  The scheduled method will be called every 'interval' seconds.</br>
		  If paused is YES, then it won't be called until it is resumed.<br/>
		  If 'interval' is 0, it will be called every frame, but if so, it recommended to use 'scheduleUpdateForTarget:' instead.<br/>
		  If the callback function is already scheduled, then only the interval parameter will be updated without re-scheduling it again.<br/>
		  repeat let the action be repeated repeat + 1 times, use cc.macro.REPEAT_FOREVER to let the action run continuously<br/>
		  delay is the amount of time the action will wait before it'll start<br/>
		</p>
		!#zh
		指定回调函数，调用对象等信息来添加一个新的定时器。</br>
		当时间间隔达到指定值时，设置的回调函数将会被调用。</br>
		如果 paused 值为 true，那么直到 resume 被调用才开始计时。</br>
		如果 interval 值为 0，那么回调函数每一帧都会被调用，但如果是这样，
		建议使用 scheduleUpdateForTarget 代替。</br>
		如果回调函数已经被定时器使用，那么只会更新之前定时器的时间间隔参数，不会设置新的定时器。<br/>
		repeat 值可以让定时器触发 repeat + 1 次，使用 cc.macro.REPEAT_FOREVER
		可以让定时器一直循环触发。<br/>
		delay 值指定延迟时间，定时器会在延迟指定的时间之后开始计时。
		
		@example 
		```js
		//register a schedule to scheduler
		var scheduler = cc.director.getScheduler();
		scheduler.scheduleCallbackForTarget(this, function, interval, repeat, delay, !this._isRunning);
		
		``` 
		*/
		scheduleCallbackForTarget(target : any, callback_fn : Function, interval : number, repeat : number, delay : number, paused : boolean) : void;		
		/** !#en The schedule
		!#zh 定时器
		
		@example 
		```js
		//register a schedule to scheduler
		cc.director.getScheduler().schedule(callback, this, interval, !this._isRunning);
		
		``` 
		*/
		schedule(callback : Function, target : any, interval : number, repeat : number, delay : number, paused : boolean) : void;		
		/** !#en
		Schedules the update callback for a given target,
		the callback will be invoked every frame after schedule started.
		!#zh
		使用指定的优先级为指定的对象设置 update 定时器。
		update 定时器每一帧都会被触发。优先级的值越低，定时器被触发的越早。 
		*/
		scheduleUpdate(target : any, priority : number, paused : boolean, updateFunc : Function) : void;		
		/** !#en
		Unschedules a callback for a callback and a given target.
		If you want to unschedule the "update", use `unscheduleUpdate()`
		!#zh
		根据指定的回调函数和调用对象。
		如果需要取消 update 定时器，请使用 unscheduleUpdate()。
		@param callback The callback to be unscheduled
		@param target The target bound to the callback. 
		*/
		unschedule(callback : Function, target : any) : void;		
		/** !#en Unschedules the update callback for a given target.
		!#zh 取消指定对象的 update 定时器。
		@param target The target to be unscheduled. 
		*/
		unscheduleUpdate(target : any) : void;		
		/** !#en
		Unschedules all scheduled callbacks for a given target.
		This also includes the "update" callback.
		!#zh 取消指定对象的所有定时器，包括 update 定时器。
		@param target The target to be unscheduled. 
		*/
		unscheduleAllForTarget(target : any) : void;		
		/** !#en
		Unschedules all scheduled callbacks from all targets including the system callbacks.<br/>
		You should NEVER call this method, unless you know what you are doing.
		!#zh
		取消所有对象的所有定时器，包括系统定时器。<br/>
		不用调用此函数，除非你确定你在做什么。 
		*/
		unscheduleAll() : void;		
		/** !#en
		Unschedules all callbacks from all targets with a minimum priority.<br/>
		You should only call this with `PRIORITY_NON_SYSTEM_MIN` or higher.
		!#zh
		取消所有优先级的值大于指定优先级的定时器。<br/>
		你应该只取消优先级的值大于 PRIORITY_NON_SYSTEM_MIN 的定时器。
		@param minPriority The minimum priority of selector to be unscheduled. Which means, all selectors which
		       priority is higher than minPriority will be unscheduled. 
		*/
		unscheduleAllWithMinPriority(minPriority : number) : void;		
		/** !#en Checks whether a callback for a given target is scheduled.
		!#zh 检查指定的回调函数和回调对象组合是否存在定时器。
		@param callback The callback to check.
		@param target The target of the callback. 
		*/
		isScheduled(callback : Function, target : any) : boolean;		
		/** !#en
		Pause all selectors from all targets.<br/>
		You should NEVER call this method, unless you know what you are doing.
		!#zh
		暂停所有对象的所有定时器。<br/>
		不要调用这个方法，除非你知道你正在做什么。 
		*/
		pauseAllTargets() : void;		
		/** !#en
		Pause all selectors from all targets with a minimum priority. <br/>
		You should only call this with kCCPriorityNonSystemMin or higher.
		!#zh
		暂停所有优先级的值大于指定优先级的定时器。<br/>
		你应该只暂停优先级的值大于 PRIORITY_NON_SYSTEM_MIN 的定时器。 
		*/
		pauseAllTargetsWithMinPriority(minPriority : number) : void;		
		/** !#en
		Resume selectors on a set of targets.<br/>
		This can be useful for undoing a call to pauseAllCallbacks.
		!#zh
		恢复指定数组中所有对象的定时器。<br/>
		这个函数是 pauseAllCallbacks 的逆操作。 
		*/
		resumeTargets(targetsToResume : any[]) : void;		
		/** !#en
		Pauses the target.<br/>
		All scheduled selectors/update for a given target won't be 'ticked' until the target is resumed.<br/>
		If the target is not present, nothing happens.
		!#zh
		暂停指定对象的定时器。<br/>
		指定对象的所有定时器都会被暂停。<br/>
		如果指定的对象没有定时器，什么也不会发生。 
		*/
		pauseTarget(target : any) : void;		
		/** !#en
		Resumes the target.<br/>
		The 'target' will be unpaused, so all schedule selectors/update will be 'ticked' again.<br/>
		If the target is not present, nothing happens.
		!#zh
		恢复指定对象的所有定时器。<br/>
		指定对象的所有定时器将继续工作。<br/>
		如果指定的对象没有定时器，什么也不会发生。 
		*/
		resumeTarget(target : any) : void;		
		/** !#en Returns whether or not the target is paused.
		!#zh 返回指定对象的定时器是否暂停了。 
		*/
		isTargetPaused(target : any) : boolean;		
		/** !#en
		Schedules the 'update' callback_fn for a given target with a given priority.<br/>
		The 'update' callback_fn will be called every frame.<br/>
		The lower the priority, the earlier it is called.
		!#zh
		为指定对象设置 update 定时器。<br/>
		update 定时器每一帧都会被调用。<br/>
		优先级的值越低，越早被调用。
		
		@example 
		```js
		//register this object to scheduler
		var scheduler = cc.director.getScheduler();
		scheduler.scheduleUpdateForTarget(this, priority, !this._isRunning );
		
		``` 
		*/
		scheduleUpdateForTarget(target : any, priority : number, paused : boolean) : void;		
		/** !#en
		Unschedule a callback function for a given target.<br/>
		If you want to unschedule the "update", use unscheduleUpdateForTarget.
		!#zh
		根据指定的回调函数和调用对象对象取消相应的定时器。<br/>
		如果需要取消 update 定时器，请使用 unscheduleUpdateForTarget()。
		@param callback callback[Function] or key[String]
		
		@example 
		```js
		//unschedule a callback of target
		var scheduler = cc.director.getScheduler();
		scheduler.unscheduleCallbackForTarget(this, callback);
		
		``` 
		*/
		unscheduleCallbackForTarget(target : any, callback : Function) : void;		
		/** !#en Unschedules the update callback function for a given target.
		!#zh 取消指定对象的所有定时器。
		
		@example 
		```js
		//unschedules the "update" method.
		var scheduler = cc.director.getScheduler();
		scheduler.unscheduleUpdateForTarget(this);
		
		``` 
		*/
		unscheduleUpdateForTarget(target : any) : void;		
		/** !#en
		Unschedules all function callbacks for a given target.<br/>
		This also includes the "update" callback function.
		!#zh 取消指定对象的所有定时器，包括 update 定时器。 
		*/
		unscheduleAllCallbacksForTarget(target : any) : void;		
		/** !#en
		Unschedules all function callbacks from all targets. <br/>
		You should NEVER call this method, unless you know what you are doing.
		!#zh
		取消所有对象的所有定时器。<br/>
		不要调用这个方法，除非你知道你正在做什么。 
		*/
		unscheduleAllCallbacks() : void;		
		/** !#en
		Unschedules all function callbacks from all targets with a minimum priority.<br/>
		You should only call this with kCCPriorityNonSystemMin or higher.
		!#zh
		取消所有优先级的值大于指定优先级的所有对象的所有定时器。<br/>
		你应该只暂停优先级的值大于 PRIORITY_NON_SYSTEM_MIN 的定时器。 
		*/
		unscheduleAllCallbacksWithMinPriority(minPriority : number) : void;		
		/** !#en Priority level reserved for system services.
		!#zh 系统服务的优先级。 */
		PRIORITY_SYSTEM : number;		
		/** !#en Minimum priority level for user scheduling.
		!#zh 用户调度最低优先级。 */
		PRIORITY_NON_SYSTEM : number;	
	}		
		/** !#en Renders the TMX object.
		!#zh 渲染 tmx object。 */
		export class TMXObject {		
		/** !#en Get the name of object
		!#zh 获取对象的名称 
		*/
		getObjectName() : string;		
		/** !#en Get the property of object
		!#zh 获取对象的属性 
		*/
		getProperty() : any;		
		/** !#en Get the properties of object
		!#zh 获取对象的属性 
		*/
		getProperties() : any;		
		/** !#en Set the object name
		!#zh 设置对象名称 
		*/
		setObjectName(name : string) : void;		
		/** !#en Set the properties of the object
		!#zh 设置对象的属性 
		*/
		setProperties(props : any) : void;	
	}		
		/** !#en Render the TMX layer.
		!#zh 渲染 TMX layer。 */
		export class TiledLayer extends _SGComponent {		
		/** !#en Gets the layer name.
		!#zh 获取层的名称。
		
		@example 
		```js
		var layerName = tiledLayer.getLayerName();
		cc.log(layerName);
		``` 
		*/
		getLayerName() : string;		
		/** !#en Set the layer name.
		!#zh 设置层的名称
		
		@example 
		```js
		tiledLayer.setLayerName("New Layer");
		``` 
		*/
		SetLayerName(layerName : string) : void;		
		/** !#en Return the value for the specific property name.
		!#zh 获取指定属性名的值。
		
		@example 
		```js
		var property = tiledLayer.getProperty("info");
		cc.log(property);
		``` 
		*/
		getProperty(propertyName : string) : any;		
		/** !#en Returns the position in pixels of a given tile coordinate.
		!#zh 获取指定 tile 的像素坐标。
		@param pos position or x
		
		@example 
		```js
		var pos = tiledLayer.getPositionAt(cc.v2(0, 0));
		cc.log("Pos: " + pos);
		var pos = tiledLayer.getPositionAt(0, 0);
		cc.log("Pos: " + pos);
		``` 
		*/
		getPositionAt(pos : Vec2|number, y? : number) : Vec2;		
		/** !#en Removes a tile at given tile coordinate.
		!#zh 删除指定坐标上的 tile。
		@param pos position or x
		
		@example 
		```js
		tiledLayer.removeTileAt(cc.v2(0, 0));
		tiledLayer.removeTileAt(0, 0);
		``` 
		*/
		removeTileAt(pos : Vec2|number, y? : number) : void;		
		/** !#en
		Sets the tile gid (gid = tile global id) at a given tile coordinate.<br />
		The Tile GID can be obtained by using the method "tileGIDAt" or by using the TMX editor . Tileset Mgr +1.<br />
		If a tile is already placed at that position, then it will be removed.
		!#zh
		设置给定坐标的 tile 的 gid (gid = tile 全局 id)，
		tile 的 GID 可以使用方法 “tileGIDAt” 来获得。<br />
		如果一个 tile 已经放在那个位置，那么它将被删除。
		@param posOrX position or x
		@param flagsOrY flags or y
		
		@example 
		```js
		tiledLayer.setTileGID(1001, 10, 10, 1)
		``` 
		*/
		setTileGID(gid : number, posOrX : Vec2|number, flagsOrY : number, flags? : number) : void;		
		/** !#en
		Returns the tile gid at a given tile coordinate. <br />
		if it returns 0, it means that the tile is empty. <br />
		This method requires the the tile map has not been previously released (eg. don't call layer.releaseMap())<br />
		!#zh
		通过给定的 tile 坐标、flags（可选）返回 tile 的 GID. <br />
		如果它返回 0，则表示该 tile 为空。<br />
		该方法要求 tile 地图之前没有被释放过(如：没有调用过layer.releaseMap()).
		@param pos or x
		
		@example 
		```js
		var tileGid = tiledLayer.getTileGIDAt(0, 0);
		``` 
		*/
		getTileGIDAt(pos : Vec2|number, y? : number) : number;		
		/** !#en
		Returns the tile (_ccsg.Sprite) at a given a tile coordinate. <br/>
		The returned _ccsg.Sprite will be already added to the _ccsg.TMXLayer. Don't add it again.<br/>
		The _ccsg.Sprite can be treated like any other _ccsg.Sprite: rotated, scaled, translated, opacity, color, etc. <br/>
		You can remove either by calling: <br/>
		- layer.removeChild(sprite, cleanup); <br/>
		- or layer.removeTileAt(ccp(x,y));
		!#zh
		通过指定的 tile 坐标获取对应的 tile(Sprite)。 返回的 tile(Sprite) 应是已经添加到 TMXLayer，请不要重复添加。<br/>
		这个 tile(Sprite) 如同其他的 Sprite 一样，可以旋转、缩放、翻转、透明化、设置颜色等。<br/>
		你可以通过调用以下方法来对它进行删除:<br/>
		1. layer.removeChild(sprite, cleanup);<br/>
		2. 或 layer.removeTileAt(cc.v2(x,y));
		@param pos or x
		
		@example 
		```js
		var title = tiledLayer.getTileAt(100, 100);
		cc.log(title);
		``` 
		*/
		getTileAt(pos : Vec2|number, y? : number) : _ccsg.Sprite;		
		/** !#en
		Dealloc the map that contains the tile position from memory. <br />
		Unless you want to know at runtime the tiles positions, you can safely call this method. <br />
		If you are going to call layer.getTileGIDAt() then, don't release the map.
		!#zh
		从内存中释放包含 tile 位置信息的地图。<br />
		除了在运行时想要知道 tiles 的位置信息外，你都可安全的调用此方法。<br />
		如果你之后还要调用 layer.tileGIDAt(), 请不要释放地图.
		
		@example 
		```js
		tiledLayer.releaseMap();
		``` 
		*/
		releaseMap() : void;		
		/** !#en Sets the untransformed size of the _ccsg.TMXLayer.
		!#zh 设置未转换的 layer 大小。
		@param size The untransformed size of the _ccsg.TMXLayer or The untransformed size's width of the TMXLayer.
		@param height The untransformed size's height of the _ccsg.TMXLayer.
		
		@example 
		```js
		tiledLayer.setContentSize(100, 100);
		``` 
		*/
		setContentSize(size : Size|number, height? : number) : void;		
		/** !#en Return texture of cc.SpriteBatchNode.
		!#zh 获取纹理。
		
		@example 
		```js
		var texture = tiledLayer.getTexture();
		cc.log("Texture: " + texture);
		``` 
		*/
		getTexture() : Texture2D;		
		/** !#en Set the texture of cc.SpriteBatchNode.
		!#zh 设置纹理。
		
		@example 
		```js
		tiledLayer.setTexture(texture);
		``` 
		*/
		setTexture(texture : Texture2D) : void;		
		/** !#en Set the opacity of all tiles
		!#zh 设置所有 Tile 的透明度
		
		@example 
		```js
		tiledLayer.setTileOpacity(128);
		``` 
		*/
		setTileOpacity(opacity : number) : void;		
		/** !#en Gets layer size.
		!#zh 获得层大小。
		
		@example 
		```js
		var size = tiledLayer.getLayerSize();
		cc.log("layer size: " + size);
		``` 
		*/
		getLayerSize() : Size;		
		/** !#en Set layer size.
		!#zh 设置层大小。
		
		@example 
		```js
		tiledLayer.setLayerSize(new cc.size(5, 5));
		``` 
		*/
		setLayerSize(layerSize : Size) : void;		
		/** !#en Size of the map's tile (could be different from the tile's size).
		!#zh 获取 tile 的大小( tile 的大小可能会有所不同)。
		
		@example 
		```js
		var mapTileSize = tiledLayer.getMapTileSize();
		cc.log("MapTile size: " + mapTileSize);
		``` 
		*/
		getMapTileSize() : Size;		
		/** !#en Set the map tile size.
		!#zh 设置 tile 的大小。
		
		@example 
		```js
		tiledLayer.setMapTileSize(new cc.size(10, 10));
		``` 
		*/
		setMapTileSize(tileSize : Size) : void;		
		/** !#en Pointer to the map of tiles.
		!#zh 获取地图 tiles。
		
		@example 
		```js
		var tiles = tiledLayer.getTiles();
		``` 
		*/
		getTiles() : any[];		
		/** !#en Pointer to the map of tiles.
		!#zh 设置地图 tiles
		
		@example 
		```js
		tiledLayer.setTiles(tiles);
		``` 
		*/
		setTiles(tiles : any[]) : void;		
		/** !#en Tile set information for the layer.
		!#zh 获取 layer 的 Tileset 信息。
		
		@example 
		```js
		var tileset = tiledLayer.getTileSet();
		``` 
		*/
		getTileSet() : TMXTilesetInfo;		
		/** !#en Tile set information for the layer.
		!#zh 设置 layer 的 Tileset 信息。
		
		@example 
		```js
		tiledLayer.setTileSet(tileset);
		``` 
		*/
		setTileSet(tileset : TMXTilesetInfo) : void;		
		/** !#en Layer orientation, which is the same as the map orientation.
		!#zh 获取 Layer 方向(同地图方向)。
		
		@example 
		```js
		var orientation = tiledLayer.getLayerOrientation();
		cc.log("Layer Orientation: " + orientation);
		``` 
		*/
		getLayerOrientation() : number;		
		/** !#en Layer orientation, which is the same as the map orientation.
		!#zh 设置 Layer 方向(同地图方向)。
		
		@example 
		```js
		tiledLayer.setLayerOrientation(TiledMap.Orientation.ORTHO);
		``` 
		*/
		setLayerOrientation(orientation : TiledMap.Orientation) : void;		
		/** !#en properties from the layer. They can be added using Tiled.
		!#zh 获取 layer 的属性，可以使用 Tiled 编辑器添加属性。
		
		@example 
		```js
		var properties = tiledLayer.getProperties();
		cc.log("Properties: " + properties);
		``` 
		*/
		getProperties() : any[];		
		/** !#en properties from the layer. They can be added using Tiled.
		!#zh 设置层属性。
		
		@example 
		```js
		tiledLayer.setLayerOrientation(properties);
		``` 
		*/
		setProperties(properties : any[]) : void;	
	}		
		/** !#en Renders a TMX Tile Map in the scene.
		!#zh 在场景中渲染一个 tmx 格式的 Tile Map。 */
		export class TiledMap extends Component {		
		/** !#en The TiledMap Asset.
		!#zh TiledMap 资源。 */
		tmxAsset : TiledMapAsset;		
		/** !#en Gets the map size.
		!#zh 获取地图大小。
		
		@example 
		```js
		var mapSize = tiledMap.getMapSize();
		cc.log("Map Size: " + mapSize);
		``` 
		*/
		getMapSize() : Size;		
		/** !#en Set the map size.
		!#zh 设置地图大小。
		
		@example 
		```js
		tiledMap.setMapSize(new cc.size(960, 640));
		``` 
		*/
		setMapSize(mapSize : Size) : void;		
		/** !#en Gets the tile size.
		!#zh 获取地图背景中 tile 元素的大小。
		
		@example 
		```js
		var tileSize = tiledMap.getTileSize();
		cc.log("Tile Size: " + tileSize);
		``` 
		*/
		getTileSize() : Size;		
		/** !#en Set the tile size.
		!#zh 设置地图背景中 tile 元素的大小。
		
		@example 
		```js
		tiledMap.setTileSize(new cc.size(10, 10));
		``` 
		*/
		setTileSize(tileSize : Size) : void;		
		/** !#en map orientation.
		!#zh 获取地图方向。
		
		@example 
		```js
		var mapOrientation = tiledMap.getMapOrientation();
		cc.log("Map Orientation: " + mapOrientation);
		``` 
		*/
		getMapOrientation() : number;		
		/** !#en map orientation.
		!#zh 设置地图方向。
		
		@example 
		```js
		tiledMap.setMapOrientation(TiledMap.Orientation.ORTHO);
		``` 
		*/
		setMapOrientation(orientation : TiledMap.Orientation) : void;		
		/** !#en object groups.
		!#zh 获取所有的对象层。
		
		@example 
		```js
		var objGroups = titledMap.getObjectGroups();
		for (var i = 0; i < objGroups.length; ++i) {
		    cc.log("obj: " + objGroups[i]);
		}
		``` 
		*/
		getObjectGroups() : TiledObjectGroup[];		
		/** !#en Gets the map properties.
		!#zh 获取地图的属性。
		
		@example 
		```js
		var properties = titledMap.getProperties();
		for (var i = 0; i < properties.length; ++i) {
		    cc.log("Properties: " + properties[i]);
		}
		``` 
		*/
		getProperties() : any[];		
		/** !#en Set the map properties.
		!#zh 设置地图的属性。
		
		@example 
		```js
		titledMap.setProperties(properties);
		``` 
		*/
		setProperties(properties : any[]) : void;		
		/** !#en Return All layers array.
		!#zh 返回包含所有 layer 的数组。
		
		@example 
		```js
		var layers = titledMap.allLayers();
		for (var i = 0; i < layers.length; ++i) {
		    cc.log("Layers: " + layers[i]);
		}
		``` 
		*/
		allLayers() : TiledLayer[];		
		/** !#en return the cc.TiledLayer for the specific layer.
		!#zh 获取指定名称的 layer。
		
		@example 
		```js
		var layer = titledMap.getLayer("Player");
		cc.log(layer);
		``` 
		*/
		getLayer(layerName : string) : TiledLayer;		
		/** !#en Return the TMXObjectGroup for the specific group.
		!#zh 获取指定的 TMXObjectGroup。
		
		@example 
		```js
		var group = titledMap.getObjectGroup("Players");
		cc.log("ObjectGroup: " + group);
		``` 
		*/
		getObjectGroup(groupName : string) : TiledObjectGroup;		
		/** !#en Return the value for the specific property name.
		!#zh 通过属性名称，获取指定的属性。
		
		@example 
		```js
		var property = titledMap.getProperty("info");
		cc.log("Property: " + property);
		``` 
		*/
		getProperty(propertyName : string) : string;		
		/** !#en Return properties dictionary for tile GID.
		!#zh 通过 GID ，获取指定的属性。
		
		@example 
		```js
		var properties = titledMap.getPropertiesForGID(GID);
		cc.log("Properties: " + properties);
		``` 
		*/
		getPropertiesForGID(GID : number) : any;	
	}		
		/** Class for tiled map asset handling. */
		export class TiledMapAsset extends Asset {	
	}		
		/** !#en Renders the TMX object group.
		!#zh 渲染 tmx object group。 */
		export class TiledObjectGroup extends _SGComponent {		
		/** !#en Offset position of child objects.
		!#zh 获取子对象的偏移位置。
		
		@example 
		```js
		var offset = tMXObjectGroup.getPositionOffset();
		``` 
		*/
		getPositionOffset() : Vec2;		
		/** !#en Offset position of child objects.
		!#zh 设置子对象的偏移位置。
		
		@example 
		```js
		tMXObjectGroup.setPositionOffset(cc.v2(5, 5));
		``` 
		*/
		setPositionOffset(offset : Vec2) : void;		
		/** !#en List of properties stored in a dictionary.
		!#zh 以映射的形式获取属性列表。
		
		@example 
		```js
		var offset = tMXObjectGroup.getProperties();
		``` 
		*/
		getProperties() : any;		
		/** !#en Set the properties of the object group.
		!#zh 设置属性列表。
		
		@example 
		```js
		tMXObjectGroup.setProperties(obj);
		``` 
		*/
		setProperties(Var : any) : void;		
		/** !#en Gets the Group name.
		!#zh 获取组名称。
		
		@example 
		```js
		var groupName = tMXObjectGroup.getGroupName;
		``` 
		*/
		getGroupName() : string;		
		/** !#en Set the Group name.
		!#zh 设置组名称。
		
		@example 
		```js
		tMXObjectGroup.setGroupName("New Group");
		``` 
		*/
		setGroupName(groupName : string) : void;		
		/** !#en
		Return the object for the specific object name. <br />
		It will return the 1st object found on the array for the given name.
		!#zh 获取指定的对象。
		
		@example 
		```js
		var object = tMXObjectGroup.getObject("Group");
		``` 
		*/
		getObject(objectName : string) : any;		
		/** !#en Gets the objects.
		!#zh 获取对象数组。
		
		@example 
		```js
		var objects = tMXObjectGroup.getObjects();
		``` 
		*/
		getObjects() : any[];	
	}		
		/** !#en
		 cc.NodePool is the cache pool designed for node type.<br/>
		 It can helps you to improve your game performance for objects which need frequent release and recreate operations<br/>
		
		It's recommended to create cc.NodePool instances by node type, the type corresponds to node type in game design, not the class,
		for example, a prefab is a specific node type. <br/>
		When you create a node pool, you can pass a Component which contains `unuse`, `reuse` functions to control the content of node.<br/>
		
		Some common use case is :<br/>
		     1. Bullets in game (die very soon, massive creation and recreation, no side effect on other objects)<br/>
		     2. Blocks in candy crash (massive creation and recreation)<br/>
		     etc...
		!#zh
		cc.NodePool 是用于管理节点对象的对象缓存池。<br/>
		它可以帮助您提高游戏性能，适用于优化对象的反复创建和销毁<br/>
		以前 cocos2d-x 中的 cc.pool 和新的节点事件注册系统不兼容，因此请使用 cc.NodePool 来代替。
		
		新的 NodePool 需要实例化之后才能使用，每种不同的节点对象池需要一个不同的对象池实例，这里的种类对应于游戏中的节点设计，一个 prefab 相当于一个种类的节点。<br/>
		在创建缓冲池时，可以传入一个包含 unuse, reuse 函数的组件类型用于节点的回收和复用逻辑。<br/>
		
		一些常见的用例是：<br/>
		     1.在游戏中的子弹（死亡很快，频繁创建，对其他对象无副作用）<br/>
		     2.糖果粉碎传奇中的木块（频繁创建）。
		     等等.... */
		export class NodePool {		
		/** !#en
		Constructor for creating a pool for a specific node template (usually a prefab). You can pass a component (type or name) argument for handling event for reusing and recycling node.
		!#zh
		使用构造函数来创建一个节点专用的对象池，您可以传递一个组件类型或名称，用于处理节点回收和复用时的事件逻辑。
		@param poolHandlerComp !#en The constructor or the class name of the component to control the unuse/reuse logic. !#zh 处理节点回收和复用事件逻辑的组件类型或名称。
		
		@example 
		```js
		properties: {
		   template: cc.Prefab
		 },
		 onLoad () {
		// MyTemplateHandler is a component with 'unuse' and 'reuse' to handle events when node is reused or recycled.
		   this.myPool = new cc.NodePool('MyTemplateHandler');
		 }
		``` 
		*/
		NodePool(poolHandlerComp : [Function|String]) : void;		
		/** !#en The pool handler component, it could be the class name or the constructor.
		!#zh 缓冲池处理组件，用于节点的回收和复用逻辑，这个属性可以是组件类名或组件的构造函数。 */
		poolHandlerComp : Function|string;		
		/** !#en The current available size in the pool
		!#zh 获取当前缓冲池的可用对象数量 
		*/
		size() : void;		
		/** !#en Destroy all cached nodes in the pool
		!#zh 销毁对象池中缓存的所有节点 
		*/
		clear() : void;		
		/** !#en Put a new Node into the pool.
		It will automatically remove the node from its parent without cleanup.
		It will also invoke unuse method of the poolHandlerComp if exist.
		!#zh 向缓冲池中存入一个不再需要的节点对象。
		这个函数会自动将目标节点从父节点上移除，但是不会进行 cleanup 操作。
		这个函数会调用 poolHandlerComp 的 unuse 函数，如果组件和函数都存在的话。
		
		@example 
		```js
		let myNode = cc.instantiate(this.template);
		  this.myPool.put(myNode);
		``` 
		*/
		put() : void;		
		/** !#en Get a obj from pool, if no available object in pool, null will be returned.
		This function will invoke the reuse function of poolHandlerComp if exist.
		!#zh 获取对象池中的对象，如果对象池没有可用对象，则返回空。
		这个函数会调用 poolHandlerComp 的 reuse 函数，如果组件和函数都存在的话。
		@param params !#en Params to pass to 'reuse' method in poolHandlerComp !#zh 向 poolHandlerComp 中的 'reuse' 函数传递的参数
		
		@example 
		```js
		let newNode = this.myPool.get();
		``` 
		*/
		get(params : any) : any;	
	}		
		/** !#en
		 Attention: In creator, it's strongly not recommended to use cc.pool to manager cc.Node.
		 We provided {{#crossLink "NodePool"}}cc.NodePool{{/crossLink}} instead.
		
		 cc.pool is a singleton object serves as an object cache pool.<br/>
		 It can helps you to improve your game performance for objects which need frequent release and recreate operations<br/>
		!#zh
		首先请注意，在 Creator 中我们强烈不建议使用 cc.pool 来管理 cc.Node 节点对象，请使用 {{#crossLink "NodePool"}}cc.NodePool{{/crossLink}} 代替
		因为 cc.pool 是面向类来设计的，而 cc.Node 中使用 Component 来进行组合，它的类永远都一样，实际却千差万别。
		
		cc.pool 是一个单例对象，用作为对象缓存池。<br/>
		它可以帮助您提高游戏性能，适用于优化对象的反复创建和销毁<br/> */
		export class pool {		
		/** !#en Put the obj in pool.
		!#zh 加入对象到对象池中。
		@param obj The need put in pool object.
		
		@example 
		```js
		---------------------------------
		var sp = new _ccsg.Sprite("a.png");
		this.addChild(sp);
		cc.pool.putInPool(sp);
		cc.pool.getFromPool(_ccsg.Sprite, "a.png");
		
		``` 
		*/
		putInPool(obj : any) : void;		
		/** !#en Check if this kind of obj has already in pool.
		!#zh 检查对象池中是否有指定对象的存在。
		@param objClass The check object class. 
		*/
		hasObject(objClass : any) : boolean;		
		/** !#en Remove the obj if you want to delete it.
		!#zh 移除在对象池中指定的对象。 
		*/
		removeObject() : void;		
		/** !#en Get the obj from pool.
		!#zh 获取对象池中的指定对象。 
		*/
		getFromPool() : any;		
		/** !#en Remove all objs in pool and reset the pool.
		!#zh 移除对象池中的所有对象，并且重置对象池。 
		*/
		drainAllPools() : void;	
	}		
		/** !#en Box Collider.
		!#zh 包围盒碰撞组件 */
		export class BoxCollider extends Component {		
		/** !#en Position offset
		!#zh 位置偏移量 */
		offset : Vec2;		
		/** !#en Box size
		!#zh 包围盒大小 */
		size : Size;	
	}		
		/** !#en Circle Collider.
		!#zh 圆形碰撞组件 */
		export class CircleCollider extends Component {		
		/** !#en Position offset
		!#zh 位置偏移量 */
		offset : Vec2;		
		/** !#en Circle radius
		!#zh 圆形半径 */
		radius : number;	
	}		
		/** !#en Collider component base class.
		!#zh 碰撞组件基类 */
		export class Collider extends Component {		
		/** !#en Tag. If a node has several collider components, you can judge which type of collider is collided according to the tag.
		!#zh 标签。当一个节点上有多个碰撞组件时，在发生碰撞后，可以使用此标签来判断是节点上的哪个碰撞组件被碰撞了。 */
		tag : Integer;	
	}		
		/** !#en
		A simple collision manager class.
		It will calculate whether the collider collides other colliders, if collides then call the callbacks.
		!#zh
		一个简单的碰撞组件管理类，用于处理节点之间的碰撞组件是否产生了碰撞，并调用相应回调函数。 */
		export class CollisionManager {		
		/** !#en
		!#zh
		是否开启碰撞管理，默认为不开启 */
		enabled : boolean;		
		/** !#en
		!#zh
		是否绘制碰撞组件的包围盒，默认为不绘制 */
		enabledDrawBoundingBox : boolean;		
		/** !#en
		!#zh
		是否绘制碰撞组件的形状，默认为不绘制 */
		enabledDebugDraw : boolean;	
	}		
		/** !#en Intersection helper class
		!#zh 辅助类，用于测试形状与形状是否相交 */
		export class Intersection {		
		/** !#en Test line and line
		!#zh 测试线段与线段是否相交
		@param a1 The start point of the first line
		@param a2 The end point of the first line
		@param b1 The start point of the second line
		@param b2 The end point of the second line 
		*/
		lineLine(a1 : Vec2, a2 : Vec2, b1 : Vec2, b2 : Vec2) : boolean;		
		/** !#en Test line and rect
		!#zh 测试线段与矩形是否相交
		@param a1 The start point of the line
		@param a2 The end point of the line
		@param b The rect 
		*/
		lineRect(a1 : Vec2, a2 : Vec2, b : Rect) : boolean;		
		/** !#en Test line and polygon
		!#zh 测试线段与多边形是否相交
		@param a1 The start point of the line
		@param a2 The end point of the line
		@param b The polygon, a set of points 
		*/
		linePolygon(a1 : Vec2, a2 : Vec2, b : [Vec2]) : boolean;		
		/** !#en Test rect and rect
		!#zh 测试矩形与矩形是否相交
		@param a The first rect
		@param b The second rect 
		*/
		rectRect(a : Rect, b : Rect) : boolean;		
		/** !#en Test rect and polygon
		!#zh 测试矩形与多边形是否相交
		@param a The rect
		@param b The polygon, a set of points 
		*/
		rectPolygon(a : Rect, b : [Vec2]) : boolean;		
		/** !#en Test polygon and polygon
		!#zh 测试多边形与多边形是否相交
		@param a The first polygon, a set of points
		@param b The second polygon, a set of points 
		*/
		polygonPolygon(a : [Vec2], b : [Vec2]) : boolean;		
		/** !#en Test circle and circle
		!#zh 测试圆形与圆形是否相交
		@param a Object contains position and radius
		@param b Object contains position and radius 
		*/
		circleCircle(a : any, b : any) : boolean;		
		/** !#en Test polygon and circle
		!#zh 测试矩形与圆形是否相交
		@param polygon The Polygon, a set of points
		@param circle Object contains position and radius 
		*/
		polygonCircle(polygon : [Vec2], circle : any) : boolean;		
		/** !#en Test whether the point is in the polygon
		!#zh 测试一个点是否在一个多边形中
		@param point The point
		@param polygon The polygon, a set of points 
		*/
		pointInPolygon(point : Vec2, polygon : [Vec2]) : boolean;		
		/** !#en Calculate the distance of point to line.
		!#zh 计算点到直线的距离。如果这是一条线段并且垂足不在线段内，则会计算点到线段端点的距离。
		@param point The point
		@param start The start point of line
		@param end The end point of line
		@param isSegment whether this line is a segment 
		*/
		pointLineDistance(point : Vec2, start : Vec2, end : Vec2, isSegment : boolean) : boolean;	
	}		
		/** !#en Polygon Collider.
		!#zh 多边形碰撞组件 */
		export class PolygonCollider extends Component {		
		/** !#en Position offset
		!#zh 位置偏移量 */
		offset : Vec2;		
		/** !#en Polygon points
		!#zh 多边形顶点数组 */
		points : [Vec2];	
	}		
		/** !#en
		EventTarget is an object to which an event is dispatched when something has occurred.
		Entity are the most common event targets, but other objects can be event targets too.
		
		Event targets are an important part of the Fireball event model.
		The event target serves as the focal point for how events flow through the scene graph.
		When an event such as a mouse click or a keypress occurs, Fireball dispatches an event object
		into the event flow from the root of the hierarchy. The event object then makes its way through
		the scene graph until it reaches the event target, at which point it begins its return trip through
		the scene graph. This round-trip journey to the event target is conceptually divided into three phases:
		- The capture phase comprises the journey from the root to the last node before the event target's node
		- The target phase comprises only the event target node
		- The bubbling phase comprises any subsequent nodes encountered on the return trip to the root of the tree
		See also: http://www.w3.org/TR/DOM-Level-3-Events/#event-flow
		
		Event targets can implement the following methods:
		 - _getCapturingTargets
		 - _getBubblingTargets
		
		!#zh
		事件目标是事件触发时，分派的事件对象，Node 是最常见的事件目标，
		但是其他对象也可以是事件目标。<br/> */
		export class EventTarget {		
		/** !#en
		Register an callback of a specific event type on the EventTarget.
		!#zh
		注册事件目标的特定事件类型回调。
		@param type A string representing the event type to listen for.
		@param callback The callback that will be invoked when the event is dispatched.
		                             The callback is ignored if it is a duplicate (the callbacks are unique).
		@param target The target to invoke the callback, can be null
		@param useCapture When set to true, the capture argument prevents callback
		                             from being invoked when the event's eventPhase attribute value is BUBBLING_PHASE.
		                             When false, callback will NOT be invoked when event's eventPhase attribute value is CAPTURING_PHASE.
		                             Either way, callback will be invoked when event's eventPhase attribute value is AT_TARGET.
		
		@example 
		```js
		node.on(cc.Node.EventType.TOUCH_END, function (event) {
		    cc.log("this is callback");
		}, node);
		``` 
		*/
		on(type : string, callback: (param: Event) => void, target : any, useCapture : boolean) : Function;		
		/** !#en
		Removes the callback previously registered with the same type, callback, target and or useCapture.
		!#zh
		删除之前与同类型，回调，目标或 useCapture 注册的回调。
		@param type A string representing the event type being removed.
		@param callback The callback to remove.
		@param target The target to invoke the callback, if it's not given, only callback without target will be removed
		@param useCapture Specifies whether the callback being removed was registered as a capturing callback or not.
		                             If not specified, useCapture defaults to false. If a callback was registered twice,
		                             one with capture and one without, each must be removed separately. Removal of a capturing callback
		                             does not affect a non-capturing version of the same listener, and vice versa.
		
		@example 
		```js
		// register touchEnd eventListener
		var touchEnd = node.on(cc.Node.EventType.TOUCH_END, function (event) {
		    cc.log("this is callback");
		}, node);
		// remove touchEnd eventListener
		node.off(cc.Node.EventType.TOUCH_END, touchEnd, node);
		``` 
		*/
		off(type : string, callback : Function, target : any, useCapture : boolean) : void;		
		/** !#en Removes all callbacks previously registered with the same target (passed as parameter).
		This is not for removing all listeners in the current event target,
		and this is not for removing all listeners the target parameter have registered.
		It's only for removing all listeners (callback and target couple) registered on the current event target by the target parameter.
		!#zh 在当前 EventTarget 上删除指定目标（target 参数）注册的所有事件监听器。
		这个函数无法删除当前 EventTarget 的所有事件监听器，也无法删除 target 参数所注册的所有事件监听器。
		这个函数只能删除 target 参数在当前 EventTarget 上注册的所有事件监听器。
		@param target The target to be searched for all related listeners 
		*/
		targetOff(target : any) : void;		
		/** !#en
		Register an callback of a specific event type on the EventTarget,
		the callback will remove itself after the first time it is triggered.
		!#zh
		注册事件目标的特定事件类型回调，回调会在第一时间被触发后删除自身。
		@param type A string representing the event type to listen for.
		@param callback The callback that will be invoked when the event is dispatched.
		                             The callback is ignored if it is a duplicate (the callbacks are unique).
		@param target The target to invoke the callback, can be null
		@param useCapture When set to true, the capture argument prevents callback
		                             from being invoked when the event's eventPhase attribute value is BUBBLING_PHASE.
		                             When false, callback will NOT be invoked when event's eventPhase attribute value is CAPTURING_PHASE.
		                             Either way, callback will be invoked when event's eventPhase attribute value is AT_TARGET.
		
		@example 
		```js
		node.once(cc.Node.EventType.TOUCH_END, function (event) {
		    cc.log("this is callback");
		}, node);
		``` 
		*/
		once(type : string, callback: (param: Event) => void, target : any, useCapture : boolean) : void;		
		/** !#en
		Dispatches an event into the event flow.
		The event target is the EventTarget object upon which the dispatchEvent() method is called.
		!#zh 分发事件到事件流中。
		@param event The Event object that is dispatched into the event flow 
		*/
		dispatchEvent(event : Event) : void;		
		/** !#en
		Send an event to this object directly, this method will not propagate the event to any other objects.
		The event will be created from the supplied message, you can get the "detail" argument from event.detail.
		!#zh
		该对象直接发送事件， 这种方法不会对事件传播到任何其他对象。
		@param message the message to send
		@param detail whatever argument the message needs 
		*/
		emit(message : string, detail? : any) : void;	
	}		
		/** !#en Base class of all kinds of events.
		!#zh 包含事件相关信息的对象。 */
		export class Event {		
		/** 
		@param type The name of the event (case-sensitive), e.g. "click", "fire", or "submit"
		@param bubbles A boolean indicating whether the event bubbles up through the tree or not 
		*/
		Event(type : string, bubbles : boolean) : Event;		
		/** !#en The name of the event (case-sensitive), e.g. "click", "fire", or "submit".
		!#zh 事件类型。 */
		type : string;		
		/** !#en Indicate whether the event bubbles up through the tree or not.
		!#zh 表示该事件是否进行冒泡。 */
		bubbles : boolean;		
		/** !#en A reference to the target to which the event was originally dispatched.
		!#zh 最初事件触发的目标 */
		target : any;		
		/** !#en A reference to the currently registered target for the event.
		!#zh 当前目标 */
		currentTarget : any;		
		/** !#en
		Indicates which phase of the event flow is currently being evaluated.
		Returns an integer value represented by 4 constants:
		 - Event.NONE = 0
		 - Event.CAPTURING_PHASE = 1
		 - Event.AT_TARGET = 2
		 - Event.BUBBLING_PHASE = 3
		The phases are explained in the [section 3.1, Event dispatch and DOM event flow]
		(http://www.w3.org/TR/DOM-Level-3-Events/#event-flow), of the DOM Level 3 Events specification.
		!#zh 事件阶段 */
		eventPhase : number;		
		/** !#en Reset the event for being stored in the object pool.
		!#zh 重置对象池中存储的事件。 
		*/
		unuse() : string;		
		/** !#en Reuse the event for being used again by the object pool.
		!#zh 用于对象池再次使用的事件。 
		*/
		reuse() : string;		
		/** !#en Stops propagation for current event.
		!#zh 停止传递当前事件。 
		*/
		stopPropagation() : void;		
		/** !#en Stops propagation for current event immediately,
		the event won't even be dispatched to the listeners attached in the current target.
		!#zh 立即停止当前事件的传递，事件甚至不会被分派到所连接的当前目标。 
		*/
		stopPropagationImmediate() : void;		
		/** !#en Checks whether the event has been stopped.
		!#zh 检查该事件是否已经停止传递. 
		*/
		isStopped() : boolean;		
		/** !#en
		<p>
		    Gets current target of the event                                                            <br/>
		    note: It only be available when the event listener is associated with node.                <br/>
		         It returns 0 when the listener is associated with fixed priority.
		</p>
		!#zh 获取当前目标节点 
		*/
		getCurrentTarget() : Node;		
		/** !#en Gets the event type.
		!#zh 获取事件类型 
		*/
		getType() : string;		
		/** !#en Code for event without type.
		!#zh 没有类型的事件 */
		NO_TYPE : string;		
		/** !#en Events not currently dispatched are in this phase
		!#zh 尚未派发事件阶段 */
		NONE : number;		
		/** !#en
		The capturing phase comprises the journey from the root to the last node before the event target's node
		see http://www.w3.org/TR/DOM-Level-3-Events/#event-flow
		!#zh 捕获阶段，包括事件目标节点之前从根节点到最后一个节点的过程。 */
		CAPTURING_PHASE : number;		
		/** !#en
		The target phase comprises only the event target node
		see http://www.w3.org/TR/DOM-Level-3-Events/#event-flow
		!#zh 目标阶段仅包括事件目标节点。 */
		AT_TARGET : number;		
		/** !#en
		The bubbling phase comprises any subsequent nodes encountered on the return trip to the root of the hierarchy
		see http://www.w3.org/TR/DOM-Level-3-Events/#event-flow
		!#zh 冒泡阶段， 包括回程遇到到层次根节点的任何后续节点。 */
		BUBBLING_PHASE : number;	
	}		
		/** !#en The animation component is used to play back animations.
		
		Animation provide several events to register：
		 - play : Emit when begin playing animation
		 - stop : Emit when stop playing animation
		 - pause : Emit when pause animation
		 - resume : Emit when resume animation
		 - lastframe : If animation repeat count is larger than 1, emit when animation play to the last frame
		 - finished : Emit when finish playing animation
		
		!#zh Animation 组件用于播放动画。
		
		Animation 提供了一系列可注册的事件：
		 - play : 开始播放时
		 - stop : 停止播放时
		 - pause : 暂停播放时
		 - resume : 恢复播放时
		 - lastframe : 假如动画循环次数大于 1，当动画播放到最后一帧时
		 - finished : 动画播放完成时 */
		export class Animation extends CCComponent {		
		/** !#en Animation will play the default clip when start game.
		!#zh 在勾选自动播放或调用 play() 时默认播放的动画剪辑。 */
		defaultClip : AnimationClip;		
		/** !#en Current played clip.
		!#zh 当前播放的动画剪辑。 */
		currentClip : AnimationClip;		
		/** !#en Whether the animation should auto play the default clip when start game.
		!#zh 是否在运行游戏后自动播放默认动画剪辑。 */
		playOnLoad : boolean;		
		/** !#en Get all the clips used in this animation.
		!#zh 获取动画组件上的所有动画剪辑。 
		*/
		getClips() : AnimationClip[];		
		/** !#en Plays an animation and stop other animations.
		!#zh 播放指定的动画，并且停止当前正在播放动画。如果没有指定动画，则播放默认动画。
		@param name The name of animation to play. If no name is supplied then the default animation will be played.
		@param startTime play an animation from startTime
		
		@example 
		```js
		var animCtrl = this.node.getComponent(cc.Animation);
		animCtrl.play("linear");
		``` 
		*/
		play(name? : string, startTime? : number) : AnimationState;		
		/** !#en
		Plays an additive animation, it will not stop other animations.
		If there are other animations playing, then will play several animations at the same time.
		!#zh 播放指定的动画（将不会停止当前播放的动画）。如果没有指定动画，则播放默认动画。
		@param name The name of animation to play. If no name is supplied then the default animation will be played.
		@param startTime play an animation from startTime
		
		@example 
		```js
		// linear_1 and linear_2 at the same time playing.
		var animCtrl = this.node.getComponent(cc.Animation);
		animCtrl.playAdditive("linear_1");
		animCtrl.playAdditive("linear_2");
		``` 
		*/
		playAdditive(name? : string, startTime? : number) : AnimationState;		
		/** !#en Stops an animation named name. If no name is supplied then stops all playing animations that were started with this Animation. <br/>
		Stopping an animation also Rewinds it to the Start.
		!#zh 停止指定的动画。如果没有指定名字，则停止当前正在播放的动画。
		@param name The animation to stop, if not supplied then stops all playing animations. 
		*/
		stop(name? : string) : void;		
		/** !#en Pauses an animation named name. If no name is supplied then pauses all playing animations that were started with this Animation.
		!#zh 暂停当前或者指定的动画。如果没有指定名字，则暂停当前正在播放的动画。
		@param name The animation to pauses, if not supplied then pauses all playing animations. 
		*/
		pause(name? : string) : void;		
		/** !#en Resumes an animation named name. If no name is supplied then resumes all paused animations that were started with this Animation.
		!#zh 重新播放指定的动画，如果没有指定名字，则重新播放当前正在播放的动画。
		@param name The animation to resumes, if not supplied then resumes all paused animations. 
		*/
		resume(name? : string) : void;		
		/** !#en Make an animation named name go to the specified time. If no name is supplied then make all animations go to the specified time.
		!#zh 设置指定动画的播放时间。如果没有指定名字，则设置当前播放动画的播放时间。
		@param time The time to go to
		@param name Specified animation name, if not supplied then make all animations go to the time. 
		*/
		setCurrentTime(time? : number, name? : string) : void;		
		/** !#en Returns the animation state named name. If no animation with the specified name, the function will return null.
		!#zh 获取当前或者指定的动画状态，如果未找到指定动画剪辑则返回 null。 
		*/
		getAnimationState(name : string) : AnimationState;		
		/** !#en Adds a clip to the animation with name newName. If a clip with that name already exists it will be replaced with the new clip.
		!#zh 添加动画剪辑，并且可以重新设置该动画剪辑的名称。
		@param clip the clip to add 
		*/
		addClip(clip : AnimationClip, newName? : string) : AnimationState;		
		/** !#en
		Remove clip from the animation list. This will remove the clip and any animation states based on it.
		If there are animation states depand on the clip are playing or clip is defaultClip, it will not delete the clip.
		But if force is true, then will always remove the clip and any animation states based on it. If clip is defaultClip, defaultClip will be reset to null
		!#zh
		从动画列表中移除指定的动画剪辑，<br/>
		如果依赖于 clip 的 AnimationState 正在播放或者 clip 是 defaultClip 的话，默认是不会删除 clip 的。
		但是如果 force 参数为 true，则会强制停止该动画，然后移除该动画剪辑和相关的动画。这时候如果 clip 是 defaultClip，defaultClip 将会被重置为 null。
		@param force If force is true, then will always remove the clip and any animation states based on it. 
		*/
		removeClip(clip : AnimationClip, force : boolean) : void;		
		/** !#en
		Samples animations at the current state.<br/>
		This is useful when you explicitly want to set up some animation state, and sample it once.
		!#zh 对指定或当前动画进行采样。你可以手动将动画设置到某一个状态，然后采样一次。 
		*/
		sample(name : string) : void;		
		/** !#en
		Register animation event callback.
		The event arguments will provide the AnimationState which emit the event.
		When play an animation, will auto register the event callback to the AnimationState, and unregister the event callback from the AnimationState when animation stopped.
		!#zh
		注册动画事件回调。
		回调的事件里将会附上发送事件的 AnimationState。
		当播放一个动画时，会自动将事件注册到对应的 AnimationState 上，停止播放时会将事件从这个 AnimationState 上取消注册。
		@param type A string representing the event type to listen for.
		@param callback The callback that will be invoked when the event is dispatched.
		                             The callback is ignored if it is a duplicate (the callbacks are unique).
		@param target The target to invoke the callback, can be null
		@param useCapture When set to true, the capture argument prevents callback
		                             from being invoked when the event's eventPhase attribute value is BUBBLING_PHASE.
		                             When false, callback will NOT be invoked when event's eventPhase attribute value is CAPTURING_PHASE.
		                             Either way, callback will be invoked when event's eventPhase attribute value is AT_TARGET.
		
		@example 
		```js
		onPlay: function (event) {
		    var state = event.detail;    // state instanceof cc.AnimationState
		    var type = event.type;       // type === 'play';
		}
		
		// register event to all animation
		animation.on('', 'play',      this.onPlay,        this);
		``` 
		*/
		on(type : string, callback: (param: Event) => void, target : any, useCapture : boolean) : void;		
		/** !#en
		Unregister animation event callback.
		!#zh
		取消注册动画事件回调。
		@param type A string representing the event type being removed.
		@param callback The callback to remove.
		@param target The target to invoke the callback, if it's not given, only callback without target will be removed
		@param useCapture Specifies whether the callback being removed was registered as a capturing callback or not.
		                             If not specified, useCapture defaults to false. If a callback was registered twice,
		                             one with capture and one without, each must be removed separately. Removal of a capturing callback
		                             does not affect a non-capturing version of the same listener, and vice versa.
		
		@example 
		```js
		// unregister event to all animation
		animation.off('', 'play',      this.onPlay,        this);
		``` 
		*/
		off(type : string, callback : Function, target : any, useCapture : boolean) : void;	
	}		
		/** !#en Audio Source.
		!#zh 音频源组件，能对音频剪辑。 */
		export class AudioSource extends Component {		
		/** !#en
		Is the audio source playing (Read Only). <br/>
		Note: isPlaying is not supported for Native platforms.
		!#zh
		该音频剪辑是否正播放（只读）。<br/>
		注意：Native 平台暂时不支持 isPlaying。 */
		isPlaying : boolean;		
		/** !#en The clip of the audio source.
		!#zh 默认要播放的音频剪辑。 */
		clip : AudioClip;		
		/** !#en The volume of the audio source.
		!#zh 音频源的音量（0.0 ~ 1.0）。 */
		volume : number;		
		/** !#en Is the audio source mute?
		!#zh 是否静音音频源。Mute 是设置音量为 0，取消静音是恢复原来的音量。 */
		mute : boolean;		
		/** !#en Is the audio source looping?
		!#zh 音频源是否循环播放？ */
		loop : boolean;		
		/** !#en If set to true, the audio source will automatically start playing on onLoad.
		!#zh 如果设置为true，音频源将在 onLoad 时自动播放。 */
		playOnLoad : boolean;		
		/** !#en Plays the clip.
		!#zh 播放音频剪辑。 
		*/
		play() : void;		
		/** !#en Stops the clip.
		!#zh 停止当前音频剪辑。 
		*/
		stop() : void;		
		/** !#en Pause the clip.
		!#zh 暂停当前音频剪辑。 
		*/
		pause() : void;		
		/** !#en Resume the clip.
		!#zh 恢复播放。 
		*/
		resume() : void;		
		/** !#en Rewind playing music.
		!#zh 从头开始播放。 
		*/
		rewind() : void;		
		/** !#en Get current time
		!#zh 获取当前的播放时间 
		*/
		getCurrentTime() : void;		
		/** !#en Set current time
		!#zh 设置当前的播放时间 
		*/
		setCurrentTime(time : number) : void;		
		/** !#en Get audio duration
		!#zh 获取当前音频的长度 
		*/
		getDuration() : void;	
	}		
		/** !#en
		Button has 4 Transition types
		When Button state changed:
		 If Transition type is Button.Transition.NONE, Button will do nothing
		 If Transition type is Button.Transition.COLOR, Button will change target's color
		 If Transition type is Button.Transition.SPRITE, Button will change target Sprite's sprite
		 If Transition type is Button.Transition.SCALE, Button will change target node's scale
		
		Button will trigger 5 events:
		 Button.EVENT_TOUCH_DOWN
		 Button.EVENT_TOUCH_UP
		 Button.EVENT_HOVER_IN
		 Button.EVENT_HOVER_MOVE
		 Button.EVENT_HOVER_OUT
		
		!#zh
		按钮组件。可以被按下,或者点击。</br>
		
		按钮可以通过修改 Transition 来设置按钮状态过渡的方式：</br>
		  -Button.Transition.NONE   // 不做任何过渡</br>
		  -Button.Transition.COLOR  // 进行颜色之间过渡</br>
		  -Button.Transition.SPRITE // 进行精灵之间过渡</br>
		  -Button.Transition.SCALE // 进行缩放过渡</br>
		
		按钮可以绑定事件（但是必须要在按钮的 Node 上才能绑定事件）：</br>
		  // 以下事件可以在全平台上都触发</br>
		  -cc.Node.EventType.TOUCH_START  // 按下时事件</br>
		  -cc.Node.EventType.TOUCH_Move   // 按住移动后事件</br>
		  -cc.Node.EventType.TOUCH_END    // 按下后松开后事件</br>
		  -cc.Node.EventType.TOUCH_CANCEL // 按下取消事件</br>
		  // 以下事件只在 PC 平台上触发</br>
		  -cc.Node.EventType.MOUSE_DOWN  // 鼠标按下时事件</br>
		  -cc.Node.EventType.MOUSE_MOVE  // 鼠标按住移动后事件</br>
		  -cc.Node.EventType.MOUSE_ENTER // 鼠标进入目标事件</br>
		  -cc.Node.EventType.MOUSE_LEAVE // 鼠标离开目标事件</br>
		  -cc.Node.EventType.MOUSE_UP    // 鼠标松开事件</br>
		  -cc.Node.EventType.MOUSE_WHEEL // 鼠标滚轮事件</br> */
		export class Button extends Component {		
		/** !#en
		Whether the Button is disabled.
		If true, the Button will trigger event and do transition.
		!#zh
		按钮事件是否被响应，如果为 false，则按钮将被禁用。 */
		interactable : boolean;		
		/** !#en When this flag is true, Button target sprite will turn gray when interactable is false.
		!#zh 如果这个标记为 true，当 button 的 interactable 属性为 false 的时候，会使用内置 shader 让 button 的 target 节点的 sprite 组件变灰 */
		enableAutoGrayEffect : boolean;		
		/** !#en Transition type
		!#zh 按钮状态改变时过渡方式。 */
		transition : Button.Transition;		
		/** !#en Normal state color.
		!#zh 普通状态下按钮所显示的颜色。 */
		normalColor : Color;		
		/** !#en Pressed state color
		!#zh 按下状态时按钮所显示的颜色。 */
		pressedColor : Color;		
		/** !#en Hover state color
		!#zh 悬停状态下按钮所显示的颜色。 */
		hoverColor : Color;		
		/** !#en Disabled state color
		!#zh 禁用状态下按钮所显示的颜色。 */
		disabledColor : Color;		
		/** !#en Color and Scale transition duration
		!#zh 颜色过渡和缩放过渡时所需时间 */
		duration : number;		
		/** !#en  When user press the button, the button will zoom to a scale.
		The final scale of the button  equals (button original scale * zoomScale)
		!#zh 当用户点击按钮后，按钮会缩放到一个值，这个值等于 Button 原始 scale * zoomScale */
		zoomScale : number;		
		/** !#en Normal state sprite
		!#zh 普通状态下按钮所显示的 Sprite 。 */
		normalSprite : SpriteFrame;		
		/** !#en Pressed state sprite
		!#zh 按下状态时按钮所显示的 Sprite 。 */
		pressedSprite : SpriteFrame;		
		/** !#en Hover state sprite
		!#zh 悬停状态下按钮所显示的 Sprite 。 */
		hoverSprite : SpriteFrame;		
		/** !#en Disabled state sprite
		!#zh 禁用状态下按钮所显示的 Sprite 。 */
		disabledSprite : SpriteFrame;		
		/** !#en
		Transition target.
		When Button state changed:
		 If Transition type is Button.Transition.NONE, Button will do nothing
		 If Transition type is Button.Transition.COLOR, Button will change target's color
		 If Transition type is Button.Transition.SPRITE, Button will change target Sprite's sprite
		!#zh
		需要过渡的目标。
		当前按钮状态改变规则：
		-如果 Transition type 选择 Button.Transition.NONE，按钮不做任何过渡。
		-如果 Transition type 选择 Button.Transition.COLOR，按钮会对目标颜色进行颜色之间的过渡。
		-如果 Transition type 选择 Button.Transition.Sprite，按钮会对目标 Sprite 进行 Sprite 之间的过渡。 */
		target : Node;		
		/** !#en If Button is clicked, it will trigger event's handler
		!#zh 按钮的点击事件列表。 */
		clickEvents : Component.EventHandler[];	
	}		
		/** !#zh: 作为 UI 根节点，为所有子节点提供视窗四边的位置信息以供对齐，另外提供屏幕适配策略接口，方便从编辑器设置。
		注：由于本节点的尺寸会跟随屏幕拉伸，所以 anchorPoint 只支持 (0.5, 0.5)，否则适配不同屏幕时坐标会有偏差。 */
		export class Canvas extends Component {		
		/** !#en Current active canvas, the scene should only have one active canvas at the same time.
		!#zh 当前激活的画布组件，场景同一时间只能有一个激活的画布。 */
		instance : Canvas;		
		/** !#en The desigin resolution for current scene.
		!#zh 当前场景设计分辨率。 */
		designResolution : Size;		
		/** !#en TODO
		!#zh: 是否优先将设计分辨率高度撑满视图高度。 */
		fitHeight : boolean;		
		/** !#en TODO
		!#zh: 是否优先将设计分辨率宽度撑满视图宽度。 */
		fitWidth : boolean;	
	}		
		/** !#en
		Base class for everything attached to Node(Entity).<br/>
		<br/>
		NOTE: Not allowed to use construction parameters for Component's subclasses,
		      because Component is created by the engine.
		!#zh
		所有附加到节点的基类。<br/>
		<br/>
		注意：不允许使用组件的子类构造参数，因为组件是由引擎创建的。 */
		export class Component extends Object {		
		/** !#en The node this component is attached to. A component is always attached to a node.
		!#zh 该组件被附加到的节点。组件总会附加到一个节点。 */
		node : Node;		
		/** !#en The uuid for editor.
		!#zh 组件的 uuid，用于编辑器。 */
		uuid : string;		
		/** !#en indicates whether this component is enabled or not.
		!#zh 表示该组件自身是否启用。 */
		enabled : boolean;		
		/** !#en indicates whether this component is enabled and its node is also active in the hierarchy.
		!#zh 表示该组件是否被启用并且所在的节点也处于激活状态。。 */
		enabledInHierarchy : boolean;		
		/** !#en TODO
		!#zh onLoad 是否被调用。 */
		_isOnLoadCalled : boolean;		
		/** !#en Update is called every frame, if the Component is enabled.
		!#zh 如果该组件启用，则每帧调用 update。 
		*/
		update() : void;		
		/** !#en LateUpdate is called every frame, if the Component is enabled.
		!#zh 如果该组件启用，则每帧调用 LateUpdate。 
		*/
		lateUpdate() : void;		
		/** !#en When attaching to an active node or its node first activated.
		!#zh 当附加到一个激活的节点上或者其节点第一次激活时候调用。 
		*/
		onLoad() : void;		
		/** !#en Called before all scripts' update if the Component is enabled the first time.
		!#zh 如果该组件第一次启用，则在所有组件的 update 之前调用。 
		*/
		start() : void;		
		/** !#en Called when this component becomes enabled and its node is active.
		!#zh 当该组件被启用，并且它的节点也激活时。 
		*/
		onEnable() : void;		
		/** !#en Called when this component becomes disabled or its node becomes inactive.
		!#zh 当该组件被禁用或节点变为无效时调用。 
		*/
		onDisable() : void;		
		/** !#en Called when this component will be destroyed.
		!#zh 当该组件被销毁时调用 
		*/
		onDestroy() : void;		
		onFocusInEditor() : void;		
		onLostFocusInEditor() : void;		
		/** !#en Called to initialize the component or node’s properties when adding the component the first time or when the Reset command is used. This function is only called in editor.
		!#zh 用来初始化组件或节点的一些属性，当该组件被第一次添加到节点上或用户点击了它的 Reset 菜单时调用。这个回调只会在编辑器下调用。 
		*/
		resetInEditor() : void;		
		/** !#en Adds a component class to the node. You can also add component to node by passing in the name of the script.
		!#zh 向节点添加一个组件类，你还可以通过传入脚本的名称来添加组件。
		@param typeOrTypename the constructor or the class name of the component to add
		
		@example 
		```js
		var sprite = node.addComponent(cc.Sprite);
		var test = node.addComponent("Test");
		``` 
		*/
		addComponent(typeOrTypename : Function|string) : Component;		
		/** !#en
		Returns the component of supplied type if the node has one attached, null if it doesn't.<br/>
		You can also get component in the node by passing in the name of the script.
		!#zh
		获取节点上指定类型的组件，如果节点有附加指定类型的组件，则返回，如果没有则为空。<br/>
		传入参数也可以是脚本的名称。
		
		@example 
		```js
		// get sprite component.
		var sprite = node.getComponent(cc.Sprite);
		// get custom test calss.
		var test = node.getComponent("Test");
		``` 
		*/
		getComponent(typeOrClassName : Function|string) : Component;		
		/** !#en Returns all components of supplied Type in the node.
		!#zh 返回节点上指定类型的所有组件。
		
		@example 
		```js
		var sprites = node.getComponents(cc.Sprite);
		var tests = node.getComponents("Test");
		``` 
		*/
		getComponents(typeOrClassName : Function|string) : Component[];		
		/** !#en Returns the component of supplied type in any of its children using depth first search.
		!#zh 递归查找所有子节点中第一个匹配指定类型的组件。
		
		@example 
		```js
		var sprite = node.getComponentInChildren(cc.Sprite);
		var Test = node.getComponentInChildren("Test");
		``` 
		*/
		getComponentInChildren(typeOrClassName : Function|string) : Component;		
		/** !#en Returns the components of supplied type in self or any of its children using depth first search.
		!#zh 递归查找自身或所有子节点中指定类型的组件
		
		@example 
		```js
		var sprites = node.getComponentsInChildren(cc.Sprite);
		var tests = node.getComponentsInChildren("Test");
		``` 
		*/
		getComponentsInChildren(typeOrClassName : Function|string) : Component[];		
		/** !#en
		If the component's bounding box is different from the node's, you can implement this method to supply
		a custom axis aligned bounding box (AABB), so the editor's scene view can perform hit test properly.
		!#zh
		如果组件的包围盒与节点不同，您可以实现该方法以提供自定义的轴向对齐的包围盒（AABB），
		以便编辑器的场景视图可以正确地执行点选测试。
		@param out_rect the Rect to receive the bounding box 
		*/
		_getLocalBounds(out_rect : Rect) : void;		
		/** !#en
		onRestore is called after the user clicks the Reset item in the Inspector's context menu or performs
		an undo operation on this component.<br/>
		<br/>
		If the component contains the "internal state", short for "temporary member variables which not included<br/>
		in its CCClass properties", then you may need to implement this function.<br/>
		<br/>
		The editor will call the getset accessors of your component to record/restore the component's state<br/>
		for undo/redo operation. However, in extreme cases, it may not works well. Then you should implement<br/>
		this function to manually synchronize your component's "internal states" with its public properties.<br/>
		Once you implement this function, all the getset accessors of your component will not be called when<br/>
		the user performs an undo/redo operation. Which means that only the properties with default value<br/>
		will be recorded or restored by editor.<br/>
		<br/>
		Similarly, the editor may failed to reset your component correctly in extreme cases. Then if you need<br/>
		to support the reset menu, you should manually synchronize your component's "internal states" with its<br/>
		properties in this function. Once you implement this function, all the getset accessors of your component<br/>
		will not be called during reset operation. Which means that only the properties with default value<br/>
		will be reset by editor.
		
		This function is only called in editor mode.
		!#zh
		onRestore 是用户在检查器菜单点击 Reset 时，对此组件执行撤消操作后调用的。<br/>
		<br/>
		如果组件包含了“内部状态”（不在 CCClass 属性中定义的临时成员变量），那么你可能需要实现该方法。<br/>
		<br/>
		编辑器执行撤销/重做操作时，将调用组件的 get set 来录制和还原组件的状态。
		然而，在极端的情况下，它可能无法良好运作。<br/>
		那么你就应该实现这个方法，手动根据组件的属性同步“内部状态”。
		一旦你实现这个方法，当用户撤销或重做时，组件的所有 get set 都不会再被调用。
		这意味着仅仅指定了默认值的属性将被编辑器记录和还原。<br/>
		<br/>
		同样的，编辑可能无法在极端情况下正确地重置您的组件。<br/>
		于是如果你需要支持组件重置菜单，你需要在该方法中手工同步组件属性到“内部状态”。<br/>
		一旦你实现这个方法，组件的所有 get set 都不会在重置操作时被调用。
		这意味着仅仅指定了默认值的属性将被编辑器重置。
		<br/>
		此方法仅在编辑器下会被调用。 
		*/
		onRestore() : void;		
		/** !#en
		Schedules a custom selector.<br/>
		If the selector is already scheduled, then the interval parameter will be updated without scheduling it again.
		!#zh
		调度一个自定义的回调函数。<br/>
		如果回调函数已调度，那么将不会重复调度它，只会更新时间间隔参数。
		@param callback The callback function
		@param interval Tick interval in seconds. 0 means tick every frame. If interval = 0, it's recommended to use scheduleUpdate() instead.
		@param repeat The selector will be executed (repeat + 1) times, you can use kCCRepeatForever for tick infinitely.
		@param delay The amount of time that the first tick will wait before execution.
		
		@example 
		```js
		var timeCallback = function (dt) {
		  cc.log("time: " + dt);
		}
		this.schedule(timeCallback, 1);
		``` 
		*/
		schedule(callback : Function, interval? : number, repeat? : number, delay? : number) : void;		
		/** !#en Schedules a callback function that runs only once, with a delay of 0 or larger.
		!#zh 调度一个只运行一次的回调函数，可以指定 0 让回调函数在下一帧立即执行或者在一定的延时之后执行。
		@param callback A function wrapped as a selector
		@param delay The amount of time that the first tick will wait before execution.
		
		@example 
		```js
		var timeCallback = function (dt) {
		  cc.log("time: " + dt);
		}
		this.scheduleOnce(timeCallback, 2);
		``` 
		*/
		scheduleOnce(callback : Function, delay? : number) : void;		
		/** !#en Unschedules a custom callback function.
		!#zh 取消调度一个自定义的回调函数。
		@param callback_fn A function wrapped as a selector
		
		@example 
		```js
		this.unschedule(_callback);
		``` 
		*/
		unschedule(callback_fn : Function) : void;		
		/** !#en
		unschedule all scheduled callback functions: custom callback functions, and the 'update' callback function.<br/>
		Actions are not affected by this method.
		!#zh 取消调度所有已调度的回调函数：定制的回调函数以及 'update' 回调函数。动作不受此方法影响。
		
		@example 
		```js
		this.unscheduleAllCallbacks();
		``` 
		*/
		unscheduleAllCallbacks() : void;	
	}		
		/** !#en cc.EditBox is a component for inputing text, you can use it to gather small amounts of text from users.
		!#zh EditBox 组件，用于获取用户的输入文本。 */
		export class EditBox extends _RendererUnderSG {		
		/** !#en Input string of EditBox.
		!#zh 输入框的初始输入内容，如果为空则会显示占位符的文本。 */
		string : string;		
		/** !#en The background image of EditBox.
		!#zh 输入框的背景图片 */
		backgroundImage : SpriteFrame;		
		/** !#en
		The return key type of EditBox.
		Note: it is meaningless for web platforms and desktop platforms.
		!#zh
		指定移动设备上面回车按钮的样式。
		注意：这个选项对 web 平台与 desktop 平台无效。 */
		returnType : EditBox.KeyboardReturnType;		
		/** !#en Set the input flags that are to be applied to the EditBox.
		!#zh 指定输入标志位，可以指定输入方式为密码或者单词首字母大写。 */
		inputFlag : EditBox.InputFlag;		
		/** !#en
		Set the input mode of the edit box.
		If you pass ANY, it will create a multiline EditBox.
		!#zh
		指定输入模式: ANY表示多行输入，其它都是单行输入，移动平台上还可以指定键盘样式。 */
		inputMode : EditBox.InputMode;		
		/** !#en Font size of the input text.
		!#zh 输入框文本的字体大小 */
		fontSize : number;		
		/** !#en Change the lineHeight of displayed text.
		!#zh 输入框文本的行高。 */
		lineHeight : number;		
		/** !#en Font color of the input text.
		!#zh 输入框文本的颜色。 */
		fontColor : Color;		
		/** !#en The display text of placeholder.
		!#zh 输入框占位符的文本内容。 */
		placeholder : string;		
		/** !#en The font size of placeholder.
		!#zh 输入框占位符的字体大小。 */
		placeholderFontSize : number;		
		/** !#en The font color of placeholder.
		!#zh 输入框最大允许输入的字符个数。 */
		placeholderFontColor : Color;		
		/** !#en The maximize input length of EditBox.
		- If pass a value less than 0, it won't limit the input number of characters.
		- If pass 0, it doesn't allow input any characters.
		!#zh 输入框最大允许输入的字符个数。
		- 如果值为小于 0 的值，则不会限制输入字符个数。
		- 如果值为 0，则不允许用户进行任何输入。 */
		maxLength : number;		
		/** !#en The input is always visible and be on top of the game view.
		!zh 输入框总是可见，并且永远在游戏视图的上面
		Note: only available on Web at the moment. */
		stayOnTop : boolean;		
		/** !#en Set the tabIndex of the DOM input element, only useful on Web.
		!#zh 修改 DOM 输入元素的 tabIndex，这个属性只有在 Web 上面修改有意义。 */
		tabIndex : number;		
		/** !#en The event handler to be called when EditBox began to edit text.
		!#zh 开始编辑文本输入框触发的事件回调。 */
		editingDidBegin : Component.EventHandler;		
		/** !#en The event handler to be called when EditBox text changes.
		!#zh 编辑文本输入框时触发的事件回调。 */
		textChanged : Component.EventHandler;		
		/** !#en The event handler to be called when EditBox edit ends.
		!#zh 结束编辑文本输入框时触发的事件回调。 */
		editingDidEnded : Component.EventHandler;		
		/** !#en The event handler to be called when return key is pressed. Windows is not supported.
		!#zh 当用户按下回车按键时的事件回调，目前不支持 windows 平台 */
		editingReturn : Component.EventHandler;		
		/** !#en Let the EditBox get focus, only valid when stayOnTop is true.
		!#zh 让当前 EditBox 获得焦点，只有在 stayOnTop 为 true 的时候设置有效
		Note: only available on Web at the moment. 
		*/
		setFocus() : void;		
		/** !#en Determine whether EditBox is getting focus or not.
		!#zh 判断 EditBox 是否获得了焦点
		Note: only available on Web at the moment. 
		*/
		isFocused() : void;	
	}		
		/** !#en The Label Component.
		!#zh 文字标签组件 */
		export class Label extends _RendererUnderSG {		
		/** !#en Content string of label.
		!#zh 标签显示的文本内容。 */
		string : string;		
		/** !#en Horizontal Alignment of label.
		!#zh 文本内容的水平对齐方式。 */
		horizontalAlign : Label.HorizontalAlign;		
		/** !#en Vertical Alignment of label.
		!#zh 文本内容的垂直对齐方式。 */
		verticalAlign : Label.VerticalAlign;		
		/** !#en The actual rendering font size in shrink mode
		!#zh SHRINK 模式下面文本实际渲染的字体大小 */
		actualFontSize : number;		
		/** !#en Font size of label.
		!#zh 文本字体大小。 */
		fontSize : number;		
		/** !#en Line Height of label.
		!#zh 文本行高。 */
		lineHeight : number;		
		/** !#en Overflow of label.
		!#zh 文字显示超出范围时的处理方式。 */
		overflow : Label.Overflow;		
		/** !#en Whether auto wrap label when string width is large than label width.
		!#zh 是否自动换行。 */
		enableWrapText : boolean;		
		/** !#en The font of label.
		!#zh 文本字体。 */
		font : Font;		
		/** !#en Whether use system font name or not.
		!#zh 是否使用系统字体。 */
		isSystemFontUsed : boolean;	
	}		
		/** !#en Outline effect used to change the display, only used for TTF font
		!#zh 描边效果组件,用于字体描边,只能用于系统字体 */
		export class LabelOutline extends Component {		
		/** !#en Change the outline color
		!#zh 改变描边的颜色 */
		color : Color;		
		/** !#en Change the outline width
		!#zh 改变描边的宽度 */
		width : number;	
	}		
		/** !#en The Layout is a container component, use it to arrange child elements easily.
		!#zh Layout 组件相当于一个容器，能自动对它的所有子节点进行统一排版。 */
		export class Layout extends Component {		
		/** !#en The layout type.
		!#zh 布局类型 */
		type : Layout.Type;		
		/** !#en
		The are three resize modes for Layout.
		None, resize Container and resize children.
		!#zh 缩放模式 */
		resizeMode : Layout.ResizeMode;		
		/** !#en The cell size for grid layout.
		!#zh 每个格子的大小，只有布局类型为 GRID 的时候才有效。 */
		cellSize : Size;		
		/** !#en
		The start axis for grid layout. If you choose horizontal, then children will layout horizontally at first,
		and then break line on demand. Choose vertical if you want to layout vertically at first .
		!#zh 起始轴方向类型，可进行水平和垂直布局排列，只有布局类型为 GRID 的时候才有效。 */
		startAxis : Layout.AxisDirection;		
		/** !#en The left padding of layout, it only effect the layout in one direction.
		!#zh 容器内左边距，只会在一个布局方向上生效。 */
		paddingLeft : number;		
		/** !#en The right padding of layout, it only effect the layout in one direction.
		!#zh 容器内右边距，只会在一个布局方向上生效。 */
		paddingRight : number;		
		/** !#en The top padding of layout, it only effect the layout in one direction.
		!#zh 容器内上边距，只会在一个布局方向上生效。 */
		paddingTop : number;		
		/** !#en The bottom padding of layout, it only effect the layout in one direction.
		!#zh 容器内下边距，只会在一个布局方向上生效。 */
		paddingBottom : number;		
		/** !#en The distance in x-axis between each element in layout.
		!#zh 子节点之间的水平间距。 */
		spacingX : number;		
		/** !#en The distance in y-axis between each element in layout.
		!#zh 子节点之间的垂直间距。 */
		spacingY : number;		
		/** !#en
		Only take effect in Vertical layout mode.
		This option changes the start element's positioning.
		!#zh 垂直排列子节点的方向。 */
		verticalDirection : Layout.VerticalDirection;		
		/** !#en
		Only take effect in Horizontal layout mode.
		This option changes the start element's positioning.
		!#zh 水平排列子节点的方向。 */
		horizontalDirection : Layout.HorizontalDirection;		
		/** !#en The padding of layout, it effects the layout in four direction.
		!#zh 容器内边距，该属性会在四个布局方向上生效。 */
		padding : number;	
	}		
		/** !#en The Mask Component
		!#zh 遮罩组件 */
		export class Mask extends _RendererInSG {		
		/** !#en The mask type.
		!#zh 遮罩类型 */
		type : Mask.Type;		
		/** !#en The mask image
		!#zh 遮罩所需要的贴图 */
		spriteFrame : SpriteFrame;		
		/** !#en
		The alpha threshold.(Not supported Canvas Mode) <br/>
		The content is drawn only where the stencil have pixel with alpha greater than the alphaThreshold. <br/>
		Should be a float between 0 and 1. <br/>
		This default to 1 (so alpha test is disabled).
		!#zh
		Alpha 阈值（不支持 Canvas 模式）<br/>
		只有当模板的像素的 alpha 大于 alphaThreshold 时，才会绘制内容。<br/>
		该数值 0 ~ 1 之间的浮点数，默认值为 1（因此禁用 alpha） */
		alphaThreshold : number;		
		/** !#en Reverse mask (Not supported Canvas Mode)
		!#zh 反向遮罩（不支持 Canvas 模式） */
		inverted : boolean;		
		/** !#en The segements for ellipse mask.
		!#zh 椭圆遮罩的曲线细分数 */
		segements : number;	
	}		
		/** !#en The PageView control
		!#zh 页面视图组件 */
		export class PageView extends ScrollView {		
		/** !#en Specify the size type of each page in PageView.
		!#zh 页面视图中每个页面大小类型 */
		sizeMode : PageView.SizeMode;		
		/** !#en The page view direction
		!#zh 页面视图滚动类型 */
		direction : PageView.Direction;		
		/** !#en
		The scroll threshold value, when drag exceeds this value,
		release the next page will automatically scroll, less than the restore
		!#zh 滚动临界值，默认单位百分比，当拖拽超出该数值时，松开会自动滚动下一页，小于时则还原。 */
		scrollThreshold : number;		
		/** !#en
		Auto page turning velocity threshold. When users swipe the PageView quickly,
		it will calculate a velocity based on the scroll distance and time,
		if the calculated velocity is larger than the threshold, then it will trigger page turning.
		!#zh
		快速滑动翻页临界值。
		当用户快速滑动时，会根据滑动开始和结束的距离与时间计算出一个速度值，
		该值与此临界值相比较，如果大于临界值，则进行自动翻页。 */
		autoPageTurningThreshold : number;		
		/** !#en Change the PageTurning event timing of PageView.
		!#zh 设置 PageView PageTurning 事件的发送时机。 */
		pageTurningEventTiming : number;		
		/** !#en The Page View Indicator
		!#zh 页面视图指示器组件 */
		indicator : PageViewIndicator;		
		/** !#en PageView events callback
		!#zh 滚动视图的事件回调函数 */
		pageEvents : Component.EventHandler[];		
		/** !#en Returns current page index
		!#zh 返回当前页面索引 
		*/
		getCurrentPageIndex() : number;		
		/** !#en Set current page index
		!#zh 设置当前页面索引 
		*/
		setCurrentPageIndex(index : number) : void;		
		/** !#en Returns all pages of pageview
		!#zh 返回视图中的所有页面 
		*/
		getPages() : Node[];		
		/** !#en At the end of the current page view to insert a new view
		!#zh 在当前页面视图的尾部插入一个新视图 
		*/
		addPage(page : Node) : void;		
		/** !#en Inserts a page in the specified location
		!#zh 将页面插入指定位置中 
		*/
		insertPage(page : Node, index : number) : void;		
		/** !#en Removes a page from PageView.
		!#zh 移除指定页面 
		*/
		removePage(page : Node) : void;		
		/** !#en Removes a page at index of PageView.
		!#zh 移除指定下标的页面 
		*/
		removePageAtIndex(index : number) : void;		
		/** !#en Removes all pages from PageView
		!#zh 移除所有页面 
		*/
		removeAllPages() : void;		
		/** !#en Scroll PageView to index.
		!#zh 滚动到指定页面
		@param idx index of page.
		@param timeInSecond scrolling time 
		*/
		scrollToPage(idx : number, timeInSecond : number) : void;	
	}		
		/** !#en The Page View Indicator Component
		!#zh 页面视图每页标记组件 */
		export class PageViewIndicator extends Component {		
		/** !#en The spriteFrame for each element.
		!#zh 每个页面标记显示的图片 */
		spriteFrame : SpriteFrame;		
		/** !#en The location direction of PageViewIndicator.
		!#zh 页面标记摆放方向 */
		direction : PageViewIndicator.Direction;		
		/** !#en The cellSize for each element.
		!#zh 每个页面标记的大小 */
		cellSize : Size;		
		/** !#en The distance between each element.
		!#zh 每个页面标记之间的边距 */
		spacing : number;		
		/** !#en Set Page View
		!#zh 设置页面视图 
		*/
		setPageView(target : PageView) : void;	
	}		
		/** !#en
		Visual indicator of progress in some operation.
		Displays a bar to the user representing how far the operation has progressed.
		!#zh
		进度条组件，可用于显示加载资源时的进度。 */
		export class ProgressBar extends Component {		
		/** !#en The targeted Sprite which will be changed progressively.
		!#zh 用来显示进度条比例的 Sprite 对象。 */
		barSprite : Sprite;		
		/** !#en The progress mode, there are two modes supported now: horizontal and vertical.
		!#zh 进度条的模式 */
		mode : ProgressBar.Mode;		
		/** !#en The total width or height of the bar sprite.
		!#zh 进度条实际的总长度 */
		totalLength : number;		
		/** !#en The current progress of the bar sprite. The valid value is between 0-1.
		!#zh 当前进度值，该数值的区间是 0-1 之间。 */
		progress : number;		
		/** !#en Whether reverse the progress direction of the bar sprite.
		!#zh 进度条是否进行反方向变化。 */
		reverse : boolean;	
	}		
		/** Rendering component in scene graph.
		Maintains a node which will be the scene graph of component's Node. */
		export class _RendererInSG extends _SGComponent {	
	}		
		/** The base rendering component which will attach a leaf node to the cocos2d scene graph. */
		export class _RendererUnderSG extends _SGComponent {	
	}		
		/** !#en The RichText Component.
		!#zh 富文本组件 */
		export class RichText extends Component {		
		/** !#en Content string of RichText.
		!#zh 富文本显示的文本内容。 */
		string : string;		
		/** !#en Horizontal Alignment of each line in RichText.
		!#zh 文本内容的水平对齐方式。 */
		horizontalAlign : TextAlignment;		
		/** !#en Font size of RichText.
		!#zh 富文本字体大小。 */
		fontSize : number;		
		/** !#en Custom TTF font of RichText
		!#zh  富文本定制字体 */
		font : cc.TTFFont;		
		/** !#en The maximize width of the RichText
		!#zh 富文本的最大宽度 */
		maxWidth : number;		
		/** !#en Line Height of RichText.
		!#zh 富文本行高。 */
		lineHeight : number;		
		/** !#en The image atlas for the img tag. For each src value in the img tag, there should be a valid spriteFrame in the image atlas.
		!#zh 对于 img 标签里面的 src 属性名称，都需要在 imageAtlas 里面找到一个有效的 spriteFrame，否则 img tag 会判定为无效。 */
		imageAtlas : SpriteAtlas;	
	}		
		/** The base class for all rendering component in scene graph.
		
		You should override:
		- _createSgNode
		- _initSgNode */
		export class _SGComponent extends Component {	
	}		
		/** !#en
		The Scrollbar control allows the user to scroll an image or other view that is too large to see completely
		!#zh 滚动条组件 */
		export class Scrollbar extends Component {		
		/** !#en The "handle" part of the scrollbar.
		!#zh 作为当前滚动区域位置显示的滑块 Sprite。 */
		handle : Sprite;		
		/** !#en The direction of scrollbar.
		!#zh ScrollBar 的滚动方向。 */
		direction : Scrollbar.Direction;		
		/** !#en Whehter enable auto hide or not.
		!#zh 是否在没有滚动动作时自动隐藏 ScrollBar。 */
		enableAutoHide : boolean;		
		/** !#en
		The time to hide scrollbar when scroll finished.
		Note: This value is only useful when enableAutoHide is true.
		!#zh
		没有滚动动作后经过多久会自动隐藏。
		注意：只要当 “enableAutoHide” 为 true 时，才有效。 */
		autoHideTime : number;	
	}		
		/** !#en
		Layout container for a view hierarchy that can be scrolled by the user,
		allowing it to be larger than the physical display.
		
		!#zh
		滚动视图组件 */
		export class ScrollView extends Component {		
		/** !#en This is a reference to the UI element to be scrolled.
		!#zh 可滚动展示内容的节点。 */
		content : Node;		
		/** !#en Enable horizontal scroll.
		!#zh 是否开启水平滚动。 */
		horizontal : boolean;		
		/** !#en Enable vertical scroll.
		!#zh 是否开启垂直滚动。 */
		vertical : boolean;		
		/** !#en When inertia is set, the content will continue to move when touch ended.
		!#zh 是否开启滚动惯性。 */
		inertia : boolean;		
		/** !#en
		It determines how quickly the content stop moving. A value of 1 will stop the movement immediately.
		A value of 0 will never stop the movement until it reaches to the boundary of scrollview.
		!#zh
		开启惯性后，在用户停止触摸后滚动多快停止，0表示永不停止，1表示立刻停止。 */
		brake : number;		
		/** !#en When elastic is set, the content will be bounce back when move out of boundary.
		!#zh 是否允许滚动内容超过边界，并在停止触摸后回弹。 */
		elastic : boolean;		
		/** !#en The elapse time of bouncing back. A value of 0 will bounce back immediately.
		!#zh 回弹持续的时间，0 表示将立即反弹。 */
		bounceDuration : number;		
		/** !#en The horizontal scrollbar reference.
		!#zh 水平滚动的 ScrollBar。 */
		horizontalScrollBar : Scrollbar;		
		/** !#en The vertical scrollbar reference.
		!#zh 垂直滚动的 ScrollBar。 */
		verticalScrollBar : Scrollbar;		
		/** !#en Scrollview events callback
		!#zh 滚动视图的事件回调函数 */
		scrollEvents : Component.EventHandler[];		
		/** !#en If cancelInnerEvents is set to true, the scroll behavior will cancel touch events on inner content nodes
		It's set to true by default.
		!#zh 如果这个属性被设置为 true，那么滚动行为会取消子节点上注册的触摸事件，默认被设置为 true。
		注意，子节点上的 touchstart 事件仍然会触发，触点移动距离非常短的情况下 touchmove 和 touchend 也不会受影响。 */
		cancelInnerEvents : boolean;		
		/** !#en Scroll the content to the bottom boundary of ScrollView.
		!#zh 视图内容将在规定时间内滚动到视图底部。
		@param timeInSecond Scroll time in second, if you don't pass timeInSecond,
		the content will jump to the bottom boundary immediately.
		@param attenuated Whether the scroll acceleration attenuated, default is true.
		
		@example 
		```js
		// Scroll to the bottom of the view.
		scrollView.scrollToBottom(0.1);
		``` 
		*/
		scrollToBottom(timeInSecond? : number, attenuated? : boolean) : void;		
		/** !#en Scroll the content to the top boundary of ScrollView.
		!#zh 视图内容将在规定时间内滚动到视图顶部。
		@param timeInSecond Scroll time in second, if you don't pass timeInSecond,
		the content will jump to the top boundary immediately.
		@param attenuated Whether the scroll acceleration attenuated, default is true.
		
		@example 
		```js
		// Scroll to the top of the view.
		scrollView.scrollToTop(0.1);
		``` 
		*/
		scrollToTop(timeInSecond? : number, attenuated? : boolean) : void;		
		/** !#en Scroll the content to the left boundary of ScrollView.
		!#zh 视图内容将在规定时间内滚动到视图左边。
		@param timeInSecond Scroll time in second, if you don't pass timeInSecond,
		the content will jump to the left boundary immediately.
		@param attenuated Whether the scroll acceleration attenuated, default is true.
		
		@example 
		```js
		// Scroll to the left of the view.
		scrollView.scrollToLeft(0.1);
		``` 
		*/
		scrollToLeft(timeInSecond? : number, attenuated? : boolean) : void;		
		/** !#en Scroll the content to the right boundary of ScrollView.
		!#zh 视图内容将在规定时间内滚动到视图右边。
		@param timeInSecond Scroll time in second, if you don't pass timeInSecond,
		the content will jump to the right boundary immediately.
		@param attenuated Whether the scroll acceleration attenuated, default is true.
		
		@example 
		```js
		// Scroll to the right of the view.
		scrollView.scrollToRight(0.1);
		``` 
		*/
		scrollToRight(timeInSecond? : number, attenuated? : boolean) : void;		
		/** !#en Scroll the content to the top left boundary of ScrollView.
		!#zh 视图内容将在规定时间内滚动到视图左上角。
		@param timeInSecond Scroll time in second, if you don't pass timeInSecond,
		the content will jump to the top left boundary immediately.
		@param attenuated Whether the scroll acceleration attenuated, default is true.
		
		@example 
		```js
		// Scroll to the upper left corner of the view.
		scrollView.scrollToTopLeft(0.1);
		``` 
		*/
		scrollToTopLeft(timeInSecond? : number, attenuated? : boolean) : void;		
		/** !#en Scroll the content to the top right boundary of ScrollView.
		!#zh 视图内容将在规定时间内滚动到视图右上角。
		@param timeInSecond Scroll time in second, if you don't pass timeInSecond,
		the content will jump to the top right boundary immediately.
		@param attenuated Whether the scroll acceleration attenuated, default is true.
		
		@example 
		```js
		// Scroll to the top right corner of the view.
		scrollView.scrollToTopRight(0.1);
		``` 
		*/
		scrollToTopRight(timeInSecond? : number, attenuated? : boolean) : void;		
		/** !#en Scroll the content to the bottom left boundary of ScrollView.
		!#zh 视图内容将在规定时间内滚动到视图左下角。
		@param timeInSecond Scroll time in second, if you don't pass timeInSecond,
		the content will jump to the bottom left boundary immediately.
		@param attenuated Whether the scroll acceleration attenuated, default is true.
		
		@example 
		```js
		// Scroll to the lower left corner of the view.
		scrollView.scrollToBottomLeft(0.1);
		``` 
		*/
		scrollToBottomLeft(timeInSecond? : number, attenuated? : boolean) : void;		
		/** !#en Scroll the content to the bottom right boundary of ScrollView.
		!#zh 视图内容将在规定时间内滚动到视图右下角。
		@param timeInSecond Scroll time in second, if you don't pass timeInSecond,
		the content will jump to the bottom right boundary immediately.
		@param attenuated Whether the scroll acceleration attenuated, default is true.
		
		@example 
		```js
		// Scroll to the lower right corner of the view.
		scrollView.scrollToBottomRight(0.1);
		``` 
		*/
		scrollToBottomRight(timeInSecond? : number, attenuated? : boolean) : void;		
		/** !#en Scroll with an offset related to the ScrollView's top left origin, if timeInSecond is omitted, then it will jump to the
		      specific offset immediately.
		!#zh 视图内容在规定时间内将滚动到 ScrollView 相对左上角原点的偏移位置, 如果 timeInSecond参数不传，则立即滚动到指定偏移位置。
		@param offset A Vec2, the value of which each axis between 0 and maxScrollOffset
		@param timeInSecond Scroll time in second, if you don't pass timeInSecond,
		the content will jump to the specific offset of ScrollView immediately.
		@param attenuated Whether the scroll acceleration attenuated, default is true.
		
		@example 
		```js
		// Scroll to middle position in 0.1 second in x-axis
		var maxScrollOffset = this.getMaxScrollOffset();
		scrollView.scrollToOffset(cc.p(maxScrollOffset.x / 2, 0), 0.1);
		``` 
		*/
		scrollToOffset(offset : Vec2, timeInSecond? : number, attenuated? : boolean) : void;		
		/** !#en  Get the positive offset value corresponds to the content's top left boundary.
		!#zh  获取滚动视图相对于左上角原点的当前滚动偏移 
		*/
		getScrollOffset() : Vec2;		
		/** !#en Get the maximize available  scroll offset
		!#zh 获取滚动视图最大可以滚动的偏移量 
		*/
		getMaxScrollOffset() : Vec2;		
		/** !#en Scroll the content to the horizontal percent position of ScrollView.
		!#zh 视图内容在规定时间内将滚动到 ScrollView 水平方向的百分比位置上。
		@param percent A value between 0 and 1.
		@param timeInSecond Scroll time in second, if you don't pass timeInSecond,
		the content will jump to the horizontal percent position of ScrollView immediately.
		@param attenuated Whether the scroll acceleration attenuated, default is true.
		
		@example 
		```js
		// Scroll to middle position.
		scrollView.scrollToBottomRight(0.5, 0.1);
		``` 
		*/
		scrollToPercentHorizontal(percent : number, timeInSecond? : number, attenuated? : boolean) : void;		
		/** !#en Scroll the content to the percent position of ScrollView in any direction.
		!#zh 视图内容在规定时间内进行垂直方向和水平方向的滚动，并且滚动到指定百分比位置上。
		@param anchor A point which will be clamp between cc.p(0,0) and cc.p(1,1).
		@param timeInSecond Scroll time in second, if you don't pass timeInSecond,
		the content will jump to the percent position of ScrollView immediately.
		@param attenuated Whether the scroll acceleration attenuated, default is true.
		
		@example 
		```js
		// Vertical scroll to the bottom of the view.
		scrollView.scrollTo(cc.p(0, 1), 0.1);
		
		// Horizontal scroll to view right.
		scrollView.scrollTo(cc.p(1, 0), 0.1);
		``` 
		*/
		scrollTo(anchor : Vec2, timeInSecond? : number, attenuated? : boolean) : void;		
		/** !#en Scroll the content to the vertical percent position of ScrollView.
		!#zh 视图内容在规定时间内滚动到 ScrollView 垂直方向的百分比位置上。
		@param percent A value between 0 and 1.
		@param timeInSecond Scroll time in second, if you don't pass timeInSecond,
		the content will jump to the vertical percent position of ScrollView immediately.
		@param attenuated Whether the scroll acceleration attenuated, default is true.
		// Scroll to middle position.
		scrollView.scrollToPercentVertical(0.5, 0.1); 
		*/
		scrollToPercentVertical(percent : number, timeInSecond? : number, attenuated? : boolean) : void;		
		/** !#en  Stop auto scroll immediately
		!#zh  停止自动滚动, 调用此 API 可以让 Scrollview 立即停止滚动 
		*/
		stopAutoScroll() : void;		
		/** !#en Modify the content position.
		!#zh 设置当前视图内容的坐标点。
		@param position The position in content's parent space. 
		*/
		setContentPosition(position : Vec2) : void;		
		/** !#en Query the content's position in its parent space.
		!#zh 获取当前视图内容的坐标点。 
		*/
		getContentPosition() : Position;	
	}		
		/** !#en The Slider Control
		!#zh 滑动器组件 */
		export class Slider extends Component {		
		/** !#en The "handle" part of the slider
		!#zh 滑动器滑块按钮部件 */
		handle : Button;		
		/** !#en The slider direction
		!#zh 滑动器方向 */
		direction : Slider.Direction;		
		/** !#en The current progress of the slider. The valid value is between 0-1
		!#zh 当前进度值，该数值的区间是 0-1 之间 */
		progress : number;		
		/** !#en The slider events callback
		!#zh 滑动器组件事件回调函数 */
		slideEvents : Component.EventHandler[];	
	}		
		/** !#en Renders a sprite in the scene.
		!#zh 该组件用于在场景中渲染精灵。 */
		export class Sprite extends _RendererUnderSG {		
		/** !#en The sprite frame of the sprite.
		!#zh 精灵的精灵帧 */
		spriteFrame : SpriteFrame;		
		/** !#en The sprite render type.
		!#zh 精灵渲染类型 */
		type : Sprite.SpriteType;		
		/** !#en
		The fill type, This will only have any effect if the "type" is set to “cc.Sprite.Type.FILLED”.
		!#zh
		精灵填充类型，仅渲染类型设置为 cc.Sprite.SpriteType.FILLED 时有效。 */
		fillType : Sprite.FillType;		
		/** !#en
		The fill Center, This will only have any effect if the "type" is set to “cc.Sprite.Type.FILLED”.
		!#zh
		填充中心点，仅渲染类型设置为 cc.Sprite.SpriteType.FILLED 时有效。 */
		fillCenter : Vec2;		
		/** !#en
		The fill Start, This will only have any effect if the "type" is set to “cc.Sprite.Type.FILLED”.
		!#zh
		填充起始点，仅渲染类型设置为 cc.Sprite.SpriteType.FILLED 时有效。 */
		fillStart : number;		
		/** !#en
		The fill Range, This will only have any effect if the "type" is set to “cc.Sprite.Type.FILLED”.
		!#zh
		填充范围，仅渲染类型设置为 cc.Sprite.SpriteType.FILLED 时有效。 */
		fillRange : number;		
		/** !#en specify the frame is trimmed or not.
		!#zh 是否使用裁剪模式 */
		trim : boolean;		
		/** !#en specify the source Blend Factor.
		!#zh 指定原图的混合模式 */
		srcBlendFactor : BlendFactor;		
		/** !#en specify the destination Blend Factor.
		!#zh 指定目标的混合模式 */
		dstBlendFactor : BlendFactor;		
		/** !#en specify the size tracing mode.
		!#zh 精灵尺寸调整模式 */
		sizeMode : Sprite.SizeMode;		
		/** !#en Change the left sprite's cap inset.
		!#zh 设置精灵左边框-用于九宫格。
		@param insetLeft The values to use for the cap inset.
		
		@example 
		```js
		sprite.setInsetLeft(5);
		``` 
		*/
		setInsetLeft(insetLeft : number) : void;		
		/** !#en Query the left sprite's cap inset.
		!#zh 获取精灵左边框
		
		@example 
		```js
		var insetLeft = sprite.getInsetLeft();
		cc.log("Inset Left:" + insetLeft);
		``` 
		*/
		getInsetLeft() : number;		
		/** !#en Change the top sprite's cap inset.
		!#zh 设置精灵上边框-用于九宫格。
		@param insetTop The values to use for the cap inset.
		
		@example 
		```js
		sprite.setInsetTop(5);
		``` 
		*/
		setInsetTop(insetTop : number) : void;		
		/** !#en Query the top sprite's cap inset.
		!#zh 获取精灵上边框。
		
		@example 
		```js
		var insetTop = sprite.getInsetTop();
		cc.log("Inset Top:" + insetTop);
		``` 
		*/
		getInsetTop() : number;		
		/** !#en Change the right sprite's cap inset.
		!#zh 设置精灵右边框-用于九宫格。
		@param insetRight The values to use for the cap inset.
		
		@example 
		```js
		sprite.setInsetRight(5);
		``` 
		*/
		setInsetRight(insetRight : number) : void;		
		/** !#en Query the right sprite's cap inset.
		!#zh 获取精灵右边框。
		
		@example 
		```js
		var insetRight = sprite.getInsetRight();
		cc.log("Inset Right:" + insetRight);
		``` 
		*/
		getInsetRight() : number;		
		/** !#en Change the bottom sprite's cap inset.
		!#zh 设置精灵下边框-用于九宫格。
		@param bottomInset The values to use for the cap inset.
		
		@example 
		```js
		sprite.setInsetBottom(5);
		``` 
		*/
		setInsetBottom(bottomInset : number) : void;		
		/** !#en Query the bottom sprite's cap inset.
		!#zh 获取精灵下边框。
		
		@example 
		```js
		var insetBottom = sprite.getInsetBottom();
		cc.log("Inset Bottom:" + insetBottom);
		``` 
		*/
		getInsetBottom() : number;	
	}		
		/** !#en A distortion used to change the rendering of simple sprite.If will take effect after sprite component is added.
		!#zh 扭曲效果组件,用于改变SIMPLE类型sprite的渲染,只有当sprite组件已经添加后,才能起作用. */
		export class SpriteDistortion extends Component {		
		/** !#en Change the UV offset for distortion rendering.
		!#zh 在渲染时改变UV的整体偏移. */
		offset : Vec2;		
		/** !#en Change the UV scale for distortion rendering.
		!#zh 在渲染时改变UV的寻址系数 */
		tiling : Vec2;	
	}		
		/** !#en The toggle component is a CheckBox, when it used together with a ToggleGroup, it
		could be treated as a RadioButton.
		!#zh Toggle 是一个 CheckBox，当它和 ToggleGroup 一起使用的时候，可以变成 RadioButton。 */
		export class Toggle extends Button {		
		/** !#en When this value is true, the check mark component will be enabled, otherwise
		the check mark component will be disabled.
		!#zh 如果这个设置为 true，则 check mark 组件会处于 enabled 状态，否则处于 disabled 状态。 */
		isChecked : boolean;		
		/** !#en The toggle group which the toggle belongs to, when it is null, the toggle is a CheckBox.
		Otherwise, the toggle is a RadioButton.
		!#zh Toggle 所属的 ToggleGroup，这个属性是可选的。如果这个属性为 null，则 Toggle 是一个 CheckBox，
		否则，Toggle 是一个 RadioButton。 */
		toggleGroup : ToggleGroup;		
		/** !#en The image used for the checkmark.
		!#zh Toggle 处于选中状态时显示的图片 */
		checkMark : Sprite;		
		/** !#en If Toggle is clicked, it will trigger event's handler
		!#zh Toggle 按钮的点击事件列表。 */
		checkEvents : Component.EventHandler[];		
		/** !#en Make the toggle button checked.
		!#zh 使 toggle 按钮处于选中状态 
		*/
		check() : void;		
		/** !#en Make the toggle button unchecked.
		!#zh 使 toggle 按钮处于未选中状态 
		*/
		uncheck() : void;	
	}		
		/** !#en ToggleGroup is not a visiable UI component but a way to modify the behavior of a set of Toggles.
		Toggles that belong to the same group could only have one of them to be switched on at a time.
		!#zh ToggleGroup 不是一个可见的 UI 组件，它可以用来修改一组 Toggle  组件的行为。当一组 Toggle 属于同一个 ToggleGroup 的时候，
		任何时候只能有一个 Toggle 处于选中状态。 */
		export class ToggleGroup extends Component {		
		/** !#en If this setting is true, a toggle could be switched off and on when pressed.
		If it is false, it will make sure there is always only one toggle could be switched on
		and the already switched on toggle can't be switched off.
		!#zh 如果这个设置为 true， 那么 toggle 按钮在被点击的时候可以反复地被选中和未选中。 */
		allowSwitchOff : boolean;	
	}		
		/** !#en cc.VideoPlayer is a component for playing videos, you can use it for showing videos in your game.
		!#zh Video 组件，用于在游戏中播放视频 */
		export class VideoPlayer extends _RendererUnderSG {		
		/** !#en The resource type of videoplayer, REMOTE for remote url and LOCAL for local file path.
		!#zh 视频来源：REMOTE 表示远程视频 URL，LOCAL 表示本地视频地址。 */
		resourceType : VideoPlayer.ResourceType;		
		/** !#en The remote URL of video.
		!#zh 远程视频的 URL */
		remoteURL : string;		
		/** !#en The local video full path.
		!#zh 本地视频的 URL */
		clip : string;		
		/** !#en The current playback time of the now playing item in seconds, you could also change the start playback time.
		!#zh 指定视频从什么时间点开始播放，单位是秒，也可以用来获取当前视频播放的时间进度。 */
		currentTime : number;		
		/** !#en Whether keep the aspect ration of the original video.
		!#zh 是否保持视频原来的宽高比 */
		keepAspectRatio : boolean;		
		/** !#en Whether play video in fullscreen mode.
		!#zh 是否全屏播放视频 */
		isFullscreen : boolean;		
		/** !#en the video player's callback, it will be triggered when certain event occurs, like: playing, paused, stopped and completed.
		!#zh 视频播放回调函数，该回调函数会在特定情况被触发，比如播放中，暂时，停止和完成播放。 */
		videoPlayerEvent : Component.EventHandler[];		
		/** !#en If a video is paused, call this method could resume playing. If a video is stopped, call this method to play from scratch.
		!#zh 如果视频被暂停播放了，调用这个接口可以继续播放。如果视频被停止播放了，调用这个接口可以从头开始播放。 
		*/
		play() : void;		
		/** !#en If a video is paused, call this method to resume playing.
		!#zh 如果一个视频播放被暂停播放了，调用这个接口可以继续播放。 
		*/
		resume() : void;		
		/** !#en If a video is playing, call this method to pause playing.
		!#zh 如果一个视频正在播放，调用这个接口可以暂停播放。 
		*/
		pause() : void;		
		/** !#en If a video is playing, call this method to stop playing immediately.
		!#zh 如果一个视频正在播放，调用这个接口可以立马停止播放。 
		*/
		stop() : void;	
	}		
		/** !#en
		Handling touch events in a ViewGroup takes special care,
		because it's common for a ViewGroup to have children that are targets for different touch events than the ViewGroup itself.
		To make sure that each view correctly receives the touch events intended for it,
		ViewGroup should register capture phase event and handle the event propagation properly.
		Please refer to Scrollview for more  information.
		
		!#zh
		ViewGroup的事件处理比较特殊，因为 ViewGroup 里面的子节点关心的事件跟 ViewGroup 本身可能不一样。
		为了让子节点能够正确地处理事件，ViewGroup 需要注册 capture 阶段的事件，并且合理地处理 ViewGroup 之间的事件传递。
		请参考 ScrollView 的实现来获取更多信息。 */
		export class ViewGroup extends Component {	
	}		
		/** !#en cc.WebView is a component for display web pages in the game
		!#zh WebView 组件，用于在游戏中显示网页 */
		export class WebView extends _RendererUnderSG {		
		/** !#en A given URL to be loaded by the WebView, it should have a http or https prefix.
		!#zh 指定 WebView 加载的网址，它应该是一个 http 或者 https 开头的字符串 */
		url : string;		
		/** !#en The webview's event callback , it will be triggered when certain webview event occurs.
		!#zh WebView 的回调事件，当网页加载过程中，加载完成后或者加载出错时都会回调此函数 */
		webviewLoadedEvents : Component.EventHandler[];	
	}		
		/** !#en
		Stores and manipulate the anchoring based on its parent.
		Widget are used for GUI but can also be used for other things.
		Widget will adjust current node's position and size automatically, but the results after adjustment can not be obtained until the next frame unless you call {{#crossLink "Widget/updateAlignment:method"}}{{/crossLink}} manually.
		!#zh
		Widget 组件，用于设置和适配其相对于父节点的边距，Widget 通常被用于 UI 界面，也可以用于其他地方。
		Widget 会自动调整当前节点的坐标和宽高，不过目前调整后的结果要到下一帧才能在脚本里获取到，除非你先手动调用 {{#crossLink "Widget/updateAlignment:method"}}{{/crossLink}}。 */
		export class Widget extends Component {		
		/** !#en Specifies an alignment target that can only be one of the parent nodes of the current node.
		The default value is null, and when null, indicates the current parent.
		!#zh 指定一个对齐目标，只能是当前节点的其中一个父节点，默认为空，为空时表示当前父节点。 */
		target : Node;		
		/** !#en Whether to align the top.
		!#zh 是否对齐上边。 */
		isAlignTop : boolean;		
		/** !#en
		Vertically aligns the midpoint, This will open the other vertical alignment options cancel.
		!#zh
		是否垂直方向对齐中点，开启此项会将垂直方向其他对齐选项取消。 */
		isAlignVerticalCenter : boolean;		
		/** !#en Whether to align the bottom.
		!#zh 是否对齐下边。 */
		isAlignBottom : boolean;		
		/** !#en Whether to align the left.
		!#zh 是否对齐左边 */
		isAlignLeft : boolean;		
		/** !#en
		Horizontal aligns the midpoint. This will open the other horizontal alignment options canceled.
		!#zh
		是否水平方向对齐中点，开启此选项会将水平方向其他对齐选项取消。 */
		isAlignHorizontalCenter : boolean;		
		/** !#en Whether to align the right.
		!#zh 是否对齐右边。 */
		isAlignRight : boolean;		
		/** !#en
		Whether the stretched horizontally, when enable the left and right alignment will be stretched horizontally,
		the width setting is invalid (read only).
		!#zh
		当前是否水平拉伸。当同时启用左右对齐时，节点将会被水平拉伸，此时节点的宽度只读。 */
		isStretchWidth : boolean;		
		/** !#en
		Whether the stretched vertically, when enable the left and right alignment will be stretched vertically,
		then height setting is invalid (read only)
		!#zh
		当前是否垂直拉伸。当同时启用上下对齐时，节点将会被垂直拉伸，此时节点的高度只读。 */
		isStretchHeight : boolean;		
		/** !#en
		The margins between the top of this node and the top of parent node,
		the value can be negative, Only available in 'isAlignTop' open.
		!#zh
		本节点顶边和父节点顶边的距离，可填写负值，只有在 isAlignTop 开启时才有作用。 */
		top : number;		
		/** !#en
		The margins between the bottom of this node and the bottom of parent node,
		the value can be negative, Only available in 'isAlignBottom' open.
		!#zh
		本节点底边和父节点底边的距离，可填写负值，只有在 isAlignBottom 开启时才有作用。 */
		bottom : number;		
		/** !#en
		The margins between the left of this node and the left of parent node,
		the value can be negative, Only available in 'isAlignLeft' open.
		!#zh
		本节点左边和父节点左边的距离，可填写负值，只有在 isAlignLeft 开启时才有作用。 */
		left : number;		
		/** !#en
		The margins between the right of this node and the right of parent node,
		the value can be negative, Only available in 'isAlignRight' open.
		!#zh
		本节点右边和父节点右边的距离，可填写负值，只有在 isAlignRight 开启时才有作用。 */
		right : number;		
		/** !#en
		Horizontal aligns the midpoint offset value,
		the value can be negative, Only available in 'isAlignHorizontalCenter' open.
		!#zh 水平居中的偏移值，可填写负值，只有在 isAlignHorizontalCenter 开启时才有作用。 */
		horizontalCenter : number;		
		/** !#en
		Vertical aligns the midpoint offset value,
		the value can be negative, Only available in 'isAlignVerticalCenter' open.
		!#zh 垂直居中的偏移值，可填写负值，只有在 isAlignVerticalCenter 开启时才有作用。 */
		verticalCenter : number;		
		/** !#en If true, horizontalCenter is pixel margin, otherwise is percentage (0 - 1) margin.
		!#zh 如果为 true，"horizontalCenter" 将会以像素作为偏移值，反之为百分比（0 到 1）。 */
		isAbsoluteHorizontalCenter : boolean;		
		/** !#en If true, verticalCenter is pixel margin, otherwise is percentage (0 - 1) margin.
		!#zh 如果为 true，"verticalCenter" 将会以像素作为偏移值，反之为百分比（0 到 1）。 */
		isAbsoluteVerticalCenter : boolean;		
		/** !#en
		If true, top is pixel margin, otherwise is percentage (0 - 1) margin relative to the parent's height.
		!#zh
		如果为 true，"top" 将会以像素作为边距，否则将会以相对父物体高度的百分比（0 到 1）作为边距。 */
		isAbsoluteTop : boolean;		
		/** !#en
		If true, bottom is pixel margin, otherwise is percentage (0 - 1) margin relative to the parent's height.
		!#zh
		如果为 true，"bottom" 将会以像素作为边距，否则将会以相对父物体高度的百分比（0 到 1）作为边距。 */
		isAbsoluteBottom : boolean;		
		/** !#en
		If true, left is pixel margin, otherwise is percentage (0 - 1) margin relative to the parent's width.
		!#zh
		如果为 true，"left" 将会以像素作为边距，否则将会以相对父物体宽度的百分比（0 到 1）作为边距。 */
		isAbsoluteLeft : boolean;		
		/** !#en
		If true, right is pixel margin, otherwise is percentage (0 - 1) margin relative to the parent's width.
		!#zh
		如果为 true，"right" 将会以像素作为边距，否则将会以相对父物体宽度的百分比（0 到 1）作为边距。 */
		isAbsoluteRight : boolean;		
		/** !#en TODO
		!#zh
		开启后仅会在 onEnable 的当帧结束时对齐一次，然后立刻禁用当前组件。
		这样便于脚本或动画继续控制当前节点。
		注意：onEnable 时所在的那一帧仍然会进行对齐。 */
		isAlignOnce : boolean;		
		/** !#en
		Immediately perform the widget alignment. You need to manually call this method only if
		you need to get the latest results after the alignment before the end of current frame.
		!#zh
		立刻执行 widget 对齐操作。这个接口一般不需要手工调用。
		只有当你需要在当前帧结束前获得 widget 对齐后的最新结果时才需要手动调用这个方法。
		
		@example 
		```js
		widget.top = 10;       // change top margin
		cc.log(widget.node.y); // not yet changed
		widget.updateAlignment();
		cc.log(widget.node.y); // changed
		``` 
		*/
		updateAlignment() : void;	
	}		
		/** undefined */
		export class Graphics extends _RendererUnderSG {		
		/** !#en
		Current line width.
		!#zh
		当前线条宽度 */
		lineWidth : number;		
		/** !#en
		lineJoin determines how two connecting segments (of lines, arcs or curves) with non-zero lengths in a shape are joined together.
		!#zh
		lineJoin 用来设置2个长度不为0的相连部分（线段，圆弧，曲线）如何连接在一起的属性。 */
		lineJoin : Graphics.LineJoin;		
		/** !#en
		lineCap determines how the end points of every line are drawn.
		!#zh
		lineCap 指定如何绘制每一条线段末端。 */
		lineCap : Graphics.LineCap;		
		/** !#en
		stroke color
		!#zh
		线段颜色 */
		strokeColor : Color;		
		/** !#en
		fill color
		!#zh
		填充颜色 */
		fillColor : Color;		
		/** !#en
		Sets the miter limit ratio
		!#zh
		设置斜接面限制比例 */
		miterLimit : number;		
		/** !#en Move path start point to (x,y).
		!#zh 移动路径起点到坐标(x, y)
		@param x The x axis of the coordinate for the end point.
		@param y The y axis of the coordinate for the end point. 
		*/
		moveTo(x? : number, y? : number) : void;		
		/** !#en Adds a straight line to the path
		!#zh 绘制直线路径
		@param x The x axis of the coordinate for the end point.
		@param y The y axis of the coordinate for the end point. 
		*/
		lineTo(x? : number, y? : number) : void;		
		/** !#en Adds a cubic Bézier curve to the path
		!#zh 绘制三次贝赛尔曲线路径
		@param c1x The x axis of the coordinate for the first control point.
		@param c1y The y axis of the coordinate for first control point.
		@param c2x The x axis of the coordinate for the second control point.
		@param c2y The y axis of the coordinate for the second control point.
		@param x The x axis of the coordinate for the end point.
		@param y The y axis of the coordinate for the end point. 
		*/
		bezierCurveTo(c1x? : number, c1y? : number, c2x? : number, c2y? : number, x? : number, y? : number) : void;		
		/** !#en Adds a quadratic Bézier curve to the path
		!#zh 绘制二次贝赛尔曲线路径
		@param cx The x axis of the coordinate for the control point.
		@param cy The y axis of the coordinate for the control point.
		@param x The x axis of the coordinate for the end point.
		@param y The y axis of the coordinate for the end point. 
		*/
		quadraticCurveTo(cx? : number, cy? : number, x? : number, y? : number) : void;		
		/** !#en Adds an arc to the path which is centered at (cx, cy) position with radius r starting at startAngle and ending at endAngle going in the given direction by counterclockwise (defaulting to false).
		!#zh 绘制圆弧路径。圆弧路径的圆心在 (cx, cy) 位置，半径为 r ，根据 counterclockwise （默认为false）指定的方向从 startAngle 开始绘制，到 endAngle 结束。
		@param cx The x axis of the coordinate for the center point.
		@param cy The y axis of the coordinate for the center point.
		@param r The arc's radius.
		@param startAngle The angle at which the arc starts, measured clockwise from the positive x axis and expressed in radians.
		@param endAngle The angle at which the arc ends, measured clockwise from the positive x axis and expressed in radians.
		@param counterclockwise An optional Boolean which, if true, causes the arc to be drawn counter-clockwise between the two angles. By default it is drawn clockwise. 
		*/
		arc(cx? : number, cy? : number, r? : number, startAngle? : number, endAngle? : number, counterclockwise? : number) : void;		
		/** !#en Adds an ellipse to the path.
		!#zh 绘制椭圆路径。
		@param cx The x axis of the coordinate for the center point.
		@param cy The y axis of the coordinate for the center point.
		@param rx The ellipse's x-axis radius.
		@param ry The ellipse's y-axis radius. 
		*/
		ellipse(cx? : number, cy? : number, rx? : number, ry? : number) : void;		
		/** !#en Adds an circle to the path.
		!#zh 绘制圆形路径。
		@param cx The x axis of the coordinate for the center point.
		@param cy The y axis of the coordinate for the center point.
		@param r The circle's radius. 
		*/
		circle(cx? : number, cy? : number, r? : number) : void;		
		/** !#en Adds an rectangle to the path.
		!#zh 绘制矩形路径。
		@param x The x axis of the coordinate for the rectangle starting point.
		@param y The y axis of the coordinate for the rectangle starting point.
		@param w The rectangle's width.
		@param h The rectangle's height. 
		*/
		rect(x? : number, y? : number, w? : number, h? : number) : void;		
		/** !#en Adds an round corner rectangle to the path.
		!#zh 绘制圆角矩形路径。
		@param x The x axis of the coordinate for the rectangle starting point.
		@param y The y axis of the coordinate for the rectangle starting point.
		@param w The rectangles width.
		@param h The rectangle's height.
		@param r The radius of the rectangle. 
		*/
		roundRect(x? : number, y? : number, w? : number, h? : number, r? : number) : void;		
		/** !#en Draws a filled rectangle.
		!#zh 绘制填充矩形。
		@param x The x axis of the coordinate for the rectangle starting point.
		@param y The y axis of the coordinate for the rectangle starting point.
		@param w The rectangle's width.
		@param h The rectangle's height. 
		*/
		fillRect(x? : number, y? : number, w? : number, h? : number) : void;		
		/** !#en Erasing any previously drawn content.
		!#zh 擦除之前绘制的所有内容的方法。 
		*/
		clear() : void;		
		/** !#en Causes the point of the pen to move back to the start of the current path. It tries to add a straight line from the current point to the start.
		!#zh 将笔点返回到当前路径起始点的。它尝试从当前点到起始点绘制一条直线。 
		*/
		close() : void;		
		/** !#en Strokes the current or given path with the current stroke style.
		!#zh 根据当前的画线样式，绘制当前或已经存在的路径。 
		*/
		stroke() : void;		
		/** !#en Fills the current or given path with the current fill style.
		!#zh 根据当前的画线样式，填充当前或已经存在的路径。 
		*/
		stroke() : void;	
	}		
		/** !#en
		<p>
		    The base class of event listener.                                                                        <br/>
		    If you need custom listener which with different callback, you need to inherit this class.               <br/>
		    For instance, you could refer to EventListenerAcceleration, EventListenerKeyboard,                       <br/>
		     EventListenerTouchOneByOne, EventListenerCustom.
		</p>
		
		!#zh
		封装用户的事件处理逻辑。
		注意：这是一个抽象类，开发者不应该直接实例化这个类，请参考 {{#crossLink "EventListener/create:method"}}cc.EventListener.create{{/crossLink}}。 */
		export class EventListener {		
		/** Constructor 
		*/
		EventListener(type : number, listenerID : number, callback : number) : EventListener;		
		/** !#en Checks whether the listener is available.
		!#zh 检测监听器是否有效 
		*/
		checkAvailable() : boolean;		
		/** !#en Clones the listener, its subclasses have to override this method.
		!#zh 克隆监听器,它的子类必须重写此方法。 
		*/
		clone() : EventListener;		
		/** !#en Enables or disables the listener
		!#zh 启用或禁用监听器。 
		*/
		setEnabled(enabled : boolean) : void;		
		/** !#en Checks whether the listener is enabled
		!#zh 检查监听器是否可用。 
		*/
		isEnabled() : boolean;		
		/** !#en The type code of unknown event listener.
		!#zh 未知的事件监听器类型 */
		UNKNOWN : number;		
		/** !#en The type code of keyboard event listener.
		!#zh 键盘事件监听器类型 */
		KEYBOARD : number;		
		/** !#en The type code of focus event listener.
		!#zh 加速器事件监听器类型 */
		ACCELERATION : number;		
		/** !#en
		Create a EventListener object with configuration including the event type, handlers and other parameters.
		In handlers, this refer to the event listener object itself.
		You can also pass custom parameters in the configuration object,
		all custom parameters will be polyfilled into the event listener object and can be accessed in handlers.
		!#zh 通过指定不同的 Event 对象来设置想要创建的事件监听器。
		@param argObj a json object
		
		@example 
		```js
		// Create KEYBOARD EventListener.
		cc.EventListener.create({
		    event: cc.EventListener.KEYBOARD,
		    onKeyPressed: function (keyCode, event) {
		        cc.log('pressed key: ' + keyCode);
		    },
		    onKeyReleased: function (keyCode, event) {
		        cc.log('released key: ' + keyCode);
		    }
		});
		
		// Create ACCELERATION EventListener.
		cc.EventListener.create({
		    event: cc.EventListener.ACCELERATION,
		    callback: function (acc, event) {
		        cc.log('acc: ' + keyCode);
		    }
		});
		``` 
		*/
		create(argObj : any) : EventListener;	
	}		
		/** !#en
		<p>
		 cc.eventManager is a singleton object which manages event listener subscriptions and event dispatching. <br/>
		                                                                                                             <br/>
		 The EventListener list is managed in such way so that event listeners can be added and removed          <br/>
		 while events are being dispatched.
		</p>
		!#zh
		事件管理器，它主要管理事件监听器注册和派发系统事件。
		原始设计中，它支持鼠标，触摸，键盘，陀螺仪和自定义事件。
		在 Creator 的设计中，鼠标，触摸和自定义事件的监听和派发请参考 http://cocos.com/docs/creator/scripting/events.html。 */
		export class eventManager {		
		/** !#en Pauses all listeners which are associated the specified target.
		!#zh 暂停传入的 node 相关的所有监听器的事件响应。 
		*/
		pauseTarget(node : Node, recursive : boolean) : void;		
		/** !#en Resumes all listeners which are associated the specified target.
		!#zh 恢复传入的 node 相关的所有监听器的事件响应。 
		*/
		resumeTarget(node : Node, recursive : boolean) : void;		
		/** !#en Query whether the specified event listener id has been added.
		!#zh 查询指定的事件 ID 是否存在
		@param listenerID The listener id. 
		*/
		hasEventListener(listenerID : string|number) : boolean;		
		/** !#en
		<p>
		Adds a event listener for a specified event.<br/>
		if the parameter "nodeOrPriority" is a node,
		it means to add a event listener for a specified event with the priority of scene graph.<br/>
		if the parameter "nodeOrPriority" is a Number,
		it means to add a event listener for a specified event with the fixed priority.<br/>
		</p>
		!#zh
		将事件监听器添加到事件管理器中。<br/>
		如果参数 “nodeOrPriority” 是节点，优先级由 node 的渲染顺序决定，显示在上层的节点将优先收到事件。<br/>
		如果参数 “nodeOrPriority” 是数字，优先级则固定为该参数的数值，数字越小，优先级越高。<br/>
		@param listener The listener of a specified event or a object of some event parameters.
		@param nodeOrPriority The priority of the listener is based on the draw order of this node or fixedPriority The fixed priority of the listener. 
		*/
		addListener(listener : EventListener|any, nodeOrPriority : Node|number) : EventListener;		
		/** !#en Remove a listener.
		!#zh 移除一个已添加的监听器。
		@param listener an event listener or a registered node target
		
		@example 
		```js
		
		// 1. remove eventManager add Listener;
		var mouseListener1 = cc.eventManager.addListener({
		    event: cc.EventListener.MOUSE,
		    onMouseDown:  function(keyCode, event){ },
		    onMouseUp: function(keyCode, event){ },
		    onMouseMove: function () { },
		    onMouseScroll: function () { }
		}, node);
		
		cc.eventManager.removeListener(mouseListener1);
		
		// 2. remove eventListener create Listener;
		var mouseListener2 = cc.EventListener.create({
		    event: cc.EventListener.MOUSE,
		    onMouseDown:  function(keyCode, event){ },
		    onMouseUp: function(keyCode, event){ },
		    onMouseMove: function () { },
		    onMouseScroll: function () { }
		});
		
		cc.eventManager.removeListener(mouseListener2);
		
		``` 
		*/
		removeListener(listener: (type: number, listenerID: number, callback: number) => void) : void;		
		/** !#en Removes all listeners with the same event listener type or removes all listeners of a node.
		!#zh
		移除注册到 eventManager 中指定类型的所有事件监听器。<br/>
		1. 如果传入的第一个参数类型是 Node，那么事件管理器将移除与该对象相关的所有事件监听器。
		（如果第二参数 recursive 是 true 的话，就会连同该对象的子控件上所有的事件监听器也一并移除）<br/>
		2. 如果传入的第一个参数类型是 Number（该类型 EventListener 中定义的事件类型），
		那么事件管理器将移除该类型的所有事件监听器。<br/>
		
		下列是目前存在监听器类型：       <br/>
		cc.EventListener.UNKNOWN       <br/>
		cc.EventListener.KEYBOARD      <br/>
		cc.EventListener.ACCELERATION，<br/>
		@param listenerType listenerType or a node 
		*/
		removeListeners(listenerType : number|Node, recursive : boolean) : void;		
		/** !#en Removes all listeners
		!#zh 移除所有事件监听器。 
		*/
		removeAllListeners() : void;		
		/** !#en Sets listener's priority with fixed value.
		!#zh 设置 FixedPriority 类型监听器的优先级。
		@param listener Constructor 
		*/
		setPriority(listener: (type: number, listenerID: number, callback: number) => void, fixedPriority : number) : void;		
		/** !#en Whether to enable dispatching events
		!#zh 启用或禁用事件管理器，禁用后不会分发任何事件。 
		*/
		setEnabled(enabled : boolean) : void;		
		/** !#en Checks whether dispatching events is enabled
		!#zh 检测事件管理器是否启用。 
		*/
		isEnabled() : boolean;	
	}		
		/** !#en The System event, it currently supports the key events and accelerometer events
		!#zh 系统事件，它目前支持按键事件和重力感应事件 */
		export class SystemEvent extends EventTarget {	
	}		
		/** !#en The touch event class
		!#zh 封装了触摸相关的信息。 */
		export class Touch {		
		/** !#en Returns the current touch location in OpenGL coordinates.、
		!#zh 获取当前触点位置。 
		*/
		getLocation() : Vec2;		
		/** !#en Returns X axis location value.
		!#zh 获取当前触点 X 轴位置。 
		*/
		getLocationX() : number;		
		/** !#en Returns Y axis location value.
		!#zh 获取当前触点 Y 轴位置。 
		*/
		getLocationY() : number;		
		/** !#en Returns the previous touch location in OpenGL coordinates.
		!#zh 获取触点在上一次事件时的位置对象，对象包含 x 和 y 属性。 
		*/
		getPreviousLocation() : Vec2;		
		/** !#en Returns the start touch location in OpenGL coordinates.
		!#zh 获获取触点落下时的位置对象，对象包含 x 和 y 属性。 
		*/
		getStartLocation() : Vec2;		
		/** !#en Returns the delta distance from the previous touche to the current one in screen coordinates.
		!#zh 获取触点距离上一次事件移动的距离对象，对象包含 x 和 y 属性。 
		*/
		getDelta() : Vec2;		
		/** !#en Returns the current touch location in screen coordinates.
		!#zh 获取当前事件在游戏窗口内的坐标位置对象，对象包含 x 和 y 属性。 
		*/
		getLocationInView() : Vec2;		
		/** !#en Returns the previous touch location in screen coordinates.
		!#zh 获取触点在上一次事件时在游戏窗口中的位置对象，对象包含 x 和 y 属性。 
		*/
		getPreviousLocationInView() : Vec2;		
		/** !#en Returns the start touch location in screen coordinates.
		!#zh 获取触点落下时在游戏窗口中的位置对象，对象包含 x 和 y 属性。 
		*/
		getStartLocationInView() : Vec2;		
		/** !#en Returns the id of cc.Touch.
		!#zh 触点的标识 ID，可以用来在多点触摸中跟踪触点。 
		*/
		getID() : number;		
		/** !#en Sets information to touch.
		!#zh 设置触摸相关的信息。用于监控触摸事件。 
		*/
		setTouchInfo(id : number, x : number, y : number) : void;	
	}		
		/** Loader for resource loading process. It's a singleton object. */
		export class loader extends Pipeline {		
		/** The downloader in cc.loader's pipeline, it's by default the first pipe.
		It's used to download files with several handlers: pure text, image, script, audio, font, uuid.
		You can add your own download function with addDownloadHandlers */
		downloader : any;		
		/** The downloader in cc.loader's pipeline, it's by default the second pipe.
		It's used to parse downloaded content with several handlers: JSON, image, plist, fnt, uuid.
		You can add your own download function with addLoadHandlers */
		loader : any;		
		/** Add custom supported types handler or modify existing type handler for download process.
		@param extMap Custom supported types with corresponded handler
		
		@example 
		```js
		cc.loader.addDownloadHandlers({
		     // This will match all url with `.scene` extension or all url with `scene` type
		     'scene' : function (url, callback) {}
		 });
		``` 
		*/
		addDownloadHandlers(extMap : any) : void;		
		/** Add custom supported types handler or modify existing type handler for load process.
		@param extMap Custom supported types with corresponded handler
		
		@example 
		```js
		cc.loader.addLoadHandlers({
		     // This will match all url with `.scene` extension or all url with `scene` type
		     'scene' : function (url, callback) {}
		 });
		``` 
		*/
		addLoadHandlers(extMap : any) : void;		
		/** Load resources with a progression callback and a complete callback.
		The progression callback is the same as Pipeline's {{#crossLink "Pipeline/onProgress:method"}}onProgress{{/crossLink}}
		The complete callback is almost the same as Pipeline's {{#crossLink "Pipeline/onComplete:method"}}onComplete{{/crossLink}}
		The only difference is when user pass a single url as resources, the complete callback will set its result directly as the second parameter.
		@param resources Url list in an array
		@param progressCallback Callback invoked when progression change
		@param completeCallback Callback invoked when all resources loaded
		
		@example 
		```js
		cc.loader.load('a.png', function (err, tex) {
		    cc.log('Result should be a texture: ' + (tex instanceof cc.Texture2D));
		});
		
		cc.loader.load('http://example.com/a.png', function (err, tex) {
		    cc.log('Should load a texture from external url: ' + (tex instanceof cc.Texture2D));
		});
		
		cc.loader.load({url: 'http://example.com/getImageREST?file=a.png', type: 'png'}, function (err, tex) {
		    cc.log('Should load a texture from RESTful API by specify the type: ' + (tex instanceof cc.Texture2D));
		});
		
		cc.loader.load(['a.png', 'b.json'], function (errors, results) {
		    if (errors) {
		        for (var i = 0; i < errors.length; i++) {
		            cc.log('Error url [' + errors[i] + ']: ' + results.getError(errors[i]));
		        }
		    }
		    var aTex = results.getContent('a.png');
		    var bJsonObj = results.getContent('b.json');
		});
		``` 
		*/
		load(resources : string|any[], progressCallback? : Function, completeCallback : Function) : void;		
		/** Load resources from the "resources" folder inside the "assets" folder of your project.<br>
		<br>
		Note: All asset urls in Creator use forward slashes, urls using backslashes will not work.
		@param url Url of the target resource.
		                      The url is relative to the "resources" folder, extensions must be omitted.
		@param type Only asset of type will be loaded if this argument is supplied.
		@param completeCallback Callback invoked when the resource loaded.
		
		@example 
		```js
		// load the prefab (project/assets/resources/misc/character/cocos) from resources folder
		cc.loader.loadRes('misc/character/cocos', function (err, prefab) {
		    if (err) {
		        cc.error(err.message || err);
		        return;
		    }
		    cc.log('Result should be a prefab: ' + (prefab instanceof cc.Prefab));
		});
		
		// load the sprite frame of (project/assets/resources/imgs/cocos.png) from resources folder
		cc.loader.loadRes('imgs/cocos', cc.SpriteFrame, function (err, spriteFrame) {
		    if (err) {
		        cc.error(err.message || err);
		        return;
		    }
		    cc.log('Result should be a sprite frame: ' + (spriteFrame instanceof cc.SpriteFrame));
		});
		``` 
		*/
		loadRes(url : string, type? : Function, completeCallback: (error: Error, resource: any) => void) : void;		
		/** Load all assets in a folder inside the "assets/resources" folder of your project.<br>
		<br>
		Note: All asset urls in Creator use forward slashes, urls using backslashes will not work.
		@param url Url of the target folder.
		                      The url is relative to the "resources" folder, extensions must be omitted.
		@param type Only asset of type will be loaded if this argument is supplied.
		@param completeCallback A callback which is called when all assets have been loaded, or an error occurs.
		
		@example 
		```js
		// load the texture (resources/imgs/cocos.png) and the corresponding sprite frame
		cc.loader.loadResDir('imgs/cocos', function (err, assets) {
		    if (err) {
		        cc.error(err);
		        return;
		    }
		    var texture = assets[0];
		    var spriteFrame = assets[1];
		});
		
		// load all textures in "resources/imgs/"
		cc.loader.loadResDir('imgs', cc.Texture2D, function (err, textures) {
		    if (err) {
		        cc.error(err);
		        return;
		    }
		    var texture1 = textures[0];
		    var texture2 = textures[1];
		});
		``` 
		*/
		loadResDir(url : string, type? : Function, completeCallback: (error: Error, assets: any[]) => void) : void;		
		/** Get resource data by id. <br>
		When you load resources with {{#crossLink "loader/load:method"}}{{/crossLink}} or {{#crossLink "loader/loadRes:method"}}{{/crossLink}},
		the url will be the unique identity of the resource.
		After loaded, you can acquire them by passing the url to this API.
		@param type Only asset of type will be returned if this argument is supplied. 
		*/
		getRes(url : string, type? : Function) : any;		
		/** !#en
		Release the content of an asset or an array of assets by uuid.
		Start from v1.3, this method will not only remove the cache of the asset in loader, but also clean up its content.
		For example, if you release a texture, the texture asset and its gl texture data will be freed up.
		In complexe project, you can use this function with {{#crossLink "loader/getDependsRecursively:method"}}{{/crossLink}} to free up memory in critical circumstances.
		Notice, this method may cause the texture to be unusable, if there are still other nodes use the same texture, they may turn to black and report gl errors.
		If you only want to remove the cache of an asset, please use {{#crossLink "pipeline/removeItem:method"}}{{/crossLink}}
		!#zh
		通过 id（通常是资源 url）来释放一个资源或者一个资源数组。
		从 v1.3 开始，这个方法不仅会从 loader 中删除资源的缓存引用，还会清理它的资源内容。
		比如说，当你释放一个 texture 资源，这个 texture 和它的 gl 贴图数据都会被释放。
		在复杂项目中，我们建议你结合 {{#crossLink "loader/getDependsRecursively:method"}}{{/crossLink}} 来使用，便于在设备内存告急的情况下更快地释放不再需要的资源的内存。
		注意，这个函数可能会导致资源贴图或资源所依赖的贴图不可用，如果场景中存在节点仍然依赖同样的贴图，它们可能会变黑并报 GL 错误。
		如果你只想删除一个资源的缓存引用，请使用 {{#crossLink "pipeline/removeItem:method"}}{{/crossLink}}
		
		@example 
		```js
		// Release a texture which is no longer need
		cc.loader.release(texture);
		// Release all dependencies of a loaded prefab
		var deps = cc.loader.getDependsRecursively('prefabs/sample');
		cc.loader.release(deps);
		// If there is no instance of this prefab in the scene, the prefab and its dependencies like textures, sprite frames, etc, will be freed up.
		// If you have some other nodes share a texture in this prefab, you can skip it in two ways:
		// 1. Forbid auto release a texture before release
		cc.loader.setAutoRelease(texture2d, false);
		// 2. Remove it from the dependencies array
		var deps = cc.loader.getDependsRecursively('prefabs/sample');
		var index = deps.indexOf(texture2d._uuid);
		if (index !== -1)
		    deps.splice(index, 1);
		cc.loader.release(deps);
		``` 
		*/
		release(asset : Asset|RawAsset|string|any[]) : void;		
		/** !#en Release the asset by its object. Refer to {{#crossLink "loader/release:method"}}{{/crossLink}} for detailed informations.
		!#zh 通过资源对象自身来释放资源。详细信息请参考 {{#crossLink "loader/release:method"}}{{/crossLink}} 
		*/
		releaseAsset(asset : Asset) : void;		
		/** !#en Release the asset loaded by {{#crossLink "loader/loadRes:method"}}{{/crossLink}}. Refer to {{#crossLink "loader/release:method"}}{{/crossLink}} for detailed informations.
		!#zh 释放通过 {{#crossLink "loader/loadRes:method"}}{{/crossLink}} 加载的资源。详细信息请参考 {{#crossLink "loader/release:method"}}{{/crossLink}}
		@param type Only asset of type will be released if this argument is supplied. 
		*/
		releaseRes(url : string, type? : Function) : void;		
		/** !#en Release the all assets loaded by {{#crossLink "loader/loadResDir:method"}}{{/crossLink}}. Refer to {{#crossLink "loader/release:method"}}{{/crossLink}} for detailed informations.
		!#zh 释放通过 {{#crossLink "loader/loadResDir:method"}}{{/crossLink}} 加载的资源。详细信息请参考 {{#crossLink "loader/release:method"}}{{/crossLink}}
		@param type Only asset of type will be released if this argument is supplied. 
		*/
		releaseResDir(url : string, type? : Function) : void;		
		/** !#en Resource all assets. Refer to {{#crossLink "loader/release:method"}}{{/crossLink}} for detailed informations.
		!#zh 释放所有资源。详细信息请参考 {{#crossLink "loader/release:method"}}{{/crossLink}} 
		*/
		releaseAll() : void;		
		/** !#en
		Indicates whether to release the asset when loading a new scene.<br>
		By default, when loading a new scene, all assets in the previous scene will be released or preserved
		according to whether the previous scene checked the "Auto Release Assets" option.
		On the other hand, assets dynamically loaded by using `cc.loader.loadRes` or `cc.loader.loadResDir`
		will not be affected by that option, remain not released by default.<br>
		Use this API to change the default behavior on a single asset, to force preserve or release specified asset when scene switching.<br>
		<br>
		See: {{#crossLink "loader/setAutoReleaseRecursively:method"}}cc.loader.setAutoReleaseRecursively{{/crossLink}}, {{#crossLink "loader/isAutoRelease:method"}}cc.loader.isAutoRelease{{/crossLink}}
		!#zh
		设置当场景切换时是否自动释放资源。<br>
		默认情况下，当加载新场景时，旧场景的资源根据旧场景是否勾选“Auto Release Assets”，将会被释放或者保留。
		而使用 `cc.loader.loadRes` 或 `cc.loader.loadResDir` 动态加载的资源，则不受场景设置的影响，默认不自动释放。<br>
		使用这个 API 可以在单个资源上改变这个默认行为，强制在切换场景时保留或者释放指定资源。<br>
		<br>
		参考：{{#crossLink "loader/setAutoReleaseRecursively:method"}}cc.loader.setAutoReleaseRecursively{{/crossLink}}，{{#crossLink "loader/isAutoRelease:method"}}cc.loader.isAutoRelease{{/crossLink}}
		@param assetOrUrlOrUuid asset object or the raw asset's url or uuid
		@param autoRelease indicates whether should release automatically
		
		@example 
		```js
		// auto release the texture event if "Auto Release Assets" disabled in current scene
		cc.loader.setAutoRelease(texture2d, true);
		// don't release the texture even if "Auto Release Assets" enabled in current scene
		cc.loader.setAutoRelease(texture2d, false);
		// first parameter can be url
		cc.loader.setAutoRelease(audioUrl, false);
		``` 
		*/
		setAutoRelease(assetOrUrlOrUuid : Asset|string, autoRelease : boolean) : void;		
		/** !#en
		Indicates whether to release the asset and its referenced other assets when loading a new scene.<br>
		By default, when loading a new scene, all assets in the previous scene will be released or preserved
		according to whether the previous scene checked the "Auto Release Assets" option.
		On the other hand, assets dynamically loaded by using `cc.loader.loadRes` or `cc.loader.loadResDir`
		will not be affected by that option, remain not released by default.<br>
		Use this API to change the default behavior on the specified asset and its recursively referenced assets, to force preserve or release specified asset when scene switching.<br>
		<br>
		See: {{#crossLink "loader/setAutoRelease:method"}}cc.loader.setAutoRelease{{/crossLink}}, {{#crossLink "loader/isAutoRelease:method"}}cc.loader.isAutoRelease{{/crossLink}}
		!#zh
		设置当场景切换时是否自动释放资源及资源引用的其它资源。<br>
		默认情况下，当加载新场景时，旧场景的资源根据旧场景是否勾选“Auto Release Assets”，将会被释放或者保留。
		而使用 `cc.loader.loadRes` 或 `cc.loader.loadResDir` 动态加载的资源，则不受场景设置的影响，默认不自动释放。<br>
		使用这个 API 可以在指定资源及资源递归引用到的所有资源上改变这个默认行为，强制在切换场景时保留或者释放指定资源。<br>
		<br>
		参考：{{#crossLink "loader/setAutoRelease:method"}}cc.loader.setAutoRelease{{/crossLink}}，{{#crossLink "loader/isAutoRelease:method"}}cc.loader.isAutoRelease{{/crossLink}}
		@param assetOrUrlOrUuid asset object or the raw asset's url or uuid
		@param autoRelease indicates whether should release automatically
		
		@example 
		```js
		// auto release the SpriteFrame and its Texture event if "Auto Release Assets" disabled in current scene
		cc.loader.setAutoReleaseRecursively(spriteFrame, true);
		// don't release the SpriteFrame and its Texture even if "Auto Release Assets" enabled in current scene
		cc.loader.setAutoReleaseRecursively(spriteFrame, false);
		// don't release the Prefab and all the referenced assets
		cc.loader.setAutoReleaseRecursively(prefab, false);
		``` 
		*/
		setAutoReleaseRecursively(assetOrUrlOrUuid : Asset|string, autoRelease : boolean) : void;		
		/** !#en
		Returns whether the asset is configured as auto released, despite how "Auto Release Assets" property is set on scene asset.<br>
		<br>
		See: {{#crossLink "loader/setAutoRelease:method"}}cc.loader.setAutoRelease{{/crossLink}}, {{#crossLink "loader/setAutoReleaseRecursively:method"}}cc.loader.setAutoReleaseRecursively{{/crossLink}}
		
		!#zh
		返回指定的资源是否有被设置为自动释放，不论场景的“Auto Release Assets”如何设置。<br>
		<br>
		参考：{{#crossLink "loader/setAutoRelease:method"}}cc.loader.setAutoRelease{{/crossLink}}，{{#crossLink "loader/setAutoReleaseRecursively:method"}}cc.loader.setAutoReleaseRecursively{{/crossLink}}
		@param assetOrUrl asset object or the raw asset's url 
		*/
		isAutoRelease(assetOrUrl : Asset|string) : boolean;	
	}		
		/** !#en
		LoadingItems is the queue of items which can flow them into the loading pipeline.</br>
		Please don't construct it directly, use {{#crossLink "LoadingItems.create"}}LoadingItems.create{{/crossLink}} instead, because we use an internal pool to recycle the queues.</br>
		It hold a map of items, each entry in the map is a url to object key value pair.</br>
		Each item always contains the following property:</br>
		- id: The identification of the item, usually it's identical to url</br>
		- url: The url </br>
		- type: The type, it's the extension name of the url by default, could be specified manually too.</br>
		- error: The error happened in pipeline will be stored in this property.</br>
		- content: The content processed by the pipeline, the final result will also be stored in this property.</br>
		- complete: The flag indicate whether the item is completed by the pipeline.</br>
		- states: An object stores the states of each pipe the item go through, the state can be: Pipeline.ItemState.WORKING | Pipeline.ItemState.ERROR | Pipeline.ItemState.COMPLETE</br>
		</br>
		Item can hold other custom properties.</br>
		Each LoadingItems object will be destroyed for recycle after onComplete callback</br>
		So please don't hold its reference for later usage, you can copy properties in it though.
		!#zh
		LoadingItems 是一个加载对象队列，可以用来输送加载对象到加载管线中。</br>
		请不要直接使用 new 构造这个类的对象，你可以使用 {{#crossLink "LoadingItems.create"}}LoadingItems.create{{/crossLink}} 来创建一个新的加载队列，这样可以允许我们的内部对象池回收并重利用加载队列。
		它有一个 map 属性用来存放加载项，在 map 对象中已 url 为 key 值。</br>
		每个对象都会包含下列属性：</br>
		- id：该对象的标识，通常与 url 相同。</br>
		- url：路径 </br>
		- type: 类型，它这是默认的 URL 的扩展名，可以手动指定赋值。</br>
		- error：pipeline 中发生的错误将被保存在这个属性中。</br>
		- content: pipeline 中处理的临时结果，最终的结果也将被存储在这个属性中。</br>
		- complete：该标志表明该对象是否通过 pipeline 完成。</br>
		- states：该对象存储每个管道中对象经历的状态，状态可以是 Pipeline.ItemState.WORKING | Pipeline.ItemState.ERROR | Pipeline.ItemState.COMPLETE</br>
		</br>
		对象可容纳其他自定义属性。</br>
		每个 LoadingItems 对象都会在 onComplete 回调之后被销毁，所以请不要持有它的引用并在结束回调之后依赖它的内容执行任何逻辑，有这种需求的话你可以提前复制它的内容。 */
		export class LoadingItems extends CallbacksInvoker {		
		/** !#en This is a callback which will be invoked while an item flow out the pipeline.
		You can pass the callback function in LoadingItems.create or set it later.
		!#zh 这个回调函数将在 item 加载结束后被调用。你可以在构造时传递这个回调函数或者是在构造之后直接设置。
		@param completedCount The number of the items that are already completed.
		@param totalCount The total number of the items.
		@param item The latest item which flow out the pipeline.
		
		@example 
		```js
		loadingItems.onProgress = function (completedCount, totalCount, item) {
		     var progress = (100 * completedCount / totalCount).toFixed(2);
		     cc.log(progress + '%');
		 }
		``` 
		*/
		onProgress(completedCount : number, totalCount : number, item : any) : void;		
		/** !#en This is a callback which will be invoked while all items is completed,
		You can pass the callback function in LoadingItems.create or set it later.
		!#zh 该函数将在加载队列全部完成时被调用。你可以在构造时传递这个回调函数或者是在构造之后直接设置。
		@param errors All errored urls will be stored in this array, if no error happened, then it will be null
		@param items All items.
		
		@example 
		```js
		loadingItems.onComplete = function (errors, items) {
		     if (error)
		         cc.log('Completed with ' + errors.length + ' errors');
		     else
		         cc.log('Completed ' + items.totalCount + ' items');
		 }
		``` 
		*/
		onComplete(errors : any[], items : LoadingItems) : void;		
		/** !#en The map of all items.
		!#zh 存储所有加载项的对象。 */
		map : any;		
		/** !#en The map of completed items.
		!#zh 存储已经完成的加载项。 */
		completed : any;		
		/** !#en Total count of all items.
		!#zh 所有加载项的总数。 */
		totalCount : number;		
		/** !#en Total count of completed items.
		!#zh 所有完成加载项的总数。 */
		completedCount : number;		
		/** !#en Activated or not.
		!#zh 是否启用。 */
		active : boolean;		
		/** !#en The constructor function of LoadingItems, this will use recycled LoadingItems in the internal pool if possible.
		You can pass onProgress and onComplete callbacks to visualize the loading process.
		!#zh LoadingItems 的构造函数，这种构造方式会重用内部对象缓冲池中的 LoadingItems 队列，以尽量避免对象创建。
		你可以传递 onProgress 和 onComplete 回调函数来获知加载进度信息。
		@param pipeline The pipeline to process the queue.
		@param urlList The items array.
		@param onProgress The progression callback, refer to {{#crossLink "LoadingItems.onProgress"}}{{/crossLink}}
		@param onComplete The completion callback, refer to {{#crossLink "LoadingItems.onComplete"}}{{/crossLink}}
		
		@example 
		```js
		LoadingItems.create(cc.loader, ['a.png', 'b.plist'], function (completedCount, totalCount, item) {
		     var progress = (100 * completedCount / totalCount).toFixed(2);
		     cc.log(progress + '%');
		 }, function (errors, items) {
		     if (errors) {
		         for (var i = 0; i < errors.length; ++i) {
		             cc.log('Error url: ' + errors[i] + ', error: ' + items.getError(errors[i]));
		         }
		     }
		     else {
		         var result_a = items.getContent('a.png');
		         // ...
		     }
		 })
		``` 
		*/
		create(pipeline : Pipeline, urlList : any[], onProgress : Function, onComplete : Function) : LoadingItems;		
		/** !#en Retrieve the LoadingItems queue object for an item.
		!#zh 通过 item 对象获取它的 LoadingItems 队列。
		@param item The item to query 
		*/
		getQueue(item : any) : LoadingItems;		
		/** !#en Complete an item in the LoadingItems queue, please do not call this method unless you know what's happening.
		!#zh 通知 LoadingItems 队列一个 item 对象已完成，请不要调用这个函数，除非你知道自己在做什么。
		@param item The item which has completed 
		*/
		itemComplete(item : any) : void;		
		/** !#en Add urls to the LoadingItems queue.
		!#zh 向一个 LoadingItems 队列添加加载项。
		@param urlList The url list to be appended, the url can be object or string 
		*/
		append(urlList : any[]) : any[];		
		/** !#en Complete a LoadingItems queue, please do not call this method unless you know what's happening.
		!#zh 完成一个 LoadingItems 队列，请不要调用这个函数，除非你知道自己在做什么。 
		*/
		allComplete() : void;		
		/** !#en Check whether all items are completed.
		!#zh 检查是否所有加载项都已经完成。 
		*/
		isCompleted() : boolean;		
		/** !#en Check whether an item is completed.
		!#zh 通过 id 检查指定加载项是否已经加载完成。
		@param id The item's id. 
		*/
		isItemCompleted(id : string) : boolean;		
		/** !#en Check whether an item exists.
		!#zh 通过 id 检查加载项是否存在。
		@param id The item's id. 
		*/
		exists(id : string) : boolean;		
		/** !#en Returns the content of an internal item.
		!#zh 通过 id 获取指定对象的内容。
		@param id The item's id. 
		*/
		getContent(id : string) : any;		
		/** !#en Returns the error of an internal item.
		!#zh 通过 id 获取指定对象的错误信息。
		@param id The item's id. 
		*/
		getError(id : string) : any;		
		/** !#en Add a listener for an item, the callback will be invoked when the item is completed.
		!#zh 监听加载项（通过 key 指定）的完成事件。
		@param callback can be null
		@param target can be null 
		*/
		addListener(key : string, callback : Function, target : any) : boolean;		
		/** !#en
		Check if the specified key has any registered callback. </br>
		If a callback is also specified, it will only return true if the callback is registered.
		!#zh
		检查指定的加载项是否有完成事件监听器。</br>
		如果同时还指定了一个回调方法，并且回调有注册，它只会返回 true。 
		*/
		hasListener(key : string, callback? : Function, target? : any) : boolean;		
		/** !#en
		Removes a listener. </br>
		It will only remove when key, callback, target all match correctly.
		!#zh
		移除指定加载项已经注册的完成事件监听器。</br>
		只会删除 key, callback, target 均匹配的监听器。 
		*/
		remove(key : string, callback : Function, target : any) : boolean;		
		/** !#en
		Removes all callbacks registered in a certain event
		type or all callbacks registered with a certain target.
		!#zh 删除指定目标的所有完成事件监听器。
		@param key The event key to be removed or the target to be removed 
		*/
		removeAllListeners(key : string|any) : void;		
		/** !#en Complete an item in the LoadingItems queue, please do not call this method unless you know what's happening.
		!#zh 通知 LoadingItems 队列一个 item 对象已完成，请不要调用这个函数，除非你知道自己在做什么。
		@param id The item url 
		*/
		itemComplete(id : string) : void;		
		/** !#en Destroy the LoadingItems queue, the queue object won't be garbage collected, it will be recycled, so every after destroy is not reliable.
		!#zh 销毁一个 LoadingItems 队列，这个队列对象会被内部缓冲池回收，所以销毁后的所有内部信息都是不可依赖的。 
		*/
		destroy() : void;	
	}		
		/** !#en
		A pipeline describes a sequence of manipulations, each manipulation is called a pipe.</br>
		It's designed for loading process. so items should be urls, and the url will be the identity of each item during the process.</br>
		A list of items can flow in the pipeline and it will output the results of all pipes.</br>
		They flow in the pipeline like water in tubes, they go through pipe by pipe separately.</br>
		Finally all items will flow out the pipeline and the process is finished.
		
		!#zh
		pipeline 描述了一系列的操作，每个操作都被称为 pipe。</br>
		它被设计来做加载过程的流程管理。所以 item 应该是 url，并且该 url 将是在处理中的每个 item 的身份标识。</br>
		一个 item 列表可以在 pipeline 中流动，它将输出加载项经过所有 pipe 之后的结果。</br>
		它们穿过 pipeline 就像水在管子里流动，将会按顺序流过每个 pipe。</br>
		最后当所有加载项都流出 pipeline 时，整个加载流程就结束了。 */
		export class Pipeline {		
		/** !#en
		Constructor, pass an array of pipes to construct a new Pipeline,
		the pipes will be chained in the given order.</br>
		A pipe is an object which must contain an `id` in string and a `handle` function,
		the id must be unique in the pipeline.</br>
		It can also include `async` property to identify whether it's an asynchronous process.
		!#zh
		构造函数，通过一系列的 pipe 来构造一个新的 pipeline，pipes 将会在给定的顺序中被锁定。</br>
		一个 pipe 就是一个对象，它包含了字符串类型的 ‘id’ 和 ‘handle’ 函数，在 pipeline 中 id 必须是唯一的。</br>
		它还可以包括 ‘async’ 属性以确定它是否是一个异步过程。
		
		@example 
		```js
		var pipeline = new Pipeline([
		     {
		         id: 'Downloader',
		         handle: function (item, callback) {},
		         async: true
		     },
		     {id: 'Parser', handle: function (item) {}, async: false}
		 ]);
		``` 
		*/
		Pipeline(pipes : any[]) : void;		
		/** !#en
		Insert a new pipe at the given index of the pipeline. </br>
		A pipe must contain an `id` in string and a `handle` function, the id must be unique in the pipeline.
		!#zh
		在给定的索引位置插入一个新的 pipe。</br>
		一个 pipe 必须包含一个字符串类型的 ‘id’ 和 ‘handle’ 函数，该 id 在 pipeline 必须是唯一标识。
		@param pipe The pipe to be inserted
		@param index The index to insert 
		*/
		insertPipe(pipe : any, index : number) : void;		
		/** !#en
		Add a new pipe at the end of the pipeline. </br>
		A pipe must contain an `id` in string and a `handle` function, the id must be unique in the pipeline.
		!#zh
		添加一个新的 pipe 到 pipeline 尾部。 </br>
		该 pipe 必须包含一个字符串类型 ‘id’ 和 ‘handle’ 函数，该 id 在 pipeline 必须是唯一标识。
		@param pipe The pipe to be appended 
		*/
		appendPipe(pipe : any) : void;		
		/** !#en
		Let new items flow into the pipeline. </br>
		Each item can be a simple url string or an object,
		if it's an object, it must contain `id` property. </br>
		You can specify its type by `type` property, by default, the type is the extension name in url. </br>
		By adding a `skips` property including pipe ids, you can skip these pipe. </br>
		The object can contain any supplementary property as you want. </br>
		!#zh
		让新的 item 流入 pipeline 中。</br>
		这里的每个 item 可以是一个简单字符串类型的 url 或者是一个对象,
		如果它是一个对象的话，他必须要包含 ‘id’ 属性。</br>
		你也可以指定它的 ‘type’ 属性类型，默认情况下，该类型是 ‘url’ 的后缀名。</br>
		也通过添加一个 包含 ‘skips’ 属性的 item 对象，你就可以跳过 skips 中包含的 pipe。</br>
		该对象可以包含任何附加属性。
		
		@example 
		```js
		pipeline.flowIn([
		     'res/Background.png',
		     {
		         id: 'res/scene.json',
		         type: 'scene',
		         name: 'scene',
		         skips: ['Downloader']
		     }
		 ]);
		``` 
		*/
		flowIn(items : any[]) : void;		
		/** !#en
		Let new items flow into the pipeline and give a callback when the list of items are all completed. </br>
		This is for loading dependencies for an existing item in flow, usually used in a pipe logic. </br>
		For example, we have a loader for scene configuration file in JSON, the scene will only be fully loaded  </br>
		after all its dependencies are loaded, then you will need to use function to flow in all dependencies  </br>
		found in the configuration file, and finish the loader pipe only after all dependencies are loaded (in the callback).
		!#zh
		让新 items 流入 pipeline 并且当 item 列表完成时进行回调函数。</br>
		这个 API 的使用通常是为了加载依赖项。</br>
		例如：</br>
		我们需要加载一个场景配置的 JSON 文件，该场景会将所有的依赖项全部都加载完毕以后，进行回调表示加载完毕。 
		*/
		flowInDeps(urlList : any[], callback : Function) : any[];		
		/** !#en
		Copy the item states from one source item to all destination items. </br>
		It's quite useful when a pipe generate new items from one source item,</br>
		then you should flowIn these generated items into pipeline, </br>
		but you probably want them to skip all pipes the source item already go through,</br>
		you can achieve it with this API. </br>
		</br>
		For example, an unzip pipe will generate more items, but you won't want them to pass unzip or download pipe again.
		!#zh
		从一个源 item 向所有目标 item 复制它的 pipe 状态，用于避免重复通过部分 pipe。</br>
		当一个源 item 生成了一系列新的 items 时很有用，</br>
		你希望让这些新的依赖项进入 pipeline，但是又不希望它们通过源 item 已经经过的 pipe，</br>
		但是你可能希望他们源 item 已经通过并跳过所有 pipes，</br>
		这个时候就可以使用这个 API。
		@param srcItem The source item
		@param dstItems A single destination item or an array of destination items 
		*/
		copyItemStates(srcItem : any, dstItems : any[]|any) : void;		
		/** !#en Returns whether the pipeline is flowing (contains item) currently.
		!#zh 获取 pipeline 当前是否正在处理中。 
		*/
		isFlowing() : boolean;		
		/** !#en Returns all items in pipeline.
		!#zh 获取 pipeline 中的所有 items。 
		*/
		getItems() : LoadingItems;		
		/** !#en Returns an item in pipeline.
		!#zh 根据 id 获取一个 item
		@param id The id of the item 
		*/
		getItem(id : any) : any;		
		/** !#en Removes an completed item in pipeline.
		It will only remove the cache in the pipeline or loader, its dependencies won't be released.
		cc.loader provided another method to completely cleanup the resource and its dependencies,
		please refer to {{#crossLink "loader/release:method"}}cc.loader.release{{/crossLink}}
		!#zh 移除指定的已完成 item。
		这将仅仅从 pipeline 或者 loader 中删除其缓存，并不会释放它所依赖的资源。
		cc.loader 中提供了另一种删除资源及其依赖的清理方法，请参考 {{#crossLink "loader/release:method"}}cc.loader.release{{/crossLink}}
		@param id The id of the item 
		*/
		removeItem(id : any) : boolean;		
		/** !#en Clear the current pipeline, this function will clean up the items.
		!#zh 清空当前 pipeline，该函数将清理 items。 
		*/
		clear() : void;	
	}		
		/** !#en
		A cc.SpriteFrame has:<br/>
		 - texture: A cc.Texture2D that will be used by the _ccsg.Sprite<br/>
		 - rectangle: A rectangle of the texture
		
		!#zh
		一个 SpriteFrame 包含：<br/>
		 - 纹理：会被 Sprite 使用的 Texture2D 对象。<br/>
		 - 矩形：在纹理中的矩形区域。 */
		export class SpriteFrame extends Asset {		
		/** !#en
		Constructor of SpriteFrame class.
		!#zh
		SpriteFrame 类的构造函数。
		@param rotated Whether the frame is rotated in the texture
		@param offset The offset of the frame in the texture
		@param originalSize The size of the frame in the texture 
		*/
		SpriteFrame(filename? : string|Texture2D, rect? : Rect, rotated? : boolean, offset? : Vec2, originalSize? : Size) : void;		
		/** !#en Top border of the sprite
		!#zh sprite 的顶部边框 */
		insetTop : number;		
		/** !#en Bottom border of the sprite
		!#zh sprite 的底部边框 */
		insetBottom : number;		
		/** !#en Left border of the sprite
		!#zh sprite 的左边边框 */
		insetLeft : number;		
		/** !#en Right border of the sprite
		!#zh sprite 的左边边框 */
		insetRight : number;		
		/** !#en Returns whether the texture have been loaded
		!#zh 返回是否已加载纹理 
		*/
		textureLoaded() : boolean;		
		/** Add a event listener for texture loaded event. 
		*/
		addLoadedEventListener(callback : Function, target : any) : void;		
		/** !#en Returns whether the sprite frame is rotated in the texture.
		!#zh 获取 SpriteFrame 是否旋转 
		*/
		isRotated() : boolean;		
		/** !#en Set whether the sprite frame is rotated in the texture.
		!#zh 设置 SpriteFrame 是否旋转 
		*/
		setRotated(bRotated : boolean) : void;		
		/** !#en Returns the rect of the sprite frame in the texture.
		!#zh 获取 SpriteFrame 的纹理矩形区域 
		*/
		getRect() : Rect;		
		/** !#en Sets the rect of the sprite frame in the texture.
		!#zh 设置 SpriteFrame 的纹理矩形区域 
		*/
		setRect(rect : Rect) : void;		
		/** !#en Returns the original size of the trimmed image.
		!#zh 获取修剪前的原始大小 
		*/
		getOriginalSize() : Size;		
		/** !#en Sets the original size of the trimmed image.
		!#zh 设置修剪前的原始大小 
		*/
		setOriginalSize(size : Size) : void;		
		/** !#en Returns the texture of the frame.
		!#zh 获取使用的纹理实例 
		*/
		getTexture() : Texture2D;		
		/** !#en Returns the offset of the frame in the texture.
		!#zh 获取偏移量 
		*/
		getOffset() : Vec2;		
		/** !#en Sets the offset of the frame in the texture.
		!#zh 设置偏移量 
		*/
		setOffset(offsets : Vec2) : void;		
		/** !#en Clone the sprite frame.
		!#zh 克隆 SpriteFrame 
		*/
		clone() : SpriteFrame;		
		/** #en Set SpriteFrame with Texture, rect, rotated, offset and originalSize.<br/>
		#zh 通过 Texture，rect，rotated，offset 和 originalSize 设置 SpriteFrame 
		*/
		setTexture(textureOrTextureFile : string|Texture2D, rect? : Rect, rotated? : boolean, offset? : Vec2, originalSize? : Size) : boolean;		
		/** !#en If a loading scene is marked as `asyncLoadAssets`, all the textures of the SpriteFrame which
		associated by user's custom Components in the scene, will not preload automatically.
		These textures will be load when Sprite component is going to render the SpriteFrames.
		You can call this method if you want to load the texture early.
		!#zh 当加载中的场景被标记为 `asyncLoadAssets` 时，用户在场景中由自定义组件关联到的所有 SpriteFrame 的贴图都不会被提前加载。
		只有当 Sprite 组件要渲染这些 SpriteFrame 时，才会检查贴图是否加载。如果你希望加载过程提前，你可以手工调用这个方法。
		
		@example 
		```js
		if (spriteFrame.textureLoaded()) {
		    this._onSpriteFrameLoaded();
		}
		else {
		    spriteFrame.once('load', this._onSpriteFrameLoaded, this);
		    spriteFrame.ensureLoadTexture();
		}
		``` 
		*/
		ensureLoadTexture() : void;	
	}		
		/** <p>
		 This class manages all events of input. include: touch, mouse, accelerometer, keyboard                                       <br/>
		</p> */
		export class inputManager {		
		/**  
		*/
		handleTouchesBegin(touches : any[]) : void;		
		/**  
		*/
		handleTouchesMove(touches : any[]) : void;		
		/**  
		*/
		handleTouchesEnd(touches : any[]) : void;		
		/**  
		*/
		handleTouchesCancel(touches : any[]) : void;		
		/**  
		*/
		getSetOfTouchesEndOrCancel(touches : any[]) : any[];		
		/**  
		*/
		getHTMLElementPosition(element : HTMLElement) : any;		
		/**  
		*/
		getPreTouch(touch : Touch) : Touch;		
		/**  
		*/
		setPreTouch(touch : Touch) : void;		
		/**  
		*/
		getTouchByXY(tx : number, ty : number, pos : Vec2) : Touch;		
		/**  
		*/
		getTouchByXY(location : Vec2, pos : Vec2, eventType : number) : Event.EventMouse;		
		/**  
		*/
		getPointByEvent(event : Touch, pos : Vec2) : Vec2;		
		/**  
		*/
		getTouchesByEvent(event : Touch, pos : Vec2) : any[];		
		/**  
		*/
		registerSystemEvent(element : HTMLElement) : void;		
		/**  
		*/
		update(dt : number) : void;	
	}	
	/** !#en Key map for keyboard event
	!#zh 键盘事件的按键值 */
	export enum KEY {		
		none = 0,
		back = 0,
		menu = 0,
		backspace = 0,
		tab = 0,
		enter = 0,
		shift = 0,
		ctrl = 0,
		alt = 0,
		pause = 0,
		capslock = 0,
		escape = 0,
		space = 0,
		pageup = 0,
		pagedown = 0,
		end = 0,
		home = 0,
		left = 0,
		up = 0,
		right = 0,
		down = 0,
		select = 0,
		insert = 0,
		Delete = 0,
		a = 0,
		b = 0,
		c = 0,
		d = 0,
		e = 0,
		f = 0,
		g = 0,
		h = 0,
		i = 0,
		j = 0,
		k = 0,
		l = 0,
		m = 0,
		n = 0,
		o = 0,
		p = 0,
		q = 0,
		r = 0,
		s = 0,
		t = 0,
		u = 0,
		v = 0,
		w = 0,
		x = 0,
		y = 0,
		z = 0,
		num0 = 0,
		num1 = 0,
		num2 = 0,
		num3 = 0,
		num4 = 0,
		num5 = 0,
		num6 = 0,
		num7 = 0,
		num8 = 0,
		num9 = 0,
		'*' = 0,
		'+' = 0,
		'-' = 0,
		numdel = 0,
		'/' = 0,
		f1 = 0,
		f2 = 0,
		f3 = 0,
		f4 = 0,
		f5 = 0,
		f6 = 0,
		f7 = 0,
		f8 = 0,
		f9 = 0,
		f10 = 0,
		f11 = 0,
		f12 = 0,
		numlock = 0,
		scrolllock = 0,
		';' = 0,
		semicolon = 0,
		equal = 0,
		'=' = 0,
		',' = 0,
		comma = 0,
		dash = 0,
		'.' = 0,
		period = 0,
		forwardslash = 0,
		grave = 0,
		'[' = 0,
		openbracket = 0,
		backslash = 0,
		']' = 0,
		closebracket = 0,
		quote = 0,
		dpadLeft = 0,
		dpadRight = 0,
		dpadUp = 0,
		dpadDown = 0,
		dpadCenter = 0,	
	}	
	/** Image formats */
	export enum ImageFormat {		
		JPG = 0,
		PNG = 0,
		TIFF = 0,
		WEBP = 0,
		PVR = 0,
		ETC = 0,
		S3TC = 0,
		ATITC = 0,
		TGA = 0,
		RAWDATA = 0,
		UNKNOWN = 0,
		getImageFormatByData = 0,	
	}	
	/** Predefined constants */
	export enum Macro {		
		INVALID_INDEX = 0,
		NODE_TAG_INVALID = 0,
		PI = 0,
		PI2 = 0,
		FLT_MAX = 0,
		FLT_MIN = 0,
		RAD = 0,
		DEG = 0,
		UINT_MAX = 0,
		REPEAT_FOREVER = 0,
		FLT_EPSILON = 0,
		ONE = 0,
		ZERO = 0,
		SRC_ALPHA = 0,
		SRC_ALPHA_SATURATE = 0,
		SRC_COLOR = 0,
		DST_ALPHA = 0,
		DST_COLOR = 0,
		ONE_MINUS_SRC_ALPHA = 0,
		ONE_MINUS_SRC_COLOR = 0,
		ONE_MINUS_DST_ALPHA = 0,
		ONE_MINUS_DST_COLOR = 0,
		ONE_MINUS_CONSTANT_ALPHA = 0,
		ONE_MINUS_CONSTANT_COLOR = 0,
		LINEAR = 0,
		BLEND_DST = 0,
		WEB_ORIENTATION_PORTRAIT = 0,
		WEB_ORIENTATION_LANDSCAPE_LEFT = 0,
		WEB_ORIENTATION_PORTRAIT_UPSIDE_DOWN = 0,
		WEB_ORIENTATION_LANDSCAPE_RIGHT = 0,
		ORIENTATION_PORTRAIT = 0,
		ORIENTATION_LANDSCAPE = 0,
		ORIENTATION_AUTO = 0,
		VERTEX_ATTRIB_FLAG_NONE = 0,
		VERTEX_ATTRIB_FLAG_POSITION = 0,
		VERTEX_ATTRIB_FLAG_COLOR = 0,
		VERTEX_ATTRIB_FLAG_TEX_COORDS = 0,
		VERTEX_ATTRIB_FLAG_POS_COLOR_TEX = 0,
		GL_ALL = 0,
		VERTEX_ATTRIB_POSITION = 0,
		VERTEX_ATTRIB_COLOR = 0,
		VERTEX_ATTRIB_TEX_COORDS = 0,
		VERTEX_ATTRIB_MAX = 0,
		UNIFORM_PMATRIX = 0,
		UNIFORM_MVMATRIX = 0,
		UNIFORM_MVPMATRIX = 0,
		UNIFORM_TIME = 0,
		UNIFORM_SINTIME = 0,
		UNIFORM_COSTIME = 0,
		UNIFORM_RANDOM01 = 0,
		UNIFORM_SAMPLER = 0,
		UNIFORM_MAX = 0,
		SHADER_POSITION_TEXTURECOLOR = 0,
		SHADER_SPRITE_POSITION_TEXTURECOLOR = 0,
		SHADER_POSITION_TEXTURECOLORALPHATEST = 0,
		SHADER_SPRITE_POSITION_TEXTURECOLORALPHATEST = 0,
		SHADER_POSITION_COLOR = 0,
		SHADER_SPRITE_POSITION_COLOR = 0,
		SHADER_POSITION_TEXTURE = 0,
		SHADER_POSITION_TEXTURE_UCOLOR = 0,
		SHADER_POSITION_TEXTUREA8COLOR = 0,
		SHADER_POSITION_UCOLOR = 0,
		SHADER_POSITION_LENGTHTEXTURECOLOR = 0,
		UNIFORM_PMATRIX_S = 0,
		UNIFORM_MVMATRIX_S = 0,
		UNIFORM_MVPMATRIX_S = 0,
		UNIFORM_TIME_S = 0,
		UNIFORM_SINTIME_S = 0,
		UNIFORM_COSTIME_S = 0,
		UNIFORM_RANDOM01_S = 0,
		UNIFORM_SAMPLER_S = 0,
		UNIFORM_ALPHA_TEST_VALUE_S = 0,
		ATTRIBUTE_NAME_COLOR = 0,
		ATTRIBUTE_NAME_POSITION = 0,
		ATTRIBUTE_NAME_TEX_COORD = 0,
		ITEM_SIZE = 0,
		CURRENT_ITEM = 0,
		ZOOM_ACTION_TAG = 0,
		NORMAL_TAG = 0,
		SELECTED_TAG = 0,
		DISABLE_TAG = 0,
		FIX_ARTIFACTS_BY_STRECHING_TEXEL = 0,
		DIRECTOR_STATS_POSITION = 0,
		DIRECTOR_FPS_INTERVAL = 0,
		COCOSNODE_RENDER_SUBPIXEL = 0,
		SPRITEBATCHNODE_RENDER_SUBPIXEL = 0,
		AUTO_PREMULTIPLIED_ALPHA_FOR_PNG = 0,
		OPTIMIZE_BLEND_FUNC_FOR_PREMULTIPLIED_ALPHA = 0,
		TEXTURE_ATLAS_USE_TRIANGLE_STRIP = 0,
		TEXTURE_ATLAS_USE_VAO = 0,
		TEXTURE_NPOT_SUPPORT = 0,
		USE_LA88_LABELS = 0,
		SPRITE_DEBUG_DRAW = 0,
		LABELBMFONT_DEBUG_DRAW = 0,
		LABELATLAS_DEBUG_DRAW = 0,
		ENABLE_STACKABLE_ACTIONS = 0,
		ENABLE_GL_STATE_CACHE = 0,
		TOUCH_TIMEOUT = 0,
		BATCH_VERTEX_COUNT = 0,
		ENABLE_GC_FOR_NATIVE_OBJECTS = 0,	
	}		
		/** The base class of most of all the objects in Fireball. */
		export class Object {		
		/** !#en The name of the object.
		!#zh 该对象的名称。 */
		name : string;		
		/** !#en Indicates whether the object is not yet destroyed.
		!#zh 表示该对象是否可用（被销毁后将不可用）。 */
		isValid : boolean;		
		/** !#en
		Destroy this Object, and release all its own references to other objects.<br/>
		Actual object destruction will delayed until before rendering.
		<br/>
		After destroy, this CCObject is not usable any more.
		You can use cc.isValid(obj) to check whether the object is destroyed before accessing it.
		!#zh
		销毁该对象，并释放所有它对其它对象的引用。<br/>
		销毁后，CCObject 不再可用。您可以在访问对象之前使用 cc.isValid(obj) 来检查对象是否已被销毁。
		实际销毁操作会延迟到当前帧渲染前执行。
		
		@example 
		```js
		obj.destroy();
		``` 
		*/
		destroy() : boolean;	
	}		
		/** Bit mask that controls object states. */
		export class Flags {		
		/** !#en The object will not be saved.
		!#zh 该对象将不会被保存。 */
		DontSave : number;		
		/** !#en The object will not be saved when building a player.
		!#zh 构建项目时，该对象将不会被保存。 */
		EditorOnly : number;	
	}		
		/** The fullscreen API provides an easy way for web content to be presented using the user's entire screen.
		It's invalid on safari, QQbrowser and android browser */
		export class screen {		
		/** initialize 
		*/
		init() : void;		
		/** return true if it's full now. 
		*/
		fullScreen() : boolean;		
		/** change the screen to full mode. 
		*/
		requestFullScreen(element : Element, onFullScreenChange : Function) : void;		
		/** exit the full mode. 
		*/
		exitFullScreen() : boolean;		
		/** Automatically request full screen with a touch/click event 
		*/
		autoFullScreen(element : Element, onFullScreenChange : Function) : void;	
	}		
		/** System variables */
		export class sys {		
		/** English language code */
		LANGUAGE_ENGLISH : string;		
		/** Chinese language code */
		LANGUAGE_CHINESE : string;		
		/** French language code */
		LANGUAGE_FRENCH : string;		
		/** Italian language code */
		LANGUAGE_ITALIAN : string;		
		/** German language code */
		LANGUAGE_GERMAN : string;		
		/** Spanish language code */
		LANGUAGE_SPANISH : string;		
		/** Spanish language code */
		LANGUAGE_DUTCH : string;		
		/** Russian language code */
		LANGUAGE_RUSSIAN : string;		
		/** Korean language code */
		LANGUAGE_KOREAN : string;		
		/** Japanese language code */
		LANGUAGE_JAPANESE : string;		
		/** Hungarian language code */
		LANGUAGE_HUNGARIAN : string;		
		/** Portuguese language code */
		LANGUAGE_PORTUGUESE : string;		
		/** Arabic language code */
		LANGUAGE_ARABIC : string;		
		/** Norwegian language code */
		LANGUAGE_NORWEGIAN : string;		
		/** Polish language code */
		LANGUAGE_POLISH : string;		
		/** Turkish language code */
		LANGUAGE_TURKISH : string;		
		/** Ukrainian language code */
		LANGUAGE_UKRAINIAN : string;		
		/** Romanian language code */
		LANGUAGE_ROMANIAN : string;		
		/** Bulgarian language code */
		LANGUAGE_BULGARIAN : string;		
		/** Unknown language code */
		LANGUAGE_UNKNOWN : string;		
		OS_IOS : string;		
		OS_ANDROID : string;		
		OS_WINDOWS : string;		
		OS_MARMALADE : string;		
		OS_LINUX : string;		
		OS_BADA : string;		
		OS_BLACKBERRY : string;		
		OS_OSX : string;		
		OS_WP8 : string;		
		OS_WINRT : string;		
		OS_UNKNOWN : string;		
		UNKNOWN : number;		
		WIN32 : number;		
		LINUX : number;		
		MACOS : number;		
		ANDROID : number;		
		IPHONE : number;		
		IPAD : number;		
		BLACKBERRY : number;		
		NACL : number;		
		EMSCRIPTEN : number;		
		TIZEN : number;		
		WINRT : number;		
		WP8 : number;		
		MOBILE_BROWSER : number;		
		DESKTOP_BROWSER : number;		
		/** Indicates whether executes in editor's window process (Electron's renderer context) */
		EDITOR_PAGE : number;		
		/** Indicates whether executes in editor's main process (Electron's browser context) */
		EDITOR_CORE : number;		
		/** BROWSER_TYPE_WECHAT */
		BROWSER_TYPE_WECHAT : string;		
		BROWSER_TYPE_ANDROID : string;		
		BROWSER_TYPE_IE : string;		
		BROWSER_TYPE_QQ : string;		
		BROWSER_TYPE_MOBILE_QQ : string;		
		BROWSER_TYPE_UC : string;		
		BROWSER_TYPE_360 : string;		
		BROWSER_TYPE_BAIDU_APP : string;		
		BROWSER_TYPE_BAIDU : string;		
		BROWSER_TYPE_MAXTHON : string;		
		BROWSER_TYPE_OPERA : string;		
		BROWSER_TYPE_OUPENG : string;		
		BROWSER_TYPE_MIUI : string;		
		BROWSER_TYPE_FIREFOX : string;		
		BROWSER_TYPE_SAFARI : string;		
		BROWSER_TYPE_CHROME : string;		
		BROWSER_TYPE_LIEBAO : string;		
		BROWSER_TYPE_QZONE : string;		
		BROWSER_TYPE_SOUGOU : string;		
		BROWSER_TYPE_UNKNOWN : string;		
		/** Is native ? This is set to be true in jsb auto. */
		isNative : boolean;		
		/** Is web browser ? */
		isBrowser : boolean;		
		/** Indicate whether system is mobile system */
		isMobile : boolean;		
		/** Indicate the running platform */
		platform : number;		
		/** Indicate the current language of the running system */
		language : string;		
		/** Indicate the running os name */
		os : string;		
		/** Indicate the running os version */
		osVersion : string;		
		/** Indicate the running os main version */
		osMainVersion : number;		
		/** Indicate the running browser type */
		browserType : string;		
		/** Indicate the running browser version */
		browserVersion : string;		
		/** Indicate the real pixel resolution of the whole game window */
		windowPixelResolution : Size;		
		/** cc.sys.localStorage is a local storage component. */
		localStorage : any;		
		/** The capabilities of the current platform */
		capabilities : any;		
		/** Forces the garbage collection, only available in JSB 
		*/
		garbageCollect() : void;		
		/** Dumps rooted objects, only available in JSB 
		*/
		dumpRoot() : void;		
		/** Restart the JS VM, only available in JSB 
		*/
		restartVM() : void;		
		/** Clean a script in the JS VM, only available in JSB 
		*/
		cleanScript(jsfile : string) : void;		
		/** Check whether an object is valid,
		In web engine, it will return true if the object exist
		In native engine, it will return true if the JS object and the correspond native object are both valid 
		*/
		isObjectValid(obj : any) : boolean;		
		/** Dump system informations 
		*/
		dump() : void;		
		/** Open a url in browser 
		*/
		openURL(url : string) : void;		
		/** Get the number of milliseconds elapsed since 1 January 1970 00:00:00 UTC. 
		*/
		now() : number;	
	}		
		/** cc.view is the singleton object which represents the game window.<br/>
		It's main task include: <br/>
		 - Apply the design resolution policy<br/>
		 - Provide interaction with the window, like resize event on web, retina display support, etc...<br/>
		 - Manage the game view port which can be different with the window<br/>
		 - Manage the content scale and translation<br/>
		<br/>
		Since the cc.view is a singleton, you don't need to call any constructor or create functions,<br/>
		the standard way to use it is by calling:<br/>
		 - cc.view.methodName(); <br/> */
		export class View {		
		/** <p>
		Sets view's target-densitydpi for android mobile browser. it can be set to:           <br/>
		  1. cc.macro.DENSITYDPI_DEVICE, value is "device-dpi"                                      <br/>
		  2. cc.macro.DENSITYDPI_HIGH, value is "high-dpi"  (default value)                         <br/>
		  3. cc.macro.DENSITYDPI_MEDIUM, value is "medium-dpi" (browser's default value)            <br/>
		  4. cc.macro.DENSITYDPI_LOW, value is "low-dpi"                                            <br/>
		  5. Custom value, e.g: "480"                                                         <br/>
		</p> 
		*/
		setTargetDensityDPI(densityDPI : string) : void;		
		/** Returns the current target-densitydpi value of cc.view. 
		*/
		getTargetDensityDPI() : string;		
		/** Sets whether resize canvas automatically when browser's size changed.<br/>
		Useful only on web.
		@param enabled Whether enable automatic resize with browser's resize event 
		*/
		resizeWithBrowserSize(enabled : boolean) : void;		
		/** Sets the callback function for cc.view's resize action,<br/>
		this callback will be invoked before applying resolution policy, <br/>
		so you can do any additional modifications within the callback.<br/>
		Useful only on web.
		@param callback The callback function 
		*/
		setResizeCallback(callback : Function|void) : void;		
		/** Sets the orientation of the game, it can be landscape, portrait or auto.
		When set it to landscape or portrait, and screen w/h ratio doesn't fit,
		cc.view will automatically rotate the game canvas using CSS.
		Note that this function doesn't have any effect in native,
		in native, you need to set the application orientation in native project settings
		@param orientation Possible values: cc.macro.ORIENTATION_LANDSCAPE | cc.macro.ORIENTATION_PORTRAIT | cc.macro.ORIENTATION_AUTO 
		*/
		setOrientation(orientation : number) : void;		
		/** Sets whether the engine modify the "viewport" meta in your web page.<br/>
		It's enabled by default, we strongly suggest you not to disable it.<br/>
		And even when it's enabled, you can still set your own "viewport" meta, it won't be overridden<br/>
		Only useful on web
		@param enabled Enable automatic modification to "viewport" meta 
		*/
		adjustViewPort(enabled : boolean) : void;		
		/** Retina support is enabled by default for Apple device but disabled for other devices,<br/>
		it takes effect only when you called setDesignResolutionPolicy<br/>
		Only useful on web
		@param enabled Enable or disable retina display 
		*/
		enableRetina(enabled : boolean) : void;		
		/** Check whether retina display is enabled.<br/>
		Only useful on web 
		*/
		isRetinaEnabled() : boolean;		
		/** !#en Whether to Enable on anti-alias
		!#zh 控制抗锯齿是否开启
		@param enabled Enable or not anti-alias 
		*/
		enableAntiAlias(enabled : boolean) : void;		
		/** !#en Returns whether the current enable on anti-alias
		!#zh 返回当前是否抗锯齿 
		*/
		isAntiAliasEnabled() : boolean;		
		/** If enabled, the application will try automatically to enter full screen mode on mobile devices<br/>
		You can pass true as parameter to enable it and disable it by passing false.<br/>
		Only useful on web
		@param enabled Enable or disable auto full screen on mobile devices 
		*/
		enableAutoFullScreen(enabled : boolean) : void;		
		/** Check whether auto full screen is enabled.<br/>
		Only useful on web 
		*/
		isAutoFullScreenEnabled() : boolean;		
		/** Get whether render system is ready(no matter opengl or canvas),<br/>
		this name is for the compatibility with cocos2d-x, subclass must implement this method. 
		*/
		isViewReady() : boolean;		
		/** Sets the resolution translate on View. 
		*/
		setContentTranslateLeftTop(offsetLeft : number, offsetTop : number) : void;		
		/** Returns the resolution translate on View 
		*/
		getContentTranslateLeftTop() : Size;		
		/** Returns the frame size of the view.<br/>
		On native platforms, it returns the screen size since the view is a fullscreen view.<br/>
		On web, it returns the size of the canvas's outer DOM element. 
		*/
		getFrameSize() : Size;		
		/** On native, it sets the frame size of view.<br/>
		On web, it sets the size of the canvas's outer DOM element. 
		*/
		setFrameSize(width : number, height : number) : void;		
		/** Returns the visible area size of the view port. 
		*/
		getVisibleSize() : Size;		
		/** Returns the visible area size of the view port. 
		*/
		getVisibleSizeInPixel() : Size;		
		/** Returns the visible origin of the view port. 
		*/
		getVisibleOrigin() : Vec2;		
		/** Returns the visible origin of the view port. 
		*/
		getVisibleOriginInPixel() : Vec2;		
		/** Returns whether developer can set content's scale factor. 
		*/
		canSetContentScaleFactor() : boolean;		
		/** Returns the current resolution policy 
		*/
		getResolutionPolicy() : ResolutionPolicy;		
		/** Sets the current resolution policy 
		*/
		setResolutionPolicy(resolutionPolicy : ResolutionPolicy|number) : void;		
		/** Sets the resolution policy with designed view size in points.<br/>
		The resolution policy include: <br/>
		[1] ResolutionExactFit       Fill screen by stretch-to-fit: if the design resolution ratio of width to height is different from the screen resolution ratio, your game view will be stretched.<br/>
		[2] ResolutionNoBorder       Full screen without black border: if the design resolution ratio of width to height is different from the screen resolution ratio, two areas of your game view will be cut.<br/>
		[3] ResolutionShowAll        Full screen with black border: if the design resolution ratio of width to height is different from the screen resolution ratio, two black borders will be shown.<br/>
		[4] ResolutionFixedHeight    Scale the content's height to screen's height and proportionally scale its width<br/>
		[5] ResolutionFixedWidth     Scale the content's width to screen's width and proportionally scale its height<br/>
		[cc.ResolutionPolicy]        [Web only feature] Custom resolution policy, constructed by cc.ResolutionPolicy<br/>
		@param width Design resolution width.
		@param height Design resolution height.
		@param resolutionPolicy The resolution policy desired 
		*/
		setDesignResolutionSize(width : number, height : number, resolutionPolicy : ResolutionPolicy|number) : void;		
		/** Returns the designed size for the view.
		Default resolution size is the same as 'getFrameSize'. 
		*/
		getDesignResolutionSize() : Size;		
		/** Sets the container to desired pixel resolution and fit the game content to it.
		This function is very useful for adaptation in mobile browsers.
		In some HD android devices, the resolution is very high, but its browser performance may not be very good.
		In this case, enabling retina display is very costy and not suggested, and if retina is disabled, the image may be blurry.
		But this API can be helpful to set a desired pixel resolution which is in between.
		This API will do the following:
		    1. Set viewport's width to the desired width in pixel
		    2. Set body width to the exact pixel resolution
		    3. The resolution policy will be reset with designed view size in points.
		@param width Design resolution width.
		@param height Design resolution height.
		@param resolutionPolicy The resolution policy desired 
		*/
		setRealPixelResolution(width : number, height : number, resolutionPolicy : ResolutionPolicy|number) : void;		
		/** Sets view port rectangle with points.
		@param w width
		@param h height 
		*/
		setViewPortInPoints(x : number, y : number, w : number, h : number) : void;		
		/** Sets Scissor rectangle with points. 
		*/
		setScissorInPoints(x : number, y : number, w : number, h : number) : void;		
		/** Returns whether GL_SCISSOR_TEST is enable 
		*/
		isScissorEnabled() : boolean;		
		/** Returns the current scissor rectangle 
		*/
		getScissorRect() : Rect;		
		/** Sets the name of the view 
		*/
		setViewName(viewName : string) : void;		
		/** Returns the name of the view 
		*/
		getViewName() : string;		
		/** Returns the view port rectangle. 
		*/
		getViewPortRect() : Rect;		
		/** Returns scale factor of the horizontal direction (X axis). 
		*/
		getScaleX() : number;		
		/** Returns scale factor of the vertical direction (Y axis). 
		*/
		getScaleY() : number;		
		/** Returns device pixel ratio for retina display. 
		*/
		getDevicePixelRatio() : number;		
		/** Returns the real location in view for a translation based on a related position
		@param tx The X axis translation
		@param ty The Y axis translation
		@param relatedPos The related position object including "left", "top", "width", "height" informations 
		*/
		convertToLocationInView(tx : number, ty : number, relatedPos : any) : Vec2;	
	}		
		/** <p>cc.ContainerStrategy class is the root strategy class of container's scale strategy,
		it controls the behavior of how to scale the cc.container and cc.game.canvas object</p> */
		export class ContainerStrategy {		
		/** Manipulation before appling the strategy
		@param view The target view 
		*/
		preApply(view : View) : void;		
		/** Function to apply this strategy 
		*/
		apply(view : View, designedResolution : Size) : void;		
		/** Manipulation after applying the strategy
		@param view The target view 
		*/
		postApply(view : View) : void;	
	}		
		/** <p>cc.ContentStrategy class is the root strategy class of content's scale strategy,
		it controls the behavior of how to scale the scene and setup the viewport for the game</p> */
		export class ContentStrategy {		
		/** Manipulation before applying the strategy
		@param view The target view 
		*/
		preApply(view : View) : void;		
		/** Function to apply this strategy
		The return value is {scale: [scaleX, scaleY], viewport: {cc.Rect}},
		The target view can then apply these value to itself, it's preferred not to modify directly its private variables 
		*/
		apply(view : View, designedResolution : Size) : any;		
		/** Manipulation after applying the strategy
		@param view The target view 
		*/
		postApply(view : View) : void;	
	}		
		/** undefined */
		export class EqualToFrame extends ContainerStrategy {	
	}		
		/** undefined */
		export class ProportionalToFrame extends ContainerStrategy {	
	}		
		/** undefined */
		export class EqualToWindow extends EqualToFrame {	
	}		
		/** undefined */
		export class ProportionalToWindow extends ProportionalToFrame {	
	}		
		/** undefined */
		export class OriginalContainer extends ContainerStrategy {	
	}		
		/** <p>cc.ResolutionPolicy class is the root strategy class of scale strategy,
		its main task is to maintain the compatibility with Cocos2d-x</p> */
		export class ResolutionPolicy {		
		/** 
		@param containerStg The container strategy
		@param contentStg The content strategy 
		*/
		ResolutionPolicy(containerStg : ContainerStrategy, contentStg : ContentStrategy) : void;		
		/** Manipulation before applying the resolution policy
		@param view The target view 
		*/
		preApply(view : View) : void;		
		/** Function to apply this resolution policy
		The return value is {scale: [scaleX, scaleY], viewport: {cc.Rect}},
		The target view can then apply these value to itself, it's preferred not to modify directly its private variables
		@param view The target view
		@param designedResolution The user defined design resolution 
		*/
		apply(view : View, designedResolution : Size) : any;		
		/** Manipulation after appyling the strategy
		@param view The target view 
		*/
		postApply(view : View) : void;		
		/** Setup the container's scale strategy 
		*/
		setContainerStrategy(containerStg : ContainerStrategy) : void;		
		/** Setup the content's scale strategy 
		*/
		setContentStrategy(contentStg : ContentStrategy) : void;		
		/** The entire application is visible in the specified area without trying to preserve the original aspect ratio.<br/>
		Distortion can occur, and the application may appear stretched or compressed. */
		EXACT_FIT : number;		
		/** The entire application fills the specified area, without distortion but possibly with some cropping,<br/>
		while maintaining the original aspect ratio of the application. */
		NO_BORDER : number;		
		/** The entire application is visible in the specified area without distortion while maintaining the original<br/>
		aspect ratio of the application. Borders can appear on two sides of the application. */
		SHOW_ALL : number;		
		/** The application takes the height of the design resolution size and modifies the width of the internal<br/>
		canvas so that it fits the aspect ratio of the device<br/>
		no distortion will occur however you must make sure your application works on different<br/>
		aspect ratios */
		FIXED_HEIGHT : number;		
		/** The application takes the width of the design resolution size and modifies the height of the internal<br/>
		canvas so that it fits the aspect ratio of the device<br/>
		no distortion will occur however you must make sure your application works on different<br/>
		aspect ratios */
		FIXED_WIDTH : number;		
		/** Unknow policy */
		UNKNOWN : number;	
	}		
		/** cc.visibleRect is a singleton object which defines the actual visible rect of the current view,
		it should represent the same rect as cc.view.getViewportRect() */
		export class visibleRect {		
		/** initialize 
		*/
		init(visibleRect : Rect) : void;		
		/** Top left coordinate of the screen related to the game scene. */
		topLeft : Vec2;		
		/** Top right coordinate of the screen related to the game scene. */
		topRight : Vec2;		
		/** Top center coordinate of the screen related to the game scene. */
		top : Vec2;		
		/** Bottom left coordinate of the screen related to the game scene. */
		bottomLeft : Vec2;		
		/** Bottom right coordinate of the screen related to the game scene. */
		bottomRight : Vec2;		
		/** Bottom center coordinate of the screen related to the game scene. */
		bottom : Vec2;		
		/** Center coordinate of the screen related to the game scene. */
		center : Vec2;		
		/** Left center coordinate of the screen related to the game scene. */
		left : Vec2;		
		/** Right center coordinate of the screen related to the game scene. */
		right : Vec2;		
		/** Width of the screen. */
		width : number;		
		/** Height of the screen. */
		height : number;	
	}		
		/** The CallbacksHandler is an abstract class that can register and unregister callbacks by key.
		Subclasses should implement their own methods about how to invoke the callbacks. */
		export class _CallbacksHandler {		
		/** 
		@param target can be null 
		*/
		add(key : string, callback : Function, target? : any) : boolean;		
		/** Check if the specified key has any registered callback. If a callback is also specified,
		it will only return true if the callback is registered. 
		*/
		has(key : string, callback? : Function, target? : any) : boolean;		
		/** Removes all callbacks registered in a certain event type or all callbacks registered with a certain target
		@param key The event key to be removed or the target to be removed 
		*/
		removeAll(key : string|any) : void;		
		/**  
		*/
		remove(key : string, callback : Function, target : any) : boolean;	
	}		
		/** !#en The callbacks invoker to handle and invoke callbacks by key.
		!#zh CallbacksInvoker 用来根据 Key 管理并调用回调方法。 */
		export class CallbacksInvoker extends _CallbacksHandler {		
		/**  
		*/
		invoke(key : string, p1? : any, p2? : any, p3? : any, p4? : any, p5? : any) : void;		
		/**  
		*/
		invokeAndRemove(key : string, p1? : any, p2? : any, p3? : any, p4? : any, p5? : any) : void;		
		/** 
		@param remove remove callbacks after invoked 
		*/
		bindKey(key : string, remove? : boolean) : Function;	
	}		
		/** !#en Contains information collected during deserialization
		!#zh 包含反序列化时的一些信息 */
		export class Details {		
		/** list of the depends assets' uuid */
		uuidList : String[];		
		/** the obj list whose field needs to load asset by uuid */
		uuidObjList : any[];		
		/** the corresponding field name which referenced to the asset */
		uuidPropList : String[];		
		/** the corresponding field name which referenced to the raw object */
		rawProp : string;		
		reset() : void;		
		/**  
		*/
		getUuidOf(obj : any, propName : string) : string;		
		/**  
		*/
		push(obj : any, propName : string, uuid : string) : void;	
	}		
		/** undefined */
		export class url {		
		/** Returns the url of raw assets, you will only need this if the raw asset is inside the "resources" folder.
		
		@example 
		```js
		---
		var url = cc.url.raw("textures/myTexture.png");
		console.log(url);   // "resources/raw/textures/myTexture.png"
		
		``` 
		*/
		raw(url : string) : string;		
		/** Returns the url of builtin raw assets. This method can only used in editor.
		
		@example 
		```js
		---
		var url = cc.url.builtinRaw("textures/myTexture.png");
		console.log(url);   // "resources/default-raw/textures/myTexture.png"
		
		``` 
		*/
		builtinRaw(url : string) : string;	
	}		
		/** <p>
		This class allows to easily create OpenGL or Canvas 2D textures from images, text or raw data.                                    <br/>
		The created cc.Texture2D object will always have power-of-two dimensions.                                                <br/>
		Depending on how you create the cc.Texture2D object, the actual image area of the texture might be smaller than the texture dimensions <br/>
		 i.e. "contentSize" != (pixelsWide, pixelsHigh) and (maxS, maxT) != (1.0, 1.0).                                           <br/>
		Be aware that the content of the generated textures will be upside-down! </p> */
		export class Texture2D extends RawAsset {		
		/** Get width in pixels. 
		*/
		getPixelWidth() : number;		
		/** Get height of in pixels. 
		*/
		getPixelHeight() : number;		
		/** Get content size. 
		*/
		getContentSize() : Size;		
		/** Get content size in pixels. 
		*/
		getContentSizeInPixels() : Size;		
		/** Init with HTML element.
		
		@example 
		```js
		var img = new Image();
		img.src = dataURL;
		texture.initWithElement(img);
		texture.handleLoadedTexture();
		``` 
		*/
		initWithElement(element : HTMLImageElement|HTMLCanvasElement) : void;		
		/** Intializes with a texture2d with data. 
		*/
		initWithData(data : any[], pixelFormat : number, pixelsWide : number, pixelsHigh : number, contentSize : Size) : boolean;		
		/** Initializes a texture from a UIImage object.
		Extensions to make it easy to create a CCTexture2D object from an image file.
		Note that RGBA type textures will have their alpha premultiplied - use the blending mode (gl.ONE, gl.ONE_MINUS_SRC_ALPHA). 
		*/
		initWithImage(uiImage : HTMLImageElement) : boolean;		
		/** HTMLElement Object getter. 
		*/
		getHtmlElementObj() : HTMLImageElement;		
		/** Check whether texture is loaded. 
		*/
		isLoaded() : boolean;		
		/** Handler of texture loaded event. 
		*/
		handleLoadedTexture(premultiplied? : boolean) : void;		
		/** Description of cc.Texture2D. 
		*/
		description() : string;		
		/** Release texture. 
		*/
		releaseTexture() : void;		
		/** Pixel format of the texture. 
		*/
		getPixelFormat() : number;		
		/** Whether or not the texture has their Alpha premultiplied,
		support only in WebGl rendering mode. 
		*/
		hasPremultipliedAlpha() : boolean;		
		/** Whether or not use mipmap, support only in WebGl rendering mode. 
		*/
		hasMipmaps() : boolean;		
		/** Sets the min filter, mag filter, wrap s and wrap t texture parameters. <br/>
		If the texture size is NPOT (non power of 2), then in can only use gl.CLAMP_TO_EDGE in gl.TEXTURE_WRAP_{S,T}.
		@param texParams texParams object or minFilter 
		*/
		setTexParameters(texParams : any|number, magFilter? : number, wrapS? : Texture2D.WrapMode, wrapT? : Texture2D.WrapMode) : void;		
		/** sets antialias texture parameters:              <br/>
		 - GL_TEXTURE_MIN_FILTER = GL_NEAREST           <br/>
		 - GL_TEXTURE_MAG_FILTER = GL_NEAREST           <br/>
		supported only in native or WebGl rendering mode 
		*/
		setAntiAliasTexParameters() : void;		
		/** Sets alias texture parameters:                 <br/>
		  GL_TEXTURE_MIN_FILTER = GL_NEAREST           <br/>
		  GL_TEXTURE_MAG_FILTER = GL_NEAREST           <br/>
		supported only in native or WebGl rendering mode 
		*/
		setAliasTexParameters() : void;		
		/** WebGLTexture Object. */
		name : WebGLTexture;		
		/** Pixel format of the texture. */
		pixelFormat : number;		
		/** Width in pixels. */
		pixelWidth : number;		
		/** Height in pixels. */
		pixelHeight : number;		
		/** Content width in points. */
		width : number;		
		/** Content height in points. */
		height : number;	
	}		
		/** <p>A class that implements a Texture Atlas. <br />
		Supported features: <br />
		The atlas file can be a PNG, JPG. <br />
		Quads can be updated in runtime <br />
		Quads can be added in runtime <br />
		Quads can be removed in runtime <br />
		Quads can be re-ordered in runtime <br />
		The TextureAtlas capacity can be increased or decreased in runtime.</p> */
		export class TextureAtlas {		
		/** <p>Creates a TextureAtlas with an filename and with an initial capacity for Quads. <br />
		The TextureAtlas capacity can be increased in runtime. </p>
		Constructor of cc.TextureAtlas
		
		@example 
		```js
		--------------------------
		1. //creates a TextureAtlas with  filename
		var textureAtlas = new cc.TextureAtlas("res/hello.png", 3);
		
		2. //creates a TextureAtlas with texture
		var texture = cc.textureCache.addImage("hello.png");
		var textureAtlas = new cc.TextureAtlas(texture, 3);
		
		``` 
		*/
		TextureAtlas(fileName : string|Texture2D, capacity : number) : void;		
		/** Quantity of quads that are going to be drawn. 
		*/
		getTotalQuads() : number;		
		/** Quantity of quads that can be stored with the current texture atlas size. 
		*/
		getCapacity() : number;		
		/** Texture of the texture atlas. 
		*/
		getTexture() : Image;		
		/** Set texture for texture atlas. 
		*/
		setTexture(texture : Image) : void;		
		/** specify if the array buffer of the VBO needs to be updated. 
		*/
		setDirty(dirty : boolean) : void;		
		/** whether or not the array buffer of the VBO needs to be updated. 
		*/
		isDirty() : boolean;		
		/** Quads that are going to be rendered. 
		*/
		getQuads() : any[];		
		/**  
		*/
		setQuads(quads : any[]) : void;		
		/** <p>Initializes a TextureAtlas with a filename and with a certain capacity for Quads.<br />
		The TextureAtlas capacity can be increased in runtime.<br />
		WARNING: Do not reinitialize the TextureAtlas because it will leak memory. </p>
		
		@example 
		```js
		--------------------------------------------------
		var textureAtlas = new cc.TextureAtlas();
		textureAtlas.initWithTexture("hello.png", 3);
		
		``` 
		*/
		initWithFile(file : string, capacity : number) : boolean;		
		/** <p>Initializes a TextureAtlas with a previously initialized Texture2D object, and<br />
		with an initial capacity for Quads.<br />
		The TextureAtlas capacity can be increased in runtime.<br />
		WARNING: Do not reinitialize the TextureAtlas because it will leak memory</p>
		
		@example 
		```js
		---------------------------
		var texture = cc.textureCache.addImage("hello.png");
		var textureAtlas = new cc.TextureAtlas();
		textureAtlas.initWithTexture(texture, 3);
		
		``` 
		*/
		initWithTexture(texture : Image, capacity : number) : boolean;		
		/** <p>Updates a Quad (texture, vertex and color) at a certain index <br />
		index must be between 0 and the atlas capacity - 1 </p> 
		*/
		updateQuad(quad : V3F_C4B_T2F_Quad, index : number) : void;		
		/** <p>Inserts a Quad (texture, vertex and color) at a certain index<br />
		index must be between 0 and the atlas capacity - 1 </p> 
		*/
		insertQuad(quad : V3F_C4B_T2F_Quad, index : number) : void;		
		/** <p>
		     Inserts a c array of quads at a given index                                           <br />
		     index must be between 0 and the atlas capacity - 1                                    <br />
		     this method doesn't enlarge the array when amount + index > totalQuads                <br />
		</p> 
		*/
		insertQuads(quads : any[], index : number, amount : number) : void;		
		/** <p>Removes the quad that is located at a certain index and inserts it at a new index <br />
		This operation is faster than removing and inserting in a quad in 2 different steps</p> 
		*/
		insertQuadFromIndex(fromIndex : number, newIndex : number) : void;		
		/** <p>Removes a quad at a given index number.<br />
		The capacity remains the same, but the total number of quads to be drawn is reduced in 1 </p> 
		*/
		removeQuadAtIndex(index : number) : void;		
		/** Removes a given number of quads at a given index. 
		*/
		removeQuadsAtIndex(index : number, amount : number) : void;		
		/** <p>Removes all Quads. <br />
		The TextureAtlas capacity remains untouched. No memory is freed.<br />
		The total number of quads to be drawn will be 0</p> 
		*/
		removeAllQuads() : void;		
		/** <p>Resize the capacity of the CCTextureAtlas.<br />
		The new capacity can be lower or higher than the current one<br />
		It returns YES if the resize was successful. <br />
		If it fails to resize the capacity it will return NO with a new capacity of 0. <br />
		no used for js</p> 
		*/
		resizeCapacity(newCapacity : number) : boolean;		
		/** Used internally by CCParticleBatchNode                                    <br/>
		don't use this unless you know what you're doing. 
		*/
		increaseTotalQuadsWith(amount : number) : void;		
		/** Moves an amount of quads from oldIndex at newIndex. 
		*/
		moveQuadsFromIndex(oldIndex : number, amount : number, newIndex : number) : void;		
		/** Ensures that after a realloc quads are still empty                                <br/>
		Used internally by CCParticleBatchNode. 
		*/
		fillWithEmptyQuadsFromIndex(index : number, amount : number) : void;		
		/** <p>Draws n quads from an index (offset). <br />
		n + start can't be greater than the capacity of the atlas</p> 
		*/
		drawNumberOfQuads(n : number, start : number) : void;		
		/** Indicates whether or not the array buffer of the VBO needs to be updated. */
		dirty : boolean;		
		/** Image texture for cc.TextureAtlas. */
		texture : Image;		
		/** Quantity of quads that can be stored with the current texture atlas size. */
		capacity : number;		
		/** Quantity of quads that are going to be drawn. */
		totalQuads : number;		
		/** Quads that are going to be rendered. */
		quads : any[];	
	}		
		/** cc.textureCache is a singleton object, it's the global cache for cc.Texture2D */
		export class textureCache {		
		/** Description 
		*/
		description() : string;		
		/** Returns an already created texture. Returns null if the texture doesn't exist.
		
		@example 
		```js
		------------------
		var key = cc.textureCache.textureForKey("hello.png");
		
		``` 
		*/
		textureForKey(textureKeyName : string) : Texture2D;		
		/** Returns an already created texture. Returns null if the texture doesn't exist.
		
		@example 
		```js
		------------------
		var key = cc.textureCache.getTextureForKey("hello.png");
		
		``` 
		*/
		getTextureForKey(textureKeyName : string) : Texture2D;		
		/** 
		
		@example 
		```js
		---------------
		var cacheTextureForColor = cc.textureCache.getTextureColors(texture);
		
		``` 
		*/
		getTextureColors(texture : Image) : any[];		
		/** #en get all textures
		#zh 获取所有贴图 
		*/
		getAllTextures() : Texture2D[];		
		/** <p>Purges the dictionary of loaded textures. <br />
		Call this method if you receive the "Memory Warning"  <br />
		In the short term: it will free some resources preventing your app from being killed  <br />
		In the medium term: it will allocate more resources <br />
		In the long term: it will be the same</p>
		
		@example 
		```js
		--------
		cc.textureCache.removeAllTextures();
		
		``` 
		*/
		removeAllTextures() : void;		
		/** Deletes a texture from the cache given a texture.
		
		@example 
		```js
		-----
		cc.textureCache.removeTexture(texture);
		
		``` 
		*/
		removeTexture(texture : Image) : void;		
		/** Deletes a texture from the cache given a its key name.
		
		@example 
		```js
		------
		cc.textureCache.removeTexture("hello.png");
		
		``` 
		*/
		removeTextureForKey(textureKeyName : string) : void;		
		/** <p>Returns a Texture2D object given an file image <br />
		If the file image was not previously loaded, it will create a new Texture2D <br />
		 object and it will return it. It will use the filename as a key.<br />
		Otherwise it will return a reference of a previously loaded image. <br />
		Supported image extensions: .png, .jpg, .gif</p>
		
		@example 
		```js
		----
		cc.textureCache.addImage("hello.png");
		
		``` 
		*/
		addImage(url : string, cb : Function, target : any) : Texture2D;		
		/** Cache the image data. 
		*/
		cacheImage(path : string, texture : Image|HTMLImageElement|HTMLCanvasElement) : void;		
		/** <p>Returns a Texture2D object given an UIImage image<br />
		If the image was not previously loaded, it will create a new Texture2D object and it will return it.<br />
		Otherwise it will return a reference of a previously loaded image<br />
		The "key" parameter will be used as the "key" for the cache.<br />
		If "key" is null, then a new texture will be created each time.</p> 
		*/
		addUIImage(image : HTMLImageElement|HTMLCanvasElement, key : string) : Texture2D;	
	}		
		/** A base node for CCNode and CCEScene, it will:
		- provide the same api with origin cocos2d rendering node (SGNode)
		- maintains properties of the internal SGNode
		- retain and release the SGNode
		- serialize datas for SGNode (but SGNode itself will not being serialized)
		- notifications if some properties changed
		- define some interfaces shares between CCNode and CCEScene */
		export class _BaseNode extends Object {		
		/** !#en Name of node.
		!#zh 该节点名称。 */
		name : string;		
		/** !#en The parent of the node.
		!#zh 该节点的父节点。 */
		parent : Node;		
		/** !#en The uuid for editor, will be stripped before building project.
		!#zh 用于编辑器使用的 uuid，在构建项目之前将会被剔除。 */
		uuid : string;		
		/** !#en Skew x
		!#zh 该节点 Y 轴倾斜角度。 */
		skewX : number;		
		/** !#en Skew y
		!#zh 该节点 X 轴倾斜角度。 */
		skewY : number;		
		/** !#en Z order in depth which stands for the drawing order.
		!#zh 该节点渲染排序的 Z 轴深度。 */
		zIndex : number;		
		/** !#en Rotation of node.
		!#zh 该节点旋转角度。 */
		rotation : number;		
		/** !#en Rotation on x axis.
		!#zh 该节点 X 轴旋转角度。 */
		rotationX : number;		
		/** !#en Rotation on y axis.
		!#zh 该节点 Y 轴旋转角度。 */
		rotationY : number;		
		/** !#en Scale on x axis.
		!#zh 节点 X 轴缩放。 */
		scaleX : number;		
		/** !#en Scale on y axis.
		!#zh 节点 Y 轴缩放。 */
		scaleY : number;		
		/** !#en x axis position of node.
		!#zh 节点 X 轴坐标。 */
		x : number;		
		/** !#en y axis position of node.
		!#zh 节点 Y 轴坐标。 */
		y : number;		
		/** !#en All children nodes.
		!#zh 节点的所有子节点。 */
		children : Node[];		
		/** !#en All children nodes.
		!#zh 节点的子节点数量。 */
		childrenCount : number;		
		/** !#en Anchor point's position on x axis.
		!#zh 节点 X 轴锚点位置。 */
		anchorX : number;		
		/** !#en Anchor point's position on y axis.
		!#zh 节点 Y 轴锚点位置。 */
		anchorY : number;		
		/** !#en Width of node.
		!#zh 节点宽度。 */
		width : number;		
		/** !#en Height of node.
		!#zh 节点高度。 */
		height : number;		
		/** !#en Tag of node.
		!#zh 节点标签。 */
		tag : number;		
		/** !#en Opacity of node, default value is 255.
		!#zh 节点透明度，默认值为 255。 */
		opacity : number;		
		/** !#en Indicate whether node's opacity value affect its child nodes, default value is true.
		!#zh 节点的不透明度值是否影响其子节点，默认值为 true。 */
		cascadeOpacity : boolean;		
		/** !#en Color of node, default value is white: (255, 255, 255).
		!#zh 节点颜色。默认为白色，数值为：（255，255，255）。 */
		color : Color;		
		/** !#en
		Properties configuration function </br>
		All properties in attrs will be set to the node, </br>
		when the setter of the node is available, </br>
		the property will be set via setter function.</br>
		!#zh 属性配置函数。在 attrs 的所有属性将被设置为节点属性。
		@param attrs Properties to be set to node
		
		@example 
		```js
		var attrs = { key: 0, num: 100 };
		node.attr(attrs);
		``` 
		*/
		attr(attrs : any) : void;		
		/** !#en
		Returns the scale factor of the node.
		Assertion will fail when _scaleX != _scaleY.
		!#zh 获取节点的缩放。当 X 轴和 Y 轴有相同的缩放数值时。
		
		@example 
		```js
		cc.log("Node Scale: " + node.getScale());
		``` 
		*/
		getScale() : number;		
		/** !#en Sets the scale factor of the node. 1.0 is the default scale factor. This function can modify the X and Y scale at the same time.
		!#zh 设置节点的缩放比例，默认值为 1.0。这个函数可以在同一时间修改 X 和 Y 缩放。
		@param scaleX scaleX or scale
		
		@example 
		```js
		node.setScale(cc.v2(1, 1));
		node.setScale(1, 1);
		``` 
		*/
		setScale(scaleX : number|Vec2, scaleY? : number) : void;		
		/** !#en Returns a copy of the position (x,y) of the node in cocos2d coordinates. (0,0) is the left-bottom corner.
		!#zh 获取在父节点坐标系中节点的位置（ x , y ）。
		
		@example 
		```js
		cc.log("Node Position: " + node.getPosition());
		``` 
		*/
		getPosition() : Vec2;		
		/** !#en
		Changes the position (x,y) of the node in cocos2d coordinates.<br/>
		The original point (0,0) is at the left-bottom corner of screen.<br/>
		Usually we use cc.v2(x,y) to compose CCVec2 object.<br/>
		and Passing two numbers (x,y) is more efficient than passing CCPoint object.
		!#zh
		设置节点在父坐标系中的位置。<br/>
		可以通过 2 种方式设置坐标点：<br/>
		1.传入 cc.v2(x, y) 类型为 cc.Vec2 的对象。<br/>
		2.传入 2 个数值 x 和 y。
		@param newPosOrxValue The position (x,y) of the node in coordinates or the X coordinate for position
		@param yValue Y coordinate for position
		
		@example 
		```js
		node.setPosition(cc.v2(0, 0));
		node.setPosition(0, 0);
		
		``` 
		*/
		setPosition(newPosOrxValue : Vec2|number, yValue? : number) : void;		
		/** !#en
		Returns a copy of the anchor point.<br/>
		Anchor point is the point around which all transformations and positioning manipulations take place.<br/>
		It's like a pin in the node where it is "attached" to its parent. <br/>
		The anchorPoint is normalized, like a percentage. (0,0) means the bottom-left corner and (1,1) means the top-right corner. <br/>
		But you can use values higher than (1,1) and lower than (0,0) too.  <br/>
		The default anchor point is (0.5,0.5), so it starts at the center of the node.
		!#zh
		获取节点锚点，用百分比表示。<br/>
		锚点应用于所有变换和坐标点的操作，它就像在节点上连接其父节点的大头针。<br/>
		锚点是标准化的，就像百分比一样。(0，0) 表示左下角，(1，1) 表示右上角。<br/>
		但是你可以使用比（1，1）更高的值或者比（0，0）更低的值。<br/>
		默认的锚点是（0.5，0.5），因此它开始于节点的中心位置。<br/>
		注意：Creator 中的锚点仅用于定位所在的节点，子节点的定位不受影响。
		
		@example 
		```js
		cc.log("Node AnchorPoint: " + node.getAnchorPoint());
		``` 
		*/
		getAnchorPoint() : Vec2;		
		/** !#en
		Sets the anchor point in percent. <br/>
		anchor point is the point around which all transformations and positioning manipulations take place. <br/>
		It's like a pin in the node where it is "attached" to its parent. <br/>
		The anchorPoint is normalized, like a percentage. (0,0) means the bottom-left corner and (1,1) means the top-right corner.<br/>
		But you can use values higher than (1,1) and lower than (0,0) too.<br/>
		The default anchor point is (0.5,0.5), so it starts at the center of the node.
		!#zh
		设置锚点的百分比。<br/>
		锚点应用于所有变换和坐标点的操作，它就像在节点上连接其父节点的大头针。<br/>
		锚点是标准化的，就像百分比一样。(0，0) 表示左下角，(1，1) 表示右上角。<br/>
		但是你可以使用比（1，1）更高的值或者比（0，0）更低的值。<br/>
		默认的锚点是（0.5，0.5），因此它开始于节点的中心位置。<br/>
		注意：Creator 中的锚点仅用于定位所在的节点，子节点的定位不受影响。
		@param point The anchor point of node or The x axis anchor of node.
		@param y The y axis anchor of node.
		
		@example 
		```js
		node.setAnchorPoint(cc.v2(1, 1));
		node.setAnchorPoint(1, 1);
		``` 
		*/
		setAnchorPoint(point : Vec2|number, y? : number) : void;		
		/** !#en
		Returns a copy of the anchor point in absolute pixels.  <br/>
		you can only read it. If you wish to modify it, use setAnchorPoint.
		!#zh
		返回锚点的绝对像素位置。<br/>
		你只能读它。如果您要修改它，使用 setAnchorPoint。
		
		@example 
		```js
		cc.log("AnchorPointInPoints: " + node.getAnchorPointInPoints());
		``` 
		*/
		getAnchorPointInPoints() : Vec2;		
		/** !#en
		Returns a copy the untransformed size of the node. <br/>
		The contentSize remains the same no matter the node is scaled or rotated.<br/>
		All nodes has a size. Layer and Scene has the same size of the screen by default. <br/>
		!#zh 获取节点自身大小，不受该节点是否被缩放或者旋转的影响。
		@param ignoreSizeProvider true if you need to get the original size of the node
		
		@example 
		```js
		cc.log("Content Size: " + node.getContentSize());
		``` 
		*/
		getContentSize(ignoreSizeProvider? : boolean) : Size;		
		/** !#en
		Sets the untransformed size of the node.<br/>
		The contentSize remains the same no matter the node is scaled or rotated.<br/>
		All nodes has a size. Layer and Scene has the same size of the screen.
		!#zh 设置节点原始大小，不受该节点是否被缩放或者旋转的影响。
		@param size The untransformed size of the node or The untransformed size's width of the node.
		@param height The untransformed size's height of the node.
		
		@example 
		```js
		node.setContentSize(cc.size(100, 100));
		node.setContentSize(100, 100);
		``` 
		*/
		setContentSize(size : Size|number, height? : number) : void;		
		/** !#en
		Returns a "local" axis aligned bounding box of the node. <br/>
		The returned box is relative only to its parent.
		!#zh 返回父节坐标系下的轴向对齐的包围盒。
		
		@example 
		```js
		var boundingBox = node.getBoundingBox();
		``` 
		*/
		getBoundingBox() : Rect;		
		/** !#en Stops all running actions and schedulers.
		!#zh 停止所有正在播放的动作和计时器。
		
		@example 
		```js
		node.cleanup();
		``` 
		*/
		cleanup() : void;		
		/** !#en Returns a child from the container given its tag.
		!#zh 通过标签获取节点的子节点。
		@param aTag An identifier to find the child node.
		
		@example 
		```js
		var child = node.getChildByTag(1001);
		``` 
		*/
		getChildByTag(aTag : number) : Node;		
		/** !#en Returns a child from the container given its uuid.
		!#zh 通过 uuid 获取节点的子节点。
		@param uuid The uuid to find the child node.
		
		@example 
		```js
		var child = node.getChildByUuid(uuid);
		``` 
		*/
		getChildByUuid(uuid : string) : Node;		
		/** !#en Returns a child from the container given its name.
		!#zh 通过名称获取节点的子节点。
		@param name A name to find the child node.
		
		@example 
		```js
		var child = node.getChildByName("Test Node");
		``` 
		*/
		getChildByName(name : string) : Node;		
		/** !#en
		"add" logic MUST only be in this method <br/>
		!#zh
		添加子节点，并且可以修改该节点的 局部 Z 顺序和标签。
		@param child A child node
		@param localZOrder Z order for drawing priority. Please refer to setZOrder(int)
		@param tag An integer or a name to identify the node easily. Please refer to setTag(int) and setName(string)
		
		@example 
		```js
		node.addChild(newNode, 1, 1001);
		``` 
		*/
		addChild(child : Node, localZOrder? : number, tag? : number|string) : void;		
		/** !#en
		Remove itself from its parent node. If cleanup is true, then also remove all actions and callbacks. <br/>
		If the cleanup parameter is not passed, it will force a cleanup. <br/>
		If the node orphan, then nothing happens.
		!#zh
		从父节点中删除一个节点。cleanup 参数为 true，那么在这个节点上所有的动作和回调都会被删除，反之则不会。<br/>
		如果不传入 cleanup 参数，默认是 true 的。<br/>
		如果这个节点是一个孤节点，那么什么都不会发生。
		@param cleanup true if all actions and callbacks on this node should be removed, false otherwise.
		
		@example 
		```js
		node.removeFromParent();
		node.removeFromParent(false);
		``` 
		*/
		removeFromParent(cleanup? : boolean) : void;		
		/** !#en
		Removes a child from the container. It will also cleanup all running actions depending on the cleanup parameter. </p>
		If the cleanup parameter is not passed, it will force a cleanup. <br/>
		"remove" logic MUST only be on this method  <br/>
		If a class wants to extend the 'removeChild' behavior it only needs <br/>
		to override this method.
		!#zh
		移除节点中指定的子节点，是否需要清理所有正在运行的行为取决于 cleanup 参数。<br/>
		如果 cleanup 参数不传入，默认为 true 表示清理。<br/>
		@param child The child node which will be removed.
		@param cleanup true if all running actions and callbacks on the child node will be cleanup, false otherwise.
		
		@example 
		```js
		node.removeChild(newNode);
		node.removeChild(newNode, false);
		``` 
		*/
		removeChild(child : Node, cleanup? : boolean) : void;		
		/** !#en
		Removes a child from the container by tag value. It will also cleanup all running actions depending on the cleanup parameter.
		If the cleanup parameter is not passed, it will force a cleanup. <br/>
		!#zh
		通过标签移除节点中指定的子节点，是否需要清理所有正在运行的行为取决于 cleanup 参数。<br/>
		如果 cleanup 参数不传入，默认为 true 表示清理。
		@param tag An integer number that identifies a child node
		@param cleanup true if all running actions and callbacks on the child node will be cleanup, false otherwise.
		
		@example 
		```js
		node.removeChildByTag(1001);
		node.removeChildByTag(1001, false);
		``` 
		*/
		removeChildByTag(tag : number, cleanup? : boolean) : void;		
		/** !#en
		Removes all children from the container and do a cleanup all running actions depending on the cleanup parameter. <br/>
		If the cleanup parameter is not passed, it will force a cleanup.
		!#zh
		移除节点所有的子节点，是否需要清理所有正在运行的行为取决于 cleanup 参数。<br/>
		如果 cleanup 参数不传入，默认为 true 表示清理。
		@param cleanup true if all running actions on all children nodes should be cleanup, false otherwise.
		
		@example 
		```js
		node.removeAllChildren();
		node.removeAllChildren(false);
		``` 
		*/
		removeAllChildren(cleanup? : boolean) : void;		
		/** !#en
		Returns the matrix that transform parent's space coordinates to the node's (local) space coordinates.<br/>
		The matrix is in Pixels. The returned transform is readonly and cannot be changed.
		!#zh
		返回将父节点的坐标系转换成节点（局部）的空间坐标系的矩阵。<br/>
		该矩阵以像素为单位。返回的矩阵是只读的，不能更改。
		
		@example 
		```js
		var affineTransform = node.getParentToNodeTransform();
		``` 
		*/
		getParentToNodeTransform() : AffineTransform;		
		/** !#en Returns the world affine transform matrix. The matrix is in Pixels.
		!#zh 返回节点到世界坐标系的仿射变换矩阵。矩阵单位是像素。
		
		@example 
		```js
		var affineTransform = node.getNodeToWorldTransform();
		``` 
		*/
		getNodeToWorldTransform() : AffineTransform;		
		/** !#en
		Returns the world affine transform matrix. The matrix is in Pixels.<br/>
		This method is AR (Anchor Relative).
		!#zh
		返回节点到世界坐标仿射变换矩阵。矩阵单位是像素。<br/>
		该方法基于节点坐标。
		
		@example 
		```js
		var mat = node.getNodeToWorldTransformAR();
		``` 
		*/
		getNodeToWorldTransformAR() : AffineTransform;		
		/** !#en Returns the inverse world affine transform matrix. The matrix is in Pixels.
		!#en 返回世界坐标系到节点坐标系的逆矩阵。
		
		@example 
		```js
		var affineTransform = node.getWorldToNodeTransform();
		``` 
		*/
		getWorldToNodeTransform() : AffineTransform;		
		/** !#en Converts a Point to node (local) space coordinates. The result is in Vec2.
		!#zh 将一个点转换到节点 (局部) 坐标系。结果以 Vec2 为单位。
		
		@example 
		```js
		var newVec2 = node.convertToNodeSpace(cc.v2(100, 100));
		``` 
		*/
		convertToNodeSpace(worldPoint : Vec2) : Vec2;		
		/** !#en Converts a Point to world space coordinates. The result is in Points.
		!#zh 将一个点转换到世界空间坐标系。结果以 Vec2 为单位。
		
		@example 
		```js
		var newVec2 = node.convertToWorldSpace(cc.v2(100, 100));
		``` 
		*/
		convertToWorldSpace(nodePoint : Vec2) : Vec2;		
		/** !#en
		Converts a Point to node (local) space coordinates. The result is in Points.<br/>
		treating the returned/received node point as anchor relative.
		!#zh
		将一个点转换到节点 (局部) 空间坐标系。结果以 Vec2 为单位。<br/>
		返回值将基于节点坐标。
		
		@example 
		```js
		var newVec2 = node.convertToNodeSpaceAR(cc.v2(100, 100));
		``` 
		*/
		convertToNodeSpaceAR(worldPoint : Vec2) : Vec2;		
		/** !#en
		Converts a local Point to world space coordinates.The result is in Points.<br/>
		treating the returned/received node point as anchor relative.
		!#zh
		将一个点转换到世界空间坐标系。结果以 Vec2 为单位。<br/>
		返回值将基于世界坐标。
		
		@example 
		```js
		var newVec2 = node.convertToWorldSpaceAR(cc.v2(100, 100));
		``` 
		*/
		convertToWorldSpaceAR(nodePoint : Vec2) : Vec2;		
		/** !#en convenience methods which take a cc.Touch instead of cc.Vec2.
		!#zh 将触摸点转换成本地坐标系中位置。
		@param touch The touch object
		
		@example 
		```js
		var newVec2 = node.convertTouchToNodeSpace(touch);
		``` 
		*/
		convertTouchToNodeSpace(touch : Touch) : Vec2;		
		/** !#en converts a cc.Touch (world coordinates) into a local coordinate. This method is AR (Anchor Relative).
		!#zh 转换一个 cc.Touch（世界坐标）到一个局部坐标，该方法基于节点坐标。
		@param touch The touch object
		
		@example 
		```js
		var newVec2 = node.convertTouchToNodeSpaceAR(touch);
		``` 
		*/
		convertTouchToNodeSpaceAR(touch : Touch) : Vec2;		
		/** !#en
		Returns the matrix that transform the node's (local) space coordinates into the parent's space coordinates.<br/>
		The matrix is in Pixels.
		!#zh 返回这个将节点（局部）的空间坐标系转换成父节点的空间坐标系的矩阵。这个矩阵以像素为单位。
		
		@example 
		```js
		var affineTransform = node.getNodeToParentTransform();
		``` 
		*/
		getNodeToParentTransform() : AffineTransform;		
		/** !#en
		Returns the matrix that transform the node's (local) space coordinates into the parent's space coordinates.<br/>
		The matrix is in Pixels.<br/>
		This method is AR (Anchor Relative).
		!#zh
		返回这个将节点（局部）的空间坐标系转换成父节点的空间坐标系的矩阵。<br/>
		这个矩阵以像素为单位。<br/>
		该方法基于节点坐标。
		
		@example 
		```js
		var affineTransform = node.getNodeToParentTransformAR();
		``` 
		*/
		getNodeToParentTransformAR() : AffineTransform;		
		/** !#en
		Returns a "world" axis aligned bounding box of the node.<br/>
		The bounding box contains self and active children's world bounding box.
		!#zh
		返回节点在世界坐标系下的对齐轴向的包围盒（AABB）。<br/>
		该边框包含自身和已激活的子节点的世界边框。
		
		@example 
		```js
		var newRect = node.getBoundingBoxToWorld();
		``` 
		*/
		getBoundingBoxToWorld() : Rect;		
		/** !#en
		Returns the displayed opacity of Node,
		the difference between displayed opacity and opacity is that displayed opacity is calculated based on opacity and parent node's opacity when cascade opacity enabled.
		!#zh
		获取节点显示透明度，
		显示透明度和透明度之间的不同之处在于当启用级连透明度时，
		显示透明度是基于自身透明度和父节点透明度计算的。
		
		@example 
		```js
		var displayOpacity = node.getDisplayedOpacity();
		``` 
		*/
		getDisplayedOpacity() : number;		
		/** !#en
		Returns the displayed color of Node,
		the difference between displayed color and color is that displayed color is calculated based on color and parent node's color when cascade color enabled.
		!#zh
		获取节点的显示透明度，
		显示透明度和透明度之间的不同之处在于显示透明度是基于透明度和父节点透明度启用级连透明度时计算的。
		
		@example 
		```js
		var displayColor = node.getDisplayedColor();
		``` 
		*/
		getDisplayedColor() : Color;		
		/** !#en
		Set whether color should be changed with the opacity value,
		useless in ccsg.Node, but this function is override in some class to have such behavior.
		!#zh 设置更改透明度时是否修改RGB值，
		
		@example 
		```js
		node.setOpacityModifyRGB(true);
		``` 
		*/
		setOpacityModifyRGB(opacityValue : boolean) : void;		
		/** !#en Get whether color should be changed with the opacity value.
		!#zh 更改透明度时是否修改RGB值。
		
		@example 
		```js
		var hasChange = node.isOpacityModifyRGB();
		``` 
		*/
		isOpacityModifyRGB() : boolean;		
		/** !#en Get the sibling index.
		!#zh 获取同级索引。
		
		@example 
		```js
		var index = node.getSiblingIndex();
		``` 
		*/
		getSiblingIndex() : number;		
		/** !#en Set the sibling index of this node.
		!#zh 设置节点同级索引。
		
		@example 
		```js
		node.setSiblingIndex(1);
		``` 
		*/
		setSiblingIndex(index : number) : void;		
		/** !#en Is this node a child of the given node?
		!#zh 是否是指定节点的子节点？
		
		@example 
		```js
		node.isChildOf(newNode);
		``` 
		*/
		isChildOf(parent : Node) : boolean;		
		/** !#en Sorts the children array depends on children's zIndex and arrivalOrder,
		normally you won't need to invoke this function.
		!#zh 根据子节点的 zIndex 和 arrivalOrder 进行排序，正常情况下开发者不需要手动调用这个函数。 
		*/
		sortAllChildren() : void;		
		/** !#en The local scale relative to the parent.
		!#zh 节点相对父节点的缩放。 */
		scale : number;		
		/** !#en Returns the x axis position of the node in cocos2d coordinates.
		!#zh 获取节点 X 轴坐标。
		
		@example 
		```js
		var posX = node.getPositionX();
		``` 
		*/
		getPositionX() : number;		
		/** !#en Sets the x axis position of the node in cocos2d coordinates.
		!#zh 设置节点 X 轴坐标。
		
		@example 
		```js
		node.setPositionX(1);
		``` 
		*/
		setPositionX(x : number) : void;		
		/** !#en Returns the y axis position of the node in cocos2d coordinates.
		!#zh 获取节点 Y 轴坐标。
		
		@example 
		```js
		var posY = node.getPositionY();
		``` 
		*/
		getPositionY() : number;		
		/** !#en Sets the y axis position of the node in cocos2d coordinates.
		!#zh 设置节点 Y 轴坐标。
		@param y The new position in y axis
		
		@example 
		```js
		node.setPositionY(100);
		``` 
		*/
		setPositionY(y : number) : void;		
		/** !#en Returns the local Z order of this node.
		!#zh 获取节点局部 Z 轴顺序。
		
		@example 
		```js
		var localZorder = node.getLocalZOrder();
		``` 
		*/
		getLocalZOrder() : number;		
		/** !#en
		LocalZOrder is the 'key' used to sort the node relative to its siblings.                                        <br/>
		                                                                                                                <br/>
		The Node's parent will sort all its children based ont the LocalZOrder value.                                   <br/>
		If two nodes have the same LocalZOrder, then the node that was added first to the children's array              <br/>
		will be in front of the other node in the array.                                                                <br/>
		Also, the Scene Graph is traversed using the "In-Order" tree traversal algorithm ( http://en.wikipedia.org/wiki/Tree_traversal#In-order ) <br/>
		And Nodes that have LocalZOder values smaller than 0 are the "left" subtree <br/>
		While Nodes with LocalZOder greater than 0 are the "right" subtree.
		!#zh
		LocalZOrder 是 “key” (关键)来分辨节点和它兄弟节点的相关性。
		父节点将会通过 LocalZOrder 的值来分辨所有的子节点。
		如果两个节点有同样的 LocalZOrder，那么先加入子节点数组的节点将会显示在后加入的节点的前面。
		同样的，场景图使用 “In-Order（按顺序）” 遍历数算法来遍历
		( http://en.wikipedia.org/wiki/Tree_traversal#In-order ) 并且拥有小于 0 的 LocalZOrder 的值的节点是 “ left ” 子树（左子树）
		所以拥有大于 0 的 LocalZOrder 的值得节点是 “ right ”子树（右子树）。
		
		@example 
		```js
		node.setLocalZOrder(1);
		``` 
		*/
		setLocalZOrder(localZOrder : number) : void;		
		/** !#en Returns whether node's opacity value affect its child nodes.
		!#zh 返回节点的不透明度值是否影响其子节点。
		
		@example 
		```js
		cc.log(node.isCascadeOpacityEnabled());
		``` 
		*/
		isCascadeOpacityEnabled() : boolean;		
		/** !#en Enable or disable cascade opacity, if cascade enabled, child nodes' opacity will be the multiplication of parent opacity and its own opacity.
		!#zh 启用或禁用级连不透明度，如果级连启用，子节点的不透明度将是父不透明度乘上它自己的不透明度。
		
		@example 
		```js
		node.setCascadeOpacityEnabled(true);
		``` 
		*/
		setCascadeOpacityEnabled(cascadeOpacityEnabled : boolean) : void;		
		/** !#en Enable or disable cascade color, if cascade enabled, child nodes' opacity will be the cascade value of parent color and its own color.
		!#zh 启用或禁用级连颜色，如果级连启用，子节点的颜色将是父颜色和它自己的颜色的级连值。
		
		@example 
		```js
		node.setCascadeColorEnabled(true);
		``` 
		*/
		setCascadeColorEnabled(cascadeColorEnabled : boolean) : void;	
	}		
		/** !#en
		cc.AffineTransform class represent an affine transform matrix. It's composed basically by translation, rotation, scale transformations.<br/>
		Please do not use its constructor directly, use cc.affineTransformMake alias function instead.
		!#zh
		cc.AffineTransform 类代表一个仿射变换矩阵。它基本上是由平移旋转，缩放转变所组成。<br/>
		请不要直接使用它的构造，请使用 cc.affineTransformMake 函数代替。 */
		export class AffineTransform {		
		/** !#en Create a cc.AffineTransform object with all contents in the matrix.
		!#zh 用在矩阵中的所有内容创建一个 cc.AffineTransform 对象。 
		*/
		affineTransformMake(a : number, b : number, c : number, d : number, tx : number, ty : number) : AffineTransform;		
		/** !#en Clone a cc.AffineTransform object from the specified transform.
		!#zh 克隆指定的 cc.AffineTransform 对象。 
		*/
		affineTransformClone(t : AffineTransform) : AffineTransform;		
		/** !#en Apply the affine transformation on a point.
		!#zh 对一个点应用矩阵变换。
		@param point or x.
		@param transOrY transform matrix or y.
		@param t transform matrix or y. 
		*/
		pointApplyAffineTransform(point : Vec2|number, transOrY : AffineTransform|number, t : AffineTransform) : Vec2;		
		/** !#en Apply the affine transformation on a size.
		!#zh 应用 Size 到仿射变换矩阵上。 
		*/
		sizeApplyAffineTransform(size : Size, t : AffineTransform) : Size;		
		/** !#en
		Create a identity transformation matrix: <br/>
		[ 1, 0, 0, <br/>
		  0, 1, 0 ]
		!#zh
		单位矩阵：<br/>
		[ 1, 0, 0, <br/>
		  0, 1, 0 ] 
		*/
		affineTransformMakeIdentity() : AffineTransform;		
		/** !#en Apply the affine transformation on a rect.
		!#zh 应用 Rect 到仿射变换矩阵上。 
		*/
		rectApplyAffineTransform(rect : Rect, anAffineTransform : AffineTransform) : Rect;		
		/** !#en Apply the affine transformation on a rect, and truns to an Oriented Bounding Box.
		!#zh 应用 Rect 到仿射变换矩阵上, 并转换为有向包围盒 
		*/
		obbApplyAffineTransform(rect : Rect, anAffineTransform : AffineTransform, out_bl : Vec2, out_tl : Vec2, out_tr : Vec2, out_br : Vec2) : void;		
		/** !#en Create a new affine transformation with a base transformation matrix and a translation based on it.
		!#zh 基于一个基础矩阵加上一个平移操作来创建一个新的矩阵。
		@param t The base affine transform object.
		@param tx The translation on x axis.
		@param ty The translation on y axis. 
		*/
		affineTransformTranslate(t : AffineTransform, tx : number, ty : number) : AffineTransform;		
		/** !#en Create a new affine transformation with a base transformation matrix and a scale based on it.
		!#zh 创建一个基础变换矩阵，并在此基础上进行了 Scale 仿射变换。
		@param t The base affine transform object.
		@param sx The scale on x axis.
		@param sy The scale on y axis. 
		*/
		affineTransformScale(t : AffineTransform, sx : number, sy : number) : AffineTransform;		
		/** !#en Create a new affine transformation with a base transformation matrix and a rotation based on it.
		!#zh 创建一个基础变换矩阵，并在此基础上进行了 Rotation 仿射变换。
		@param aTransform The base affine transform object.
		@param anAngle The angle to rotate. 
		*/
		affineTransformRotate(aTransform : AffineTransform, anAngle : number) : AffineTransform;		
		/** !#en
		Concatenate a transform matrix to another and return the result:<br/>
		t' = t1 * t2
		!#zh 拼接两个矩阵，并返回结果：<br/>
		t' = t1 * t2
		@param t1 The first transform object.
		@param t2 The transform object to concatenate. 
		*/
		affineTransformConcat(t1 : AffineTransform, t2 : AffineTransform) : AffineTransform;		
		/** !#en
		Concatenate a transform matrix to another<br/>
		The results are reflected in the first matrix.<br/>
		t' = t1 * t2
		!#zh
		拼接两个矩阵，将结果保存到第一个矩阵。<br/>
		t' = t1 * t2
		@param t1 The first transform object.
		@param t2 The transform object to concatenate. 
		*/
		affineTransformConcatIn(t1 : AffineTransform, t2 : AffineTransform) : AffineTransform;		
		/** !#en Return true if an affine transform equals to another, false otherwise.
		!#zh 判断两个矩阵是否相等。 
		*/
		affineTransformEqualToTransform(t1 : AffineTransform, t2 : AffineTransform) : boolean;		
		/** !#en Get the invert transform of an AffineTransform object.
		!#zh 求逆矩阵。 
		*/
		affineTransformInvert(t : AffineTransform) : AffineTransform;		
		/** !#en Put the invert transform of an AffineTransform object into the out AffineTransform object.
		!#zh 求逆矩阵并存入用户传入的矩阵对象参数。 
		*/
		affineTransformInvert(t : AffineTransform, out : AffineTransform) : void;	
	}		
		/** !#en
		Representation of RGBA colors.
		
		Each color component is a floating point value with a range from 0 to 255.
		
		You can also use the convenience method {{#crossLink "cc/color:method"}}cc.color{{/crossLink}} to create a new Color.
		
		!#zh
		cc.Color 用于表示颜色。
		
		它包含 RGBA 四个以浮点数保存的颜色分量，每个的值都在 0 到 255 之间。
		
		您也可以通过使用 {{#crossLink "cc/color:method"}}cc.color{{/crossLink}} 的便捷方法来创建一个新的 Color。 */
		export class Color extends ValueType {		
		/** 
		@param r red component of the color, default value is 0.
		@param g green component of the color, defualt value is 0.
		@param b blue component of the color, default value is 0.
		@param a alpha component of the color, default value is 255. 
		*/
		Color(r? : number, g? : number, b? : number, a? : number) : Color;		
		/** !#en Solid white, RGBA is [255, 255, 255, 255].
		!#zh 纯白色，RGBA 是 [255, 255, 255, 255]。 */
		WHITE : Color;		
		/** !#en Solid black, RGBA is [0, 0, 0, 255].
		!#zh 纯黑色，RGBA 是 [0, 0, 0, 255]。 */
		BLACK : Color;		
		/** !#en Transparent, RGBA is [0, 0, 0, 0].
		!#zh 透明，RGBA 是 [0, 0, 0, 0]。 */
		TRANSPARENT : Color;		
		/** !#en Grey, RGBA is [127.5, 127.5, 127.5].
		!#zh 灰色，RGBA 是 [127.5, 127.5, 127.5]。 */
		GRAY : Color;		
		/** !#en Solid red, RGBA is [255, 0, 0].
		!#zh 纯红色，RGBA 是 [255, 0, 0]。 */
		RED : Color;		
		/** !#en Solid green, RGBA is [0, 255, 0].
		!#zh 纯绿色，RGBA 是 [0, 255, 0]。 */
		GREEN : Color;		
		/** !#en Solid blue, RGBA is [0, 0, 255].
		!#zh 纯蓝色，RGBA 是 [0, 0, 255]。 */
		BLUE : Color;		
		/** !#en Yellow, RGBA is [255, 235, 4].
		!#zh 黄色，RGBA 是 [255, 235, 4]。 */
		YELLOW : Color;		
		/** !#en Orange, RGBA is [255, 127, 0].
		!#zh 橙色，RGBA 是 [255, 127, 0]。 */
		ORANGE : Color;		
		/** !#en Cyan, RGBA is [0, 255, 255].
		!#zh 青色，RGBA 是 [0, 255, 255]。 */
		CYAN : Color;		
		/** !#en Magenta, RGBA is [255, 0, 255].
		!#zh 洋红色（品红色），RGBA 是 [255, 0, 255]。 */
		MAGENTA : Color;		
		/** !#en Clone a new color from the current color.
		!#zh 克隆当前颜色。
		
		@example 
		```js
		var color = new cc.Color();
		var newColor = color.clone();// Color {r: 0, g: 0, b: 0, a: 255}
		``` 
		*/
		clone() : Color;		
		/** !#en TODO
		!#zh 判断两个颜色是否相等。
		
		@example 
		```js
		var color1 = cc.Color.WHITE;
		var color2 = new cc.Color(255, 255, 255);
		cc.log(color1.equals(color2)); // true;
		color2 = cc.Color.RED;
		cc.log(color2.equals(color1)); // false;
		``` 
		*/
		equals(other: (r: number, g: number, b: number, a: number) => void) : boolean;		
		/** !#en TODO
		!#zh 线性插值
		@param ratio the interpolation coefficient.
		@param out optional, the receiving vector.
		
		@example 
		```js
		// Converts a white color to a black one trough time.
		update: function (dt) {
		    var color = this.node.color;
		    if (color.equals(cc.Color.BLACK)) {
		        return;
		    }
		    this.ratio += dt * 0.1;
		    this.node.color = cc.Color.WHITE.lerp(cc.Color.BLACK, ratio);
		}
		
		``` 
		*/
		lerp(to: (r: number, g: number, b: number, a: number) => void, ratio : number, out: (r: number, g: number, b: number, a: number) => void) : Color;		
		/** !#en TODO
		!#zh 转换为方便阅读的字符串。
		
		@example 
		```js
		var color = cc.Color.WHITE;
		color.toString(); // "rgba(255, 255, 255, 255)"
		``` 
		*/
		toString() : string;		
		/** !#en Gets red channel value
		!#zh 获取当前颜色的红色值。 
		*/
		getR() : number;		
		/** !#en Sets red value and return the current color object
		!#zh 设置当前的红色值，并返回当前对象。
		@param red the new Red component.
		
		@example 
		```js
		var color = new cc.Color();
		color.setR(255); // Color {r: 255, g: 0, b: 0, a: 255}
		``` 
		*/
		setR(red : number) : Color;		
		/** !#en Gets green channel value
		!#zh 获取当前颜色的绿色值。 
		*/
		getG() : number;		
		/** !#en Sets green value and return the current color object
		!#zh 设置当前的绿色值，并返回当前对象。
		@param green the new Green component.
		
		@example 
		```js
		var color = new cc.Color();
		color.setG(255); // Color {r: 0, g: 255, b: 0, a: 255}
		``` 
		*/
		setG(green : number) : Color;		
		/** !#en Gets blue channel value
		!#zh 获取当前颜色的蓝色值。 
		*/
		getB() : number;		
		/** !#en Sets blue value and return the current color object
		!#zh 设置当前的蓝色值，并返回当前对象。
		@param blue the new Blue component.
		
		@example 
		```js
		var color = new cc.Color();
		color.setB(255); // Color {r: 0, g: 0, b: 255, a: 255}
		``` 
		*/
		setB(blue : number) : Color;		
		/** !#en Gets alpha channel value
		!#zh 获取当前颜色的透明度值。 
		*/
		getA() : number;		
		/** !#en Sets alpha value and return the current color object
		!#zh 设置当前的透明度，并返回当前对象。
		@param alpha the new Alpha component.
		
		@example 
		```js
		var color = new cc.Color();
		color.setA(0); // Color {r: 0, g: 0, b: 0, a: 0}
		``` 
		*/
		setA(alpha : number) : Color;		
		/** !#en Convert color to css format.
		!#zh 转换为 CSS 格式。
		@param opt "rgba", "rgb", "#rgb" or "#rrggbb".
		
		@example 
		```js
		var color = cc.Color.BLACK;
		color.toCSS();          // "#000";
		color.toCSS("rgba");    // "rgba(0,0,0,1.00)";
		color.toCSS("rgb");     // "rgba(0,0,0)";
		color.toCSS("#rgb");    // "#000";
		color.toCSS("#rrggbb"); // "#000000";
		``` 
		*/
		toCSS(opt : string) : string;		
		/** !#en Clamp this color to make all components between 0 to 255。
		!#zh 限制颜色数值，在 0 到 255 之间。
		
		@example 
		```js
		var color = new cc.Color(1000, 0, 0, 255);
		color.clamp();
		cc.log(color); // (255, 0, 0, 255)
		``` 
		*/
		clamp() : void;		
		/** !#en Read hex string and store color data into the current color object, the hex string must be formated as rgba or rgb.
		!#zh 读取 16 进制颜色。
		
		@example 
		```js
		var color = cc.Color.BLACK;
		color.fromHEX("#FFFF33"); // Color {r: 255, g: 255, b: 51, a: 255};
		``` 
		*/
		fromHEX(hexString : string) : Color;		
		/** !#en TODO
		!#zh 转换为 16 进制。
		@param fmt "#rgb" or "#rrggbb".
		
		@example 
		```js
		var color = cc.Color.BLACK;
		color.toHEX("#rgb");     // "000";
		color.toHEX("#rrggbb");  // "000000";
		``` 
		*/
		toHEX(fmt : string) : string;		
		/** !#en Convert to 24bit rgb value.
		!#zh 转换为 24bit 的 RGB 值。
		
		@example 
		```js
		var color = cc.Color.YELLOW;
		color.toRGBValue(); // 16771844;
		``` 
		*/
		toRGBValue() : number;		
		/** !#en TODO
		!#zh 读取 HSV（色彩模型）格式。
		
		@example 
		```js
		var color = cc.Color.YELLOW;
		color.fromHSV(0, 0, 1); // Color {r: 255, g: 255, b: 255, a: 255};
		``` 
		*/
		fromHSV(h : number, s : number, v : number) : Color;		
		/** !#en TODO
		!#zh 转换为 HSV（色彩模型）格式。
		
		@example 
		```js
		var color = cc.Color.YELLOW;
		color.toHSV(); // Object {h: 0.1533864541832669, s: 0.9843137254901961, v: 1};
		``` 
		*/
		toHSV() : any;		
		/** !#en TODO
		!#zh RGB 转换为 HSV。
		@param r red, must be [0, 255].
		@param g red, must be [0, 255].
		@param b red, must be [0, 255].
		
		@example 
		```js
		cc.Color.rgb2hsv(255, 255, 255); // Object {h: 0, s: 0, v: 1};
		``` 
		*/
		rgb2hsv(r : number, g : number, b : number) : any;		
		/** !#en TODO
		!#zh HSV 转换为 RGB。
		
		@example 
		```js
		cc.Color.hsv2rgb(0, 0, 1); // Object {r: 255, g: 255, b: 255};
		``` 
		*/
		hsv2rgb(h : number, s : number, v : number) : any;	
	}		
		/** !#en A 2D rectangle defined by x, y position and width, height.
		!#zh 通过位置和宽高定义的 2D 矩形。 */
		export class Rect extends ValueType {		
		/** !#en
		Constructor of cc.Rect class.
		see {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} for convenience method.
		!#zh
		cc.Rect类的构造函数。可以通过 {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} 简便方法进行创建。 
		*/
		Rect(x? : number, y? : number, w? : number, h? : number) : Rect;		
		/** !#en Creates a rectangle from two coordinate values.
		!#zh 根据指定 2 个坐标创建出一个矩形区域。
		
		@example 
		```js
		cc.Rect.fromMinMax(cc.v2(10, 10), cc.v2(20, 20)); // Rect {x: 10, y: 10, width: 10, height: 10};
		``` 
		*/
		fromMinMax(v1 : Vec2, v2 : Vec2) : Rect;		
		/** !#en Checks if rect contains.
		!#zh
		判断 2 个矩形是否有包含。<br/>
		返回 1 为 a 包含 b，如果 -1 为 b 包含 a,
		0 这则都不包含。
		@param a Rect a
		@param b Rect b
		
		@example 
		```js
		var a = new cc.rect(0, 0, 10, 10);
		var b = new cc.rect(5, 5, 5, 5);
		var c = new cc.rect(20, 20, 10, 10);
		cc.Rect.contain(a, b); //  1;
		cc.Rect.contain(b, a); // -1;
		cc.Rect.contain(a, c); //  0;
		``` 
		*/
		contain(a: (x: number, y: number, w: number, h: number) => void, b: (x: number, y: number, w: number, h: number) => void) : number;		
		/** !#en TODO
		!#zh 克隆一个新的 Rect。
		
		@example 
		```js
		var a = new cc.rect(0, 0, 10, 10);
		a.clone();// Rect {x: 0, y: 0, width: 10, height: 10}
		``` 
		*/
		clone() : Rect;		
		/** !#en TODO
		!#zh 是否等于指定的矩形。
		@param other !#en
		Constructor of cc.Rect class.
		see {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} for convenience method.
		!#zh
		cc.Rect类的构造函数。可以通过 {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} 简便方法进行创建。
		
		@example 
		```js
		var a = new cc.rect(0, 0, 10, 10);
		var b = new cc.rect(0, 0, 10, 10);
		a.equals(b);// true;
		``` 
		*/
		equals(other: (x: number, y: number, w: number, h: number) => void) : boolean;		
		/** !#en TODO
		!#zh 线性插值
		@param to !#en
		Constructor of cc.Rect class.
		see {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} for convenience method.
		!#zh
		cc.Rect类的构造函数。可以通过 {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} 简便方法进行创建。
		@param ratio the interpolation coefficient.
		@param out optional, the receiving vector.
		
		@example 
		```js
		var a = new cc.rect(0, 0, 10, 10);
		var b = new cc.rect(50, 50, 100, 100);
		update (dt) {
		   // method 1;
		   var c = a.lerp(b, dt * 0.1);
		   // method 2;
		   a.lerp(b, dt * 0.1, c);
		}
		``` 
		*/
		lerp(to: (x: number, y: number, w: number, h: number) => void, ratio : number, out: (x: number, y: number, w: number, h: number) => void) : Rect;		
		/** !#en TODO
		!#zh 转换为方便阅读的字符串
		
		@example 
		```js
		var a = new cc.rect(0, 0, 10, 10);
		a.toString();// "(0.00, 0.00, 10.00, 10.00)";
		``` 
		*/
		toString() : string;		
		/** !#en TODO
		!#zh 矩形 x 轴上的最小值。 */
		xMin : number;		
		/** !#en TODO
		!#zh 矩形 y 轴上的最小值。 */
		yMin : number;		
		/** !#en TODO
		!#zh 矩形 x 轴上的最大值。 */
		xMax : number;		
		/** !#en TODO
		!#zh 矩形 y 轴上的最大值。 */
		yMax : number;		
		/** !#en TODO
		!#zh 矩形的中心点。 */
		center : number;		
		/** !#en TODO
		!#zh 矩形的大小。 */
		size : Size;		
		/** !#en TODO
		!#zh 当前矩形与指定矩形是否相交。
		@param rect !#en
		Constructor of cc.Rect class.
		see {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} for convenience method.
		!#zh
		cc.Rect类的构造函数。可以通过 {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} 简便方法进行创建。
		
		@example 
		```js
		var a = new cc.rect(0, 0, 10, 10);
		var b = new cc.rect(0, 0, 20, 20);
		a.intersects(b);// true
		``` 
		*/
		intersects(rect: (x: number, y: number, w: number, h: number) => void) : void;		
		/** !#en TODO
		!#zh 当前矩形是否包含指定坐标点。
		Returns true if the point inside this rectangle.
		
		@example 
		```js
		var a = new cc.rect(0, 0, 10, 10);
		var b = new cc.v2(0, 5);
		a.contains(b);// true
		``` 
		*/
		contains(point : Vec2) : void;		
		/** !#en Returns true if the other rect totally inside this rectangle.
		!#zh 当前矩形是否包含指定矩形。
		@param rect !#en
		Constructor of cc.Rect class.
		see {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} for convenience method.
		!#zh
		cc.Rect类的构造函数。可以通过 {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} 简便方法进行创建。
		
		@example 
		```js
		var a = new cc.rect(0, 0, 10, 10);
		var b = new cc.rect(0, 0, 20, 20);
		a.containsRect(b);// true
		``` 
		*/
		containsRect(rect: (x: number, y: number, w: number, h: number) => void) : void;	
	}		
		/** !#en
		cc.Size is the class for size object,<br/>
		please do not use its constructor to create sizes,<br/>
		use {{#crossLink "cc/size:method"}}{{/crossLink}} alias function instead.<br/>
		It will be deprecated soon, please use cc.Vec2 instead.
		
		!#zh
		cc.Size 是 size 对象的类。<br/>
		请不要使用它的构造函数创建的 size，<br/>
		使用 {{#crossLink "cc/size:method"}}{{/crossLink}} 别名函数。<br/>
		它不久将被取消，请使用cc.Vec2代替。 */
		export class Size {		
		/**  
		*/
		Size(width : number, height : number) : Size;		
		/** !#en return a Size object with width = 0 and height = 0.
		!#zh 返回一个宽度为 0 和高度为 0 的 Size 对象。 */
		ZERO : Size;		
		/** !#en TODO
		!#zh 克隆 size 对象。
		
		@example 
		```js
		var a = new cc.size(10, 10);
		a.clone();// return Size {width: 0, height: 0};
		``` 
		*/
		clone() : Size;		
		/** !#en TODO
		!#zh 当前 Size 对象是否等于指定 Size 对象。
		
		@example 
		```js
		var a = new cc.size(10, 10);
		a.equals(new cc.size(10, 10));// return true;
		``` 
		*/
		equals(other: (width: number, height: number) => void) : boolean;		
		/** !#en TODO
		!#zh 线性插值。
		@param to !#en
		Constructor of cc.Rect class.
		see {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} for convenience method.
		!#zh
		cc.Rect类的构造函数。可以通过 {{#crossLink "cc/rect:method"}} cc.rect {{/crossLink}} 简便方法进行创建。
		@param ratio the interpolation coefficient.
		@param out optional, the receiving vector.
		
		@example 
		```js
		var a = new cc.size(10, 10);
		var b = new cc.rect(50, 50, 100, 100);
		update (dt) {
		   // method 1;
		   var c = a.lerp(b, dt * 0.1);
		   // method 2;
		   a.lerp(b, dt * 0.1, c);
		}
		``` 
		*/
		lerp(to: (x: number, y: number, w: number, h: number) => void, ratio : number, out: (width: number, height: number) => void) : Size;		
		/** !#en TODO
		!#zh 转换为方便阅读的字符串。
		
		@example 
		```js
		var a = new cc.size(10, 10);
		a.toString();// return "(10.00, 10.00)";
		``` 
		*/
		toString() : string;		
		/** !#en
		Helper function that creates a cc.Size.<br/>
		Please use cc.p or cc.v2 instead, it will soon replace cc.Size.
		!#zh
		创建一个 cc.Size 对象的帮助函数。<br/>
		注意：可以使用 cc.p 或者是 cc.v2 代替，它们将很快取代 cc.Size。
		@param w width or a size object
		@param h height
		
		@example 
		```js
		var size1 = cc.size();
		var size2 = cc.size(100,100);
		var size3 = cc.size(size2);
		var size4 = cc.size({width: 100, height: 100});
		
		``` 
		*/
		size(w : number|Size, h : number) : Size;		
		/** !#en Check whether a point's value equals to another.
		!#zh 检查 Size 对象是否等于另一个。
		
		@example 
		```js
		var a = new cc.size(10, 10);
		var b = new cc.size(10, 10);
		cc.sizeEqualToSize(a, b);// return true;
		var b = new cc.size(5, 10);
		cc.sizeEqualToSize(a, b);// return false;
		``` 
		*/
		sizeEqualToSize(size1: (width: number, height: number) => void, size2: (width: number, height: number) => void) : boolean;	
	}		
		/** !#en the device accelerometer reports values for each axis in units of g-force.
		!#zh 设备重力传感器传递的各个轴的数据。 */
		export class Acceleration {		
		/**  
		*/
		Acceleration(x : number, y : number, z : number, timestamp : number) : Acceleration;	
	}		
		/** !#en Blend Function used for textures.
		!#zh 图像的混合方式。 */
		export class BlendFunc {		
		constructor();		
		/** 
		@param src1 source blend function
		@param dst1 destination blend function 
		*/
		BlendFunc(src1 : number, dst1 : number) : BlendFunc;	
	}	
	/** !#en
	Enum for blend factor
	Refer to: http://www.andersriggelsen.dk/glblendfunc.php
	!#zh
	混合因子
	可参考: http://www.andersriggelsen.dk/glblendfunc.php */
	export enum BlendFactor {		
		ONE = 0,
		ZERO = 0,
		SRC_ALPHA = 0,
		SRC_COLOR = 0,
		DST_ALPHA = 0,
		DST_COLOR = 0,
		ONE_MINUS_SRC_ALPHA = 0,
		ONE_MINUS_SRC_COLOR = 0,
		ONE_MINUS_DST_ALPHA = 0,
		ONE_MINUS_DST_COLOR = 0,
		blendFuncDisable = 0,	
	}	
	/** undefined */
	export enum TextAlignment {		
		LEFT = 0,
		CENTER = 0,
		RIGHT = 0,	
	}		
		/** undefined */
		export class WebGLColor {		
		/**  
		*/
		WebGLColor(r : number, g : number, b : number, a : number, arrayBuffer : any[], offset : number) : WebGLColor;		
		BYTES_PER_ELEMENT : number;	
	}		
		/** undefined */
		export class Vertex2F {		
		/**  
		*/
		Vertex2F(x : number, y : number, arrayBuffer : any[], offset : number) : Vertex2F;		
		BYTES_PER_ELEMENT : number;	
	}		
		/** undefined */
		export class Vertex3F {		
		/**  
		*/
		Vertex3F(x : number, y : number, z : number, arrayBuffer : any[], offset : number) : Vertex3F;		
		BYTES_PER_ELEMENT : number;	
	}		
		/** undefined */
		export class Tex2F {		
		/**  
		*/
		Tex2F(u : number, v : number, arrayBuffer : any[], offset : number) : Tex2F;		
		BYTES_PER_ELEMENT : number;	
	}		
		/** undefined */
		export class Quad2 {		
		/**  
		*/
		Quad2(tl: (x: number, y: number, arrayBuffer: any[], offset: number) => void, tr: (x: number, y: number, arrayBuffer: any[], offset: number) => void, bl: (x: number, y: number, arrayBuffer: any[], offset: number) => void, br: (x: number, y: number, arrayBuffer: any[], offset: number) => void, arrayBuffer : any[], offset : number) : Quad2;		
		BYTES_PER_ELEMENT : number;	
	}		
		/** A 3D Quad. 4 * 3 floats */
		export class Quad3 {		
		/**  
		*/
		Quad3(bl1: (x: number, y: number, z: number, arrayBuffer: any[], offset: number) => void, br1: (x: number, y: number, z: number, arrayBuffer: any[], offset: number) => void, tl1: (x: number, y: number, z: number, arrayBuffer: any[], offset: number) => void, tr1: (x: number, y: number, z: number, arrayBuffer: any[], offset: number) => void, arrayBuffer : any[], offset : number) : Quad3;	
	}		
		/** undefined */
		export class V3F_C4B_T2F {		
		/**  
		*/
		V3F_C4B_T2F(vertices: (x: number, y: number, z: number, arrayBuffer: any[], offset: number) => void, colors: (r: number, g: number, b: number, a: number) => void, texCoords: (u: number, v: number, arrayBuffer: any[], offset: number) => void, arrayBuffer : any[], offset : number) : V3F_C4B_T2F;		
		BYTES_PER_ELEMENT() : void;	
	}		
		/** undefined */
		export class V3F_C4B_T2F_Quad {		
		/**  
		*/
		V3F_C4B_T2F_Quad(tl: (vertices: Vertex3F, colors: Color, texCoords: Tex2F, arrayBuffer: any[], offset: number) => void, bl: (vertices: Vertex3F, colors: Color, texCoords: Tex2F, arrayBuffer: any[], offset: number) => void, tr: (vertices: Vertex3F, colors: Color, texCoords: Tex2F, arrayBuffer: any[], offset: number) => void, br: (vertices: Vertex3F, colors: Color, texCoords: Tex2F, arrayBuffer: any[], offset: number) => void, arrayBuffer : any[], offset : number) : V3F_C4B_T2F_Quad;		
		BYTES_PER_ELEMENT : number;	
	}		
		/** undefined */
		export class V2F_C4B_T2F {		
		/**  
		*/
		V2F_C4B_T2F(vertices: (x: number, y: number, arrayBuffer: any[], offset: number) => void, colors: (r: number, g: number, b: number, a: number) => void, texCoords: (u: number, v: number, arrayBuffer: any[], offset: number) => void, arrayBuffer : any[], offset : number) : V2F_C4B_T2F;		
		BYTES_PER_ELEMENT : number;	
	}		
		/** undefined */
		export class V2F_C4B_T2F_Triangle {		
		/**  
		*/
		V2F_C4B_T2F_Triangle(a: (vertices: Vertex2F, colors: Color, texCoords: Tex2F, arrayBuffer: any[], offset: number) => void, b: (vertices: Vertex2F, colors: Color, texCoords: Tex2F, arrayBuffer: any[], offset: number) => void, c: (vertices: Vertex2F, colors: Color, texCoords: Tex2F, arrayBuffer: any[], offset: number) => void, arrayBuffer : any[], offset : number) : V2F_C4B_T2F_Triangle;	
	}		
		/** !#en The base class of all value types.
		!#zh 所有值类型的基类。 */
		export class ValueType {		
		/** !#en This method returns an exact copy of current value.
		!#zh 克隆当前值，该方法返回一个新对象，新对象的值和原对象相等。 
		*/
		clone() : ValueType;		
		/** !#en Compares this object with the other one.
		!#zh 当前对象是否等于指定对象。 
		*/
		equals(other : ValueType) : boolean;		
		/** !#en TODO
		!#zh 转换为方便阅读的字符串。 
		*/
		toString() : string;		
		/** !#en
		Linearly interpolates between this value to to value by ratio which is in the range [0, 1].
		When ratio = 0 returns this. When ratio = 1 return to. When ratio = 0.5 returns the average of this and to.
		!#zh
		线性插值。<br/>
		当 ratio = 0 时返回自身，ratio = 1 时返回目标，ratio = 0.5 返回自身和目标的平均值。。
		@param to the to value
		@param ratio the interpolation coefficient 
		*/
		lerp(to : ValueType, ratio : number) : ValueType;	
	}		
		/** !#en Representation of 2D vectors and points.
		!#zh 表示 2D 向量和坐标 */
		export class Vec2 extends ValueType {		
		/** !#en
		Constructor
		see {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} or {{#crossLink "cc/p:method"}}cc.p{{/crossLink}}
		!#zh
		构造函数，可查看 {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} 或者 {{#crossLink "cc/p:method"}}cc.p{{/crossLink}} 
		*/
		Vec2(x? : number, y? : number) : Vec2;		
		/** !#en clone a Vec2 value
		!#zh 克隆一个 Vec2 值 
		*/
		clone() : Vec2;		
		/** !#en TODO
		!#zh 设置向量值。
		@param newValue !#en new value to set. !#zh 要设置的新值 
		*/
		set(newValue: (x: number, y: number) => void) : Vec2;		
		/** !#en TODO
		!#zh 当前的向量是否与指定的向量相等。
		@param other !#en
		Constructor
		see {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} or {{#crossLink "cc/p:method"}}cc.p{{/crossLink}}
		!#zh
		构造函数，可查看 {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} 或者 {{#crossLink "cc/p:method"}}cc.p{{/crossLink}} 
		*/
		equals(other: (x: number, y: number) => void) : boolean;		
		/** !#en TODO
		!#zh 转换为方便阅读的字符串。 
		*/
		toString() : string;		
		/** !#en TODO
		!#zh 线性插值。
		@param to !#en
		Constructor
		see {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} or {{#crossLink "cc/p:method"}}cc.p{{/crossLink}}
		!#zh
		构造函数，可查看 {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} 或者 {{#crossLink "cc/p:method"}}cc.p{{/crossLink}}
		@param ratio the interpolation coefficient
		@param out optional, the receiving vector 
		*/
		lerp(to: (x: number, y: number) => void, ratio : number, out: (x: number, y: number) => void) : Vec2;		
		/** !#en Adds this vector. If you want to save result to another vector, use add() instead.
		!#zh 向量加法。如果你想保存结果到另一个向量，使用 add() 代替。
		@param vector !#en
		Constructor
		see {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} or {{#crossLink "cc/p:method"}}cc.p{{/crossLink}}
		!#zh
		构造函数，可查看 {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} 或者 {{#crossLink "cc/p:method"}}cc.p{{/crossLink}}
		
		@example 
		```js
		var v = cc.v2(10, 10);
		v.addSelf(cc.v2(5, 5));// return Vec2 {x: 15, y: 15};
		``` 
		*/
		addSelf(vector: (x: number, y: number) => void) : Vec2;		
		/** !#en Adds two vectors, and returns the new result.
		!#zh 向量加法，并返回新结果。
		@param vector !#en
		Constructor
		see {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} or {{#crossLink "cc/p:method"}}cc.p{{/crossLink}}
		!#zh
		构造函数，可查看 {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} 或者 {{#crossLink "cc/p:method"}}cc.p{{/crossLink}}
		@param out optional, the receiving vector
		
		@example 
		```js
		var v = cc.v2(10, 10);
		v.add(cc.v2(5, 5));      // return Vec2 {x: 15, y: 15};
		var v1;
		v.add(cc.v2(5, 5), v1);  // return Vec2 {x: 15, y: 15};
		``` 
		*/
		add(vector: (x: number, y: number) => void, out: (x: number, y: number) => void) : Vec2;		
		/** !#en Subtracts one vector from this. If you want to save result to another vector, use sub() instead.
		!#zh 向量减法。如果你想保存结果到另一个向量，可使用 sub() 代替。
		@param vector !#en
		Constructor
		see {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} or {{#crossLink "cc/p:method"}}cc.p{{/crossLink}}
		!#zh
		构造函数，可查看 {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} 或者 {{#crossLink "cc/p:method"}}cc.p{{/crossLink}}
		
		@example 
		```js
		var v = cc.v2(10, 10);
		v.subSelf(cc.v2(5, 5));// return Vec2 {x: 5, y: 5};
		``` 
		*/
		subSelf(vector: (x: number, y: number) => void) : Vec2;		
		/** !#en Subtracts one vector from this, and returns the new result.
		!#zh 向量减法，并返回新结果。
		@param vector !#en
		Constructor
		see {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} or {{#crossLink "cc/p:method"}}cc.p{{/crossLink}}
		!#zh
		构造函数，可查看 {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} 或者 {{#crossLink "cc/p:method"}}cc.p{{/crossLink}}
		@param out optional, the receiving vector
		
		@example 
		```js
		var v = cc.v2(10, 10);
		v.sub(cc.v2(5, 5));      // return Vec2 {x: 5, y: 5};
		var v1;
		v.sub(cc.v2(5, 5), v1);  // return Vec2 {x: 5, y: 5};
		``` 
		*/
		sub(vector: (x: number, y: number) => void, out: (x: number, y: number) => void) : Vec2;		
		/** !#en Multiplies this by a number. If you want to save result to another vector, use mul() instead.
		!#zh 缩放当前向量。如果你想结果保存到另一个向量，可使用 mul() 代替。
		
		@example 
		```js
		var v = cc.v2(10, 10);
		v.mulSelf(5);// return Vec2 {x: 50, y: 50};
		``` 
		*/
		mulSelf(num : number) : Vec2;		
		/** !#en Multiplies by a number, and returns the new result.
		!#zh 缩放当前向量，并返回新结果。
		@param out optional, the receiving vector
		
		@example 
		```js
		var v = cc.v2(10, 10);
		v.mul(5);      // return Vec2 {x: 50, y: 50};
		var v1;
		v.mul(5, v1);  // return Vec2 {x: 50, y: 50};
		``` 
		*/
		mul(num : number, out: (x: number, y: number) => void) : Vec2;		
		/** !#en Multiplies two vectors.
		!#zh 分量相乘。
		@param vector !#en
		Constructor
		see {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} or {{#crossLink "cc/p:method"}}cc.p{{/crossLink}}
		!#zh
		构造函数，可查看 {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} 或者 {{#crossLink "cc/p:method"}}cc.p{{/crossLink}}
		
		@example 
		```js
		var v = cc.v2(10, 10);
		v.scaleSelf(cc.v2(5, 5));// return Vec2 {x: 50, y: 50};
		``` 
		*/
		scaleSelf(vector: (x: number, y: number) => void) : Vec2;		
		/** !#en Multiplies two vectors, and returns the new result.
		!#zh 分量相乘，并返回新的结果。
		@param vector !#en
		Constructor
		see {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} or {{#crossLink "cc/p:method"}}cc.p{{/crossLink}}
		!#zh
		构造函数，可查看 {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} 或者 {{#crossLink "cc/p:method"}}cc.p{{/crossLink}}
		@param out optional, the receiving vector
		
		@example 
		```js
		var v = cc.v2(10, 10);
		v.scale(cc.v2(5, 5));      // return Vec2 {x: 50, y: 50};
		var v1;
		v.scale(cc.v2(5, 5), v1);  // return Vec2 {x: 50, y: 50};
		``` 
		*/
		scale(vector: (x: number, y: number) => void, out: (x: number, y: number) => void) : Vec2;		
		/** !#en Divides by a number. If you want to save result to another vector, use div() instead.
		!#zh 向量除法。如果你想结果保存到另一个向量，可使用 div() 代替。
		@param vector !#en
		Constructor
		see {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} or {{#crossLink "cc/p:method"}}cc.p{{/crossLink}}
		!#zh
		构造函数，可查看 {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} 或者 {{#crossLink "cc/p:method"}}cc.p{{/crossLink}}
		
		@example 
		```js
		var v = cc.v2(10, 10);
		v.divSelf(5); // return Vec2 {x: 2, y: 2};
		``` 
		*/
		divSelf(vector: (x: number, y: number) => void) : Vec2;		
		/** !#en Divides by a number, and returns the new result.
		!#zh 向量除法，并返回新的结果。
		@param vector !#en
		Constructor
		see {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} or {{#crossLink "cc/p:method"}}cc.p{{/crossLink}}
		!#zh
		构造函数，可查看 {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} 或者 {{#crossLink "cc/p:method"}}cc.p{{/crossLink}}
		@param out optional, the receiving vector
		
		@example 
		```js
		var v = cc.v2(10, 10);
		v.div(5);      // return Vec2 {x: 2, y: 2};
		var v1;
		v.div(5, v1);  // return Vec2 {x: 2, y: 2};
		``` 
		*/
		div(vector: (x: number, y: number) => void, out: (x: number, y: number) => void) : Vec2;		
		/** !#en Negates the components. If you want to save result to another vector, use neg() instead.
		!#zh 向量取反。如果你想结果保存到另一个向量，可使用 neg() 代替。
		
		@example 
		```js
		var v = cc.v2(10, 10);
		v.negSelf(); // return Vec2 {x: -10, y: -10};
		``` 
		*/
		negSelf() : Vec2;		
		/** !#en Negates the components, and returns the new result.
		!#zh 返回取反后的新向量。
		@param out optional, the receiving vector
		
		@example 
		```js
		var v = cc.v2(10, 10);
		var v1;
		v.neg(v1);  // return Vec2 {x: -10, y: -10};
		``` 
		*/
		neg(out: (x: number, y: number) => void) : Vec2;		
		/** !#en Dot product
		!#zh 当前向量与指定向量进行点乘。
		@param vector !#en
		Constructor
		see {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} or {{#crossLink "cc/p:method"}}cc.p{{/crossLink}}
		!#zh
		构造函数，可查看 {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} 或者 {{#crossLink "cc/p:method"}}cc.p{{/crossLink}}
		
		@example 
		```js
		var v = cc.v2(10, 10);
		v.dot(cc.v2(5, 5)); // return 100;
		``` 
		*/
		dot(vector: (x: number, y: number) => void) : number;		
		/** !#en Cross product
		!#zh 当前向量与指定向量进行叉乘。
		@param vector !#en
		Constructor
		see {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} or {{#crossLink "cc/p:method"}}cc.p{{/crossLink}}
		!#zh
		构造函数，可查看 {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} 或者 {{#crossLink "cc/p:method"}}cc.p{{/crossLink}}
		
		@example 
		```js
		var v = cc.v2(10, 10);
		v.cross(cc.v2(5, 5)); // return 0;
		``` 
		*/
		cross(vector: (x: number, y: number) => void) : number;		
		/** !#en Returns the length of this vector.
		!#zh 返回该向量的长度。
		
		@example 
		```js
		var v = cc.v2(10, 10);
		v.mag(); // return 14.142135623730951;
		``` 
		*/
		mag() : number;		
		/** !#en Returns the squared length of this vector.
		!#zh 返回该向量的长度平方。
		
		@example 
		```js
		var v = cc.v2(10, 10);
		v.magSqr(); // return 200;
		``` 
		*/
		magSqr() : number;		
		/** !#en Make the length of this vector to 1.
		!#zh 向量归一化，让这个向量的长度为 1。
		
		@example 
		```js
		var v = cc.v2(10, 10);
		v.normalizeSelf(); // return Vec2 {x: 0.7071067811865475, y: 0.7071067811865475};
		``` 
		*/
		normalizeSelf() : Vec2;		
		/** !#en
		Returns this vector with a magnitude of 1.<br/>
		<br/>
		Note that the current vector is unchanged and a new normalized vector is returned. If you want to normalize the current vector, use normalizeSelf function.
		!#zh
		返回归一化后的向量。<br/>
		<br/>
		注意，当前向量不变，并返回一个新的归一化向量。如果你想来归一化当前向量，可使用 normalizeSelf 函数。
		@param out optional, the receiving vector 
		*/
		normalize(out: (x: number, y: number) => void) : Vec2;		
		/** !#en Get angle in radian between this and vector.
		!#zh 夹角的弧度。
		@param vector !#en
		Constructor
		see {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} or {{#crossLink "cc/p:method"}}cc.p{{/crossLink}}
		!#zh
		构造函数，可查看 {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} 或者 {{#crossLink "cc/p:method"}}cc.p{{/crossLink}} 
		*/
		angle(vector: (x: number, y: number) => void) : number;		
		/** !#en Get angle in radian between this and vector with direction.
		!#zh 带方向的夹角的弧度。
		@param vector !#en
		Constructor
		see {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} or {{#crossLink "cc/p:method"}}cc.p{{/crossLink}}
		!#zh
		构造函数，可查看 {{#crossLink "cc/vec2:method"}}cc.v2{{/crossLink}} 或者 {{#crossLink "cc/p:method"}}cc.p{{/crossLink}} 
		*/
		signAngle(vector: (x: number, y: number) => void) : number;		
		/** !#en rotate
		!#zh 返回旋转给定弧度后的新向量。
		@param out optional, the receiving vector 
		*/
		rotate(radians : number, out: (x: number, y: number) => void) : Vec2;		
		/** !#en rotate self
		!#zh 按指定弧度旋转向量。 
		*/
		rotateSelf(radians : number) : Vec2;		
		/** !#en return a Vec2 object with x = 1 and y = 1.
		!#zh 新 Vec2 对象。 */
		ONE : Vec2;		
		/** !#en return a Vec2 object with x = 0 and y = 0.
		!#zh 返回 x = 0 和 y = 0 的 Vec2 对象。 */
		ZERO : Vec2;		
		/** !#en return a Vec2 object with x = 0 and y = 1.
		!#zh 返回 x = 0 和 y = 1 的 Vec2 对象。 */
		UP : Vec2;		
		/** !#en return a Vec2 object with x = 1 and y = 0.
		!#zh 返回 x = 1 和 y = 0 的 Vec2 对象。 */
		RIGHT : Vec2;	
	}		
		/** !#en
		Base class for handling assets used in Fireball. This class can be instantiate.
		
		You may want to override:<br/>
		- createNode<br/>
		- cc.Object._serialize<br/>
		- cc.Object._deserialize<br/>
		!#zh
		资源基类，该类可以被实例化。<br/>
		
		您可能需要重写：<br/>
		- createNode <br/>
		- cc.Object._serialize<br/>
		- cc.Object._deserialize<br/> */
		export class Asset extends RawAsset {		
		/** !#en
		Returns the url of this asset's first raw file, if none of rawFile exists,
		it will returns an empty string.
		!#zh 返回该资源的原始文件的 URL，如果不支持 RAW 文件，它将返回一个空字符串。 */
		rawUrl : string;		
		/** !#en
		Returns the url of this asset's raw files, if none of rawFile exists,
		it will returns an empty array.
		!#zh 返回该资源的原文件的 URL 数组，如果不支持 RAW 文件，它将返回一个空数组。 */
		rawUrls : String[];		
		/** !#en Indicates whether its dependent raw assets can support deferred load if the owner scene is marked as `asyncLoadAssets`.
		!#zh 当场景被标记为 `asyncLoadAssets`，禁止延迟加载该资源所依赖的其它 RawAsset。 */
		preventDeferredLoadDependents : boolean;		
		/** !#en
		Create a new node using this asset in the scene.<br/>
		If this type of asset dont have its corresponding node type, this method should be null.
		!#zh
		使用该资源在场景中创建一个新节点。<br/>
		如果这类资源没有相应的节点类型，该方法应该是空的。 
		*/
		createNode(callback: (error: string, node: any) => void) : void;	
	}		
		/** !#en Class for audio data handling.
		!#zh 音频资源类。 */
		export class AudioClip extends RawAsset {	
	}		
		/** !#en Class for BitmapFont handling.
		!#zh 位图字体资源类。 */
		export class BitmapFont extends RawAsset {	
	}		
		/** !#en Class for Font handling.
		!#zh 字体资源类。 */
		export class Font extends RawAsset {	
	}		
		/** !#en Class for LabelAtlas handling.
		!#zh 艺术数字字体资源类。 */
		export class LabelAtlas extends cc.BitmapFont {	
	}		
		/** !#en Class for prefab handling.
		!#zh 预制资源类。 */
		export class Prefab extends Asset {		
		/** the main cc.Node in the prefab */
		data : Node;		
		/** Dynamically translation prefab data into minimized code.<br/>
		This method will be called automatically before the first time the prefab being instantiated,
		but you can re-call to refresh the create function once you modified the original prefab data in script. 
		*/
		compileCreateFunction() : void;	
	}		
		/** !#en
		The base class for registering asset types.
		
		You may want to override:
		- createNode (static)
		!#zh
		注册用的资源基类。<br/>
		你可能要重写：<br/>
		- createNode (static) */
		export class RawAsset extends CCObject {		
		/** !#en
		Create a new node in the scene.<br/>
		If this type of asset dont have its corresponding node type, this method should be null.
		!#zh
		在场景中创建一个新节点。<br/>
		如果这类资源没有相应的节点类型，该方法应该是空的。 
		*/
		createNodeByInfo(Info : any, callback: (error: string, node: any) => void) : void;	
	}		
		/** !#en Class for scene handling.
		!#zh 场景资源类。 */
		export class SceneAsset extends Asset {		
		scene : Scene;		
		/** !#en Indicates the raw assets of this scene can be load after scene launched.
		!#zh 指示该场景依赖的资源可否在场景切换后再延迟加载。 */
		asyncLoadAssets : boolean;	
	}		
		/** !#en Class for script handling.
		!#zh Script 资源类。 */
		export class _Script extends Asset {	
	}		
		/** !#en Class for JavaScript handling.
		!#zh JavaScript 资源类。 */
		export class _JavaScript extends Asset {	
	}		
		/** !#en Class for coffee script handling.
		!#zh CoffeeScript 资源类。 */
		export class CoffeeScript extends Asset {	
	}		
		/** !#en Class for sprite atlas handling.
		!#zh 精灵图集资源类。 */
		export class SpriteAtlas extends RawAsset {		
		/** Returns the texture of the sprite atlas 
		*/
		getTexture() : Texture2D;		
		/** Returns the sprite frame correspond to the given key in sprite atlas. 
		*/
		getSpriteFrame(key : string) : SpriteFrame;		
		/** Returns the sprite frames in sprite atlas. 
		*/
		getSpriteFrames() : [SpriteFrame];	
	}		
		/** !#en Class for TTFFont handling.
		!#zh TTF 字体资源类。 */
		export class TTFFont extends Asset {	
	}		
		/** !#en Class for text file.
		!#zh 文本资源类。 */
		export class TextAsset extends Asset {	
	}	
	
	/****************************************************
	* audioEngine
	*****************************************************/
	
	export module audioEngine {		
		/** !#en Audio state.
		!#zh 声音播放状态 */
		export enum AudioState {			
			ERROR = 0,
			INITIALZING = 0,
			PLAYING = 0,
			PAUSED = 0,		
		}	
	}	
	
	/****************************************************
	* ParticleSystem
	*****************************************************/
	
	export module ParticleSystem {		
		/** !#en Enum for emitter modes
		!#zh 发射模式 */
		export enum EmitterMode {			
			GRAVITY = 0,
			RADIUS = 0,		
		}	
	}	
	
	/****************************************************
	* ParticleSystem
	*****************************************************/
	
	export module ParticleSystem {		
		/** !#en Enum for particles movement type.
		!#zh 粒子位置类型 */
		export enum PositionType {			
			FREE = 0,
			RELATIVE = 0,
			GROUPED = 0,		
		}	
	}	
	
	/****************************************************
	* Node
	*****************************************************/
	
	export module Node {		
		/** !#en The event type supported by Node
		!#zh Node 支持的事件类型 */
		export enum EventType {			
			TOUCH_START = 0,
			TOUCH_MOVE = 0,
			TOUCH_END = 0,
			TOUCH_CANCEL = 0,
			MOUSE_DOWN = 0,
			MOUSE_MOVE = 0,
			MOUSE_ENTER = 0,
			MOUSE_LEAVE = 0,
			MOUSE_UP = 0,
			MOUSE_WHEEL = 0,		
		}	
	}	
	
	/****************************************************
	* TiledMap
	*****************************************************/
	
	export module TiledMap {		
		/** !#en The orientation of tiled map.
		!#zh Tiled Map 地图方向。 */
		export enum Orientation {			
			ORTHO = 0,
			HEX = 0,
			ISO = 0,
			NONE = 0,
			MAP = 0,
			LAYER = 0,
			OBJECTGROUP = 0,
			OBJECT = 0,
			TILE = 0,
			HORIZONTAL = 0,
			VERTICAL = 0,
			DIAGONAL = 0,
			FLIPPED_ALL = 0,
			FLIPPED_MASK = 0,
			STAGGERAXIS_X = 0,
			STAGGERAXIS_Y = 0,
			STAGGERINDEX_ODD = 0,
			STAGGERINDEX_EVEN = 0,		
		}	
	}	
	
	/****************************************************
	* Event
	*****************************************************/
	
	export module Event {			
			/** !#en The Custom event
			!#zh 自定义事件 */
			export class EventCustom extends Event {			
			/** 
			@param type The name of the event (case-sensitive), e.g. "click", "fire", or "submit"
			@param bubbles A boolean indicating whether the event bubbles up through the tree or not 
			*/
			EventCustom(type : string, bubbles : boolean) : EventCustom;			
			/** !#en A reference to the detailed data of the event
			!#zh 事件的详细数据 */
			detail : any;			
			/** !#en Sets user data
			!#zh 设置用户数据 
			*/
			setUserData(data : any) : void;			
			/** !#en Gets user data
			!#zh 获取用户数据 
			*/
			getUserData() : any;			
			/** !#en Gets event name
			!#zh 获取事件名称 
			*/
			getEventName() : string;		
		}	
	}	
	
	/****************************************************
	* Button
	*****************************************************/
	
	export module Button {		
		/** !#en Enum for transition type.
		!#zh 过渡类型 */
		export enum Transition {			
			NONE = 0,
			COLOR = 0,
			SPRITE = 0,
			SCALE = 0,		
		}	
	}	
	
	/****************************************************
	* Component
	*****************************************************/
	
	export module Component {			
			/** !#en
			Component will register a event to target component's handler.
			And it will trigger the handler when a certain event occurs.
			
			!@zh
			“EventHandler” 类用来设置场景中的事件回调，
			该类允许用户设置回调目标节点，目标组件名，组件方法名，
			并可通过 emit 方法调用目标函数。 */
			export class EventHandler {			
			/** !#en Event target
			!#zh 目标节点 */
			target : Node;			
			/** !#en Component name
			!#zh 目标组件名 */
			component : string;			
			/** !#en Event handler
			!#zh 响应事件函数名 */
			handler : string;			
			/** !#en Custom Event Data
			!#zh 自定义事件数据 */
			customEventData : string;			
			/**  
			*/
			emitEvents(events : Component.EventHandler[], params : any) : void;			
			/** !#en Emit event with params
			!#zh 触发目标组件上的指定 handler 函数，该参数是回调函数的参数值（可不填）。
			
			@example 
			```js
			// Call Function
			var eventHandler = new cc.Component.EventHandler();
			eventHandler.target = newTarget;
			eventHandler.component = "MainMenu";
			eventHandler.handler = "OnClick"
			eventHandler.emit(["param1", "param2", ....]);
			``` 
			*/
			emit(params : any[]) : void;		
		}	
	}	
	
	/****************************************************
	* EditBox
	*****************************************************/
	
	export module EditBox {		
		/** !#en Enum for keyboard return types
		!#zh 键盘的返回键类型 */
		export enum KeyboardReturnType {			
			DEFAULT = 0,
			DONE = 0,
			SEND = 0,
			SEARCH = 0,
			GO = 0,		
		}	
	}	
	
	/****************************************************
	* EditBox
	*****************************************************/
	
	export module EditBox {		
		/** !#en The EditBox's InputMode defines the type of text that the user is allowed to enter.
		!#zh 输入模式 */
		export enum InputMode {			
			ANY = 0,
			EMAIL_ADDR = 0,
			NUMERIC = 0,
			PHONE_NUMBER = 0,
			URL = 0,
			DECIMAL = 0,
			SINGLE_LINE = 0,		
		}	
	}	
	
	/****************************************************
	* EditBox
	*****************************************************/
	
	export module EditBox {		
		/** !#en Enum for the EditBox's input flags
		!#zh 定义了一些用于设置文本显示和文本格式化的标志位。 */
		export enum InputFlag {			
			PASSWORD = 0,
			SENSITIVE = 0,
			INITIAL_CAPS_WORD = 0,
			INITIAL_CAPS_SENTENCE = 0,
			INITIAL_CAPS_ALL_CHARACTERS = 0,		
		}	
	}	
	
	/****************************************************
	* Label
	*****************************************************/
	
	export module Label {		
		/** !#en Enum for text alignment.
		!#zh 文本横向对齐类型 */
		export enum HorizontalAlign {			
			LEFT = 0,
			CENTER = 0,
			RIGHT = 0,		
		}	
	}	
	
	/****************************************************
	* Label
	*****************************************************/
	
	export module Label {		
		/** !#en Enum for vertical text alignment.
		!#zh 文本垂直对齐类型 */
		export enum VerticalAlign {			
			TOP = 0,
			CENTER = 0,
			BOTTOM = 0,		
		}	
	}	
	
	/****************************************************
	* Label
	*****************************************************/
	
	export module Label {		
		/** !#en Enum for Overflow.
		!#zh Overflow 类型 */
		export enum Overflow {			
			NONE = 0,
			CLAMP = 0,
			SHRINK = 0,
			RESIZE_HEIGHT = 0,		
		}	
	}	
	
	/****************************************************
	* Label
	*****************************************************/
	
	export module Label {		
		/** !#en Enum for font type.
		!#zh Type 类型 */
		export enum Type {			
			TTF = 0,
			BMFont = 0,
			SystemFont = 0,		
		}	
	}	
	
	/****************************************************
	* Layout
	*****************************************************/
	
	export module Layout {		
		/** !#en Enum for Layout type
		!#zh 布局类型 */
		export enum Type {			
			NONE = 0,
			HORIZONTAL = 0,
			VERTICAL = 0,
			GRID = 0,		
		}	
	}	
	
	/****************************************************
	* Layout
	*****************************************************/
	
	export module Layout {		
		/** !#en Enum for Layout Resize Mode
		!#zh 缩放模式 */
		export enum ResizeMode {			
			NONE = 0,
			CONTAINER = 0,
			CHILDREN = 0,		
		}	
	}	
	
	/****************************************************
	* Layout
	*****************************************************/
	
	export module Layout {		
		/** !#en Enum for Grid Layout start axis direction.
		The items in grid layout will be arranged in each axis at first.;
		!#zh 布局轴向，只用于 GRID 布局。 */
		export enum AxisDirection {			
			HORIZONTAL = 0,
			VERTICAL = 0,		
		}	
	}	
	
	/****************************************************
	* Layout
	*****************************************************/
	
	export module Layout {		
		/** !#en Enum for vertical layout direction.
		 Used in Grid Layout together with AxisDirection is VERTICAL
		!#zh 垂直方向布局方式 */
		export enum VerticalDirection {			
			BOTTOM_TO_TOP = 0,
			TOP_TO_BOTTOM = 0,		
		}	
	}	
	
	/****************************************************
	* Layout
	*****************************************************/
	
	export module Layout {		
		/** !#en Enum for horizontal layout direction.
		 Used in Grid Layout together with AxisDirection is HORIZONTAL
		!#zh 水平方向布局方式 */
		export enum HorizontalDirection {			
			LEFT_TO_RIGHT = 0,
			RIGHT_TO_LEFT = 0,		
		}	
	}	
	
	/****************************************************
	* Mask
	*****************************************************/
	
	export module Mask {		
		/** !#en the type for mask.
		!#zh 遮罩组件类型 */
		export enum Type {			
			RECT = 0,
			ELLIPSE = 0,
			IMAGE_STENCIL = 0,		
		}	
	}	
	
	/****************************************************
	* PageView
	*****************************************************/
	
	export module PageView {		
		/** !#en The Page View Size Mode
		!#zh 页面视图每个页面统一的大小类型 */
		export enum SizeMode {			
			Unified = 0,
			Free = 0,		
		}	
	}	
	
	/****************************************************
	* PageView
	*****************************************************/
	
	export module PageView {		
		/** !#en The Page View Direction
		!#zh 页面视图滚动类型 */
		export enum Direction {			
			Horizontal = 0,
			Vertical = 0,		
		}	
	}	
	
	/****************************************************
	* PageView
	*****************************************************/
	
	export module PageView {		
		/** !#en Enum for ScrollView event type.
		!#zh 滚动视图事件类型 */
		export enum EventType {			
			PAGE_TURNING = 0,		
		}	
	}	
	
	/****************************************************
	* PageViewIndicator
	*****************************************************/
	
	export module PageViewIndicator {		
		/** !#en Enum for PageView Indicator direction
		!#zh 页面视图指示器的摆放方向 */
		export enum Direction {			
			HORIZONTAL = 0,
			VERTICAL = 0,		
		}	
	}	
	
	/****************************************************
	* ProgressBar
	*****************************************************/
	
	export module ProgressBar {		
		/** !#en Enum for ProgressBar mode
		!#zh 进度条模式 */
		export enum Mode {			
			HORIZONTAL = 0,
			VERTICAL = 0,
			FILLED = 0,		
		}	
	}	
	
	/****************************************************
	* Scrollbar
	*****************************************************/
	
	export module Scrollbar {		
		/** Enum for Scrollbar direction */
		export enum Direction {			
			HORIZONTAL = 0,
			VERTICAL = 0,		
		}	
	}	
	
	/****************************************************
	* ScrollView
	*****************************************************/
	
	export module ScrollView {		
		/** !#en Enum for ScrollView event type.
		!#zh 滚动视图事件类型 */
		export enum EventType {			
			SCROLL_TO_TOP = 0,
			SCROLL_TO_BOTTOM = 0,
			SCROLL_TO_LEFT = 0,
			SCROLL_TO_RIGHT = 0,
			SCROLLING = 0,
			BOUNCE_TOP = 0,
			BOUNCE_BOTTOM = 0,
			BOUNCE_LEFT = 0,
			BOUNCE_RIGHT = 0,
			AUTOSCROLL_ENDED = 0,
			TOUCH_UP = 0,		
		}	
	}	
	
	/****************************************************
	* Slider
	*****************************************************/
	
	export module Slider {		
		/** !#en The Slider Direction
		!#zh 滑动器方向 */
		export enum Direction {			
			Horizontal = 0,
			Vertical = 0,		
		}	
	}	
	
	/****************************************************
	* Sprite
	*****************************************************/
	
	export module Sprite {		
		/** !#en Enum for sprite type.
		!#zh Sprite 类型 */
		export enum SpriteType {			
			SIMPLE = 0,
			SLICED = 0,
			TILED = 0,
			FILLED = 0,		
		}	
	}	
	
	/****************************************************
	* Sprite
	*****************************************************/
	
	export module Sprite {		
		/** !#en Enum for fill type.
		!#zh 填充类型 */
		export enum FillType {			
			HORIZONTAL = 0,
			VERTICAL = 0,
			RADIAL = 0,		
		}	
	}	
	
	/****************************************************
	* Sprite
	*****************************************************/
	
	export module Sprite {		
		/** !#en Sprite Size can track trimmed size, raw size or none.
		!#zh 精灵尺寸调整模式 */
		export enum SizeMode {			
			CUSTOM = 0,
			TRIMMED = 0,
			RAW = 0,		
		}	
	}	
	
	/****************************************************
	* VideoPlayer
	*****************************************************/
	
	export module VideoPlayer {		
		/** !#en Video event type
		!#zh 视频事件类型 */
		export enum EventType {			
			PLAYING = 0,
			PAUSED = 0,
			STOPPED = 0,
			COMPLETED = 0,		
		}	
	}	
	
	/****************************************************
	* VideoPlayer
	*****************************************************/
	
	export module VideoPlayer {		
		/** !#en Enum for video resouce type type.
		!#zh 视频来源 */
		export enum ResourceType {			
			REMOTE = 0,
			LOCAL = 0,		
		}	
	}	
	
	/****************************************************
	* WebView
	*****************************************************/
	
	export module WebView {		
		/** !#en WebView event type
		!#zh 网页视图事件类型 */
		export enum EventType {			
			LOADED = 0,
			LOADING = 0,
			ERROR = 0,		
		}	
	}	
	
	/****************************************************
	* Graphics
	*****************************************************/
	
	export module Graphics {		
		/** !#en Enum for LineCap.
		!#zh 线段末端属性 */
		export enum LineCap {			
			BUTT = 0,
			ROUND = 0,
			SQUARE = 0,		
		}	
	}	
	
	/****************************************************
	* Graphics
	*****************************************************/
	
	export module Graphics {		
		/** !#en Enum for LineJoin.
		!#zh 线段拐角属性 */
		export enum LineJoin {			
			BEVEL = 0,
			ROUND = 0,
			MITER = 0,		
		}	
	}	
	
	/****************************************************
	* Event
	*****************************************************/
	
	export module Event {			
			/** !#en The mouse event
			!#zh 鼠标事件类型 */
			export class EventMouse extends Event {			
			/** !#en Sets scroll data.
			!#zh 设置鼠标的滚动数据。 
			*/
			setScrollData(scrollX : number, scrollY : number) : void;			
			/** !#en Returns the x axis scroll value.
			!#zh 获取鼠标滚动的X轴距离，只有滚动时才有效。 
			*/
			getScrollX() : number;			
			/** !#en Returns the y axis scroll value.
			!#zh 获取滚轮滚动的 Y 轴距离，只有滚动时才有效。 
			*/
			getScrollY() : number;			
			/** !#en Sets cursor location.
			!#zh 设置当前鼠标位置。 
			*/
			setLocation(x : number, y : number) : void;			
			/** !#en Returns cursor location.
			!#zh 获取鼠标位置对象，对象包含 x 和 y 属性。 
			*/
			getLocation() : Vec2;			
			/** !#en Returns the current cursor location in screen coordinates.
			!#zh 获取当前事件在游戏窗口内的坐标位置对象，对象包含 x 和 y 属性。 
			*/
			getLocationInView() : Vec2;			
			/** !#en Returns the previous touch location.
			!#zh 获取鼠标点击在上一次事件时的位置对象，对象包含 x 和 y 属性。 
			*/
			getPreviousLocation() : Vec2;			
			/** !#en Returns the delta distance from the previous location to current location.
			!#zh 获取鼠标距离上一次事件移动的距离对象，对象包含 x 和 y 属性。 
			*/
			getDelta() : Vec2;			
			/** !#en Returns the X axis delta distance from the previous location to current location.
			!#zh 获取鼠标距离上一次事件移动的 X 轴距离。 
			*/
			getDeltaX() : number;			
			/** !#en Returns the Y axis delta distance from the previous location to current location.
			!#zh 获取鼠标距离上一次事件移动的 Y 轴距离。 
			*/
			getDeltaY() : number;			
			/** !#en Sets mouse button.
			!#zh 设置鼠标按键。 
			*/
			setButton(button : number) : void;			
			/** !#en Returns mouse button.
			!#zh 获取鼠标按键。 
			*/
			getButton() : number;			
			/** !#en Returns location X axis data.
			!#zh 获取鼠标当前位置 X 轴。 
			*/
			getLocationX() : number;			
			/** !#en Returns location Y axis data.
			!#zh 获取鼠标当前位置 Y 轴。 
			*/
			getLocationY() : number;		
		}	
	}	
	
	/****************************************************
	* Event
	*****************************************************/
	
	export module Event {			
			/** !#en The touch event
			!#zh 触摸事件 */
			export class EventTouch extends Event {			
			/** !#en Returns event code.
			!#zh 获取事件类型。 
			*/
			getEventCode() : number;			
			/** !#en Returns touches of event.
			!#zh 获取触摸点的列表。 
			*/
			getTouches() : any[];			
			/** !#en Sets touch location.
			!#zh 设置当前触点位置 
			*/
			setLocation(x : number, y : number) : void;			
			/** !#en Returns touch location.
			!#zh 获取触点位置。 
			*/
			getLocation() : Vec2;			
			/** !#en Returns the current touch location in screen coordinates.
			!#zh 获取当前触点在游戏窗口中的位置。 
			*/
			getLocationInView() : Vec2;			
			/** !#en Returns the previous touch location.
			!#zh 获取触点在上一次事件时的位置对象，对象包含 x 和 y 属性。 
			*/
			getPreviousLocation() : Vec2;			
			/** !#en Returns the start touch location.
			!#zh 获获取触点落下时的位置对象，对象包含 x 和 y 属性。 
			*/
			getStartLocation() : Vec2;			
			/** !#en Returns the id of cc.Touch.
			!#zh 触点的标识 ID，可以用来在多点触摸中跟踪触点。 
			*/
			getID() : number;			
			/** !#en Returns the delta distance from the previous location to current location.
			!#zh 获取触点距离上一次事件移动的距离对象，对象包含 x 和 y 属性。 
			*/
			getDelta() : Vec2;			
			/** !#en Returns the X axis delta distance from the previous location to current location.
			!#zh 获取触点距离上一次事件移动的 x 轴距离。 
			*/
			getDeltaX() : number;			
			/** !#en Returns the Y axis delta distance from the previous location to current location.
			!#zh 获取触点距离上一次事件移动的 y 轴距离。 
			*/
			getDeltaY() : number;			
			/** !#en Returns location X axis data.
			!#zh 获取当前触点 X 轴位置。 
			*/
			getLocationX() : number;			
			/** !#en Returns location Y axis data.
			!#zh 获取当前触点 Y 轴位置。 
			*/
			getLocationY() : number;		
		}	
	}	
	
	/****************************************************
	* Event
	*****************************************************/
	
	export module Event {			
			/** !#en The acceleration event
			!#zh 加速度事件 */
			export class EventAcceleration extends Event {		
		}	
	}	
	
	/****************************************************
	* Event
	*****************************************************/
	
	export module Event {			
			/** !#en The keyboard event
			!#zh 键盘事件 */
			export class EventKeyboard extends Event {		
		}	
	}	
	
	/****************************************************
	* SystemEvent
	*****************************************************/
	
	export module SystemEvent {		
		/** !#en The event type supported by SystemEvent
		!#zh SystemEvent 支持的事件类型 */
		export enum EventType {			
			KEY_DOWN = 0,
			KEY_UP = 0,
			DEVICEMOTION = 0,		
		}	
	}	
	
	/****************************************************
	* Pipeline
	*****************************************************/
	
	export module Pipeline {			
			/** The downloader pipe, it can download several types of files:
			1. Text
			2. Image
			3. Script
			4. Audio
			All unknown type will be downloaded as plain text.
			You can pass custom supported types in the constructor. */
			export class Downloader {			
			/** Constructor of Downloader, you can pass custom supported types.
			@param extMap Custom supported types with corresponded handler
			
			@example 
			```js
			var downloader = new Downloader({
			     // This will match all url with `.scene` extension or all url with `scene` type
			     'scene' : function (url, callback) {}
			 });
			``` 
			*/
			Downloader(extMap : any) : void;			
			/** Add custom supported types handler or modify existing type handler.
			@param extMap Custom supported types with corresponded handler 
			*/
			addHandlers(extMap : any) : void;		
		}	
	}	
	
	/****************************************************
	* Pipeline
	*****************************************************/
	
	export module Pipeline {			
			/** The loader pipe, it can load several types of files:
			1. Images
			2. JSON
			3. Plist
			4. Audio
			5. Font
			6. Cocos Creator scene
			It will not interfere with items of unknown type.
			You can pass custom supported types in the constructor. */
			export class Loader {			
			/** Constructor of Loader, you can pass custom supported types.
			@param extMap Custom supported types with corresponded handler
			
			@example 
			```js
			var loader = new Loader({
			     // This will match all url with `.scene` extension or all url with `scene` type
			     'scene' : function (url, callback) {}
			 });
			``` 
			*/
			Loader(extMap : any) : void;			
			/** Add custom supported types handler or modify existing type handler.
			@param extMap Custom supported types with corresponded handler 
			*/
			addHandlers(extMap : any) : void;		
		}	
	}	
	
	/****************************************************
	* LoadingItems
	*****************************************************/
	
	export module LoadingItems {		
		/** !#en The item states of the LoadingItems, its value could be LoadingItems.ItemState.WORKING | LoadingItems.ItemState.COMPLETET | LoadingItems.ItemState.ERROR
		!#zh LoadingItems 队列中的加载项状态，状态的值可能是 LoadingItems.ItemState.WORKING | LoadingItems.ItemState.COMPLETET | LoadingItems.ItemState.ERROR */
		export enum ItemState {			
			WORKING = 0,
			COMPLETET = 0,
			ERROR = 0,		
		}	
	}	
	
	/****************************************************
	* Texture2D
	*****************************************************/
	
	export module Texture2D {		
		/** The texture wrap mode */
		export enum WrapMode {			
			REPEAT = 0,
			CLAMP_TO_EDGE = 0,
			MIRRORED_REPEAT = 0,		
		}	
	}
}
/** !#en
AnySDK is a third party solution that offers game developers SDK integration without making changes to the SDK's features or parameters.It can do all of this while remaining invisible to your end user.Our goal is to handle all the tedious SDK integration work for you so that you can use your time to focus on the game itself.No matter if it’s the channel SDK, user system, payment system, ad system, statistics system, sharing system or any other type of SDK: we’ll take care of it for you.
!#zh
AnySDK 为 CP 提供一套第三方 SDK 接入解决方案，整个接入过程，不改变任何 SDK 的功能、特性、参数等，对于最终玩家而言是完全透明无感知的。
目的是让 CP 商能有更多时间更专注于游戏本身的品质，所有 SDK 的接入工作统统交给我们吧。第三方 SDK 包括了渠道SDK、用户系统、支付系统、广告系统、统计系统、分享系统等等。 */
declare module anysdk {	
	/** !#en
	agent manager of plugin
	!#zh
	插件管理对象 */
	export var agentManager : anysdk.AgentManager;		
		/** !#en
		agent manager of plugin
		!#zh
		插件管理类 */
		export class AgentManager {		
		/** !#en
		AppKey appSecret and privateKey are the only three parameters generated
		after the packing tool client finishes creating the game.
		The oauthLoginServer parameter is the API address provided by the game service
		to login verification
		!#zh
		appKey、appSecret、privateKey是通过 AnySDK 客户端工具创建游戏后生成的。
		oauthLoginServer参数是游戏服务提供的用来做登陆验证转发的接口地址。 
		*/
		init(appKey : string, appSecret : string, privateKey : string, oauthLoginServer : string) : void;		
		/** !#en
		load all plugins, the operation includes SDK`s initialization
		!#zh
		加载所有插件，该操作包含了 SDKs 初始化
		@param target The object to bind to. 
		*/
		loadAllPlugins(callback : Function, target : any) : void;		
		/** !#en
		unload all plugins
		!#zh
		卸载插件 
		*/
		unloadAllPlugins() : void;		
		/** !#en
		get user system plugin
		!#zh
		获取用户系统插件 
		*/
		getUserPlugin() : anysdk.ProtocolUser;		
		/** !#en
		get IAP system plugins
		!#zh
		获取支付系统插件 
		*/
		getIAPPlugins() : anysdk.ProtocolIAP;		
		/** !#en
		get IAP system plugin
		!#zh
		获取支付系统插件 
		*/
		getIAPPlugin() : anysdk.ProtocolIAP;		
		/** !#en
		get social system plugin
		!#zh
		获取社交系统插件 
		*/
		getSocialPlugin() : anysdk.ProtocolSocial;		
		/** !#en
		get share system plugin
		!#zh
		获取分享系统插件 
		*/
		getSharePlugin() : anysdk.ProtocolShare;		
		/** !#en
		get analytics system plugin
		!#zh
		获取统计系统插件 
		*/
		getAnalyticsPlugin() : anysdk.ProtocolAnalytics;		
		/** !#en
		get ads system plugin
		!#zh
		获取广告系统插件 
		*/
		getAdsPlugin() : anysdk.ProtocolAds;		
		/** !#en
		get push system plugin
		!#zh
		获取推送系统插件 
		*/
		getPushPlugin() : anysdk.ProtocolPush;		
		/** !#en
		get REC system plugin
		!#zh
		获取录屏系统插件 
		*/
		getRECPlugin() : anysdk.ProtocolREC;		
		/** !#en
		get crash system plugin
		!#zh
		获取崩溃分析系统插件 
		*/
		getCrashPlugin() : anysdk.ProtocolCrash;		
		/** !#en
		get ad track system plugin
		!#zh
		获取广告追踪系统插件 
		*/
		getAdTrackingPlugin() : anysdk.ProtocolAdTracking;		
		/** !#en
		get custom system plugin
		!#zh
		获取自定义系统插件 
		*/
		getCustomPlugin() : anysdk.ProtocolCustom;		
		/** !#en
		get custom parameter
		!#zh
		获取自定义参数 
		*/
		getCustomParam() : string;		
		/** !#en
		get channel id
		!#zh
		获取渠道唯一表示符 
		*/
		getChannelId() : string;		
		/** !#en
		get status of analytics
		!#zh
		获取统计状态 
		*/
		isAnaylticsEnabled() : boolean;		
		/** !#en
		set whether to analytics
		!#zh
		设置是否统计 
		*/
		setIsAnaylticsEnabled(enabled : boolean) : void;		
		/** !#en
		destory instance
		!#zh
		销毁单例 
		*/
		end() : void;		
		/** !#en
		get instance
		!#zh
		获取单例 
		*/
		getInstance() : anysdk.AgentManager;	
	}		
		/** !#en
		plugin protocol
		!#zh
		插件协议 */
		export class PluginProtocol {		
		/** !#en
		Check whether the function is supported
		!#zh
		判断函数是否支持 
		*/
		isFunctionSupported(functionName : string) : boolean;		
		/** !#en
		get plugin name
		!#zh
		获取插件名称 
		*/
		getPluginName() : string;		
		/** !#en
		get plugin version
		!#zh
		获取插件版本 
		*/
		getPluginVersion() : string;		
		/** !#en
		get SDK version
		!#zh
		获取 SDK 版本 
		*/
		getSDKVersion() : string;		
		/** !#en
		void methods for reflections with parameter
		!#zh
		反射调用带参数的void方法
		@param args optional arguments 
		*/
		callFuncWithParam(funName : string, args? : any|anysdk.PluginParam) : void;		
		/** !#en
		String methods for reflections with parameter
		!#zh
		反射调用带参数的 String 方法
		@param args optional arguments 
		*/
		callStringFuncWithParam(funName : string, args? : any|anysdk.PluginParam) : string;		
		/** !#en
		int methods for reflections with parameter
		!#zh
		反射调用带参数的 Int 方法
		@param args optional arguments 
		*/
		callIntFuncWithParam(funName : string, args? : any|anysdk.PluginParam) : number;		
		/** !#en
		boolean methods for reflections with parameter
		!#zh
		反射调用带参数的 boolean 方法
		@param args optional arguments 
		*/
		callBoolFuncWithParam(funName : string, args? : any|anysdk.PluginParam) : boolean;		
		/** !#en
		float methods for reflections with parameter
		!#zh
		反射调用带参数的 float 方法
		@param args optional arguments 
		*/
		callFloatFuncWithParam(funName : string, args? : any|anysdk.PluginParam) : number;	
	}		
		/** !#en
		user protocol
		!#zh
		用户系统协议接口 */
		export class ProtocolUser extends PluginProtocol {		
		/** !#en
		login interface
		!#zh
		登录接口
		@param args optional arguments 
		*/
		login(args? : string|any) : void;		
		/** !#en
		get status of login
		!#zh
		获取登录状态 
		*/
		isLogined() : boolean;		
		/** !#en
		get user ID
		!#zh
		获取用户唯一标示符 
		*/
		getUserID() : string;		
		/** !#en
		get plugin ID
		!#zh
		获取插件ID 
		*/
		getPluginId() : string;		
		/** !#en
		set listener
		!#zh
		设置用户系统的监听 
		*/
		setListener(listener : Function, target : any) : void;		
		/** !#en
		get listener
		!#zh
		获取用户系统的监听 
		*/
		getListener() : Function;		
		/** !#en
		logout
		Before to invoke, you need to verdict whether this properties existed
		!#zh
		登出，调用前需要判断属性是否存在 
		*/
		logout() : void;		
		/** !#en
		show toolbar
		Before to invoke, you need to verdict whether this properties existed
		!#zh
		显示悬浮窗，调用前需要判断属性是否存在 
		*/
		showToolBar(place : anysdk.ToolBarPlace) : void;		
		/** !#en
		hide toolbar
		Before to invoke, you need to verdict whether this properties existed
		!#zh
		隐藏悬浮窗，调用前需要判断属性是否存在 
		*/
		hideToolBar() : void;		
		/** !#en
		enter platform
		Before to invoke, you need to verdict whether this properties existed
		!#zh
		显示平台中心，调用前需要判断属性是否存在 
		*/
		enterPlatform() : void;		
		/** !#en
		show exit page
		Before to invoke, you need to verdict whether this properties existed
		!#zh
		显示退出界面，调用前需要判断属性是否存在 
		*/
		exit() : void;		
		/** !#en
		show pause page
		Before to invoke, you need to verdict whether this properties existed
		!#zh
		显示暂停界面，调用前需要判断属性是否存在 
		*/
		pause() : void;		
		/** !#en
		Real-name registration
		Before to invoke, you need to verdict whether this properties existed
		!#zh
		实名注册，调用前需要判断属性是否存在 
		*/
		realNameRegister() : void;		
		/** !#en
		Anti-addiction query
		Before to invoke, you need to verdict whether this properties existed
		!#zh
		防沉迷查询，调用前需要判断属性是否存在 
		*/
		antiAddictionQuery() : void;		
		/** !#en
		submit game role information
		Before to invoke, you need to verdict whether this properties existed
		!#zh
		提交角色信息，调用前需要判断属性是否存在 
		*/
		submitLoginGameRole(data : any) : void;		
		/** !#en
		get user information
		Before to invoke, you need to verdict whether this properties existed
		!#zh
		获取用户信息，调用前需要判断属性是否存在 
		*/
		getUserInfo(info : any) : void;		
		/** !#en
		set login type
		Before to invoke, you need to verdict whether this properties existed
		!#zh
		设置登录类型，调用前需要判断属性是否存在 
		*/
		getAvailableLoginType(info : any) : void;		
		/** !#en
		set login type
		Before to invoke, you need to verdict whether this properties existed
		!#zh
		设置登录类型，调用前需要判断属性是否存在 
		*/
		setLoginType(loginType : string) : void;		
		/** !#en
		send to desktop
		Before to invoke, you need to verdict whether this properties existed
		!#zh
		发送到桌面，调用前需要判断属性是否存在 
		*/
		sendToDesktop() : void;		
		/** !#en
		open bbs
		Before to invoke, you need to verdict whether this properties existed
		!#zh
		打开论坛，调用前需要判断属性是否存在 
		*/
		openBBS() : void;	
	}		
		/** !#en
		IAP protocol
		!#zh
		支付系统协议接口 */
		export class ProtocolIAP extends PluginProtocol {		
		/** !#en
		pay interface
		!#zh
		支付接口
		@param info Type:map 
		*/
		payForProduct(info : any) : void;		
		/** !#en
		get order ID
		!#zh
		获取订单ID 
		*/
		getOrderId() : string;		
		/** !#en
		reset the pay status
		!#zh
		重置支付状态 
		*/
		resetPayState() : void;		
		/** !#en
		get plugin ID
		!#zh
		获取插件ID 
		*/
		getPluginId() : string;		
		/** !#en
		set listener
		!#zh
		设置支付系统的监听 
		*/
		setListener(listener : Function, target : any) : void;		
		/** !#en
		get listener
		!#zh
		获取支付系统的监听 
		*/
		getListener() : Function;	
	}		
		/** !#en
		analytics protocol
		!#zh
		统计系统协议接口 */
		export class ProtocolAnalytics extends PluginProtocol {		
		/** !#en
		Start a new session.
		!#zh
		启动会话 
		*/
		startSession() : void;		
		/** !#en
		 Stop a session.
		!#zh
		关闭会话 
		*/
		stopSession() : void;		
		/** !#en
		Set the timeout for expiring a session.
		!#zh
		设置会话超时时间
		@param millis Type: long 
		*/
		setSessionContinueMillis(millis : number) : void;		
		/** !#en
		log an error
		!#zh
		捕捉异常 
		*/
		logError(errorId : string, message : string) : void;		
		/** !#en
		log an event.
		!#zh
		捕捉事件
		@param args optional arguments Type: map 
		*/
		logEvent(errorId : string, args? : any) : void;		
		/** !#en
		Track an event begin.
		!#zh
		统计事件开始 
		*/
		logTimedEventBegin(eventId : string) : void;		
		/** !#en
		Track an event end.
		!#zh
		统计事件结束 
		*/
		logTimedEventEnd(eventId : string) : void;		
		/** !#en
		set Whether to catch uncaught exceptions to server.
		!#zh
		设置是否开启自动异常捕捉 
		*/
		setCaptureUncaughtException(enabled : boolean) : void;		
		/** !#en
		analytics account information
		!#zh
		统计玩家帐户信息
		@param paramMap Type: map 
		*/
		setAccount(paramMap : any) : void;		
		/** !#en
		track user to request payment
		!#zh
		跟踪用户支付请求
		@param paramMap Type: map 
		*/
		onChargeRequest(paramMap : any) : void;		
		/** !#en
		track Successful payment
		!#zh
		追踪用户支付成功 
		*/
		onChargeSuccess(orderID : string) : void;		
		/** !#en
		track failed payment
		!#zh
		追踪用户支付失败
		@param paramMap Type: map 
		*/
		onChargeFail(paramMap : any) : void;		
		/** !#en
		track Successful payment
		!#zh
		统计玩家支付成功
		@param paramMap Type: map 
		*/
		onChargeOnlySuccess(paramMap : any) : void;		
		/** !#en
		track user purchase
		!#zh
		统计玩家消费
		@param paramMap Type: map 
		*/
		onPurchase(paramMap : any) : void;		
		/** !#en
		track user to use goods
		!#zh
		统计玩家使用道具
		@param paramMap Type: map 
		*/
		onUse(paramMap : any) : void;		
		/** !#en
		track user to reward goods
		!#zh
		统计玩家获取奖励
		@param paramMap Type: map 
		*/
		onReward(paramMap : any) : void;		
		/** !#en
		 start level
		!#zh
		开始关卡
		@param paramMap Type: map 
		*/
		startLevel(paramMap : any) : void;		
		/** !#en
		finish level
		!#zh
		结束关卡 
		*/
		finishLevel(levelID : string) : void;		
		/** !#en
		failed level
		!#zh
		关卡失败
		@param paramMap Type: map 
		*/
		failLevel(paramMap : any) : void;		
		/** !#en
		start task
		!#zh
		开始任务
		@param paramMap Type: map 
		*/
		startTask(paramMap : any) : void;		
		/** !#en
		finish task
		!#zh
		完成任务 
		*/
		finishTask(taskID : string) : void;		
		/** !#en
		failed task
		!#zh
		任务失败
		@param paramMap Type: map 
		*/
		failTask(paramMap : any) : void;	
	}		
		/** !#en
		share protocol
		!#zh
		分享系统协议接口 */
		export class ProtocolShare extends PluginProtocol {		
		/** !#en
		share interface
		!#zh
		分享
		@param info Type: map 
		*/
		share(info : any) : void;		
		/** !#en
		set listener
		!#zh
		设置分享系统的监听 
		*/
		setListener(listener : Function, target : any) : void;		
		/** !#en
		get listener
		!#zh
		获取分享系统的监听 
		*/
		getListener() : Function;	
	}		
		/** !#en
		ads protocol
		!#zh
		广告系统协议接口 */
		export class ProtocolAds extends PluginProtocol {		
		/** !#en
		hide ads view
		!#zh
		隐藏广告 
		*/
		hideAds(adstype : anysdk.AdsType, idx : number) : void;		
		/** !#en
		preload ads view
		!#zh
		预加载广告 
		*/
		preloadAds(adstype : anysdk.AdsType, idx : number) : void;		
		/** !#en
		query points
		!#zh
		查询分数 
		*/
		queryPoints() : number;		
		/** !#en
		get whether the ads type is supported
		!#zh
		获取广告类型是否支持 
		*/
		isAdTypeSupported(arg0 : anysdk.AdsType) : boolean;		
		/** !#en
		spend point
		!#zh
		消费分数 
		*/
		spendPoints(points : number) : void;		
		/** !#en
		set listener
		!#zh
		设置广告系统的监听 
		*/
		setListener(listener : Function, target : any) : void;		
		/** !#en
		get listener
		!#zh
		获取广告系统的监听 
		*/
		getListener() : Function;	
	}		
		/** !#en
		social protocol
		!#zh
		社交系统协议接口 */
		export class ProtocolSocial extends PluginProtocol {		
		/** !#en
		sign in
		!#zh
		登录 
		*/
		signIn() : void;		
		/** !#en
		 sign out
		!#zh
		登出 
		*/
		signOut() : void;		
		/** !#en
		submit score
		!#zh
		提交分数
		@param score Type: long 
		*/
		submitScore(leadboardID : string, score : number) : void;		
		/** !#en
		show the id of Leaderboard page
		!#zh
		根据唯一标识符显示排行榜 
		*/
		showLeaderboard(leaderboardID : string) : void;		
		/** !#en
		show the page of achievements
		!#zh
		显示成就榜 
		*/
		showAchievements() : void;		
		/** !#en
		unlock achievement
		!#zh
		解锁成就
		@param info Type: map 
		*/
		share(info : any) : void;		
		/** !#en
		set listener
		!#zh
		设置社交系统的监听 
		*/
		setListener(listener : Function, target : any) : void;		
		/** !#en
		get listener
		!#zh
		获取社交系统的监听 
		*/
		getListener() : Function;		
		/** !#en
		get friends info
		Before to invoke, you need to verdict whether this properties existed
		!#zh
		获取好友信息，调用前需要判断属性是否存在 
		*/
		pauseRecording() : void;		
		/** !#en
		interact
		Before to invoke, you need to verdict whether this properties existed
		!#zh
		订阅，调用前需要判断属性是否存在 
		*/
		interact() : void;		
		/** !#en
		subscribe
		Before to invoke, you need to verdict whether this properties existed
		!#zh
		关注，调用前需要判断属性是否存在 
		*/
		subscribe() : void;	
	}		
		/** !#en
		push protocol
		!#zh
		推送系统协议接口 */
		export class ProtocolPush extends PluginProtocol {		
		/** !#en
		start Push services
		!#zh
		启动推送服务 
		*/
		startPush() : void;		
		/** !#en
		close Push services
		!#zh
		暂停推送服务 
		*/
		closePush() : void;		
		/** !#en
		delete alias
		!#zh
		删除别名 
		*/
		delAlias(alias : string) : void;		
		/** !#en
		set alias
		!#zh
		设置别名 
		*/
		setAlias(alias : string) : void;		
		/** !#en
		delete tags
		!#zh
		删除标签
		@param tags Type: list 
		*/
		delTags(tags : any) : void;		
		/** !#en
		set tags
		!#zh
		设置标签
		@param tags Type: list 
		*/
		setTags(tags : any) : void;		
		/** !#en
		set listener
		!#zh
		设置推送系统的监听 
		*/
		setListener(listener : Function, target : any) : void;		
		/** !#en
		get listener
		!#zh
		获取推送系统的监听 
		*/
		getListener() : Function;	
	}		
		/** !#en
		crash protocol
		!#zh
		崩溃分析系统协议接口 */
		export class ProtocolCrash extends PluginProtocol {		
		/** !#en
		set user identifier
		!#zh
		统计用户唯一标识符 
		*/
		setUserIdentifier(identifier : string) : void;		
		/** !#en
		The uploader captured in exception information
		!#zh
		上报异常信息 
		*/
		reportException(message : string, exception : string) : void;		
		/** !#en
		customize logging
		!#zh
		自定义日志记录 
		*/
		leaveBreadcrumb(breadcrumb : string) : void;	
	}		
		/** !#en
		REC protocol
		!#zh
		录屏系统协议接口 */
		export class ProtocolREC extends PluginProtocol {		
		/** !#en
		share video
		!#zh
		分享视频
		@param info Type: map 
		*/
		share(info : any) : void;		
		/** !#en
		Start to record video
		!#zh
		开始录制视频 
		*/
		startRecording() : void;		
		/** !#en
		Start to record video
		!#zh
		结束录制视频 
		*/
		stopRecording() : void;		
		/** !#en
		set listener
		!#zh
		设置录屏系统的监听 
		*/
		setListener(listener : Function, target : any) : void;		
		/** !#en
		get listener
		!#zh
		获取录屏系统的监听 
		*/
		getListener() : Function;		
		/** !#en
		pause to record video
		Before to invoke, you need to verdict whether this properties existed
		!#zh
		暂停录制视频，调用前需要判断属性是否存在 
		*/
		pauseRecording() : void;		
		/** !#en
		resume to record video
		Before to invoke, you need to verdict whether this properties existed
		!#zh
		恢复录制视频，调用前需要判断属性是否存在 
		*/
		resumeRecording() : void;		
		/** !#en
		get whether the device is isAvailable
		Before to invoke, you need to verdict whether this properties existed
		!#zh
		获取设备是否可用，调用前需要判断属性是否存在 
		*/
		isAvailable() : boolean;		
		/** !#en
		get status of recording
		Before to invoke, you need to verdict whether this properties existed
		!#zh
		获取录制状态，调用前需要判断属性是否存在 
		*/
		isRecording() : boolean;		
		/** !#en
		show toolbar
		Before to invoke, you need to verdict whether this properties existed
		!#zh
		显示悬浮窗，调用前需要判断属性是否存在 
		*/
		showToolBar() : void;		
		/** !#en
		hide toolbar
		Before to invoke, you need to verdict whether this properties existed
		!#zh
		隐藏悬浮窗，调用前需要判断属性是否存在 
		*/
		hideToolBar() : void;		
		/** !#en
		show video center
		Before to invoke, you need to verdict whether this properties existed
		!#zh
		显示视频中心，调用前需要判断属性是否存在 
		*/
		showVideoCenter() : void;		
		/** !#en
		enter platform
		Before to invoke, you need to verdict whether this properties existed
		!#zh
		显示平台中心，调用前需要判断属性是否存在 
		*/
		enterPlatform() : void;		
		/** !#en
		Set the video data, it is recommended to check whether are recorded firstly
		Before to invoke, you need to verdict whether this properties existed
		!#zh
		设置视频相关数据，建议先检查是否是正在录制，调用前需要判断属性是否存在
		@param info Type: map 
		*/
		setMetaData(info : any) : void;	
	}		
		/** !#en
		ad tracking protocol
		!#zh
		广告追踪系统协议接口 */
		export class ProtocolAdTracking extends PluginProtocol {		
		/** !#en
		Call this method if you want to track register events as happening during a section.
		!#zh
		统计用户注册信息
		@param productInfo Type: map 
		*/
		onPay(productInfo : any) : void;		
		/** !#en
		Call this method if you want to track register events as happening during a section.
		!#zh
		统计用户注册信息
		@param userInfo Type: map 
		*/
		onLogin(userInfo : any) : void;		
		/** !#en
		Call this method if you want to track register events as happening during a section.
		!#zh
		统计用户注册信息 
		*/
		onRegister(userId : string) : void;		
		/** !#en
		Call this method if you want to track custom events with parameters as happening during a section.
		!#zh
		统计自定义事件
		@param paramMap Type: map 
		*/
		trackEvent(eventId : string, paramMap : any) : void;		
		/** !#en
		Call this method with parameters if you want to create role as happening during a section.
		!#zh
		统计创建角色事件，调用前需要判断属性是否存在
		@param userInfo Type: map 
		*/
		onCreateRole(userInfo : any) : void;		
		/** !#en
		Call this method if you want to track levelup events with parameters as happening during a section.
		Before to invoke, you need to verdict whether this properties existed
		!#zh
		统计角色升级事件，调用前需要判断属性是否存在
		@param info Type: map 
		*/
		onLevelUp(info : any) : void;		
		/** !#en
		Invoke this method with parameters if you want to start to pay as happening during a section.
		Before to invoke, you need to verdict whether this properties existed
		!#zh
		统计开始充值事件，调用前需要判断属性是否存在
		@param info Type: map 
		*/
		onStartToPay(info : any) : void;	
	}		
		/** !#en
		custom protocol
		!#zh
		自定义系统协议接口 */
		export class ProtocolCustom extends PluginProtocol {		
		/** !#en
		set listener
		!#zh
		设置自定义系统的监听 
		*/
		setListener(listener : Function, target : any) : void;		
		/** !#en
		get listener
		!#zh
		获取自定义系统的监听 
		*/
		getListener() : Function;	
	}		
		/** !#en
		Data structure class
		!#zh
		数据结构类 */
		export class PluginParam {		
		/** !#en
		create plugin parameters
		!#zh
		创建对象 
		*/
		create(parameters : number|string|any) : anysdk.PluginParam;	
	}	
	/** !#en The callback of user system
	!#zh 用户系统回调 */
	export enum UserActionResultCode {		
		kInitSuccess = 0,
		kInitFail = 0,
		kLoginSuccess = 0,
		kLoginNetworkError = 0,
		kLoginNoNeed = 0,
		kLoginFail = 0,
		kLoginCancel = 0,
		kLogoutSuccess = 0,
		kLogoutFail = 0,
		kPlatformEnter = 0,
		kPlatformBack = 0,
		kPausePage = 0,
		kExitPage = 0,
		kAntiAddictionQuery = 0,
		kRealNameRegister = 0,
		kAccountSwitchSuccess = 0,
		kAccountSwitchFail = 0,
		kOpenShop = 0,
		kAccountSwitchCancel = 0,
		kUserExtension = 0,
		kSendToDesktopSuccess = 0,
		kSendToDesktopFail = 0,
		kGetAvailableLoginTypeSuccess = 0,
		kGetAvailableLoginTypeFail = 0,
		kGetUserInfoSuccess = 0,
		kGetUserInfoFail = 0,
		kOpenBBSSuccess = 0,
		kOpenBBSFail = 0,	
	}	
	/** !#en The toolbar position of user type
	!#zh 用户系统悬浮窗位置 */
	export enum ToolBarPlace {		
		kToolBarTopLeft = 0,
		kToolBarTopRight = 0,
		kToolBarMidLeft = 0,
		kToolBarMidRight = 0,
		kToolBarBottomLeft = 0,
		kToolBarBottomRight = 0,	
	}	
	/** !#en The callback of requesting reStringge
	!#zh 支付系统支付请求回调 */
	export enum PayResultCode {		
		kPaySuccess = 0,
		kPayFail = 0,
		kPayCancel = 0,
		kPayNetworkError = 0,
		kPayProductionInforIncomplete = 0,
		kPayInitSuccess = 0,
		kPayInitFail = 0,
		kPayNowPaying = 0,
		kPayReStringgeSuccess = 0,
		kPayExtension = 0,
		kPayNeedLoginAgain = 0,
		kRequestSuccess = 0,
		kRequestFail = 0,	
	}	
	/** !#en The enum of account type
	!#zh 统计系统的账号类型 */
	export enum AccountType {		
		ANONYMOUS = 0,
		REGISTED = 0,
		SINA_WEIBO = 0,
		TENCENT_WEIBO = 0,
		QQ = 0,
		ND91 = 0,	
	}	
	/** !#en The enum of account operation
	!#zh 统计系统的账号操作 */
	export enum AccountOperate {		
		LOGIN = 0,
		LOGOUT = 0,
		REGISTER = 0,	
	}	
	/** !#en The enum of gender
	!#zh 统计系统的账号性别 */
	export enum AccountGender {		
		MALE = 0,
		FEMALE = 0,
		UNKNOWN = 0,	
	}	
	/** !#en The enum of task type
	!#zh 统计系统的任务类型 */
	export enum TaskType {		
		GUIDE_LINE = 0,
		MAIN_LINE = 0,
		BRANCH_LINE = 0,
		DAILY = 0,
		ACTIVITY = 0,
		OTHER = 0,	
	}	
	/** !#en The callback of share system
	!#zh 分享系统回调 */
	export enum ShareResultCode {		
		kShareSuccess = 0,
		kShareFail = 0,
		kShareCancel = 0,
		kShareNetworkError = 0,
		kShareExtension = 0,	
	}	
	/** !#en The callback of social system
	!#zh 社交系统回调 */
	export enum SocialRetCode {		
		kScoreSubmitSucceed = 0,
		kScoreSubmitfail = 0,
		kAchUnlockSucceed = 0,
		kAchUnlockFail = 0,
		kSocialSignInSucceed = 0,
		kSocialSignInFail = 0,
		kSocialSignOutSucceed = 0,
		kSocialSignOutFail = 0,
		kSocialGetGameFriends = 0,
		kSocialExtensionCode = 0,
		kSocialGetFriendsInfoSuccess = 0,
		kSocialGetFriendsInfoFail = 0,
		kSocialAlreadySubscription = 0,
		kSocialNoSubscription = 0,
		kSocialSubscriptionFail = 0,	
	}	
	/** !#en The callback of ads system
	!#zh 广告系统回调 */
	export enum AdsResultCode {		
		kAdsReceived = 0,
		kAdsShown = 0,
		kAdsDismissed = 0,
		kPointsSpendSucceed = 0,
		kPointsSpendFailed = 0,
		kNetworkError = 0,
		kUnknownError = 0,
		kOfferWallOnPointsChanged = 0,
		kRewardedVideoWithReward = 0,
		kInAppPurchaseFinished = 0,
		kAdsClicked = 0,
		kAdsExtension = 0,	
	}	
	/** !#en The enum of ads position
	!#zh 广告位置 */
	export enum AdsPos {		
		kPosCenter = 0,
		kPosTop = 0,
		kPosTopLeft = 0,
		kPosTopRight = 0,
		kPosBottom = 0,
		kPosBottomLeft = 0,
		kPosBottomRight = 0,	
	}	
	/** !#en The enum of ads type
	!#zh 广告类型 */
	export enum AdsType {		
		AD_TYPE_BANNER = 0,
		AD_TYPE_FULLSCREEN = 0,
		AD_TYPE_MOREAPP = 0,
		AD_TYPE_OFFERWALL = 0,
		AD_TYPE_REWARDEDVIDEO = 0,
		AD_TYPE_NATIVEEXPRESS = 0,
		AD_TYPE_NATIVEADVANCED = 0,	
	}	
	/** !#en The callback of push system
	!#zh 推送系统回调 */
	export enum PushActionResultCode {		
		kPushReceiveMessage = 0,
		kPushExtensionCode = 0,	
	}	
	/** !#en The callback of custom system
	!#zh 自定义系统回调 */
	export enum CustomResultCode {		
		kCustomExtension = 0,	
	}	
	/** !#en The callback of REC system
	!#zh 录屏系统回调 */
	export enum RECResultCode {		
		kRECInitSuccess = 0,
		kRECInitFail = 0,
		kRECStartRecording = 0,
		kRECStopRecording = 0,
		kRECPauseRecording = 0,
		kRECResumeRecording = 0,
		kRECEnterSDKPage = 0,
		kRECQuitSDKPage = 0,
		kRECShareSuccess = 0,
		kRECShareFail = 0,
		kRECExtension = 0,	
	}
}
/** !#en
The global main namespace of Spine, all classes, functions,
properties and constants of Spine are defined in this namespace
!#zh
Spine 的全局的命名空间，
与 Spine 相关的所有的类，函数，属性，常量都在这个命名空间中定义。 */
declare module sp {		
		/** !#en
		The skeleton of Spine <br/>
		<br/>
		(Skeleton has a reference to a SkeletonData and stores the state for skeleton instance,
		which consists of the current pose's bone SRT, slot colors, and which slot attachments are visible. <br/>
		Multiple skeletons can use the same SkeletonData which includes all animations, skins, and attachments.) <br/>
		!#zh
		Spine 骨骼动画 <br/>
		<br/>
		(Skeleton 具有对骨骼数据的引用并且存储了骨骼实例的状态，
		它由当前的骨骼动作，slot 颜色，和可见的 slot attachments 组成。<br/>
		多个 Skeleton 可以使用相同的骨骼数据，其中包括所有的动画，皮肤和 attachments。 */
		export class Skeleton extends _RendererUnderSG {		
		/** !#en The skeletal animation is paused?
		!#zh 该骨骼动画是否暂停。 */
		paused : boolean;		
		/** !#en
		The skeleton data contains the skeleton information (bind pose bones, slots, draw order,
		attachments, skins, etc) and animations but does not hold any state.<br/>
		Multiple skeletons can share the same skeleton data.
		!#zh
		骨骼数据包含了骨骼信息（绑定骨骼动作，slots，渲染顺序，
		attachments，皮肤等等）和动画但不持有任何状态。<br/>
		多个 Skeleton 可以共用相同的骨骼数据。 */
		skeletonData : SkeletonData;		
		/** !#en The name of default skin.
		!#zh 默认的皮肤名称。 */
		defaultSkin : string;		
		/** !#en The name of default animation.
		!#zh 默认的动画名称。 */
		defaultAnimation : string;		
		/** !#en The name of current playing animation.
		!#zh 当前播放的动画名称。 */
		animation : string;		
		_defaultSkinIndex : number;		
		/** !#en TODO
		!#zh 是否循环播放当前骨骼动画。 */
		loop : boolean;		
		/** !#en Indicates whether to enable premultiplied alpha.
		You should disable this option when image's transparent area appears to have opaque pixels,
		or enable this option when image's half transparent area appears to be darken.
		!#zh 是否启用贴图预乘。
		当图片的透明区域出现色块时需要关闭该选项，当图片的半透明区域颜色变黑时需要启用该选项。 */
		premultipliedAlpha : boolean;		
		/** !#en The time scale of this skeleton.
		!#zh 当前骨骼中所有动画的时间缩放率。 */
		timeScale : number;		
		/** !#en Indicates whether open debug slots.
		!#zh 是否显示 slot 的 debug 信息。 */
		debugSlots : boolean;		
		/** !#en Indicates whether open debug bones.
		!#zh 是否显示 bone 的 debug 信息。 */
		debugBones : boolean;		
		/** !#en Computes the world SRT from the local SRT for each bone.
		!#zh 重新更新所有骨骼的世界 Transform，
		当获取 bone 的数值未更新时，即可使用该函数进行更新数值。
		
		@example 
		```js
		var bone = spine.findBone('head');
		cc.log(bone.worldX); // return 0;
		spine.updateWorldTransform();
		bone = spine.findBone('head');
		cc.log(bone.worldX); // return -23.12;
		``` 
		*/
		updateWorldTransform() : void;		
		/** !#en Sets the bones and slots to the setup pose.
		!#zh 还原到起始动作 
		*/
		setToSetupPose() : void;		
		/** !#en
		Sets the bones to the setup pose,
		using the values from the `BoneData` list in the `SkeletonData`.
		!#zh
		设置 bone 到起始动作
		使用 SkeletonData 中的 BoneData 列表中的值。 
		*/
		setBonesToSetupPose() : void;		
		/** !#en
		Sets the slots to the setup pose,
		using the values from the `SlotData` list in the `SkeletonData`.
		!#zh
		设置 slot 到起始动作。
		使用 SkeletonData 中的 SlotData 列表中的值。 
		*/
		setSlotsToSetupPose() : void;		
		/** !#en
		Finds a bone by name.
		This does a string comparison for every bone.<br>
		Returns a {{#crossLinkModule "sp.spine"}}sp.spine{{/crossLinkModule}}.Bone object.
		!#zh
		通过名称查找 bone。
		这里对每个 bone 的名称进行了对比。<br>
		返回一个 {{#crossLinkModule "sp.spine"}}sp.spine{{/crossLinkModule}}.Bone 对象。 
		*/
		findBone(boneName : string) : sp.spine.Bone;		
		/** !#en
		Finds a slot by name. This does a string comparison for every slot.<br>
		Returns a {{#crossLinkModule "sp.spine"}}sp.spine{{/crossLinkModule}}.Slot object.
		!#zh
		通过名称查找 slot。这里对每个 slot 的名称进行了比较。<br>
		返回一个 {{#crossLinkModule "sp.spine"}}sp.spine{{/crossLinkModule}}.Slot 对象。 
		*/
		findSlot(slotName : string) : sp.spine.Slot;		
		/** !#en
		Finds a skin by name and makes it the active skin.
		This does a string comparison for every skin.<br>
		Note that setting the skin does not change which attachments are visible.<br>
		Returns a {{#crossLinkModule "sp.spine"}}sp.spine{{/crossLinkModule}}.Skin object.
		!#zh
		按名称查找皮肤，激活该皮肤。这里对每个皮肤的名称进行了比较。<br>
		注意：设置皮肤不会改变 attachment 的可见性。<br>
		返回一个 {{#crossLinkModule "sp.spine"}}sp.spine{{/crossLinkModule}}.Skin 对象。 
		*/
		setSkin(skinName : string) : sp.spine.Skin;		
		/** !#en
		Returns the attachment for the slot and attachment name.
		The skeleton looks first in its skin, then in the skeleton data’s default skin.<br>
		Returns a {{#crossLinkModule "sp.spine"}}sp.spine{{/crossLinkModule}}.Attachment object.
		!#zh
		通过 slot 和 attachment 的名称获取 attachment。Skeleton 优先查找它的皮肤，然后才是 Skeleton Data 中默认的皮肤。<br>
		返回一个 {{#crossLinkModule "sp.spine"}}sp.spine{{/crossLinkModule}}.Attachment 对象。 
		*/
		getAttachment(slotName : string, attachmentName : string) : sp.spine.Attachment;		
		/** !#en
		Sets the attachment for the slot and attachment name.
		The skeleton looks first in its skin, then in the skeleton data’s default skin.
		!#zh
		通过 slot 和 attachment 的名字来设置 attachment。
		Skeleton 优先查找它的皮肤，然后才是 Skeleton Data 中默认的皮肤。 
		*/
		setAttachment(slotName : string, attachmentName : string) : void;		
		/** !#en Sets skeleton data to sp.Skeleton.
		!#zh 设置 Skeleton 中的 Skeleton Data。 
		*/
		setSkeletonData(skeletonData : sp.spine.SkeletonData, ownsSkeletonData : sp.spine.SkeletonData) : void;		
		/** !#en Sets animation state data.<br>
		The parameter type is {{#crossLinkModule "sp.spine"}}sp.spine{{/crossLinkModule}}.AnimationStateData.
		!#zh 设置动画状态数据。<br>
		参数是 {{#crossLinkModule "sp.spine"}}sp.spine{{/crossLinkModule}}.AnimationStateData。 
		*/
		setAnimationStateData(stateData : sp.spine.AnimationStateData) : void;		
		/** !#en
		Mix applies all keyframe values,
		interpolated for the specified time and mixed with the current values.
		!#zh 为所有关键帧设定混合及混合时间（从当前值开始差值）。 
		*/
		setMix(fromAnimation : string, toAnimation : string, duration : number) : void;		
		/** !#en Sets event listener.
		!#zh 设置动画事件监听器。 
		*/
		setAnimationListener(target : any, callback : Function) : void;		
		/** !#en Set the current animation. Any queued animations are cleared.<br>
		Returns a {{#crossLinkModule "sp.spine"}}sp.spine{{/crossLinkModule}}.TrackEntry object.
		!#zh 设置当前动画。队列中的任何的动画将被清除。<br>
		返回一个 {{#crossLinkModule "sp.spine"}}sp.spine{{/crossLinkModule}}.TrackEntry 对象。 
		*/
		setAnimation(trackIndex : number, name : string, loop : boolean) : sp.spine.TrackEntry;		
		/** !#en Adds an animation to be played delay seconds after the current or last queued animation.<br>
		Returns a {{#crossLinkModule "sp.spine"}}sp.spine{{/crossLinkModule}}.TrackEntry object.
		!#zh 添加一个动画到动画队列尾部，还可以延迟指定的秒数。<br>
		返回一个 {{#crossLinkModule "sp.spine"}}sp.spine{{/crossLinkModule}}.TrackEntry 对象。 
		*/
		addAnimation(trackIndex : number, name : string, loop : boolean, delay? : number) : sp.spine.TrackEntry;		
		/** !#en Find animation with specified name.
		!#zh 查找指定名称的动画 
		*/
		findAnimation(name : string) : sp.spine.Animation;		
		/** !#en Returns track entry by trackIndex.<br>
		Returns a {{#crossLinkModule "sp.spine"}}sp.spine{{/crossLinkModule}}.TrackEntry object.
		!#zh 通过 track 索引获取 TrackEntry。<br>
		返回一个 {{#crossLinkModule "sp.spine"}}sp.spine{{/crossLinkModule}}.TrackEntry 对象。 
		*/
		getCurrent(trackIndex : void) : sp.spine.TrackEntry;		
		/** !#en Clears all tracks of animation state.
		!#zh 清除所有 track 的动画状态。 
		*/
		clearTracks() : void;		
		/** !#en Clears track of animation state by trackIndex.
		!#zh 清除出指定 track 的动画状态。 
		*/
		clearTrack(trackIndex : number) : void;		
		/** !#en Set the start event listener.
		!#zh 用来设置开始播放动画的事件监听。 
		*/
		setStartListener(listener : Function) : void;		
		/** !#en Set the interrupt event listener.
		!#zh 用来设置动画被打断的事件监听。 
		*/
		setInterruptListener(listener : Function) : void;		
		/** !#en Set the end event listener.
		!#zh 用来设置动画播放完后的事件监听。 
		*/
		setEndListener(listener : Function) : void;		
		/** !#en Set the dispose event listener.
		!#zh 用来设置动画将被销毁的事件监听。 
		*/
		setDisposeListener(listener : Function) : void;		
		/** !#en Set the complete event listener.
		!#zh 用来设置动画播放一次循环结束后的事件监听。 
		*/
		setCompleteListener(listener : Function) : void;		
		/** !#en Set the animation event listener.
		!#zh 用来设置动画播放过程中帧事件的监听。 
		*/
		setEventListener(listener : Function) : void;		
		/** !#en Set the start event listener for specified TrackEntry (only supported on Web).
		!#zh 用来为指定的 TrackEntry 设置动画开始播放的事件监听。（只支持 Web 平台） 
		*/
		setTrackStartListener(entry : sp.spine.TrackEntry, listener : Function) : void;		
		/** !#en Set the interrupt event listener for specified TrackEntry (only supported on Web).
		!#zh 用来为指定的 TrackEntry 设置动画被打断的事件监听。（只支持 Web 平台） 
		*/
		setTrackInterruptListener(entry : sp.spine.TrackEntry, listener : Function) : void;		
		/** !#en Set the end event listener for specified TrackEntry (only supported on Web).
		!#zh 用来为指定的 TrackEntry 设置动画播放结束的事件监听。（只支持 Web 平台） 
		*/
		setTrackEndListener(entry : sp.spine.TrackEntry, listener : Function) : void;		
		/** !#en Set the dispose event listener for specified TrackEntry (only supported on Web).
		!#zh 用来为指定的 TrackEntry 设置动画即将被销毁的事件监听。（只支持 Web 平台） 
		*/
		setTrackDisposeListener(entry : sp.spine.TrackEntry, listener : Function) : void;		
		/** !#en Set the complete event listener for specified TrackEntry (only supported on Web).
		!#zh 用来为指定的 TrackEntry 设置动画一次循环播放结束的事件监听。（只支持 Web 平台） 
		*/
		setTrackCompleteListener(entry : sp.spine.TrackEntry, listener : Function) : void;		
		/** !#en Set the event listener for specified TrackEntry (only supported on Web).
		!#zh 用来为指定的 TrackEntry 设置动画帧事件的监听。（只支持 Web 平台） 
		*/
		setTrackEventListener(entry : sp.spine.TrackEntry, listener : Function) : void;	
	}		
		/** !#en The skeleton data of spine.
		!#zh Spine 的 骨骼数据。 */
		export class SkeletonData extends Asset {		
		/** !#en See http://en.esotericsoftware.com/spine-json-format
		!#zh 可查看 Spine 官方文档 http://zh.esotericsoftware.com/spine-json-format */
		skeletonJson : any;		
		atlasText : string;		
		textures : Texture2D;		
		/** !#en
		A scale can be specified on the JSON or binary loader which will scale the bone positions,
		image sizes, and animation translations.
		This can be useful when using different sized images than were used when designing the skeleton
		in Spine. For example, if using images that are half the size than were used in Spine,
		a scale of 0.5 can be used. This is commonly used for games that can run with either low or high
		resolution texture atlases.
		see http://en.esotericsoftware.com/spine-using-runtimes#Scaling
		!#zh 可查看 Spine 官方文档： http://zh.esotericsoftware.com/spine-using-runtimes#Scaling */
		scale : number;		
		/** !#en Get the included SkeletonData used in spine runtime.<br>
		Returns a {{#crossLinkModule "sp.spine"}}sp.spine{{/crossLinkModule}}.SkeletonData object.
		!#zh 获取 Spine Runtime 使用的 SkeletonData。<br>
		返回一个 {{#crossLinkModule "sp.spine"}}sp.spine{{/crossLinkModule}}.SkeletonData 对象。 
		*/
		getRuntimeData(quiet? : boolean) : sp.spine.SkeletonData;	
	}	
	/** !#en The event type of spine skeleton animation.
	!#zh 骨骼动画事件类型。 */
	export enum AnimationEventType {		
		START = 0,
		END = 0,
		COMPLETE = 0,
		EVENT = 0,	
	}
}
/** !#en
`sp.spine` is the namespace for official Spine Runtime, which officially implemented and maintained by Spine.<br>
Please refer to the official documentation for its detailed usage: [http://en.esotericsoftware.com/spine-using-runtimes](http://en.esotericsoftware.com/spine-using-runtimes)
!#zh
sp.spine 模块是 Spine 官方运行库的 API 入口，由 Spine 官方统一实现和维护，具体用法请参考：[http://zh.esotericsoftware.com/spine-using-runtimes](http://zh.esotericsoftware.com/spine-using-runtimes) */
declare module sp.spine {
}
/** !#en
The global main namespace of DragonBones, all classes, functions,
properties and constants of DragonBones are defined in this namespace
!#zh
DragonBones 的全局的命名空间，
与 DragonBones 相关的所有的类，函数，属性，常量都在这个命名空间中定义。 */
declare module dragonBones {		
		/** !#en
		The Armature Display of DragonBones <br/>
		<br/>
		(Armature Display has a reference to a DragonBonesAsset and stores the state for ArmatureDisplay instance,
		which consists of the current pose's bone SRT, slot colors, and which slot attachments are visible. <br/>
		Multiple Armature Display can use the same DragonBonesAsset which includes all animations, skins, and attachments.) <br/>
		!#zh
		DragonBones 骨骼动画 <br/>
		<br/>
		(Armature Display 具有对骨骼数据的引用并且存储了骨骼实例的状态，
		它由当前的骨骼动作，slot 颜色，和可见的 slot attachments 组成。<br/>
		多个 Armature Display 可以使用相同的骨骼数据，其中包括所有的动画，皮肤和 attachments。)<br/> */
		export class ArmatureDisplay extends _RendererUnderSG {		
		/** !#en
		The DragonBones data contains the armatures information (bind pose bones, slots, draw order,
		attachments, skins, etc) and animations but does not hold any state.<br/>
		Multiple ArmatureDisplay can share the same DragonBones data.
		!#zh
		骨骼数据包含了骨骼信息（绑定骨骼动作，slots，渲染顺序，
		attachments，皮肤等等）和动画但不持有任何状态。<br/>
		多个 ArmatureDisplay 可以共用相同的骨骼数据。 */
		dragonAsset : DragonBonesAsset;		
		/** !#en
		The atlas asset for the DragonBones.
		!#zh
		骨骼数据所需的 Atlas Texture 数据。 */
		dragonAtlasAsset : DragonBonesAtlasAsset;		
		/** !#en The name of current armature.
		!#zh 当前的 Armature 名称。 */
		armatureName : string;		
		/** !#en The name of current playing animation.
		!#zh 当前播放的动画名称。 */
		animationName : string;		
		_defaultArmatureIndex : number;		
		/** !#en The time scale of this armature.
		!#zh 当前骨骼中所有动画的时间缩放率。 */
		timeScale : number;		
		/** !#en The play times of the default animation.
		     -1 means using the value of config file;
		     0 means repeat for ever
		     >0 means repeat times
		!#zh 播放默认动画的循环次数
		     -1 表示使用配置文件中的默认值;
		     0 表示无限循环
		     >0 表示循环次数 */
		playTimes : number;		
		/** !#en Indicates whether open debug bones.
		!#zh 是否显示 bone 的 debug 信息。 */
		debugBones : boolean;		
		/** !#en
		Play the specified animation.
		Parameter animName specify the animation name.
		Parameter playTimes specify the repeat times of the animation.
		-1 means use the value of the config file.
		0 means play the animation for ever.
		>0 means repeat times.
		!#zh
		播放指定的动画.
		animName 指定播放动画的名称。
		playTimes 指定播放动画的次数。
		-1 为使用配置文件中的次数。
		0 为无限循环播放。
		>0 为动画的重复次数。 
		*/
		playAnimation(animName : string, playTimes : number) : dragonBones.AnimationState;		
		/** !#en
		Get the all armature names in the DragonBones Data.
		!#zh
		获取 DragonBones 数据中所有的 armature 名称 
		*/
		getArmatureNames() : any[];		
		/** !#en
		Get the all animation names of specified armature.
		!#zh
		获取指定的 armature 的所有动画名称。 
		*/
		getAnimationNames(armatureName : string) : any[];		
		/** !#en
		Add event listener for the DragonBones Event.
		!#zh
		添加 DragonBones 事件监听器。 
		*/
		addEventListener(eventType : dragonBones.EventObject, listener : Function, target : any) : void;		
		/** !#en
		Remove the event listener for the DragonBones Event.
		!#zh
		移除 DragonBones 事件监听器。 
		*/
		removeEventListener(eventType : dragonBones.EventObject, listener : Function, target : any) : void;		
		/** !#en
		Build the armature for specified name.
		!#zh
		构建指定名称的 armature 对象 
		*/
		buildArmature(armatureName : string) : dragonBones.Armature;		
		/** !#en
		Get the current armature object of the ArmatureDisplay.
		!#zh
		获取 ArmatureDisplay 当前使用的 Armature 对象 
		*/
		armature() : any;	
	}		
		/** !#en The skeleton data of dragonBones.
		!#zh dragonBones 的 骨骼数据。 */
		export class DragonBonesAsset extends Asset {		
		/** !#en See http://developer.egret.com/cn/github/egret-docs/DB/dbLibs/dataFormat/index.html
		!#zh 可查看 DragonBones 官方文档 http://developer.egret.com/cn/github/egret-docs/DB/dbLibs/dataFormat/index.html */
		dragonBonesJson : string;	
	}		
		/** !#en The skeleton atlas data of dragonBones.
		!#zh dragonBones 的骨骼纹理数据。 */
		export class DragonBonesAtlasAsset extends Asset {		
		atlasJson : string;		
		texture : Texture2D;	
	}
}
/** This module provides some JavaScript utilities.
All members can be accessed with cc.js */
declare module js {	
	/** Check the obj whether is number or not
	If a number is created by using 'new Number(10086)', the typeof it will be "object"...
	Then you can use this function if you care about this case. 
	*/
	export function isNumber(obj : any) : boolean;	
	/** Check the obj whether is string or not.
	If a string is created by using 'new String("blabla")', the typeof it will be "object"...
	Then you can use this function if you care about this case. 
	*/
	export function isString(obj : any) : boolean;	
	/** This method is deprecated, use cc.js.mixin please.<br>
	Copy all properties not defined in obj from arguments[1...n]
	@param obj object to extend its properties
	@param sourceObj source object to copy properties from 
	*/
	export function addon(obj : any, sourceObj : any) : any;	
	/** copy all properties from arguments[1...n] to obj 
	*/
	export function mixin(obj : any, sourceObj : any) : any;	
	/** Derive the class from the supplied base class.
	Both classes are just native javascript constructors, not created by cc.Class, so
	usually you will want to inherit using {{#crossLink "cc/Class:method"}}cc.Class {{/crossLink}} instead.
	@param base the baseclass to inherit 
	*/
	export function extend(cls : Function, base : Function) : Function;	
	/** Removes all enumerable properties from object 
	*/
	export function clear(obj : any) : void;	
	/** Get property descriptor in object and all its ancestors 
	*/
	export function getPropertyDescriptor(obj : any, name : string) : any;	
	/** Get class name of the object, if object is just a {} (and which class named 'Object'), it will return null.
	(modified from <a href="http://stackoverflow.com/questions/1249531/how-to-get-a-javascript-objects-class">the code from this stackoverflow post</a>)
	@param obj instance or constructor 
	*/
	export function getClassName(obj : any|Function) : string;	
	/** Register the class by specified name manually 
	*/
	export function setClassName(className : string, constructor : Function) : void;	
	/** Unregister a class from fireball.
	
	If you dont need a registered class anymore, you should unregister the class so that Fireball will not keep its reference anymore.
	Please note that its still your responsibility to free other references to the class.
	@param constructor the class you will want to unregister, any number of classes can be added 
	*/
	export function unregisterClass(constructor : Function) : void;	
	/** Get the registered class by name 
	*/
	export function getClassByName(classname : string) : Function;	
	/** Define get set accessor, just help to call Object.defineProperty(...) 
	*/
	export function getset(obj : any, prop : string, getter : Function, setter : Function, enumerable? : boolean) : void;	
	/** Define get accessor, just help to call Object.defineProperty(...) 
	*/
	export function get(obj : any, prop : string, getter : Function, enumerable? : boolean) : void;	
	/** Define set accessor, just help to call Object.defineProperty(...) 
	*/
	export function set(obj : any, prop : string, setter : Function, enumerable? : boolean) : void;	
	/** Defines a polyfill field for obsoleted codes.
	@param obj YourObject or YourClass.prototype
	@param obsoleted "OldParam" or "YourClass.OldParam"
	@param newPropName "NewParam" 
	*/
	export function obsolete(obj : any, obsoleted : string, newPropName : string, writable? : boolean) : void;	
	/** Defines all polyfill fields for obsoleted codes corresponding to the enumerable properties of props.
	@param obj YourObject or YourClass.prototype
	@param objName "YourObject" or "YourClass" 
	*/
	export function obsoletes(obj : any, objName : any, props : any, writable? : boolean) : void;	
	/** A string tool to construct a string with format string.
	for example:
	     cc.js.formatStr("a: %s, b: %s", a, b);
	     cc.js.formatStr(a, b, c); 
	*/
	export function formatStr() : string;		
		/** undefined */
		export class array {		
		/** Removes the array item at the specified index. 
		*/
		removeAt(array : any[], index : number) : void;		
		/** Removes the array item at the specified index.
		It's faster but the order of the array will be changed. 
		*/
		fastRemoveAt(array : any[], index : number) : void;		
		/** Removes the first occurrence of a specific object from the array. 
		*/
		remove(array : any[], value : any) : boolean;		
		/** Removes the first occurrence of a specific object from the array.
		It's faster but the order of the array will be changed. 
		*/
		fastRemove(array : any[], value : number) : void;		
		/** Verify array's Type 
		*/
		verifyType(array : any[], type : Function) : boolean;		
		/** Removes from array all values in minusArr. For each Value in minusArr, the first matching instance in array will be removed.
		@param array Source Array
		@param minusArr minus Array 
		*/
		removeArray(array : any[], minusArr : any[]) : void;		
		/** Inserts some objects at index 
		*/
		appendObjectsAt(array : any[], addObjs : any[], index : number) : any[];		
		/** Exact same function as Array.prototype.indexOf.
		HACK: ugliy hack for Baidu mobile browser compatibility,
		stupid Baidu guys modify Array.prototype.indexOf for all pages loaded,
		their version changes strict comparison to non-strict comparison,
		it also ignores the second parameter of the original API,
		and this will cause event handler enter infinite loop.
		Baidu developers, if you ever see this documentation,
		here is the standard: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/indexOf
		Seriously !
		@param searchElement Element to locate in the array.
		@param fromIndex The index to start the search at 
		*/
		indexOf(searchElement : any, fromIndex? : number) : number;		
		/** Determines whether the array contains a specific value. 
		*/
		contains(array : any[], value : any) : boolean;		
		/** Copy an array's item to a new array (its performance is better than Array.slice) 
		*/
		copy(array : any[]) : any[];	
	}
}