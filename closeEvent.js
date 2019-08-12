// File handles close event logic

//------------------------------------------------------------
// CloseEvent
//
// y is where the event should occur, while point is where the
// arcs will converge into a Voronoi vertex.
//------------------------------------------------------------
var CloseEvent = function (y, arcNode, leftNode, rightNode, point, radius) {
  this.yval = y;
  // Point that is equidistant from the three points
  this.point = point;
  this.arcNode = arcNode;
  this.leftNode = leftNode;
  this.rightNode = rightNode;
  this.arcNode.closeEvent = this;
  this.isCloseEvent = true;
  this.live = true;
  this.r = radius;
  this.id = leftNode.id + "-" + arcNode.id + "-" + rightNode.id;
};

Object.defineProperty(CloseEvent.prototype, "y", {
  configurable: true,
  enumerable: true,
  get: function () {
    return this.yval;
  },
});

///////////////////// Utility Functions ///////////////////////////////////

function validDiff(diff, id) {
  // WATCH VALUE
  var MAX_DIFF = 1e-2;
  if (diff > MAX_DIFF){
    // console.log("Max diff exceeded when closing node:" + id + " value:" + diff);
    return false;
  }
  return true;
}

function getDiff(left, node, right, p, directrix) {
  if (!p) {
    console.error("Diff point invalid");
    return 1e10;
  }

  // if (shallowSite(node.site)) {
  //   var radius = getRadius(p, left, node, right);
  //   var newY = p.y - radius;
  //   return Math.abs(newY - directrix);
  // }

  var radius = getRadius(p, left, node, right);
  var newY = p.y - radius;
  // rule out points too far above the directrix
  if (newY > directrix) return 1e10;

  // Option: or test that left and right intersection
  var i0 = getIntercpt(left, node, newY);
  var i1 = getIntercpt(node, right, newY);
  if (!i0 || !i1) return 1e10;
  var diffX = Math.abs(i0.x - i1.x);
  var diffY = Math.abs(i0.y - i1.y);
  return diffX + diffY;
}

// This test states that each segment must have the close point in
// it's sight or else the test fails
function sightTest(left, node, right, closePoint) {
  var pass = true;
  _.forEach([left, node, right], function(i) {
    if (i.isV && !fallsInBoundary(i.site, closePoint)) pass = false;
  });
  return pass;
}

function radiusTest(left, node, right, closePoint) {
  // WATCH VALUE
  var thresh = 1e-8;
  if (left.isV && node.isV && right.isV) return true;
  var segments = _.filter([left, node, right], { isV: true });
  var points = _.filter([left, node, right], { isParabola: true });
  var radius = undefined;
  var pass = true;
  _.forEach(points, function(p) {
    if (_.isUndefined(radius)) {
      radius = dist(p.site, closePoint);
    } else {
      var newR = dist(p.site, closePoint);
      var diff = Math.abs(radius - newR);
      if (diff > thresh) {
        // console.log("failed radius test diff:" + diff + " -for node:" + node.id);
        pass = false;
      }
    }
  });
  if (!pass) return false;

  _.forEach(segments, function(s) {
    var newR = dist(s.site, closePoint);
    var diff = Math.abs(radius - newR);
    if (diff > thresh) {
      // console.log("failed radius test diff:" + diff + " -for node:" + node.id);
      pass = false;
    }
  });
  return pass;
}

// return true if the circle test passes false otherwise
function circleTest(left, node, right, r, closePoint) {
  // include all associated sites such as segment sites
  // which may not found through a neighboring arc

  var failNode = _.find([left, node, right], function (node) {
    if (node.isParabola) {
      // query for attached segs
      var segs = findNeighborSegments(node);
      _.forEach(segs, function (s) {
        var intercept = inteceptCircleSeg({radius:r, center:closePoint}, {p1:s.a,p2:s.b});
        if (intercept.length == 2) return true;
      });
    } else {
      var intercept = inteceptCircleSeg({radius:r, center:closePoint}, {p1:node.site.a,p2:node.site.b});
      if (intercept.length == 2) return true;
    }
    return false;
  });
  return _.isUndefined(failNode);
}

