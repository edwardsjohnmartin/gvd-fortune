#include "fortune.hh"
#include "dataset.hh"
#include "math.hh"
#include "nodeInsert.hh"
#include "utils.hh"

#include <fstream>
#include <limits>
#include <iomanip>

namespace
{
  static std::shared_ptr<Node> root = nullptr;
  static std::vector<std::pair<vec2, vec2>> g_edges;
  static std::vector<std::vector<vec2>> g_curvedEdges;

  bool g_writeParabolas = true;
  bool g_writeVs = true;

  EventPacket getEventPacket(Event const& e, std::vector<Event>& rQueue)
  {
    auto n = rQueue.back(); // right
    auto nn = rQueue[rQueue.size() - 2]; // left
    if (nn.type == EventType_e::SEG && n.type == EventType_e::SEG)
    {
      EventPacket ret = {e, {nn, n}};
      rQueue.pop_back();
      rQueue.pop_back();
      return ret;
    }
    else if (n.type == EventType_e::SEG)
    {
      EventPacket ret = {e, {n}};
      // rQueue.erase(n);
      rQueue.pop_back();
      return ret;
    }
    return {e, {}};
  }

  // ////////////////////////////////////// Close Event Methods /////////////////////////

  bool validDiff(decimal_t diff)
  {
    return diff < 1e-2;
  }

  decimal_t getRadius(vec2 point, std::shared_ptr<Node> const& pl, std::shared_ptr<Node> const& pNode,
                    std::shared_ptr<Node> const& pr)
  {
    if (pl->aType == ArcType_e::ARC_V && pNode->aType == ArcType_e::ARC_V && pr->aType == ArcType_e::ARC_V)
    {
      return std::min(
        std::min(math::distLine(point, pl->a, pl->b), math::distLine(point, pNode->a, pNode->b)),
        math::distLine(point, pr->a, pr->b));
    }
    if (pl->aType == ArcType_e::ARC_PARA)
      return math::dist(point, pl->point);
    else if (pNode->aType == ArcType_e::ARC_PARA)
      return math::dist(point, pNode->point);

    return math::dist(point, pr->point);
  }

  std::shared_ptr<vec2> getIntercept(std::shared_ptr<Node> const& l, std::shared_ptr<Node> const& r, double directrix)
  {
    if (l->aType == ArcType_e::ARC_V && r->aType == ArcType_e::ARC_V)
      return intersectStraightArcs(l, r, directrix);
    else if (l->aType == ArcType_e::ARC_PARA && r->aType == ArcType_e::ARC_PARA)
      return intersectParabolicArcs(l, r, directrix);

    // if one is the endpoint of the other
    return intersectParabolicToStraightArc(l, r, directrix);
  }

  decimal_t getDiff(std::shared_ptr<Node> const& pl, std::shared_ptr<Node> const& pNode,
                    std::shared_ptr<Node> const& pr, vec2 p, double directrix)
  {
    auto radius = getRadius(p, pl, pNode, pr);
    auto newY = p.y - radius;
    auto newYErrorMargin = p.y - (radius + 1e-13);
    // rule out points too far above the directrix
    if (newY > directrix && newYErrorMargin > directrix) return 1e10;

    // Option: or test that left and right intersection
    auto i0 = getIntercept(pl, pNode, newY);
    auto i1 = getIntercept(pNode, pr, newY);
    if (!i0 || !i1) return 1e10;
    // auto diffX = std::abs(i0->x - i1->x);
    // auto diffY = std::abs(i0->y - i1->y);
    // return diffX + diffY;

    // left right test
    if (pNode->aType == ArcType_e::ARC_V)
    {
      if (!math::isRightOfLine(pNode->a, pNode->b, *i0) && math::isRightOfLine(pNode->a, pNode->b, *i1))
        return 1e10;
    }

    auto diff0X = std::abs(i0->x - p.x);
    auto diff0Y = std::abs(i0->y - p.y);
    auto d1 = diff0X + diff0Y;
    auto diff1X = std::abs(i1->x - p.x);
    auto diff1Y = std::abs(i1->y - p.y);
    auto d2 = diff1X + diff1Y;
    return d1 > d2 ? d1 : d2;
  }

