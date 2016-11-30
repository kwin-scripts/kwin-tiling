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

util.printClient = function(client) {
    print("Client ", client.resourceClass.toString(), " on desktop ", client.desktop,
          " at ", util.rectToString(client.geometry), " on tile ", client.tiling_tileIndex);
}

util.assertRectInScreen = function(rect, screenRectangle) {
    util.assertTrue(rect.x >= screenRectangle.x &&
                    rect.y >= screenRectangle.y &&
                    util.getR(rect) <= util.getR(screenRectangle) &&
                    util.getB(rect) <= util.getB(screenRectangle), "Rectangle not in screen");
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
// readConfig moved to KWin.readConfig for KWin 5
if(KWin.readConfig == null) {
    print("Setting readConfig to KWin.readConfig");
    KWin.readConfig = readConfig;
} else {
    print("We're running under KWin 5");
}

// HACK: KWin 5.2 (at least) will sometimes give us client.desktop == workspace.desktops
// (i.e. a desktop number that is too large)
// when a client is on all desktops
util.getClientDesktop = function(client) {
    if (client.onAllDesktops == true) {
        return -1;
    }
    return client.desktop;
}
