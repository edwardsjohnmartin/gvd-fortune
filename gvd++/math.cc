#include "math.hh"

#include <map>

namespace
{
  const double g_xInc = 0.01;

  bool intersectsTarget(V const& line, V const& t)
  {
    auto r1 = math::isRightOfLine(line.a, line.b, t.b);
    auto r2 = math::isRightOfLine(line.a, line.b, t.a);
    return (r1 && !r2) || (!r1 && r2);
  }

  std::vector<vec2> getLineIntersections(V const& l, V const& r)
  {
    std::vector<math::Bisector> left;
    std::vector<math::Bisector> right;
    // 3 cases: 1 l divides r, r divides l, neither divide
    auto t1 = intersectsTarget(l, r);
    auto t2 = intersectsTarget(r, l);
    if (t1 && t2) {
      std::cout << "Error invalid input data\n";
      return {};
    }
    auto v0lp = vec2(l.vectors[0].x + l.point.x, l.vectors[0].y + l.point.y);
    auto v1lp = vec2(l.vectors[1].x + l.point.x, l.vectors[1].y + l.point.y);

    auto v0rp = vec2(r.vectors[0].x + r.point.x, r.vectors[0].y + r.point.y);
    auto v1rp = vec2(r.vectors[1].x + r.point.x, r.vectors[1].y + r.point.y);

    if (!t1 && !t2) { // neither divide
      // all combinations possible 11, 10, 01, 00
      if (math::dividesRightOfLine(l.a, l.b, r.a, r.b))
      {
        left.push_back(math::createLine(l.point, v1lp));
      }
      else
      {
        left.push_back(math::createLine(l.point, v0lp));
      }

      if (math::dividesRightOfLine(r.a, r.b, l.a, l.b))
      {
        right.push_back(math::createLine(r.point, v1rp));
      }
      else
      {
        right.push_back(math::createLine(r.point, v0rp));
      }

    }
    else if (t1)
    {
      left.push_back(math::createLine(l.point, v1lp));
      left.push_back(math::createLine(l.point, v0lp));
      if (math::dividesRightOfLine(r.a, r.b, l.a, l.b))
      {
        right.push_back(math::createLine (r.point, v1rp));
      }
      else
      {
        right.push_back(math::createLine (r.point, v0rp));
      }
    }
    else
    { // r intersects l
      right.push_back(math::createLine (r.point, v1rp));
      right.push_back(math::createLine (r.point, v0rp));
      if (math::dividesRightOfLine(l.a, l.b, r.a, r.b))
      {
        left.push_back(math::createLine(l.point, v1lp));
      }
      else
      {
        left.push_back(math::createLine(l.point, v0lp));
      }
    }
    return math::intersectLeftRightLines(left, right);
  }

  struct vec2_x_less_than
  {
    inline bool operator() (const vec2& struct1, const vec2& struct2)
    {
      return struct1.x < struct2.x;
    }
  };

  std::vector<vec4> rotateZ(decimal_t theta)
  {
    auto radians = theta * (std::atan(1)*4) / 180.0;
    // double c = 0.0;
    // if ( std::abs(theta) == 90)
    //   c = 0.0;
    // else
    //   c = std::cos(radians);
    auto c = std::cos(radians);
    auto s = std::sin(radians);
    return {vec4( c,   -s, 0.0, 0.0),
            vec4( s,    c, 0.0, 0.0),
            vec4(0.0, 0.0, 1.0, 0.0),
            vec4(0.0, 0.0, 0.0, 1.0) };
  }
} // anonymous namespace

namespace math
{
  // std::map<std::string, Bisector> g_bisectorsMemo;

  decimal_t getEventY(Event const& e)
  {
    if (e.type == EventType_e::POINT)
    {
      return e.point.y;
    }
    return e.a.y;
  }

  decimal_t crossProduct(vec2 const& v1, vec2 const& v2)
  {
    return v1.x * v2.y - v1.y * v2.x;
  }

  vec4 mult(std::vector<vec4> const& matrix, vec4 const& v4)
  {
    std::vector<decimal_t> rslt;
    for (auto&& row : matrix)
    {
      decimal_t sum = 0.0;
      sum += row.x * v4.x;
      sum += row.y * v4.y;
      sum += row.z * v4.z;
      sum += row.w * v4.w;
      rslt.push_back(sum);
    }
    return vec4(rslt[0], rslt[1], rslt[2], rslt[3]);
  }

