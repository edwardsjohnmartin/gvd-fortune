// Given a parabola (h, k, p), computes the y value at a given
// x value.
function parabola_f(x, h, k, p) {
  return (x - h) * (x - h) / (4 * p) + k;
}

// Computes the inverse of f
// function parabola_f_(y, h, k, p) {
//   return quadratic(1 / (4 * p), -2 * h / (4 * p), h * h / (4 * p) + k - y);
// }

//------------------------------------------------------------
// Parabola class
//------------------------------------------------------------

// h - x offset
// k - y offset
// p - scale factor
// directrix is at k-p
// focus is at k+p
// y = (x-h)^2/(4p) + k
Parabola = function (focus, h, k, p, id) {//, theta, offset) {
  this.focus = focus;
  this.h = h;
  this.k = k;
  this.p = p;
  this.id = id;
}

// The directrix is assumed to be horizontal and is given as a y-value.
function createParabola(focus, directrix, id) {
  var h = focus[0];
  var k = (directrix + focus[1]) / 2;
  var p = (focus[1] - directrix) / 2;
  return new Parabola(focus, h, k, p, id);
}

Parabola.prototype.intersect = function (object) {
  if (object instanceof Parabola) {
    this.p = this.p === 0 ? 1e-8 : this.p;
    object.p = object.p === 0 ? 1e-8 : object.p;
    return ppIntersect(this.h, this.k, this.p, object.h, object.k, object.p);
  }
  return object.intersect(this);
}

// Intersect the positive portion of the ray.
// If there are two intersections, the intersections will
// be returned in order of t value.
// The ray is given in parametric form p(t) = p + tv
Parabola.prototype.intersectRay = function (p, v) {

  if (this.p === 0) {
    // console.log("intersectRay P value === 0");
    this.p = 1e-10;
  }

  var tvals = lpIntersect(this.h, this.k, this.p, p, v);

  if (!tvals || _.isNaN(tvals[0]))
  console.error("Intersect Ray Tvals Invalid");
  // Sort tvals in increasing order
  if (tvals.length == 2 && tvals[1] < tvals[0]) {
    tvals = [tvals[1], tvals[0]];
  }

  var ret = [];
  tvals.forEach(function (t) {
    var q = vec3(p[0] + (v[0] * t), p[1] + (v[1] * t), 0);
    // var q = add(p, mult(v, t));

    // if (_.isUndefined(q[0]) || _.isNaN(q[0]))
    //   console.error("Intersect Ray result Invalid");

    ret.push(q);
    // Taking this guard out allows computing close points with negative tvals
    // if (t >= 0) {
    // }
  });
  return ret;
}

// y = f(x)
Parabola.prototype.f = function (x) {
  // var a = (x - this.h);
  // var a2 = a * a;
  // var b = (4 * this.p);
  // if (b === 0) {
  //   // WATCH VALUE
  //   return 1e10;
  // }
  // var c = a2/b;
  // var d = c + this.k;
  // return d;

  return parabola_f(x, this.h, this.k, this.p);
}

// Inverse of f. x = f_(y)
Parabola.prototype.f_ = function (y) {
  var h = this.h;
  var k = this.k;
  var p = this.p;
  return quadratic(1 / (4 * p), -2 * h / (4 * p), h * h / (4 * p) + k - y);
}

// Parabola.prototype.renderSvg = function (id, highlight = false) {
//   let line = d3.line()
//     .x(function (d) { return d.x; })
//     .y(function (d) { return d.y; })
//     .curve(d3.curveCardinal)
//     ;
//   let pa = d3.select("#gvd")
//     .append("path")
//     .datum(this.drawPoints)
//     .attr("d", line)
//     .style("fill", "none")
//     .style("stroke", siteColorSvg(id))
//     .attr("class", "beach-parabola")
//     .attr("vector-effect", "non-scaling-stroke")
//     ;
// }

// Prepares this parabola for drawing
Parabola.prototype.prepDraw = function (nodeid, label, x0, x1) {
  this.nodeid = nodeid;
  this.label = label;
  this.setDrawBounds(x0, x1);
  this.setDrawPoints();
}

