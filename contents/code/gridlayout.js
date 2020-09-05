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
 * Class which arranges the windows in a spiral with the largest window filling
 * the left half of the screen.
 */
function GridLayout(screenRectangle) {
    print("Creating GridLayout");
    try {
        Layout.call(this, screenRectangle);
    } catch (err) {
        print(err, "in GridLayout");
    }
    this.masterAreaRatio = KWin.readConfig("gridLayoutMasterRatio", 50) / 100;
    this.masterAreaWidth = 0;
    this.master = -1;
    this.masterCount = 0;
    this.isGridLayout = true
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
                    // remove tile from slaves
                    this.slaveRemoveTile()
                    // masters take entire screen
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
                    // remove last tile from slaves
                    this.slaveRemoveTile();
                }
            }
            // tile is slave
            else if (tileIndex >= this.masterCount) {
                // tile is only slave
                if (this.masterCount === this.tiles.length - 1) {
                    // remove last tile from slaves
                    this.slaveRemoveTile();
                    // masters take entire screen
                    this.adjustMastersWidth(this.screenRectangle.width / this.masterAreaWidth,
                        0,
                        this.masterCount - 1, this.screenRectangle.x,
                        this.screenRectangle.x + this.screenRectangle.width);
                    this.masterAreaWidth = this.screenRectangle.width;
                }
                // there is more than one slave
                else if (this.masterCount < this.tiles.length - 1) {
                    // remove last tile from slaves
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
        printAllRects(this.tiles)
        // There are no tiles
        if (this.tiles.length === 0) {
            this.masterCount++;
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
                return;
            }
        }
        // There are MasterTiles
        else if (this.masterCount > 0) {
            // There are no SlaveTiles
            if (this.tiles.length <= this.masterCount) {
                this.masterCount++;
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
                return;
            }
            // There are multiple SlaveTiles
            if (this.tiles.length > this.masterCount + 1) {
                var tempTile = this.slaveRemoveTile();
                this.masterAddTile(tempTile);
                this.masterCount++;
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
        // mastercount is already 0
        if (this.masterCount === 0) {
            return;
        }
        // There are no tiles
        // Or Fewer Tiles than masterCount
        if (this.tiles.length === 0 || this.tiles.length < this.masterCount) {
            this.masterCount--;
            return;
        }
        // One MasterTile
        if (this.masterCount === 1) {
            // No SlaveTiles
            if (this.tiles.length === 1) {
                this.masterCount--;
                this.master = -1;
                this.masterAreaWidth = 0;
                return;
            }
            // Existing SlaveTiles
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
                return;
            }
        }
        // Multiple MasterTiles
        if (this.masterCount > 1) {
            // No SlaveTiles
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
                return;
            }
            // Existing SlaveTiles
            if (this.tiles.length > this.masterCount) {
                var tempTile = this.masterRemoveTile(this.masterCount - 1);
                this.masterCount--;
                this.slaveAddTile(tempTile);
                return;
            }
        }

    } catch (e) {
        print(e)
        print(e.stack)
    }
}


