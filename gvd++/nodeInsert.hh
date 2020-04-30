#ifndef NODE_INSERT_HH
#define NODE_INSERT_HH

#include <memory>
#include "types.hh"

struct SubTreeRslt
{
  std::shared_ptr<Node> root;
  std::vector<std::shared_ptr<Node>> nodesToClose;
};

SubTreeRslt generateSubTree(EventPacket const& e,
                                      std::shared_ptr<Node> arcNode,
                                      std::vector<CloseEvent>& rCQueue,
                                      std::shared_ptr<Node> optChild = nullptr);

#endif
