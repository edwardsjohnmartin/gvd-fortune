// Helper functions for insertion operations

function isLeftHull(sLower, sUpper) {
  if (sLower.type !== "segment" || sUpper.type !== "segment")
    throw "Invalid hull compare";
  var a = sUpper.a;
  var o = sLower.a;
  var b = sLower.b;
  var v0 = vec3(a[0] - o[0], a[1] - o[1], 0);
  var v1 = vec3(b[0] - o[0], b[1] - o[1], 0);
  return cross(v0, v1)[2] < 0;
}

function isClosing(child, p) {
  if (p.type !== "vec") throw "Invalid close test";

  var rn = child.nextArc();
  var ln = child.prevArc();

  if (!rn || !ln) {
    return null;
  }

  var r = rn.site;
  var c = child.site;
  var l = ln.site;

  /* cases:
  1. l and c are segments and end at p
  2. c and r are segments and end at p
  2. l and r are segments and end at p
  */

  if (c.type === "segment" && r.type === "segment") {
    if (fastFloorEqual(r.b, p) && fastFloorEqual(c.b, p)) return {closeRight: true};
  }

  if (l.type === "segment" && c.type === "segment") {
    if (fastFloorEqual(l.b, p) && fastFloorEqual(c.b, p)) return {closeLeft: true};
  }

  // maybe is needed in the future
  // if (l.type === "segment" && r.type === "segment") {
  //   if (fastFloorEqual(l.b, p) && fastFloorEqual(r.b, p)) return true;
  // }
}

// function to create an edge node
function createNewEdge(left, right, vertex, dcel) {
  if (left.closeEvent) {
    left.closeEvent.live = false;
  }
  if (right.closeEvent) {
    right.closeEvent.live = false;
  }

  return new EdgeNode(left, right, vertex, dcel);
}

//------------------------------------------------------------
// Utility function right joint split
//  is an arc node. node is also an arc node.
//   \  |
//    \ |
//     \| node
//      *
//------------------------------------------------------------
function closePointSplit(left, right, dcel) {
  if (left.isV && right.isParabola) {
    return new EdgeNode(left, right, right.site, dcel);
  } else if (left.isParabola && right.isV) {
    return new EdgeNode(left, right, left.site, dcel);
  } else {
    throw 'invalid close joint split';
  }
}

//------------------------------------------------------------
// Utility function
// toSplit is an arc node. node is also an arc node.
//
//  |        | toSplit
//   \      /
//    |    ||
//     \__/ |
//          |
//          | node
//          *
//------------------------------------------------------------
function splitArcNode(toSplit, node, dcel, nodesToClose) {
  if (toSplit.closeEvent) {
    toSplit.closeEvent.live = false;
  }
  var vertex;
  if (node.isV) {
    vertex = node.site.a;
  } else {
    var x = node.site[0];
    var y;
    if (toSplit.isParabola) {
      // avoid p==0 WATCH VALUE
      var directrix = toSplit.site[1] === node.site[1] ? node.site[1] - 1e-10: node.site[1];
      y = createParabola(toSplit.site, directrix, toSplit.id).f(x);
    } else {
      y = new V(toSplit.site, node.site[1], toSplit.id).f(x);
    }
    vertex = vec3(x, y, 0);
  }
  var left = toSplit;
  var right = new ArcNode(toSplit.site);
  nodesToClose.push({node:left, keepRight:false, point:vertex});
  nodesToClose.push({node:right, keepRight:true, point:vertex});
  return new EdgeNode(
      left, new EdgeNode(node, right, vertex, dcel), vertex, dcel);
}

function insertEdge(toSplit, edge, vertex, dcel, optNodesToClose) {
  if (toSplit.closeEvent) {
    toSplit.closeEvent.live = false;
  }

  var left = toSplit;
  var right = new ArcNode(toSplit.site);

  if (optNodesToClose) {
    optNodesToClose.push({node:left, keepRight:false, point:vertex});
    optNodesToClose.push({node:right, keepRight:true, point:vertex});
  }
  return new EdgeNode(
      left, new EdgeNode(edge, right, vertex, dcel), vertex, dcel);
}