  bool isRightOfLine(vec2 const& upper, vec2 const& lower, vec2 const& p)
  {
    auto v1 = vec2(upper.x - lower.x, upper.y - lower.y);
    auto v2 = vec2(p.x - lower.x, p.y - lower.y);
    auto z = crossProduct(v1, v2);
    return z < 0;
  }

  std::vector<vec2> getPointsRightOfLine(vec2 const& a, vec2 const& b, std::vector<vec2> points)
  {
    std::vector<vec2> rslt;
    for (auto&& p : points)
    {
      if (isRightOfLine(a,b,p))
        rslt.push_back(p);
    }
    return rslt;
  }

  std::vector<vec2> getPointsLeftOfLine(vec2 const& a, vec2 const& b, std::vector<vec2> points)
  {
    std::vector<vec2> rslt;
    for (auto&& p : points)
    {
      if (!isRightOfLine(a,b,p))
        rslt.push_back(p);
    }
    return rslt;
  }

  bool dividesRightOfLine(vec2 const& a1, vec2 const& b1, vec2 const& a2, vec2 const& b2)
  {
    return isRightOfLine(a1, b1, a2) && isRightOfLine(a1, b1, b2);
  }

  std::vector<vec2> filterBySiteAssociation(Event const& s1, Event const& s2, Event const& s3, std::vector<vec2> const& points)
  {
    // for each associated node
    auto sLeft = sharedSegment(s1, s2);
    auto sRight = sharedSegment(s2, s3);
    if (sLeft && sRight) return points;
    if (!sLeft && !sRight) return points;

    if (sLeft) {
      if (s2.type == EventType_e::SEG) {
        return equiv2(s2.b, s1.point) ? getPointsRightOfLine(sLeft->a, sLeft->b, points)
          : getPointsLeftOfLine(sLeft->a, sLeft->b, points);
      } else {
        return equiv2(s2.point, s1.a) ? getPointsRightOfLine(sLeft->a, sLeft->b, points)
        : getPointsLeftOfLine(sLeft->a, sLeft->b, points);
      }
    }
    // sRight otherwise
    if (s2.type == EventType_e::SEG) {
      return equiv2(s2.b, s3.point) ? getPointsLeftOfLine(sRight->a, sRight->b, points)
        : getPointsRightOfLine(sRight->a, sRight->b, points);
    } else {
      return equiv2(s2.point, s3.a) ? getPointsLeftOfLine(sRight->a, sRight->b, points)
      : getPointsRightOfLine(sRight->a, sRight->b, points);
    }
  }

  std::vector<decimal_t> quadratic(decimal_t const& a, decimal_t const& b, decimal_t const& c)
  {
    decimal_t thresh = 1e-3;
    if (a == 0.0) return {0.0};
    auto disc = b * b - 4 * a * c;
    if (disc < -thresh) {
      return {};
    }
    if (std::abs(disc) < thresh) {
      return {(-b)/(2*a)};
    }
    auto sdisc = std::sqrt(disc);
    return {(-b+sdisc)/(2*a), (-b-sdisc)/(2*a)};
  }

  vec2 transformVector(vec2 v, GeneralParabola const& genP)
  {
    if (genP.theta == 0) return v;

    vec4 v4 = vec4(v.x, v.y, 0.0, 0.0);
    // auto val = math::mult(genP.Rz, v4);
    auto val = mult(genP.Rz, v4);
    // Not sure why w is getting set to 1.
    // v[3] = 0;
    return vec2(val.x, val.y); // Do we need z,w?
  }

  vec2 transformPoint(vec2 p, GeneralParabola const& genP)
  {
    if (genP.theta == 0) return p;

    // Don't remove this code. It explains what we're doing below.
    // var M = translate(this.h, 2*this.k, 0);
    // M = mult(M, rotateZ(degrees(-this.theta)));
    // M = mult(M, translate(-this.focus.x, -this.focus.y, 0));
    // p = mult(M, vec4(p));

    vec4 p4(p.x, p.y, 0.0, 0.0);
    p4.x += -genP.focus.x;
    p4.y += -genP.focus.y;
    p4 = mult(genP.Rz, p4);
    p4.x += genP.h;
    p4.y += 2 * genP.k;
    // genP.type = "general_parabola";
    return vec2(p4.x, p4.y);
  }