/* Return true or false if the arcNode should be able to close in the designated spot
   Does the shared segment run between p1 and equi/close point?
   Arc node must be a parabola arc for this test
   If the segment divides the start of the parabola and the close point then it cannot close
   true otherwise
   |
    *p1   * a
     \    |
      \   |      * close
       \  |
        \ | /
         \|/
          * b
*/
function canClose(left, arcNode, right, equi) {
  if (arcNode.isV) {
    var can = true;
    // if the V is arcing with the top parabola then both sites must coincide
    if (left.isParabola && right.isParabola && equal(arcNode.site.a, left.site)) {
      // the right site should be on the left of the segment
      var v1 = subtract(arcNode.site.a, arcNode.site.b);
      var v2 = subtract(right.site, arcNode.site.b);
      can = cross(v1, v2).z > 0;
    } else if (right.isParabola && left.isParabola && equal(arcNode.site.a, right.site)) {
      // the left site should be on the right of the segment
      var v1 = subtract(arcNode.site.a, arcNode.site.b);
      var v2 = subtract(left.site, arcNode.site.b);
      can = cross(v1, v2).z < 0;
    }

    return can;
  } else {

    // half plane test
    var hpTest;
    if (left.isV && equal(arcNode.site, left.site.a)) {
      hpTest = isRightOfLine(left.site.a, left.site.b, equi);
    } else if (right.isV && equal(arcNode.site, right.site.a)) {
      hpTest = !isRightOfLine(right.site.a, right.site.b, equi);
    } else {
      return circleTest(left, arcNode, right, dist(arcNode.site, equi), equi);
    }

    // If the circle created intersects the segment site that is a part
    // of the current, left or right arcs then it cannot be on the gvd
    return hpTest && circleTest(left, arcNode, right, dist(arcNode.site, equi), equi);
  }
}

function getRadius(point, left, node, right) {
  // given a point and nodes return the radius
  if (left.isV && node.isV && right.isV) {
    return Math.min(Math.min(dist(point, left.site), dist(point, node.site)), dist(point, right.site));
   } else {
    var pointSite = _.filter([left.site, node.site, right.site], function(site) {
      return site.type == "vec";
    })[0];
    return dist(point, pointSite);
   }
}

function getIntercpt(left, right, directrix) {
  if (left.id === g_debugIdLeft && right.id === g_debugIdRight) {
    g_addDebug = true;
  } else {
    g_addDebug = false;
  }
  var obj = {};
  if (left.isV && right.isV) {
    obj = intersectStraightArcs(left, right, directrix);
  } else if (left.isV || right.isV) {
    var flipped = left.site.flipped || right.site.flipped;
    var isgen = left.isParabola && right.isV || left.isV && right.isParabola;
    obj = intersectParabolicToStraightArc(left, right, flipped, isgen, directrix);
  } else {
    obj = intersectParabolicArcs(left, right, directrix);
  }
  if (!obj) return null;
  return obj.results[obj.resultIdx];
}

// return the most viable close points out of a list of close points
// based on arc size @ point
function chooseClosePoint(left, node, right, points, directrix) {
  if (_.isEmpty(points)) return null;
  if (points.length === 1) return points[0];
  var leastDiff = 10000;
  // length test - the length of node's arc should be close to 0
  // for the correct point
  var validPoints = _.sortBy(points, function (p) {
    var diff = getDiff(left, node, right, p, directrix);
    if (diff < leastDiff)
     leastDiff = diff;
    return diff;
  });
  if (shallowSite(left.site) || shallowSite(right.site)) return validPoints[0];
  if (!validDiff(leastDiff)) return null;
  return validPoints[0];
}

