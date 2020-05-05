//---------------------------------------------------------------------------
// ArcNode
//---------------------------------------------------------------------------

var nodeId = 0;

var ArcNode = function (site) {
  this.site = site;
  this.isArc = true;
  this.isEdge = false;
  this.isParabola = !isSegment(site);
  this.isV = isSegment(site);
  this.side = UNDEFINED_SIDE;
  // define arc boundaries
  this.id = nodeId++;
}

ArcNode.prototype.toString = function () {
  return `Type: arc - ${this.isParabola ? "parabola" : "v"}<br>` +
    `Site: (${this.site.toString()})`
    ;
}

ArcNode.prototype.createDrawElement = function (leftx, rightx, directrix) {
  let element = null;
  if (this.isParabola) {
    let para = createParabola(this.site, directrix, this.id);
    para.prepDraw(this.id, this.site.label, leftx, rightx);
    element = para;
    element.type = "parabola";
  } else if (this.isV) {
    var v = new V(this.site, directrix, this.id);
    v.prepDraw(this.id, this.site.label, leftx, rightx);
    element = v;
    element.type = "v";
  }
  return element;
}

//------------------------------------------------------------
// prevEdge
// Returns the previous in-order edge arcNode. Find the first
// ancestor to the left.
//------------------------------------------------------------
ArcNode.prototype.prevEdge = function () {
  var node = this;
  while (node.parent != null && node.parent.left == node) {
    node = node.parent;
  }
  return node.parent;
}

function belongsToSegment(A, B) {
  if (A == null || B == null) return false;
  if (A.site.type == "segment" && B.site.type == "vec") {
    return A.site.a == B.site || A.site.b == B.site;
  } else if (B.site.type == "segment" && A.site.type == "vec") {
    return B.site.a == A.site || B.site.b == A.site;
  }
  return false;
}

function belongsToSegmentEndpoint(A, B) {
  if (A == null || B == null) return false;
  if (A.site.type == "segment" && B.site.type == "vec") {
    return A.site.b == B.site;
  } else if (B.site.type == "segment" && A.site.type == "vec") {
    return B.site.b == A.site;
  }
  return false;
}

function consolidate(intersections, pivotX) {
  var ret = [];
  // WATCH VALUE
  var thresh = 0.000001;
  var left = _.filter(intersections, function(i) {
    return i[0] < pivotX;
  });
  var right = _.filter(intersections, function(i) {
    return i[0] > pivotX;
  });
  if (left.length === 2) {
    var d = dist(left[0], left[1]);
    if (d < thresh) {
      ret.push(left[0]);
    } else {
      ret.push(left[0]);
      ret.push(left[1]);
    }
  } else if (left.length === 1) {
    ret.push(left[0]);
  }

  if (right.length === 2) {
    var d = dist(right[0], right[1]);
    if (d < thresh) {
      ret.push(right[0]);
    } else {
      ret.push(right[0]);
      ret.push(right[1]);
    }
  } else if (right.length === 1) {
    ret.push(right[0]);
  }
  return ret;
}

//------------------------------------------------------------
// prevArc
// Returns the previous in-order arc arcNode
//------------------------------------------------------------
ArcNode.prototype.prevArc = function () {
  var node = this.prevEdge();
  if (node == null) return null;
  return node.prevArc();
}

//------------------------------------------------------------
// nextEdge
// Returns the next in-order edge node. Find the first
// ancestor to the right.
//------------------------------------------------------------
ArcNode.prototype.nextEdge = function () {
  var node = this;
  while (node.parent != null && node.parent.right == node) {
    node = node.parent;
  }
  return node.parent;
}

//------------------------------------------------------------
// nextArc
// Returns the next in-order arc arcNode.
//------------------------------------------------------------
ArcNode.prototype.nextArc = function () {
  var node = this.nextEdge();
  if (node == null) return null;
  return node.nextArc();
}

//---------------------------------------------------------------------------
// EdgeNode
//---------------------------------------------------------------------------

