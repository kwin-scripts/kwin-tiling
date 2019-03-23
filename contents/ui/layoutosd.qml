/********************************************************************
 KWin - the KDE window manager
 This file is part of the KDE project.

Copyright (C) 2012, 2013 Martin Gräßlin <mgraesslin@kde.org>
Copyright (C) 2019 David Strobach <lalochcz@gmail.com>

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
import QtQuick 2.0;
import QtQuick.Window 2.0;
import QtQuick.Layouts 1.12;
import org.kde.plasma.core 2.0 as PlasmaCore;
import org.kde.plasma.extras 2.0 as PlasmaExtras
import org.kde.plasma.components 2.0 as Plasma;
import org.kde.kquickcontrolsaddons 2.0 as KQuickControlsAddons;
import org.kde.kwin 2.0;

PlasmaCore.Dialog {
    id: dialog
    location: PlasmaCore.Types.Floating
    visible: false
    flags: Qt.X11BypassWindowManagerHint | Qt.FramelessWindowHint
    outputOnly: true
    property variant tiling

    mainItem: Item {
        function loadConfig() {
            dialogItem.animationDuration = KWin.readConfig("PopupHideDelay", 1000);
        }

        function show(text) {
            timer.stop();
            textElement.text = text;
            var screen = workspace.clientArea(KWin.FullScreenArea, workspace.activeScreen, workspace.currentDesktop);
            dialog.visible = true;
            dialog.x = screen.x + screen.width/2 - dialogItem.width/2;
            dialog.y = screen.y + screen.height/2 - dialogItem.height/2;
            timer.start();
        }

        id: dialogItem
        property int animationDuration: 1000

        width: Math.ceil(layout.implicitWidth)
        height: textElement.height

        RowLayout {
            id: layout
            anchors.fill: parent
            spacing: 10

            PlasmaExtras.Heading {
                id: textElement
                horizontalAlignment: Text.AlignHCenter
                wrapMode: Text.NoWrap
                elide: Text.ElideRight
            }
            PlasmaExtras.Heading {
                id: label
                horizontalAlignment: Text.AlignHCenter
                wrapMode: Text.NoWrap
                elide: Text.ElideRight
                text: "Layout"
            }
        }

        Timer {
            id: timer
            repeat: false
            interval: dialogItem.animationDuration
            onTriggered: dialog.visible = false
        }

        Connections {
            target: options
            onConfigChanged: dialogItem.loadConfig()
        }
        Component.onCompleted: {
            dialogItem.loadConfig();
        }
    }

    Component.onCompleted: {
        tiling.layoutChanged.connect(function(layout) {
            if (KWin.readConfig("showLayoutOsd", true)) {
                dialogItem.show(layout.name);
            }
        });
        KWin.registerWindow(dialog);
    }
}