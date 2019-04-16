"use strict";

/* Node conditions for jointed sites
  Order of addition: point, s1, s2, s3 ....
  1. Apex node - top point s.a == child s.a
  2. Child node - left or right hull
  3. Closing node - bottom point - not sure if we need to do anything here
*/
var NODE_RELATION = {
  APEX: 1,
  CHILD_LEFT_HULL: 2,
  CHILD_RIGHT_HULL: 3,
  CLOSING: 4
}

// Get next Lower segment or undefined
function getNextSeg(current, segments) {
  var next = _.find(segments, function(s) {
    if (equal(current.b, s.a) && current.b.y > s.b.y) {
      return true;
    }
  });
  return next;
}

function segShareSite(s1, s2) {
  return equal(s1.a, s2.b) || equal(s1.b, s2.a) || equal(s1.a, s2.a) || equal(s1.b, s2.b);
}

function populateDataProps(points, segments) {
  var uniqueLabels = _.uniq(_.map(segments, "label"));
  _.forEach(uniqueLabels, function(l) {
    definePointGroupProperties(_.filter(points, { label: l }), _.filter(segments, { label: l }));
  });
}

function definePointGroupProperties(gp, gs) {
  // No two points of the same label should ever share the same y value
  var ySortedPoints = _.sortBy(gp, function(i) { return i.y; });
  var parents = _.filter(gs, function(s) { return equal(s.a, ySortedPoints[ySortedPoints.length - 1]); });

  // cross product
  var v0 = subtract(parents[0].b, ySortedPoints[ySortedPoints.length - 1]);
  var v1 = subtract(parents[1].b, ySortedPoints[ySortedPoints.length - 1]);
  var sortedParents = cross(v0, v1).z < 0 ? [parents[1], parents[0]] : [parents[0], parents[1]];
  // var sortedParents = _.sortBy(parents, function(s) { return s.b.x; });

  if (sortedParents.length == 2) {
    sortedParents[0].a.relation = NODE_RELATION.APEX;
    sortedParents[1].a.relation = NODE_RELATION.APEX;
    ySortedPoints[0].relation = NODE_RELATION.CLOSING;
    ySortedPoints[ySortedPoints.length - 1].relation = NODE_RELATION.APEX;
    // follow left path
    var curLeft = getNextSeg(sortedParents[0], gs);
    while(curLeft) {
      // mark points
      gp.forEach(function (p) {
        if (equal(p, curLeft.a) || equal(p, curLeft.b)) {
          if (!p.relation) p.relation = NODE_RELATION.CHILD_LEFT_HULL;
          if (!curLeft.b.relation) curLeft.b.relation = NODE_RELATION.CHILD_LEFT_HULL;
          if (!curLeft.a.relation) curLeft.a.relation = NODE_RELATION.CHILD_LEFT_HULL;
        }
      });
      var curLeft = getNextSeg(curLeft, gs);
    }

    // follow right path
    var curRight = getNextSeg(sortedParents[1], gs);
    while(curRight) {
      // mark points
      gp.forEach(function (p) {
        if (equal(p, curRight.a) || equal(p, curRight.b)) {
          if (!p.relation) p.relation = NODE_RELATION.CHILD_RIGHT_HULL;
          if (!curRight.b.relation) curRight.b.relation = NODE_RELATION.CHILD_RIGHT_HULL;
          if (!curRight.a.relation) curRight.a.relation = NODE_RELATION.CHILD_RIGHT_HULL;
        }
      });
      curRight = getNextSeg(curRight, gs);
    }
  }
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

function createDatasets() {
  let points1 = [
    vec3(0.05, 0.4, 0), // left
    vec3(0.251, 0.41, 0), // apex
    vec3(0.25, -0.1, 0), // close
    vec3(0.07, -0.09, 0), // left

    vec3(-0.45, 0.31, 0), // top
    vec3(-0.25, 0.21, 0), // right
    vec3(-0.15, -0.05, 0), // lower right
    vec3(-0.55, -0.08, 0), // close
    // vec3(-0.15, -0.95, 0),
    // vec3(0.14, -0.94, 0),
    // vec3(0.74, -0.94, 0),
    // vec3(0.24, -0.94, 0),
    // vec3(0.48, -0.96, 0)
  ];
  let segments1 = [
    makeSegment(points1[0], points1[1]),
    makeSegment(points1[1], points1[2]),
    makeSegment(points1[2], points1[3]),
    makeSegment(points1[3], points1[0]),

    makeSegment(points1[4], points1[5]),
    makeSegment(points1[5], points1[6]),
    makeSegment(points1[6], points1[7]),
    makeSegment(points1[7], points1[4]),
  ];

  let points2 = [
    vec3(-0.572, 0.542, 0), // t1
    vec3(-0.072, 0.31, 0), // cmid
    vec3(0.372, 0.51, 0), // t2

    vec3(0.64,0.28, 0), // right
    vec3(0.14, 0.18, 0), // right2
    vec3(0.5,-0.08, 0), // right3

    vec3(0.23, -0.31, 0), // c2
    vec3(0.01, -0.07, 0), // t3
    vec3(-0.53, -0.45, 0), // c 1

    vec3(-0.5,-0.28, 0), // left3
    vec3(-0.14,0.2, 0), // left2
    vec3(-0.54,0.38, 0), // left
  ];
  let segments2 = [
    makeSegment(points2[0], points2[1]),
    makeSegment(points2[1], points2[2]),
    makeSegment(points2[2], points2[3]),
    makeSegment(points2[3], points2[4]),
    makeSegment(points2[4], points2[5]),
    makeSegment(points2[5], points2[6]),
    makeSegment(points2[6], points2[7]),
    makeSegment(points2[7], points2[8]),
    makeSegment(points2[8], points2[9]),
    makeSegment(points2[9], points2[10]),
    makeSegment(points2[10], points2[11]),
    makeSegment(points2[11], points2[0]),
  ];

  let points3 = [];
  {
    Math.seedrandom('6');
    let numRandom = 8;
    for (var i = 0; i < numRandom; ++i) {
      var p = vec3(Math.random()*2-1, Math.random()*2-1, 0);
      points3.push(p);
    }
  }
  let segments3 = [
    makeSegment(points3[1], points3[2]),
  ];

  let points4 = [
    vec3(-0.26, 0.73, 0),
    vec3(0.62, 0.37, 0),
    vec3(0.73,-0.13, 0),

    vec3(-0.65, -0.15, 0),
    vec3(-0.12,0.13, 0),
    vec3(-0.30, -0.1, 0),
  ];
  let segments4 = [
    makeSegment(points4[0], points4[1]),
    makeSegment(points4[1], points4[2]),
    makeSegment(points4[2], points4[0]),

    makeSegment(points4[3], points4[4]),
    makeSegment(points4[4], points4[5]),
    makeSegment(points4[5], points4[3]),
  ];

  Math.seedrandom('3');
  let numRandom = 100;
  let points5 = [];
  for (var i = 0; i < numRandom; ++i) {
  	var p = vec3(Math.random()*2-1, Math.random()*2-1, 0);
  	points5.push(p);
  }
  let segments5 = [];

  datasets = {
    'dataset1' : { points:points1, segments:segments1 },
    'dataset2' : { points:points2, segments:segments2 },
    'dataset3' : { points:points3, segments:segments3 },
    'dataset4' : { points:points4, segments:segments4 },
    'dataset5' : { points:points5, segments:segments5 },
  };
}
