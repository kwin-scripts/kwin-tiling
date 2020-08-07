/********************************************************************
 KWin - the KDE window manager
 This file is part of the KDE project.

Copyright (C) 2013-2014 Fabian Homborg <FHomborg@gmail.com>

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*********************************************************************/

var util = {};
util.copyRect = function(rect) {
    return Qt.rect(Math.floor(rect.x),
                       Math.floor(rect.y),
                       Math.floor(rect.width),
                       Math.floor(rect.height));
};

// Sets rect1 to rect2 by value
util.setRect = function(rect1,rect2) {
    rect1.x = Math.floor(rect2.x);
    rect1.y = Math.floor(rect2.y);
    rect1.width = Math.floor(rect2.width);
    rect1.height = Math.floor(rect2.height);
};

// Returns true if rects are equal, false if not
util.compareRect = function(rect1,rect2) {
    if (rect1 == null || rect2 == null) {
        return rect1 == rect2;
    }
    return rect1.x == rect2.x &&
        rect1.y == rect2.y    &&
        rect1.width == rect2.width &&
        rect1.height == rect2.height;
};

util.intersectRect = function(rect1, rect2) {
    if (rect1.x + rect1.width  < rect2.x ||
        rect2.x + rect2.width  < rect1.x ||
        rect1.y + rect1.height < rect2.y ||
        rect2.y + rect2.height < rect1.y) {
        return null; // No intersection
    }
    var newRect = Qt.rect(0,0,0,0);
    newRect.x = Math.max(rect1.x, rect2.x);
    newRect.y = Math.max(rect1.y, rect2.y);
    newRect.width = (Math.min(rect1.x + rect1.width, rect2.x + rect2.width) - newRect.x);
    newRect.height = (Math.min(rect1.y + rect1.height, rect2.y + rect2.height) - newRect.y);
    return newRect;
};

util.expandRect = function(rect1, rect2) {
    var newRect = Qt.rect(0,0,0,0);
    newRect.x = Math.min(rect1.x, rect2.x);
    newRect.y = Math.min(rect1.y, rect2.y);
    newRect.width = (Math.max(rect1.x + rect1.width, rect2.x + rect2.width) - newRect.x);
    newRect.height = (Math.max(rect1.y + rect1.height, rect2.y + rect2.height) - newRect.y);
    return newRect;
};

util.setX = function(geom, value) {
    geom.width = (geom.width + geom.x) - value;
    geom.x = value;
};
util.getX = function(geom) {
    return geom.x;
};
util.setY = function(geom, value) {
    geom.height = (geom.height + geom.y) - value;
    geom.y = value;
};
util.getY = function(geom) {
    return geom.y;
};
util.setR = function(geom, value) {
    geom.width = value - geom.x;
};
// Return right edge
util.getR = function(geom) {
    return (geom.x + geom.width);
};
util.setB = function(geom, value) {
    geom.height = value - geom.y;
};
// Return bottom edge
util.getB = function(geom) {
    return (geom.y + geom.height);
};

util.rectToMatrix = function(rect) {
    return [[rect.x, rect.y],[rect.x + rect.width, rect.y + rect.height]];
};

util.matrixToRect = function(m) {
    var newRect = Qt.rect(m[0][0], m[0][1], 0, 0);
    newRect.width = m[1][0] - newRect.x;
    newRect.height = m[1][1] - newRect.y;
    // normalize
    if (newRect.width < 0) {
        newRect.x += newRect.width;
        newRect.width *= -1;
    }
    if (newRect.height < 0) {
        newRect.y += newRect.height;
        newRect.height *= -1;
    }
    return newRect;
};

util.multiplyRectMatrices = function(m1, m2) {
    var res = new Array();
    for (var i = 0; i < 2; i++) {
        res[i] = new Array();
        for (var j = 0; j < 2; j++) {
            var val = 0;
            for (var k = 0; k < 2; k++) {
                val += m1[i][k] * m2[k][j];
            }
            res[i][j] = val;
        }
    }
    return res;
};

/**
 * Utility function which returns the area on the selected screen/desktop which
 * is filled by the layout for that screen.
 *
 * @param desktop Desktop for which the area shall be returned.
 * @param screen Screen for which the area shall be returned.
 * @return Rectangle which contains the area which shall be used by layouts.
 */
util.getTilingArea = function(screen, desktop) {
    var cA = workspace.clientArea(KWin.PlacementArea, screen, desktop);
    return util.copyRect(cA);
};

util.rectToString = function(rect) {
    return "x" + rect.x + "y" + rect.y + "w" + rect.width + "h" + rect.height;
    if (rect == null) {
        return "null";
    }
}

util.printRect = function(rect) {
    print(util.rectToString(rect));
}

util.printTile = function(tile) {
    print("Tile ", tile.tileIndex, " on desktop ", tile.desktop,
          " screen ", tile.screen, " rect ", util.rectToString(tile.rectangle),
          " client ", tile.clients[0].resourceClass.toString());
}

util.clientToString = function(c) {
    var outp = c.tiling_tileIndex + " " + c.resourceClass.toString() + '- "' + c.caption + '" ' + util.rectToString(c.geometry);
    return outp;
};

