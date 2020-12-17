/********************************************************************
 KWin - the KDE window manager
 This file is part of the KDE project.

 Copyright (C) 2013 Fabian Homborg <FHomborg@gmail.com>
 based on spirallayout.js by Matthias Gottschlag

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

Qt.include("layout.js");

/**
 * Class which arranges the windows in a grid for slaveTiles and a sideways stack for the masterTiles
 * The amount of masterTiles is changeable by shortcut and is 0 by default
 */
function GridLayout(screenRectangle) {
    print("Creating GridLayout");
    try {
        Layout.call(this, screenRectangle);
    } catch (err) {
        print(err, "in GridLayout");
    }
    this.masterAreaRatio = KWin.readConfig("gridLayoutMasterRatio", 50) / 100;
    this.masterCount = KWin.readConfig("gridLayoutMasterCount", 0);
    this.master = this.masterCount - 1;
    this.masterAreaWidth = 0;

    if(this.masterCount > 0)
    {
        this.masterAreaWidth = this.screenRectangle.width;
    }

    this.isGridLayout = true;
    this.spanRows = KWin.readConfig("gridLayoutRowSpan", false);
    this.spanCols = KWin.readConfig("gridLayoutColSpan", false);
}

GridLayout.prototype = new Layout();
GridLayout.prototype.constructor = GridLayout;

GridLayout.prototype.name = "Grid";
GridLayout.prototype.supportsRotation = true;
// // TODO: Add an image for the layout switcher
// GridLayout.image = null;

GridLayout.prototype.addTile = function () {
    try {
        this._applyGravity();
        if (this.tiles.length === 0) {
            // The first tile fills the whole screen
            var rect = util.copyRect(this.screenRectangle);
            util.assertRectInScreen(rect, this.screenRectangle);
            this._createTile(rect);
            if (this.masterCount > 0)
            {
                this.masterAreaWidth = this.screenRectangle.width;
                this.master = 0;
            }
            this._unapplyGravity();
            return;
        }
        var newRect = util.copyRect(this.screenRectangle);
        this._createTile(newRect);
        var tile = this.tiles.pop();

        if (this.tiles.length < this.masterCount) {
            // tile is another master
            this.masterAddTile(tile);
            this._unapplyGravity();
        } else if (this.tiles.length === this.masterCount) {
            // tile is first slave
            this.masterAreaWidth = this.screenRectangle.width * this.masterAreaRatio;
            this.adjustMastersWidth(this.masterAreaRatio,
                0,
                this.masterCount - 1, this.screenRectangle.x,
                this.screenRectangle.x + this.masterAreaWidth);
            tile.rectangle = Qt.rect(this.screenRectangle.x + this.masterAreaWidth,
                this.screenRectangle.y,
                this.screenRectangle.width - this.masterAreaWidth,
                this.screenRectangle.height);
            this.tiles.push(tile);
            this._unapplyGravity();
        } else if (this.tiles.length > this.masterCount) {
            // Tile is another slave
            this.slaveAddTile(tile);
            this._unapplyGravity();
        }
    } catch (err) {
        print(err, "in GridLayout.addTile");
        print(err.stack)
    }
};

// Save the first tile's width
GridLayout.prototype.resizeTile = function (tileIndex, rectangle) {
    Layout.prototype.resizeTile.call(this, tileIndex, rectangle);
    // Fixes bug where firstWidth will be set to the full screen when resizing with just masters
    if (this.tiles.length > this.masterCount) {
        this.masterAreaWidth = this.getMasterWidth();
    }
};

GridLayout.prototype.getMasterWidth = function () {
    var tile = this.tiles[Math.min(this.tiles.length, this.masterCount) - 1];
    if (tile != null) {
        var lastMaster = tile.rectangle;
        return lastMaster.x + lastMaster.width - this.screenRectangle.x;
    } else {
        // No masters exist
        return 0;
    }
};

