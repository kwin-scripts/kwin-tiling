
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
Qt.include("containerTree.js");

/**
 * Class which allows dynamic arrangement of tiles in a similar way as
 the i3 window manager. The core logic is implemented in the containerTree
 data structure.
 */
function I3Layout(screenRectangle) {
    try {
        print("Creating I3Layout");
        Layout.call(this, screenRectangle);
        // TODO: Read default layout from config file and don't assume horizontal
        this.containerTree = new ContainerNode('horizontal', screenRectangle);
        this.isI3Layout = true;
        // TODO
    } catch(err) {
        print(err, "in I3Layout");
    }
    this.master = 0;
    print("I3Layout created");
};

I3Layout.prototype = new Layout();
I3Layout.prototype.constructor = I3Layout;

/*
 * Gets the tile at position x,y
 */
I3Layout.prototype.getTileAt = function(x, y) {
    try {
        for (var i = 0; i < this.tiles.length; i++) {
            var tile = this.tiles[i];
            if (tile.rectangle.x <= x
                && tile.rectangle.y <= y
                && tile.rectangle.x + tile.rectangle.width > x
                && tile.rectangle.y + tile.rectangle.height > y) {
                return tile;
            }
        }
        return null;
    } catch(err) {
        print(err, "in I3Layout._getTileAt");
    }
};

I3Layout.prototype.addTile = function(x, y) {
    try {

        print("I3Layout: Request new tile at ("+x+","+y+")");

        //print("ADDING NEW TILE")
        //print("TREE BEFORE:")
        //print(JSON.stringify(this.containerTree));

        var selectedContainer = this.containerTree; // The container at x,y
        var childIndex = this.tiles.length; // The index of the desired tile in the container

        if (x && y) {
            var focusedTile = this.getTileAt(x,y);
            if (focusedTile) {
                selectedContainer = this.containerTree.findParentContainer(focusedTile);
                print('Focused Container ('+x+','+y+'): '+JSON.stringify(selectedContainer));
                childIndex = selectedContainer.children.indexOf(focusedTile) + 1;
                print('Desired child: ' + childIndex);

            }
        }

        // XXX: Hack. We trick the containerTree into computing the rectangle position
        //      before we create the tile using a LeafNode dummy value, which is then replaced
        var leaf = new LeafNode();
        selectedContainer.addNode(leaf, childIndex);
        this._createTile(this.containerTree.rectangle);
        var tile = this.tiles[this.tiles.length - 1];
        tile.rectangle = leaf.rectangle;
        selectedContainer.children[childIndex] = tile;

        //print("TREE AFTER:")
        //print(JSON.stringify(this.containerTree));
        //print("END")

    } catch(err) {
        print(err, "in I3Layout.addTile");
    }
};

I3Layout.prototype.removeTile = function(tileIndex) {
    try {
        //print("REMOVING TILE")
        //print("TREE BEFORE:")
        //print(JSON.stringify(this.containerTree));

        // Remove the array entry
        var toDeleteTile = this.tiles[tileIndex];
        var container = this.containerTree.findParentContainer(toDeleteTile);

        container.removeNode(toDeleteTile);
        this.tiles.splice(tileIndex, 1);

        //print("TREE AFTER:")
        //print(JSON.stringify(this.containerTree));
        //print("END")

    } catch(err) {
        print(err, "in I3Layout.removeTile");
    }
};