  vec2 untransformPoint(vec2 p, GeneralParabola const& genP)
  {
    if (genP.theta == 0) return p;
    vec4 newP(p.x, p.y, 0.0, 0.0);
    newP.x += -genP.h;
    p.y += -2 * genP.k;
    auto rslt = mult(genP.nRz, newP);
    rslt.x += genP.focus.x;
    rslt.y += genP.focus.y;
    return vec2(rslt.x, rslt.y); // Do we need z,w?
  }

  std::vector<decimal_t> lpIntersect(decimal_t h, decimal_t k, decimal_t p, vec2 const& q, vec2 const& v)
  {
    if (p == 0.0)
    {
      std::cout << "Non-value p returning empty tvals\n";
      return {};
    }
    auto p4 = 4 * p;
    auto a = v.x * v.x / p4;
    auto b = 2 * v.x * (q.x - h) / p4 - v.y;
    auto c = (q.x * q.x - 2 * q.x * h + h * h) / p4 + k - q.y;
    auto tvals = quadratic(a, b, c);
    return tvals;
  }

  std::shared_ptr<vec2> intersectLines(vec2 const& p1, vec2 const& p2, vec2 const& p3, vec2 const& p4)
  {
    auto x1 = p1.x;
    auto x2 = p2.x;
    auto x3 = p3.x;
    auto x4 = p4.x;
    auto y1 = p1.y;
    auto y2 = p2.y;
    auto y3 = p3.y;
    auto y4 = p4.y;
    auto denom = (x1-x2)*(y3-y4)-(y1-y2)*(x3-x4);
    // originally 1e-6 but more precision has been needed
    if (std::abs(denom) < 1e-14){
      return nullptr;
    }
    auto x = ((x1*y2-y1*x2)*(x3-x4) - (x1-x2)*(x3*y4-y3*x4))/denom;
    auto y = ((x1*y2-y1*x2)*(y3-y4) - (y1-y2)*(x3*y4-y3*x4))/denom;
    return std::make_shared<vec2>(x, y);
  }

  std::vector<vec2> intersectLeftRightLines(std::vector<Bisector> const& leftLines, std::vector<Bisector> const& rightLines)
  {
    std::vector<vec2> result;
    for (auto&& ll : leftLines)
    {
      for (auto&& rl : rightLines)
      {
        auto pOptIntersect = intersectLines(ll.p1, ll.p2, rl.p1, rl.p2);
        if (pOptIntersect)
        {
          result.push_back(*pOptIntersect.get());
        }
      }
    }
    return result;
  }

  std::vector<vec2> ppIntersect(decimal_t h1, decimal_t k1, decimal_t p1, decimal_t h2, decimal_t k2, decimal_t p2)
  {
    // Check for degenerate parabolas
    // WATCH VALUE
    const double EPSILON = 0.00000001;
    if (std::abs(p1) < EPSILON)
    {
      if (std::abs(p2) < EPSILON)
      {
        // Both parabolas have no width
        return {};
      }
      auto x = h1;
      auto y = parabola_f(x, h2, k2, p2);
      return {vec2(x, y)};
    }
    else if (std::abs(p2) < EPSILON)
    {
      auto x = h2;
      auto y = parabola_f(x, h1, k1, p1);
      return {vec2(x, y)};
    }

    auto a = 0.25*(1.0/p1 - 1.0/p2);
    auto b = 0.5*(h2/p2 - h1/p1);
    auto c = 0.25*(h1*h1/p1 - h2*h2/p2) + k1 - k2;
    auto tvals = quadratic(a, b, c);
    std::vector<vec2> ret;
    for (auto&& x : tvals)
    {
      auto y = parabola_f(x, h1, k1, p1);//(x-h1)*(x-h1)/(4*p1) + k1;
      ret.push_back({x, y});
    }
    return ret;
  }

  std::vector<vec2> intersectRay(GeneralParabola const& genP, vec2 origin, vec2 v)
  {
    auto p = transformPoint(origin, genP);
    auto vec = transformVector(v, genP);

    auto tvals = lpIntersect(genP.h, genP.k, genP.p, p, vec);
    // Sort tvals in increasing order
    if (tvals.size() == 2 && tvals[1] < tvals[0]) {
      tvals = {tvals[1], tvals[0]};
    }

    std::vector<vec2> ret;

    for (auto&& t : tvals)
    {
      if (t == 0) {
        // horizontal or vertical direction
        // derive y
        auto y = parabola_f(p.x, genP.h, genP.k, genP.p);
        vec2 pt(p.x, y);
        pt = untransformPoint(pt, genP);
        ret.push_back(pt);
      } else if (std::abs(t < 1e10)) {
        auto q = vec2(p.x + (v.x * t), p.y + (v.y * t));
        // var q = add(p, mult(v, t));
        q = untransformPoint(q, genP);
        ret.push_back(q);
      }
    }
    return ret;
  }