GridLayout.prototype.removeTile = function (tileIndex) {
    try {
        // Remove the array entry
        if (tileIndex < 0 || tileIndex >= this.tiles.length) {
            print("Removing invalid tileindex" + tileindex);
            return;
        }
        this._applyGravity();

        // second last tile
        if (this.tiles.length === 2) {
            this.tiles.pop();
            this.tiles[0].rectangle = util.copyRect(this.screenRectangle);
            return;
        }
        // last tile
        if (this.tiles.length === 1) {
            this.tiles.splice(tileIndex, 1);
            if(this.masterCount > 0)
            {
                this.masterAreaWidth = 0;
                this.master = -1;
            }
            return;
        }
        //other cases
        if (this.tiles.length > 1) {
            // tile is master
            if (tileIndex < this.masterCount) {
                // there is exactly one slave
                if (this.tiles.length - this.masterCount === 1) {
                    this.slaveRemoveTile()
                    this.adjustMastersWidth(this.screenRectangle.width / this.masterAreaWidth,
                        0,
                        this.masterCount - 1, this.screenRectangle.x,
                        this.screenRectangle.x + this.screenRectangle.width);
                    this.masterAreaWidth = this.screenRectangle.width;
                }
                // there are no slaves
                else if (this.tiles.length - this.masterCount < 1) {
                    this.masterRemoveTile(tileIndex);
                }
                // there are more than one slave
                else if (this.tiles.length - this.masterCount > 1) {
                    this.slaveRemoveTile();
                }
            }
            // tile is slave
            else if (tileIndex >= this.masterCount) {
                // tile is only slave
                if (this.masterCount === this.tiles.length - 1) {
                    this.slaveRemoveTile();
                    this.adjustMastersWidth(this.screenRectangle.width / this.masterAreaWidth,
                        0,
                        this.masterCount - 1, this.screenRectangle.x,
                        this.screenRectangle.x + this.screenRectangle.width);
                    this.masterAreaWidth = this.screenRectangle.width;
                }
                // there is more than one slave
                else if (this.masterCount < this.tiles.length - 1) {
                    this.slaveRemoveTile();
                }
            }
        }
    } catch (e) {
        print(e, "in GridLayout.removeTile")
        print(e.stack)
    }
};

GridLayout.prototype.increaseMaster = function () {
    try {
        this._applyGravity();
        // There are no tiles
        if (this.tiles.length === 0) {
            this.masterCount++;
            this._unapplyGravity();
            return;
        }
        // masterCount 0 -> 1
        // There are no MasterTiles
        if (this.masterCount === 0) {
            // There is one SlaveTile
            if (this.tiles.length === this.masterCount + 1) {
                this.masterCount++;
                this.master = 0;
                this.masterAreaWidth = this.screenRectangle.width;
                this._unapplyGravity();
                return;
            }
            // There are multiple SlaveTiles
            if (this.tiles.length > this.masterCount + 1) {
                var tempTile = this.slaveRemoveTile();
                this.masterAreaWidth = this.screenRectangle.width * this.masterAreaRatio;
                tempTile.rectangle = Qt.rect(this.screenRectangle.x,
                    this.screenRectangle.y,
                    this.masterAreaWidth,
                    this.screenRectangle.height);
                this.adjustSlavesWidth(
                    (this.screenRectangle.width - this.masterAreaWidth) / this.screenRectangle.width,
                    this.masterCount,
                    this.tiles.length - 1,
                    this.screenRectangle.x + this.masterAreaWidth,
                    this.screenRectangle.x + this.screenRectangle.width);
                this.tiles.splice(this.masterCount, 0, tempTile)
                this.masterCount++;
                this.master = 0;
                this._unapplyGravity();
                return;
            }
        }
        // There is at least one MasterTile
        else if (this.masterCount > 0) {
            // There are no SlaveTiles
            if (this.tiles.length <= this.masterCount) {
                this.masterCount++;
                this._unapplyGravity();
                return;
            }
            // There is one SlaveTile
            if (this.tiles.length === this.masterCount + 1) {
                var tempTile = this.slaveRemoveTile();
                this.masterAddTile(tempTile);
                this.masterCount++;
                this.adjustMastersWidth(this.screenRectangle.width / this.masterAreaWidth,
                    0,
                    this.masterCount - 1, this.screenRectangle.x,
                    this.screenRectangle.x + this.screenRectangle.width);
                this.masterAreaWidth = this.screenRectangle.width;
                this._unapplyGravity();
                return;
            }
            // There are multiple SlaveTiles
            if (this.tiles.length > this.masterCount + 1) {
                var tempTile = this.slaveRemoveTile();
                this.masterAddTile(tempTile);
                this.masterCount++;
                this._unapplyGravity();
                return;
            }
        }
    } catch (e) {
        print(e)
        print(e.stack)
    }
}


