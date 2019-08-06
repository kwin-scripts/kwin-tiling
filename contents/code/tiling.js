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

/**
 * Class which implements tiling for a single screen.
 * @class
 */
function Tiling(layoutType, desktop, screen) {
    try {
        this.desktop = desktop;
        this.screen  = screen;
        this.screenRectangle = util.getTilingArea(this.screen, this.desktop);
        /**
         * Tiles which have been added to the layout
         */
        this.tiles = [];
        /**
         * Layout type which provided the current layout.
         */
        this.layoutType = layoutType;
        /**
         * Layout which specifies window sizes/positions.
         */
        this.layout = new layoutType(this.screenRectangle);
        /**
         * active: True if the layout is active (i.e. on the current desktop)
         * useractive: True if the layout is activated by the user
         *             False if the user deactivated it
         * useractive implies active
         */
        this.active = false;
        this.userActive = true;

        var gapSize = KWin.readConfig("gapSize", 0);  /* stick to old gaps config by default */
        this.windowsGapSizeHeight = KWin.readConfig("windowsGapSizeHeight", gapSize);
        this.windowsGapSizeWidth = KWin.readConfig("windowsGapSizeWidth", gapSize);
        this.screenGapSizeLeft = KWin.readConfig("screenGapSizeLeft", 0);
        this.screenGapSizeRight = KWin.readConfig("screenGapSizeRight", 0);
        this.screenGapSizeTop = KWin.readConfig("screenGapSizeTop", 0);
        this.screenGapSizeBottom = KWin.readConfig("screenGapSizeBottom", 0);
    } catch(err) {
        print(err, "in Tiling");
    }
};

Tiling.prototype.setLayoutType = function(layoutType) {
    try {
        var newLayout = new layoutType(this.layout.screenRectangle);
        for (var i = 0; i < this.layout.tiles.length; i++) {
            newLayout.addTile();
        }
        this.layout = newLayout;
        this.layoutType = layoutType;
        this._updateAllTiles();
    } catch(err) {
        print(err, "in Tiling.setLayoutType");
    }
};

Tiling.prototype.addTile = function(tile, previouslyFocusedClient, x, y) {
    try {
        // NOTE: Separate handling is necessary because the
        // semantics of passing an x,y value are different in I3Layout.
        if (this.layout.isI3Layout) {
            var finalX = x;
            var finalY = y;
            if (!x  || !y) {
                var focused = previouslyFocusedClient;
                if (focused && focused.geometry) {
                    print('Last focused client: ' + focused.caption);
                    finalX = focused.geometry.x + focused.geometry.width/2;
                    finalY = focused.geometry.y + focused.geometry.height/2;
                    print('Desktop: '+this.desktop +
                          ', Screen: '+this.screen +
                          ' FinalX: ' +finalX +
                          ", FinalY: "+finalY);
                }
            }
            this.layout.addTile(finalX,finalY);
            this.tiles.push(tile);
        }
        else {
            this.layout.addTile();
            // If a position was specified, we insert the tile at the specified position
            if (x != null && y != null) {
                var index = this._getTileIndex(x, y);
                if (index == -1) {
                    this.tiles.push(tile);
                } else {
                    this.tiles.splice(index, 0, tile);
                }
            } else {
                if (tile.tileIndex > -1 && tile.tileIndex <= this.tiles.length) {
                    this.tiles.splice(tile.tileIndex, 0, tile);
                } else {
                    this.tiles.push(tile);
                }
            }
        }
        for (var i = 0; i < this.tiles.length; i++) {
            this.tiles[i].tileIndex = i;
            this.tiles[i].syncCustomProperties();
        }
        this._updateAllTiles();
    } catch(err) {
        print(err, "in Tiling.addTile");
    }
};