//------------------------------------------------------------
// createCloseEvent
//------------------------------------------------------------
function createCloseEvent(arcNode, directrix) {
  if (arcNode == null) return null;
  var left = arcNode.prevArc();
  var right = arcNode.nextArc();
  if (left == null || right == null) return null;
  var closePoint;

  // debugging only
  if (left.id === g_debugIdLeft && arcNode.id === g_debugIdMiddle
    && right.id === g_debugIdRight) {
    g_addDebug = true;
  } else {
    g_addDebug = false;
  }

  if (arcNode.isParabola && left.isParabola && right.isParabola) {
    // All three are points
    closePoint = equidistant(left.site, arcNode.site, right.site);
    if (closePoint == null) return null;
    var u = subtract(left.site, arcNode.site);
    var v = subtract(left.site, right.site);
    // Check if there should be a close event added. In some
    // cases there shouldn't be.
    if (cross(u, v)[2] < 0) {
      let r = length(subtract(arcNode.site, closePoint));
      let event_y = closePoint.y - r;
      return new CloseEvent(event_y, arcNode, left, right, closePoint, r);
    }
    return null;
  }

  if (arcNode.isV) {

    if (arcNode.site.a == left.site && arcNode.site.b == right.site
      || arcNode.site.b == left.site && arcNode.site.a == right.site) return null;

    // If siblings reference the same closing node don't let them close until
    // the closing node is processed
    if (shareVClosing(arcNode, left) || shareVClosing(arcNode, right)) return null;
  }

  var radius = null;
  // can compute up to 6 equi points
  var equi = equidistant(left.site, arcNode.site, right.site);
  if (equi == null || equi.length == 0) return null;
  if (equi.length == 1) {
    closePoint = equi[0];
    var diff = getDiff(left, arcNode, right, closePoint, directrix);
    if (!validDiff(diff)) return null;
  } else if (equi.type && equi.type == "vec") {
    closePoint = equi;
    var diff = getDiff(left, arcNode, right, closePoint, directrix);
    if (!validDiff(diff)) return null;
  } else {
    var p = chooseClosePoint(left, arcNode, right, equi, directrix);
    if (!p) return null;
    closePoint = p;
  }

  closePoint = convertToVec3(closePoint);
  if (!radiusTest(left, arcNode, right, closePoint)) return null;
  // if (!sightTest(left, arcNode, right, closePoint)) return null;

  radius = getRadius(closePoint, left, arcNode, right);
  if (_.isUndefined(radius)) throw "invalid radius";

  if (canClose(left, arcNode, right, closePoint)){
    return new CloseEvent(closePoint.y - radius, arcNode, left, right, closePoint, radius);
  }

  return null;
}

function addCloseEvent(events, newEvent) {
  var search = function (event) {
    var tolerance = 0.00001;
    if (!newEvent.point) debugger;
    return (Math.abs(newEvent.point.x - event.point.x) < tolerance
      && Math.abs(newEvent.point.y - event.point.y) < tolerance);
  };
  if (newEvent == null) return;
  var existing = _.filter(events, search);
  if (_.isEmpty(existing)) {
    events.push(newEvent);
  } else {
    var idx = _.findIndex(events, search);
    if (idx == -1) return;
    // replace the old event
    events[idx] = newEvent;
  }
}

function processCloseEvents(closingNodes, directrix) {
  // Create close events
  var closeEvents = [];
  _.forEach(closingNodes, function(node) {
    addCloseEvent(closeEvents, createCloseEvent(node, directrix));
  });
  // if (arcNode.isParabola &&
  //   _.get(arcNode, "site.relation") == NODE_RELATION.CHILD_LEFT_HULL) {
  // } else if (arcNode.isParabola &&
  //     _.get(arcNode, "site.relation") == NODE_RELATION.CHILD_RIGHT_HULL) {
  //   addCloseEvent(closeEvents, createCloseEvent(arcNode.nextArc(), directrix));
  // } else {
  //   addCloseEvent(closeEvents, createCloseEvent(arcNode.prevArc(), directrix));
  //   addCloseEvent(closeEvents, createCloseEvent(arcNode.nextArc(), directrix));
  // }
  return closeEvents;
}