GridLayout.prototype.decrementMaster = function () {
    try {
        this._applyGravity();
        // mastercount is already 0
        if (this.masterCount === 0) {
            this._unapplyGravity();
            return;
        }
        // There are no tiles
        // Or Fewer Tiles than masterCount
        if (this.tiles.length === 0 || this.tiles.length < this.masterCount) {
            this.masterCount--;
            this._unapplyGravity();
            return;
        }
        // There is exatly one MasterTile
        if (this.masterCount === 1) {
            // There are no SlaveTiles
            if (this.tiles.length === 1) {
                this.masterCount--;
                this.master = -1;
                this.masterAreaWidth = 0;
                this._unapplyGravity();
                return;
            }
            // There is at least one SlaveTile
            if (this.tiles.length > 1) {
                var tempTile = this.tiles.splice(0, 1)[0];
                this.masterCount--;
                this.master = -1;
                this.slaveAddTile(tempTile);
                this.adjustSlavesWidth(
                    this.screenRectangle.width / (this.screenRectangle.width - this.masterAreaWidth),
                    0,
                    this.tiles.length - 1, this.screenRectangle.x,
                    this.screenRectangle.x + this.screenRectangle.width);
                this.masterAreaWidth = 0;
                this._unapplyGravity();
                return;
            }
        }
        // There are Multiple MasterTiles
        if (this.masterCount > 1) {
            // There are no SlaveTiles
            if (this.tiles.length === this.masterCount) {
                var tempTile = this.masterRemoveTile(this.masterCount - 1);
                this.masterCount--;
                this.masterAreaWidth = this.masterAreaRatio * this.screenRectangle.width;
                this.adjustMastersWidth(this.masterAreaWidth / this.screenRectangle.width,
                    0,
                    this.masterCount - 1, this.screenRectangle.x,
                    this.screenRectangle.x + this.masterAreaWidth)
                tempTile.rectangle = Qt.rect(this.screenRectangle.x + this.masterAreaWidth,
                    this.screenRectangle.y,
                    this.screenRectangle.width - this.masterAreaWidth,
                    this.screenRectangle.height);
                this.tiles.push(tempTile);
                this._unapplyGravity();
                return;
            }
            // There is at least one SlaveTile
            if (this.tiles.length > this.masterCount) {
                var tempTile = this.masterRemoveTile(this.masterCount - 1);
                this.masterCount--;
                this.slaveAddTile(tempTile);
                this._unapplyGravity();
                return;
            }
        }

    } catch (e) {
        print(e)
        print(e.stack)
    }
}

