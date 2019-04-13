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
function BladeLayout(screenRectangle) {
    try {
        print("Creating BladeLayout");
        Layout.call(this, screenRectangle);
        // TODO
    } catch(err) {
        print(err, "in BladeLayout");
    }
    this.master = 0;
    print("BladeLayout created");
};

BladeLayout.prototype = new Layout();
BladeLayout.prototype.constructor = BladeLayout;

BladeLayout.prototype.name = "Blade";
// // TODO: Add an image for the layout switcher
// BladeLayout.image = null;

BladeLayout.prototype.addTile = function() {
    try {
        this._applyGravity();
        if (this.tiles.length == 0) {
            // The first tile fills the whole screen
            var rect = util.copyRect(this.screenRectangle);
            this._createTile(rect);
            this._unapplyGravity();
            return;
        } else {
            // Divide the screen width evenly between full-height tiles
            var tileWidth = Math.floor(this.screenRectangle.width / (this.tiles.length + 1));
            var newRect = Qt.rect(this.screenRectangle.x + this.tiles.length * tileWidth,
                                  this.screenRectangle.y,
                                  tileWidth,
                                  this.screenRectangle.height);
            // FIXME: Try to keep ratio
            for (var i = 0; i < this.tiles.length; i++) {
                var rect = this.tiles[i].rectangle;
                rect.x = this.screenRectangle.x + tileWidth * i;
                rect.width = tileWidth;
                this.tiles[i].rectangle = rect;
            }
            // Adjust tile's width for rounding errors
            newRect.width = (this.screenRectangle.width + this.screenRectangle.x) - newRect.x;
            // TODO: Move this before setting ratio to simplify
            this._createTile(newRect);
            this._unapplyGravity();
        }
    } catch(err) {
        print(err, "in BladeLayout.addTile");
    }
};

BladeLayout.prototype.removeTile = function(tileIndex) {
    try {
        this._applyGravity();
        // Remove the array entry
        var oldrect = this.tiles[tileIndex].rectangle;
        this.tiles.splice(tileIndex, 1);
        // Update the other tiles
        if (this.tiles.length == 1) {
            this.tiles[0].rectangle = util.copyRect(this.screenRectangle);
        }
        if (this.tiles.length > 1) {
            var tileCount = this.tiles.length;
            var lastRect = this.tiles[0].rectangle;
            var newRect = Qt.rect(this.screenRectangle.x,
                                  this.screenRectangle.y,
                                  this.screenRectangle.width / tileCount,
                                  this.screenRectangle.height);
            var lowest = 1;
            for (var i = 0; i < this.tiles.length; i++) {
                var rect = this.tiles[i].rectangle;
                rect.x = newRect.x + newRect.width * i;
                rect.width = newRect.width;
                this.tiles[i].rectangle = rect;
            }
            // Adjust rightmost tile's height for rounding errors
            this.tiles[this.tiles.length - 1].rectangle.width = (this.screenRectangle.width + this.screenRectangle.x) - this.tiles[this.tiles.length - 1].rectangle.x;
        }
        this._unapplyGravity();
    } catch(err) {
        print(err, "in BladeLayout.removeTile");
    }
};
