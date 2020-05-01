#ifndef MATH_HH
#define MATH_HH

#include "types.hh"

#include <cmath>
#include <iostream>
#include <limits>
#include <memory>
#include <string>
#include <vector>
#include <algorithm>

struct V
{
  V(vec2 p1, vec2 p2, decimal_t directrix, uint32_t id);

  vec2 point;
  vec2 a;
  vec2 b;
  std::vector<vec2> vectors;
  uint32_t id;
  // split site?
};

decimal_t f_x(V const& v, decimal_t x);
std::vector<decimal_t> f_y(V const& v, decimal_t y);

std::vector<vec2> prepDraw(V const& v, decimal_t const& x0, decimal_t const& x1);

struct Parabola
{
  Parabola(vec2 focus, decimal_t h, decimal_t k, decimal_t p, uint32_t id);

  vec2 focus;
  decimal_t h;
  decimal_t k;
  decimal_t p;
  uint32_t id;
};

std::vector<vec2> prepDraw(Parabola const& p, decimal_t const& x0, decimal_t const& x1);

struct GeneralParabola
{
  GeneralParabola(vec2 focus, decimal_t h, decimal_t k,
                  decimal_t p, decimal_t theta, uint32_t id);

  vec2 focus;
  decimal_t h;
  decimal_t k;
  decimal_t p;
  decimal_t theta;
  std::vector<vec4> Rz;
  std::vector<vec4> nRz;
  private:
  uint32_t id;
};

std::vector<vec2> prepDraw(GeneralParabola const& p, vec2 const& origin, vec2 const& dest);

namespace math
{
  constexpr double pi() { return std::atan(1)*4; }

  decimal_t getEventY(Event const& e);

  // return the z component between the two vectors
  decimal_t crossProduct(vec2 const& v1, vec2 const& v2);

  inline decimal_t dot(vec2 const &a, vec2 const &b)
  {
    return a.x*b.x + a.y*b.y;
  }
  inline decimal_t length(vec2 const &v) { return std::sqrt(dot(v,v)); }

  inline vec2 normalize(vec2 v)
  {
    auto r = length(v);
    return vec2(v.x/r, v.y/r);
  }

  inline vec2 subtract(vec2 const& v1, vec2 const& v2)
  {
    return vec2(v1.x - v2.x, v1.y - v2.y);
  }

  inline vec2 negate(vec2 const& u)
  {
    return vec2(-u.x, -u.y);
  }

  inline double radians (int degrees)
  {
    return degrees * pi() / 180.0;
  }

  inline double degrees(double radians)
  {
    return radians * 180.0 / pi();
  }

  inline decimal_t parabola_f(decimal_t x, decimal_t h, decimal_t k, decimal_t p)
  {
    return (x - h) * (x - h) / (4 * p) + k;
  }

  // either a line or a point segment bisector
  struct Bisector
  {
    bool isLine;
    std::shared_ptr<GeneralParabola> optGeneralParabola;
    vec2 p1;
    vec2 p2;
    vec2 v;
  };

  //////////////////////////// Create functions /////////////////////////
  inline Event createEventFromNode(std::shared_ptr<Node> const& node)
  {
    // DEBUG ONLY
    // if (node->aType == ArcType_e::EDGE) throw std::runtime_error("Attempt to build event from edge!");
    auto eType = node->aType == ArcType_e::ARC_PARA ? EventType_e::POINT : EventType_e::SEG;
    return eType == EventType_e::POINT ?
     Event(eType, node->label, node->point)
     : Event(eType, node->label, vec2(0.0,0.0), node->a, node->b);
  }

  inline V createV(vec2 a, vec2 b, decimal_t directrix, uint32_t id)
  {
    return {a, b, directrix, id};
  }

  inline Parabola createParabola(vec2 point, decimal_t directrix, uint32_t id)
  {
    // Parabola(vec2 focus, decimal_t h, decimal_t k, decimal_t p, uint32_t id);
    auto h =  point.x; //focus[0];
    auto k = (directrix + point.y) / 2.0;
    auto p = (point.y - directrix) / 2.0;
    return {point, h, k, p, id};
  }

  inline Bisector createLine(vec2 p1, vec2 p2)
  {
    return {true, nullptr, p1, p2, math::normalize(vec2(p2.x - p1.x, p2.y - p1.y))};
  }

  inline Bisector createGeneralBisector(vec2 focus, vec2 a, vec2 b)
  {
    auto v = normalize(vec2(b.x - a.x, b.y - a.y));
    auto v1 = vec2(focus.x - a.x, focus.y - a.y);
    auto z = crossProduct(v, v1);
    if (z < 0)
    {
      v = negate(v);
      z = -z;
    }
    // splitSite = _.get(focus, "label") != _.get(directrix, "label");
    auto zHalf = z/2.0;
    return {false,
            std::make_shared<GeneralParabola>(focus, focus.x,
              zHalf, zHalf, std::atan2(v.y, v.x), g_id++),
            vec2(0.0, 0.0), vec2(0.0, 0.0), vec2(0.0, 0.0)};
  }

