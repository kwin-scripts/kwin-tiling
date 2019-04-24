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
function HalfLayout(screenRectangle) {
    print("Creating HalfLayout");
    try {
        Layout.call(this, screenRectangle);
    } catch(err) {
        print(err, "in HalfLayout");
    }
    this.masterRatio = 100 / KWin.readConfig("halfLayoutMasterRatio", 50);
    this.firstWidth = this.screenRectangle.width / this.masterRatio;
    this.master = 0;
    this.masterCount = 1;
};

HalfLayout.prototype = new Layout();
HalfLayout.prototype.constructor = HalfLayout;

HalfLayout.prototype.name = "Half";
// // TODO: Add an image for the layout switcher
// HalfLayout.image = null;

HalfLayout.prototype.addTile = function() {
    try {
        this._applyGravity();
        if (this.tiles.length == 0) {
            // The first tile fills the whole screen
            var rect = util.copyRect(this.screenRectangle);
            util.assertRectInScreen(rect, this.screenRectangle);
            this._createTile(rect);
            this._unapplyGravity();
            return;
        }
        if (this.tiles.length <= this.masterCount) {
            // The second tile fills the right half of the screen
            if (this.tiles.length < this.masterCount) {
                var newWidth = this.screenRectangle.width / (this.tiles.length + 1);
                var newSWidth = newWidth;
            } else {
                this.firstWidth = this.screenRectangle.width / this.masterRatio;
                var newWidth = this.firstWidth / (this.tiles.length);
                var newSWidth = this.screenRectangle.width - this.firstWidth;
            }
            for (var i = 0; i < this.tiles.length; i++) {
                this.tiles[i].rectangle.x = this.screenRectangle.x + i * newWidth;
                this.tiles[i].rectangle.width = newWidth;
            }

            var lastRect = this.tiles[this.tiles.length - 1].rectangle;
            var newRect = Qt.rect(lastRect.x + lastRect.width,
                                  this.screenRectangle.y,
                                  newSWidth,
                                  this.screenRectangle.height);
            util.assertRectInScreen(newRect, this.screenRectangle);
            this._createTile(newRect);
            this._unapplyGravity();
            return;
        }
        if (this.tiles.length > this.masterCount) {
            // Every other tile separates the right half
            var slaveCount = this.tiles.length - this.masterCount;
            var lastRect = this.tiles[this.master + this.masterCount].rectangle;
            var newRect = Qt.rect(lastRect.x,
                                  lastRect.y,
                                  this.screenRectangle.width - this.getMasterWidth(),
                                  this.screenRectangle.height / (slaveCount + 1));
            newRect.y = newRect.y + newRect.height * slaveCount;
            // FIXME: Try to keep ratio
            for (var i = this.master + this.masterCount; i < this.tiles.length; i++) {
                var rect = this.tiles[i].rectangle;
                rect.x = newRect.x;
                var offset = newRect.height * (i - (this.master + this.masterCount));
                rect.y = lastRect.y + offset;
                rect.width = newRect.width;
                rect.height = newRect.height;
                this.tiles[i].rectangle = rect;
            }
            // Adjust new tile's height for rounding errors
            newRect.height = (this.screenRectangle.y + this.screenRectangle.height) - newRect.y;
            util.assertRectInScreen(newRect, this.screenRectangle);
            this._createTile(newRect);
            this._unapplyGravity();
        }
    } catch(err) {
        print(err, "in HalfLayout.addTile");
    }
};

// Save the first tile's width
HalfLayout.prototype.resizeTile = function(tileIndex, rectangle) {
    Layout.prototype.resizeTile.call(this, tileIndex, rectangle);
    // Fixes bug where firstWidth will be set to the full screen when resizing with just masters
    if (this.tiles.length > this.masterCount) {
        this.firstWidth = this.getMasterWidth();
    }
};