GridLayout.prototype.slaveAddTile = function (tile) {
    var slaveAreaWidth = this.screenRectangle.width - this.masterAreaWidth;
    this.tiles.splice(this.tiles.length, 0, tile);
    var [newc, newr] = this.getGridMeasurements(this.tiles.length - this.masterCount);
    var [oldc, oldr] = this.getGridMeasurements(this.tiles.length - this.masterCount - 1);
    var [changedc, changedr] = [newc - oldc, newr - oldr];

    if (!changedc && !changedr) {
        var [prevc, prevr] = this.getCoordinatesFromIndex(this.tiles.length - this.masterCount - 2);
        var [c, r] = this.getCoordinatesFromIndex(this.tiles.length - this.masterCount - 1);
        var [dc, dr] = [c - prevc, r - prevr];

        if (dc > 0) {
            var prevRectOld = util.copyRect(this.tiles[this.tiles.length - 2].rectangle);
            var prevRectNew = this.tiles[this.tiles.length - 2].rectangle;
            prevRectNew.x = prevRectOld.x + prevRectOld.width - slaveAreaWidth / newc;
            prevRectNew.width = slaveAreaWidth / newc;
            var newRect = Qt.rect(prevRectOld.x,
                prevRectNew.y,
                prevRectOld.width - prevRectNew.width,
                prevRectNew.height);
            tile.rectangle = newRect;
        } else if (dr > 0) {
            var prevRectOld = util.copyRect(this.tiles[this.tiles.length - 2].rectangle);
            var prevRectNew = this.tiles[this.tiles.length - 2].rectangle;
            prevRectNew.y = prevRectOld.y + prevRectOld.height - this.screenRectangle.height / newr;
            prevRectNew.height = this.screenRectangle.height / newr;
            var newRect = Qt.rect(prevRectNew.x,
                prevRectOld.y,
                prevRectNew.width,
                prevRectNew.y - prevRectOld.y);
            tile.rectangle = newRect;
        } else {
            print("Error in SlaveAddTile");
        }
    } else if (changedc) {
        tile.rectangle = Qt.rect(this.screenRectangle.x - slaveAreaWidth / oldc,
            this.screenRectangle.y,
            slaveAreaWidth / oldc,
            this.screenRectangle.height);

        var newWidthSum = slaveAreaWidth;
        var oldWidthSum = newWidthSum + tile.rectangle.width
        var widthRatio = newWidthSum / oldWidthSum;
        this.adjustSlavesWidth(widthRatio,
            this.masterCount,
            this.tiles.length - 1,
            this.screenRectangle.x + this.masterAreaWidth,
            this.screenRectangle.x + this.screenRectangle.width);
    } else if (changedr) {
        tile.rectangle = Qt.rect(this.screenRectangle.x + this.masterAreaWidth,
            this.screenRectangle.y - this.screenRectangle.height / oldr,
            slaveAreaWidth,
            this.screenRectangle.height / oldr);

        var newHeightSum = this.screenRectangle.height;
        var oldHeightSum = newHeightSum + tile.rectangle.height
        var heightRatio = newHeightSum / oldHeightSum;
        this.adjustSlavesHeight(heightRatio,
            this.masterCount,
            this.tiles.length - 1,
            this.screenRectangle.y,
            this.screenRectangle.y + this.screenRectangle.height);
    }
};
GridLayout.prototype.slaveRemoveTile = function () {
    var slaveAreaWidth = this.screenRectangle.width - this.masterAreaWidth;
    var removed = this.tiles.pop();
    var [newc, newr] = this.getGridMeasurements(this.tiles.length - this.masterCount);
    var [oldc, oldr] = this.getGridMeasurements(this.tiles.length - this.masterCount + 1);
    var [changedc, changedr] = [oldc - newc, oldr - newr];

    if (!changedc && !changedr) {
        var [prevc, prevr] = this.getCoordinatesFromIndex(this.tiles.length - this.masterCount);
        var [c, r] = this.getCoordinatesFromIndex(this.tiles.length - this.masterCount - 1);
        var [dc, dr] = [prevc - c, prevr - r];

        if (dc > 0) {
            var oldRect = removed.rectangle;
            var rect = this.tiles[this.tiles.length - 1].rectangle;
            rect.x = oldRect.x;
            rect.width = oldRect.width + rect.width;
        } else if (dr > 0) {
            var oldRect = removed.rectangle;
            var rect = this.tiles[this.tiles.length - 1].rectangle;
            rect.y = oldRect.y;
            rect.height = oldRect.height + rect.height;
        } else {
            print("Error in SlaveRemoveTile");
        }
    } else if (changedc) {
        var newWidthSum = slaveAreaWidth;
        var oldWidthSum = newWidthSum - removed.rectangle.width
        var widthRatio = newWidthSum / oldWidthSum;
        this.adjustSlavesWidth(widthRatio,
            this.masterCount,
            this.tiles.length - 1,
            this.screenRectangle.x + this.masterAreaWidth,
            this.screenRectangle.x + this.screenRectangle.width);
    } else if (changedr) {
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

GridLayout.prototype.masterAddTile = function (tile) {
    tile.rectangle.width = this.masterAreaWidth / Math.min(this.masterCount, this.tiles.length);
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

GridLayout.prototype.masterRemoveTile = function (tileIndex) {
    var removed = this.tiles.splice(tileIndex, 1)[0];
    var newWidthSum = this.masterAreaWidth;
    var oldWidthSum = this.masterAreaWidth - removed.rectangle.width;
    var widthRatio = newWidthSum / oldWidthSum;

    this.adjustMastersWidth(widthRatio,
        0,
        this.masterCount - 2, this.screenRectangle.x,
        this.screenRectangle.x + this.masterAreaWidth);
    return removed;
};

GridLayout.prototype.adjustSlavesWidth = function (ratio, firstIndex, lastIndex, leftBorder, rightBorder) {
    let [col_nr, row_nr] = this.getGridMeasurements(lastIndex - firstIndex + 1)

    for (let r = 1; r <= row_nr; r++) {
        let nextX = rightBorder;
        for (let c = 1; c <= col_nr; c++) {
            if (c !== col_nr) {
                if (this.getIndexFromCoordinates(c, r) <= lastIndex - firstIndex) {
                    var tile = this.tiles[firstIndex + this.getIndexFromCoordinates(c, r)];
                    tile.rectangle.width = ratio * tile.rectangle.width;
                    tile.rectangle.x = nextX - tile.rectangle.width;
                    nextX = tile.rectangle.x;
                }
            } else {
                if (this.getIndexFromCoordinates(c, r) <= lastIndex - firstIndex) {
                    var tile = this.tiles[firstIndex + this.getIndexFromCoordinates(c, r)];
                    tile.rectangle.x = leftBorder;
                    tile.rectangle.width = nextX - leftBorder;
                    nextX = leftBorder;
                }
            }
        }
    }
};

GridLayout.prototype.adjustSlavesHeight = function (ratio, firstIndex, lastIndex, upperBorder, lowerBorder) {
    let [col_nr, row_nr] = this.getGridMeasurements(lastIndex - firstIndex + 1)

    for (let c = 1; c <= col_nr; c++) {
        let nextY = lowerBorder;
        for (let r = 1; r <= row_nr; r++) {
            if (r !== row_nr) {
                if (this.getIndexFromCoordinates(c, r) <= lastIndex - firstIndex) {
                    var tile = this.tiles[firstIndex + this.getIndexFromCoordinates(c, r)];
                    tile.rectangle.height = ratio * tile.rectangle.height;
                    tile.rectangle.y = nextY - tile.rectangle.height;
                    nextY = tile.rectangle.y;
                }
            } else {
                if (this.getIndexFromCoordinates(c, r) <= lastIndex - firstIndex) {
                    var tile = this.tiles[firstIndex + this.getIndexFromCoordinates(c, r)];
                    tile.rectangle.y = upperBorder;
                    tile.rectangle.height = nextY - upperBorder;
                    nextY = upperBorder;
                }
            }
        }
    }
};

GridLayout.prototype.adjustMastersWidth = function (ratio, firstIndex, lastIndex, leftBorder, rightBorder) {
    var nextX = leftBorder;
    for (var i = firstIndex; i <= lastIndex; i++) {
        if (i !== lastIndex) {
            this.tiles[i].rectangle.x = nextX;
            this.tiles[i].rectangle.width = ratio * this.tiles[i].rectangle.width;
            nextX = this.tiles[i].rectangle.x + this.tiles[i].rectangle.width;
        } else {
            this.tiles[i].rectangle.x = nextX;
            this.tiles[i].rectangle.width = rightBorder - this.tiles[i].rectangle.x;
            nextX = rightBorder;
        }
    }
};

GridLayout.prototype.getGridMeasurements = function (slaveTileCount) {
    if (slaveTileCount === 0)
        return [0, 0];

    var columns = Math.ceil(Math.sqrt(slaveTileCount));
    var rows = Math.ceil((slaveTileCount / columns));
    return [columns, rows];
}

//returns [column,row]
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
    return [col, row];
};

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

function printRect(rect) {
    print(rect.x + "\t" + rect.y + "\t" + rect.width + "\t" + rect.height);
}

function printAllRects(tiles) {
    print("all Rects")
    for (let i = 0; i < tiles.length; i++)
        printRect(tiles[i].rectangle)
    print("all Rects done")
}