  inline std::shared_ptr<Node> createArcNode(Event const& event)
  {
    auto aType = event.type == EventType_e::SEG ? ArcType_e::ARC_V : ArcType_e::ARC_PARA;
    auto pNode = std::make_shared<Node>(aType, event.label);
    if (aType == ArcType_e::ARC_V)
    {
      pNode->a = event.a;
      pNode->b = event.b;
    }
    else
    {
      pNode->point = event.point;
    }
    return pNode;
  }

  inline std::shared_ptr<Node> createEdgeNode(std::shared_ptr<Node> l, std::shared_ptr<Node> r, vec2 startPt)
  {
    auto pEdge = std::make_shared<Node>(ArcType_e::EDGE, 0);
    pEdge->edgeStart = startPt;
    pEdge->pLeft = l;
    pEdge->pRight = r;
    l->pParent = pEdge;
    r->pParent = pEdge;
    return pEdge;
  }

  inline void setChild(std::shared_ptr<Node> parent, std::shared_ptr<Node> child, Side_e side)
  {
    if (side == Side_e::LEFT) {
      child->side = Side_e::LEFT;
      parent->pLeft = child;
    } else {
      child->side = Side_e::RIGHT;
      parent->pRight = child;
    }
    child->pParent = parent;
  }

  inline std::shared_ptr<Node> getChild(std::shared_ptr<Node> parent, Side_e side)
  {
    if (side == Side_e::LEFT) return parent->pLeft;
    return parent->pRight;
  }

  inline bool equivD(decimal_t a, decimal_t b, decimal_t error_factor=1.0)
  {
    return a==b || std::abs(a - b) < std::abs(std::min(a,b)) * std::numeric_limits<decimal_t>::epsilon() * error_factor;
  }

  inline bool equiv2(vec2 const& a, vec2 const& b)
  {
    return equivD(a.x, b.x) && equivD(a.y, b.y);
  }

  inline std::shared_ptr<Event> sharedSegment(Event const& s1, Event const& s2)
  {
    if (s1.type == EventType_e::POINT && s2.type == EventType_e::SEG) {
      return equiv2(s1.point, s2.a) || equiv2(s1.point, s2.b) ? std::make_shared<Event>(s2) : nullptr;
    } else if (s2.type == EventType_e::POINT && s1.type == EventType_e::SEG) {
      return equiv2(s1.a, s2.point) || equiv2(s1.b, s2.point) ? std::make_shared<Event>(s1) : nullptr;
    }
    return nullptr;
  }

  inline decimal_t dist(vec2 a, vec2 b)
  {
    return length(vec2(a.x - b.x, a.y - b.y));
  }

  vec4 mult(std::vector<vec4> const& matrix, vec4 const& v4);

  bool isRightOfLine(vec2 const& upper, vec2 const& lower, vec2 const& p);

  std::vector<vec2> getPointsRightOfLine(vec2 const& a, vec2 const& b, std::vector<vec2> points);

  std::vector<vec2> getPointsLeftOfLine(vec2 const& a, vec2 const& b, std::vector<vec2> points);

  bool dividesRightOfLine(vec2 const& a1, vec2 const& b1, vec2 const& a2, vec2 const& b2);

  std::vector<vec2> filterBySiteAssociation(Event const& s1, Event const& s2, Event const& s3, std::vector<vec2> const& points);

  std::vector<decimal_t> quadratic(decimal_t const& a, decimal_t const& b, decimal_t const& c);

  vec2 transformVector(vec2 v, GeneralParabola const& genP);

  vec2 transformPoint(vec2 p, GeneralParabola const& genP);

  vec2 untransformPoint(vec2 p, GeneralParabola const& genP);

  std::vector<decimal_t> lpIntersect(decimal_t h, decimal_t k, decimal_t p, vec2 const& q, vec2 const& v);

  std::shared_ptr<vec2> intersectLines(vec2 const& p1, vec2 const& p2, vec2 const& p3, vec2 const& p4);
  std::vector<vec2> intersectLeftRightLines(std::vector<Bisector> const& leftLines, std::vector<Bisector> const& rightLines);

  std::vector<vec2> ppIntersect(decimal_t h1, decimal_t k1, decimal_t p1, decimal_t h2, decimal_t k2, decimal_t p2);

  std::vector<vec2> intersectRay(GeneralParabola const& genP, vec2 origin, vec2 v);
  std::vector<vec2> intersectRay(Parabola& para, vec2 p, vec2 v);

