"use strict";

/* Node conditions for jointed sites
  Order of addition: point, s1, s2, s3 ....
  1. TOP node - top point s.a == child s.a
  2. Child node - left or right hull
  3. Closing node - bottom point - not sure if we need to do anything here
*/

var g_id = 0;
var g_label = 1;
let g_boundingBox;

var NODE_RELATION = {
  TOP: 1,
  CHILD_LEFT_HULL: 2,
  CHILD_RIGHT_HULL: 3,
  CLOSING: 4,
  NONE: 5
}

function getRandomAdjustment(dataPoints, match) {
  var xDiff = Math.abs(dataPoints[match.s1Idx].x - dataPoints[match.s2Idx].x);
  var value = xDiff * 0.01;
  // var value = Math.random() * 1e-6;
  if (value === 0.0) {return 1e-6;}
  // console.log("Returning adjustment:" + rslt);
  // var rslt = Math.random() < 0.5 ? -value : value;
  // return rslt;
  return value;
}

function getMatch(dataPoints) {
  for (var i = 1; i < dataPoints.length; i++) {
    if (dataPoints[i].y == dataPoints[i-1].y)
      return {
        s1Idx :i-1,
        s2Idx :i
      }
  }
  return null;
}

// Input is ordered by segment creation 0 -> 1 -> 2 -> 0
function removeColinearPoints(orderedPoints) {
  var didRemove = false;
  var rslt = {removed: false, points: orderedPoints};
  if (orderedPoints.length < 3) return rslt;
  var toRemove = [];
  // remove the last element since it is a circular list
  if (orderedPoints[0].x === orderedPoints[orderedPoints.length-1].x
    && orderedPoints[0].y === orderedPoints[orderedPoints.length-1].y)
  {
    orderedPoints.splice(orderedPoints.length-1, 1);
  }

  // order points should now be a unique set of points
  orderedPoints = _.uniqWith(orderedPoints, _.isEqual);

  for (var i = 0; i < orderedPoints.length; i++) {
    var start = i === 0 ? orderedPoints.length-1 : i-1;
    var p1 = orderedPoints[start];
    var p2 = orderedPoints[i];
    var p3 = orderedPoints[(i+1)%orderedPoints.length]; // 2,3,0
    if (isColinear(p1, p2, p3)) {
      var center = _.sortBy([p1, p2, p3], 'y')[1];
      // console.log("Removing point(" + center.x + ", " + center.y + ")");
      toRemove.push(center);
    }
  }

  if (toRemove.length > 0) {
    _.forEach(toRemove, function(p) {
      var removedPoints = _.remove(orderedPoints, function (orderedPoint) {
        return orderedPoint.x === p.x && orderedPoint.y === p.y;
      });
      if (removedPoints.length === 0) throw "invalid remove operation";
    });
    didRemove = true;
  }
  // place the ending back on
  orderedPoints.push(orderedPoints[0]);
  return {removed: didRemove, points: orderedPoints};
}

function removeCAS(points) {
  var rslt = removeColinearPoints(points);
  while(rslt.removed)
  {
    rslt = removeColinearPoints(rslt.points);
  }
  return rslt.points;
}

function sanitizeData(orderedPoints) {
  orderedPoints = removeCAS(orderedPoints);

  var match = getMatch(orderedPoints);
  while(match) {
    // TODO smart pick s1 or s2
    orderedPoints[match.s1Idx].y -= getRandomAdjustment(orderedPoints, match);
    match = getMatch(orderedPoints);
  }

  return orderedPoints;
}

var Polygon = function () {
  this.points = [];
  this.segments = [];
  this.label = g_label++;
  this.fileId = "";
}

Polygon.prototype.addPoint = function (point) {
  point.id = g_id++;
  point.label = this.label;
  this.points.push(point);
}

Polygon.prototype.createSegment = function (pIdxStart, pIdxEnd) {
  var s = makeSegment(this.points[pIdxStart], this.points[pIdxEnd]);
  s.id = g_id++;
  s.label = this.label;
  this.segments.push(s);
  if (this.points[pIdxStart][1] == this.points[pIdxEnd][1]) {
    console.error("Horizontal segment detected with y values of: " + this.points[pIdxEnd][1]);
  }
  this.points[pIdxStart].flipped = isFlipped(this.points[pIdxStart], this.segments);
  this.points[pIdxEnd].flipped = isFlipped(this.points[pIdxEnd], this.segments);
}

function getNextSeg(p, segments, segId) {
  var next = _.find(segments, function(s) {
    if (equal(p, s.a) || equal(p, s.b))
      return segId !== s.id;
  });
  if (!next) return;
  if (equal(p, next.a)) {
    return {side: 'a', seg: next};
  } else {
    return {side: 'b', seg: next};
  }
}