// adds a tile to the slave grid
GridLayout.prototype.slaveAddTile = function (tile) {
    var slaveAreaWidth = this.screenRectangle.width - this.masterAreaWidth;
    this.tiles.splice(this.masterCount, 0, tile);
    var cr = this.getGridMeasurements(this.tiles.length - this.masterCount);
    var newc = cr.col;
    var newr = cr.row;
    cr = this.getGridMeasurements(this.tiles.length - this.masterCount - 1);
    var oldc = cr.col;
    var oldr = cr.row;
    var changedc = newc - oldc;
    var changedr = newr - oldr;

    // The grid measurements dont change
    if (!changedc && !changedr) {
        var cr = this.getCoordinatesFromIndex(this.tiles.length - this.masterCount - 2);
        var prevc = cr.col;
        var prevr = cr.row;

        cr = this.getCoordinatesFromIndex(this.tiles.length - this.masterCount - 1);
        var c = cr.col;
        var r = cr.row;
        var dc = c - prevc;
        var dr = r - prevr;

        // The new tile has different column and same row as the previous tile
        if (dc > 0) {
            if(this.spanRows)
            {
                var prevRectOld = util.copyRect(this.tiles[this.masterCount + 1].rectangle);

                let it = this.getIndexFromCoordinates(c,r - 1);
                let belowRectOld = util.copyRect(this.tiles[this.tiles.length - 1 - it].rectangle);
                var belowRectNew = this.tiles[this.tiles.length - 1 - it].rectangle;
                belowRectNew.y = prevRectOld.y + prevRectOld.height;
                belowRectNew.height = belowRectOld.height - prevRectOld.height;

                var newRect = Qt.rect(belowRectOld.x,
                    belowRectOld.y,
                    belowRectOld.width,
                    prevRectOld.height);
                tile.rectangle = newRect;
            }
            else
            {
                let it = this.getIndexFromCoordinates(c - 1,r - 1);
                let belowPrevRect = util.copyRect(this.tiles[this.tiles.length - 1 - it].rectangle);

                var prevRectOld = util.copyRect(this.tiles[this.masterCount + 1].rectangle);
                var prevRectNew = this.tiles[this.masterCount + 1].rectangle;
                prevRectNew.x = belowPrevRect.x
                prevRectNew.width = belowPrevRect.width
                var newRect = Qt.rect(prevRectOld.x,
                    prevRectNew.y,
                    prevRectOld.width - prevRectNew.width,
                    prevRectNew.height);
                tile.rectangle = newRect;
            }
        }
        // The new tile has different row and same column as the previous tile
        else if (dr > 0) {
            if(this.spanCols)
            {
                var prevRectOld = util.copyRect(this.tiles[this.masterCount + 1].rectangle);

                let it = this.getIndexFromCoordinates(c - 1,r);
                let rightRectOld = util.copyRect(this.tiles[this.tiles.length - 1 - it].rectangle);
                var rightRectNew = this.tiles[this.tiles.length - 1 - it].rectangle;
                rightRectNew.x = prevRectOld.x + prevRectOld.width;
                rightRectNew.width = rightRectOld.width - prevRectOld.width;

                var newRect = Qt.rect(prevRectOld.x,
                    rightRectOld.y,
                    prevRectOld.width,
                    rightRectOld.height);
                tile.rectangle = newRect;
            }
            else
            {
                let it = this.getIndexFromCoordinates(c - 1,r - 1);
                let rightPrevRect = util.copyRect(this.tiles[this.tiles.length - 1 - it].rectangle);

                var prevRectOld = util.copyRect(this.tiles[this.masterCount + 1].rectangle);
                var prevRectNew = this.tiles[this.masterCount + 1].rectangle;
                prevRectNew.y = rightPrevRect.y;
                prevRectNew.height = rightPrevRect.height;
                var newRect = Qt.rect(prevRectNew.x,
                    prevRectOld.y,
                    prevRectNew.width,
                    prevRectNew.y - prevRectOld.y);
                tile.rectangle = newRect;
            }
        } else {
            print("Error in SlaveAddTile");
        }
    }
    // The number of columns changes
    else if (changedc) {
        if(this.spanCols)
        {
            let it = this.getIndexFromCoordinates(oldc, 1);
            let tempRect = this.tiles[this.tiles.length - 1 - it].rectangle;
            tile.rectangle = Qt.rect(tempRect.x - Math.floor(slaveAreaWidth / oldc),
                tempRect.y,
                Math.floor(slaveAreaWidth / oldc),
                tempRect.height);

            for (let rt = 2; rt <= oldr; rt++)
            {
                let it = this.getIndexFromCoordinates(oldc, rt);
                let tempRect = this.tiles[this.tiles.length - 1 - it].rectangle;
                this.tiles[this.tiles.length - 1 - it].rectangle = Qt.rect(tempRect.x - Math.floor(slaveAreaWidth / oldc),
                    tempRect.y,
                    tempRect.width + Math.floor(slaveAreaWidth / oldc),
                    tempRect.height);
            }

            var newWidthSum = slaveAreaWidth;
            var oldWidthSum = newWidthSum + tile.rectangle.width
            var widthRatio = newWidthSum / oldWidthSum;
            this.adjustSlavesWidth(widthRatio,
                this.masterCount,
                this.tiles.length - 1,
                this.screenRectangle.x + this.masterAreaWidth,
                this.screenRectangle.x + this.screenRectangle.width);
        }
        else
        {
            tile.rectangle = Qt.rect(this.screenRectangle.x + this.masterAreaWidth,
                this.screenRectangle.y,
                Math.floor(slaveAreaWidth / newc),
                this.screenRectangle.height);

            var newWidthSum = slaveAreaWidth - Math.floor(slaveAreaWidth / newc);
            var oldWidthSum = slaveAreaWidth
            var widthRatio = newWidthSum / oldWidthSum;
            this.adjustSlavesWidth(widthRatio,
                this.masterCount + 1,
                this.tiles.length - 1,
                this.screenRectangle.x + this.masterAreaWidth + Math.floor(slaveAreaWidth / newc),
                this.screenRectangle.x + this.screenRectangle.width);
        }
    }
    // The number of rows changes
    else if (changedr) {
        if(this.spanRows)
        {
            let it = this.getIndexFromCoordinates(1,oldr);
            let tempRect = this.tiles[this.tiles.length - 1 - it].rectangle;
            tile.rectangle = Qt.rect(tempRect.x,
                this.screenRectangle.y - Math.floor(this.screenRectangle.height / oldr),
                tempRect.width,
                Math.floor(this.screenRectangle.height / oldr));

            for (let ct = 2; ct <= oldc; ct++)
            {
                let it = this.getIndexFromCoordinates(ct,oldr);
                let tempRect = this.tiles[this.tiles.length - 1 - it].rectangle;
                this.tiles[this.tiles.length - 1 - it].rectangle = Qt.rect(tempRect.x,
                    tempRect.y - Math.floor(this.screenRectangle.height / oldr),
                    tempRect.width,
                    tempRect.height + Math.floor(this.screenRectangle.height / oldr));
            }

            var newHeightSum = this.screenRectangle.height;
            var oldHeightSum = newHeightSum + tile.rectangle.height
            var heightRatio = newHeightSum / oldHeightSum;
            this.adjustSlavesHeight(heightRatio,
                this.masterCount,
                this.tiles.length - 1,
                this.screenRectangle.y,
                this.screenRectangle.y + this.screenRectangle.height);
        }
        else
        {
            tile.rectangle = Qt.rect(this.screenRectangle.x + this.masterAreaWidth,
                this.screenRectangle.y,
                slaveAreaWidth,
                Math.floor(this.screenRectangle.height / newr));

            var newHeightSum = this.screenRectangle.height - Math.floor(this.screenRectangle.height / newr);
            var oldHeightSum = this.screenRectangle.height
            var heightRatio = newHeightSum / oldHeightSum;
            this.adjustSlavesHeight(heightRatio,
                this.masterCount + 1,
                this.tiles.length - 1,
                this.screenRectangle.y + Math.floor(this.screenRectangle.height / newr),
                this.screenRectangle.y + this.screenRectangle.height);
        }

    }
};

