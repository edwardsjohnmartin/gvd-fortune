#include "nodeInsert.hh"

#include "math.hh"

namespace
{
  bool isLeftHull(vec2 const& sLowerA, vec2 const& sLowerB, vec2 const& sUpperA)
  {
    auto v0 = vec2(sUpperA.x - sLowerA.x, sUpperA.y - sLowerA.y);
    auto v1 = vec2(sLowerB.x - sLowerA.x, sLowerB.y - sLowerA.y);
    return math::crossProduct(v0, v1) < 0;
  }

  // c++ form of isClosing()
  std::shared_ptr<bool> isClosingRight(std::shared_ptr<Node> child, vec2 const& p)
  {

    auto r = child->nextArc();
    // auto c = child.optSite;
    auto l = child->prevArc();

    if (!r || !l) return nullptr;

    // /* cases:
    // 1. l and c are segments and end at p
    // 2. c and r are segments and end at p
    // 2. l and r are segments and end at p
    // */

    if (child->aType == ArcType_e::ARC_V && r->aType == ArcType_e::ARC_V)
    {
      if (math::equiv2(r->b, p) && math::equiv2(child->b, p)) return std::make_shared<bool>(true);
    }

    if (l->aType == ArcType_e::ARC_V && child->aType == ArcType_e::ARC_V)
    {
      if (math::equiv2(l->b, p) && math::equiv2(child->b, p)) return std::make_shared<bool>(false);
    }

    // if (l.type === "segment" && c.type === "segment") {
    //   if (math::equiv2(l.b, p.point) && math::equiv2(c.b, p.point)) return std::make_shared<bool>(true);
    // }
    return nullptr;
  }

  std::shared_ptr<Node> createNewEdge(std::shared_ptr<Node> left, std::shared_ptr<Node> right, vec2 vertex,
                                      std::vector<CloseEvent>& rCQueue)
  {
    // left->live = false;
    // right->live = false;
    removeCloseEventFromQueue(left->id, rCQueue);
    removeCloseEventFromQueue(right->id, rCQueue);
    return math::createEdgeNode(left, right, vertex);
  }

  std::shared_ptr<Node> closePointSplit(std::shared_ptr<Node> left, std::shared_ptr<Node> right)
  {
    if (left->aType == ArcType_e::ARC_V && right->aType == ArcType_e::ARC_PARA)
    {
      return math::createEdgeNode(left, right, right->point);
    }
    else if (left->aType == ArcType_e::ARC_PARA && right->aType == ArcType_e::ARC_V)
    {
      return math::createEdgeNode(left, right, left->point);
    }

    throw std::runtime_error("Invalid close joint split");
    return nullptr;
  }

  std::shared_ptr<Node> splitArcNode(std::shared_ptr<Node> toSplit,
    std::shared_ptr<Node> node, std::vector<std::shared_ptr<Node>>& nodesToClose,
    std::vector<CloseEvent>& rCQueue)
  {
    // toSplit->live = false;
    removeCloseEventFromQueue(toSplit->id, rCQueue);
    vec2 vertex(0.0, 0.0);
    if (node->aType == ArcType_e::ARC_V)
    {
      vertex = node->a;
    }
    else
    {
      auto x = node->point.x;
      decimal_t y;
      if (toSplit->aType == ArcType_e::ARC_PARA)
      {
        auto d = toSplit->point.y == node->point.y ? node->point.y - 1e-10: node->point.y;
        auto h = toSplit->point.x;
        auto k = (d + toSplit->point.y) / 2;
        auto p = (toSplit->point.y - d) / 2;
        y = math::parabola_f(x, h, k, p);
      }
      else // else to split is a V
      {
        V obj(toSplit->a, toSplit->b, node->point.y, g_nodeId++);
        y = f_x(obj, x);
      }
      vertex = vec2(x, y);
    }
    auto eType = toSplit->aType == ArcType_e::ARC_PARA ? EventType_e::POINT : EventType_e::SEG;
    auto newEvent = eType == EventType_e::POINT ?
     Event(eType, toSplit->label, toSplit->point)
     : Event(eType, toSplit->label, vec2(0.0,0.0), toSplit->a, toSplit->b);
    auto right = math::createArcNode(newEvent);

    nodesToClose.push_back(toSplit);
    nodesToClose.push_back(right);
    auto rightEdge = math::createEdgeNode(node, right, vertex);
    return math::createEdgeNode(toSplit, rightEdge, vertex);
  }

  std::shared_ptr<Node> insertEdge(std::shared_ptr<Node> toSplit, std::shared_ptr<Node> edge,
        vec2 vertex, std::vector<std::shared_ptr<Node>>& nodesToClose,
        std::vector<CloseEvent>& rCQueue, bool addCloseNodes = true)
  {
    // toSplit->live = false;
    removeCloseEventFromQueue(toSplit->id, rCQueue);
    auto eType = toSplit->aType == ArcType_e::ARC_PARA ? EventType_e::POINT : EventType_e::SEG;
    auto newEvent = eType == EventType_e::POINT ?
     Event(eType, toSplit->label, toSplit->point)
     : Event(eType, toSplit->label, vec2(0.0,0.0), toSplit->a, toSplit->b);
    auto right = math::createArcNode(newEvent);
    if (addCloseNodes)
    {
      nodesToClose.push_back(toSplit);
      nodesToClose.push_back(right);
    }
    auto rightEdge = math::createEdgeNode(edge, right, vertex);
    return math::createEdgeNode(toSplit, rightEdge, vertex);
  }