// Set the minx and maxx for drawing the parabola optimally.
// Starting x0 and x1 values are given, which represent the
// parabola's intersection with its left and right neighbors,
// respectively. These values are updated to cut off the
// parabola if it goes above 1 in y. x0 and x1 will be properties
// of the parabola.
//
// Initial:
//
//  x0
//   \
//    \
//    _\____________________________
//   |  \                           |
//   |   \                          | x1
//   |    \                        /|
//   |     \_                    _/ |
//   |       \__              __/   |
//   |          \___      ___/      |
//   |              \____/          |
//   |                              |
//   |                              |
//   |______________________________|
//
// Update to:
//
//
//
//    x0
//    ______________________________
//   |  \                           |
//   |   \                          | x1
//   |    \                        /|
//   |     \_                    _/ |
//   |       \__              __/   |
//   |          \___      ___/      |
//   |              \____/          |
//   |                              |
//   |                              |
//   |______________________________|
Parabola.prototype.setDrawBounds = function (x0, x1) {
  var BOUND = 5;
  if (x0 > BOUND || x1 < -BOUND) {
    this.x0 = -BOUND;
    this.x1 = -BOUND;
  } else {
    // Optimize the boundaries for a smooth draw
    x0 = Math.max(x0, -BOUND);
    x1 = Math.min(x1, BOUND);
    if (this.f(x0) > BOUND) {
      var xvalues = this.f_(BOUND);
      if (xvalues.length > 0) {
        x0 = xvalues.reduce(function (a, b) {
          return Math.max(x0, Math.min(a, b));
        });
      }
    }
    if (this.f(x1) > BOUND) {
      var xvalues = this.f_(BOUND);
      if (xvalues.length > 0) {
        x1 = xvalues.reduce(function (a, b) {
          return Math.min(x1, Math.max(a, b));
        });
      }
    }
    this.x0 = x0;
    this.x1 = x1;
  }
}

// Prepares the parabola for drawing by setting the points
// a linear curve can be interpolated against. After this
// function is called, this.drawPoints will be an array
// containing the points shown by *:
//
//    x0
//    ______________________________
//   |  *                           |
//   |   \                          * x1
//   |    \                        /|
//   |     *_                    _* |
//   |       \__              __/   |
//   |          *___      ___*      |
//   |              *___*          |
//   |                              |
//   |                              |
//   |______________________________|
Parabola.prototype.setDrawPoints = function () {
  let points = [];
  for (var x = this.x0; x < this.x1; x += g_xInc) {
    // points.push({x:x, y:this.f(x)});
    points.push(vec2(x, this.f(x)));
  }
  // points.push({x:this.x1, y:this.f(this.x1)});
  points.push(vec2(this.x1, this.f(this.x1)));
  // console.log("xxxx " + points[0].y);

  this.drawPoints = points;

  if (this.theta && this.theta != 0) {
    this.transform =
      `translate(${this.focus.x},${this.focus.y}) ` +
      `rotate(${(this.theta) * 180 / Math.PI}) ` +
      `translate(${-this.h},${-2 * this.k})`;
  }
}

//------------------------------------------------------------
// GeneralParabola class
//------------------------------------------------------------

GeneralParabola = function (focus, h, k, p, theta, splitSite = false) {
  this.parabola = new Parabola(focus, h, k, p);
  this.theta = theta;
  this.Rz = rotateZ(-this.theta);
  this.nRz = rotateZ(this.theta);
  this.splitSite = splitSite;
}

// The directrix is a general line given as an array of two points
// on the line.
function createGeneralParabola(focus, directrix) {
  var a = directrix[0];
  var b = directrix[1];
  // Make sure a and b are ordered such that the focus is located
  // on the left of b-a.
  var v0 = vec3(b[0] - a[0], b[1] - a[1], 0);
  var v1 = vec3(focus[0] - a[0], focus[1] - a[1], 0);

  var v = normalize(v0);
  var vxf = cross(v, v1);
  if (vxf[2] < 0) {
    v = negate(v);
    vxf[2] = -vxf[2];
  }
  var k = length(vxf) / 2.0;
  var p = k;
  var h = focus[0];
  var theta = Math.atan2(v[1], v[0]);
  splitSite = _.get(focus, "label") != _.get(directrix, "label");
  return new GeneralParabola(focus, h, k, p, theta, splitSite);
}

