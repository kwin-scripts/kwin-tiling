/********************************************************************
 KWin - the KDE window manager
 This file is part of the KDE project.

Copyright (C) 2012 Mathias Gottschlag <mgottschlag@gmail.com>

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
}

Layout.prototype.setLayoutArea = function(newArea) {
	try {
		var oldArea = this.screenRectangle;
		var xscale = newArea.width / oldArea.width;
		var yscale = newArea.height / oldArea.height;
		var xoffset = newArea.x - oldArea.x;
		var yoffset = newArea.y - oldArea.y;
		this.tiles.forEach(function(tile) {
			var lastrect = tile.rectangle;
			var newrect = Qt.rect(lastrect.x + xoffset,
								  lastrect.y + yoffset,
								  lastrect.width * xscale,
								  lastrect.height * yscale);
			tile.rectangle = newrect;
		});
		this.screenRectangle = newArea;
	} catch(err) {
		print(err, "in Layout.setLayoutArea");
	}
}