  std::shared_ptr<vec2> chooseClosePoint(std::shared_ptr<Node> const& pl, std::shared_ptr<Node> const& pNode,
                  std::shared_ptr<Node> const& pr, std::vector<vec2> points, double directrix)
  {
    if (points.size() == 1) return std::make_shared<vec2>(points[0]);
    decimal_t leastDiff = 10000.0;
    size_t curIdx;
    // length test - the length of node's arc should be close to 0
    // for the correct point
    for (size_t i = 0; i < points.size(); i++)
    {
      auto diff = getDiff(pl, pNode, pr, points[i], directrix);
      if (diff < leastDiff)
      {
        leastDiff = diff;
        curIdx = i;
      }
    }

    if (!validDiff(leastDiff)) return nullptr;
    return std::make_shared<vec2>(points[curIdx]);
  }

  std::vector<vec2> consolidate(std::vector<vec2> const& intersections, decimal_t pivotX)
  {
    std::vector<vec2> ret;
    // WATCH VALUE
    auto thresh = 0.000001;
    std::vector<vec2> left;
    std::vector<vec2> right;
    for (auto&& i : intersections)
    {
      if (i.x < pivotX)
        left.push_back(i);
      else if (i.x > pivotX)
        right.push_back(i);
    }

    if (left.size() == 2)
    {
      auto d = math::dist(left[0], left[1]);
      if (d < thresh)
        ret.push_back(left[0]);
      else
      {
        ret.push_back(left[0]);
        ret.push_back(left[1]);
      }
    }
    else if (left.size() == 1)
      ret.push_back(left[0]);

    if (right.size() == 2)
    {
      auto d = math::dist(right[0], right[1]);
      if (d < thresh)
        ret.push_back(right[0]);
      else
      {
        ret.push_back(right[0]);
        ret.push_back(right[1]);
      }
    }
    else if (right.size() == 1)
      ret.push_back(right[0]);
    return ret;
  }

  std::vector<vec2> getDrawPointsFromBisector(vec2 const& start, vec2 const& end, math::Bisector const& b)
  {
    if (b.isLine) return {start, end};
    // This seems broken...
    return prepDraw(*b.optGeneralParabola, start, end);
  }

  // Commits the final edge points for the closing edge
  // Assumes that edge->drawpoints[0] aka start is set
  void commitEdge(std::shared_ptr<Node> edge, vec2 const& endPoint)
  {
    auto prev = edge->prevArc();
    auto next = edge->nextArc();
    if (!prev || !next) return;

    // only resolve general edges between labeled sites
    if (prev->label == next->label) return;
    // create a bisector from the two sites
    auto prevEvent = math::createEventFromNode(prev);
    auto nextEvent = math::createEventFromNode(next);

    if (prevEvent.type == EventType_e::SEG && nextEvent.type == EventType_e::SEG)
    {
      g_edges.push_back({edge->edgeStart, endPoint});
    }
    else
    {
      auto b = math::bisect(prevEvent, nextEvent);
      auto pts = getDrawPointsFromBisector(edge->edgeStart, endPoint, b);
      if (b.isLine)
        g_edges.push_back({pts[0], pts[1]});
      else
        g_curvedEdges.push_back(pts);
    }
  }

