#ifndef TYPES_HH
#define TYPES_HH

#include <algorithm>
#include <iostream>
#include <memory>
#include <string>
#include <vector>

static uint32_t g_id = 0;
static uint32_t g_labelCount = 0;

/////////////////////////////////// Data Structures /////////////////////////////////////

typedef long double decimal_t;
// for better precision perhaps try
// typedef _Float128 decimal_t;

struct vec2
{
  vec2(decimal_t _x, decimal_t _y) : x(_x), y(_y) {}
  decimal_t x;
  decimal_t y;
};

struct vec4
{
  vec4(decimal_t _x, decimal_t _y, decimal_t _z, decimal_t _w) : x(_x), y(_y), z(_z), w(_w) {}
  decimal_t x;
  decimal_t y;
  decimal_t z;
  decimal_t w;
};

enum class EventType_e
{
  SEG = 1,
  POINT = 2,
  UNDEFINED = 3
};

enum class ArcType_e
{
  ARC_V = 1,
  ARC_PARA = 2,
  EDGE = 3,
  UNDEFINED = 4
};

enum class Side_e
{
  LEFT = 1,
  RIGHT = 2,
  UNDEFINED = 3
};

static uint32_t g_nodeId = 0;
//------------------------------------------------------------
// EdgeNode
// left and right are the left and right children nodes.
// left is always an ArcNode. Right may be an ArcNode or
// EdgeNode.
//------------------------------------------------------------
//------------------------------------------------------------
// ArcNode - active node segment in the beachline
//------------------------------------------------------------
class Node
{
public:
  Node(ArcType_e _aType, uint32_t label);

  std::shared_ptr<Node> prevEdge();
  std::shared_ptr<Node> nextEdge();

  std::shared_ptr<Node> prevArc();
  std::shared_ptr<Node> nextArc();

  ArcType_e aType; // otherwise an edge - also set when Edge finalized
  Side_e side; // which side of the edge
  uint32_t id;
  std::shared_ptr<Node> pLeft; // Shared pointer is only a problem if we are point to self
  std::shared_ptr<Node> pRight;
  std::shared_ptr<Node> pParent; // TODO make this a weak_ptr to avoid circular ownership
  vec2 edgeStart;
  vec2 point;
  vec2 a;
  vec2 b;
  bool overridden;
  uint32_t label;
  bool visited;
  private:
};

struct Event
{
  Event(EventType_e _type, uint32_t l, vec2 _p = vec2(0.0,0.0), vec2 _a = vec2(0.0,0.0), vec2 _b = vec2(0.0,0.0))
  : type(_type), id(g_id++), label(l), point(_p), a(_a), b(_b) {}

  EventType_e type;
  uint32_t id;
  uint32_t label;
  vec2 point;
  vec2 a;
  vec2 b;
};

struct CloseEvent
{
  // close event items
  CloseEvent() : point(0.0, 0.0), arcNode(nullptr), yval(0.0) {};
  vec2 point;
  // bool live;
  std::shared_ptr<Node> arcNode;
  decimal_t yval;
};

struct close_event_less_than
{
  inline bool operator() (CloseEvent const& lhs, CloseEvent const& rhs)
  {
    return lhs.yval < rhs.yval;
  }
};

inline void printEvent(Event const& e)
{
  std::string type;
  if (e.type == EventType_e::POINT)
    type = "Point";
  else if (e.type == EventType_e::SEG)
    type = "Segment";
  else if (e.type == EventType_e::UNDEFINED)
    type = "Undefined";

  std::cout << "Event: Type(" << type << ") id(" << e.id
    << ") label(" << e.label << ") point(" << e.point.x << ","
    << e.point.y << ") a(" << e.a.x << ","
    << e.a.y << ") b(" << e.b.x << ","
    << e.b.y << ")" << std::endl;
}

struct EventPacket
{
  Event site;
  std::vector<Event> children; //[0] - left/single child [1] - right
};

inline CloseEvent newCloseEvent(decimal_t y, std::shared_ptr<Node> const& arcNode, vec2 point)
{
  CloseEvent r;
  r.point = point;
  r.arcNode = arcNode;
  // arcNode->live = true;
  r.yval = y;
  return r;
}

inline void sortedInsert(CloseEvent const& e, std::vector<CloseEvent>& rQueue)
{
  if (e.arcNode->id == 644 || e.arcNode->id == 114)
  {
    std::cout << "testing\n";
  }
  // PERFORMANCE - see if we can speed this up
  rQueue.push_back(e);
  std::sort(rQueue.begin(), rQueue.end(), close_event_less_than());
}

// TODO performance
inline void removeCloseEventFromQueue(uint32_t id, std::vector<CloseEvent>& q)
{
  if (id == 644 || id == 114)
  {
    std::cout << "testing\n";
  }
  auto itr = std::find_if(q.begin(), q.end(), [&id](CloseEvent const& e){
    return e.arcNode && e.arcNode->id == id;
  });
  if (itr != q.end())
    q.erase(itr);
}

inline void printCloseEvent(CloseEvent const& e)
{
  std::cout << "Close Event: point(" << e.point.x << ","
  << e.point.y << ") yval(" << e.yval << ") " << std::endl;
}

Event makeSegment(vec2 p1, vec2 p2, uint32_t label, bool forceOrder);

class Polygon
{
public:
  Polygon() : orderedPointSites(), label(g_labelCount++) {}

  void addPoint(vec2 const& loc)
  {
    orderedPointSites.push_back(Event(EventType_e::POINT, label, loc));
  }

  std::vector<Event> getSegments()
  {
    if (orderedPointSites.size() < 2) return {};
    if (orderedPointSites.size() == 2)
    {
      return {makeSegment(orderedPointSites[0].point, orderedPointSites[1].point, label, false)};
    };

    std::vector<Event> rslt;
    auto p1 = orderedPointSites[0].point;
    for (size_t i = 1; i < orderedPointSites.size(); ++i)
    {
      auto p2 = orderedPointSites[i].point;
      rslt.push_back(makeSegment(p1, p2, label, false));
      p1 = p2;
    }
    auto start = orderedPointSites[0].point;
    // terminate the wrap around - no need to wrap for single segment sites
    if (orderedPointSites.size() > 3)
      rslt.push_back(makeSegment(start, p1, label, false));

    return rslt;
  }

  uint32_t getLabel() { return label; }

  std::vector<Event> orderedPointSites;
private:
  uint32_t label;
};

#endif