  // The ray is given in parametric form p(t) = p + tv
  std::vector<vec2> intersectRay(Parabola& para, vec2 p, vec2 v)
  {
    if (para.p == 0.0)
    {
      // TODO is this needed?
      std::cout << "intersect para update...\n";
      para.p = 1e-10;
    }

    auto tvals = lpIntersect(para.h, para.k, para.p, p, v);

    if (tvals.empty())
    {
      return {};
    }
    // Sort tvals in increasing order
    if (tvals.size() == 2 && tvals[1] < tvals[0])
    {
      tvals = {tvals[1], tvals[0]};
    }

    std::vector<vec2> ret;
    for (auto&& t : tvals)
    {
      auto q = vec2(p.x + (v.x * t), p.y + (v.y * t));
      ret.push_back(q);
    }
    return ret;
  }

  std::vector<vec2> vpIntersect(V const& v, Parabola& p)
  {
    std::vector<vec2> ret;
    auto origin = v.point;
    // vectors are in parametric form
    for (auto vec : v.vectors)
    {
      auto o = intersectRay(p, origin, vec);
      ret.insert(ret.end(), o.begin(), o.end());
    }
    return ret;
  }

  std::vector<vec2> vvIntersect(V const& v1, V const& v2)
  {
    auto s1 = makeSegment(v1.b, v1.a, 0, true);
    auto s2 = makeSegment(v2.b, v2.a, 0, true);

    auto optConnection = connected(s1, s2);
    if (optConnection) {
      auto a_b = vec2(v1.a.x - v1.b.x, v1.a.y - v1.b.x);
      auto b_b0 = vec2(v2.b.x - v1.b.x, v2.b.x - v1.b.x);
      auto b_a1 = vec2(v2.a.x - v1.b.x, v2.a.y - v1.b.x);

      // z area between this and obj
      auto zArea = crossProduct(a_b, b_b0) + crossProduct(a_b, b_a1);
      if (zArea == 0) {
        return {v1.point};
      }
      // choose this v left or right based on zArea
      auto bisector = smallAngleBisectSegments(s1, s2, optConnection);

      // often P is too close to p2 increment the height by a 0.01 to get a better width for each vector
      if (zArea < 0) {
        // segment right
        auto pPrime = vec2(f_y(v1, v1.a.y + 0.01)[1], v1.a.y + 0.01);
        auto pI = intersectLines(v1.point, pPrime, bisector.p1, bisector.p2);
        if (!pI) throw std::runtime_error("Invalid intersection V to V");
        return {*pI};
      } else {
        // segment left
        auto pPrime = vec2(f_y(v1, v1.a.y + 0.01)[0], v1.a.y + 0.01);
        auto pI = intersectLines(v1.point, pPrime, bisector.p1, bisector.p2);
        if (!pI) throw std::runtime_error("Invalid intersection V to V");
        return {*pI};
      }
    } else {
      auto intersections = getLineIntersections(v1, v2);
      std::vector<vec2> vPts;
      for (auto&& i : intersections)
      {
        if (i.y >= v1.point.y)
          vPts.push_back(i);
      }
      if (vPts.empty()) return {};
      return vPts;
    }
  }

  std::vector<vec2> vbIntersect(V const& v, Bisector const& line)
  {
    std::vector<vec2> ret;
    auto origin = v.point;
    for (auto vec : v.vectors)
    {
      auto r = math::intersectLines(origin, vec, line.p1, line.p2);
      if (r)
        ret.push_back(*r);
    }
    return ret;
  }

  double getAngle(Event s, bool consider_order)
  {
    auto p1 = s.b; // lower point
    auto p2 = s.a; // upper point
    if (p1.y == p2.y) return 0;
    if (consider_order && p1.y > p2.y) {
      return std::atan2(p1.y-p2.y, p1.x-p2.x);
    }
    return std::atan2(p2.y-p1.y, p2.x-p1.x);
  }