  // TODO optimize for intersect sharing
  void setBeachline(std::shared_ptr<Node> const& pNode, ComputeResult& rslt, double const& sweepline)
  {
    if (!pNode) return;
    if (pNode->visited) return;
    if (pNode->aType == ArcType_e::EDGE)
    {
      pNode->visited = true;
      if (pNode->pLeft) setBeachline(pNode->pLeft, rslt, sweepline);
      if (pNode->pRight) setBeachline(pNode->pRight, rslt, sweepline);
      return;
    }
    else if (pNode->aType == ArcType_e::ARC_PARA)
    {
      auto p = math::createParabola(pNode->point, sweepline, 0);
      decimal_t x0;
      decimal_t x1;
      auto l = pNode->prevArc();
      auto r = pNode->nextArc();
      if (!l)
      {
        auto yDiff = std::abs(pNode->point.y - sweepline);
        x0 = pNode->point.x - yDiff * 2.0;
      }
      if (!r)
      {
        auto yDiff = std::abs(pNode->point.y - sweepline);
        x1 = pNode->point.x + yDiff * 2.0;
      }

      auto o = l ? getIntercept(l, pNode, sweepline) : nullptr;
      auto d = r ? getIntercept(pNode, r, sweepline) : nullptr;
      auto xl = o ? o->x : x0;
      auto xr = d ? d->x : x1;

      // debug only
      // if (xl > xr)
      // {
      //   std::cout << "Something wrong here with parabola\n";
      // }

      auto pts = prepDraw(p, xl, xr);
      if (!pts.empty())
        rslt.b_curvedEdges.push_back(pts);
      pNode->visited = true;
      return;
    }
    else if (pNode->aType == ArcType_e::ARC_V)
    {
      auto v = math::createV(pNode->a, pNode->b, sweepline, 0);
      decimal_t x0;
      decimal_t x1;
      auto l = pNode->prevArc();
      auto r = pNode->nextArc();
      if (!l)
      {
        auto yDiff = std::abs(pNode->a.y - sweepline);
        x0 = v.point.x - yDiff * 2.0;
      }
      if (!r)
      {
        auto yDiff = std::abs(pNode->a.y - sweepline);
        x1 = v.point.x + yDiff * 2.0;
      }

      auto o = l ? getIntercept(l, pNode, sweepline) : nullptr;
      auto d = r ? getIntercept(pNode, r, sweepline) : nullptr;
      auto xl = o ? o->x : x0;
      auto xr = d ? d->x : x1;

      // debug only
      // if (xl > xr)
      // {
      //   std::cout << "Something wrong here with V\n";
      // }

      auto pts = prepDraw(v, xl, xr);
      if (!pts.empty())
        rslt.b_edges.push_back(pts);

      pNode->visited = true;
      return;
    }

    return;
  }
}

void writeResults(ComputeResult const& r, std::string const& ePath)
{
  // write edges
  std::ofstream outE(ePath.c_str(), std::ofstream::out | std::ofstream::trunc | std::ofstream::binary);
  outE << std::setprecision(std::numeric_limits<decimal_t>::digits10 + 1);
  for (auto&& e: r.edges)
  {
    outE << "e\n"; // signal for new edge
    outE << e.first.x << " " << e.first.y << std::endl;
    outE << e.second.x << " " << e.second.y << std::endl;
  }

  for (auto&& ce: r.curvedEdges)
  {
    outE << "ec\n"; // signal for new edge
    for (auto&& ePt : ce)
    {
      outE << ePt.x << " " << ePt.y << std::endl;
    }
  }
  outE << "e";
  outE.close();
}

void writeResults(ComputeResult const& r, std::string const& ePath, std::string const& bPath)
{
  // write edges
  writeResults(r, ePath);

  // write beachline items
  std::ofstream outB(bPath.c_str(), std::ofstream::out | std::ofstream::trunc | std::ofstream::binary);
  outB << std::setprecision(std::numeric_limits<decimal_t>::digits10 + 1);

  if (g_writeVs)
  {
    for (auto&& e: r.b_edges)
    {
      outB << "b\n"; // signal for new edge
      for (auto&& ePt : e)
      {
        outB << ePt.x << " " << ePt.y << std::endl;
      }
    }
  }

  if (g_writeParabolas)
  {
    for (auto&& ce: r.b_curvedEdges)
    {
      outB << "bc\n"; // signal for new edge
      for (auto&& ePt : ce)
      {
        outB << ePt.x << " " << ePt.y << std::endl;
      }
    }
  }

  outB << "b";
  outB.close();
}

void writeResults(ComputeResult const& r, std::string const& pPath, std::string const& ePath, std::string const& bPath)
{
  writeResults(r, ePath, bPath);

  // write polygons
  std::ofstream outP(
          pPath.c_str(),
          std::ofstream::out | std::ofstream::trunc | std::ofstream::binary);
  outP << std::setprecision(std::numeric_limits<decimal_t>::digits10 + 1);
  for (auto&& poly: r.polygons)
  {
    outP << "p\n"; // signal for new polygon
    for (auto&& pt : poly.orderedPointSites)
    {
      outP << pt.point.x << " " << pt.point.y << std::endl;
    }
    auto start = poly.orderedPointSites[0];
    outP << start.point.x << " " << start.point.y << std::endl;
  }

  outP << "p";
  outP.close();
}

void writeResults(ComputeResult const& r, std::string const& pPath,
  std::string const& ePath, std::string const& bPath, std::string const& cPath)
{
  writeResults(r, pPath, ePath, bPath);

  // write close events
  std::ofstream outC(
          cPath.c_str(),
          std::ofstream::out | std::ofstream::trunc | std::ofstream::binary);
  outC << std::setprecision(std::numeric_limits<decimal_t>::digits10 + 1);

  for (auto&& c: r.b_closeEvents)
  {
    // (x,y, yval)
    outC << c.point.x << " " << c.point.y << " " << c.yval << std::endl;
  }

  outC.close();
}