//------------------------------------------------------------
// EdgeNode
// left and right are the left and right children nodes.
// left is always an ArcNode. Right may be an ArcNode or
// EdgeNode.
//------------------------------------------------------------
var EdgeNode = function (left, right, vertex, dcel) {
  this.isArc = false;
  this.isEdge = true;
  this.left = left;
  this.left.side = LEFT_CHILD;
  this.right = right;
  this.right.size = RIGHT_CHILD;
  var neighborEdges = _.filter([left, right], e => { return e.isEdge; });
  this.updateEdge(vertex, dcel, neighborEdges);

  left.parent = this;
  right.parent = this;

  this.toDot = function () {
    return "\"" + this.id + "\"";
  };
}

EdgeNode.prototype.hasId = function (id) {
  return this.id.includes(id.toString());
}

EdgeNode.prototype.toString = function () {
  return `Type: edge<br>`;
}

Object.defineProperty(EdgeNode.prototype, "id", {
  configurable: true,
  enumerable: true,
  get: function () {
    return this.prevArc().id + "-" + this.nextArc().id;
  },
});

Object.defineProperty(EdgeNode.prototype, "connectedToGVD", {
  configurable: true,
  enumerable: true,
  get: function () {
    return this.prevArc().site.label !== this.nextArc().site.label;
  },
});

Object.defineProperty(EdgeNode.prototype, "isGeneralSurface", {
  configurable: true,
  enumerable: true,
  get: function () {
    var left = this.prevArc();
    var right = this.nextArc();
    return left.isParabola && right.isV || left.isV && right.isParabola;
  },
});

EdgeNode.prototype.updateEdge = function (vertex, dcel, optNeighborEdges = [], optEndingEdges = []) {
  this.dcelEdge = dcel.makeEdge();
  this.dcelEdge.origin.point = vertex;
  if (optEndingEdges.length > 0) {

    // All of the nodes share a reference to the connectedEdges array
    if (optEndingEdges[1]) optEndingEdges[1].dest.connectedEdges = optEndingEdges[0].dest.connectedEdges;
    this.dcelEdge.origin.connectedEdges = optEndingEdges[0].dest.connectedEdges;
    this.dcelEdge.origin.point = vertex;
    var sharedEdges = this.dcelEdge.origin.connectedEdges;
    _.each(optEndingEdges, function (e) {
      sharedEdges[getEdgeId(e)] = e;
      e.dest.point = vertex;
      // set the edges origin with itself
      e.origin.connectedEdges[getEdgeId(e)] = e;
    });
  }
  var next = this.nextArc();
  var prev = this.prevArc();
  this.dcelEdge.a = prev.id;
  this.dcelEdge.siteA = prev.site;
  this.dcelEdge.b = next.id;
  this.dcelEdge.siteB = next.site;
  this.dcelEdge.splitSite = prev.site.label !== next.site.label;
  if (this.dcelEdge.splitSite && optNeighborEdges.length > 0 && optEndingEdges.length === 0) {
    var thisOVertex = this.dcelEdge.origin;
    var thisDVertex = this.dcelEdge.dest;
    var thisEdge = this.dcelEdge;
    _.each(optNeighborEdges, e => {
      var sharedEdges = {};
      sharedEdges[getEdgeId(e.dcelEdge)] = e.dcelEdge;
      sharedEdges[getEdgeId(thisEdge)] = thisEdge;
      var nPtO = e.dcelEdge.origin.point;
      var nPtD = e.dcelEdge.origin.dest;

      if (fastFloorEqual(nPtO, thisOVertex.point)) {
        e.dcelEdge.origin.connectedEdges = sharedEdges;
        thisOVertex.connectedEdges = sharedEdges;
      } else if (fastFloorEqual(nPtD, thisOVertex.point)) {
        e.dcelEdge.dest.connectedEdges = sharedEdges;
        thisOVertex.connectedEdges = sharedEdges;
      } else if (fastFloorEqual(nPtO, thisDVertex.point)) {
        e.dcelEdge.origin.connectedEdges = sharedEdges;
        thisDVertex.connectedEdges = sharedEdges;
      } else if (fastFloorEqual(nPtD, thisDVertex.point)) {
        e.dcelEdge.dest.connectedEdges = sharedEdges;
        thisDVertex.connectedEdges = sharedEdges;
      }
    });
  }
  this.dcelEdge.generalEdge = prev.isParabola && next.isV || prev.isV && next.isParabola
}