  bool dividesPoints(vec2 v, vec2 origin, vec2 p1, vec2 p2)
  {
    auto v1 = vec2(p1.x - origin.x, p1.y - origin.y);
    auto v2 = vec2(p2.x - origin.x, p2.y - origin.y);
    auto c0 = crossProduct(v, v1);
    auto c1 = crossProduct(v, v2);
    return (c0 < 0 && c1 > 0) || (c0 > 0 && c1 < 0);
  }

  bool fallsInBoundary(vec2 A, vec2 B, vec2 point)
  {
    if (equivD(A.x, B.x))
    {
      return point.y < A.y && point.y > B.y;
    }

    auto AB = vec2(B.x - A.x, B.y - A.y);
    auto BA = vec2(A.x - B.x, A.y - B.y);
    auto BP = vec2(point.x - B.x, point.y - B.y);
    auto AP = vec2(point.x - A.x, point.y - A.y);

    // if the angle between AB and AP > 90 or BA and BP > 90
    // then the point is outside of the boundary
    auto r0 = getAngleBetweenTwoVec(AB, AP);
    auto r1 = getAngleBetweenTwoVec(BA, BP);
    // 1.5708 is 90 degrees in radians
    return r0 < 1.5708 && r1 < 1.5708;
  }

  decimal_t distLine(vec2 p, vec2 a, vec2 b)
  {
    if (fallsInBoundary(a, b, p))
    {
      // get the equation of the line from the segment ax + by + c = 0
      // (y1 - y2)x + (x2 - x1)y + (x1y2 - x2y1) = 0
      auto a2 = a.y - b.y;
      auto b2 = b.x - a.x;
      auto c = a.x * b.y - b.x * a.y;
      auto n = std::abs(a2 * p.x + b2 * p.y + c);
      auto dn = std::sqrt(a2*a2 + b2*b2);
      return n/dn;
    }
    else
    {
      return std::min(dist(a, p), dist(b, p));
    }
  }

  std::vector<vec2> filterVisiblePoints(Event const& site, std::vector<vec2> const& points)
  {
    if (points.size() < 1) return {};

    if (site.type != EventType_e::SEG) return points;
    // WATCH VALUE
    // Some equi points can have a certain degree of error
    // account for that error using a tolerance vector
    auto tolerance = 1.00001;
    // new updated vector = (a-b) * scale + a
    auto A = vec2(
      ((site.a.x-site.b.x) * tolerance) + site.b.x,
      ((site.a.y-site.b.y) * tolerance) + site.b.y);

    auto B = vec2(
      ((site.b.x-site.a.x) * tolerance) + site.a.x,
      ((site.b.y-site.a.y) * tolerance) + site.a.y);

    std::vector<vec2> rslt;
    for (auto&& p : points)
    {
      if (fallsInBoundary(A,B,p))
        rslt.push_back(p);
    }
    return rslt;
  }

  bool intersectsTargetSegments(Event const& s1, Event const& s2)
  {
    // if the intersection is on the line of the target
    auto i = intersectLines(s1.a, s1.b , s2.a, s2.b);
    // if the intersection is within the y bounds
    // only works for non-horizontal lines
    if (!i)
    {
      // most likely the lines are parallel
      return false;
    }
    return (betweenValue(i->y, s2.a.y, s2.b.y) && betweenValue(i->x, s2.a.x, s2.b.x))
          || (betweenValue(i->y, s1.a.y, s1.b.y) && betweenValue(i->x, s1.a.x, s1.b.x));
  }

  Bisector bisectPointSegment(vec2 p, vec2 a, vec2 b)
  {
    if ((equivD(p.x, a.x) && equivD(p.y, a.y)) ||
        (equivD(p.x, b.x) && equivD(p.y, b.y)))
    {
      // special case: point is a segment endpoint
      auto v0 = vec2(b.x - a.x, b.y - a.y);

      // Get both bisecting sides clockwise and counter clockwise
      auto v1 = vec2(v0.y, -v0.x);
      auto v2 = vec2(-v0.y, v0.x);
      auto v1p = vec2(v1.x+p.x, v1.y+p.y);
      auto v2p = vec2(v2.x+p.x, v2.y+p.y);
      return createLine(v1p, v2p);
    }

    if (dot(subtract(p, a), normalize(subtract(a, b))) ==
        length(subtract(p, a)))
    {
      // special case: line and point are collinear
      if (length(subtract(p, a)) < length(subtract(p, b))) {
        // if p is closer to a...
        return bisectPoints(p, a);
      } else {
        // if p is closer to b...
        return bisectPoints(p, b);
      }
    }
    return createGeneralBisector(p, a, b);
  }