HalfLayout.prototype.getMasterWidth = function() {
    var tile = this.tiles[Math.min(this.tiles.length, this.masterCount) - 1];
    if (tile != null) {
        var lastMaster = tile.rectangle;
        return lastMaster.x + lastMaster.width - this.screenRectangle.x;
    } else {
        // No masters exist
        return 0;
    }
};

HalfLayout.prototype.removeTile = function(tileIndex) {
    try {
        // Remove the array entry
        var oldrect = this.tiles[tileIndex].rectangle;
        if (tileIndex < 0 || tileIndex >= this.tiles.length) {
            print("Removing invalid tileindex");
            return;
        }
        this._applyGravity();
        this.tiles.splice(tileIndex, 1);
        // Update the other tiles
        if (this.tiles.length == 1) {
            this.tiles[0].rectangle = util.copyRect(this.screenRectangle);
        }
        if (this.tiles.length > 1) {
            var mC = Math.min(this.tiles.length, this.masterCount);
            if (this.tiles.length > mC) {
                // The distance between the right edge of the last master and the left edge of the screen is the width of the master area
                if(mC > 0){
                    if(tileIndex === mC - 1){
                        var mWidth = (oldrect.x + oldrect.width - this.screenRectangle.x) / mC;
                    }
                    else if(tileIndex < mC - 1){
                        var mWidth = (this.tiles[mC - 2].rectangle.x + this.tiles[mC - 2].rectangle.width - this.screenRectangle.x) / mC;
                    }else {
                        var mWidth = (this.tiles[mC - 1].rectangle.x + this.tiles[mC - 1].rectangle.width - this.screenRectangle.x) / mC;
                    }
                } else {
                    var mWidth = 0;
                }
            } else {
                var mWidth = this.screenRectangle.width / this.tiles.length;
            }
            for (var i = 0; i < mC; i++) {
                this.tiles[i].rectangle.x = i * mWidth + this.screenRectangle.x;
                this.tiles[i].rectangle.width = mWidth;
                this.tiles[i].rectangle.height = this.screenRectangle.height;
                this.tiles[i].rectangle.y = this.screenRectangle.y;
            }
            // Fallthrough for slaves
        }
        if (this.tiles.length > this.masterCount) {
            var tileCount = this.tiles.length - this.masterCount;
            util.assertTrue(tileCount > 0, "Tilecount is zero");
            var lastRect = this.tiles[0].rectangle;
            var newRect = Qt.rect(this.screenRectangle.x + this.getMasterWidth(),
                                  this.screenRectangle.y,
                                  this.screenRectangle.width - this.getMasterWidth(),
                                  this.screenRectangle.height / tileCount);
            util.assertTrue(newRect.height > 0, "newRect.height is zero");
            var lowest = this.tiles.length - 1;
            for (var i = this.masterCount + this.master; i < this.tiles.length; i++) {
                var rect = this.tiles[i].rectangle;
                rect.y = newRect.y + newRect.height * (i - this.masterCount);
                rect.height = newRect.height;
                this.tiles[i].rectangle = rect;
            }
            // Adjust lowest tile's height for rounding errors
            this.tiles[lowest].rectangle.height = (this.screenRectangle.y + this.screenRectangle.height) - this.tiles[lowest].rectangle.y;
            util.assertTrue(this.tiles[lowest].rectangle.height > 0, "Lowest rect has zero height");
        }
        this._unapplyGravity();
    } catch(err) {
        print(err, "in HalfLayout.removeTile");
    }
};