// removes a tile from the slave grid
GridLayout.prototype.slaveRemoveTile = function () {
    var slaveAreaWidth = this.screenRectangle.width - this.masterAreaWidth;
    var removed = this.tiles.splice(this.masterCount, 1)[0];
    var cr = this.getGridMeasurements(this.tiles.length - this.masterCount);
    var newc = cr.col;
    var newr = cr.row;
    cr = this.getGridMeasurements(this.tiles.length - this.masterCount + 1);
    var oldc = cr.col;
    var oldr = cr.row;
    var changedc = oldc - newc;
    var changedr = oldr - newr;

    // The new tile has different row and same column as the previous tile
    if (!changedc && !changedr) {
        var cr = this.getCoordinatesFromIndex(this.tiles.length - this.masterCount);
        var prevc = cr.col;
        var prevr = cr.row;

        cr = this.getCoordinatesFromIndex(this.tiles.length - this.masterCount - 1);
        var c = cr.col;
        var r = cr.row;
        var dc = prevc - c;
        var dr = prevr - r;

        // The removed tile has different column and same row as the new last tile
        if (dc > 0) {
            if(this.spanRows)
            {
                var oldRect = removed.rectangle;
                let it = this.getIndexFromCoordinates(prevc,prevr - 1);
                let belowRectOld = util.copyRect(this.tiles[this.tiles.length - 1 - it].rectangle);
                let belowRectNew = this.tiles[this.tiles.length - 1 - it].rectangle;
                belowRectNew.y = oldRect.y;
                belowRectNew.height = oldRect.height + belowRectOld.height;
            }
            else
            {
                var oldRect = removed.rectangle;
                var rect = this.tiles[this.masterCount].rectangle;
                rect.x = oldRect.x;
                rect.width = oldRect.width + rect.width;
            }
        }
        // The removed tile has different row and same column as the new last tile
        else if (dr > 0) {
            if(this.spanCols)
            {
                var oldRect = removed.rectangle;
                let it = this.getIndexFromCoordinates(prevc - 1,prevr);
                let rightRectOld = util.copyRect(this.tiles[this.tiles.length - 1 - it].rectangle);
                let rightRectNew = this.tiles[this.tiles.length - 1 - it].rectangle;
                rightRectNew.x = oldRect.x;
                rightRectNew.width = oldRect.width + rightRectOld.width;
            }
            else
            {
                var oldRect = removed.rectangle;
                var rect = this.tiles[this.masterCount].rectangle;
                rect.y = oldRect.y;
                rect.height = oldRect.height + rect.height;
            }
        } else {
            print("Error in SlaveRemoveTile");
        }
    }
    // The number of columns changes
    else if (changedc) {
        var newWidthSum = slaveAreaWidth;
        var oldWidthSum = newWidthSum - removed.rectangle.width
        var widthRatio = newWidthSum / oldWidthSum;
        this.adjustSlavesWidth(widthRatio,
            this.masterCount,
            this.tiles.length - 1,
            this.screenRectangle.x + this.masterAreaWidth,
            this.screenRectangle.x + this.screenRectangle.width);
    }
    // The number of rows changes
    else if (changedr) {
        var newHeightSum = this.screenRectangle.height;
        var oldHeightSum = newHeightSum - removed.rectangle.height
        var heightRatio = newHeightSum / oldHeightSum;
        this.adjustSlavesHeight(heightRatio,
            this.masterCount,
            this.tiles.length - 1,
            this.screenRectangle.y,
            this.screenRectangle.y + this.screenRectangle.height);
    }
    return removed;
};

