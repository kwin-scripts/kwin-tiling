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

Qt.include("layout.js");
/**
 * Class which arranges the windows in a spiral with the largest window filling
 * the left half of the screen.
 */
function SpiralLayout(screenRectangle) {
    print("Creating SpiralLayout");
    Layout.call(this, screenRectangle);
    this.master = 0;
};

SpiralLayout.prototype = new Layout();
SpiralLayout.prototype.constructor = SpiralLayout;

SpiralLayout.prototype.name = "Spiral";
// TODO: Add an image for the layout switcher
//SpiralLayout.image = null;

SpiralLayout.prototype.addTile = function() {
    this._applyGravity();
    if (this.tiles.length == 0) {
        // The first tile fills the whole screen
        var rect = Qt.rect(this.screenRectangle.x,
                           this.screenRectangle.y,
                           this.screenRectangle.width,
                           this.screenRectangle.height);
        this._createTile(rect);
    } else {
        // Divide the last tile into two halves
        var lastRect = this.tiles[this.tiles.length - 1].rectangle;
        var newRect = Qt.rect(lastRect.x,
                              lastRect.y,
                              lastRect.width,
                              lastRect.height);
        var direction = this.tiles.length % 4;
        var splitX = lastRect.width / 2;
        var splitY = lastRect.height / 2;
        switch (direction) {
        case 0:
            lastRect.y = lastRect.y + splitY;
            lastRect.height = lastRect.height - splitY;
            newRect.height = splitY;
            break;
        case 1:
            lastRect.width = splitX;
            newRect.x = newRect.x + splitX;
            newRect.width = newRect.width - splitX;
            break;
        case 2:
            lastRect.height = splitY;
            newRect.y = newRect.y + splitY;
            newRect.height = newRect.height - splitY;
            break;
        case 3:
            lastRect.x = lastRect.x + splitX;
            lastRect.width = lastRect.width - splitX;
            newRect.width = splitX;
            break;
        }
        this.tiles[this.tiles.length - 1].rectangle = lastRect;
        this._createTile(newRect);
    }
    this._unapplyGravity();
    //var lastRect = this.tiles[this.tiles.length - 1].rectangle;
};

SpiralLayout.prototype.removeTile = function(tileIndex) {
    // Increase the size of the last tile
    if (this.tiles.length > 1) {
        var tileCount = this.tiles.length - 1;
        var rects = [
            this.tiles[tileCount - 1].rectangle,
            this.tiles[tileCount].rectangle
        ];
        var left = Math.min(rects[0].x, rects[1].x);
        var top = Math.min(rects[0].y, rects[1].y);
        var right = Math.max(rects[0].x + rects[0].width,
                             rects[1].x + rects[1].width);
        var bottom = Math.max(rects[0].y + rects[0].height,
                              rects[1].y + rects[1].height);
        var lastRect = Qt.rect(left, top, right - left, bottom - top);
        this.tiles[tileCount - 1].rectangle = lastRect;
    }
    // Remove the last array entry
    this.tiles.length--;
};
