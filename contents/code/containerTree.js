/********************************************************************
 KWin - the KDE window manager
 This file is part of the KDE project.

Copyright (C) 2018-2018 Setzer22 <jsanchezfsms@gmail.com>

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
 * This data structure represents a tile tree with horizontal and vertical layouts.
 * the tree is responsible for recomputing tile sizes when adding/removing nodes and
 * also implements a cleanup function to ensure the tree shape is always consistent and
 * intuitive to the user (e.g. don't allow nested containers with a single child). The
 * tree is meant to store two kinds of nodes, `ContainerNode`s and tiles (the ones from
 * i3layout.tiles). However, a third node type, LeafNode is implemented as a placeholder
 * to allocate new tiles when they are created.
 */
function ContainerNode(type, rect) {
    try {
        this.type = type;
        this.rectangle = rect || {};
        this.children = [];
        this.parent = null;

    } catch(err) {
        print(err, "in ContainerNode");
    }
}

/*
 * Recalculate sizes for this node as a top-down operation
 */
ContainerNode.prototype.recalculateSize = function() {

    var r = this.rectangle;

    if (this.type === 'horizontal') {
        var newWidth = r.width / this.children.length;

        this.children.forEach(function(child, index) {
            child.rectangle.x = r.x + index*newWidth;
            child.rectangle.y = r.y;
            child.rectangle.width = newWidth;
            child.rectangle.height = r.height;
            if (child.children) child.recalculateSize();

        });

    } else if (this.type === 'vertical') {
        var newHeight = r.height / this.children.length;

        this.children.forEach(function(child, index) {
            child.rectangle.x = r.x;
            child.rectangle.y = r.y + index*newHeight;
            child.rectangle.width = r.width;
            child.rectangle.height = newHeight;
            if (child.children) child.recalculateSize();
        });
    }

};

/*
 * Inserts a new node into the ContanierNode at the specified index position
 */
ContainerNode.prototype.addNode = function(node, index) {
    this.children.splice(index, 0, node);
    node.parent = this;
    this.recalculateSize();
};

/*
 * Removes the node from the container node
 * @pre the node must be a direct child of the container node.
 */
ContainerNode.prototype.removeNode = function(node) {
    this.children = this.children.filter(function (x) {return x !== node;});
    this.recalculateSize();
};

/*
 * Prunes empty containers and un-wraps single-child containers
 * NOTE: This code could probably be simplified, but it works.
 */
ContainerNode.prototype.cleanup = function(node) {
    // Defer node deletion so we don't delete during loop
    var nodesToRemove = [];

    // Cleanup is bottom-up, not top-down
    for (var c = 0; c < this.children.length; ++c) {
        if (this.children[c].children) {
            this.children[c].cleanup();
        }
    }


    if (this.children && this.children.length == 1 && this.children[0].children) {
        this.type = this.children[0].type;
        this.rectangle = this.children[0].rectangle;
        this.children = this.children[0].children;
    }

    for (var c = 0; c < this.children.length; ++c) {
        if (this.children[c].children) {
            if (this.children[c].children.length == 1) {
                var grandchild = this.children[c].children[0];
                this.children[c] = grandchild;
            } else if (this.children[c].children.length == 0) {
                nodesToRemove.push(this.children[c]);
            }
        }
    }

    nodesToRemove.forEach(function(nodeToRemove) {
        this.removeNode(nodeToRemove);
    });
};

/*
 * Search operation on the tree that will recursively locate for a leaf node
 * and return its parent container.
 */
ContainerNode.prototype.findParentContainer = function(leafNode) {
    var found = null;

    for (var c = 0; c < this.children.length; c++) {
        var child = this.children[c];

        if (child.children ) {
            var foundInChild = child.findParentContainer(leafNode);
            if (foundInChild) return foundInChild;
        } else if (child === leafNode) {
            return this;
        }

    }
    return null;
};

/*
 * Placeholder class. See description of ContainerNode
 */
function LeafNode() {
    try {
        this.rectangle = {};
    } catch(err) {
        print(err, "in LeafNode");
    }
}