// adds a tile to the master stack
GridLayout.prototype.masterAddTile = function (tile) {
    tile.rectangle.width = Math.floor(this.masterAreaWidth / Math.min(this.masterCount, this.tiles.length));
    tile.rectangle.height = this.screenRectangle.height;
    tile.rectangle.y = this.screenRectangle.y;
    tile.rectangle.x = this.screenRectangle.x + this.masterAreaWidth + tile.rectangle.width;

    this.tiles.splice(Math.min(this.masterCount, this.tiles.length), 0, tile)
    var oldWidthSum = this.masterAreaWidth + tile.rectangle.width;
    var newWidthSum = this.masterAreaWidth;
    var widthRatio = newWidthSum / oldWidthSum;
    this.adjustMastersWidth(widthRatio,
        0, Math.min(this.masterCount, this.tiles.length - 1),
        this.screenRectangle.x,
        this.screenRectangle.x + this.masterAreaWidth);
};

// removes a tile from the master stack
GridLayout.prototype.masterRemoveTile = function (tileIndex) {
    var removed = this.tiles.splice(tileIndex, 1)[0];
    var newWidthSum = this.masterAreaWidth;
    var oldWidthSum = this.masterAreaWidth - removed.rectangle.width;
    var widthRatio = newWidthSum / oldWidthSum;

    this.adjustMastersWidth(widthRatio,
        0,
        Math.min(this.masterCount - 2, this.tiles.length - 1),
        this.screenRectangle.x,
        this.screenRectangle.x + this.masterAreaWidth);
    return removed;
};

// adjusts width of specified slaveTiles keeping size ratio between tiles
// should pass indices for all slaveTiles
GridLayout.prototype.adjustSlavesWidth = function (ratio, firstIndex, lastIndex, leftBorder, rightBorder) {
    var cr = this.getGridMeasurements(lastIndex - firstIndex + 1);
    var col_nr = cr.col;
    var row_nr = cr.row;

    for (let r = 1; r <= row_nr; r++) {
        let nextX = rightBorder;
        for (let c = 1; c <= col_nr; c++) {
            if (c !== col_nr) {
                if (this.getIndexFromCoordinates(c, r) <= lastIndex - firstIndex) {
                    var tile = this.tiles[lastIndex - this.getIndexFromCoordinates(c, r)];
                    tile.rectangle.width = Math.floor(ratio * tile.rectangle.width);
                    tile.rectangle.x = nextX - tile.rectangle.width;
                    nextX = tile.rectangle.x;
                }
            } else {
                if (this.getIndexFromCoordinates(c, r) <= lastIndex - firstIndex) {
                    var tile = this.tiles[lastIndex - this.getIndexFromCoordinates(c, r)];
                    tile.rectangle.x = leftBorder;
                    tile.rectangle.width = nextX - leftBorder;
                    nextX = leftBorder;
                }
                else if (this.spanCols)
                {
                    var tile = this.tiles[lastIndex - this.getIndexFromCoordinates(c - 1, r)];
                    tile.rectangle.width = tile.rectangle.width + (tile.rectangle.x - leftBorder);
                    tile.rectangle.x = leftBorder;
                    nextX = leftBorder;
                }
            }
        }
    }
};