HalfLayout.prototype.increaseMaster = function() {
    var oldC = this.masterCount;
    this.masterCount++;
    if (this.tiles.length == 0) {
        return;
    }
    this._applyGravity();
    if (this.masterCount > 1) {
        if (this.tiles.length >= this.master + oldC && oldC > 0) {
            var rightEdgeRect = this.tiles[this.master + oldC - 1].rectangle;
            var rightEdge = util.getR(rightEdgeRect);
        }
        if (this.masterCount < this.tiles.length) {
            var newWidth = (rightEdge - this.screenRectangle.x) / (oldC + 1);
        } else if (this.masterCount == this.tiles.length) {
            var newWidth = (this.screenRectangle.width) / (this.masterCount);
        } else {
            this._unapplyGravity();
            return;
        }
        for (var i = this.master; i < Math.min(this.master + oldC,this.tiles.length); i++) {
            this.tiles[i].rectangle.x = this.screenRectangle.x + newWidth * (i - this.master);
            this.tiles[i].rectangle.y = this.screenRectangle.y;
            this.tiles[i].rectangle.width = newWidth;
            this.tiles[i].rectangle.height = this.screenRectangle.height;
        }
        this.tiles[this.master + this.masterCount - 1].rectangle = Qt.rect(rightEdgeRect.x + rightEdgeRect.width,
                                                                           rightEdgeRect.y,
                                                                           newWidth,
                                                                           rightEdgeRect.height);
    } else {
        this.tiles[this.master + this.masterCount - 1].rectangle = Qt.rect(this.screenRectangle.x,
                                                                           this.screenRectangle.y,
                                                                           this.firstWidth,
                                                                           this.screenRectangle.height);
    }
    var newHeight = (this.screenRectangle.y + this.screenRectangle.height) / (this.tiles.length - (this.master + this.masterCount));
    for (var i = this.master + this.masterCount; i < this.tiles.length; i++) {
        this.tiles[i].rectangle.x = this.screenRectangle.x + this.getMasterWidth();
        this.tiles[i].rectangle.width = this.screenRectangle.width - this.getMasterWidth();
        this.tiles[i].rectangle.height = newHeight;
        this.tiles[i].rectangle.y = this.screenRectangle.y + (i - (this.master + this.masterCount)) * newHeight;
    }
    this.firstWidth = this.getMasterWidth();
    this._unapplyGravity();
};

HalfLayout.prototype.decrementMaster = function() {
    var oldC = this.masterCount;
    var newC = this.masterCount - 1;
    if (this.masterCount == 0) {
        return;
    }
    this._applyGravity();
    // Explicitly allow usage without master - it's effectively a different layout
    if (this.masterCount == 1) {
        var oldMWidth = 0;
    } else {
        var oldMWidth = this.getMasterWidth();
    }
    if (this.tiles.length > oldC) {
        var newMWidth = oldMWidth / newC;
        if(newC == 0) {
            newMWidth = 0;
        }
        var newSWidth = this.screenRectangle.width - (newMWidth * newC);
        var newSHeight = this.screenRectangle.height / (this.tiles.length - newC);
    } else if (this.tiles.length == oldC) {
        var newMWidth = (this.screenRectangle.width / this.masterRatio) / newC ;
        var newSWidth = this.screenRectangle.width - (newMWidth * newC);
        var newSHeight = this.screenRectangle.height / (this.tiles.length - newC);
    } else {
        var newMWidth = this.screenRectangle.width / this.tiles.length;
    }
    for (var i = 0; i < Math.min(this.tiles.length,newC); i++) {
        this.tiles[i].rectangle.x = this.screenRectangle.x + i * newMWidth;
        this.tiles[i].rectangle.width = newMWidth;
        this.tiles[i].rectangle.y = this.screenRectangle.y;
        this.tiles[i].rectangle.height = this.screenRectangle.height;
        util.assertRectInScreen(this.tiles[i].rectangle, this.screenRectangle);
    }
    for (var i = newC; i < this.tiles.length; i++) {
        this.tiles[i].rectangle.y = this.screenRectangle.y + (i - newC) * newSHeight;
        this.tiles[i].rectangle.height = newSHeight;
        this.tiles[i].rectangle.width = newSWidth;
        this.tiles[i].rectangle.x = this.screenRectangle.x + (newMWidth * newC);
        util.assertRectInScreen(this.tiles[i].rectangle, this.screenRectangle);
    }
    this.masterCount--;
    if(newC != 0) {
        this.firstWidth = this.getMasterWidth();
    } else {
        this.firstWidth = this.screenRectangle.width / this.masterRatio;
    }
    this._unapplyGravity();
};