function setRelationTop(cur, next) {
  if (!_.isUndefined(cur.a.relation)) return;
  if (next.side == 'a') {
    cur.a.relation = NODE_RELATION.TOP;
    next.seg.a.relation = NODE_RELATION.TOP;
  } else {
    // either a left or right bend
    // var v0 = subtract(cur.b, cur.a);
    // var v1 = subtract(cur.b, next.seg.a);
    var v0 = vec3(cur.b[0] - cur.a[0], cur.b[1] - cur.a[1], 0);
    var v1 = vec3(cur.b[0] - next.seg.a[0], cur.b[1] - next.seg.a[1], 0);
    if (cross(v0, v1)[2] < 0) {
      // right
      cur.a.relation = NODE_RELATION.CHILD_LEFT_HULL;
      next.seg.b.relation = NODE_RELATION.CHILD_LEFT_HULL;
    } else {
      // left
      cur.a.relation = NODE_RELATION.CHILD_RIGHT_HULL;
      next.seg.b.relation = NODE_RELATION.CHILD_RIGHT_HULL;
    }
  }
}

function setRelationBottom(cur, next) {
  if (!_.isUndefined(cur.b.relation)) return;
  if (next.side == 'b') {
    cur.b.relation = NODE_RELATION.CLOSING;
    next.seg.b.relation = NODE_RELATION.CLOSING;
  } else {
    // either a left or right bend
    // var v0 = subtract(cur.b, cur.a);
    // var v1 = subtract(cur.b, next.seg.b);
    var v0 = vec3(cur.b[0] - cur.a[0], cur.b[1] - cur.a[1], 0);
    var v1 = vec3(cur.b[0] - next.seg.b[0], cur.b[1] - next.seg.b[1], 0);
    if (cross(v0, v1)[2] < 0) {
      // right
      cur.b.relation = NODE_RELATION.CHILD_LEFT_HULL;
      next.seg.a.relation = NODE_RELATION.CHILD_LEFT_HULL;
    } else {
      // left
      cur.b.relation = NODE_RELATION.CHILD_RIGHT_HULL;
      next.seg.a.relation = NODE_RELATION.CHILD_RIGHT_HULL;
    }
  }
}

function markSiteRelations(segments) {
  if (segments.length == 0) return;
  var findNext = function(s){ return _.isUndefined(s.a.relation) || _.isUndefined(s.b.relation); };
  var cur = _.find(segments, findNext);
  while(cur) {
    var fromA = getNextSeg(cur.a, segments, cur.id);
    if (!fromA) {
      cur.a.relation = NODE_RELATION.NONE;
    } else {
      setRelationTop(cur, fromA);
    }
    var fromB = getNextSeg(cur.b, segments, cur.id);
    if (!fromB) {
      cur.b.relation = NODE_RELATION.NONE;
    } else {
      setRelationBottom(cur, fromB);
    }
    var cur = _.find(segments, findNext);
  }
}

function parseInputJSON(jsonStr) {
  var data = JSON.parse(jsonStr);
  if (!data)
    console.error("unable to parse data");
  var result = [];
  _.forEach(data.polygons, function(polygon) {
    var poly = new Polygon();
    if (polygon.points.length > 1) {
      polygon.points = sanitizeData(polygon.points);
      for(var i = 0; i < polygon.points.length; i++) {
        if (i !== polygon.points.length - 1) {
          var point = new vec3(polygon.points[i].x,  polygon.points[i].y, 0);
          point.fileId = polygon.fileId;
          poly.addPoint(point);
          if (i !== 0) {
            // if not the first point in the polygon
             poly.createSegment(i-1, i);
          }
        } else {
          // last segment in the polygon (end, start)
          poly.createSegment(i-1, 0);
        }
      }
    } else {
      // only a single point
      var point = new vec3(polygon.points[0].x,  polygon.points[0].y, 0);
      point.fileId = polygon.fileId;
      poly.addPoint(point);
    }
    result.push(poly);
  });
  return result;
}

function isFlipped(p, segs) {
  var endPoint = false;
  // return true if point is lowest of all segments it is a part of
   segs.forEach(function(s) {
    if (equal(p, s.b)) {
      endPoint = true;
      return;
    }
  });
  return endPoint;
}

function getPolygonByLabel(label) {
  var idx = _.findIndex(g_polygons, {'label': label});
  return g_polygons[idx];
}

function findNeighborSegments(node) {
  if (node.isV) return [node.site];
  return findConnectedSegments(node.site);
}

// much like findNeighborSegments but using a point site
function findConnectedSegments(pointSite) {
  if (!pointSite.type || pointSite.type !== "vec") return [];
  var poly = getPolygonByLabel(pointSite.label);
  var rslt = _.filter(poly.segments, function(s) {
    return equal(s.a, pointSite) || equal(s.b, pointSite);
  });
  return rslt;
}

function isColinear(p1, p2, p3) {
  p1 = new vec3(p1.x, p1.y, 0);
  p2 = new vec3(p2.x, p2.y, 0);
  p3 = new vec3(p3.x, p3.y, 0);
  // var v1 = subtract(p2, p1);
  // var v2 = subtract(p3, p1);
  var v1 = vec3(p2[0] - p1[0], p2[1] - p1[1], 0);
  var v2 = vec3(p3[0] - p1[0], p3[1] - p1[1], 0);
  return Math.abs(cross(v1, v2)[2]) === 0;
}

