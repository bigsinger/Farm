#pragma once
#include <cocos/2d/CCNode.h>
#include <cocos/2d/CCSprite.h>
USING_NS_CC;


class Soil :public Node {
public:
	static Soil* create(Sprite* sprite, int id, int level);
	bool init(Sprite* sprite, int id, int level);
private:

	Sprite* m_pSprite;
	int m_id;

	// 土地等级
	int m_level = 1;

};

using SoilPtr = Soil * ;