  // Child is guaranteed to be the parabola arc
  std::shared_ptr<Node> VRegularInsert(std::shared_ptr<Node> arcNode,
              std::shared_ptr<Node> childArcNode, std::shared_ptr<Node> parentV,
              std::vector<CloseEvent>& rCQueue)
  {
    auto left = isLeftHull(childArcNode->a, childArcNode->b, parentV->a);
    if (left) {
      // // Set edge information since we are using a left joint split
      auto nextEdge = arcNode->nextEdge();
      // if (nextEdge) nextEdge.dcelEdge.generalEdge = false;
      return createNewEdge(arcNode, childArcNode, childArcNode->a, rCQueue);
    } else {
      // // Set edge information since we are using a right joint split
      auto prevEdge = arcNode->prevEdge();
      // if (prevEdge) prevEdge.dcelEdge.generalEdge = false;
      // is a arc created by the right hull joint
      return createNewEdge(childArcNode, arcNode, childArcNode->a, rCQueue);
    }
  }

  std::shared_ptr<Node> ParaInsert(std::shared_ptr<Node> child, std::shared_ptr<Node> arcNode,
                                  std::vector<std::shared_ptr<Node>>& nodesToClose,
                                  std::vector<CloseEvent>& rCQueue)
  {
    std::shared_ptr<Node> newChild = nullptr;
    // TODO performance - most nodes will not need this
    auto closingData = isClosingRight(child, arcNode->point);
    if (closingData)
    {
      // DEBUG ONLY
      if (child->aType != ArcType_e::ARC_V) throw std::runtime_error("Invalid node insertion");
      auto edgeToUpdate = child->prevEdge();
      if (*closingData)
      {
        edgeToUpdate = child->nextEdge();
      }
      if (edgeToUpdate)
      {
        edgeToUpdate->overridden = true;
        edgeToUpdate->edgeStart = arcNode->point; // General parabola points?
      }
      nodesToClose.push_back(child);
      if (*closingData)
      {
        nodesToClose.push_back(child->nextArc());
        newChild = closePointSplit(child, arcNode);
      }
      else
      {
        nodesToClose.push_back(child->prevArc());
        newChild = closePointSplit(arcNode, child);
      }
    }
    else
    {
      newChild = splitArcNode(child, arcNode, nodesToClose, rCQueue);
    }
    return newChild;
  }
}

SubTreeRslt generateSubTree(EventPacket const& e,
                                      std::shared_ptr<Node> arcNode,
                                      std::vector<CloseEvent>& rCQueue,
                                      std::shared_ptr<Node> optChild)
{
  auto tree = std::make_shared<Node>(ArcType_e::UNDEFINED, 0);
  std::vector<std::shared_ptr<Node>> nodesToClose;

  if (e.children.size() == 2)
  {
    auto leftArcNode = math::createArcNode(e.children[0]);
    auto rightArcNode = math::createArcNode(e.children[1]);
    auto newEdge = math::createEdgeNode(leftArcNode, rightArcNode, arcNode->point);
    if (optChild)
    {
      tree = splitArcNode(optChild, arcNode, nodesToClose, rCQueue);
      auto childEdge = insertEdge(arcNode, newEdge, arcNode->point, nodesToClose, rCQueue);
      math::setChild(tree->pRight, childEdge, Side_e::LEFT);
    }
    else
      tree = insertEdge(arcNode, newEdge, arcNode->point, nodesToClose, rCQueue, false);
  }
  else if (e.children.size() == 1)
  {
    if (optChild && optChild->aType == ArcType_e::ARC_V && math::equiv2(e.site.point, optChild->b)) {
      // if (!optChild.isV) throw 'Invalid insert operation';
      auto childArcNode = math::createArcNode(e.children[0]);
      tree = splitArcNode(optChild, arcNode, nodesToClose, rCQueue);
      auto parent = arcNode->pParent;
      auto newEdge = VRegularInsert(arcNode, childArcNode, optChild, rCQueue);
      math::setChild(parent, newEdge, Side_e::LEFT);
    } else if (optChild) {
      tree = splitArcNode(optChild, arcNode, nodesToClose, rCQueue);
      auto parent = arcNode->pParent;
      auto childArcNode = math::createArcNode(e.children[0]);
      auto newEdge = splitArcNode(arcNode, childArcNode, nodesToClose, rCQueue);
      math::setChild(parent, newEdge, Side_e::LEFT);
    } else {
      // case where site is the root
      auto childArcNode = math::createArcNode(e.children[0]);
      tree = splitArcNode(arcNode, childArcNode, nodesToClose, rCQueue);
    }
  }
  else
  {
    if (optChild)
      tree = ParaInsert(optChild, arcNode, nodesToClose, rCQueue);
    else
      tree = arcNode;
  }

 return {tree, nodesToClose};
}