  std::vector<vec2> vpIntersect(V const& v, Parabola& p);
  std::vector<vec2> vvIntersect(V const& v1, V const& v2);
  std::vector<vec2> vbIntersect(V const& v, Bisector const& line);

  inline bool betweenValue(decimal_t t, decimal_t a, decimal_t b)
  {
    std::vector<decimal_t> v = {a, b};
    std::sort(v.begin(), v.end());
    return v[0] <= t && t <= v[1];
  }

  double getAngle(Event s, bool consider_order=true);

  // Does the vector v separate p1 and p2 from starting at origin
  bool dividesPoints(vec2 v, vec2 origin, vec2 p1, vec2 p2);

  bool fallsInBoundary(vec2 A, vec2 B, vec2 point);

    // distance from p to line(a-b)
  decimal_t distLine(vec2 p, vec2 a, vec2 b);

  std::vector<vec2> filterVisiblePoints(Event const& site, std::vector<vec2> const& points);

  bool intersectsTargetSegments(Event const& s1, Event const& s2);

  inline double getAngleBetweenTwoVec(vec2 v1, vec2 v2)
  {
    auto d = dot(v1, v2);
    auto m1 = std::sqrt(v1.x * v1.x + v1.y * v1.y);
    auto m2 = std::sqrt(v2.x * v2.x + v2.y * v2.y);
    return std::acos(d/m1*m2);
  }

  inline std::shared_ptr<vec2> connected(Event const& s1, Event const& s2)
  {
    if (equiv2(s1.a, s2.a) || equiv2(s1.a, s2.b)) {
      return std::make_shared<vec2>(s1.a);
    }
    else if (equiv2(s1.b, s2.a) || equiv2(s1.b, s2.b))
    {
      return std::make_shared<vec2>(s1.b);
    }
    return nullptr;
  }

  Bisector bisectPointSegment(vec2 p, vec2 a, vec2 b);

  double getSegmentsBisectorAngle(Event const& s, Event const& t);

  Bisector bisectPoints(vec2 p1, vec2 p2);

  Bisector smallAngleBisectSegments(Event s1, Event s2, std::shared_ptr<vec2> optIntersect = nullptr);
  std::vector<Bisector> bisectSegments2(Event const& s1, Event const& s2);

  inline bool parallelTest(Event const& s1, Event const& s2)
  {
    auto l1 = createLine(s1.a, s1.b);
    auto l2 = createLine(s2.a, s2.b);
    return equiv2(l1.v, l2.v);
  }

  inline Bisector getAverage(Event const& s1, Event const& s2)
  {
    auto p1 = vec2(((s1.a.x + s2.a.x) / 2.0), ((s1.a.y + s2.a.y) / 2.0));
    auto p2 = vec2(((s1.b.x + s2.b.x) / 2.0), ((s1.b.y + s2.b.y) / 2.0));
    return createLine(p1, p2);
  }

  Bisector bisect(Event const& e1, Event const& e2);

  std::vector<vec2> intersect(Bisector const& a, Bisector const& b);

  std::vector<vec2> equidistant(Event const& a, Event const& b, Event const& c);

  //////////////////////// Sorting structs ////////////////////////////
  struct vec2_x_less_than
  {
    inline bool operator() (vec2 const& lhs, vec2 const& rhs)
    {
      return lhs.x < rhs.x;
    }
  };

  struct event_less_than
  {
    inline bool operator() (Event const& lhs, Event const& rhs) const
    {
      // Y major, x minor
      if (lhs.type == EventType_e::SEG && rhs.type == EventType_e::SEG)
      {
        if (math::equiv2(lhs.a, rhs.a))
        {
          // auto r = math::isRightOfLine(lhs.a, lhs.b, rhs.b);
          auto v1 = vec2(lhs.a.x - lhs.b.x, lhs.a.y - lhs.b.y);
          auto v2 = vec2(rhs.b.x - lhs.b.x, rhs.b.y - lhs.b.y);
          auto z = crossProduct(v1, v2);
          if (z == 0.0) return lhs.b.y < rhs.b.y;
          return z < 0.0;
        }
        else if (lhs.a.y == rhs.a.y) return lhs.a.x < rhs.a.x;
        return lhs.a.y < rhs.a.y;
      }
      else if (rhs.type == EventType_e::SEG)
      {
        if (lhs.point.y == rhs.a.y) return lhs.point.x < rhs.a.x;
        return lhs.point.y < rhs.a.y;
      }
      else if (lhs.type == EventType_e::SEG)
      {
        if (rhs.point.y == lhs.a.y) return rhs.point.x < lhs.a.x;
        return rhs.point.y < lhs.a.y;
      }
      if (lhs.point.y == rhs.point.y) return lhs.point.x < rhs.point.x;
      return lhs.point.y < rhs.point.y;
    }
  };
}

#endif