GeneralParabola.prototype.transformPoint = function (p) {
  if (this.theta == 0) return p;

  // Don't remove this code. It explains what we're doing below.
  // var M = translate(this.h, 2*this.k, 0);
  // M = mult(M, rotateZ(degrees(-this.theta)));
  // M = mult(M, translate(-this.focus.x, -this.focus.y, 0));
  // p = mult(M, vec4(p));

  // translate, rotate, translate manually for performance.
  p = vec4(p);
  p[0] += -this.parabola.focus[0];
  p[1] += -this.parabola.focus[1];
  p = mult(this.Rz, p);
  p[0] += this.parabola.h;
  p[1] += 2 * this.parabola.k;
  this.type = "general_parabola";
  return p;
}

GeneralParabola.prototype.transformVector = function (v) {
  if (this.theta == 0) return v;

  v = mult(this.Rz, vec4(v));
  // Not sure why w is getting set to 1.
  v[3] = 0;
  return v;
}

GeneralParabola.prototype.untransformPoint = function (p) {
  if (this.theta == 0) return p;

  // translate, rotate, translate manually for performance
  p = vec4(p);
  p[0] += -this.parabola.h;
  p[1] += -2 * this.parabola.k;
  p = mult(this.nRz, p);
  p[0] += this.parabola.focus[0];
  p[1] += this.parabola.focus[1];
  return p;
}

GeneralParabola.prototype.intersect = function (object) {
  if (object instanceof Parabola || object instanceof GeneralParabola) {
    throw "General parabola to other parabolas is not implemented";
  }
  return object.intersect(this);
}

// Intersect the positive portion of the ray.
// If there are two intersections, the intersections will
// be returned in order of t value.
// The ray is given in parametric form p(t) = p + tv
GeneralParabola.prototype.intersectRay = function (pOrigin, vOrigin) {
  var p = this.transformPoint(pOrigin);
  var v = this.transformVector(vOrigin);

  var tvals = lpIntersect(this.parabola.h, this.parabola.k, this.parabola.p, p, v);
  // Sort tvals in increasing order
  if (tvals.length == 2 && tvals[1] < tvals[0]) {
    tvals = [tvals[1], tvals[0]];
  }

  pthis = this;
  var ret = [];
  tvals.forEach(function (t) {
    if (t === 0) {
      // horizontal or vertical direction
      var pt;
      // derive y
      var y = parabola_f(p[0], pthis.parabola.h, pthis.parabola.k, pthis.parabola.p);
      pt = vec3(p[0], y, 0);
      pt = pthis.untransformPoint(pt);
      ret.push(pt);
    } else if (Math.abs(t) < 1e10) {
      var q = vec3(p[0] + (v[0] * t), p[1] + (v[1] * t), 0);
      // var q = add(p, mult(v, t));
      q = pthis.untransformPoint(q);
      ret.push(q);
    }
    // Taking this guard out allows computing close points with negative tvals
    // if (t >= 0) {
    //   var q = add(p, mult(v, t));
    //   q = pthis.untransformPoint(q);
    //   ret.push(q);
    // }
  });
  return ret.length == 1 ? ret[0] : ret;
}

// Prepares this parabola for drawing
GeneralParabola.prototype.prepDraw = function (id, origin, dest) {
  this.origin = origin;
  this.dest = dest;
  this.id = id;
  var x0 = this.transformPoint(origin.point)[0];
  var x1 = this.transformPoint(dest.point)[0];
  if (x0 > x1) {
    var temp = x1;
    x1 = x0;
    x0 = temp;
  }
  this.parabola.setDrawBounds(x0, x1);
  this.setDrawPoints();
}

GeneralParabola.prototype.setDrawPoints = function () {
  this.parabola.setDrawPoints();
  this.drawPoints = [];
  if (_.isNaN(this.parabola.x0) || _.isNaN(this.parabola.x1)) return;
  for (let i = 0; i < this.parabola.drawPoints.length; ++i) {
    let p = this.parabola.drawPoints[i];
    p = this.untransformPoint(p);
    if (!_.isNaN(p[0])) {
      this.drawPoints.push(p);
    }
  }
}