Tiling.prototype.removeTile = function(tile) {
    try {
        var tileIndex = this.tiles.indexOf(tile);
        if (tileIndex > -1) {
            this.tiles.splice(tileIndex, 1);
            this.layout.removeTile(tileIndex);
            // Correct tileIndex
            for (var i = 0; i < this.tiles.length; i++) {
                this.tiles[i].tileIndex = i;
                this.tiles[i].syncCustomProperties();
            }
            // TODO: Unregister tile callbacks
            this._updateAllTiles();
        } else {
            print("removeTile: No such tile ", tile._currentDesktop,
                  tile._currentScreen, tile.clients[0].resourceClass.toString());
            print(this.desktop, this.screen);
        }
    } catch(err) {
        print(err, "in Tiling.removeTile");
    }
};

Tiling.prototype.swapTiles = function(tile1, tile2) {
    try {
        // Cut down on updates by not doing them if tile1 is hovering over itself
        if (tile1 != tile2) {
            var index1 = this.tiles.indexOf(tile1);
            var index2 = this.tiles.indexOf(tile2);
            this.tiles[index1] = tile2;
            this.tiles[index2] = tile1;
            this.tiles[index1].tileIndex = index1;
            this.tiles[index2].tileIndex = index2;
            this.tiles[index1].syncCustomProperties();
            this.tiles[index2].syncCustomProperties();
            this._updateAllTiles();
            // This will only be called if tile1 just stopped moving
        } else if (tile1._moving == false) {
            this._updateAllTiles();
        }
    } catch(err) {
        print(err, "in Tiling.swapTiles");
    }
};

Tiling.prototype.activate = function() {
    if (this.userActive == true) {
        this.active = true;
        // Resize the tiles like specified by the layout
        this._updateAllTiles();
    }
};

Tiling.prototype.deactivate = function() {
    this.active = false;
    // Unset keepBelow so they handle like true floating clients.
    for (var i = 0; i < this.layout.tiles.length; i++) {
        this.tiles[i].setKeepBelow(false);
    }
};

Tiling.prototype.toggleActive = function() {
    if (this.active) {
        this.deactivate();
    } else {
        this.activate();
    }
};

Tiling.prototype.toggleUserActive = function() {
    if (this.userActive == true) {
        this.userActive = false;
        this.deactivate();
    } else {
        this.userActive = true;
        this.activate();
    }
};

/**
 * Resets tile sizes to their initial size (in case they were resized by the
 * user).
 */
Tiling.prototype.resetTileSizes = function() {
    this.layout.resetTileSizes();
    this._updateAllTiles();
};

Tiling.prototype.getTile = function(x, y) {
    try {
        var index = this._getTileIndex(x, y);
        if (index != -1) {
            return this.tiles[index];
        } else {
            return null;
        }
    } catch(err) {
        print(err, "in Tiling.getTile");
    }
};

Tiling.prototype._getTileIndex = function(x, y) {
    try {
        for (var i = 0; i < this.layout.tiles.length; i++) {
            var tile = this.layout.tiles[i];
            // Remove gaps
            // FIXME: Take screenGaps into account - not important for what we use this for
            // but this would break if we'd ask about x=screenRect.x or similar and sG is larger than wG
            var realrect = Qt.rect(tile.rectangle.x - this.windowsGapSizeWidth,
                                   tile.rectangle.y - this.windowsGapSizeHeight,
                                   tile.rectangle.width + this.windowsGapSizeHeight * 2,
                                   tile.rectangle.height + this.windowsGapSizeHeight * 2);
            realrect = util.intersectRect(this.screenRectangle, realrect);
            if (tile.rectangle.x <= x
                && tile.rectangle.y <= y
                && tile.rectangle.x + tile.rectangle.width > x
                && tile.rectangle.y + tile.rectangle.height > y) {
                return i;
            }
        }
        return -1;
    } catch(err) {
        print(err, "in Tiling._getTileIndex");
    }
};

Tiling.prototype.resizeTile = function(tile){
    try {
        if (tile != null) {
            var tileIndex = tile.tileIndex;
            var client = tile.clients[0];
            this.layout.resizeTile(tileIndex, client.geometry);
            this._updateAllTiles();
        }
    } catch(err) {
        print(err, "in Tiling.resizeTile");
    }
};

