/********************************************************************
 KWin - the KDE window manager
 This file is part of the KDE project.

Copyright (C) 2012 Mathias Gottschlag <mgottschlag@gmail.com>
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

Qt.include("util.js");
var Direction = {
    Up : 0,
    Down : 1,
    Left : 2,
    Right : 3
};

/**
 * Base class for all tiling layouts.
 * @class
 */
function Layout(screenRectangle) {
    this.construct(screenRectangle);
};

Layout.prototype.construct = function(screenRectangle) {
    try {
        /**
         * Screen area which is used by the layout.
         */
        this.screenRectangle = screenRectangle;
        /**
         * Geometry of the different tiles. This array stays empty in the case of
         * floating layouts.
         */
        this.tiles = [];
        // TODO
    } catch(err) {
        print(err, "in Layout");
    }
};
Layout.prototype.constructor = Layout;
Layout.prototype.name = "Wurst";

Layout.prototype.setLayoutArea = function(newArea) {
    try {
        var oldArea = this.screenRectangle;
        var xscale = newArea.width / oldArea.width;
        var yscale = newArea.height / oldArea.height;
        var xoffset = newArea.x - oldArea.x;
        var yoffset = newArea.y - oldArea.y;
        this.tiles.forEach(function(tile) {
            var lastrect = tile.rectangle;
            var newrect = Qt.rect(Math.floor((lastrect.x + xoffset) * xscale),
                                  Math.floor((lastrect.y + yoffset) * yscale),
                                  Math.floor(lastrect.width * xscale),
                                  Math.floor(lastrect.height * yscale));
            // Stay at the screenedges
            // It's better to have roundingerrors in the middle than at the edges
            // left screenedge, keep right windowedge (i.e. adjust width)
            if (lastrect.x == oldArea.x) {
                newrect.width = newrect.width + (newrect.x - newArea.x);
                newrect.x = newArea.x;
            }
            // Top screenedge, keep bottom windowedge (i.e. adjust height)
            if (lastrect.y == oldArea.y) {
                newrect.height = newrect.height + (newrect.y - newArea.y);
                newrect.y = newArea.y;
            }
            // Right screenedge, keep left windowedge (i.e. don't adjust x)
            if (lastrect.x + lastrect.width == oldArea.x + oldArea.width) {
                newrect.width = (newArea.width + newArea.x) - newrect.x;
            }
            // Bottom screenedge, keep top windowedge (i.e. don't adjust y)
            if (lastrect.y + lastrect.height == oldArea.y + oldArea.height) {
                newrect.height = (newArea.height + newArea.y) - newrect.y;
            }
            tile.rectangle = newrect;
        });
        this.screenRectangle = newArea;
    } catch(err) {
        print(err, "in Layout.setLayoutArea");
    }
};

Layout.prototype.resizeTile = function(tileIndex, rectangle) {
    try {
        // Sanitize
        if (tileIndex < 0 || tileIndex > (this.tiles.length - 1)) {
            print("Tileindex invalid", tileIndex, "/", this.tiles.length);
            return;
        }
        if (this.tiles.length == 1) {
            return;
        }
        if (this.tiles[tileIndex] == null) {
            print("No tile");
            return;
        }
        if (rectangle == null){
            print("No rect");
            return;
        }
        // Cut off parts outside of the screen
        var rect = util.intersectRect(rectangle, this.screenRectangle);
        if (rect == null) {
            print("Rectangle is off screen", util.rectToString(rectangle));
            return;
        }
        // TODO: Remove overlap
        this.doResize(tileIndex, rect, util.setX, util.getX, util.setR, util.getR);
        this.doResize(tileIndex, rect, util.setY, util.getY, util.setB, util.getB);
        this.doResize(tileIndex, rect, util.setR, util.getR, util.setX, util.getX);
        this.doResize(tileIndex, rect, util.setB, util.getB, util.setY, util.getY);
        this.tiles[tileIndex].rectangle = util.copyRect(rect);
    } catch(err) {
        print(err, "in Layout.resizeTile");
    }
};

/*
 * Resize all rectangles for one edge
 * Params:
 * set, get: a set/get function for one edge
 * setOther, getOther: a set/get function for the opposite edge
 */
Layout.prototype.doResize = function(tileIndex, rectangle, set, get, setOther, getOther) {
    var oldD = get(this.tiles[tileIndex].rectangle);
    var newD = get(rectangle);
    if (oldD == newD) {
        return;
    }
    // Disallow moving away from screenedges
    if (oldD == get(this.screenRectangle)) {
        set(rectangle, oldD);
        return;
    }
    // Disallow moving to screenedges
    // - otherwise we need to check when moving away if this is supposed to be there
    if (newD == get(this.screenRectangle)) {
        set(rectangle, oldD);
        return;
    }
    /*
     * A tile needs to be changed if it
     * a) Had the same value as the oldRect
     * b) Had the same other edge value as oldRect
     */
    for (var i = 0; i < this.tiles.length; i++) {
        if (i == tileIndex) {
            continue;
        }
        var dOther = getOther(this.tiles[i].rectangle);
        var d = get(this.tiles[i].rectangle);
        if (d == oldD) {
            set(this.tiles[i].rectangle, newD);
            continue;
        }
        if (dOther == oldD) {
            setOther(this.tiles[i].rectangle, newD);
            continue;
        }
    }
};

Layout.prototype.resetTileSizes = function() {
    try {
        // Simply erase all tiles and recreate them to recompute the initial sizes
        var tileCount = this.tiles.length;
        this.tiles.length = 0;
        for (var i = 0; i < tileCount; i++) {
            this.addTile();
        }
    } catch(err) {
        print(err, "in Layout.resetTileSizes");
    }
};

Layout.prototype._createTile = function(rect) {
    try {
        // Create a new tile and add it to the list
        var tile = {};
        tile.rectangle = rect;
        tile.index = this.tiles.length;
        this.tiles.push(tile);
    } catch(err) {
        print(err, "in Layout._createTile");
    }
};