std::shared_ptr<vec2> intersectStraightArcs(std::shared_ptr<Node> l, std::shared_ptr<Node> r, double directrix)
{
  std::vector<vec2> ints; // 644, 114
  auto left = math::createV(l->a, l->b, directrix, l->id);
  auto right = math::createV(r->a, r->b, directrix, r->id);
  ints = math::vvIntersect(left, right);
  if (ints.empty())
  {
    std::cout << "Empty intersections v-v\n";
    return nullptr;
  }

  if (ints.size() == 1) return std::make_shared<vec2>(ints[0]);
  if (ints.size() > 2)
  {
    // get the two ints that are closest to the x value of the left v
    // less than sorts
    std::sort(ints.begin(), ints.end(), [x = right.point.x](vec2 a, vec2 b) {
        return std::abs(x - a.x) < std::abs(x - b.x);
    });
    ints = {ints[0], ints[1]};
  }
  std::sort(ints.begin(), ints.end(), math::vec2_x_less_than());
  auto centX = (ints[0].x + ints[1].x) / 2.0;
  auto prevY = f_x(left, centX);
  auto nextY = f_x(right, centX);
  auto lower = 1;
  if (prevY < nextY)
    lower = 0;
  return std::make_shared<vec2>(ints[1-lower]);
}

std::shared_ptr<vec2> intersectParabolicToStraightArc(std::shared_ptr<Node> l, std::shared_ptr<Node> r, double directrix)
{
  std::vector<vec2> ints;
  if (l->aType == ArcType_e::ARC_PARA)
  {
    auto left = math::createParabola(l->point, directrix, l->id);
    auto right = math::createV(r->a, r->b, directrix, r->id);
    ints = math::vpIntersect(right, left);
    if (ints.empty())
    {
      // use a back-up line since the parabola is probably
      // so narrow that it won't intersect with any ray below p
      if (math::equiv2(l->point, r->a) || (math::equiv2(l->point, r->b) && left.p < 1e-5))
      {
        auto backupLine = math::createLine(vec2(-1, left.focus.y), vec2(1, left.focus.y));
        ints = math::vbIntersect(right, backupLine);
      }
      if (ints.empty())
      {
        std::cout << "0 intersections between p - v\n";
        return nullptr;
      }
    }
    if (ints.size() == 1) return std::make_shared<vec2>(ints[0]);
    if (ints.size() > 2)
    {
      auto x = l->point.x;
      // Test get the center intersections
      ints = consolidate(ints, x);
      if (ints.size() == 1) return std::make_shared<vec2>(ints[0]);
    }

    std::sort(ints.begin(), ints.end(), math::vec2_x_less_than());
    auto idx = 0;
    auto centX = (ints[0].x + ints[1].x) / 2.0;
    auto prevY = math::parabola_f(centX, left.h, left.k, left.p);
    auto nextY = f_x(right, centX);
    auto lower = 1;
    if (prevY < nextY)
      lower = 0;
    idx = 1 - lower;

    // flip the intersection if one is the endpoint of the segment site
    if (math::equiv2(l->point, r->b)) idx = lower;
    return std::make_shared<vec2>(ints[idx]);
  }

  // left is a segment and right is a point
  auto left = math::createV(l->a, l->b, directrix, l->id);
  auto right = math::createParabola(r->point, directrix, r->id);
  ints = math::vpIntersect(left, right);
  if (ints.empty())
  {
    // use a back-up line since the parabola is probably
    // so narrow that it won't intersect with any ray below p
    if (math::equiv2(r->point, l->a) || (math::equiv2(r->point, l->b) && right.p < 1e-5))
    {
      auto backupLine = math::createLine(vec2(-1, right.focus.y), vec2(1, right.focus.y));
      ints = math::vbIntersect(left, backupLine);
    }
    if (ints.empty())
    {
      std::cout << "0 intersections between p - v\n";
      return nullptr;
    }
  }
  if (ints.size() == 1) return std::make_shared<vec2>(ints[0]);
  if (ints.size() > 2)
  {
    auto x = r->point.x;
    // Test get the center intersections
    ints = consolidate(ints, x);
    if (ints.size() == 1) return std::make_shared<vec2>(ints[0]);
  }

  std::sort(ints.begin(), ints.end(), math::vec2_x_less_than());
  auto idx = 0;
  auto centX = (ints[0].x + ints[1].x) / 2.0;
  auto prevY = f_x(left, centX);
  auto nextY = math::parabola_f(centX, right.h, right.k, right.p);
  auto lower = 1;
  if (prevY < nextY)
    lower = 0;
  idx = 1 - lower;

  // flip the intersection if one is the endpoint of the segment site
  if (math::equiv2(r->point, l->b)) idx = lower;
  return std::make_shared<vec2>(ints[idx]);
}

