#include "types.hh"

#include <memory>
#include <cmath>

Event makeSegment(vec2 p1, vec2 p2, uint32_t label, bool forceOrder)
{
  if (forceOrder)
  {
    return Event(EventType_e::SEG, label, vec2(0.0, 0.0), p1, p2);
  }
  return p1.y > p2.y ? Event(EventType_e::SEG, label, vec2(0.0, 0.0), p1, p2) : Event(EventType_e::SEG, label, vec2(0.0, 0.0), p2, p1);
}

Node::Node(ArcType_e _aType, uint32_t label)
  : aType(_aType),
  side(Side_e::UNDEFINED),
  id(g_nodeId++),
  pLeft(nullptr),
  pRight(nullptr),
  pParent(nullptr),
  edgeStart(vec2(0.0,0.0)),
  point(vec2(0.0,0.0)),
  a(vec2(0.0,0.0)),
  b(vec2(0.0,0.0)),
  overridden(false),
  label(label),
  visited(false)
{}

//------------------------------------------------------------
// prevEdge
// Returns the previous in-order edge arcNode. Find the first
// ancestor to the left.
//------------------------------------------------------------
std::shared_ptr<Node> Node::prevEdge()
{
  auto node = pParent;
  auto childId = id; // ID must be unique
  while (node && node->pLeft && node->pLeft->id == childId)
  {
    childId = node->id;
    node = node->pParent;
  }
  return node;
}

std::shared_ptr<Node> Node::nextEdge()
{
  auto node = pParent;
  auto childId = id; // ID must be unique
  while (node && node->pRight && node->pRight->id == childId)
  {
    childId = node->id;
    node = node->pParent;
  }
  return node;
}

std::shared_ptr<Node> Node::prevArc()
{
  std::shared_ptr<Node> node = nullptr;
  if (aType == ArcType_e::ARC_V || aType == ArcType_e::ARC_PARA)
  {
    node = prevEdge();
    if (!node) return nullptr;
    node = node->pLeft;
  }
  else
    node = pLeft;

  while (node && node->aType == ArcType_e::EDGE)
  {
    node = node->pRight;
  }
  return node;
}

std::shared_ptr<Node> Node::nextArc()
{
  std::shared_ptr<Node> node = nullptr;
  if (aType == ArcType_e::ARC_V || aType == ArcType_e::ARC_PARA)
  {
    node = nextEdge();
    if (!node) return nullptr;
    node = node->pRight;
  }
  else
    node = pRight;

  while (node && node->aType == ArcType_e::EDGE)
  {
    node = node->pLeft;
  }
  return node;
}

