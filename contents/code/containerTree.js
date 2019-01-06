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
 * Update sizes for this container and all children-containers as a bottom-up operation
 */
ContainerNode.prototype.updateContainerSizes = function() {

    this.children.forEach(function (child) {
        if (child.children) child.updateContainerSizes();
    });

    if (this.children[0]) {
        var rect = this.children[0].rectangle;
        this.children.forEach(function (child) {
            rect = util.expandRect(rect, child.rectangle);
        });
        this.rectangle = util.copyRect(rect);
    }
};

/*
 * Resize this node and its children as a top-down operation
 * Keep size ratio of children
 */
ContainerNode.prototype.resizeNode = function(rectAfter) {

    var rectBefore = this.rectangle;
    this.rectangle = util.copyRect(rectAfter);
    var childrenLength = this.children.length;


    if (this.type === 'horizontal') {

        var totalWidth = 0;
        var newWidth = 0;

        this.children.forEach(function(child, index) {
            var newRect = Qt.rect(0, 0, 0, 0);
            if (index === childrenLength - 1) {
                newWidth = Math.floor(rectAfter.width - totalWidth);
            } else {
                newWidth = Math.floor((child.rectangle.width / rectBefore.width) * rectAfter.width);
            }

            newRect.x = rectAfter.x + totalWidth;
            newRect.y = rectAfter.y;
            newRect.width = newWidth;
            newRect.height = rectAfter.height;
            totalWidth += newWidth;
            if(child.children) child.resizeNode(util.copyRect(newRect));
            else child.rectangle = util.copyRect(newRect);
        });

    } else if (this.type === 'vertical') {

        var totalHeight = 0;
        var newHeight = 0;

        this.children.forEach(function(child, index) {
            var newRect = Qt.rect(0, 0, 0, 0);
            if (index === childrenLength - 1) {
                newHeight = Math.floor(rectAfter.height - totalHeight);
            } else {
                newHeight = Math.floor((child.rectangle.height / rectBefore.height) * rectAfter.height);
            }

            newRect.x = rectAfter.x;
            newRect.y = rectAfter.y + totalHeight;
            newRect.width = rectAfter.width;
            newRect.height = newHeight;
            totalHeight += newHeight;
            if(child.children) child.resizeNode(util.copyRect(newRect));
            else child.rectangle = util.copyRect(newRect);
        });
    }
};

/*
 * Recalculate sizes for this nodes children as a top-down operation
 * give all children the same size
 */
ContainerNode.prototype.recalculateSize = function() {

    var rectBefore = this.rectangle;
    var childrenLength = this.children.length;


    if (this.type === 'horizontal') {

        var totalWidth = 0;
        var newWidth = 0;

        this.children.forEach(function(child, index) {
            var newRect = Qt.rect(0, 0, 0, 0);
            if (index === childrenLength - 1) {
                newWidth = Math.floor(rectBefore.width - totalWidth);
            } else {
                newWidth = Math.floor(rectBefore.width / childrenLength);
            }

            newRect.x = rectBefore.x + totalWidth;
            newRect.y = rectBefore.y;
            newRect.width = newWidth;
            newRect.height = rectBefore.height;
            totalWidth += newWidth;
            if(child.children) child.resizeNode(util.copyRect(newRect));
            else child.rectangle = util.copyRect(newRect);
        });

    } else if (this.type === 'vertical') {

        var totalHeight = 0;
        var newHeight = 0;

        this.children.forEach(function(child, index) {
            var newRect = Qt.rect(0, 0, 0, 0);
            if (index === childrenLength - 1) {
                newHeight = Math.floor(rectBefore.height - totalHeight);
            } else {
                newHeight = Math.floor(rectBefore.height / childrenLength);
            }

            newRect.x = rectBefore.x;
            newRect.y = rectBefore.y + totalHeight;
            newRect.width = rectBefore.width;
            newRect.height = newHeight;
            totalHeight += newHeight;
            if(child.children) child.resizeNode(util.copyRect(newRect));
            else child.rectangle = util.copyRect(newRect);
        });
    }
};

/*
 * Inserts a new node into the ContanierNode at the specified index position
 */
ContainerNode.prototype.addNode = function(node, index) {
    this.children.splice(index, 0, node);
    node.parent = this;
};

/*
 * Removes the node from the container node
 * @pre the node must be a direct child of the container node.
 */
ContainerNode.prototype.removeNode = function(node) {
    this.children = this.children.filter(function (x) {return x !== node;});
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