  double getSegmentsBisectorAngle(Event const& s, Event const& t)
  {
    auto stheta = getAngle(s, false);
    auto ttheta = getAngle(t, false);
    auto p = pi();
    if (stheta < 0) stheta += p*2;
    if (ttheta < 0) ttheta += p*2;
    if (ttheta < stheta)
    {
      ttheta += 2.0 * p;
    }
    auto beta = (stheta + ttheta) / 2.0;
    return beta;
  }

  Bisector bisectPoints(vec2 p1, vec2 p2)
  {
    auto v = vec2(p2.x - p1.x, p2.y - p1.y);

    auto q = vec2((v.x*0.5) + p1.x, v.y*0.5 + p1.y);
    if (v.y > 0)
    {
      v = negate(v);
    }
    // Get both bisecting sides clockwise and counter clockwise
    // Testing multiple of 2 for better intersection detection effect
    auto v1 = vec2((v.y*2) + q.x, (-v.x*2) + q.y);
    auto v2 = vec2((-v.y*2) + q.x, (v.x*2) + q.y);
    return createLine(v1, v2);
  }

  Bisector smallAngleBisectSegments(Event s1, Event s2, std::shared_ptr<vec2> optIntersect)
  {
    if (parallelTest(s1, s2))
    {
      return getAverage(s1, s2);
    }
    // get the closest points
    auto d1 = dist(s1.a, s2.a);
    auto d2 = dist(s1.a, s2.b);
    auto d3 = dist(s1.b, s2.a);
    auto d4 = dist(s1.b, s2.b);
    if (d1 < d2 && d1 < d3 && d1 < d4)
    {
      // do nothing
    }
    else if (d2 < d1 && d2 < d3 && d2 < d4)
    {
      s2 = makeSegment(s2.b, s2.a, 0, true);
    }
    else if (d3 < d1 && d3 < d2 && d3 < d4)
    {
      s1 = makeSegment(s1.b, s1.a, 0, true);
    }
    else if (d4 < d1 && d4 < d2 && d4 < d3)
    {
      s1 = makeSegment(s1.b, s1.a, 0, true);
      s2 = makeSegment(s2.b, s2.a, 0, true);
    }

    auto beta = getSegmentsBisectorAngle(s1, s2);
    auto v = vec2(std::cos(beta), std::sin(beta));
    auto p = optIntersect ? optIntersect : intersectLines(s1.a, s1.b, s2.a, s2.b);
    if (!p)
    {
      std::cout << "Unable to determine intersection between segments: "
                << s1.id << " and " << s2.id << " - using average" << std::endl;
      return getAverage(s1, s2);
    }
    auto v2 = vec2(p->x + v.x, p->y + v.y);
    // auto l = new Line(p, add(p, v));
    return createLine(*p, v2);
  }

  // TODO performance - perhaps use memoization for segment bisectors?
  std::vector<Bisector> bisectSegments2(Event const& s1, Event const& s2)
  {
    // if connected segments
    auto optCon = connected(s1, s2);
    if (optCon)
    {
      return {smallAngleBisectSegments(s1, s2, optCon)};
    }

    auto bLine = smallAngleBisectSegments(s1, s2);
    // auto s = bisectData.line;
    // the line for the large angle is perpendicular to the small angle bisector
    vec2 a(bLine.p1), b(bLine.p2);
    if (bLine.p2.y > bLine.p1.y)
    {
      a = vec2(bLine.p2);
      b = vec2(bLine.p1);
    }
    auto AB = vec2(b.x - a.x, b.y - a.y);

    auto v1Clockwise = vec2(AB.y, -AB.x); // 90 degrees perpendicular
    auto v1CounterClockwise = vec2(-AB.y, AB.x);
    auto intersect = optCon ? optCon : intersectLines(s1.a, s1.b, s2.a, s2.b);
    if (!intersect)
      return {bLine};

    auto v1 = vec2(v1Clockwise.x + intersect->x, v1Clockwise.y + intersect->y);
    auto v2 = vec2(v1CounterClockwise.x + intersect->x, v1CounterClockwise.y + intersect->y);
    return {bLine, createLine(v1, v2)};
  }