// Child is guaranteed to be the parabola arc
function VRegularInsert(arcNode, childArcNode, dcel, parentV) {
  var left = isLeftHull(childArcNode.site, parentV.site);
  if (left) {
    // // Set edge information since we are using a left joint split
    var nextEdge = arcNode.nextEdge();
    if (nextEdge) nextEdge.dcelEdge.generalEdge = false;
    return createNewEdge(arcNode, childArcNode, childArcNode.site.a, dcel);
  } else {
    // // Set edge information since we are using a right joint split
    var prevEdge = arcNode.prevEdge();
    if (prevEdge) prevEdge.dcelEdge.generalEdge = false;
    // is a arc created by the right hull joint
    return createNewEdge(childArcNode, arcNode, childArcNode.site.a, dcel);
  }
}

function ParaInsert(child, arcNode, dcel, nodesToClose) {
  var newChild;

  var closingData = isClosing(child, arcNode.site);

  if (closingData) {
    if (!child.isV) throw "Invalid node insertion";
    // var sRight = child.nextArc();
    var edgeToUpdate = child.prevEdge();
    if (closingData.closeRight) {
      edgeToUpdate = child.nextEdge();
    }
    if (edgeToUpdate) {
      edgeToUpdate.dcelEdge.dest.overridden = true;
      edgeToUpdate.dcelEdge.dest.point = arcNode.site;
    }
    if (closingData.closeRight) {
      nodesToClose.push({node:child, keepRight:false, point:arcNode.site});
      // nodesToClose.push(child.nextArc());
      nodesToClose.push({node:child.nextArc(), keepRight:true, point:arcNode.site});
      newChild = closePointSplit(child, arcNode, dcel);
    } else {
      nodesToClose.push({node:child, keepRight:true, point:arcNode.site});
      // nodesToClose.push(child.prevArc());
      nodesToClose.push({node:child.prevArc(), keepRight:false, point:arcNode.site});
      newChild = closePointSplit(arcNode, child, dcel);
    }
  } else {
    // regular split
    newChild = splitArcNode(child, arcNode, dcel, nodesToClose);
  }
  return newChild;
}

function generateSubTree(eventPacket, arcNode, dcel, optChild) {
  var tree;
  var nodesToClose = [];
  if (eventPacket.type === PACKET_TYPE.MULTI_CHILD_PARENT) {
    leftArcNode = new ArcNode(eventPacket.leftChild);
    rightArcNode = new ArcNode(eventPacket.rightChild);
    var newEdge = createNewEdge(
        leftArcNode, rightArcNode, arcNode.site, dcel);
    if (optChild) {
      tree = splitArcNode(optChild, arcNode, dcel, nodesToClose);
      var parent = arcNode.parent;
      var childEdge =
          insertEdge(arcNode, newEdge, arcNode.site, dcel, nodesToClose);
      parent.setChild(childEdge, LEFT_CHILD);
    }
    else {
      tree = insertEdge(arcNode, newEdge, arcNode.site, dcel);
    }
  } else if (eventPacket.type === PACKET_TYPE.PARENT) {
    if (optChild && optChild.isV && fastFloorEqual(eventPacket.site, optChild.site.b)) {
      // if (!optChild.isV) throw 'Invalid insert operation';
      var childArcNode = new ArcNode(eventPacket.child);
      tree = splitArcNode(optChild, arcNode, dcel, nodesToClose);
      var parent = arcNode.parent;
      var newEdge = VRegularInsert(arcNode, childArcNode, dcel, optChild);
      parent.setChild(newEdge, LEFT_CHILD);
    } else if (optChild) {
      tree = splitArcNode(optChild, arcNode, dcel, nodesToClose);
      var parent = arcNode.parent;
      var childArcNode = new ArcNode(eventPacket.child);
      var newEdge = splitArcNode(arcNode, childArcNode, dcel, nodesToClose);
      parent.setChild(newEdge, LEFT_CHILD);
    } else {
      // case where site is the root
      var childArcNode = new ArcNode(eventPacket.child);
      tree = splitArcNode(arcNode, childArcNode, dcel, nodesToClose);
    }
  } else {
    if (optChild) {
      tree = ParaInsert(optChild, arcNode, dcel, nodesToClose);
    } else {
      tree = arcNode;
    }
  }

  return {root: tree, closingNodes: nodesToClose};
}