std::shared_ptr<vec2> intersectParabolicArcs(std::shared_ptr<Node> l, std::shared_ptr<Node> r, double directrix)
{
  auto left = math::createParabola(l->point, directrix, l->id);
  auto right = math::createParabola(r->point, directrix, r->id);
  auto ints = math::ppIntersect(left.h, left.k, left.p, right.h, right.k, right.p);

  if (ints.empty())
  {
    throw std::runtime_error("Invalid intersection p-p");
  }
  std::sort(ints.begin(), ints.end(), math::vec2_x_less_than());

  auto centX = (ints[0].x + ints[1].x) / 2.0;
  auto prevY = math::parabola_f(centX, left.h, left.k, left.p);
  auto nextY = math::parabola_f(centX, right.h, right.k, right.p);
  auto lower = 1;
  if (prevY < nextY)
    lower = 0;
  return std::make_shared<vec2>(ints[1-lower]);
}

std::shared_ptr<vec2> intersection(std::shared_ptr<Node> edge, double directrix)
{
  auto l = edge->prevArc();
  auto r = edge->nextArc();
  return getIntercept(l, r, directrix);
}

std::shared_ptr<CloseEvent> createCloseEvent(std::shared_ptr<Node> const& arcNode, double directrix)
{
  if (!arcNode) return nullptr;
  auto left = arcNode->prevArc();
  auto right = arcNode->nextArc();
  if (!left || !right) return nullptr;

  // testing only
  // auto a = left->id;
  // auto b = arcNode->id;
  // auto c = right->id;
  // if (b == 3)
  // if (a == 62 && b == 3 && c == 20)
  //   std::cout << "DEBUG\n";

  vec2 closePoint(0.0, 0.0);
  auto el = math::createEventFromNode(left);
  auto ec = math::createEventFromNode(arcNode);
  auto er = math::createEventFromNode(right);

  // NOTE labels from generated events will not match for connected sites

  if (arcNode->aType == ArcType_e::ARC_PARA
      && left->aType == ArcType_e::ARC_PARA
      && right->aType == ArcType_e::ARC_PARA)
  {
    // All three are points
    auto equi = math::equidistant(el, ec, er);
    if (equi.empty())  return nullptr;
    closePoint = equi.front();
    auto u = math::subtract(left->point, arcNode->point);
    auto v = math::subtract(left->point, right->point);
    // Check if there should be a close event added. In some
    // cases there shouldn't be like when the three sites are colinear
    if (math::crossProduct(u, v) < 0)
    {
      auto r = math::length(math::subtract(arcNode->point, closePoint));
      auto event_y = closePoint.y - r;
      return std::make_shared<CloseEvent>(newCloseEvent(event_y, arcNode, closePoint));
    }
    return nullptr;
  }

  // can compute up to 6 equi points
  auto points = math::equidistant(el, ec, er);

  for (auto&& e : {el, ec, er})
  {
    if (e.type == EventType_e::SEG)
      points = math::filterVisiblePoints(e, points);
  }

  if (points.empty()) return nullptr;

  // filter by site association
  points = math::filterBySiteAssociation(el, ec, er, points);

  if (points.empty()) return nullptr;
  if (points.size() == 1)
  {
    closePoint = points[0];
    auto diff = getDiff(left, arcNode, right, closePoint, directrix);
    if (!validDiff(diff)) return nullptr;
  } else {
    auto p = chooseClosePoint(left, arcNode, right, points, directrix);
    if (!p) return nullptr;
    closePoint = *p;
  }

  auto radius = getRadius(closePoint, left, arcNode, right);

  return std::make_shared<CloseEvent>(newCloseEvent(closePoint.y - radius, arcNode, closePoint));
}