function createDatasets() {
  // bounding box
  // var polygons1 = [];
  // g_boundingBox = new Polygon();
  // g_boundingBox.addPoint(vec3(0.002, 2.71, 0));
  // g_boundingBox.addPoint(vec3(2.8235, -0.0051, 0));
  // g_boundingBox.addPoint(vec3(-0.001, -2.656, 0));
  // g_boundingBox.addPoint(vec3(-2.443, 0.007, 0));
  // g_boundingBox.createSegment(0,1);
  // g_boundingBox.createSegment(1,2);
  // g_boundingBox.createSegment(2,3);
  // g_boundingBox.createSegment(3,0);

  // var p11 = new Polygon();
  // p11.addPoint(vec3(-0.572, -0.61, 0)); // colinear test
  // p11.addPoint(vec3(-0.572, -0.31, 0));
  // p11.addPoint(vec3(-0.572, 0.4209, 0));
  // // p11.addPoint(vec3(-0.272, 0.420001, 0));
  // p11.addPoint(vec3(0.42, 0.42, 0)); // +1e-7
  // p11.addPoint(vec3(0.42, -0.61, 0));

  // removeCAS(p11.points);

  // p11.createSegment(0, 1);
  // p11.createSegment(1, 2);
  // p11.createSegment(2, 3);

  // polygons1.push(p11);
  // polygons1.push(g_boundingBox);

  // var polygons2 = [];
  // var p21 = new Polygon();
  // p21.addPoint(vec3(-0.572, 0.342, 0)); // t1
  // p21.addPoint(vec3(0.02, 0.02, 0)); // cmid
  // p21.addPoint(vec3(0.372, 0.31, 0)); // t2
  // p21.addPoint(vec3(0.64,0.08, 0)); // right
  // p21.addPoint(vec3(0.14, -0.02, 0)); // right2
  // p21.addPoint(vec3(0.5, -0.11, 0)); // right3
  // p21.addPoint(vec3(0.23, -0.51, 0)); // c2
  // p21.addPoint(vec3(0.01, -0.27, 0)); // t3
  // p21.addPoint(vec3(-0.43, -0.65, 0)); // c 1
  // p21.addPoint(vec3(-0.5,-0.48, 0)); // left3
  // p21.addPoint(vec3(-0.14, 0.001, 0)); // left2
  // p21.addPoint(vec3(-0.54,0.18, 0)); // left
  // p21.createSegment(0, 1);
  // p21.createSegment(1, 2);
  // p21.createSegment(2, 3);
  // p21.createSegment(3, 4);
  // p21.createSegment(4, 5);
  // p21.createSegment(5, 6);
  // p21.createSegment(6, 7);
  // p21.createSegment(7, 8);
  // p21.createSegment(8, 9);
  // p21.createSegment(9, 10);
  // p21.createSegment(10,11);
  // p21.createSegment(11,0);
  // polygons2.push(p21);
  // polygons2.push(g_boundingBox);

  // var polygons3 = [];
  // var p31 = new Polygon();
  // Math.seedrandom('6');
  // var numRandom1 = 8;
  // for (var i = 0; i < numRandom1; ++i) {
  //   p31.addPoint(vec3(Math.random()*2-1, Math.random()*2-1, 0));
  // }
  // p31.createSegment(3,4);
  // polygons3.push(p31);
  // polygons3.push(g_boundingBox);

  var polygons4 = [];
  var p41 = new Polygon();
  var p42 = new Polygon();

  p41.addPoint(vec3(-0.41, 0.45, 0)); // shared point
  p41.addPoint(vec3(-0.56, 0.33, 0));
  p41.addPoint(vec3(-0.62, 0.57, 0));

  p42.addPoint(vec3(-0.41, 0.45, 0));
  p42.addPoint(vec3(-0.12,0.53, 0));
  p42.addPoint(vec3(0.32, 0.21, 0));

  p41.createSegment(0, 1);
  p41.createSegment(1, 2);
  p41.createSegment(2, 0);
  polygons4.push(p41);

  p42.createSegment(0, 1);
  p42.createSegment(1, 2);
  p42.createSegment(2, 0);
  polygons4.push(p42);
  // polygons4.push(g_boundingBox);

  // Math.seedrandom('3');
  // var numRandom2 = 100;
  // var polygons5 = [];
  // for (var i = 0; i < numRandom2; ++i) {
  //   var p = new Polygon();
  // 	p.addPoint(vec3(Math.random()*2-1, Math.random()*2-1, 0));
  // 	polygons5.push(p);
  // }
  // polygons5.push(g_boundingBox);

  // initialize the datasets
  // g_datasets = {
  //   'dataset1' : [], // file dataset loaded asynchronously
  //   'dataset2' : [],
  //   'dataset3' : [],
  //   'dataset4' : [],
  //   'dataset5' : [],
  // };

  g_datasets["dataset7"] = polygons4;
}
