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
exports.CurveRange = exports.CURVERANGE = void 0;
exports.CURVERANGE = {
    "__type__": "cc.CurveRange",
    "mode": 0,
    "constant": 0,
    "constantMin": 0,
    "constantMax": 0,
    "multiplier": 1,
};
class CurveRange {
    static create() {
        return JSON.parse(JSON.stringify(exports.CURVERANGE));
    }
    static migrate(json2D) {
        return __awaiter(this, void 0, void 0, function* () {
            const source = JSON.parse(JSON.stringify(exports.CURVERANGE));
            for (const key in json2D) {
                const value = json2D[key];
                if (value === undefined || value === null) {
                    continue;
                }
                source[key] = value;
            }
            return source;
        });
    }
    static apply(index, json2D, json3D) {
        return __awaiter(this, void 0, void 0, function* () {
            const source = yield CurveRange.migrate(json2D[index]);
            json3D.splice(index, 1, source);
            return source;
        });
    }
}
exports.CurveRange = CurveRange;