std::vector<CloseEvent> processCloseEvents(std::vector<std::shared_ptr<Node>> closingNodes, double directrix)
{
  std::vector<CloseEvent> ret;
  for (auto&& n : closingNodes)
  {
    auto e = createCloseEvent(n, directrix);
    if (e)
      ret.push_back(*e);
  }

  return ret;
}

std::vector<CloseEvent> add(EventPacket const& packet, std::vector<CloseEvent>& rCQueue)
{
  auto arcNode = math::createArcNode(packet.site);
  auto directrix = packet.site.point.y;

  if (root == nullptr)
  {
    auto subTreeData = generateSubTree(packet, arcNode, rCQueue, nullptr);
    root = subTreeData.root;
    return {};
  }

  auto parent = root;
  // var side, child;
  std::shared_ptr<Node> child;

  if (root->aType != ArcType_e::EDGE)
  {
    child = root;
    auto subTreeData = generateSubTree(packet, arcNode, rCQueue, child);
    root = subTreeData.root;
    return processCloseEvents(subTreeData.nodesToClose, directrix);
  }

  // Do a binary search to find the arc node that the new
  // site intersects with
  auto rslt = intersection(parent, directrix);
  if (!rslt) throw std::runtime_error("Invalid intersection on add()");
  auto side = (packet.site.point.x < rslt->x) ? Side_e::LEFT : Side_e::RIGHT;
  child = math::getChild(parent, side);
  while (child->aType == ArcType_e::EDGE)
  {
    parent = child;
    auto i = intersection(parent, directrix);
    if (!i)
      throw std::runtime_error("Invalid intersection on 'Add'");

    side = (packet.site.point.x < i->x) ? Side_e::LEFT : Side_e::RIGHT;
    child = math::getChild(parent, side);
  }

  auto subTreeData = generateSubTree(packet, arcNode, rCQueue, child);
  math::setChild(parent, subTreeData.root, side);

  return processCloseEvents(subTreeData.nodesToClose, directrix);
}

std::vector<CloseEvent> remove(std::shared_ptr<Node> const& arcNode, vec2 point,
            double directrix, std::vector<CloseEvent>& rCQueue)
{
  // resolve ending edges
  auto prevEdge = arcNode->prevEdge();
  auto nextEdge = arcNode->nextEdge();

  // the left and right edge converge onto the point
  if (prevEdge && !prevEdge->overridden)
    commitEdge(prevEdge, point);
  if (nextEdge && !nextEdge->overridden)
    commitEdge(nextEdge, point);

  auto parent = arcNode->pParent;
  auto grandparent = parent->pParent;
  auto side = (parent->pLeft && parent->pLeft->id == arcNode->id) ? Side_e::LEFT : Side_e::RIGHT;
  auto parentSide = (grandparent->pLeft->id == parent->id) ? Side_e::LEFT : Side_e::RIGHT;

  auto newEdge = nextEdge;
  if (side == Side_e::LEFT)
    newEdge = prevEdge;

  auto siblingSide = side == Side_e::LEFT ? Side_e::RIGHT : Side_e::LEFT;
  auto sibling = math::getChild(parent, siblingSide);
  math::setChild(grandparent, sibling, parentSide);
  // the grand parent inherits the children and a new start
  // grandparent->edgeStart = point;
  sibling->pParent = grandparent;

  newEdge->edgeStart = point;

  // Cancel the close event for this arc and adjoining arcs.
  // Add new close events for new sibling arcs.
  removeCloseEventFromQueue(arcNode->id, rCQueue);
  std::vector<CloseEvent> closeEvents;
  auto prevArc = newEdge->prevArc();
  removeCloseEventFromQueue(prevArc->id, rCQueue);
  auto e = createCloseEvent(prevArc, directrix);
  if (e)
    closeEvents.push_back(*e);

  auto nextArc = newEdge->nextArc();
  removeCloseEventFromQueue(nextArc->id, rCQueue);
  e = createCloseEvent(nextArc, directrix);
  if (e)
    closeEvents.push_back(*e);
  return closeEvents;
}

