//------------------------------------------------------------
// V class
//
// vleft and vright bisect the line and the sweepline.
//
//            line
//      \      |
//       \     |       ___
//        \   /    ___/
//  vleft  \ | ___/ vright
// _________\|/___________
//               sweepline
//------------------------------------------------------------
var tolerance = 0.00001;
// line is given as a pair of points through which the line passes. y0 = b, y1 = a
// The sweepline is assumed to be horizontal and is given as a y-value.
V = function(line, directrix, id) {
  lineSegment = _.sortBy(line, [function(i) { return i[1]; }]);
  this.y1 = lineSegment[1];
  this.y0 = lineSegment[0];
  // slope the amount of change in x per 1 y
  // new x = the y diff from p *
  var slope = (this.y0[0] - this.y1[0])/(this.y0[1] - this.y1[1]);
  if (slope === 0) {
    this.p = vec3(this.y0[0], directrix, 0);
  } else {
    var diff = (directrix - this.y0[1]);
    var yDiff = diff * slope;
    this.p = vec3(this.y0[0] + yDiff, directrix, 0);
  }

  this.focus = this.p;
  var theta =
    getSegmentsBisectorAngle([vec3(-1, directrix, 0), vec3(1, directrix, 0)], lineSegment);
  // Get the first positive 90 degree sibling to theta
  while (theta > 0) theta -= Math.PI/2;
  while (theta < 0) theta += Math.PI/2;
  var tvals = [theta + Math.PI/2, theta];
  var vectors = [];
  tvals.forEach(function(theta) {
    vectors.push(vec3(Math.cos(theta), Math.sin(theta), 0));
  });
  this.vectors = vectors;
  this.id = id;
}

function filterOutPointsLowerThan(points, valY){
  return _.filter(points, function(p) {
    if (!p) return false;
    return p[1] >= valY;
  });
}

function intersectsTarget(line, t){
  // y0 upper
  // y1 lower
  var r1 = isRightOfLine(line.y1, line.y0, t.y0);
  var r2 = isRightOfLine(line.y1, line.y0, t.y1);
  return r1 && !r2 || !r1 && r2;
}

// get right and left lines
// at most 3 are returned
function getLines(l, r){
  var lines = {
    left: [],
    right: []
  };
  // 3 cases: 1 l divides r, r divides l, neither divide
  var t1 = intersectsTarget(l, r);
  var t2 = intersectsTarget(r, l);
  if (t1 && t2) {
    console.error("Error invalid input data");
    return {left:[], right:[]};
  }
  var v0lp = vec3(l.vectors[0][0] + l.p[0], l.vectors[0][1] + l.p[1], 0);
  var v1lp = vec3(l.vectors[1][0] + l.p[0], l.vectors[1][1] + l.p[1], 0);

  var v0rp = vec3(r.vectors[0][0] + r.p[0], r.vectors[0][1] + r.p[1], 0);
  var v1rp = vec3(r.vectors[1][0] + r.p[0], r.vectors[1][1] + r.p[1], 0);

  if (!t1 && !t2) { // neither divide
    // all combinations possible 11, 10, 01, 00
    if (dividesRightOfLine(l.y1, l.y0, r.y1, r.y0)) {
      lines.left.push(new Line(l.p, v1lp));
    } else {
      lines.left.push(new Line(l.p, v0lp));
    }

    if (dividesRightOfLine(r.y1, r.y0, l.y1, l.y0)) {
      lines.right.push(new Line (r.p, v1rp));
    } else {
      lines.right.push(new Line (r.p, v0rp));
    }

  } else if (t1) {
    lines.left.push(new Line(l.p, v1lp));
    lines.left.push(new Line(l.p, v0lp));
    if (dividesRightOfLine(r.y1, r.y0, l.y1, l.y0)) {
      lines.right.push(new Line (r.p, v1rp));
    } else {
      lines.right.push(new Line (r.p, v0rp));
    }
  } else { // r intersects l
    lines.right.push(new Line (r.p, v1rp));
    lines.right.push(new Line (r.p, v0rp));
    if (dividesRightOfLine(l.y1, l.y0, r.y1, r.y0)) {
      lines.left.push(new Line(l.p, v1lp));
    } else {
      lines.left.push(new Line(l.p, v0lp));
    }
  }
  return lines;
}

