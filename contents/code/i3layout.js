
/********************************************************************
 KWin - the KDE window manager
 This file is part of the KDE project.

Copyright (C) 2018-2018 Setzer22 <jsanchezfsms@gmail.com>
based on bladelayout.js by Fabian Homborg

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

        /* The current state.
           pseudo-enum: 'normal', 'horizontalWrap', 'verticalWrap'
           */
        this.state = 'normal';

    } catch(err) {
        print(err, "in I3Layout");
    }
    this.master = 0;
    print("I3Layout created");
};

I3Layout.prototype = new Layout();
I3Layout.prototype.constructor = I3Layout;

I3Layout.prototype.name = "I3";

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
        // Determine the reference container
        var selectedContainer = this.containerTree;
        var selectedTile = null;
        var childIndex = this.tiles.length;
        if (x && y) {
            selectedTile = this.getTileAt(x,y);
            if (selectedTile) {
                selectedContainer = this.containerTree.findParentContainer(selectedTile);
                childIndex = selectedContainer.children.indexOf(selectedTile) + 1;
            }
        }

        // We ignore and reset the wrap state if there is no selected tile.
        if (!selectedTile) this.state = 'normal';

        // Also ignore attempts to wrap a container inside a container
        if (selectedContainer && this.state !== 'normal' && selectedContainer.children.length <= 1) {
            if (selectedContainer === this.containerTree) {
                this.containerTree.type = (this.state === 'horizontalWrap' ? 'horizontal' : 'vertical');
            }
            this.state = 'normal';
        }

        /*
          //NOTE: I'll leave this here just in case someone wants to enable it.

          // Don't want to wrap if the currently selected container is already in the same direction
          if (selectedContainer && ((this.state === 'verticalWrap' && selectedContainer.type === 'vertical') ||
                                  (this.state === 'horizontalWrap' && selectedContainer.type === 'horizontal'))) {
              this.state = 'normal';
          }
        */

        // update all container sizes according to their children's sizes
        this.containerTree.updateContainerSizes();

        // Create the new tile
        // TODO: Cleanup: Common parts in both if branches
        if (this.state === 'normal') {
            // Normal mode: Append to selectedContainer
            var leaf = new LeafNode();
            selectedContainer.addNode(leaf, childIndex);
            this._createTile(leaf.rectangle);
            var tile = this.tiles[this.tiles.length - 1];
            selectedContainer.children[childIndex] = tile;
            selectedContainer.recalculateSize();
        }
        else if (this.state === 'horizontalWrap' ||
                   this.state === 'verticalWrap') {

            // Wrap mode: wrap selected tile in a new container and append new tile there
            var wrapContainer = new ContainerNode(this.state === 'horizontalWrap' ? 'horizontal' : 'vertical',util.copyRect(selectedTile.rectangle));
            selectedContainer.addNode(wrapContainer, childIndex);
            selectedContainer.removeNode(selectedTile);
            wrapContainer.addNode(selectedTile, 0);

            var leaf = new LeafNode();
            wrapContainer.addNode(leaf, 1);
            this._createTile(leaf.rectangle);
            var tile = this.tiles[this.tiles.length - 1];
            wrapContainer.children[1] = tile;
            wrapContainer.recalculateSize();
        }

        this.state = 'normal';

        // print(debugPrintTree(this.containerTree));

    } catch(err) {
        print(err, "in I3Layout.addTile");
    }
};

function debugPrintTree(node) {
    var out = "";
    out += "(" + node.type + " ";
    node.children.forEach(function(child) {
        if (child.children) out += debugPrintTree(child);
        else out += " [] ";
    });
    out += ") ";

    return out;
}

I3Layout.prototype.removeTile = function(tileIndex) {
    try {
        var toDeleteTile = this.tiles[tileIndex];
        var container = this.containerTree.findParentContainer(toDeleteTile);

        this.containerTree.updateContainerSizes();
        container.removeNode(toDeleteTile);
        this.tiles.splice(tileIndex, 1);
        container.recalculateSize();

        this.containerTree.cleanup();

        print(debugPrintTree(this.containerTree));

    } catch(err) {
        print(err, "in I3Layout.removeTile");
    }
};
