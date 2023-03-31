'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhysicsMaterial = exports.PHYSICSMATERIAL = void 0;
exports.PHYSICSMATERIAL = {
    "__type__": "cc.PhysicsMaterial",
    "_name": "",
    "_objFlags": 0,
    "_native": "",
    "_friction": 0.5,
    "_rollingFriction": 0.1,
    "_spinningFriction": 0.1,
    "_restitution": 0.1,
};
class PhysicsMaterial {
    static create() {
        return JSON.parse(JSON.stringify(exports.PHYSICSMATERIAL));
    }
    static migrate(json2D) {
        return __awaiter(this, void 0, void 0, function* () {
            const source = JSON.parse(JSON.stringify(exports.PHYSICSMATERIAL));
            for (const key in json2D) {
                const value = json2D[key];
                if (key === '__type__' || value === undefined || value === null) {
                    continue;
                }
                source[key] = value;
            }
            return source;
        });
    }
    static apply(index, json2D, json3D) {
        return __awaiter(this, void 0, void 0, function* () {
            const source = yield PhysicsMaterial.migrate(json2D[index]);
            json3D.splice(index, 1, source);
            return source;
        });
    }
}
exports.PhysicsMaterial = PhysicsMaterial;
