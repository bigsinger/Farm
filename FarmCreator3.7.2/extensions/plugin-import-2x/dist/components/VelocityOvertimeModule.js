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
exports.VelocityOvertimeModule = exports.VELOCITYOVERTIMEMODULE = void 0;
exports.VELOCITYOVERTIMEMODULE = {
    "__type__": "cc.VelocityOvertimeModule",
    "_enable": false,
    "x": {
        "__id__": 1,
    },
    "y": {
        "__id__": 2,
    },
    "z": {
        "__id__": 3,
    },
    "speedModifier": {
        "__id__": 4,
    },
    "space": 1,
};
class VelocityOvertimeModule {
    static create() {
        return JSON.parse(JSON.stringify(exports.VELOCITYOVERTIMEMODULE));
    }
    static migrate(json2D) {
        return __awaiter(this, void 0, void 0, function* () {
            const source = JSON.parse(JSON.stringify(exports.VELOCITYOVERTIMEMODULE));
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
            const source = yield VelocityOvertimeModule.migrate(json2D[index]);
            json3D.splice(index, 1, source);
            return source;
        });
    }
}
exports.VelocityOvertimeModule = VelocityOvertimeModule;