   Bisector bisect(Event const& e1, Event const& e2)
  {
    auto abId = std::to_string(e1.id) + std::to_string(e2.id);
    // auto found = g_bisectorsMemo.find(abId); // PERFORMANCE (opt)
    // if (found != g_bisectorsMemo.end())
    // {
    //   return (*found).second;
    // }
    Bisector b{false, nullptr, vec2(0.0, 0.0),
              vec2(0.0, 0.0), vec2(0.0, 0.0)};
    if (e1.type == EventType_e::POINT && e2.type == EventType_e::POINT)
    {
      b = bisectPoints(e1.point, e2.point);
    }
    else if (e1.type == EventType_e::POINT && e2.type == EventType_e::SEG)
    {
      b = bisectPointSegment(e1.point, e2.a, e2.b);
    }
    else if (e2.type == EventType_e::POINT && e1.type == EventType_e::SEG)
    {
      b = bisectPointSegment(e2.point, e1.a, e1.b);
    }
    else
    {
      throw std::runtime_error("Invalid bisectors");
    }
    // g_bisectorsMemo.emplace(abId, b);
    return b;
  }

  std::vector<vec2> intersect(Bisector const& a, Bisector const& b)
  {
    if (a.isLine && b.isLine)
    {
      auto pInt = intersectLines(a.p1, a.p2, b.p1, b.p2);
      if (!pInt)
      {
        // Most likely the lines are parallel in which case they should not
        // intersect
        return {};
      }
      return {*pInt};
    }

    if (a.isLine)
    {
      if (!b.optGeneralParabola) throw std::runtime_error("Invalid Intersection b");
      return intersectRay(*b.optGeneralParabola, a.p1, a.v);
    }

    if (b.isLine)
    {
      if (!a.optGeneralParabola) throw std::runtime_error("Invalid Intersection c");
      return intersectRay(*a.optGeneralParabola, b.p1, b.v);
    }
    throw std::runtime_error("invalid intersection d");
    return {};
  }

  std::vector<vec2> equidistant(Event const& a, Event const& b, Event const& c)
  {
    std::vector<Event> segments, points;
    for (auto&& e : {a,b,c})
    {
      if (e.type == EventType_e::POINT)
        points.push_back(e);
      if (e.type == EventType_e::SEG)
        segments.push_back(e);
    }
    // Bisecting types can be either lines or parabolas - lines are preferred
    if (points.size() == 1)
    {
      if (parallelTest(segments[0], segments[1]))
      {
        return intersect(getAverage(segments[0], segments[1]),
          bisect(segments[0], points[0]));
      }
      else
      {
        if (equiv2(points[0].point,segments[1].a) || equiv2(points[0].point ,segments[1].b))
        {
          auto b1 = bisect(segments[1], points[0]); // line preferred
          auto blines = bisectSegments2(segments[0], segments[1]);
          std::vector<vec2> ii;
          for (auto&& line : blines)
          {
            auto i = intersect(line, b1);
            ii.insert(ii.begin(), i.begin(), i.end());
          }
          return ii;
        }
        // otherwise default
        auto b1 = bisect(segments[0], points[0]);
        auto blines = bisectSegments2(segments[0], segments[1]);
        std::vector<vec2> ii;
        for (auto&& line : blines)
        {
          auto i = intersect(line, b1);
          ii.insert(ii.begin(), i.begin(), i.end());
        }
        return ii;
      }
    }
    else if (segments.size() == 1)
    {
      if (equiv2(points[1].point, segments[0].a) || equiv2(points[1].point, segments[0].b))
      {
        return intersect(bisect(segments[0], points[1]), bisect(points[0], points[1]));
      }
      return intersect(bisect(segments[0], points[0]), bisect(points[0], points[1]));
    }
    else if (segments.size() == 3)
    {
      auto l = bisectSegments2(a, b);
      auto r = bisectSegments2(b, c);
      if (l.size() == 0 || r.size() == 0) return {};
      return intersectLeftRightLines(l, r);
    }
    return intersect(bisect(a, b), bisect(b, c));
  }
}