util.printClient = function(client) {
    print(util.clientToString(client));
}

util.assertRectInScreen = function(rect, screenRectangle) {
    util.assertTrue(rect.x >= screenRectangle.x &&
                    rect.y >= screenRectangle.y &&
                    util.getR(rect) <= util.getR(screenRectangle) &&
                    util.getB(rect) <= util.getB(screenRectangle), "Rectangle not in screen");
};

/**
 * workspace.clientArea leaves holes for panels.
 * Also there could be gaps between screens.
 * Therefore I do a search for the screen with minimal distance in given direction.
 */
util.nextScreenInDirection = function(curScreen, desktop, direction) {
    var curScreenRect = workspace.clientArea(KWin.ScreenArea, curScreen, desktop);
    var targetScreen = null;

    // Limit jump distance
    switch (direction) {
        case Direction.Left:
        case Direction.Right:
            var minDist = curScreenRect.width / 2;
            break;
        case Direction.Up:
        case Direction.Down:
            var minDist = curScreenRect.height / 2;
            break;
        default:
            print("Wrong direction in util.nextScreenInDirection");
            return;
    }

    // assumes a fully horizontal or vertical screen setup
    for (var i=0; i<workspace.numScreens; i++) {
        var screenRect = workspace.clientArea(KWin.ScreenArea, i, desktop);

        switch (direction) {
            case Direction.Left:
                var dist = Math.abs(curScreenRect.x - util.getR(screenRect));
                break;
            case Direction.Right:
                var dist = Math.abs(util.getR(curScreenRect) - screenRect.x);
                break;
            case Direction.Up:
                var dist = Math.abs(curScreenRect.y - util.getB(screenRect));
                break;
            case Direction.Down:
                var dist = Math.abs(util.getB(curScreenRect) - screenRect.y);
                break;
        }

        if (dist < minDist) {
            targetScreen = i;
            minDist = dist;
        }
    }

    return targetScreen;
};

util.middlex = function(rect) {
    return rect.x + (rect.width / 2);
};

util.middley = function(rect) {
    return rect.y + (rect.height / 2);
};

util.assertTrue = function(condition, message) {
    if (condition != true) {
        print(message);
    }
};

/**
 * Array.from() polyfill from https://vanillajstoolkit.com/polyfills/arrayfrom/
 * Licensed under the MIT License (https://vanillajstoolkit.com/mit)
 */
// From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from
// Production steps of ECMA-262, Edition 6, 22.1.2.1
if (!Array.from) {
	Array.from = (function () {
		var toStr = Object.prototype.toString;
		var isCallable = function (fn) {
			return typeof fn === 'function' || toStr.call(fn) === '[object Function]';
		};
		var toInteger = function (value) {
			var number = Number(value);
			if (isNaN(number)) { return 0; }
			if (number === 0 || !isFinite(number)) { return number; }
			return (number > 0 ? 1 : -1) * Math.floor(Math.abs(number));
		};
		var maxSafeInteger = Math.pow(2, 53) - 1;
		var toLength = function (value) {
			var len = toInteger(value);
			return Math.min(Math.max(len, 0), maxSafeInteger);
		};

		// The length property of the from method is 1.
		return function from(arrayLike/*, mapFn, thisArg */) {
			// 1. Let C be the this value.
			var C = this;

			// 2. Let items be ToObject(arrayLike).
			var items = Object(arrayLike);

			// 3. ReturnIfAbrupt(items).
			if (arrayLike == null) {
				throw new TypeError('Array.from requires an array-like object - not null or undefined');
			}

			// 4. If mapfn is undefined, then let mapping be false.
			var mapFn = arguments.length > 1 ? arguments[1] : void undefined;
			var T;
			if (typeof mapFn !== 'undefined') {
				// 5. else
				// 5. a If IsCallable(mapfn) is false, throw a TypeError exception.
				if (!isCallable(mapFn)) {
					throw new TypeError('Array.from: when provided, the second argument must be a function');
				}

				// 5. b. If thisArg was supplied, let T be thisArg; else let T be undefined.
				if (arguments.length > 2) {
					T = arguments[2];
				}
			}

			// 10. Let lenValue be Get(items, "length").
			// 11. Let len be ToLength(lenValue).
			var len = toLength(items.length);

			// 13. If IsConstructor(C) is true, then
			// 13. a. Let A be the result of calling the [[Construct]] internal method
			// of C with an argument list containing the single item len.
			// 14. a. Else, Let A be ArrayCreate(len).
			var A = isCallable(C) ? Object(new C(len)) : new Array(len);

			// 16. Let k be 0.
			var k = 0;
			// 17. Repeat, while k < len… (also steps a - h)
			var kValue;
			while (k < len) {
				kValue = items[k];
				if (mapFn) {
					A[k] = typeof T === 'undefined' ? mapFn(kValue, k) : mapFn.call(T, kValue, k);
				} else {
					A[k] = kValue;
				}
				k += 1;
			}
			// 18. Let putStatus be Put(A, "length", len, true).
			A.length = len;
			// 20. Return A.
			return A;
		};
	}());
}