EdgeNode.prototype.prevArc = function () {
  var node = this;
  node = node.left;
  while (!node.isArc) {
    node = node.right;
  }
  return node;
}

EdgeNode.prototype.nextArc = function () {
  var node = this;
  node = node.right;
  while (!node.isArc) {
    node = node.left;
  }
  return node;
}

EdgeNode.prototype.getChild = function (side) {
  if (side == LEFT_CHILD) return this.left;
  return this.right;
}

EdgeNode.prototype.setChild = function (node, side) {
  if (side == LEFT_CHILD) {
    node.side = LEFT_CHILD;
    this.left = node;
  } else {
    node.side = RIGHT_CHILD;
    this.right = node;
  }
  node.parent = this;
}

// Finds the intersection between the left and right arcs.
EdgeNode.prototype.intersection = function (directrix) {
  // This is inefficient. We should be storing sites in edge nodes.
  let leftArcNode = this.prevArc();
  let rightArcNode = this.nextArc();

  // debugging only
  if (leftArcNode.id === g_debugIdLeft && rightArcNode.id === g_debugIdRight) {
    g_addDebug = true;
  } else {
    g_addDebug = false;
  }

  var obj = {};
  if (leftArcNode.isV && rightArcNode.isV) {
    obj = intersectStraightArcs(leftArcNode, rightArcNode, directrix);
  } else if (leftArcNode.isV || rightArcNode.isV) {
    obj = intersectParabolicToStraightArc(leftArcNode, rightArcNode, directrix);
  } else {
    obj = intersectParabolicArcs(leftArcNode, rightArcNode, directrix);
  }
  if (!obj) {
    console.error("Invalid intersection between arc node:" + leftArcNode.id + " and node:" + rightArcNode.id);
    return null;
  }
  this.intersections = obj.results;
  this.selectedIntersection =  obj.results[obj.resultIdx];
  return obj.results[obj.resultIdx];
};

function neighborSites(edge) {
  if (!edge.isEdge) return false;
  var prev = edge.prevArc();
  var next = edge.nextArc();
  if (!prev || !next) return false;

  return belongsToSegment(prev, next);
}

// Does not support horizontal arcs
function intersectStraightArcs(left, right, directrix){
  let pleft = createBeachlineSegment(left.site, directrix, left.id);
  let pright = createBeachlineSegment(right.site, directrix, right.id);
  let intersections = pleft.intersect(pright);
  if (intersections.length == 0 || !intersections[0]) {
    // console.log("number of intersections is 0 between node id: " + left.id + " and node: " + right.id);
    return null;
  }

  if (intersections.length == 1) {
    return {
      results: intersections,
      resultIdx: 0
    };
  }

  if (intersections.length > 2) {
    // get the two intersections that are closest to the x value of the left v
    var x = pleft.p[0];
    var sorted = _.sortBy(intersections, function(i) {
      return Math.abs(x - i[0]);
    });
    intersections = [sorted[0], sorted[1]];
    intersections = _.sortBy(intersections, function (p) { return p[0]; });
  }

  this.intersections = intersections;
  var idx;
  let pcenterx = (intersections[0][0] + intersections[1][0]) / 2;
  let prevy = pleft.f(pcenterx);
  let nexty = pright.f(pcenterx);
  let lower = 1;
  if (prevy < nexty) {
    lower = 0;
  }
  idx = 1 - lower;
  return {
    results: intersections,
    resultIdx: idx
  };
}

