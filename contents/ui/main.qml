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

import QtQuick 1.1;
import org.kde.plasma.core 0.1 as PlasmaCore;
import org.kde.plasma.components 0.1 as Plasma;
import org.kde.qtextracomponents 0.1 as QtExtra;
import org.kde.kwin 0.1;
import "../code/tilingmanager.js" as Tiling

Item {
    Component.onCompleted: {
        // Initialize tiling
        tiling = new Tiling.TilingManager();
    }

}