// Intersect the V with a parabola.
V.prototype.intersect = function(obj) {
  // debugging only
  if (this.id === g_debugIdLeft && obj.id === g_debugIdRight) {
    g_addDebug = true;
  } else {
    g_addDebug = false;
  }

  if (obj instanceof Parabola) {
    ret = [];
    var p = this.p;
    this.vectors.forEach(function(v) { // Performance - we shouldn't need to test both sides?
      // collect all intersection points (0 - 4)
      ret = ret.concat(obj.intersectRay(p, v));
    });
    // sort by xvalues if x0 < x1 [x0, x1]
    ret = _.sortBy(ret, function (val) { return val[0]; });
    return ret;
  } else if (obj instanceof Line) {
    throw "Invalid Intersection";
    // ret = [];
    // var p = this.p;
    // this.vectors.forEach(function(v) {
    //   ret.push(intersectLines(p, v, obj.p1, obj.p2));
    // });
    // if (!ret[0] || _.isNaN(ret[0][0]))
    //   console.error("V - Para result Invalid between arc:" + this.id + " and arc:" + obj.id);
    // // sort by xvalues if x0 < x1 [x0, x1]
    // ret = _.sortBy(ret, [function(i) { return i[0]; }]);
    // return ret;
  } else if (obj instanceof V) {
    var s1 = makeSegment(this.y0, this.y1);
    var s2 = makeSegment(obj.y0, obj.y1)

    var optConnection = connected(s1, s2);
    if (optConnection) {
      // var y0_y1 = subtract(this.y1, this.y0);
      // var y0_Oy0 = subtract(obj.y0, this.y0);
      // var y0_Oy1 = subtract(obj.y1, this.y0);
      var y0_y1 = vec3(this.y1[0] - this.y0[0], this.y1[1] - this.y0[1], 0);
      var y0_Oy0 = vec3(obj.y0[0] - this.y0[0], obj.y0[1] - this.y0[1], 0);
      var y0_Oy1 = vec3(obj.y1[0] - this.y0[0], obj.y1[1] - this.y0[1], 0);

      // z area between this and obj
      var zArea = cross(y0_y1, y0_Oy0)[2] + cross(y0_y1, y0_Oy1)[2];
      if (zArea == 0) {
        // collinear
        // console.log("collinear v-v arc!");
        return [this.p];
      }
      // choose this v left or right based on zArea
      var bisector = smallAngleBisectSegments(s1, s2, optConnection);

      // debugging only
      if (g_addDebug) {
        g_debugObjs.push(bisector.line);
      }

      // often P is too close to p2 increment the height by a 0.01 to get a better width for each vector
      if (zArea < 0) {
        // segment right
        var pPrime = vec3(this.f_(this.y1[1] + 0.01)[1], this.y1[1] + 0.01, 0);
        return [intersectLines(this.p, pPrime, bisector.line.p1, bisector.line.p2)];
      } else {
        // segment left
        var pPrime = vec3(this.f_(this.y1[1] + 0.01)[0], this.y1[1] + 0.01, 0);
        return [intersectLines(this.p, pPrime, bisector.line.p1, bisector.line.p2)];
      }
    } else {
      var lines = getLines(this, obj);

      // debugging only
      if (g_addDebug) {
        _.forEach(lines.left, function(l) {
          g_debugObjs.push(l);
        });
        _.forEach(lines.right, function(l) {
          g_debugObjs.push(l);
        });
      }
      var intersects = [];
      _.forEach(lines.left, function(l) {
        _.forEach(lines.right, function(r) {
          intersects.push(intersectLines(l.p1, l.p2, r.p1, r.p2));
        });
      });

      var validPoints = filterOutPointsLowerThan(intersects, this.p[1]);
      if (validPoints.length == 0) {
        // console.log("no intersection between id:" + this.id + " and arc id:" + obj.id);
        return [];
      }
      return _.sortBy(validPoints, function (p) { return p[0]; });
    }
  }
  throw "intersection type not implemented";
}

// Intersect the positive portion of the ray.
// If there are two intersections, the intersections will
// be returned in order of t value.
// The ray is given in parametric form p(t) = p + tv
V.prototype.intersectRay = function(p, v) {
  throw "intersectRay not implemented";
}

// y = f(x)
V.prototype.f = function(x) {
  var v;
  if (x < this.p[0]) {
    v = this.vectors[0];
  } else {
    v = this.vectors[1];
  }
  return this.p[1] + v[1]*(x-this.p[0])/v[0];
}

// Inverse of f. x = f_(y)
V.prototype.f_ = function(y) {
  if (y < this.p[1]) return [this.p[0]];
  if (y == this.p[1]) return [this.p[0]];
  var ret = []
  var tY = this.p[1];
  var tX = this.p[0];
  this.vectors.forEach(function(v) {
    var x = tX + v[0]*(y-tY)/v[1];
    ret.push(x);
  });
  return ret;
}

// Prepares this v for drawing
// There are three cases:
//   1. p < x0 < x1
//   2. x0 < p < x1
//   3. x0 < x1 < p
V.prototype.prepDraw = function(nodeid, label, x0, x1) {
  this.nodeid = nodeid;
  this.label = label;
  this.drawPoints = [];

  if (x0 > x1) {
    console.error (`x0 > x1 in V render: ${x0}, ${x1}`);
  }

  var y0 = this.f(x0)
  var y1 = this.f(x1)
  if (x0 < this.p[0] && this.p[0] < x1) {
    // case 2
    this.drawPoints.push(vec3(x0, y0, 0));
    this.drawPoints.push(vec3(this.p[0], this.p[1], 0));
    this.drawPoints.push(vec3(x1, y1, 0));
    // this.drawPoints.push({x:x0, y:y0});
    // this.drawPoints.push({x:this.p.x, y:this.p.y});
    // this.drawPoints.push({x:x1, y:y1});
  } else {
    // cases 1 and 3
    this.drawPoints.push(vec3(x0, y0, 0));
    this.drawPoints.push(vec3(x1, y1, 0));
    // this.drawPoints.push({x:x0, y:y0});
    // this.drawPoints.push({x:x1, y:y1});
  }
}

// function divide(point, scalar){
//   var tmp = point;
//   tmp.x /= scalar;
//   tmp.y /= scalar;
//   tmp.z /= scalar;
//   return tmp;
// }

// function inRange(v, lower, upper) {
//   return lower <= v && v <= upper;
// }
