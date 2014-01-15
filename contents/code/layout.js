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
}
