
// PACKET TYPE
var PACKET_TYPE = {
  MULTI_CHILD_PARENT: 1,
  PARENT: 2,
  CHILD: 3,
}

//------------------------------------------------------------
// Beachline
//------------------------------------------------------------

// Logic in the remove method depends on these two values
// being 0 and 1.
const LEFT_CHILD = 0;
const RIGHT_CHILD = 1;
const UNDEFINED_SIDE = 2;


var Beachline = function (dcel) {
  this.root = null;
  this.dcel = dcel;
}

//------------------------------------------------------------
// Utility functions
//

function createBeachlineSegment(site, directrix, id) {
  if (isSegment(site)) {
    // TODO performance
    return new V(site, directrix, id);
  }
  return createParabola(site, directrix, id);
}

// function shareVClosing(arcNode, sibling) {
//   if (!arcNode.isV || !sibling.isV) return false;
//   return fastFloorEqual(arcNode.site.b, sibling.site.b);
//   // return _.get(arcNode, "site.b.relation") == NODE_RELATION.CLOSING &&
//   // _.get(sibling, "site.b.relation") == NODE_RELATION.CLOSING &&
//   // fastFloorEqual(arcNode.site.b, sibling.site.b);
// }

//------------------------------------------------------------
// add
//------------------------------------------------------------
Beachline.prototype.add = function (eventPacket) {
  var arcNode = new ArcNode(eventPacket.site);
  var directrix = eventPacket.site[1];

  // debugging only
  // if (arcNode.id === g_debugIdMiddle) {
  //   g_addDebug = true;
  // } else {
  //   g_addDebug = false;
  // }

  if (this.root == null) {
    var subTreeData = generateSubTree(eventPacket, arcNode, this.dcel);
    this.root = subTreeData.root;
    return [];
  }

  var parent = this.root;
  var side, child;

  if (this.root.isArc) {
    child = this.root;
    var subTreeData = generateSubTree(eventPacket, arcNode, dcel, child);
    this.root = subTreeData.root;
    // if (subTreeData.optRemoveNode) {
    //   var newEvents = this.remove(subTreeData.optRemoveNode, subTreeData.optRemovePoint, directrix);
    //   return newEvents.concat(processCloseEvents(subTreeData.closingNodes, directrix));
    // }
    return processCloseEvents(subTreeData.closingNodes, directrix);
  }

  // Do a binary search to find the arc node that the new
  // site intersects with
  var aStart = performance.now();
  var x = parent.intersection(directrix)[0];
  side = (eventPacket.site[0] < x) ? LEFT_CHILD : RIGHT_CHILD;
  child = parent.getChild(side);
  while (child.isEdge) {
    parent = child;
    var i = parent.intersection(directrix);
    if (!i) {
      throw "Invalid intersection on 'Add'";
    } else {
      x = i[0];
    }
    // if (eventPacket.site[0] == x) {
    //   console.log("Site and intersect values equal:" + x + " for intersection: " + parent.id);
    // }
    side = (eventPacket.site[0] < x) ? LEFT_CHILD : RIGHT_CHILD;
    child = parent.getChild(side);
  }

  var subTreeData = generateSubTree(eventPacket, arcNode, dcel, child);
  parent.setChild(subTreeData.root, side);
  var aEnd = performance.now();
  g_addTime += aEnd - aStart;

  // if (subTreeData.optRemoveNode) {
  //   var newEvents = this.remove(subTreeData.optRemoveNode, subTreeData.optRemovePoint, directrix);
  //   return newEvents.concat(processCloseEvents(subTreeData.closingNodes, directrix));
  // }
  var cStart = performance.now();
  var ret =  processCloseEvents(subTreeData.closingNodes, directrix);
  var cEnd = performance.now();
  g_vertexProcessing += cEnd - cStart;
  return ret;
}