/////////////////////// V
V::V(vec2 p1, vec2 p2, decimal_t directrix, uint32_t id)
  : point(0.0, 0.0), a(0.0, 0.0), b(0.0, 0.0),
  vectors(), id(id)
{
  a = p2;
  b = p1;
  if (p1.y > p2.y)
  {
    a = p1;
    b = p2;
  }
  Event directrixSeg(EventType_e::SEG, 0, vec2(0.0,0.0), vec2(-1.0, directrix), vec2(1.0, directrix));
  auto optP = math::intersectLines(a, b, directrixSeg.a, directrixSeg.b);
  if (!optP) throw std::runtime_error("Invalid V");
  point = *optP;
  Event s1(EventType_e::SEG, 0, vec2(0.0,0.0), a, b);
  auto theta = math::getSegmentsBisectorAngle(directrixSeg, s1);

  auto PI = math::pi();
  while (theta > 0) theta -= PI/2;
  while (theta < 0) theta += PI/2;
  for (auto&& t : {theta + PI/2, theta})
  {
    vectors.push_back(vec2(std::cos(t), std::sin(t)));
  }
}

decimal_t f_x(V const& v, decimal_t x)
{
  vec2 vec(0.0, 0.0);
  if (x < v.point.x) {
    vec = v.vectors[0];
  } else {
    vec = v.vectors[1];
  }
  return v.point.y + vec.y * (x - v.point.x) / vec.x;
}

std::vector<decimal_t> f_y(V const& v, decimal_t y)
{
  if (y < v.point.y) return {v.point.x};
  if (y == v.point.y) return {v.point.x};
  auto tY = v.point.y;
  auto tX = v.point.x;
  std::vector<decimal_t> ret;
  for (auto&& vec : v.vectors)
  {
    ret.push_back(tX + vec.x*(y-tY)/vec.y);
  }
  return ret;
}

//////////////// PARABOLA

Parabola::Parabola(vec2 focus, decimal_t h, decimal_t k, decimal_t p, uint32_t id)
  : focus(focus), h(h), k(k), p(p), id(id)
{}

/////////////// GENERAL PARABOLA

GeneralParabola::GeneralParabola(vec2 focus, decimal_t h, decimal_t k,
                  decimal_t p, decimal_t theta, uint32_t id)
  : focus(focus), h(h), k(k), p(p), theta(theta), Rz(), nRz(), id(id)
{
  Rz = rotateZ(-theta);
  nRz = rotateZ(theta);
}

std::vector<vec2> prepDraw(V const& v,  decimal_t const& x0, decimal_t const& x1)
{
  if (x1 < -1.1 || x0 > 1.1) return {};
  auto lx = x0 < -1.1 ? -1.1 : x0;
  auto dx = x1 > 1.1 ? 1.1 : x1;
  if (x0 > v.point.x || v.point.x > x1) return {vec2(x0, f_x(v, x0)), vec2(x1, f_x(v, x1))};
  return {vec2(x0, f_x(v, x0)), v.point, vec2(x1, f_x(v, x1))};
}

std::vector<vec2> prepDraw(Parabola const& p,  decimal_t const& x0, decimal_t const& x1)
{
  if (x1 < -1.1 || x0 > 1.1) return {};
  std::vector<vec2> points;
  auto lx = x0 < -1.1 ? -1.1 : x0;
  auto dx = x1 > 1.1 ? 1.1 : x1;
  for (auto x = lx; x < dx; x += g_xInc)
    points.push_back(vec2(x, math::parabola_f(x, p.h, p.k, p.p)));
  return points;
}

std::vector<vec2> prepDraw(GeneralParabola const& p, vec2 const& origin, vec2 const& dest)
{
  auto x0 = math::transformPoint(origin, p).x;
  auto x1 = math::transformPoint(dest, p).x;
  if (x0 > x1) {
    auto temp = x1;
    x1 = x0;
    x0 = temp;
  }
  // this.parabola.setDrawBounds(x0, x1);
  // this.setDrawPoints();
  std::vector<vec2> points;

  auto lx = x0 < -1.0 ? 1.0 : x0;
  auto dx = x1 > 1.0 ? 1.0 : x1;

  for (auto x = lx; x < dx; x += g_xInc)
    points.push_back(vec2(x, math::parabola_f(x, p.h, p.k, p.p)));

  std::vector<vec2> drawPoints;
  // if (_.isNaN(this.parabola.x0) || _.isNaN(this.parabola.x1)) return;
  for (auto&& pt : points)
  {
    auto newPt = math::untransformPoint(pt, p);
    drawPoints.push_back(newPt);
  }
  return drawPoints;
}
