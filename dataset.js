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

function sameSign(a,b) {
  return (a * b) > 0;
}

function crossZ(v1, v2) {
  return (v1.x*v2.y) - (v1.y*v1.x);
}

function isOverlapColinear(p1, p2, p3) {
  var v1 = {x:p2.x - p1.x, y:p2.y - p1.y};
  var v2 = {x:p3.x - p1.x, y:p3.y - p1.y};
  return crossZ(v1, v2) === 0;
}

function overlap(x1, y1, x2, y2, x3, y3, x4, y4){
	var a1, a2, b1, b2, c1, c2;
	var r1, r2 , r3, r4;
	var denom;

	// a1, b1, c1, where line joining points 1 and 2
	// is "a1 x + b1 y + c1 = 0".
	a1 = y2 - y1;
	b1 = x1 - x2;
	c1 = (x2 * y1) - (x1 * y2);

	// r3 and r4.
	r3 = ((a1 * x3) + (b1 * y3) + c1);
  r4 = ((a1 * x4) + (b1 * y4) + c1);

  // check co-linear isColinear(p1,p2,p3)
  var np0 = {x: x1, y: y1};
  var np1 = {x: x2, y: y2};
  var lp0 = {x: x3, y: y3};
  var lp1 = {x: x4, y: y4};
  if (isOverlapColinear(lp0, lp1, np0) || isOverlapColinear(lp0, lp1, np1)) return false; // true/false?

	// Check signs of r3 and r4. If both point 3 and point 4 lie on
	// same side of line 1, the line segments do not intersect.
	if ((r3 !== 0) && (r4 !== 0) && sameSign(r3, r4)){
		return false; //return that they do not intersect
	}

	// a2, b2, c2
	a2 = y4 - y3;
	b2 = x3 - x4;
	c2 = (x4 * y3) - (x3 * y4);

	// r1 and r2
	r1 = (a2 * x1) + (b2 * y1) + c2;
	r2 = (a2 * x2) + (b2 * y2) + c2;

	// Check signs of r1 and r2. If both point 1 and point 2 lie
	// on same side of second line segment, the line segments do
	// not intersect.
	if ((r1 !== 0) && (r2 !== 0) && (sameSign(r1, r2))){
		return false; //return that they do not intersect
	}

	//Line segments intersect: intersection point.
	denom = (a1 * b2) - (a2 * b1);

	if (denom === 0) {
		return true; //collinear
	}

	// lines_intersect
	return true; //lines intersect, return true
}

// perhaps this could return the
// nature of the overlap to better apply an adjustment
function overlapsAny(x0, y0, x1, y1, lines) {
  var rslt = false;
  _.forEach(lines, function (l) {
    if (overlap(x0, y0, x1, y1, l.x0, l.y0, l.x1, l.y1)){
      rslt = true;
      return;
    }
  });
  return rslt;
}


// return the lines that were targeted
// target lines -> the current lines to look at
// vSet all the other lines in the set
function getOverlappingLines(targetLines, vSet) {
  var rslts = [];
  // for all segments /_\
  _.each(targetLines, function (curLine) {
    // if a larger length overlaps anyone
    var tolerance = 1.0001;
    var A = vec3(
      ((curLine.x0-curLine.x1) * tolerance) + curLine.x1,
      ((curLine.y0-curLine.y1) * tolerance) + curLine.y1,
      0);

    var B = vec3(
      ((curLine.x1-curLine.x0) * tolerance) + curLine.x0,
      ((curLine.y1-curLine.y0) * tolerance) + curLine.y0,
      0);

    // does the current line overlap any other lines
    _.each(vSet, function (otherObj) {
      if (overlapsAny(A[0], A[1], B[0], B[1], otherObj)) {
        rslts.push(curLine);
        // debugging only
        // curLine.color = "red";
      }
    });
  });
  return rslts;
}


// input data is an array of point objects [[x, y, x1,y1, x2,y2], ..]
function dataCorrection(srcArray) {
  // get the lines
  var objs = [];
  for (var i = 0; i < srcArray.length; i++) {
    var lines = [];
    var pts = srcArray[i];
    for(var j = 0; j < pts.length-1; j++){
      lines.push({x0:pts[j].x, y0:pts[j].y, x1:pts[j+1].x, y1:pts[j+1].y});
    }
    objs.push(lines);
  }

  var linesToUpdate = [];
  for (var k = 0; k < objs.length; k++) {
    var vSet = _.filter(objs, function (p, idx) {return idx !== k; });
    linesToUpdate = objs[k];
    // var iteration = 1;
    while(linesToUpdate.length > 0) {
      linesToUpdate = getOverlappingLines(linesToUpdate, vSet);
      // update the lines
      _.each(linesToUpdate, function(curLine) {
        var mult = 0.1; // 0.01
        // move each point towards the other slightly
        // by added the pull vectors
        var x0 = curLine.x0;
        var y0 = curLine.y0;
        var x1 = curLine.x1;
        var y1 = curLine.y1;
        curLine.x0 = ((x1-x0)*mult) + curLine.x0;
        curLine.y0 = ((y1-y0)*mult) + curLine.y0;
        curLine.x1 = ((x0-x1)*mult) + curLine.x1;
        curLine.y1 = ((y0-y1)*mult) + curLine.y1;
      });
    }
  }

  return objs;
}