//------------------------------------------------------------
// remove
//------------------------------------------------------------
Beachline.prototype.remove = function (arcNode, point, directrix, endingEdges, radius) {
  if (!arcNode.isArc) throw "Unexpected edge in remove";

  // debugging only
  // if (arcNode.id === g_debugIdMiddle) {
  //   g_addDebug = true;
  // } else {
  //   g_addDebug = false;
  // }

  var parent = arcNode.parent;
  var grandparent = parent.parent;
  var side = (parent.left == arcNode) ? LEFT_CHILD : RIGHT_CHILD;
  var parentSide = (grandparent.left == parent) ? LEFT_CHILD : RIGHT_CHILD;

  // Get newEdge (an EdgeNode) before updating children etc.
  var newEdge = arcNode.nextEdge();
  if (side == LEFT_CHILD) {
    newEdge = arcNode.prevEdge();
  }

  var sibling = parent.getChild(1 - side);
  grandparent.setChild(sibling, parentSide);
  sibling.parent = grandparent;

  newEdge.updateEdge(point, this.dcel, [], endingEdges, radius);
  if(arcNode.closeEvent)
    arcNode.closeEvent.live = false;

  // Cancel the close event for this arc and adjoining arcs.
  // Add new close events for adjoining arcs.
  var cStart = performance.now();

  var closeEvents = [];
  var prevArc = newEdge.prevArc();
  if (prevArc.closeEvent) {
    prevArc.closeEvent.live = false;
  }
  var e = createCloseEvent(prevArc, directrix, {keepRight:false, point:point});
  if (e != null) {
    closeEvents.push(e);
  }
  var nextArc = newEdge.nextArc();
  if (nextArc.closeEvent) {
    nextArc.closeEvent.live = false;
  }
  var e = createCloseEvent(nextArc, directrix, {keepRight:true, point:point});
  if (e != null) {
    closeEvents.push(e);
  }
  var cEnd = performance.now();
  g_vertexProcessing += cEnd - cStart;

  return closeEvents;
}

//------------------------------------------------------------
// render
//------------------------------------------------------------

// Sets points on arc elements ready for drawing using whatever
// method. Also gets events and active surface lines and parabolas.
Beachline.prototype.prepDraw = function (
  directrix, node, leftx, rightx, arcElements, lines, generalSurfaces, events) {
  if (node.isArc) {
    arcElements.push(node.createDrawElement(leftx, rightx, directrix));
  } else {
    // The point where this edge node was born
    var origin = node.dcelEdge.origin.point;
    // The intersection between the edge node's defining arc nodes
    var p = node.intersection(directrix);

    if (p[0] < leftx && Math.abs(leftx - p[0]) > 0.00001) {
      let msg = `intersection is less than leftx: ${p[0]} < ${leftx}.` +
        ` id = ${node.id}`;
      console.error(msg);
    }

    if (!Number.isNaN(origin[0]) && !Number.isNaN(origin[1])) {
      events.push(origin);
    }

    if (!Number.isNaN(origin[0]) && !Number.isNaN(origin[1]) &&
      !Number.isNaN(p[0]) && !Number.isNaN(p[1])) {
      if (node.isGeneralSurface) {
        var point;
        var segment;
        var next = node.nextArc();
        var prev = node.prevArc();
        if (prev.isV && next.isParabola) {
          segment = prev.site;
          point = next.site;
        } else if (prev.isParabola && next.isV) {
          point = prev.site;
          segment = next.site;
        } else {
          throw "Error edge node marked as general surface but is not between a V and parabola";
        }

        if (!belongsToSegment(node.prevArc(), node.nextArc())) {
          var gp = createGeneralParabola(point, segment);
          var idStr = next.id.toString() + "-" + prev.id.toString();
          // console.log("ID: " + idStr + " origin:" + origin + " - dest:" + p);
          gp.prepDraw(idStr, origin, p);
          generalSurfaces.push(gp);
        } else {
          lines.push({ x0: point[0], y0: point[1], x1: p[0], y1: p[1], id: node.id, connectedToGVD: node.connectedToGVD });
        }
      } else {
        lines.push({ x0: origin[0], y0: origin[1], x1: p[0], y1: p[1], id: node.id, connectedToGVD: node.connectedToGVD });
      }
    }

    this.prepDraw(directrix, node.left, leftx, p[0], arcElements, lines, generalSurfaces, events);
    if (p[0] < rightx) {
      // We can ignore anything outside our original bounds.
      this.prepDraw(directrix, node.right, p[0], rightx, arcElements, lines, generalSurfaces, events);
    }
  }
}