Tiling.prototype.resizeTileTo = function(tile,geometry) {
    try {
        if (tile != null && geometry != null) {
            var tileIndex = tile.tileIndex;
            var client = tile.clients[0];
            this.layout.resizeTile(tileIndex, geometry);
            this._updateAllTiles();
        }
    } catch(err) {
        print(err, "in Tiling.resizeTileTo");
    }
}

Tiling.prototype._updateAllTiles = function() {
    try {
        // Set the position/size of all tiles
        if (this.active == true && this.userActive == true) {
            this.resizeScreen();
            for (var i = 0; i < this.layout.tiles.length; i++) {
                var newRect = this.layout.tiles[i].rectangle;
                if (! newRect) {
                    return;
                }

                var geometry = util.intersectRect(newRect, this.screenRectangle);
                this.applyGaps(geometry);
                this.tiles[i].setGeometry(geometry);
            }
        }
    } catch(err) {
        print(err, "in Tiling._updateAllTiles");
    }
};

Tiling.prototype.resizeMaster = function(geometry) {
    try {
        if (this.layout.master > -1) {
            this.layout.resizeTile(this.layout.master, geometry);
            this._updateAllTiles();
        }
    } catch(err) {
        print(err, "in resizeMaster");
    }
};

Tiling.prototype.getMaster = function() {
    if (this.layout.master > -1) {
        return this.tiles[this.layout.master];
    } else {
        return null;
    }
};

Tiling.prototype.resizeScreen = function() {
    // FIXME: KWin bug: clientArea returns the _former_ area
    // See https://bugs.kde.org/show_bug.cgi?id=330099
    var rect = util.getTilingArea(this.screen, this.desktop);
    if (util.compareRect(rect,this.screenRectangle) == false) {
        this.layout.screenRectangle.x = this.screenRectangle.x;
        this.layout.screenRectangle.y = this.screenRectangle.y;
        this.layout.screenRectangle.width = this.screenRectangle.width;
        this.layout.screenRectangle.height = this.screenRectangle.height;
        this.layout.setLayoutArea(rect);
        this.screenRectangle = rect;
    }
};

Tiling.prototype.tile = function() {
    var self = this;
    this.tiles.forEach(function(tile) {
        var geom = util.copyRect(tile.rectangle);
        self.applyGaps(geom);
        tile.setGeometry(geom);
    });
};

Tiling.prototype.increaseMaster = function() {
    if (this.layout.increaseMaster != null) {
        this.layout.increaseMaster();
        this._updateAllTiles();
    }
};

Tiling.prototype.decrementMaster = function() {
    if (this.layout.decrementMaster != null) {
        this.layout.decrementMaster();
        this._updateAllTiles();
    }
};

/*
 * Apply gaps to a rectangle, in-place
*/
Tiling.prototype.applyGaps = function(rect) {
    if (KWin.readConfig("fullscreenGaps", false) == false && util.compareRect(rect, this.screenRectangle) == true) return;
    if (rect.x + rect.width == this.screenRectangle.x + this.screenRectangle.width) {
        rect.width -= this.screenGapSizeRight;
    } else {
        rect.width -= this.windowsGapSizeWidth;
    }
    if (rect.x == this.screenRectangle.x) {
        rect.x += this.screenGapSizeLeft;
        rect.width -= this.screenGapSizeLeft;
    } else {
        rect.x += this.windowsGapSizeWidth;
        rect.width -= this.windowsGapSizeWidth;
    }
    if (rect.y + rect.height == this.screenRectangle.y + this.screenRectangle.height) {
        rect.height -= this.screenGapSizeBottom;
    } else {
        rect.height -= this.windowsGapSizeHeight;
    }
    if (rect.y == this.screenRectangle.y) {
        rect.y += this.screenGapSizeTop;
        rect.height -= this.screenGapSizeTop;
    } else {
        rect.y += this.windowsGapSizeHeight;
        rect.height -= this.windowsGapSizeHeight;
    }
};