ComputeResult fortune(std::vector<Event> queue, double const& sweepline, std::string& rMsg, std::string& rErr)
{
  root = nullptr;
  g_edges = {};
  g_curvedEdges = {};

  decimal_t curY = 1000.0;

  // set perhaps?
  std::vector<CloseEvent> closeEvents;

  Event event(EventType_e::UNDEFINED, 0);
  CloseEvent cEvent;
  bool onClose = false;

  // testing only
  int count = 0;

  try
  {
    while (!queue.empty() || !closeEvents.empty())
    {
      count++;
      // std::cout << "Count:" << count << std::endl;
      // get the next event closest to the sweepline
      if (queue.empty() || (!closeEvents.empty() && closeEvents.back().yval >= math::getEventY(queue.back())))
      {
        onClose = true;
        cEvent = closeEvents.back();
        closeEvents.pop_back();
        curY = cEvent.yval;
      }
      else
      {
        onClose = false;
        event = queue.back();
        queue.pop_back();
        curY = math::getEventY(event);
      }
      if (curY < sweepline)
        break;

      if (onClose)
      {
        // DEBUG ONLY
        // if (!cEvent.arcNode) throw std::runtime_error("Close Event invalid");

        auto newEvents = remove(cEvent.arcNode, cEvent.point, curY, closeEvents);
        for (auto&& e : newEvents)
        {
          // if (e.yval < curY)
          if (e.yval < curY - 0.000001 || std::abs(e.yval - curY) < 1e-6) // Simplify?
            sortedInsert(e, closeEvents);
        }
      }
      else
      {
        // Add Event
        auto packet = getEventPacket(event, queue);
        auto newEvents = add(packet, closeEvents);
        for (auto&& e : newEvents)
        {
          // if (e.yval < curY)
          if (e.yval < curY - 0.000001 || std::abs(e.yval - curY) < 1e-6) // Simplify?
            sortedInsert(e, closeEvents);
        }
      }
    }

    rMsg += ": Count:" + count;
    ComputeResult rslt{{}, g_edges, g_curvedEdges, {}, {}, closeEvents};

    // DEBUG ONLY
    setBeachline(root, rslt, sweepline);
    rMsg += ": V Count:" + std::to_string(rslt.b_edges.size())
    + ": Para Count:" + std::to_string(rslt.b_curvedEdges.size());
    return rslt;
  }
  catch(std::exception const& e)
  {
    rErr += "Error: " + std::string(e.what());
  }

  return ComputeResult();
}

// PRINTING
const std::string placeholder("_");

int getHeight(std::shared_ptr<Node> const& pNode)
{
  if (!pNode) return 0;
  return 1 + std::max(getHeight(pNode->pRight), getHeight(pNode->pLeft));
}

void getLine(std::shared_ptr<Node> const& pNode, int depth, std::vector<std::string>& vals, bool rightBranch, int& offset)
{
  if (depth <= 0 && pNode != nullptr) {
    std::string label = std::to_string(pNode->id);
    if (pNode->aType == ArcType_e::ARC_PARA)
      label += "P";
    else if (pNode->aType == ArcType_e::ARC_V)
      label += "V";
    else if (pNode->aType == ArcType_e::EDGE)
      label += "E";
    vals.push_back(label);
    return;
  }

  if (pNode->pLeft != nullptr)
  {
    // if (offset != 0) offset = std::min(0, offset - 4);
    getLine(pNode->pLeft, depth-1, vals, false, offset);
  }
  else if (depth-1 <= 0)
    vals.push_back(placeholder);

  if (pNode->pRight != nullptr)
  {
    if (rightBranch) offset += 4;
    getLine(pNode->pRight, depth-1, vals, true, offset);
  }
  else if (depth-1 <= 0)
    vals.push_back(placeholder);
}

void printRow(std::shared_ptr<Node> const& p, const int height, int depth)
{
  std::vector<std::string> vec;
  int offset = 0;
  getLine(p, depth, vec, false, offset);
  std::cout << std::setw((height - depth)*2 + offset); // scale setw with depth
  bool toggle = true; // start with eft
  if (vec.size() > 1)
  {
    for (auto&& v : vec)
    {
      if (v != placeholder)
      {
        if (toggle)
          std::cout << "/" << "   ";
        else
          std::cout << "\\" << "   ";
      }
      toggle = !toggle;
    }
    std::cout << std::endl;
    std::cout << std::setw((height - depth)*2 + offset);
  }
  for (auto&& v : vec) {
    if (v != placeholder)
      std::cout << v << "   ";
  }
  std::cout << std::endl;
}

void printTree()
{
  std::cout << "Tree:\n";
  if (!root) return;
  int h = getHeight(root);
  std::cout << "Height:" << h << std::endl;
  int height = h * 2;
  for (int i = 0; i < height; i++)
  {
    printRow(root, height, i);
  }
}