function getAdjustment(dataPoints, match) {
  var xDiff = Math.abs(dataPoints[match.s1Idx].x - dataPoints[match.s2Idx].x);
  var value = xDiff * 0.007;
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
function removeColinearPoints(orderedPoints, optTolerance) {
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
  orderedPoints = _.uniqWith(orderedPoints, _.isEqual); // TODO performance

  for (var i = 0; i < orderedPoints.length; i++) {
    var start = i === 0 ? orderedPoints.length-1 : i-1;
    var p1 = orderedPoints[start];
    var p2 = orderedPoints[i];
    var p3 = orderedPoints[(i+1)%orderedPoints.length]; // 2,3,0
    if (isColinear(p1, p2, p3, optTolerance)) {
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

function removeCAS(points, optTolerance) {
  var rslt = removeColinearPoints(points, optTolerance);
  while(rslt.removed)
  {
    rslt = removeColinearPoints(rslt.points, optTolerance);
  }
  return rslt.points;
}

function sanitizeData(orderedPoints, optTolerance, optXoffset) {
  if (orderedPoints.length > 3) {
    orderedPoints = removeCAS(orderedPoints, optTolerance);
  }

  var match = getMatch(orderedPoints);
  while(match) {
    orderedPoints[match.s2Idx].y -= getAdjustment(orderedPoints, match);
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

Polygon.prototype.createSegment = function (pIdxStart, pIdxEnd, optColor = null) {
  var s = makeSegment(this.points[pIdxStart], this.points[pIdxEnd]);
  s.id = g_id++;
  s.label = this.label;
  s.color = optColor;
  this.segments.push(s);
  return s;
}

// testing only
// function renderOutline(outlinePoints, context){
//   context.fillStyle = "#0000FF";
//   for(var i=0; i<outlinePoints.length; i+=2){
//       context.fillRect(outlinePoints[i], outlinePoints[i+1], 1, 1);
//   }
// }

function canvasToPolygons(srcArray, width, height){
  // console.log("canvas to polygon width:" + width + " height:" + height);
  let xScale = d3.scaleLinear()
    .domain([0, width])
    .range([-1, 1]);

  let yScale = d3.scaleLinear()
    .domain([0, height])
    .range([1, -1]);


  var stdObjs = [];
  _.each(srcArray, function (pts) {
    var stdPoints = [];
    if (pts.length % 2 !== 0) throw "invalid data";
    for(var i = 0; i < pts.length - 1; i+=2){
      // x even, y odd
      stdPoints.push({x:pts[i], y:pts[i+1]});
    }

    stdPoints = removeCAS(stdPoints);

    // rotate canvas points
    // for better accuracy
    let theta = -0.02;
    stdPoints = _.transform(stdPoints, function(result, p){
      // x' = xcos(theta) - ysin(theta)
      // y' = xsin(theta) + ycos(theta)
      var xP = p.x*Math.cos(theta) - p.y*Math.sin(theta);
      var yP = p.x*Math.sin(theta) + p.y*Math.cos(theta);
      result.push({x:xP, y:yP});
    }, []);
    stdObjs.push(stdPoints);
  });

  var objects = dataCorrection(stdObjs);

  var polygons = [];
  var debugIdx = 0;
  _.each(objects, function(linesArray){
    var poly = new Polygon();
    var startPt = new vec3(xScale(linesArray[0].x0), yScale(linesArray[0].y0), 0);
    poly.addPoint(startPt);
    for(var idx = 1; idx < linesArray.length; idx++){
      // var p1 = new vec3(xScale(linesArray[idx].x0), yScale(linesArray[idx].y0), 0);
      var pt = new vec3(xScale(linesArray[idx].x1), yScale(linesArray[idx].y1), 0);
      pt.fileId = debugIdx;
      if (idx === linesArray.length - 1) {
        poly.createSegment(idx-1, 0, linesArray[idx].color);
      } else if (idx !== 0) {
        poly.addPoint(pt);
        poly.createSegment(idx-1, idx, linesArray[idx].color);
      }
    }
    polygons.push(poly);
    debugIdx++;
  });

  return polygons;
}

function parseInputMap(data) {
  var canvas = document.getElementById("myCanvas");
  canvas.width = data.width;
  canvas.height = data.height;
  // var canvas = createCanvas(width, height);
  canvas.style.position = "absolute";
  var ctx = canvas.getContext('2d')
  // set the black and white image data
  var imgData = ctx.createImageData(data.width, data.height);
  for (var i = 0; i < imgData.data.length; i += 4) {
    var idx = i/4;
    // RGB - Intensity (0-white - 255 Black)
    imgData.data[i+0] = 0;
    imgData.data[i+1] = 0;
    imgData.data[i+2] = 0;
    imgData.data[i+3] = data.value[idx];
  }
  // put img data, at point(x,y)
  // rotate 1 degree
  // ctx.rotate(Math.PI / 180);
  ctx.putImageData(imgData, 0, 0);
  var objs = MarchingSquaresOpt.getBlobOutlinePoints(data.value, data.width, data.height);

  // Debug the canvas
  // ctx.clearRect(0, 0, canvas.width, canvas.height);
  // _.each(objs, function(o) { renderOutline(o, ctx) });

  // TODO FIND A better way to get rid of this
  var found = _.find(g_datasetList, function(f) { return f.label === "Berlin city dataset"; });
  if (found) {
    objs.splice(27, 1);
  }

  // testing only
  // Sydney - 298 307 394, 1133 1081 1085 / 7311, 7312, 7182
  // Berlin - 1052 1016 1017, 4026
  // BOSTON - 32, 45, 40

  // Berlin overlap = 13, 7, 14
  // var few = [objs[40], objs[45]]; //
  // return canvasToPolygons(few, width, height);
  return canvasToPolygons(objs, data.width, data.height);
}


function getPolygonByLabel(label) {
  var idx = _.findIndex(g_datasetList[g_setIdx].data, {'label': label});
  return g_datasetList[g_setIdx].data[idx];
}

function isColinear(p1, p2, p3, optTolerance) {
  p1 = new vec3(p1.x, p1.y, 0);
  p2 = new vec3(p2.x, p2.y, 0);
  p3 = new vec3(p3.x, p3.y, 0);
  // var v1 = subtract(p2, p1);
  // var v2 = subtract(p3, p1);
  var v1 = vec3(p2[0] - p1[0], p2[1] - p1[1], 0);
  var v2 = vec3(p3[0] - p1[0], p3[1] - p1[1], 0);
  var zVal = cross(v1, v2)[2];
  if (optTolerance)
   return Math.abs(zVal) < optTolerance;

  return zVal === 0;
}

 function setExampleDataset() {
   var polygons = [];

  var p11 = new Polygon();
  p11.addPoint(vec3(-0.27, 0.61, 0));
  // p11.addPoint(vec3(0.32, -0.31, 0));

  // p11.createSegment(0, 1);

  var p12 = new Polygon();
  // p12.addPoint(vec3(0.137, 0.54, 0));
  p12.addPoint(vec3(0.23, 0.42, 0));
  p12.addPoint(vec3(-0.137, 0.394, 0));
  p12.createSegment(0, 1);
  // p12.createSegment(1, 2);

  var p13 = new Polygon();
  p13.addPoint(vec3(-0.12, -0.21, 0));
  p13.addPoint(vec3(0.12, -0.21, 0));

  var p14 = new Polygon();
  p14.addPoint(vec3(-0.0009513900165127875, 0.36450191668080745, 0));

  var p15 = new Polygon();
  p15.addPoint(vec3(-0.00601157860749113, 0.3320736318842792, 0));

  // p15.createSegment(2,0);

  // polygons.push(p11);
  polygons.push(p12);
  // polygons.push(p13);
  polygons.push(p14);
  polygons.push(p15);

  // Math.seedrandom('3');
  // var numRandom2 = 100;	  // var numRandom2 = 100;
  // // var polygons = [];	  // var polygons5 = [];
  // for (var i = 0; i < numRandom2; ++i) {	  // for (var i = 0; i < numRandom2; ++i) {
  //   var p = new Polygon();	  //   var p = new Polygon();
  // 	p.addPoint(vec3(Math.random()*2-1, Math.random()*2-1, 0));	  // 	p.addPoint(vec3(Math.random()*2-1, Math.random()*2-1, 0));
  // 	polygons.push(p);	  // 	polygons5.push(p);
  // }

  // the final dataset is reserved for manual testing
  g_datasetList[g_datasetList.length - 1].data = polygons;
}