// Function supports the intersection of a parabolic arc to any other arc type
function intersectParabolicToStraightArc(left, right, directrix){

  // debugging only
  if (left.id === g_debugIdLeft && right.id === g_debugIdRight) {
    g_addDebug = true;
  } else {
    g_addDebug = false;
  }

  var pleft = createBeachlineSegment(left.site, directrix, left.id);
  var pright = createBeachlineSegment(right.site, directrix, right.id);

  var intersections = pleft.intersect(pright);

  _.remove(intersections, function (i) {
    return _.isUndefined(i);
  });

  if (intersections.length == 0 || !intersections[0]) return [];

  // if (intersections.length == 0 || !intersections[0]) {
  //   // use a back-up line since the parabola is probably
  //   // so narrow that it won't intersect with any ray below p
  //   var para = left.isParabola ? pleft : pright;
  //   var V = left.isParabola ? pright : pleft;
  //   if (belongsToSegment(left, right) && para.p < 1e-5) {
  //     var backupLine = new Line(vec3(-1, para.focus[1], 0), vec3(1, para.focus[1], 0));
  //     intersections = V.intersect(backupLine);
  //   }
  //   if (intersections.length == 0 || !intersections[0]) {
  //     console.log("number of intersections is 0 between node id: " + left.id + " and node: " + right.id);
  //     return null;
  //   }
  // }

  if (intersections.length == 1) {
    return {
      results: intersections,
      resultIdx: 0
    };
  }

  if (intersections.length > 2) {
    var x;
    // debugging only
    if (left.isV && right.isV || left.isParabola && right.isParabola)
      throw "Unexpected ERROR";

    if (left.isV)
      x = pleft.p[0];
    else
      x = pright.p[0];
    // Test get the center intersections
    intersections = consolidate(intersections, x);
    if (intersections.length == 1) {
      return {
        results: intersections,
        resultIdx: 0
      };
    }
  }

  this.intersections = intersections;
  var idx;
  let pcenterx = (intersections[0][0] + intersections[1][0]) / 2;
  let prevy = pleft.f(pcenterx);
  let nexty = pright.f(pcenterx);
  let lower = 1;
  if (prevy < nexty) {
    lower = 0;
  }
  idx = 1 - lower;
  // Handle the case where the V arc for the segment (+)
  // needs to be "above" the parabola for the lower
  // end of the segment (*). The (=) is for the parabola
  // for the upper end of the segment.
  //
  //                   =
  //                   +
  //   =               +               =
  //   =               +               =
  //    =              +              =
  //      +            +            +
  //        +          +          +
  //          +        +        +
  //            +      *      +
  //              **       **
  //                  ***
  //
  //     _____________________________
  //
  // if the point is flipped and is connected to the V
  if (belongsToSegmentEndpoint(left, right)) {
    idx = lower;
  }
  return {
    results: intersections,
    resultIdx: idx
  };
}

// Function supports the intersection of a parabolic arc to any other arc type
function intersectParabolicArcs(left, right, directrix){

  // debugging only
  if (left.id === g_debugIdLeft && right.id === g_debugIdRight) {
    g_addDebug = true;
  } else {
    g_addDebug = false;
  }

  let pleft = createBeachlineSegment(left.site, directrix, left.id);
  let pright = createBeachlineSegment(right.site, directrix, right.id);
  let intersections = pleft.intersect(pright);

  if (intersections.length == 0 || !intersections[0]) {
    throw "error number of intersections is 0 between node id: " + left.id + " and node: " + right.id;
  }

  if (intersections.length == 1) {
    return {
      results: intersections,
      resultIdx: 0
    };
  }

  this.intersections = intersections;
  var idx;
  let pcenterx = (intersections[0][0] + intersections[1][0]) / 2;
  let prevy = pleft.f(pcenterx);
  let nexty = pright.f(pcenterx);
  let lower = 1;
  if (prevy < nexty) {
    lower = 0;
  }
  idx = 1 - lower;

  return {
    results: intersections,
    resultIdx: idx
  };
}