// adjusts height of specified slaveTiles keeping size ratio between tiles
// should pass indices for all slaveTiles
GridLayout.prototype.adjustSlavesHeight = function (ratio, firstIndex, lastIndex, upperBorder, lowerBorder) {
    var cr = this.getGridMeasurements(lastIndex - firstIndex + 1);
    var col_nr = cr.col;
    var row_nr = cr.row;

    for (let c = 1; c <= col_nr; c++) {
        let nextY = lowerBorder;
        for (let r = 1; r <= row_nr; r++) {
            if (r !== row_nr) {
                if (this.getIndexFromCoordinates(c, r) <= lastIndex - firstIndex) {
                    var tile = this.tiles[lastIndex - this.getIndexFromCoordinates(c, r)];
                    tile.rectangle.height = Math.floor(ratio * tile.rectangle.height);
                    tile.rectangle.y = nextY - tile.rectangle.height;
                    nextY = tile.rectangle.y;
                }
            } else {
                if (this.getIndexFromCoordinates(c, r) <= lastIndex - firstIndex) {
                    var tile = this.tiles[lastIndex - this.getIndexFromCoordinates(c, r)];
                    tile.rectangle.y = upperBorder;
                    tile.rectangle.height = nextY - upperBorder;
                    nextY = upperBorder;
                }
                else if (this.spanRows)
                {
                    var tile = this.tiles[lastIndex - this.getIndexFromCoordinates(c, r - 1)];
                    tile.rectangle.height = tile.rectangle.height + (tile.rectangle.y - upperBorder);
                    tile.rectangle.y = upperBorder;
                    nextY = upperBorder;
                }
            }
        }
    }
};

// adjusts width of specified masterTiles keeping size ratio between tiles
// should pass indices for all master tiles
GridLayout.prototype.adjustMastersWidth = function (ratio, firstIndex, lastIndex, leftBorder, rightBorder) {
    var nextX = leftBorder;
    for (var i = firstIndex; i <= lastIndex; i++) {
        if (i !== lastIndex) {
            this.tiles[i].rectangle.x = nextX;
            this.tiles[i].rectangle.width = Math.floor(ratio * this.tiles[i].rectangle.width);
            nextX = this.tiles[i].rectangle.x + this.tiles[i].rectangle.width;
        } else {
            this.tiles[i].rectangle.x = nextX;
            this.tiles[i].rectangle.width = rightBorder - this.tiles[i].rectangle.x;
            nextX = rightBorder;
        }
    }
};

// returns column and row count of a grid with slaveTileCount many tiles
GridLayout.prototype.getGridMeasurements = function (slaveTileCount) {
    if (slaveTileCount === 0)
        return [0, 0];

    var columns = Math.ceil(Math.sqrt(slaveTileCount));
    var rows = Math.ceil((slaveTileCount / columns));
    return { "col": columns, "row": rows };
}

//returns [column,row] for a given index
//col and row starting at 1
//index starting at 0
GridLayout.prototype.getCoordinatesFromIndex = function (i) {
    let a = Math.ceil(Math.sqrt(i + 1)) - 1;
    let b = a * a - 1;

    var col = 0;
    var row = 0;

    if (i - b <= a) {
        col = a + 1;
        row = i - b;
    } else {
        row = a + 1;
        col = (i - b) - a;
    }
    return { "col": col, "row": row };
};

//returns index for a given column and row
//col and row starting at 1
//index starting at 0
GridLayout.prototype.getIndexFromCoordinates = function (col, row) {
    let a = Math.max(col, row) - 1;
    let b = a * a - 1;
    let offset = 0;
    if (row > a) {
        offset += a;
        offset += col;
    } else {
        offset += row;
    }
    let c = b + offset;
    return c;
};
